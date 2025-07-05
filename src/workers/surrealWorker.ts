import { expose } from 'comlink';
import Surreal, { AnyAuth, RecordId } from 'surrealdb';

export interface SurrealWorkerAPI {
  connect(options: {
    endpoint: string;
    namespace: string;
    database: string;
    params?: Parameters<Surreal['connect']>[1];
    auth?: AnyAuth;
  }): Promise<boolean>;
  query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T>;
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
  /** Authenticate with JWT */
  authenticate(token: string): Promise<void>;
  /** Sign in with username/password etc */
  signin(auth: AnyAuth): Promise<void>;
  /** Invalidate current session */
  invalidate(): Promise<void>;
  /** Close the underlying SurrealDB connection */
  close(): Promise<void>;
  /** Store auth / refresh tokens and optionally expiry */
  setTokens(accessToken: string, refreshToken?: string, expiresIn?: number): Promise<void>;
  /** Clear in-memory tokens */
  clearTokens(): Promise<void>;
  /** Get stored access token */
  getStoredAccessToken(): Promise<string | null>;
  /** Return both token and expiry */
  getStoredTokens(): Promise<{ accessToken: string | null; expiresAt: number | null }>;
  /** Return boolean authentication state */
  isAuthenticated(): Promise<boolean>;
  /** Get cached user info */
  getCurrentUser(): Promise<any>;
  /** Cache user info inside worker */
  setCurrentUser(user: any): Promise<void>;
  /** Store tenant code */
  setTenantCode(tenantCode: string): Promise<void>;
  /** Get stored tenant code */
  getTenantCode(): Promise<string | null>;
}

class SurrealWorkerImpl implements SurrealWorkerAPI {
  private db = new Surreal();
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private currentUser: any = null;
  // 存储当前连接的配置
  private currentEndpoint: string | null = null;
  private currentNamespace: string | null = null;
  private currentDatabase: string | null = null;
  private STORAGE_KEYS = {
    ACCESS: 'access_token',
    REFRESH: 'refresh_token',
    EXPIRES: 'token_expires_at',
    TENANT_CODE: 'tenant_code',
  };

  constructor() {
    // 在 worker 启动时从 localStorage 加载 token 信息
    this.loadTokensFromStorage();
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
    } catch {}
  }

  private storageGet(key: string): string | null {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(key);
      }
    } catch {}
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

  async connect({ endpoint, namespace, database, params, auth }: SurrealWorkerAPI['connect'] extends (arg: infer P) => any ? P : never): Promise<boolean> {
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
    
    // 建立新连接
    await this.db.connect(endpoint, params);
    await this.db.use({ namespace, database });
    
    // 保存连接配置
    this.currentEndpoint = endpoint;
    this.currentNamespace = namespace;
    this.currentDatabase = database;
    
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

  async query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    try {
      const res = await this.db.query<T[]>(sql, vars);
      // SurrealDB query returns an array of results, get the first result
      if (Array.isArray(res) && res.length > 0) {
        return res[0] as T;
      }
      return res as T;
    } catch (e) {
      if (this.isSessionExpiredError(e)) {
        await this.clearTokens();
      }
      throw e;
    }
  }

  async mutate<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    try {
      const res = await this.db.query<T[]>(sql, vars);
      // SurrealDB query returns an array of results, get the first result
      if (Array.isArray(res) && res.length > 0) {
        return res[0] as T;
      }
      return res as T;
    } catch (e) {
      if (this.isSessionExpiredError(e)) {
        await this.clearTokens();
      }
      throw e;
    }
  }

  async create(thing: string, data: unknown): Promise<any> {
    return this.db.create(thing as any, data as any);
  }

  async select(thing: string | RecordId): Promise<any> {
    return this.db.select(thing as any);
  }

  async update(thing: string | RecordId, data: unknown): Promise<any> {
    return this.db.update(thing as any, data as any);
  }

  async merge(thing: string | RecordId, data: unknown): Promise<any> {
    return this.db.merge(thing as any, data as any);
  }

  async delete(thing: string | RecordId): Promise<any> {
    return this.db.delete(thing as any);
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
    await this.db.close();
  }
}

expose(new SurrealWorkerImpl());