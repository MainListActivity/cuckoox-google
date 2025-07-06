/// <reference lib="WebWorker" />
import { Surreal, RecordId, ConnectionStatus } from 'surrealdb';

// Define AnyAuth type based on SurrealDB
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

// Extend the global scope to include ServiceWorker-specific types
declare const self: ServiceWorkerGlobalScope;

// --- Global State ---
let db: Surreal | null = null;
let isConnected = false;
let isInitialized = false;
let connectionConfig: {
  endpoint: string;
  namespace: string;
  database: string;
  auth?: AnyAuth;
} | null = null;

// In-memory storage to replace localStorage
const memoryStore: Record<string, string> = {};

// Live query management
const liveQuerySubscriptions = new Map<string, {
  query: string;
  vars?: Record<string, unknown>;
  clients: Set<string>; // Set of client IDs
}>();

// Token refresh management
let refreshTimer: NodeJS.Timeout | null = null;
const REFRESH_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds
const REFRESH_BEFORE_EXPIRY = 10 * 60 * 1000; // Refresh 10 minutes before expiry

// --- Helper Functions ---

function storageSet(key: string, val: string | null) {
  if (val === null) {
    delete memoryStore[key];
  } else {
    memoryStore[key] = val;
  }
}

function storageGet(key: string): string | null {
  return memoryStore[key] ?? null;
}

async function postMessageToClient(clientId: string, message: Record<string, unknown>) {
  const client = await self.clients.get(clientId);
  if (client) {
    client.postMessage(message);
  } else {
    console.warn(`ServiceWorker: Client with ID ${clientId} not found.`);
  }
}

async function broadcastToClients(message: Record<string, unknown>, clientIds: Set<string>) {
  for (const clientId of clientIds) {
    await postMessageToClient(clientId, message);
  }
}

// --- Token Refresh Logic ---

/**
 * 检查租户代码是否存在
 */
function checkTenantCode(): boolean {
  const tenantCode = storageGet('tenant_code');

  if (!tenantCode) {
    // 清除认证状态
    storageSet('access_token', null);
    storageSet('refresh_token', null);
    storageSet('token_expires_at', null);

    // 广播租户代码丢失事件给所有客户端
    broadcastToAllClients({
      type: 'tenant_code_missing',
      payload: { message: 'Tenant code is missing, user needs to login again' }
    });

    return false;
  }

  return true;
}

/**
 * 广播消息给所有客户端
 */
async function broadcastToAllClients(message: Record<string, unknown>) {
  const clients = await self.clients.matchAll();
  for (const client of clients) {
    client.postMessage(message);
  }
}

/**
 * 刷新访问令牌
 */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const refreshToken = storageGet('refresh_token');
    if (!refreshToken) {
      console.error('ServiceWorker: No refresh token available');
      return false;
    }

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8082';
    const response = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const data = await response.json();

    // Handle the current backend response which returns 501 Not Implemented
    if (response.status === 501) {
      console.warn('ServiceWorker: Token refresh not yet implemented on backend:', data.message);
      clearAuthState();
      return false;
    }

    if (!response.ok) {
      throw new Error('Failed to refresh token');
    }

    if (data.access_token) {
      // Store the new tokens
      storageSet('access_token', data.access_token);
      if (data.refresh_token) {
        storageSet('refresh_token', data.refresh_token);
      }
      if (data.expires_in) {
        const expiresAt = Date.now() + (data.expires_in * 1000);
        storageSet('token_expires_at', expiresAt.toString());
      }

      // Re-authenticate with the new token
      if (isConnected && db) {
        await db.authenticate(data.access_token);
      }

      console.log('ServiceWorker: Access token refreshed successfully');

      // Broadcast success to all clients
      broadcastToAllClients({
        type: 'token_refreshed',
        payload: { success: true }
      });

      return true;
    }

    return false;
  } catch (error) {
    console.error('ServiceWorker: Error refreshing access token:', error);
    return false;
  }
}

/**
 * 清除认证状态
 */
function clearAuthState() {
  storageSet('access_token', null);
  storageSet('refresh_token', null);
  storageSet('token_expires_at', null);

  // Broadcast auth state cleared to all clients
  broadcastToAllClients({
    type: 'auth_state_cleared',
    payload: { message: 'Authentication state cleared due to token refresh failure' }
  });
}

/**
 * 检查并刷新令牌
 */
async function checkAndRefreshToken(): Promise<void> {
  // 首先检查租户代码是否存在
  if (!checkTenantCode()) {
    console.log('ServiceWorker: Tenant code missing, user needs to login again');
    clearAuthState();
    return;
  }

  const expiresAtStr = storageGet('token_expires_at');
  if (!expiresAtStr) return;

  const expiresAt = parseInt(expiresAtStr, 10);
  const now = Date.now();
  const timeUntilExpiry = expiresAt - now;

  // Refresh token if it expires within 10 minutes
  if (timeUntilExpiry <= REFRESH_BEFORE_EXPIRY && timeUntilExpiry > 0) {
    console.log('ServiceWorker: Token expiring soon, attempting refresh...');
    const success = await refreshAccessToken();
    if (!success) {
      console.error('ServiceWorker: Failed to refresh token, clearing auth state');
      clearAuthState();
    }
  }
}

/**
 * 设置令牌刷新定时器
 */
function setupTokenRefresh() {
  // 清除现有定时器
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }

  // 设置新的定时器，每5分钟检查一次
  refreshTimer = setInterval(checkAndRefreshToken, REFRESH_CHECK_INTERVAL);

  // 立即检查一次，但延迟1秒以避免阻塞
  setTimeout(checkAndRefreshToken, 1000);

  console.log('ServiceWorker: Token refresh timer set up');
}

/**
 * 清除令牌刷新定时器
 */
function clearTokenRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
    console.log('ServiceWorker: Token refresh timer cleared');
  }
}

// --- SurrealDB Logic ---

async function initializeSurreal(): Promise<void> {
  if (isInitialized && db?.connection?.status === ConnectionStatus.Connected) return;

  try {
    // Create a new SurrealDB instance
    db = new Surreal();
    isInitialized = true;
    console.log("ServiceWorker: SurrealDB initialized successfully");
  } catch (error) {
    console.error("ServiceWorker: Failed to initialize SurrealDB:", error);
    throw error;
  }
}

async function ensureConnection(newConfig?: typeof connectionConfig): Promise<boolean> {
  // Ensure SurrealDB is initialized first
  await initializeSurreal();
  
  if (newConfig && connectionConfig) {
    // 检查配置变化的具体部分
    const endpointChanged = connectionConfig.endpoint !== newConfig.endpoint;
    const namespaceChanged = connectionConfig.namespace !== newConfig.namespace;
    const databaseChanged = connectionConfig.database !== newConfig.database;
    const authChanged = JSON.stringify(connectionConfig.auth) !== JSON.stringify(newConfig.auth);
    
    if (endpointChanged) {
      // endpoint 变化需要重新建立连接
      console.log("ServiceWorker: Endpoint changed, reconnecting...", connectionConfig.endpoint, '->', newConfig.endpoint);
      if (isConnected && db) {
        try {
          await db.close();
        } catch (e) {
          console.warn("ServiceWorker: Error closing connection:", e);
        }
      }
      isConnected = false;
      connectionConfig = newConfig;
    } else if (namespaceChanged || databaseChanged) {
      // namespace 或 database 变化只需要重新执行 use 和 authenticate
      console.log("ServiceWorker: Namespace/Database changed, switching...", 
        { namespace: connectionConfig.namespace, database: connectionConfig.database }, 
        '->', 
        { namespace: newConfig.namespace, database: newConfig.database });
      
      if (isConnected && db) {
        try {
          await db.use({ namespace: newConfig.namespace, database: newConfig.database });
          
          // 重新认证
          const token = storageGet('access_token');
          if (token) {
            await db.authenticate(token);
            console.log("ServiceWorker: Re-authenticated after namespace/database change.");
          }
        } catch (e) {
          console.error("ServiceWorker: Failed to switch namespace/database:", e);
          isConnected = false;
        }
      }
      connectionConfig = newConfig;
    } else if (authChanged) {
      // 只有认证信息变化，只需要重新认证
      console.log("ServiceWorker: Auth changed, re-authenticating...");
      
      if (isConnected && db) {
        try {
          const token = storageGet('access_token');
          if (token) {
            await db.authenticate(token);
            console.log("ServiceWorker: Re-authenticated with new auth info.");
          }
        } catch (e) {
          console.error("ServiceWorker: Re-authentication failed:", e);
        }
      }
      connectionConfig = newConfig;
    } else {
      // 没有变化，直接更新配置引用
      connectionConfig = newConfig;
    }
  } else if (newConfig) {
    // 第一次设置配置
    connectionConfig = newConfig;
  }

  if (!connectionConfig) {
    console.error("ServiceWorker: Connection config not set.");
    return false;
  }

  if (!isConnected) {
    try {
      console.log(`ServiceWorker: Connecting to ${connectionConfig.endpoint}...`);
      await db!.connect(connectionConfig.endpoint);
      await db!.use({ namespace: connectionConfig.namespace, database: connectionConfig.database });

      // Re-authenticate if token is available
      const token = storageGet('access_token');
      if (token) {
        try {
          await db!.authenticate(token);
          console.log("ServiceWorker: Re-authenticated successfully with stored token.");

          // Setup token refresh if we have authentication info
          const refreshToken = storageGet('refresh_token');
          const expiresAt = storageGet('token_expires_at');
          if (refreshToken && expiresAt) {
            setupTokenRefresh();
          }
        } catch (e) {
          console.warn("ServiceWorker: Stored token authentication failed.", e);
          storageSet('access_token', null); // Clear invalid token
          storageSet('refresh_token', null);
          storageSet('token_expires_at', null);
          clearTokenRefresh();
        }
      }

      isConnected = true;
      console.log("ServiceWorker: Connection established.");

      // Resubscribe to all live queries
      await resubscribeAllLiveQueries();

    } catch (e) {
      console.error("ServiceWorker: Connection failed.", e);
      isConnected = false;
      return false;
    }
  }
  return true;
}

async function resubscribeAllLiveQueries() {
  console.log("ServiceWorker: Resubscribing to all live queries...");
  for (const [uuid, sub] of liveQuerySubscriptions.entries()) {
    try {
      if (!db) throw new Error("Database not initialized");
      await db.live(sub.query, (action, result) => {
        broadcastToClients({
          type: 'live_update',
          payload: { uuid, action, result }
        }, sub.clients);
      });
      console.log(`ServiceWorker: Successfully resubscribed to live query ${uuid}`);
    } catch (e) {
      console.error(`ServiceWorker: Failed to resubscribe to live query ${uuid}`, e);
    }
  }
}

// --- Service Worker Event Handlers ---

self.addEventListener('install', (event) => {
  console.log("Service Worker installing");
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  console.log("Service Worker activating");
  event.waitUntil(self.clients.claim());
});

// Clean up when service worker is terminated
self.addEventListener('beforeunload', () => {
  clearTokenRefresh();
});

self.addEventListener('message', async (event) => {
  if (!event.data || !event.data.type) {
    return;
  }

  const { type, payload, messageId } = event.data;
  const clientId = (event.source as any)?.id;

  if (!clientId) return;

  const respond = (responsePayload: unknown) => postMessageToClient(clientId, {
    type: `${type}_response`,
    messageId,
    payload: responsePayload
  });

  const respondError = (error: Error) => postMessageToClient(clientId, {
    type: `${type}_error`,
    messageId,
    payload: { message: error.message, stack: error.stack }
  });

  try {
    switch (type) {
      case 'connect':
        // Sync token information from localStorage if provided
        if (payload.sync_tokens) {
          if (payload.sync_tokens.access_token) {
            storageSet('access_token', payload.sync_tokens.access_token);
          }
          if (payload.sync_tokens.refresh_token) {
            storageSet('refresh_token', payload.sync_tokens.refresh_token);
          }
          if (payload.sync_tokens.token_expires_at) {
            storageSet('token_expires_at', payload.sync_tokens.token_expires_at);
          }
          if (payload.sync_tokens.tenant_code) {
            storageSet('tenant_code', payload.sync_tokens.tenant_code);
          }
        }
        await ensureConnection(payload);
        respond({ status: isConnected ? 'connected' : 'disconnected' });
        break;

      case 'authenticate':
        storageSet('access_token', payload.token);
        // Store refresh token and expiry info if provided
        if (payload.refresh_token) {
          storageSet('refresh_token', payload.refresh_token);
        }
        if (payload.expires_in) {
          const expiresAt = Date.now() + (payload.expires_in * 1000);
          storageSet('token_expires_at', expiresAt.toString());
        }
        // Store tenant code if provided
        if (payload.tenant_code) {
          storageSet('tenant_code', payload.tenant_code);
        }

        await ensureConnection();
        if (isConnected) {
          await db!.authenticate(payload.token);
          setupTokenRefresh(); // Set up token refresh after successful authentication
          respond({ success: true });
        } else {
          throw new Error("Connection not established.");
        }
        break;

      case 'invalidate':
        storageSet('access_token', null);
        storageSet('refresh_token', null);
        storageSet('token_expires_at', null);
        clearTokenRefresh(); // Clear token refresh when invalidating
        if (isConnected) await db!.invalidate();
        respond({ success: true });
        break;

      case 'query':
      case 'mutate': {
        await ensureConnection();
        if (!db) throw new Error("Database not initialized");
        const [result] = await db.query(payload.sql, payload.vars);
        respond(result);
        break;
      }

      case 'create': {
        await ensureConnection();
        if (!db) throw new Error("Database not initialized");
        const createResult = await db.create(payload.thing, payload.data);
        respond(createResult);
        break;
      }

      case 'select': {
        await ensureConnection();
        if (!db) throw new Error("Database not initialized");
        const selectResult = await db.select(payload.thing as string | RecordId);
        respond(selectResult);
        break;
      }

      case 'update': {
        await ensureConnection();
        if (!db) throw new Error("Database not initialized");
        const updateResult = await db.update(payload.thing as string | RecordId, payload.data);
        respond(updateResult);
        break;
      }

      case 'merge': {
        await ensureConnection();
        if (!db) throw new Error("Database not initialized");
        const mergeResult = await db.merge(payload.thing as string | RecordId, payload.data);
        respond(mergeResult);
        break;
      }

      case 'delete': {
        await ensureConnection();
        if (!db) throw new Error("Database not initialized");
        const deleteResult = await db.delete(payload.thing as string | RecordId);
        respond(deleteResult);
        break;
      }

      case 'live': {
        await ensureConnection();
        if (!db) throw new Error("Database not initialized");
        const { query, vars } = payload;

        // For SurrealDB live queries, we need to run a query with variables, not use the live() method directly
        const queryWithVars = vars ? query : query;
        const uuid = await db.live(queryWithVars, (action, result) => {
          const sub = liveQuerySubscriptions.get(String(uuid));
          if (sub) {
            broadcastToClients({
              type: 'live_update',
              payload: { uuid: String(uuid), action, result }
            }, sub.clients);
          }
        });

        const uuidStr = String(uuid);
        if (!liveQuerySubscriptions.has(uuidStr)) {
          liveQuerySubscriptions.set(uuidStr, { query, vars, clients: new Set() });
        }
        liveQuerySubscriptions.get(uuidStr)!.clients.add(clientId);

        respond({ uuid: uuidStr });
        break;
      }

      case 'kill': {
        const { uuid: killUuid } = payload;
        const subscription = liveQuerySubscriptions.get(killUuid);
        if (subscription) {
          subscription.clients.delete(clientId);
          if (subscription.clients.size === 0 && db) {
            await db.kill(killUuid);
            liveQuerySubscriptions.delete(killUuid);
            console.log(`ServiceWorker: Killed live query ${killUuid} as no clients are listening.`);
          }
        }
        respond({ success: true });
        break;
      }

      case 'setup_token_refresh': {
        setupTokenRefresh();
        respond({ success: true });
        break;
      }

      case 'clear_token_refresh': {
        clearTokenRefresh();
        respond({ success: true });
        break;
      }

      case 'refresh_token': {
        const success = await refreshAccessToken();
        respond({ success });
        break;
      }

      case 'check_tenant_code': {
        const valid = checkTenantCode();
        respond({ valid });
        break;
      }

      default:
        console.warn(`ServiceWorker: Unknown message type received: ${type}`);
        respondError(new Error(`Unknown message type: ${type}`));
    }
  } catch (e: any) {
    console.error(`ServiceWorker: Error processing message type ${type}:`, e);
    respondError(e);
  }
});

console.log("Service Worker loaded");