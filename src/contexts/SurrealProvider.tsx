import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
} from 'react';
import { RecordId } from 'surrealdb';
import { authService } from '@/src/services/authService';

// Define AnyAuth type based on the WASM version
export type AnyAuth = {
  username: string;
  password: string;
} | {
  token: string;
} | {
  namespace: string;
  database: string;
  scope: string;
  [key: string]: unknown;
};

// Custom error for authentication required
export class AuthenticationRequiredError extends Error {
  constructor(message: string = '用户未登录，请先登录') {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

// 租户代码检查错误类型
export class TenantCodeMissingError extends Error {
  constructor(message: string = 'Tenant code is missing') {
    super(message);
    this.name = 'TenantCodeMissingError';
  }
}

/**
 * 递归检查并重构被序列化的RecordId对象
 * 当RecordId对象通过ServiceWorker传递时，会丢失其原型，变成普通对象
 * 这个函数会检测这种情况并重新构造RecordId
 */
function deserializeRecordIds(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  // 检查是否是被序列化的RecordId对象（具有id和tb属性）
  if (typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, 'id') && Object.prototype.hasOwnProperty.call(obj, 'tb')) {
    // 这很可能是一个被序列化的RecordId，重新构造它
    return new RecordId(obj.tb, obj.id);
  }

  // 如果是数组，递归处理每个元素
  if (Array.isArray(obj)) {
    return obj.map(item => deserializeRecordIds(item));
  }

  // 如果是对象，递归处理每个属性
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deserializeRecordIds(value);
    }
    if (Object.entries(result).length !== 0) {
      return result;
    }
  }

  // 其他类型直接返回
  return obj;
}

export interface SurrealWorkerAPI {
  query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T>;
  mutate<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T>;
  create(thing: string | RecordId, data: unknown): Promise<any>;
  select(thing: string | RecordId): Promise<any>;
  update(thing: string | RecordId, data: unknown): Promise<any>;
  merge(thing: string | RecordId, data: unknown): Promise<any>;
  delete(thing: string | RecordId): Promise<any>;
  live(query: string, callback: (action: string, result: any) => void, vars?: Record<string, unknown>): Promise<string>;
  subscribeLive(uuid: string, callback: (action: string, result: any) => void): Promise<void>;
  kill(uuid: string): Promise<void>;
  connect(config: {
    endpoint: string;
    namespace: string;
    database: string;
    auth?: AnyAuth;
    sync_tokens?: {
      access_token?: string | null;
      refresh_token?: string | null;
      token_expires_at?: string | null;
      tenant_code?: string | null;
    };
  }): Promise<boolean>;
  authenticate(token: string, refreshToken?: string, expiresIn?: number, tenantCode?: string): Promise<void>;
  invalidate(): Promise<void>;
  setConfig(config: {
    namespace?: string;
    database?: string;
    auth?: AnyAuth;
  }): Promise<void>;
  close(): Promise<void>;

  // Token recovery
  recoverTokens(): Promise<void>;

  // Connection management
  getConnectionState(): Promise<{
    state: string;
    isConnected: boolean;
    isAuthenticated?: boolean;
    isReconnecting: boolean;
    reconnectAttempts: number;
    endpoint?: string;
  }>;
  forceReconnect(): Promise<void>;
}

interface PendingMessage {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

interface SurrealProviderProps {
  children: React.ReactNode;
  /** Provide a pre-initialised Surreal-like client (used in unit tests) */
  client?: SurrealWorkerAPI | any;
  autoConnect?: boolean;
}

export interface SurrealContextValue {
  // Direct service worker client access for raw operations
  client: SurrealWorkerAPI | null;
  
  // Backward compatibility alias
  surreal: SurrealWorkerAPI | null;
  
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  error: Error | null;
  
  // Additional compatibility properties
  isSuccess?: boolean;
  
  // Connection management (internal use)
  reconnect: () => Promise<void>;
  
  // Service Worker communication interface
  sendServiceWorkerMessage: (type: string, payload?: any) => Promise<any>;
  isServiceWorkerAvailable: () => boolean;
  waitForServiceWorkerReady: () => Promise<void>;
  
  // Authentication status from SurrealDB
  getAuthStatus: () => Promise<boolean>;

  // 租户代码检查和重定向
  checkTenantCodeAndRedirect: () => boolean;

  // 客户端清理
  disposeSurrealClient: () => Promise<void>;
  
  // 数据库连接管理
  checkDatabaseConnection: () => Promise<{isConnected: boolean; error?: string}>;
  initializeDatabaseConnection: () => Promise<void>;
}

const SurrealContext = createContext<SurrealContextValue | undefined>(undefined);

export const SurrealProvider: React.FC<SurrealProviderProps> = ({
  children,
  client: externalClient,
  autoConnect = true,
}) => {
  const [isConnecting, setConnecting] = useState(false);
  const [isConnected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // ServiceWorker 相关状态
  const [serviceWorker, setServiceWorker] = useState<ServiceWorker | null>(null);
  const pendingMessagesRef = useRef(new Map<string, PendingMessage>());
  const messageCounterRef = useRef(0);
  const liveQueryCallbacksRef = useRef(new Map<string, (action: string, result: any) => void>());
  const isInitializedRef = useRef(false);
  const initializationPromiseRef = useRef<Promise<void> | null>(null);

  /**
   * 检查租户代码是否存在，如果不存在则清除认证状态并重定向到登录页面
   */
  const checkTenantCodeAndRedirect = useCallback((): boolean => {
    const tenantCode = localStorage.getItem('tenant_code');
    
    if (!tenantCode) {
      // 清除认证状态
      localStorage.removeItem('cuckoox-selectedCaseId');
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('token_expires_at');
      
      // 重定向到登录页面
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      
      return false;
    }
    
    return true;
  }, []);

  /**
   * 设置消息处理器
   */
  const setupMessageHandler = useCallback(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        handleMessage(event.data);
      });
    }
  }, []);

  /**
   * 处理来自 Service Worker 的消息
   */
  const handleMessage = useCallback((data: any) => {
    const { type, messageId, payload } = deserializeRecordIds(data);

    if (type === 'live_update') {
      // Handle live query updates
      const { uuid, action, result } = payload;
      const callback = liveQueryCallbacksRef.current.get(uuid);
      if (callback) {
        callback(action, result);
      }
      return;
    }

    if (type === 'request_token_sync') {
      // Service Worker 请求同步 token
      handleTokenSyncRequest();
      return;
    }

    if (type === 'connection_state_changed') {
      // Handle connection state changes
      console.log('SurrealProvider: Connection state changed:', payload);
      handleConnectionStateChange(payload);
      return;
    }

    if (type === 'live_query_uuid_changed') {
      // Handle live query UUID changes
      const { oldUuid, newUuid } = payload;
      const callback = liveQueryCallbacksRef.current.get(oldUuid);
      if (callback) {
        liveQueryCallbacksRef.current.delete(oldUuid);
        liveQueryCallbacksRef.current.set(newUuid, callback);
        console.log(`SurrealProvider: Live query UUID updated from ${oldUuid} to ${newUuid}`);
      }
      return;
    }

    if (type === 'live_query_resubscribe_failed') {
      // Handle live query resubscription failures
      const { uuid, error } = payload;
      console.error(`SurrealProvider: Live query ${uuid} resubscription failed:`, error);
      return;
    }

    if (type === 'auth_state_changed') {
      // Handle authentication state changes
      const { isAuthenticated, reason, timestamp } = payload;
      console.log('SurrealProvider: Authentication state changed:', { isAuthenticated, reason, timestamp });
      
      // 发送自定义事件给应用程序其他部分
      const event = new CustomEvent('auth-state-changed', {
        detail: { isAuthenticated, reason, timestamp }
      });
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(event);
      }
      
      // 如果用户未认证，可以考虑清理本地状态
      if (!isAuthenticated) {
        console.log('SurrealProvider: User not authenticated, may need to redirect to login');
        // 这里可以添加重定向到登录页面的逻辑
      }
      
      return;
    }

    // Handle response messages
    if (messageId && pendingMessagesRef.current.has(messageId)) {
      const pending = pendingMessagesRef.current.get(messageId)!;
      pendingMessagesRef.current.delete(messageId);

      if (type.endsWith('_response')) {
        pending.resolve(payload);
      } else if (type.endsWith('_error')) {
        pending.reject(new Error(payload.message || 'Unknown error'));
      }
    }
  }, []);

  /**
   * 处理连接状态变化
   */
  const handleConnectionStateChange = useCallback((payload: any) => {
    const { state, previousState, error: connectionError, timestamp } = payload;

    // 可以在这里添加自定义的连接状态处理逻辑
    if (state === 'connected' && previousState !== 'connected') {
      console.log('SurrealProvider: Connection established');
      setConnected(true);
      setError(null);
    } else if (state === 'disconnected' || state === 'error') {
      console.warn('SurrealProvider: Connection lost or error occurred', connectionError);
      setConnected(false);
      if (connectionError) {
        setError(new Error(connectionError));
      }
    } else if (state === 'reconnecting') {
      console.log('SurrealProvider: Attempting to reconnect...');
      setConnecting(true);
    }

    // 发送自定义事件给应用程序其他部分
    const event = new CustomEvent('surreal-connection-state-changed', {
      detail: { state, previousState, error: connectionError, timestamp }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
  }, []);

  /**
   * 处理 Token 同步请求
   */
  const handleTokenSyncRequest = useCallback(async () => {
    try {
      // 获取 localStorage 中的 token 并同步到 Service Worker
      const syncTokens = {
        access_token: localStorage.getItem('access_token'),
        refresh_token: localStorage.getItem('refresh_token'),
        token_expires_at: localStorage.getItem('token_expires_at'),
        tenant_code: localStorage.getItem('tenant_code'),
      };

      const tenantCode = localStorage.getItem('tenant_code');
      const database = tenantCode || 'test';

      await sendMessage('connect', {
        endpoint: import.meta.env.VITE_SURREALDB_WS_URL || 'ws://localhost:8000/rpc',
        namespace: import.meta.env.VITE_SURREALDB_NS || 'ck_go',
        database: database,
        sync_tokens: syncTokens,
      });

      console.log('SurrealProvider: Successfully synced tokens to Service Worker');
    } catch (error) {
      console.error('SurrealProvider: Failed to sync tokens to Service Worker:', error);
    }
  }, []);

  /**
   * 处理 Service Worker 更新
   */
  const handleServiceWorkerUpdate = useCallback((newWorker: ServiceWorker) => {
    // 可以在这里显示通知给用户，或者自动更新
    console.log('SurrealProvider: 发现新版本的 Service Worker');

    // 在 Service Worker 更新前，记录当前的连接配置
    const currentConnectionConfig = {
      endpoint: import.meta.env.VITE_SURREALDB_WS_URL || 'ws://localhost:8000/rpc',
      namespace: import.meta.env.VITE_SURREALDB_NS || 'ck_go',
      database: localStorage.getItem('tenant_code') || 'test',
      sync_tokens: {
        access_token: localStorage.getItem('access_token'),
        refresh_token: localStorage.getItem('refresh_token'),
        token_expires_at: localStorage.getItem('token_expires_at'),
        tenant_code: localStorage.getItem('tenant_code'),
      }
    };

    // 设置一个超时刷新机制，防止controllerchange事件未触发
    const forceRefreshTimeout = setTimeout(() => {
      console.log('SurrealProvider: Service Worker更新超时，强制刷新页面');
      window.location.reload();
    }, 5000); // 5秒超时

    // 监听新worker的状态变化，确保在正确的时机发送SKIP_WAITING
    const handleStateChange = () => {
      console.log('SurrealProvider: 新Service Worker状态:', newWorker.state);
      if (newWorker.state === 'installed') {
        console.log('SurrealProvider: 发送SKIP_WAITING消息给新Service Worker');
        newWorker.postMessage({ type: 'SKIP_WAITING' });
        newWorker.removeEventListener('statechange', handleStateChange);
      } else if (newWorker.state === 'activated') {
        console.log('SurrealProvider: 新Service Worker已激活');
        // 清除超时计时器，因为controllerchange事件应该会处理刷新
        clearTimeout(forceRefreshTimeout);
        
        // 新的 Service Worker 激活后，发送连接配置以便重连
        console.log('SurrealProvider: 向新Service Worker发送连接配置');
        newWorker.postMessage({
          type: 'connect',
          payload: currentConnectionConfig
        });
        
        // 延迟一点时间后刷新页面，让新的 Service Worker 有时间处理连接
        setTimeout(() => {
          if (navigator.serviceWorker.controller) {
            console.log('SurrealProvider: Service Worker激活完成，刷新页面');
            window.location.reload();
          }
        }, 1000);
        newWorker.removeEventListener('statechange', handleStateChange);
      }
    };

    // 如果已经是installed状态，直接发送消息
    if (newWorker.state === 'installed') {
      console.log('SurrealProvider: 新Service Worker已安装，发送SKIP_WAITING消息');
      newWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // 否则监听状态变化
      newWorker.addEventListener('statechange', handleStateChange);
    }

    // 额外的激活监听器，用于清理超时
    const handleActivation = () => {
      console.log('SurrealProvider: Service Worker activated事件触发');
      clearTimeout(forceRefreshTimeout);
      newWorker.removeEventListener('activate', handleActivation);
    };
    
    if (newWorker.state === 'activating' || newWorker.state === 'activated') {
      clearTimeout(forceRefreshTimeout);
    } else {
      newWorker.addEventListener('activate', handleActivation);
    }
  }, []);
  /**
   * 设置 Service Worker 更新处理
   */
  const setupServiceWorkerUpdateHandling = useCallback((registration: ServiceWorkerRegistration) => {
    // 监听 service worker 更新
    registration.addEventListener('updatefound', () => {
      console.log('SurrealProvider: Service Worker 更新检测到');
      const newWorker = registration.installing;

      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          console.log('SurrealProvider: Service Worker 状态变化:', newWorker.state);

          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // 有旧的 service worker 在运行，需要更新
              console.log('SurrealProvider: 新的 Service Worker 已安装，准备更新');
              handleServiceWorkerUpdate(newWorker);
            } else {
              // 第一次安装
              console.log('SurrealProvider: Service Worker 首次安装完成');
            }
          } else if (newWorker.state === 'activated') {
            console.log('SurrealProvider: 新的 Service Worker 已激活');
          }
        });
      }
    });

    // 监听 service worker 控制器变化
    const handleControllerChange = () => {
      console.log('SurrealProvider: Service Worker 控制器已变化，页面将重新加载');
      
      // 使用 requestAnimationFrame 来确保在下一帧执行刷新，避免竞态条件
      requestAnimationFrame(() => {
        // 确保我们正在使用新的 service worker
        if (navigator.serviceWorker.controller) {
          console.log('SurrealProvider: 新的 Service Worker 控制器已生效，重新加载页面');
          // 强制刷新页面，忽略缓存
          window.location.reload();
        } else {
          console.warn('SurrealProvider: 控制器变化但没有新控制器，延迟重试');
          // 如果没有控制器，稍后重试
          setTimeout(() => {
            if (navigator.serviceWorker.controller) {
              console.log('SurrealProvider: 延迟检测到新控制器，重新加载页面');
              window.location.reload();
            }
          }, 500);
        }
      });
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // 检查是否有等待中的 Service Worker
    if (registration.waiting) {
      console.log('SurrealProvider: 发现等待中的 Service Worker，准备更新');
      handleServiceWorkerUpdate(registration.waiting);
    }

    // 定期检查更新
    scheduleUpdateCheck(registration);
  }, [handleServiceWorkerUpdate]);


  /**
   * 定期更新检查
   */
  const scheduleUpdateCheck = useCallback((registration: ServiceWorkerRegistration) => {
    // 每5分钟检查一次更新
    setInterval(() => {
      registration.update().catch(err => {
        console.warn('SurrealProvider: 更新检查失败:', err);
      });
    }, 5 * 60 * 1000); // 5分钟

    // 页面获得焦点时也检查更新
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        registration.update().catch(err => {
          console.warn('SurrealProvider: 更新检查失败:', err);
        });
      }
    });
  }, []);

  /**
   * 等待 Service Worker 就绪
   */
  const waitForServiceWorkerWithRetry = useCallback(async (registration: ServiceWorkerRegistration): Promise<void> => {
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`SurrealProvider: Attempt ${attempt + 1} to get service worker`);

        // Check if we have a service worker now
        const sw = registration.active || registration.waiting || registration.installing;

        if (sw) {
          console.log(`SurrealProvider: Got service worker on attempt ${attempt + 1}`);
          setServiceWorker(sw);
          return;
        }

        // Wait for the service worker to be ready with a shorter timeout
        const readyPromise = navigator.serviceWorker.ready;
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Service Worker ready timeout')), 3000);
        });

        await Promise.race([readyPromise, timeoutPromise]);

        // Check again after ready
        const swAfterReady = registration.active || registration.waiting || registration.installing;

        if (swAfterReady) {
          console.log(`SurrealProvider: Service worker ready on attempt ${attempt + 1}`);
          setServiceWorker(swAfterReady);
          return;
        }

        // If this is not the last attempt, wait before retrying
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`SurrealProvider: Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.warn(`SurrealProvider: Attempt ${attempt + 1} failed:`, error);

        // If this is the last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw error;
        }

        // Wait before retrying
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`SurrealProvider: Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Failed to get service worker after multiple attempts');
  }, []);

  /**
   * 确保 Service Worker 可用
   */
  const ensureServiceWorker = useCallback(async (): Promise<ServiceWorker> => {
    if (serviceWorker) {
      return serviceWorker;
    }

    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Workers are not supported in this browser');
    }

    try {
      // Register the service worker with update checking
      const registration = await navigator.serviceWorker.register(`/sw/sw-surreal.js`, {
        type: 'module',
        updateViaCache: 'none' // 强制跳过 HTTP 缓存检查更新
      });

      // 设置更新检查
      setupServiceWorkerUpdateHandling(registration);

      // Try to get a service worker instance right away
      let sw = registration.active || registration.waiting || registration.installing;

      if (sw) {
        setServiceWorker(sw);
        return sw;
      }

      // If no service worker available, use a more robust waiting mechanism
      await waitForServiceWorkerWithRetry(registration);

      // After waiting, get the actual service worker from registration
      sw = registration.active || registration.waiting || registration.installing;
      
      if (!sw) {
        throw new Error('Service Worker not available after registration and waiting');
      }

      return sw;
    } catch (error) {
      console.error('SurrealProvider: Service Worker registration failed:', error);
      throw error;
    }
  }, [serviceWorker, setupServiceWorkerUpdateHandling, waitForServiceWorkerWithRetry]);

  /**
   * 发送消息到 Service Worker
   */
  const sendMessage = useCallback(async (type: string | RecordId, payload?: any): Promise<any> => {
    // 确保ServiceWorker可用，获取实际的ServiceWorker实例
    const currentServiceWorker = await ensureServiceWorker();
      
    const messageId = `msg_${++messageCounterRef.current}`;

    return new Promise((resolve, reject) => {
      pendingMessagesRef.current.set(messageId, { resolve, reject });

      // Set a timeout for the message
      setTimeout(() => {
        if (pendingMessagesRef.current.has(messageId)) {
          pendingMessagesRef.current.delete(messageId);
          reject(new Error(`Message timeout: ${type}`));
        }
      }, 30000); // 30 second timeout

      currentServiceWorker.postMessage({
        type,
        messageId,
        payload
      });
    });
  }, [ensureServiceWorker]);

  /**
   * 检查数据库连接状态 (用于外部调用)
   */
  const checkDatabaseConnection = useCallback(async (): Promise<{isConnected: boolean; error?: string}> => {
    try {
      const result = await sendMessage('get_connection_state', {});
      return {
        isConnected: result.isConnected || false,
        error: result.error
      };
    } catch (error) {
      console.error('SurrealProvider: 数据库连接检查失败:', error);
      return {
        isConnected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, [sendMessage]);

  /**
   * 初始化Service Worker中的数据库连接 (用于外部调用)
   */
  const initializeDatabaseConnection = useCallback(async (): Promise<void> => {
    try {
      // 获取当前token信息
      const syncTokens = {
        access_token: localStorage.getItem('access_token'),
        refresh_token: localStorage.getItem('refresh_token'),
        token_expires_at: localStorage.getItem('token_expires_at'),
        tenant_code: localStorage.getItem('tenant_code'),
      };

      const tenantCode = localStorage.getItem('tenant_code');
      const database = tenantCode || 'test';

      const result = await sendMessage('connect', {
        endpoint: import.meta.env.VITE_SURREALDB_WS_URL || 'ws://localhost:8000/rpc',
        namespace: import.meta.env.VITE_SURREALDB_NS || 'ck_go',
        database: database,
        sync_tokens: syncTokens,
      });
      
      if (result.status !== 'connected') {
        throw new Error(`Database connection failed: ${result.error || 'Unknown error'}`);
      }
      
      console.log('SurrealProvider: 数据库连接初始化成功');
    } catch (error) {
      console.error('SurrealProvider: 数据库连接初始化失败:', error);
      throw error;
    }
  }, [sendMessage]);

  /**
   * 内部使用的数据库连接检查（直接与SW通信，避免循环依赖）
   */
  const checkDatabaseConnectionInternal = useCallback(async (sw: ServiceWorker): Promise<{isConnected: boolean; error?: string}> => {
    try {
      console.log('SurrealProvider: 正在检查数据库连接状态...');
      
      const result = await new Promise<any>((resolve, reject) => {
        const messageId = `check_connection_${Date.now()}`;
        
        const handleMessage = (event: MessageEvent) => {
          if (event.data.messageId === messageId) {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            if (event.data.type.endsWith('_response')) {
              resolve(event.data.payload);
            } else {
              reject(new Error(event.data.payload?.message || 'Connection check failed'));
            }
          }
        };
        
        navigator.serviceWorker.addEventListener('message', handleMessage);
        
        sw.postMessage({
          type: 'get_connection_state',
          messageId,
          payload: {}
        });
        
        // 3秒超时
        setTimeout(() => {
          navigator.serviceWorker.removeEventListener('message', handleMessage);
          reject(new Error('Connection check timeout'));
        }, 3000);
      });
      
      console.log('SurrealProvider: 数据库连接状态检查结果:', result);
      
      return {
        isConnected: result.isConnected || false,
        error: result.error
      };
    } catch (error) {
      console.error('SurrealProvider: 数据库连接检查失败:', error);
      return {
        isConnected: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }, []);

  /**
   * 内部使用的数据库连接初始化（直接与SW通信，避免循环依赖）
   */
  const initializeDatabaseConnectionInternal = useCallback(async (sw: ServiceWorker): Promise<void> => {
    try {
      console.log('SurrealProvider: 正在初始化数据库连接...');
      
      // 获取当前token信息
      const syncTokens = {
        access_token: localStorage.getItem('access_token'),
        refresh_token: localStorage.getItem('refresh_token'),
        token_expires_at: localStorage.getItem('token_expires_at'),
        tenant_code: localStorage.getItem('tenant_code'),
      };

      const tenantCode = localStorage.getItem('tenant_code');
      const database = tenantCode || 'test';

      // 发送连接请求
      const result = await new Promise<any>((resolve, reject) => {
        const messageId = `init_connection_${Date.now()}`;
        
        const handleMessage = (event: MessageEvent) => {
          if (event.data.messageId === messageId) {
            navigator.serviceWorker.removeEventListener('message', handleMessage);
            if (event.data.type.endsWith('_response')) {
              resolve(event.data.payload);
            } else {
              reject(new Error(event.data.payload?.message || 'Connection initialization failed'));
            }
          }
        };
        
        navigator.serviceWorker.addEventListener('message', handleMessage);
        
        sw.postMessage({
          type: 'connect',
          messageId,
          payload: {
            endpoint: import.meta.env.VITE_SURREALDB_WS_URL || 'ws://localhost:8000/rpc',
            namespace: import.meta.env.VITE_SURREALDB_NS || 'ck_go',
            database: database,
            sync_tokens: syncTokens,
          }
        });
        
        // 15秒超时 - 给service worker更多时间进行连接和重连
        setTimeout(() => {
          navigator.serviceWorker.removeEventListener('message', handleMessage);
          reject(new Error('Connection initialization timeout'));
        }, 15000);
      });
      
      if (result.status !== 'connected') {
        throw new Error(`Database connection failed: ${result.error || 'Unknown error'}`);
      }
      
      console.log('SurrealProvider: 数据库连接初始化成功');
    } catch (error) {
      console.error('SurrealProvider: 数据库连接初始化失败:', error);
      throw error;
    }
  }, []);

  /**
   * 预初始化 ServiceWorker
   */
  const initialize = useCallback(async (): Promise<void> => {
    if (isInitializedRef.current) {
      return;
    }

    if (initializationPromiseRef.current) {
      return initializationPromiseRef.current;
    }

    console.log('SurrealProvider: 正在初始化 ServiceWorker...');
    initializationPromiseRef.current = (async () => {
      try {
        const sw = await ensureServiceWorker();
        
        // 检查数据库连接状态
        const connectionState = await checkDatabaseConnectionInternal(sw);
        
        if (!connectionState.isConnected) {
          console.log('SurrealProvider: 数据库连接异常，正在重新初始化连接...');
          await initializeDatabaseConnectionInternal(sw);
        } else {
          console.log('SurrealProvider: 数据库连接正常');
        }
        
        isInitializedRef.current = true;
        console.log('SurrealProvider: 初始化完成');
      } catch (error) {
        console.error('SurrealProvider: 初始化失败:', error);
        initializationPromiseRef.current = null;
        throw error;
      }
    })();

    await initializationPromiseRef.current;
  }, [ensureServiceWorker, checkDatabaseConnectionInternal, initializeDatabaseConnectionInternal]);

  /**
   * 创建内置的 SurrealWorkerAPI 实现
   */
  const createInternalClient = useCallback((): SurrealWorkerAPI => {
    return {
      async connect(config) {
        const result = await sendMessage('connect', config);
        return result.status === 'connected';
      },

      async authenticate(token: string, refreshToken?: string, expiresIn?: number, tenantCode?: string) {
        await sendMessage('authenticate', {
          token,
          refresh_token: refreshToken,
          expires_in: expiresIn,
          tenant_code: tenantCode
        });
      },

      async invalidate() {
        await sendMessage('invalidate');
      },

      async setConfig(config) {
        await sendMessage('setConfig', config);
      },

      async query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
        return await sendMessage('query', { sql, vars });
      },

      async mutate<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
        return await sendMessage('mutate', { sql, vars });
      },

      async create(thing: string | RecordId, data: unknown) {
        return await sendMessage('create', { thing, data });
      },

      async select(thing: string | RecordId) {
        return await sendMessage('select', { thing });
      },

      async update(thing: string | RecordId, data: unknown) {
        return await sendMessage('update', { thing, data });
      },

      async merge(thing: string | RecordId, data: unknown) {
        return await sendMessage('merge', { thing, data });
      },

      async delete(thing: string | RecordId) {
        return await sendMessage('delete', { thing });
      },

      async live(query: string, callback: (action: string, result: any) => void, vars?: Record<string, unknown>): Promise<string> {
        const result = await sendMessage('live', { query, vars });
        const uuid = result.uuid;

        // Store the callback for this live query
        liveQueryCallbacksRef.current.set(uuid, callback);

        return uuid;
      },

      async subscribeLive(uuid: string, callback: (action: string, result: any) => void) {
        // For Service Worker implementation, this is handled by the live() method
        // We just update the callback
        liveQueryCallbacksRef.current.set(uuid, callback);
      },

      async kill(uuid: string) {
        await sendMessage('kill', { uuid });
        liveQueryCallbacksRef.current.delete(uuid);
      },

      async close() {
        // In Service Worker context, we don't really "close" the connection
        // since it persists across tabs. We could implement a reference counting system.
        console.log('SurrealProvider: close() called - connection persists in Service Worker');
      },

      async recoverTokens() {
        await sendMessage('recover_tokens');
      },

      async getConnectionState() {
        return await sendMessage('get_connection_state');
      },

      async forceReconnect() {
        await sendMessage('force_reconnect');
      }
    };
  }, [sendMessage]);

  const [internalClient, setInternalClient] = useState<SurrealWorkerAPI | null>(null);

  /**
   * 连接到 SurrealDB
   */
  const connect = useCallback(async () => {
    if (externalClient) {
      setInternalClient(externalClient);
      setConnected(true);
      return;
    }

    if (isConnected && internalClient) return;

    setConnecting(true);
    setError(null);

    try {
      // 首先初始化 ServiceWorker，确保其正常加载
      await initialize();
      
      // 创建内置客户端
      const client = createInternalClient();
      
      // Use service worker client directly
      const tenantCode = localStorage.getItem('tenant_code');
      const database = tenantCode || 'test';
      
      const syncTokens = {
        access_token: localStorage.getItem('access_token'),
        refresh_token: localStorage.getItem('refresh_token'),
        token_expires_at: localStorage.getItem('token_expires_at'),
        tenant_code: tenantCode,
      };

      const connected = await client.connect({
        endpoint: import.meta.env.VITE_SURREALDB_WS_URL || 'ws://localhost:8000/rpc',
        namespace: import.meta.env.VITE_SURREALDB_NS || 'ck_go',
        database: database,
        sync_tokens: syncTokens,
      });

      if (connected) {
        setInternalClient(client);
        setConnected(true);
        
        // Inject client into authService for dependency injection
        authService.setSurrealClient(client);
        
        // Setup Service Worker communication interfaces
        const serviceWorkerComm = {
          sendMessage: (type: string, payload?: any) => sendMessage(type, payload),
          isAvailable: () => isServiceWorkerAvailable(),
          waitForReady: () => waitForServiceWorkerReady(),
        };
        
        
        // Setup client getter for services that need it
        const clientGetter = async () => {
          if (!client) {
            throw new Error('SurrealDB client not available');
          }
          return client;
        };
        
        // Import and setup services dynamically to avoid circular dependencies
        try {
          const { messageService } = await import('@/src/services/messageService');
          messageService.setClientGetter(clientGetter);
          
          const { businessNotificationService } = await import('@/src/services/businessNotificationService');
          businessNotificationService.setClientGetter(clientGetter);
          
          const { caseReminderService } = await import('@/src/services/caseReminderService');
          caseReminderService.setClientGetter(clientGetter);
          
          const { bidirectionalSyncService } = await import('@/src/services/bidirectionalSyncService');
          bidirectionalSyncService.setServiceWorkerComm(serviceWorkerComm);
          
          const { pageDataCacheService } = await import('@/src/services/pageDataCacheService');
          pageDataCacheService.setServiceWorkerComm(serviceWorkerComm);
          
          const { incrementalSyncService } = await import('@/src/services/incrementalSyncService');
          incrementalSyncService.setServiceWorkerComm(serviceWorkerComm);
        } catch (error) {
          console.warn('SurrealProvider: Some services could not be initialized:', error);
        }
      } else {
        throw new Error('Failed to connect to database');
      }
      
    } catch (e) {
      console.error('SurrealProvider: 连接失败:', e);
      setError(e as Error);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }, [externalClient, isConnected, internalClient, initialize, createInternalClient, sendMessage]);

  /**
   * 重新连接
   */
  const reconnect = useCallback(async () => {
    setConnected(false);
    setInternalClient(null);
    await connect();
  }, [connect]);

  /**
   * Service Worker 通信方法
   */
  const sendServiceWorkerMessage = useCallback(async (type: string, payload?: any): Promise<any> => {
    if (externalClient) {
      // For test environments, return mock response
      console.log('SurrealProvider: Mock Service Worker message:', type, payload);
      return Promise.resolve({ success: true });
    }

    if (!internalClient) {
      throw new Error('SurrealDB client not available');
    }

    try {
      return await sendMessage(type, payload);
    } catch (error) {
      console.error('SurrealProvider: Service Worker communication error:', error);
      throw error;
    }
  }, [externalClient, internalClient, sendMessage]);

  /**
   * 检查 Service Worker 是否可用
   */
  const isServiceWorkerAvailable = useCallback((): boolean => {
    if (externalClient) {
      // Always return true for test environments
      return true;
    }
    
    return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  }, [externalClient]);

  /**
   * 等待 Service Worker 就绪
   */
  const waitForServiceWorkerReady = useCallback(async (): Promise<void> => {
    if (externalClient) {
      // No-op for test environments
      return Promise.resolve();
    }
    
    // 如果已经初始化，直接返回
    if (isInitializedRef.current && serviceWorker) {
      return;
    }

    // 否则进行初始化
    await initialize();
  }, [externalClient, serviceWorker, initialize]);

  /**
   * 从SurrealDB获取认证状态
   */
  const getAuthStatus = useCallback(async (): Promise<boolean> => {
    if (externalClient) {
      // 测试环境返回mock状态
      return true;
    }

    try {
      return await authService.getAuthStatusFromSurreal();
    } catch (error) {
      console.error('SurrealProvider: 获取认证状态失败:', error);
      return false;
    }
  }, [externalClient]);

  /**
   * 清理客户端资源
   */
  const disposeSurrealClient = useCallback(async () => {
    if (!internalClient) return;
    try {
      await internalClient.close();
    } catch {
      // ignore
    }
    // Note: Service Workers persist across tabs, so we don't terminate them
    // We just reset our client reference
    setInternalClient(null);
    setConnected(false);
    isInitializedRef.current = false;
    initializationPromiseRef.current = null;
  }, [internalClient]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
  }, [autoConnect, connect]);

  // Setup message handler on mount
  useEffect(() => {
    setupMessageHandler();
  }, [setupMessageHandler]);

  // Provide a dummy proxy that has async no-op methods to prevent "x is not a function" runtime errors
  // before the real Surreal worker is ready.
  const dummyClient = useMemo(() => {
    const handler: ProxyHandler<Record<string, unknown>> = {
      get(_, prop) {
        if (prop === 'query' || prop === 'mutate' || prop === 'create' || prop === 'select' || 
            prop === 'update' || prop === 'merge' || prop === 'delete' || prop === 'live' || 
            prop === 'subscribeLive' || prop === 'kill') {
          // Return a function that indicates the client is not ready
          return () => {
            console.log(`Surreal client not ready – attempted to call "${String(prop)}" before connection established`);
            return Promise.reject(new Error(`Surreal client not ready – attempted to call "${String(prop)}" before connection established`));
          };
        }
        // For other properties, return undefined to indicate they don't exist
        return undefined;
      },
    };
    return new Proxy({}, handler) as unknown as SurrealWorkerAPI;
  }, []);

  const value = useMemo<SurrealContextValue>(() => ({
    // 只有在测试环境中使用 externalClient 时才使用 dummyClient，否则使用真实的 client 或 null
    client: externalClient ? (internalClient ?? dummyClient) : internalClient,
    surreal: externalClient ? (internalClient ?? dummyClient) : internalClient, // Backward compatibility alias
    isConnected,
    isConnecting,
    error,
    isSuccess: isConnected, // Backward compatibility
    reconnect,
    // Service Worker communication interface
    sendServiceWorkerMessage,
    isServiceWorkerAvailable,
    waitForServiceWorkerReady,
    // Authentication status
    getAuthStatus,
    // 租户代码检查和重定向
    checkTenantCodeAndRedirect,
    // 客户端清理
    disposeSurrealClient,
    
    // 数据库连接管理
    checkDatabaseConnection,
    initializeDatabaseConnection,
  }), [
    internalClient, dummyClient, isConnected, isConnecting, error, reconnect, sendServiceWorkerMessage, 
    getAuthStatus, externalClient, checkTenantCodeAndRedirect, disposeSurrealClient, isServiceWorkerAvailable, 
    waitForServiceWorkerReady, checkDatabaseConnection, initializeDatabaseConnection
  ]);

  return <SurrealContext.Provider value={value}>{children}</SurrealContext.Provider>;
};

// Hook exports
export const useSurreal = () => {
  const ctx = useContext(SurrealContext);
  if (!ctx) throw new Error('useSurreal must be used within a SurrealProvider');
  return ctx;
};

export const useSurrealClient = () => useSurreal().client;
export const useSurrealContext = useSurreal; // Alias for backward compatibility

// Service Worker communication hooks
export const useServiceWorkerComm = () => {
  const ctx = useSurreal();
  return {
    sendMessage: ctx.sendServiceWorkerMessage,
    isAvailable: ctx.isServiceWorkerAvailable,
    waitForReady: ctx.waitForServiceWorkerReady,
  };
};

// 租户代码检查 hook
export const useTenantCodeCheck = () => {
  const ctx = useSurreal();
  return ctx.checkTenantCodeAndRedirect;
};

// 客户端清理 hook
export const useSurrealClientDisposal = () => {
  const ctx = useSurreal();
  return ctx.disposeSurrealClient;
};

// 数据库连接管理 hook
export const useDatabaseConnection = () => {
  const ctx = useSurreal();
  return {
    checkConnection: ctx.checkDatabaseConnection,
    initializeConnection: ctx.initializeDatabaseConnection,
  };
};

/**
 * 获取 SurrealDB 客户端的单例方法 - 向后兼容
 * 现在通过 SurrealProvider 提供
 */
export const useSurrealClientSingleton = () => {
  const { client, checkTenantCodeAndRedirect } = useSurreal();
  
  const getSurrealClient = useCallback(async (): Promise<SurrealWorkerAPI> => {
    if (!client) {
      throw new Error('SurrealDB client not available - ensure SurrealProvider is connected');
    }
    return client;
  }, [client]);

  const getSurrealClientSafe = useCallback(async (): Promise<SurrealWorkerAPI> => {
    // 在非登录页面时检查租户代码
    if (window.location.pathname !== '/login' && !checkTenantCodeAndRedirect()) {
      throw new TenantCodeMissingError('Tenant code is missing, redirecting to login');
    }
    
    return getSurrealClient();
  }, [getSurrealClient, checkTenantCodeAndRedirect]);

  return {
    surrealClient: getSurrealClient,
    surrealClientSafe: getSurrealClientSafe,
  };
};

export { SurrealContext as Context };