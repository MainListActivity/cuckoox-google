// Service Worker implementation for SurrealDB
// This file will be compiled and copied to public/ directory
import Surreal, { AnyAuth, RecordId } from 'surrealdb';

// Message types for communication between main thread and service worker
export const MESSAGE_TYPES = {
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  SET_CONFIG: 'setConfig',
  QUERY: 'query',
  MUTATE: 'mutate',
  CREATE: 'create',
  SELECT: 'select',
  UPDATE: 'update',
  MERGE: 'merge',
  DELETE: 'delete',
  LIVE: 'live',
  SUBSCRIBE_LIVE: 'subscribeLive',
  KILL: 'kill',
  AUTHENTICATE: 'authenticate',
  SET_TOKENS: 'setTokens',
  CLEAR_TOKENS: 'clearTokens',
  GET_TOKENS: 'getTokens',
  IS_AUTHENTICATED: 'isAuthenticated',
  CLIENT_REGISTER: 'clientRegister',
  CLIENT_UNREGISTER: 'clientUnregister',
  CONNECTION_STATUS: 'connectionStatus',
  LIVE_QUERY_UPDATE: 'liveQueryUpdate',
  SESSION_EXPIRED: 'sessionExpired',
  SET_TENANT_CODE: 'setTenantCode',
  GET_TENANT_CODE: 'getTenantCode',
  SET_CURRENT_USER: 'setCurrentUser',
  GET_CURRENT_USER: 'getCurrentUser'
} as const;

// Interfaces
export interface SurrealServiceWorkerAPI {
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
  setConfig(config: {
    namespace?: string;
    database?: string;
    auth?: AnyAuth;
  }): Promise<void>;
  authenticate(token: string): Promise<void>;
  setTokens(accessToken: string, refreshToken?: string, expiresIn?: number): Promise<void>;
  clearTokens(): Promise<void>;
  getTokens(): Promise<{ accessToken: string | null; expiresAt: number | null }>;
  isAuthenticated(): Promise<boolean>;
  setTenantCode(tenantCode: string): Promise<void>;
  getTenantCode(): Promise<string | null>;
  setCurrentUser(user: any): Promise<void>;
  getCurrentUser(): Promise<any>;
}

interface ConnectionConfig {
  endpoint: string;
  namespace: string;
  database: string;
  params?: Parameters<Surreal['connect']>[1];
  auth?: AnyAuth;
}

// Service Worker implementation
class SurrealServiceWorkerImpl {
  private db = new Surreal();
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: number | null = null;
  private currentUser: any = null;
  private tenantCode: string | null = null;
  private connectionConfig: ConnectionConfig | null = null;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private liveQueries = new Map<string, any>();
  private connectedClients = new Set<any>();

  private STORAGE_KEYS = {
    ACCESS: 'access_token',
    REFRESH: 'refresh_token',
    EXPIRES: 'token_expires_at',
    TENANT_CODE: 'tenant_code',
  };

  constructor() {
    this.loadTokensFromStorage();
  }

  private async loadTokensFromStorage() {
    try {
      this.accessToken = await this.storageGet(this.STORAGE_KEYS.ACCESS);
      this.refreshToken = await this.storageGet(this.STORAGE_KEYS.REFRESH);
      const expiresStr = await this.storageGet(this.STORAGE_KEYS.EXPIRES);
      this.tokenExpiresAt = expiresStr ? parseInt(expiresStr, 10) : null;
      this.tenantCode = await this.storageGet(this.STORAGE_KEYS.TENANT_CODE);
    } catch (e) {
      console.error('SurrealServiceWorker: Failed to load tokens from storage:', e);
    }
  }

  private async storageSet(key: string, val: string | null) {
    try {
      // In Service Worker, we use a simple in-memory storage
      // In production, you might want to use IndexedDB
      (self as any)[`storage_${key}`] = val;
    } catch (e) {
      console.error('Storage set error:', e);
    }
  }

  private async storageGet(key: string): Promise<string | null> {
    try {
      return (self as any)[`storage_${key}`] || null;
    } catch (e) {
      console.error('Storage get error:', e);
      return null;
    }
  }

  private isTokenExpired(expiresAt: number | null): boolean {
    if (!expiresAt) return true;
    return Date.now() >= expiresAt - 60_000;
  }

  private isSessionExpiredError(err: any): boolean {
    if (!(err instanceof Error)) return false;
    const m = err.message.toLowerCase();
    return (
      (m.includes('session') && m.includes('expired')) ||
      m.includes('token expired') ||
      m.includes('jwt') ||
      m.includes('unauthorized') ||
      m.includes('401')
    );
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
    if (!this.connectionConfig) {
      throw new Error('No connection configuration provided');
    }

    try {
      await this.db.connect(this.connectionConfig.endpoint, this.connectionConfig.params);
      
      if (this.connectionConfig.namespace && this.connectionConfig.database) {
        await this.db.use({
          namespace: this.connectionConfig.namespace,
          database: this.connectionConfig.database
        });
      }

      if (this.connectionConfig.auth) {
        await this.db.signin(this.connectionConfig.auth);
      }

      // Try to authenticate with stored token
      if (this.accessToken && !this.isTokenExpired(this.tokenExpiresAt)) {
        try {
          await this.db.authenticate(this.accessToken);
          console.log('SurrealServiceWorker: Successfully authenticated with stored token');
        } catch (e) {
          console.log('SurrealServiceWorker: Stored token authentication failed:', e);
          await this.clearTokens();
        }
      }

      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      // Notify all connected clients
      this.broadcastToClients({
        type: MESSAGE_TYPES.CONNECTION_STATUS,
        data: { isConnected: true }
      });

      console.log('SurrealServiceWorker: Connection established successfully');
    } catch (error) {
      console.error('SurrealServiceWorker: Connection failed:', error);
      this.isConnected = false;
      this.scheduleReconnect();
      throw error;
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('SurrealServiceWorker: Max reconnect attempts reached');
      this.broadcastToClients({
        type: MESSAGE_TYPES.CONNECTION_STATUS,
        data: { isConnected: false, error: 'Max reconnect attempts reached' }
      });
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    setTimeout(() => {
      console.log(`SurrealServiceWorker: Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      this.initializeConnection();
    }, delay);
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected || !this.db) {
      await this.initializeConnection();
    }
  }

  private async handleConnectionError<T>(operation: () => Promise<T>): Promise<T> {
    try {
      await this.ensureConnection();
      return await operation();
    } catch (error) {
      if (this.isConnectionError(error)) {
        console.warn('SurrealServiceWorker: Connection error detected, attempting reconnection');
        this.isConnected = false;
        this.scheduleReconnect();
      }

      if (this.isSessionExpiredError(error)) {
        await this.clearTokens();
        this.broadcastToClients({
          type: MESSAGE_TYPES.SESSION_EXPIRED
        });
      }

      throw error;
    }
  }

  private broadcastToClients(message: any): void {
    this.connectedClients.forEach(client => {
      try {
        client.postMessage(message);
      } catch (e) {
        console.error('SurrealServiceWorker: Error sending message to client:', e);
        this.connectedClients.delete(client);
      }
    });
  }

  // API Implementation
  async connect(config: ConnectionConfig): Promise<boolean> {
    this.connectionConfig = config;
    await this.initializeConnection();
    return true;
  }

  async setConfig(config: {
    namespace?: string;
    database?: string;
    auth?: AnyAuth;
  }): Promise<void> {
    if (!this.connectionConfig) {
      throw new Error('No connection configuration exists');
    }

    let needReconnect = false;

    if (config.namespace && config.namespace !== this.connectionConfig.namespace) {
      this.connectionConfig.namespace = config.namespace;
      needReconnect = true;
    }

    if (config.database && config.database !== this.connectionConfig.database) {
      this.connectionConfig.database = config.database;
      needReconnect = true;
    }

    if (config.auth) {
      this.connectionConfig.auth = config.auth;
    }

    if (needReconnect && this.isConnected) {
      await this.ensureConnection();
      
      if (this.connectionConfig.namespace && this.connectionConfig.database) {
        await this.db.use({
          namespace: this.connectionConfig.namespace,
          database: this.connectionConfig.database
        });
      }
    }

    if (config.auth && this.isConnected) {
      await this.db.signin(config.auth);
    }
  }

  async query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    return this.handleConnectionError(async () => {
      const res = await this.db.query<T[]>(sql, vars);
      if (Array.isArray(res) && res.length > 0) {
        return res[0] as T;
      }
      return res as T;
    });
  }

  async mutate<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T> {
    return this.handleConnectionError(async () => {
      const res = await this.db.query<T[]>(sql, vars);
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
    return this.handleConnectionError(async () => {
      const uuid = await (this.db.live as any)(query, (action: string, result: any) => {
        // Broadcast live query updates to all connected clients
        this.broadcastToClients({
          type: MESSAGE_TYPES.LIVE_QUERY_UPDATE,
          data: { uuid: String(uuid), action, result }
        });
        callback(action, result);
      }, vars);
      
      const uuidString = String(uuid);
      this.liveQueries.set(uuidString, uuid);
      return uuidString;
    });
  }

  async subscribeLive(uuid: string, callback: (action: string, result: any) => void): Promise<void> {
    const liveUuid = this.liveQueries.get(uuid);
    if (!liveUuid) {
      throw new Error(`Live query ${uuid} not found`);
    }
    
    return this.handleConnectionError(async () => {
      return (this.db.subscribeLive as any)(liveUuid, (action: string, result: any) => {
        this.broadcastToClients({
          type: MESSAGE_TYPES.LIVE_QUERY_UPDATE,
          data: { uuid, action, result }
        });
        callback(action, result);
      });
    });
  }

  async kill(uuid: string): Promise<void> {
    const liveUuid = this.liveQueries.get(uuid);
    if (liveUuid) {
      await this.handleConnectionError(async () => {
        await this.db.kill(liveUuid as any);
      });
      this.liveQueries.delete(uuid);
    }
  }

  async authenticate(token: string): Promise<void> {
    await this.handleConnectionError(async () => {
      await this.db.authenticate(token);
      this.accessToken = token;
      this.storageSet(this.STORAGE_KEYS.ACCESS, token);
      console.log('SurrealServiceWorker: Successfully authenticated and stored token');
    });
  }

  async setTokens(accessToken: string, refreshToken?: string, expiresIn?: number): Promise<void> {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken ?? null;
    this.tokenExpiresAt = expiresIn ? Date.now() + expiresIn * 1000 : null;

    this.storageSet(this.STORAGE_KEYS.ACCESS, accessToken);
    if (refreshToken) this.storageSet(this.STORAGE_KEYS.REFRESH, refreshToken);
    if (this.tokenExpiresAt) this.storageSet(this.STORAGE_KEYS.EXPIRES, String(this.tokenExpiresAt));

    if (this.isConnected) {
      try {
        await this.db.authenticate(accessToken);
        console.log('SurrealServiceWorker: Successfully authenticated with new token');
      } catch (e) {
        console.error('SurrealServiceWorker: Failed to authenticate with new token:', e);
        throw e;
      }
    }
  }

  async clearTokens(): Promise<void> {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiresAt = null;

    this.storageSet(this.STORAGE_KEYS.ACCESS, null);
    this.storageSet(this.STORAGE_KEYS.REFRESH, null);
    this.storageSet(this.STORAGE_KEYS.EXPIRES, null);
    this.storageSet(this.STORAGE_KEYS.TENANT_CODE, null);
  }

  async getTokens(): Promise<{ accessToken: string | null; expiresAt: number | null }> {
    if (!this.accessToken) {
      this.accessToken = await this.storageGet(this.STORAGE_KEYS.ACCESS);
      const expiresStr = await this.storageGet(this.STORAGE_KEYS.EXPIRES);
      this.tokenExpiresAt = expiresStr ? parseInt(expiresStr, 10) : null;
    }
    
    if (this.isTokenExpired(this.tokenExpiresAt)) {
      return { accessToken: null, expiresAt: null };
    }
    
    return { accessToken: this.accessToken, expiresAt: this.tokenExpiresAt };
  }

  async isAuthenticated(): Promise<boolean> {
    const tokens = await this.getTokens();
    return !!tokens.accessToken;
  }

  async setTenantCode(tenantCode: string): Promise<void> {
    this.tenantCode = tenantCode;
    this.storageSet(this.STORAGE_KEYS.TENANT_CODE, tenantCode);
  }

  async getTenantCode(): Promise<string | null> {
    if (!this.tenantCode) {
      this.tenantCode = await this.storageGet(this.STORAGE_KEYS.TENANT_CODE);
    }
    return this.tenantCode;
  }

  async setCurrentUser(user: any): Promise<void> {
    this.currentUser = user;
  }

  async getCurrentUser(): Promise<any> {
    return this.currentUser;
  }

  async close(): Promise<void> {
    this.isConnected = false;
    if (this.db) {
      await this.db.close();
    }
    this.broadcastToClients({
      type: MESSAGE_TYPES.CONNECTION_STATUS,
      data: { isConnected: false }
    });
  }

  // Client management
  registerClient(client: any): void {
    this.connectedClients.add(client);
    // Send current connection status to new client
    client.postMessage({
      type: MESSAGE_TYPES.CONNECTION_STATUS,
      data: { isConnected: this.isConnected }
    });
  }

  unregisterClient(client: any): void {
    this.connectedClients.delete(client);
  }
}

// Service Worker event handlers
declare const self: ServiceWorkerGlobalScope;

const surrealServiceWorker = new SurrealServiceWorkerImpl();

// Message handlers
const messageHandlers = {
  [MESSAGE_TYPES.CLIENT_REGISTER]: (data: any, client: any) => {
    surrealServiceWorker.registerClient(client);
  },

  [MESSAGE_TYPES.CLIENT_UNREGISTER]: (data: any, client: any) => {
    surrealServiceWorker.unregisterClient(client);
  },

  [MESSAGE_TYPES.CONNECT]: async (data: any) => {
    return await surrealServiceWorker.connect(data);
  },

  [MESSAGE_TYPES.SET_CONFIG]: async (data: any) => {
    return await surrealServiceWorker.setConfig(data);
  },

  [MESSAGE_TYPES.QUERY]: async (data: any) => {
    return await surrealServiceWorker.query(data.sql, data.vars);
  },

  [MESSAGE_TYPES.MUTATE]: async (data: any) => {
    return await surrealServiceWorker.mutate(data.sql, data.vars);
  },

  [MESSAGE_TYPES.CREATE]: async (data: any) => {
    return await surrealServiceWorker.create(data.thing, data.data);
  },

  [MESSAGE_TYPES.SELECT]: async (data: any) => {
    return await surrealServiceWorker.select(data.thing);
  },

  [MESSAGE_TYPES.UPDATE]: async (data: any) => {
    return await surrealServiceWorker.update(data.thing, data.data);
  },

  [MESSAGE_TYPES.MERGE]: async (data: any) => {
    return await surrealServiceWorker.merge(data.thing, data.data);
  },

  [MESSAGE_TYPES.DELETE]: async (data: any) => {
    return await surrealServiceWorker.delete(data.thing);
  },

  [MESSAGE_TYPES.LIVE]: async (data: any) => {
    return await surrealServiceWorker.live(data.query, data.callback, data.vars);
  },

  [MESSAGE_TYPES.SUBSCRIBE_LIVE]: async (data: any) => {
    return await surrealServiceWorker.subscribeLive(data.uuid, data.callback);
  },

  [MESSAGE_TYPES.KILL]: async (data: any) => {
    return await surrealServiceWorker.kill(data.uuid);
  },

  [MESSAGE_TYPES.AUTHENTICATE]: async (data: any) => {
    return await surrealServiceWorker.authenticate(data.token);
  },

  [MESSAGE_TYPES.SET_TOKENS]: async (data: any) => {
    return await surrealServiceWorker.setTokens(data.accessToken, data.refreshToken, data.expiresIn);
  },

  [MESSAGE_TYPES.CLEAR_TOKENS]: async () => {
    return await surrealServiceWorker.clearTokens();
  },

  [MESSAGE_TYPES.GET_TOKENS]: async () => {
    return await surrealServiceWorker.getTokens();
  },

  [MESSAGE_TYPES.IS_AUTHENTICATED]: async () => {
    return await surrealServiceWorker.isAuthenticated();
  },

  [MESSAGE_TYPES.SET_TENANT_CODE]: async (data: any) => {
    return await surrealServiceWorker.setTenantCode(data.tenantCode);
  },

  [MESSAGE_TYPES.GET_TENANT_CODE]: async () => {
    return await surrealServiceWorker.getTenantCode();
  },

  [MESSAGE_TYPES.SET_CURRENT_USER]: async (data: any) => {
    return await surrealServiceWorker.setCurrentUser(data.user);
  },

  [MESSAGE_TYPES.GET_CURRENT_USER]: async () => {
    return await surrealServiceWorker.getCurrentUser();
  },

  [MESSAGE_TYPES.DISCONNECT]: async () => {
    return await surrealServiceWorker.close();
  }
};

// Service Worker events
self.addEventListener('install', (event) => {
  console.log('SurrealServiceWorker: Installing');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('SurrealServiceWorker: Activating');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', async (event) => {
  const { type, data, id } = event.data;
  const client = event.source;

  try {
    const handler = messageHandlers[type as keyof typeof messageHandlers];
    if (!handler) {
      throw new Error(`Unknown message type: ${type}`);
    }

    const result = await handler(data, client);
    
    // Send response back to client
    client!.postMessage({
      type: 'response',
      id,
      success: true,
      data: result
    });
  } catch (error) {
    console.error('SurrealServiceWorker: Error handling message:', error);
    client!.postMessage({
      type: 'response',
      id,
      success: false,
      error: (error as Error).message
    });
  }
});

console.log('SurrealServiceWorker: Service Worker loaded');

export default surrealServiceWorker;