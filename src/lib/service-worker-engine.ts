import { AbstractEngine, ConnectionStatus, Emitter, type RpcRequest, type RpcResponse,type Engines } from 'surrealdb';

/**
 * RPC请求消息接口
 */
interface RpcRequestMessage {
  type: 'rpc_request';
  payload: {
    requestId: number;
    method: string;
    params: unknown[];
  };
}

/**
 * RPC响应消息接口
 */
interface RpcResponseMessage {
  type: 'rpc_response';
  payload: {
    requestId: number;
    result?: unknown;
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
 * Service Worker引擎上下文
 */
class ServiceWorkerEngineContext {
  readonly emitter: Emitter;
  readonly encodeCbor: (value: unknown) => ArrayBuffer;
  readonly decodeCbor: (value: ArrayBufferLike) => any;

  constructor() {
    this.emitter = new Emitter();
    // 简化的CBOR编码/解码 - 实际项目中应该使用proper CBOR库
    this.encodeCbor = (value: unknown) => {
      return new TextEncoder().encode(JSON.stringify(value)).buffer;
    };
    this.decodeCbor = (value: ArrayBufferLike) => {
      return JSON.parse(new TextDecoder().decode(value));
    };
  }
}

/**
 * Service Worker引擎
 * 基于SurrealDB AbstractEngine实现，通过Service Worker进行数据库操作
 */
export class ServiceWorkerEngine extends AbstractEngine {
  private serviceWorker?: ServiceWorker;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }>();
  private liveQueryCallbacks = new Map<string, (action: string, result: unknown) => void>();

  constructor() {
    // 创建Service Worker引擎上下文
    const context = new ServiceWorkerEngineContext();
    super(context as any); // 类型断言，简化实现
    console.log('ServiceWorkerEngine: 初始化Service Worker引擎');
  }

  /**
   * 设置连接状态
   */
  private setStatus(status: ConnectionStatus): void {
    this.status = status;
  }

  /**
   * 连接到Service Worker引擎
   */
  async connect(url: URL | string): Promise<void> {
    // 将字符串URL转换为URL对象
    const urlObj = typeof url === 'string' ? new URL(url) : url;
    console.log('ServiceWorkerEngine: 开始连接Service Worker, URL:', urlObj.toString());
    
    this.setStatus(ConnectionStatus.Connecting);
    
    try {
      await this.setupServiceWorkerConnection();
      
      this.connection.url = urlObj;
      this.setStatus(ConnectionStatus.Connected);
      
      // 触发连接事件
      this.emitter.emit('open');
      console.log('ServiceWorkerEngine: 连接成功');
    } catch (error) {
      console.error('ServiceWorkerEngine: 连接失败', error);
      this.setStatus(ConnectionStatus.Error);
      throw error;
    }
  }

  /**
   * 断开连接
   */
  async disconnect(): Promise<void> {
    console.log('ServiceWorkerEngine: 断开连接');
    
    this.pendingRequests.clear();
    this.liveQueryCallbacks.clear();
    this.setStatus(ConnectionStatus.Disconnected);
    
    // 触发断开事件
    this.emitter.emit('close');
  }

  /**
   * 执行RPC请求
   */
  async rpc<Method extends string, Params extends unknown[] | undefined, Result>(
    request: RpcRequest<Method, Params>
  ): Promise<RpcResponse<Result>> {
    if (this.status !== ConnectionStatus.Connected || !this.serviceWorker) {
      throw new Error('Service Worker引擎未连接');
    }

    const requestId = ++this.requestId;
    
    console.log(`ServiceWorkerEngine: 发送RPC请求 ${request.method}`, request.params);

    return new Promise((resolve, reject) => {
      // 存储pending请求
      this.pendingRequests.set(requestId, { resolve, reject });

      // 发送RPC请求到Service Worker
      const message: RpcRequestMessage = {
        type: 'rpc_request',
        payload: {
          requestId,
          method: request.method,
          params: request.params || []
        }
      };

      this.serviceWorker!.postMessage(message);

      // 设置超时（30秒）
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`RPC请求超时: ${request.method}`));
        }
      }, 30000);
    });
  }

  /**
   * 获取版本信息（简化实现）
   */
  async version(url: URL, timeout?: number): Promise<string> {
    return '2.3.7';
  }

  /**
   * 导出数据（简化实现）
   */
  async export(): Promise<string> {
    const response = await this.rpc({ method: 'export', params: [] });
    return response.result as string || '';
  }

  /**
   * 导入数据（简化实现）
   */
  async import(data: string): Promise<void> {
    await this.rpc({ method: 'import', params: [data] });
  }

  /**
   * 设置Service Worker连接
   */
  private async setupServiceWorkerConnection(): Promise<void> {
    // 等待Service Worker准备就绪
    const registration = await navigator.serviceWorker.ready;
    console.log('ServiceWorkerEngine: Service Worker注册状态', {
      active: !!registration.active,
      installing: !!registration.installing,
      waiting: !!registration.waiting
    });

    // 尝试获取活跃的Service Worker
    this.serviceWorker = registration.active || registration.waiting || registration.installing;

    if (!this.serviceWorker) {
      throw new Error('Service Worker不可用 - 未找到任何可用的Service Worker实例');
    }

    // 如果Service Worker还在安装中，等待其激活
    if (this.serviceWorker.state !== 'activated') {
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Service Worker激活超时'));
        }, 10000);

        this.serviceWorker!.addEventListener('statechange', () => {
          console.log('ServiceWorkerEngine: Service Worker状态变更:', this.serviceWorker!.state);
          if (this.serviceWorker!.state === 'activated') {
            clearTimeout(timeoutId);
            resolve(undefined);
          } else if (this.serviceWorker!.state === 'redundant') {
            clearTimeout(timeoutId);
            reject(new Error('Service Worker变为冗余状态'));
          }
        });
      });
    }

    // 监听Service Worker消息
    navigator.serviceWorker.addEventListener('message', this.handleMessage.bind(this));
    
    console.log('ServiceWorkerEngine: Service Worker连接已建立', {
      state: this.serviceWorker.state,
      scriptURL: this.serviceWorker.scriptURL
    });
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
        
      default:
        console.warn(`ServiceWorkerEngine: 未知消息类型 ${type}`);
    }
  }

  /**
   * 处理RPC响应
   */
  private handleRpcResponse(payload: RpcResponseMessage['payload']): void {
    const { requestId, result, error } = payload;
    const pending = this.pendingRequests.get(requestId);
    
    if (pending) {
      this.pendingRequests.delete(requestId);
      
      if (error) {
        const errorObj = new Error(error.description);
        (errorObj as any).code = error.code;
        (errorObj as any).details = error.details;
        (errorObj as any).information = error.information;
        pending.reject(errorObj);
      } else {
        pending.resolve({ result });
      }
    }
  }

  /**
   * 处理Live Query回调
   */
  private handleLiveQueryCallback(payload: LiveQueryCallbackMessage['payload']): void {
    const { subscriptionId, action, result } = payload;
    const callback = this.liveQueryCallbacks.get(subscriptionId);
    
    if (callback) {
      try {
        callback(action, result);
      } catch (error) {
        console.error(`ServiceWorkerEngine: Live Query回调执行失败`, error);
      }
    }
  }

  /**
   * 注册Live Query回调
   * @internal 此方法由SurrealDB SDK内部调用
   */
  registerLiveQueryCallback(subscriptionId: string, callback: (action: string, result: unknown) => void): void {
    this.liveQueryCallbacks.set(subscriptionId, callback);
    console.log(`ServiceWorkerEngine: 注册Live Query回调 ${subscriptionId}`);
  }

  /**
   * 取消Live Query回调
   * @internal 此方法由SurrealDB SDK内部调用
   */
  unregisterLiveQueryCallback(subscriptionId: string): void {
    this.liveQueryCallbacks.delete(subscriptionId);
    console.log(`ServiceWorkerEngine: 取消Live Query回调 ${subscriptionId}`);
  }
}

/**
 * 创建Service Worker引擎工厂函数
 */
export function serviceWorkerEngines(): Engines {
  return {
    sw: ServiceWorkerEngine
  };
}