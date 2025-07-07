import { Surreal, RecordId } from 'surrealdb';
import { surrealClient, surrealClientSafe } from './surrealClient';
import type { SurrealWorkerAPI } from './surrealServiceWorkerClient';

export interface UnifiedSurrealAPI {
  query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T>;
  mutate<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T>;
  create(thing: string, data: unknown): Promise<any>;
  select(thing: string | RecordId): Promise<any>;
  update(thing: string | RecordId, data: unknown): Promise<any>;
  merge(thing: string | RecordId, data: unknown): Promise<any>;
  delete(thing: string | RecordId): Promise<any>;
  live(query: string, callback: (action: string, result: any) => void, vars?: Record<string, unknown>): Promise<string>;
  kill(uuid: string): Promise<void>;
  authenticate(token: string, refreshToken?: string, expiresIn?: number, tenantCode?: string): Promise<void>;
  invalidate(): Promise<void>;
  close(): Promise<void>;
  // 连接管理方法
  connect?(config: {
    endpoint: string;
    namespace: string;
    database: string;
    sync_tokens?: {
      access_token?: string | null;
      refresh_token?: string | null;
      token_expires_at?: string | null;
      tenant_code?: string | null;
    };
  }): Promise<boolean>;
}

class DirectSurrealClient implements UnifiedSurrealAPI {
  private db: Surreal;
  private isConnected = false;

  constructor() {
    this.db = new Surreal();
  }

  private async ensureConnection(): Promise<void> {
    if (this.isConnected) return;

    try {
      const tenantCode = localStorage.getItem('tenant_code');
      const database = tenantCode || import.meta.env.VITE_SURREALDB_DB || 'test';
      
      await this.db.connect(import.meta.env.VITE_SURREALDB_WS_URL || 'ws://localhost:8000/rpc');
      await this.db.use({ 
        namespace: import.meta.env.VITE_SURREALDB_NS || 'ck_go', 
        database: database 
      });

      const token = localStorage.getItem('access_token');
      if (token) {
        await this.db.authenticate(token);
      }

      this.isConnected = true;
    } catch (error) {
      console.error('DirectSurrealClient: Connection failed', error);
      throw error;
    }
  }

  async query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    await this.ensureConnection();
    const [result] = await this.db.query(sql, vars);
    return result;
  }

  async mutate<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    await this.ensureConnection();
    const [result] = await this.db.query(sql, vars);
    return result;
  }

  async create(thing: string, data: unknown): Promise<any> {
    await this.ensureConnection();
    return await this.db.create(thing, data);
  }

  async select(thing: string | RecordId): Promise<any> {
    await this.ensureConnection();
    return await this.db.select(thing);
  }

  async update(thing: string | RecordId, data: unknown): Promise<any> {
    await this.ensureConnection();
    return await this.db.update(thing, data);
  }

  async merge(thing: string | RecordId, data: unknown): Promise<any> {
    await this.ensureConnection();
    return await this.db.merge(thing, data);
  }

  async delete(thing: string | RecordId): Promise<any> {
    await this.ensureConnection();
    return await this.db.delete(thing);
  }

  async live(query: string, callback: (action: string, result: any) => void, vars?: Record<string, unknown>): Promise<string> {
    await this.ensureConnection();
    return await this.db.live(query, callback, vars);
  }

  async kill(uuid: string): Promise<void> {
    await this.ensureConnection();
    await this.db.kill(uuid);
  }

  async authenticate(token: string, refreshToken?: string, expiresIn?: number, tenantCode?: string): Promise<void> {
    await this.ensureConnection();
    await this.db.authenticate(token);
  }

  async connect(config: {
    endpoint: string;
    namespace: string;
    database: string;
    sync_tokens?: {
      access_token?: string | null;
      refresh_token?: string | null;
      token_expires_at?: string | null;
      tenant_code?: string | null;
    };
  }): Promise<boolean> {
    try {
      if (this.isConnected) {
        await this.db.close();
        this.isConnected = false;
      }
      
      await this.db.connect(config.endpoint);
      await this.db.use({ 
        namespace: config.namespace, 
        database: config.database 
      });

      // Re-authenticate if token is available
      if (config.sync_tokens?.access_token) {
        await this.db.authenticate(config.sync_tokens.access_token);
      }

      this.isConnected = true;
      return true;
    } catch (error) {
      console.error('DirectSurrealClient: Connection failed', error);
      this.isConnected = false;
      return false;
    }
  }

  async invalidate(): Promise<void> {
    await this.ensureConnection();
    await this.db.invalidate();
  }

  async close(): Promise<void> {
    if (this.isConnected) {
      await this.db.close();
      this.isConnected = false;
    }
  }
}

class ServiceWorkerSurrealClient implements UnifiedSurrealAPI {
  private client: SurrealWorkerAPI | null = null;

  private async ensureClient(): Promise<SurrealWorkerAPI> {
    if (!this.client) {
      this.client = await surrealClient();
    }
    return this.client;
  }

  async query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    const client = await this.ensureClient();
    return await client.query<T>(sql, vars);
  }

  async mutate<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    const client = await this.ensureClient();
    return await client.mutate<T>(sql, vars);
  }

  async create(thing: string, data: unknown): Promise<any> {
    const client = await this.ensureClient();
    return await client.create(thing, data);
  }

  async select(thing: string | RecordId): Promise<any> {
    const client = await this.ensureClient();
    return await client.select(thing);
  }

  async update(thing: string | RecordId, data: unknown): Promise<any> {
    const client = await this.ensureClient();
    return await client.update(thing, data);
  }

  async merge(thing: string | RecordId, data: unknown): Promise<any> {
    const client = await this.ensureClient();
    return await client.merge(thing, data);
  }

  async delete(thing: string | RecordId): Promise<any> {
    const client = await this.ensureClient();
    return await client.delete(thing);
  }

  async live(query: string, callback: (action: string, result: any) => void, vars?: Record<string, unknown>): Promise<string> {
    const client = await this.ensureClient();
    return await client.live(query, callback, vars);
  }

  async kill(uuid: string): Promise<void> {
    const client = await this.ensureClient();
    await client.kill(uuid);
  }

  async authenticate(token: string, refreshToken?: string, expiresIn?: number, tenantCode?: string): Promise<void> {
    const client = await this.ensureClient();
    await client.authenticate(token, refreshToken, expiresIn, tenantCode);
  }

  async connect(config: {
    endpoint: string;
    namespace: string;
    database: string;
    sync_tokens?: {
      access_token?: string | null;
      refresh_token?: string | null;
      token_expires_at?: string | null;
      tenant_code?: string | null;
    };
  }): Promise<boolean> {
    const client = await this.ensureClient();
    return await client.connect(config);
  }

  async invalidate(): Promise<void> {
    const client = await this.ensureClient();
    await client.invalidate();
  }

  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}

let unifiedClientInstance: UnifiedSurrealAPI | null = null;

export function createUnifiedSurrealClient(): UnifiedSurrealAPI {
  const dbAccessMode = import.meta.env.VITE_DB_ACCESS_MODE || 'service-worker';
  
  if (dbAccessMode === 'direct') {
    return new DirectSurrealClient();
  } else {
    return new ServiceWorkerSurrealClient();
  }
}

export function getUnifiedSurrealClient(): UnifiedSurrealAPI {
  if (!unifiedClientInstance) {
    unifiedClientInstance = createUnifiedSurrealClient();
  }
  return unifiedClientInstance;
}

export function resetUnifiedSurrealClient(): void {
  if (unifiedClientInstance) {
    unifiedClientInstance.close().catch(console.error);
    unifiedClientInstance = null;
  }
}

export async function surrealUnifiedClient(): Promise<UnifiedSurrealAPI> {
  return getUnifiedSurrealClient();
}

export async function surrealUnifiedClientSafe(): Promise<UnifiedSurrealAPI> {
  const tenantCode = localStorage.getItem('tenant_code');
  
  if (window.location.pathname !== '/login' && !tenantCode) {
    localStorage.removeItem('cuckoox-isLoggedIn');
    localStorage.removeItem('cuckoox-user');
    localStorage.removeItem('cuckoox-selectedCaseId');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('token_expires_at');
    
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    
    throw new Error('Tenant code is missing, redirecting to login');
  }
  
  return getUnifiedSurrealClient();
}