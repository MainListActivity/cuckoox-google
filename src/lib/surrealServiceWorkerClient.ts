// Client-side wrapper for communicating with SurrealDB Service Worker
import { RecordId } from 'surrealdb';

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
  if (typeof obj === 'object' && obj.hasOwnProperty('id') && obj.hasOwnProperty('tb')) {
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
  create(thing: string, data: unknown): Promise<any>;
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

export class SurrealServiceWorkerClient implements SurrealWorkerAPI {
  private serviceWorker: ServiceWorker | null = null;
  private pendingMessages = new Map<string, PendingMessage>();
  private messageCounter = 0;
  private liveQueryCallbacks = new Map<string, (action: string, result: any) => void>();

  constructor() {
    this.setupMessageHandler();
  }

  private setupMessageHandler() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        this.handleMessage(event.data);
      });
    }
  }

  private handleMessage(data: any) {
    const { type, messageId, payload } = deserializeRecordIds(data);

    if (type === 'live_update') {
      // Handle live query updates
      const { uuid, action, result } = payload;
      const callback = this.liveQueryCallbacks.get(uuid);
      if (callback) {
        callback(action, result);
      }
      return;
    }

    if (type === 'request_token_sync') {
      // Service Worker 请求同步 token
      this.handleTokenSyncRequest();
      return;
    }

    if (type === 'connection_state_changed') {
      // Handle connection state changes
      console.log('SurrealServiceWorkerClient: Connection state changed:', payload);
      this.handleConnectionStateChange(payload);
      return;
    }

    if (type === 'live_query_uuid_changed') {
      // Handle live query UUID changes
      const { oldUuid, newUuid } = payload;
      const callback = this.liveQueryCallbacks.get(oldUuid);
      if (callback) {
        this.liveQueryCallbacks.delete(oldUuid);
        this.liveQueryCallbacks.set(newUuid, callback);
        console.log(`SurrealServiceWorkerClient: Live query UUID updated from ${oldUuid} to ${newUuid}`);
      }
      return;
    }

    if (type === 'live_query_resubscribe_failed') {
      // Handle live query resubscription failures
      const { uuid, error } = payload;
      console.error(`SurrealServiceWorkerClient: Live query ${uuid} resubscription failed:`, error);
      return;
    }

    // Handle response messages
    if (messageId && this.pendingMessages.has(messageId)) {
      const pending = this.pendingMessages.get(messageId)!;
      this.pendingMessages.delete(messageId);

      if (type.endsWith('_response')) {
        pending.resolve(payload);
      } else if (type.endsWith('_error')) {
        pending.reject(new Error(payload.message || 'Unknown error'));
      }
    }
  }

  private handleConnectionStateChange(payload: any) {
    const { state, previousState, error, timestamp } = payload;
    
    // 可以在这里添加自定义的连接状态处理逻辑
    if (state === 'connected' && previousState !== 'connected') {
      console.log('SurrealServiceWorkerClient: Connection established');
    } else if (state === 'disconnected' || state === 'error') {
      console.warn('SurrealServiceWorkerClient: Connection lost or error occurred', error);
    } else if (state === 'reconnecting') {
      console.log('SurrealServiceWorkerClient: Attempting to reconnect...');
    }

    // 发送自定义事件给应用程序其他部分
    const event = new CustomEvent('surreal-connection-state-changed', {
      detail: { state, previousState, error, timestamp }
    });
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event);
    }
  }

  private async handleTokenSyncRequest() {
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

      await this.sendMessage('connect', {
        endpoint: import.meta.env.VITE_SURREALDB_WS_URL || 'ws://localhost:8000/rpc',
        namespace: import.meta.env.VITE_SURREALDB_NS || 'ck_go',
        database: database,
        sync_tokens: syncTokens,
      });

      console.log('Client: Successfully synced tokens to Service Worker');
    } catch (error) {
      console.error('Client: Failed to sync tokens to Service Worker:', error);
    }
  }

  private async ensureServiceWorker(): Promise<ServiceWorker> {
    if (this.serviceWorker) {
      return this.serviceWorker;
    }

    if (!('serviceWorker' in navigator)) {
      throw new Error('Service Workers are not supported in this browser');
    }

    try {

      // Register the service worker
      const registration = await navigator.serviceWorker.register(`/sw/sw-surreal.js`, { type: 'module' });

      // Try to get a service worker instance right away
      this.serviceWorker = registration.active || registration.waiting || registration.installing;

      if (this.serviceWorker) {
        return this.serviceWorker;
      }

      // If no service worker available, use a more robust waiting mechanism
      await this.waitForServiceWorkerWithRetry(registration);

      return this.serviceWorker!;
    } catch (error) {
      console.error('SurrealServiceWorkerClient: Service Worker registration failed:', error);
      throw error;
    }
  }

  private async waitForServiceWorkerWithRetry(registration: ServiceWorkerRegistration): Promise<void> {
    const maxRetries = 5;
    const baseDelay = 1000; // 1 second

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`SurrealServiceWorkerClient: Attempt ${attempt + 1} to get service worker`);

        // Check if we have a service worker now
        this.serviceWorker = registration.active || registration.waiting || registration.installing;

        if (this.serviceWorker) {
          console.log(`SurrealServiceWorkerClient: Got service worker on attempt ${attempt + 1}`);
          return;
        }

        // Wait for the service worker to be ready with a shorter timeout
        const readyPromise = navigator.serviceWorker.ready;
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Service Worker ready timeout')), 3000);
        });

        await Promise.race([readyPromise, timeoutPromise]);

        // Check again after ready
        this.serviceWorker = registration.active || registration.waiting || registration.installing;

        if (this.serviceWorker) {
          console.log(`SurrealServiceWorkerClient: Service worker ready on attempt ${attempt + 1}`);
          return;
        }

        // If this is not the last attempt, wait before retrying
        if (attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt);
          console.log(`SurrealServiceWorkerClient: Waiting ${delay}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        console.warn(`SurrealServiceWorkerClient: Attempt ${attempt + 1} failed:`, error);

        // If this is the last attempt, throw the error
        if (attempt === maxRetries - 1) {
          throw error;
        }

        // Wait before retrying
        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`SurrealServiceWorkerClient: Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Failed to get service worker after multiple attempts');
  }

  private async sendMessage(type: string, payload?: any): Promise<any> {
    const sw = await this.ensureServiceWorker();
    const messageId = `msg_${++this.messageCounter}`;

    return new Promise((resolve, reject) => {
      this.pendingMessages.set(messageId, { resolve, reject });

      // Set a timeout for the message
      setTimeout(() => {
        if (this.pendingMessages.has(messageId)) {
          this.pendingMessages.delete(messageId);
          reject(new Error(`Message timeout: ${type}`));
        }
      }, 30000); // 30 second timeout

      sw.postMessage({
        type,
        messageId,
        payload
      });
    });
  }

  async connect(config: {
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
  }): Promise<boolean> {
    const result = await this.sendMessage('connect', config);
    return result.status === 'connected';
  }

  async authenticate(token: string, refreshToken?: string, expiresIn?: number, tenantCode?: string): Promise<void> {
    await this.sendMessage('authenticate', {
      token,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      tenant_code: tenantCode
    });
  }

  async invalidate(): Promise<void> {
    await this.sendMessage('invalidate');
  }

  async setConfig(config: {
    namespace?: string;
    database?: string;
    auth?: AnyAuth;
  }): Promise<void> {
    await this.sendMessage('setConfig', config);
  }

  async query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    return await this.sendMessage('query', { sql, vars });
  }

  async mutate<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    return await this.sendMessage('mutate', { sql, vars });
  }

  async create(thing: string, data: unknown): Promise<any> {
    return await this.sendMessage('create', { thing, data });
  }

  async select(thing: string | RecordId): Promise<any> {
    return await this.sendMessage('select', { thing });
  }

  async update(thing: string | RecordId, data: unknown): Promise<any> {
    return await this.sendMessage('update', { thing, data });
  }

  async merge(thing: string | RecordId, data: unknown): Promise<any> {
    return await this.sendMessage('merge', { thing, data });
  }

  async delete(thing: string | RecordId): Promise<any> {
    return await this.sendMessage('delete', { thing });
  }

  async live(query: string, callback: (action: string, result: any) => void, vars?: Record<string, unknown>): Promise<string> {
    const result = await this.sendMessage('live', { query, vars });
    const uuid = result.uuid;

    // Store the callback for this live query
    this.liveQueryCallbacks.set(uuid, callback);

    return uuid;
  }

  async subscribeLive(uuid: string, callback: (action: string, result: any) => void): Promise<void> {
    // For Service Worker implementation, this is handled by the live() method
    // We just update the callback
    this.liveQueryCallbacks.set(uuid, callback);
  }

  async kill(uuid: string): Promise<void> {
    await this.sendMessage('kill', { uuid });
    this.liveQueryCallbacks.delete(uuid);
  }

  // Additional methods that might be needed
  async close(): Promise<void> {
    // In Service Worker context, we don't really "close" the connection
    // since it persists across tabs. We could implement a reference counting system.
    console.log('SurrealServiceWorkerClient: close() called - connection persists in Service Worker');
  }

  // Token recovery
  async recoverTokens(): Promise<void> {
    await this.sendMessage('recover_tokens');
  }

  // Connection management
  async getConnectionState(): Promise<{
    state: string;
    isConnected: boolean;
    isReconnecting: boolean;
    reconnectAttempts: number;
    endpoint?: string;
  }> {
    return await this.sendMessage('get_connection_state');
  }

  async forceReconnect(): Promise<void> {
    await this.sendMessage('force_reconnect');
  }
}

// Export a singleton instance
export const surrealServiceWorkerClient = new SurrealServiceWorkerClient();