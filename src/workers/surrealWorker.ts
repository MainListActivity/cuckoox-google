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
}

class SurrealWorkerImpl implements SurrealWorkerAPI {
  private db = new Surreal();
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private currentUser: any = null;
  private STORAGE_KEYS = {
    ACCESS: 'access_token',
    REFRESH: 'refresh_token',
    EXPIRES: 'token_expires_at',
  };

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
    if (this.db.status === 'connected') return true;
    await this.db.connect(endpoint, params);
    await this.db.use({ namespace, database });
    if (auth) {
      await this.db.signin(auth);
    }
    return true;
  }

  async query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    try {
      const res = await this.db.query<T[]>(sql, vars);
      return (res as any)[0] as T;
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
      return (res as any)[0] as T;
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
  }

  async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;

    this.storageSet(this.STORAGE_KEYS.ACCESS, null);
    this.storageSet(this.STORAGE_KEYS.REFRESH, null);
    this.storageSet(this.STORAGE_KEYS.EXPIRES, null);
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