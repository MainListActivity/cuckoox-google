import {
  ConnectionUnavailable,
  Publisher,
} from "surrealdb";

import type {
  ConnectionState,
  DriverContext,
  EngineEvents,
  SurrealEngine,
  RpcRequest,
  RpcResponse,
  LiveMessage,
} from "surrealdb";


interface Call<T> {
  request: object;
  resolve: (value: RpcResponse<T>) => void;
  reject: (error: Error) => void;
}

/**
 * RPC请求消息接口
 */
interface RpcRequestMessage {
  type: 'rpc_request';
  payload: {
    requestId: string;
    encodeParam: Uint8Array;
  };
}

/**
 * RPC响应消息接口
 */
interface RpcResponseMessage {
  type: 'rpc_response';
  payload: {
    requestId: string;
    encodeResp: Uint8Array;
    error?: {
      code: string;
      details: string;
      description: string;
      information: string;
    };
  };
}

/**
 * Live Query回调消息接口
 */
interface LiveQueryCallbackMessage {
  type: 'live_query_callback';
  payload: {
    subscriptionId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    result: unknown;
  };
}

/**
 * Service Worker引擎
 * 基于SurrealDB WebSocketEngine实现，通过Service Worker进行数据库操作
 */
export class ServiceWorkerEngine implements SurrealEngine {
  #publisher = new Publisher<EngineEvents>();
  #state: ConnectionState | undefined;
  #serviceWorker?: ServiceWorker;
  #calls = new Map<string, Call<unknown>>();
  #context: DriverContext;
  private registration?: ServiceWorkerRegistration;
  private messageListener?: (event: MessageEvent) => void;

  subscribe<K extends keyof EngineEvents>(
    event: K,
    listener: (...payload: EngineEvents[K]) => void,
  ): () => void {
    return this.#publisher.subscribe(event, listener);
  }

  constructor(context: DriverContext) {
    console.log('ServiceWorkerEngine: 初始化Service Worker引擎');
    this.#context = context;
    // 初始化消息监听器
    this.messageListener = this.handleMessage.bind(this);
  }

  /**
   * 获取编码上下文（兼容性访问）
   */
  get context(): DriverContext {
    return this.#context;
  }

  /**
   * 打开连接到Service Worker引擎
   */
  open(state: ConnectionState): void {
    this.#publisher.publish("connecting");
    this.#state = state;

    console.log('ServiceWorkerEngine: 开始连接Service Worker, URL:', state.url.toString());
    (async () => {
      await this.setupServiceWorkerConnection();
      // 重新发送所有待处理请求
      for (const [requestId, call] of this.#calls.entries()) {
        const {request} = call;
        if(!request){
          console.warn('ServiceWorkerEngine: 无效的RPC请求，跳过发送');
          this.#calls.delete(requestId);
          continue;
        }
        this.#serviceWorker?.postMessage({
          type: 'rpc_request',
          payload: this.#context.encode(request)
        });
      }
      this.#publisher.publish("connected");
    })();
  }

  /**
   * 关闭连接
   */
  async close(): Promise<void> {
    console.log('ServiceWorkerEngine: 断开连接');
  }

  /**
   * 发送RPC请求
   */
  send<Method extends string, Params extends unknown[] | undefined, Result>(
    request: RpcRequest<Method, Params>,
  ): Promise<RpcResponse<Result>> {
    return new Promise((resolve, reject) => {
      const id = this.generateUniqueId();
      const call: Call<Result> = {
        request: { id, ...request },
        resolve,
        reject,
      };
      const encoded = this.#context.encode(call.request);
      const decoder = new TextDecoder("utf-8"); // 指定编码格式为 UTF-8
      const result = decoder.decode(encoded);
      console.log(`ServiceWorkerEngine: 发送RPC请求 ${request.method}`, request.params, new String(result));

      this.#calls.set(id, call as Call<unknown>);

      // 发送RPC请求到Service Worker
      const message: RpcRequestMessage = {
        type: 'rpc_request',
        payload: {
          requestId: id,
          encodeParam: encoded,
        }
      };

      this.#serviceWorker?.postMessage(message);
    });
  }

  /**
   * 导入数据
   */
  async import(data: string): Promise<void> {
    if (!this.#state) {
      throw new ConnectionUnavailable();
    }

    // 通过Service Worker代理导入请求
    await this.send({ method: 'import', params: [data] });
  }

  /**
   * 导出数据
   */
  async export(): Promise<string> {
    if (!this.#state) {
      throw new ConnectionUnavailable();
    }

    // 通过Service Worker代理导出请求
    const response = await this.send<'export', undefined, string>({ method: 'export' });
    return response.result || '';
  }

  /**
   * 设置Service Worker连接
   */
  private async setupServiceWorkerConnection(): Promise<void> {
    // 等待Service Worker准备就绪
    this.registration = await navigator.serviceWorker.ready;
    console.log('ServiceWorkerEngine: Service Worker注册状态', {
      active: !!this.registration.active,
      installing: !!this.registration.installing,
      waiting: !!this.registration.waiting
    });

    // 尝试获取活跃的Service Worker
    this.#serviceWorker = this.registration.active || this.registration.waiting || this.registration.installing!;

    if (!this.#serviceWorker) {
      throw new Error('Service Worker不可用 - 未找到任何可用的Service Worker实例');
    }

    // 如果Service Worker还在安装中，等待其激活
    if (this.#serviceWorker.state !== 'activated') {
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Service Worker激活超时'));
        }, 10000);

        this.#serviceWorker!.addEventListener('statechange', () => {
          console.log('ServiceWorkerEngine: Service Worker状态变更:', this.#serviceWorker!.state);
          if (this.#serviceWorker!.state === 'activated') {
            clearTimeout(timeoutId);
            resolve(undefined);
          } else if (this.#serviceWorker!.state === 'redundant') {
            clearTimeout(timeoutId);
            reject(new Error('Service Worker变为冗余状态'));
          }
        });
      });
    }

    // 清理旧的消息监听器
    if (this.messageListener) {
      navigator.serviceWorker.removeEventListener('message', this.messageListener);
    }

    // 添加Service Worker消息监听器
    navigator.serviceWorker.addEventListener('message', this.messageListener!);

    // 监听Service Worker更新
    this.setupServiceWorkerUpdateListener();

    console.log('ServiceWorkerEngine: Service Worker连接已建立', {
      state: this.#serviceWorker.state,
      scriptURL: this.#serviceWorker.scriptURL
    });
  }

  /**
   * 设置Service Worker更新监听器
   * 注意: 与Workbox协作，避免重复处理
   */
  private setupServiceWorkerUpdateListener(): void {
    if (!this.registration) return;

    // 只监听控制权变更事件，让Workbox处理更新检测
    // 当Workbox决定激活新Service Worker时，我们会收到controllerchange事件
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('ServiceWorkerEngine: Service Worker控制权发生变更 (由Workbox管理)');
      // 控制权变更意味着新的Service Worker已接管，需要更新引用
      this.handleControllerChange();
    });
  }

  /**
   * 处理控制权变更 (与Workbox协作)
   */
  private async handleControllerChange(): Promise<void> {
    if (navigator.serviceWorker.controller) {
      console.log('ServiceWorkerEngine: Workbox已激活新Service Worker，更新引用');

      // 更新Service Worker引用为当前控制器
      this.#serviceWorker = navigator.serviceWorker.controller;

      console.log('ServiceWorkerEngine: Service Worker引用已更新，通信将使用新实例');
    }
  }

  /**
   * 处理Service Worker激活通知
   */
  private handleServiceWorkerActivated(payload: any): void {
    console.log('ServiceWorkerEngine: Service Worker已激活', payload);

    // 更新Service Worker引用为当前控制器
    if (navigator.serviceWorker.controller) {
      this.#serviceWorker = navigator.serviceWorker.controller;
    }
  }

  /**
   * 处理Service Worker消息
   */
  private handleMessage(event: MessageEvent): void {
    const { type, payload } = event.data;

    switch (type) {
      case 'rpc_response':
        this.handleRpcResponse(payload);
        break;

      case 'live_query_callback':
        this.handleLiveQueryCallback(payload);
        break;

      case 'sw-activated':
        this.handleServiceWorkerActivated(payload);
        break;

      default:
        console.warn(`ServiceWorkerEngine: 未知消息类型 ${type}`);
    }
  }

  /**
   * 处理RPC响应
   */
  private handleRpcResponse(payload: RpcResponseMessage['payload']): void {
    const { requestId, encodeResp, error } = payload;
    const call = this.#calls.get(requestId);
    const rpcResp = this.#context.decode<RpcResponse>(encodeResp); // 解码响应
    if (call) {
      try {
        if (error) {
          const errorObj = new Error(error.description);
          (errorObj as any).code = error.code;
          (errorObj as any).details = error.details;
          (errorObj as any).information = error.information;
          call.reject(errorObj);
        } else {
          call.resolve(rpcResp);
        }
      } finally {
        this.#calls.delete(requestId);
      }
    }
  }

  /**
   * 处理Live Query回调
   */
  private handleLiveQueryCallback(payload: LiveQueryCallbackMessage['payload']): void {
    const { result } = payload;

    // 发布live事件到订阅者
    this.#publisher.publish("live", result as LiveMessage);
  }

  /**
   * 生成唯一ID - 替代内部的getIncrementalID
   */
  private generateUniqueId(): string {
    // 使用时间戳 + 随机数 + 计数器确保唯一性
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    const counter = (this.#calls.size + 1).toString(36);
    return `sw-${timestamp}-${random}-${counter}`;
  }
}