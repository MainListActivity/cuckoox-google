import { expose } from 'comlink';
import Surreal, { AnyAuth, RecordId } from 'surrealdb';

export interface SurrealWorkerAPI {
  /** Execute a SurrealQL query */
  query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T>;
  /** Execute a SurrealQL mutation */
  mutate<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T>;
  /** Wrapper around Surreal.create */
  create(thing: string, data: unknown): Promise<any>;
  /** Wrapper around Surreal.select */
  select(thing: string | RecordId): Promise<any>;
  /** Wrapper around Surreal.update */
  update(thing: string | RecordId, data: unknown): Promise<any>;
  /** Wrapper around Surreal.merge */
  merge(thing: string | RecordId, data: unknown): Promise<any>;
  /** Wrapper around Surreal.delete */
  delete(thing: string | RecordId): Promise<any>;
  /** Wrapper around Surreal.live */
  live(query: string, callback: (action: string, result: any) => void, vars?: Record<string, unknown>): Promise<string>;
  /** Wrapper around Surreal.subscribeLive */
  subscribeLive(uuid: string, callback: (action: string, result: any) => void): Promise<void>;
  /** Kill a live query */
  kill(uuid: string): Promise<void>;
  /** Set database configuration */
  setConfig(config: {
    namespace?: string;
    database?: string;
    auth?: AnyAuth;
  }): Promise<void>;
}

// Internal interface for connection management (not exposed to outside)
interface InternalWorkerAPI extends SurrealWorkerAPI {
  connect(options: {
    endpoint: string;
    namespace: string;
    database: string;
    params?: Parameters<Surreal['connect']>[1];
    auth?: AnyAuth;
  }): Promise<boolean>;
  setConfig(config: {
    namespace?: string;
    database?: string;
    auth?: AnyAuth;
  }): Promise<void>;
  authenticate(token: string): Promise<void>;
  signin(auth: AnyAuth): Promise<void>;
  invalidate(): Promise<void>;
  close(): Promise<void>;
  setTokens(accessToken: string, refreshToken?: string, expiresIn?: number): Promise<void>;
  clearTokens(): Promise<void>;
  getStoredAccessToken(): Promise<string | null>;
  getStoredTokens(): Promise<{ accessToken: string | null; expiresAt: number | null }>;
  isAuthenticated(): Promise<boolean>;
  getCurrentUser(): Promise<any>;
  setCurrentUser(user: any): Promise<void>;
  setTenantCode(tenantCode: string): Promise<void>;
  getTenantCode(): Promise<string | null>;
}

class SurrealWorkerImpl implements InternalWorkerAPI {
  private db = new Surreal();
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private currentUser: any = null;
  // 存储当前连接的配置
  private currentEndpoint: string | null = null;
  private currentNamespace: string | null = null;
  private currentDatabase: string | null = null;
  private currentAuth: AnyAuth | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private STORAGE_KEYS = {
    ACCESS: 'access_token',
    REFRESH: 'refresh_token',
    EXPIRES: 'token_expires_at',
    TENANT_CODE: 'tenant_code',
  };

  constructor(endpoint?: string) {
    // 在 worker 启动时从 localStorage 加载 token 信息
    this.loadTokensFromStorage();
    
    // 如果提供了 endpoint，则立即建立连接
    if (endpoint) {
      this.currentEndpoint = endpoint;
      this.initializeConnection();
    }
  }

  private loadTokensFromStorage() {
    try {
      this.accessToken = this.storageGet(this.STORAGE_KEYS.ACCESS);
      this.refreshToken = this.storageGet(this.STORAGE_KEYS.REFRESH);
      const expiresStr = this.storageGet(this.STORAGE_KEYS.EXPIRES);
      this.tokenExpiresAt = expiresStr ? parseInt(expiresStr, 10) : null;
    } catch (e) {
      console.error('SurrealWorker: Failed to load tokens from storage:', e);
    }
  }

  private storageSet(key: string, val: string | null) {
    try {
      if (typeof localStorage !== 'undefined') {
        if (val === null) localStorage.removeItem(key);
        else localStorage.setItem(key, val);
      }
    } catch {
      // localStorage may not be available in some environments
    }
  }

  private storageGet(key: string): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch {
      // localStorage may not be available in some environments
    }
    return null;
  }

  private isTokenExpired(expiresAt: number | null): boolean {
    if (!expiresAt) return true;
    return Date.now() >= expiresAt - 60_000; // 1 minute leeway
  }

  private isSessionExpiredError(err: any): boolean {
    if (!(err instanceof Error)) return false;
    const m = err.message.toLowerCase();
    return (
      m.includes('session') && m.includes('expired')) ||
      m.includes('token expired') ||
      m.includes('jwt') ||
      m.includes('unauthorized') ||
      m.includes('401');
  }

  private isConnectionError(err: any): boolean {
    if (!(err instanceof Error)) return false;
    const m = err.message.toLowerCase();
    return (
      m.includes('connection') ||
      m.includes('network') ||
      m.includes('timeout') ||
      m.includes('websocket') ||
      m.includes('disconnected') ||
      m.includes('econnrefused') ||
      m.includes('enotfound')
    );
  }

  private async initializeConnection(): Promise<void> {
    if (!this.currentEndpoint) {
      throw new Error('No endpoint provided for connection');
    }
    
    try {
      await this.db.connect(this.currentEndpoint);
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // 如果有配置的 namespace 和 database，使用它们
      if (this.currentNamespace && this.currentDatabase) {
        await this.db.use({ 
          namespace: this.currentNamespace, 
          database: this.currentDatabase 
        });
      }
      
      // 如果有认证信息，进行认证
      if (this.currentAuth) {
        await this.db.signin(this.currentAuth);
      }
      
      // 尝试使用存储的 token 进行认证
      const storedToken = this.storageGet(this.STORAGE_KEYS.ACCESS);
      if (storedToken && !this.isTokenExpired(this.tokenExpiresAt)) {
        try {
          await this.db.authenticate(storedToken);
          console.log('SurrealWorker: Successfully authenticated with stored token');
        } catch (e) {
          console.log('SurrealWorker: Stored token authentication failed:', e);
          await this.clearTokens();
        }
      }
      
      console.log('SurrealWorker: Connection established successfully');
    } catch (error) {
      console.error('SurrealWorker: Initial connection failed:', error);
      this.isConnected = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('SurrealWorker: Max reconnect attempts reached');
      return;
    }
    
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    setTimeout(() => {
      console.log(`SurrealWorker: Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.initializeConnection();
    }, delay);
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected || this.db.status !== 'connected') {
      await this.initializeConnection();
    }
  }

  private async handleConnectionError<T>(operation: () => Promise<T>): Promise<T> {
    try {
      await this.ensureConnection();
      return await operation();
    } catch (error) {
      if (this.isConnectionError(error)) {
        console.warn('SurrealWorker: Connection error detected, attempting reconnection');
        this.isConnected = false;
        this.scheduleReconnect();
      }
      
      if (this.isSessionExpiredError(error)) {
        await this.clearTokens();
      }
      
      throw error;
    }
  }

  async connect({ endpoint, namespace, database, params, auth }: InternalWorkerAPI['connect'] extends (arg: infer P) => any ? P : never): Promise<boolean> {
    // 检查是否需要重新连接
    const needReconnect = this.db.status !== 'connected' || 
                         this.currentEndpoint !== endpoint ||
                         this.currentNamespace !== namespace ||
                         this.currentDatabase !== database;
    
    if (!needReconnect) {
      return true;
    }
    
    // 如果已连接但参数不同，先关闭连接
    if (this.db.status === 'connected') {
      await this.db.close();
    }
    
    // 保存连接配置
    this.currentEndpoint = endpoint;
    this.currentNamespace = namespace;
    this.currentDatabase = database;
    this.currentAuth = auth || null;
    
    // 建立新连接
    await this.db.connect(endpoint, params);
    await this.db.use({ namespace, database });
    this.isConnected = true;
    this.reconnectAttempts = 0;
    
    // 如果有认证信息，进行认证
    if (auth) {
      await this.db.signin(auth);
    }
    
    // 尝试使用存储的 token 进行认证
    const storedToken = this.storageGet(this.STORAGE_KEYS.ACCESS);
    if (storedToken && !this.isTokenExpired(this.tokenExpiresAt)) {
      try {
        await this.db.authenticate(storedToken);
        console.log('SurrealWorker: Successfully authenticated with stored token');
      } catch (e) {
        console.log('SurrealWorker: Stored token authentication failed:', e);
        // 清除无效的 token
        await this.clearTokens();
      }
    }
    
    return true;
  }

  async setConfig(config: {
    namespace?: string;
    database?: string;
    auth?: AnyAuth;
  }): Promise<void> {
    let needReconnect = false;
    
    // 检查是否需要重新连接
    if (config.namespace && config.namespace !== this.currentNamespace) {
      this.currentNamespace = config.namespace;
      needReconnect = true;
    }
    
    if (config.database && config.database !== this.currentDatabase) {
      this.currentDatabase = config.database;
      needReconnect = true;
    }
    
    if (config.auth) {
      this.currentAuth = config.auth;
    }
    
    // 如果需要重新连接且当前已连接
    if (needReconnect && this.isConnected) {
      await this.ensureConnection();
      
      // 重新设置 namespace 和 database
      if (this.currentNamespace && this.currentDatabase) {
        await this.db.use({ 
          namespace: this.currentNamespace, 
          database: this.currentDatabase 
        });
      }
    }
    
    // 如果有新的认证信息，进行认证
    if (config.auth && this.isConnected) {
      await this.db.signin(config.auth);
    }
  }

  async query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    return this.handleConnectionError(async () => {
      const res = await this.db.query<T[]>(sql, vars);
      // SurrealDB query returns an array of results, get the first result
      if (Array.isArray(res) && res.length > 0) {
        return res[0] as T;
      }
      return res as T;
    });
  }

  async mutate<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    return this.handleConnectionError(async () => {
      const res = await this.db.query<T[]>(sql, vars);
      // SurrealDB query returns an array of results, get the first result
      if (Array.isArray(res) && res.length > 0) {
        return res[0] as T;
      }
      return res as T;
    });
  }

  async create(thing: string, data: unknown): Promise<any> {
    return this.handleConnectionError(async () => {
      return this.db.create(thing as any, data as any);
    });
  }

  async select(thing: string | RecordId): Promise<any> {
    return this.handleConnectionError(async () => {
      return this.db.select(thing as any);
    });
  }

  async update(thing: string | RecordId, data: unknown): Promise<any> {
    return this.handleConnectionError(async () => {
      return this.db.update(thing as any, data as any);
    });
  }

  async merge(thing: string | RecordId, data: unknown): Promise<any> {
    return this.handleConnectionError(async () => {
      return this.db.merge(thing as any, data as any);
    });
  }

  async delete(thing: string | RecordId): Promise<any> {
    return this.handleConnectionError(async () => {
      return this.db.delete(thing as any);
    });
  }

  async live(query: string, callback: (action: string, result: any) => void, vars?: Record<string, unknown>): Promise<string> {
    // SurrealDB returns a Uuid object; convert to string for easier serialization
    const uuid = await (this.db.live as any)(query, callback as any, vars);
    return String(uuid);
  }

  async subscribeLive(uuid: string, callback: (action: string, result: any) => void): Promise<void> {
    await (this.db.subscribeLive as any)(uuid as any, callback as any);
  }

  async kill(uuid: string): Promise<void> {
    await this.db.kill(uuid as any);
  }

  async authenticate(token: string): Promise<void> {
    await this.db.authenticate(token);
    // 更新存储的 token
    this.accessToken = token;
    this.storageSet(this.STORAGE_KEYS.ACCESS, token);
    console.log('SurrealWorker: Successfully authenticated and stored token');
  }

  async signin(auth: AnyAuth): Promise<void> {
    const result = await this.db.signin(auth);
    return result as any;
  }

  async invalidate(): Promise<void> {
    await this.db.invalidate();
    await this.clearTokens();
  }

  async setTokens(accessToken: string, refreshToken?: string, expiresIn?: number): Promise<void> {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken ?? null;
    this.tokenExpiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;

    this.storageSet(this.STORAGE_KEYS.ACCESS, accessToken);
    if (refreshToken) this.storageSet(this.STORAGE_KEYS.REFRESH, refreshToken);
    if (this.tokenExpiresAt) this.storageSet(this.STORAGE_KEYS.EXPIRES, String(this.tokenExpiresAt));
    
    // 自动使用新的 token 进行认证
    if (this.db.status === 'connected') {
      try {
        await this.db.authenticate(accessToken);
        console.log('SurrealWorker: Successfully authenticated with new token');
      } catch (e) {
        console.error('SurrealWorker: Failed to authenticate with new token:', e);
        throw e;
      }
    }
  }
  
  // 添加租户代码存储方法
  async setTenantCode(tenantCode: string): Promise<void> {
    this.storageSet(this.STORAGE_KEYS.TENANT_CODE, tenantCode);
  }
  
  async getTenantCode(): Promise<string | null> {
    return this.storageGet(this.STORAGE_KEYS.TENANT_CODE);
  }

  async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;

    this.storageSet(this.STORAGE_KEYS.ACCESS, null);
    this.storageSet(this.STORAGE_KEYS.REFRESH, null);
    this.storageSet(this.STORAGE_KEYS.EXPIRES, null);
    // 清理租户代码
    this.storageSet(this.STORAGE_KEYS.TENANT_CODE, null);
  }

  async getStoredAccessToken(): Promise<string | null> {
    if (this.isTokenExpired(this.tokenExpiresAt)) return null;
    return this.accessToken;
  }

  async getStoredTokens(): Promise<{ accessToken: string | null; expiresAt: number | null }> {
    // Lazy load from localStorage if memory empty
    if (!this.accessToken) {
      this.accessToken = this.storageGet(this.STORAGE_KEYS.ACCESS);
      const expiresStr = this.storageGet(this.STORAGE_KEYS.EXPIRES);
      this.tokenExpiresAt = expiresStr ? parseInt(expiresStr, 10) : null;
    }
    if (this.isTokenExpired(this.tokenExpiresAt)) {
      return { accessToken: null, expiresAt: null };
    }
    return { accessToken: this.accessToken, expiresAt: this.tokenExpiresAt };
  }

  async isAuthenticated(): Promise<boolean> {
    return !!(await this.getStoredAccessToken());
  }

  async getCurrentUser(): Promise<any> {
    return this.currentUser;
  }

  async setCurrentUser(user: any): Promise<void> {
    this.currentUser = user;
  }

  async close(): Promise<void> {
    this.isConnected = false;
    await this.db.close();
  }
}

// Create internal instance with full API
const internalWorker = new SurrealWorkerImpl();

// Create proxy that only exposes public SurrealWorkerAPI methods
const publicWorker: SurrealWorkerAPI = {
  query: internalWorker.query.bind(internalWorker),
  mutate: internalWorker.mutate.bind(internalWorker),
  create: internalWorker.create.bind(internalWorker),
  select: internalWorker.select.bind(internalWorker),
  update: internalWorker.update.bind(internalWorker),
  merge: internalWorker.merge.bind(internalWorker),
  delete: internalWorker.delete.bind(internalWorker),
  live: internalWorker.live.bind(internalWorker),
  subscribeLive: internalWorker.subscribeLive.bind(internalWorker),
  kill: internalWorker.kill.bind(internalWorker),
  setConfig: internalWorker.setConfig.bind(internalWorker),
};

// Only expose the public API
expose(publicWorker);

// Export internal worker for connection management (used by internal services)
export { internalWorker };