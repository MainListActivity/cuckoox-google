/// <reference lib="WebWorker" />
// Extend the global scope to include ServiceWorker-specific types
declare const self: ServiceWorkerGlobalScope;

// Service Worker 版本号
const SW_VERSION = 'v1.0.1';
const SW_CACHE_NAME = `cuckoox-sw-${SW_VERSION}`;

// --- 立即注册事件监听器（确保在任何异步代码之前注册） ---
console.log(`Service Worker script executing - ${SW_VERSION}`);

const eventHandlers = {
  install: (event: ExtendableEvent) => {
    console.log(`Service Worker installing - ${SW_VERSION}`);
    event.waitUntil(
      Promise.all([
        self.skipWaiting(),
        // 延迟加载 precacheSurrealDBWasm 以避免循环依赖
        new Promise(resolve => {
          setTimeout(async () => {
            try {
              await precacheSurrealDBWasm();
            } catch (e) {
              console.warn("Failed to precache WASM:", e);
            }
            resolve(void 0);
          }, 0);
        })
      ])
    );
  },

  activate: (event: ExtendableEvent) => {
    console.log(`Service Worker activating - ${SW_VERSION}`);
    event.waitUntil(
      Promise.all([
        self.clients.claim(),
        // 清理旧版本的缓存
        cleanupOldCaches()
      ]).then(async () => {
        try {
          // 初始化本地 SurrealDB
          await initializeLocalSurrealDB();
          // 初始化 TokenManager
          await initializeTokenManager();
          // 初始化 DataCacheManager
          await initializeDataCacheManager();
          // Service Worker 激活后，主动同步 localStorage 中的 token
          await syncTokensFromLocalStorage();
        } catch (e) {
          console.error("Failed during activation:", e);
        }
      })
    );
  },

  beforeunload: async () => {
    try {
      stopReconnection();
      stopConnectionHealthCheck();
      notifyConnectionStateChange();

      // 关闭 TokenManager
      if (tokenManager) {
        await tokenManager.close();
        tokenManager = null;
      }


      // 关闭 DataCacheManager
      if (dataCacheManager) {
        await dataCacheManager.close();
        dataCacheManager = null;
      }

      // 关闭本地数据库
      if (localDb) {
        await localDb.close();
        localDb = null;
      }
    } catch (e) {
      console.error("Failed during cleanup:", e);
    }
  },

  message: async (event: ExtendableMessageEvent) => {
    if (!event.data || !event.data.type) {
      return;
    }

    // 递归处理payload.data中可能被序列化的RecordId对象
    const { type, payload, messageId } = deserializeRecordIds(event.data);
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
            await ensureTokenManager();
            const tokenInfo: Partial<TokenInfo> = {
              access_token: payload.sync_tokens.access_token,
              refresh_token: payload.sync_tokens.refresh_token,
              token_expires_at: payload.sync_tokens.token_expires_at,
              tenant_code: payload.sync_tokens.tenant_code,
            };
            await tokenManager!.storeToken(tokenInfo);
          }
          await ensureConnection(payload);
          respond({ status: isConnected ? 'connected' : 'disconnected' });
          break;

        case 'authenticate': {
          await ensureTokenManager();
          const tokenInfo: Partial<TokenInfo> = {
            access_token: payload.token,
            refresh_token: payload.refresh_token,
            token_expires_at: payload.expires_in ? Date.now() + (payload.expires_in * 1000) : undefined,
            tenant_code: payload.tenant_code,
          };
          await tokenManager!.storeToken(tokenInfo);

          await ensureConnection();
          if (isConnected) {
            await db!.authenticate(payload.token);
            
            // 登录成功后，自动同步所有自动同步表
            try {
              await ensureDataCacheManager();
              const userId = await getCurrentUserId();
              if (userId) {
                console.log('ServiceWorker: Starting auto sync after authentication');
                await dataCacheManager!.autoSyncTables(userId, payload.case_id);
                console.log('ServiceWorker: Auto sync completed after authentication');
              }
            } catch (syncError) {
              console.warn('ServiceWorker: Auto sync failed after authentication:', syncError);
            }
            
            // Token refresh is now handled automatically by TokenManager
            respond({ success: true });
          } else {
            throw new Error("Connection not established.");
          }
          break;
        }

        case 'invalidate':
          await ensureTokenManager();
          await tokenManager!.clearToken();
          // Token refresh clearing is now handled by TokenManager
          if (isConnected) await db!.invalidate();
          respond({ success: true });
          break;

        case 'query':
        case 'mutate': {
          await ensureConnection();
          if (!db) throw new Error("Database not initialized");
          
          // 提取查询中的表名
          const tableNames = extractTableNamesFromQuery(payload.sql);
          const userId = await getCurrentUserId();
          
          // 对于SELECT查询，检查是否可以从缓存返回
          if (type === 'query' && tableNames.length === 1) {
            const table = tableNames[0];
            
            // 检查是否为自动同步表
            if (isAutoSyncTable(table)) {
              await ensureDataCacheManager();
              
              // 检查是否为简单的全表查询
              if (isSimpleSelectAllQuery(payload.sql, table)) {
                console.log(`ServiceWorker: Checking cache for auto-sync table: ${table}`);
                
                // 尝试从缓存获取数据
                const cachedData = await dataCacheManager!.queryCache(table, payload.sql, payload.vars, userId);
                
                if (cachedData && cachedData.length > 0) {
                  console.log(`ServiceWorker: Returning cached data for table: ${table}`);
                  respond(cachedData);
                  break;
                }
                
                // 缓存中没有数据，检查并自动同步
                const synced = await dataCacheManager!.checkAndAutoCache(table, userId);
                if (synced) {
                  // 重新尝试从缓存获取
                  const syncedData = await dataCacheManager!.queryCache(table, payload.sql, payload.vars, userId);
                  if (syncedData && syncedData.length > 0) {
                    console.log(`ServiceWorker: Returning auto-synced data for table: ${table}`);
                    respond(syncedData);
                    break;
                  }
                }
              }
            }
          }
          
          // 执行远程查询
          const results = await db.query(payload.sql, payload.vars);
          
          // 对于自动同步表的查询结果，自动缓存
          if (type === 'query' && tableNames.length === 1) {
            const table = tableNames[0];
            if (isAutoSyncTable(table) && results && results.length > 0) {
              await ensureDataCacheManager();
              
              try {
                // 缓存查询结果
                await dataCacheManager!.cacheData(table, results, 'persistent', userId);
                console.log(`ServiceWorker: Cached query results for auto-sync table: ${table}`);
              } catch (cacheError) {
                console.warn(`ServiceWorker: Failed to cache results for table: ${table}`, cacheError);
              }
            }
          }
          
          respond(results);
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
          // Token refresh is now handled automatically by TokenManager
          respond({ success: true });
          break;
        }

        case 'clear_token_refresh': {
          // Token refresh clearing is now handled by TokenManager
          respond({ success: true });
          break;
        }

        case 'refresh_token': {
          // Token refresh is now handled internally by TokenManager
          respond({ success: false, message: 'Token refresh is handled automatically' });
          break;
        }

        case 'check_tenant_code': {
          const valid = await checkTenantCode();
          respond({ valid });
          break;
        }

        case 'recover_tokens': {
          await ensureTokenManager();
          const token = await tokenManager!.getToken();
          respond({ success: !!token });
          break;
        }

        case 'get_connection_state': {
          respond({
            state: db?.status || ConnectionStatus.Disconnected,
            isConnected: isConnected,
            isReconnecting: isReconnecting,
            reconnectAttempts: reconnectAttempts,
            endpoint: connectionConfig?.endpoint
          });
          break;
        }

        case 'force_reconnect': {
          console.log('ServiceWorker: Force reconnection requested by client');
          if (isConnected) {
            stopConnectionHealthCheck();
            if (db) {
              try {
                await db.close();
              } catch (e) {
                console.warn('ServiceWorker: Error closing connection during force reconnect:', e);
              }
            }
            isConnected = false;
          }
          stopReconnection();
          triggerReconnection();
          respond({ success: true });
          break;
        }

        case 'SKIP_WAITING': {
          console.log('ServiceWorker: 收到 SKIP_WAITING 消息，跳过等待');
          self.skipWaiting();
          respond({ success: true });
          break;
        }


        // 自动同步相关消息
        case 'trigger_auto_sync': {
          await ensureDataCacheManager();
          const { userId, caseId } = payload;
          
          try {
            console.log('ServiceWorker: Manual auto sync triggered for user:', userId);
            await dataCacheManager!.autoSyncTables(userId, caseId);
            respond({ success: true, message: 'Auto sync completed successfully' });
          } catch (error) {
            console.error('ServiceWorker: Manual auto sync failed:', error);
            respond({ success: false, message: (error as Error).message });
          }
          break;
        }

        // 用户个人数据管理相关消息
        case 'sync_user_personal_data': {
          try {
            await ensureDataCacheManager();
            const { userId, caseId, personalData } = payload;

            // 先直接缓存个人数据
            await dataCacheManager!.cachePersonalData(userId, caseId, personalData);

            // 然后尝试设置订阅（如果失败也不影响核心功能）
            try {
              await dataCacheManager!.subscribePersistent(
                ['user_personal_data'],
                userId,
                caseId,
                {
                  enableLiveQuery: true,
                  enableIncrementalSync: true,
                  syncInterval: 5 * 60 * 1000, // 5分钟
                  expirationMs: 24 * 60 * 60 * 1000 // 24小时
                }
              );
            } catch (subscriptionError) {
              console.warn('ServiceWorker: Failed to setup subscription for user personal data, but data was cached successfully:', subscriptionError);
            }

            respond({ success: true });
          } catch (error) {
            console.error('ServiceWorker: Error in sync_user_personal_data:', error);
            respond({ success: false, error: (error as Error).message });
          }
          break;
        }

        case 'get_user_personal_data': {
          await ensureDataCacheManager();
          const { userId, caseId } = payload;

          const personalData = await dataCacheManager!.getPersonalData(userId, caseId);
          respond({ personalData });
          break;
        }

        case 'clear_user_personal_data': {
          await ensureDataCacheManager();
          const { userId, caseId } = payload;

          await dataCacheManager!.clearPersonalData(userId, caseId);
          respond({ success: true });
          break;
        }

        // 页面数据缓存管理相关消息
        case 'subscribe_page_data': {
          await ensureDataCacheManager();
          const { tables, userId, caseId, config } = payload;

          // 使用临时缓存策略订阅页面数据
          await dataCacheManager!.subscribeTemporary(tables, userId, caseId, config);

          respond({ success: true });
          break;
        }

        case 'unsubscribe_page_data': {
          await ensureDataCacheManager();
          const { tables, userId, caseId } = payload;

          // 取消临时缓存订阅
          await dataCacheManager!.unsubscribe(tables, 'temporary', userId, caseId);

          respond({ success: true });
          break;
        }

        case 'query_cached_data': {
          await ensureDataCacheManager();
          const { table, query, params, userId, caseId } = payload;

          const data = await dataCacheManager!.queryCache(table, query, params, userId, caseId);
          respond({ data });
          break;
        }

        case 'update_cached_data': {
          await ensureDataCacheManager();
          const { table, recordId, data, userId, caseId } = payload;

          const result = await dataCacheManager!.updateData(table, recordId, data, userId, caseId);
          respond({ result });
          break;
        }

        case 'clear_table_cache': {
          await ensureDataCacheManager();
          const { table, userId, caseId } = payload;

          await dataCacheManager!.clearTableCache(table, userId, caseId);
          respond({ success: true });
          break;
        }

        case 'clear_all_cache': {
          await ensureDataCacheManager();
          await dataCacheManager!.clearAllCache();
          respond({ success: true });
          break;
        }

        case 'cache_query_result': {
          await ensureDataCacheManager();
          const { table, result, userId, caseId } = payload;

          // 直接缓存查询结果
          await dataCacheManager!.cacheData(table, result, 'temporary', userId, caseId);

          respond({ success: true });
          break;
        }

        // 单个记录缓存相关消息（通用方法）
        case 'cache_record': {
          await ensureDataCacheManager();
          const { table, recordId, record, cacheType, userId, caseId } = payload;
          await dataCacheManager!.cacheRecord(table, recordId, record, cacheType || 'persistent', userId, caseId);
          respond({ success: true });
          break;
        }

        case 'get_cached_record': {
          await ensureDataCacheManager();
          const { table, recordId, userId, caseId } = payload;
          const record = await dataCacheManager!.getCachedRecord(table, recordId, userId, caseId);
          respond({ record });
          break;
        }

        case 'clear_cached_record': {
          await ensureDataCacheManager();
          const { table, recordId, userId, caseId } = payload;
          await dataCacheManager!.clearCachedRecord(table, recordId, userId, caseId);
          respond({ success: true });
          break;
        }

        // 增量同步相关消息
        case 'process_incremental_update': {
          await ensureDataCacheManager();
          const { update, conflictResolution } = payload;

          // 处理增量更新
          await processIncrementalUpdate(update, conflictResolution);

          respond({ success: true });
          break;
        }

        case 'create_sync_record': {
          await ensureDataCacheManager();
          const { syncRecord } = payload;

          // 创建同步记录
          await createSyncRecord(syncRecord);

          respond({ success: true });
          break;
        }

        case 'get_sync_record': {
          await ensureDataCacheManager();
          const { table, userId, caseId } = payload;

          // 获取同步记录
          const syncRecord = await getSyncRecord(table, userId, caseId);

          respond({ syncRecord });
          break;
        }

        case 'update_sync_record': {
          await ensureDataCacheManager();
          const { syncRecordId, lastSyncTimestamp, lastSyncId, status } = payload;

          // 更新同步记录
          await updateSyncRecord(syncRecordId, lastSyncTimestamp, lastSyncId, status);

          respond({ success: true });
          break;
        }

        case 'update_sync_status': {
          await ensureDataCacheManager();
          const { syncRecordId, status, lastSyncTimestamp, errorMessage } = payload;

          // 更新同步状态
          await updateSyncStatus(syncRecordId, status, lastSyncTimestamp, errorMessage);

          respond({ success: true });
          break;
        }

        case 'clear_sync_records': {
          await ensureDataCacheManager();
          const { tables, userId, caseId } = payload;

          // 清除同步记录
          await clearSyncRecords(tables, userId, caseId);

          respond({ success: true });
          break;
        }

        // 双向同步相关消息
        case 'persist_offline_queue': {
          await ensureDataCacheManager();
          const { syncKey, queue } = payload;

          // 持久化离线队列
          await persistOfflineQueue(syncKey, queue);

          respond({ success: true });
          break;
        }

        case 'restore_offline_queue': {
          await ensureDataCacheManager();
          const { syncKey } = payload;

          // 恢复离线队列
          const queue = await restoreOfflineQueue(syncKey);

          respond({ queue });
          break;
        }

        case 'clear_offline_queue': {
          await ensureDataCacheManager();
          const { syncKey } = payload;

          // 清除离线队列
          await clearOfflineQueue(syncKey);

          respond({ success: true });
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
  }
};

// 立即注册事件监听器
self.addEventListener('install', eventHandlers.install);
self.addEventListener('activate', eventHandlers.activate);
self.addEventListener('beforeunload', eventHandlers.beforeunload);
self.addEventListener('message', eventHandlers.message);

console.log("Service Worker event listeners registered");

import { Surreal, RecordId, ConnectionStatus } from 'surrealdb';
import { TokenManager, TokenInfo } from './token-manager';
import { DataCacheManager, isAutoSyncTable } from './data-cache-manager';

// 获取WASM引擎的函数
async function getWasmEngines() {
  // 等待__surrealdbWasmEngines 加载
  let retryCount = 0;
  const maxRetries = 50; // 最多等待 5 秒（50 * 100ms）

  while (!(self as any).__surrealdbWasmEngines && retryCount < maxRetries) {
    await new Promise(resolve => setTimeout(resolve, 100));
    retryCount++;
  }

  if (!(self as any).__surrealdbWasmEngines) {
    throw new Error('WASM engines not loaded after waiting');
  }

  return (self as any).__surrealdbWasmEngines();
}



// SurrealDB WASM 相关常量（现在已通过 ES 模块导入，无需外部 URL）


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

// --- Global State ---
// 远程 SurrealDB 实例 (单例)
let db: Surreal | null = null;
// 本地 SurrealDB WASM 实例 (单例)
let localDb: Surreal | null = null;
let tokenManager: TokenManager | null = null;
let dataCacheManager: DataCacheManager | null = null;
let isConnected = false;
let isLocalDbInitialized = false;
let connectionConfig: {
  endpoint: string;
  namespace: string;
  database: string;
  auth?: AnyAuth;
} | null = null;

// Live query management
const liveQuerySubscriptions = new Map<string, {
  query: string;
  vars?: Record<string, unknown>;
  clients: Set<string>; // Set of client IDs
}>();

// Token refresh is now handled by TokenManager

// Connection management and auto-reconnect
let reconnectTimer: NodeJS.Timeout | null = null;
let connectionHealthCheck: NodeJS.Timeout | null = null;
let isReconnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = Infinity; // 无限重连
const RECONNECT_DELAY_BASE = 100; // 基础重连延迟 100ms
const RECONNECT_DELAY_MAX = 5000; // 最大重连延迟 5秒
const CONNECTION_TIMEOUT = 10000; // 10秒连接超时

// 使用SurrealDB官方的ConnectionStatus枚举，无需自定义状态

// --- Helper Functions for Event Handlers ---

/**
 * 通知客户端连接状态变化
 */
function notifyConnectionStateChange(error?: Error) {
  const currentState = db?.status || ConnectionStatus.Disconnected;

  console.log(`ServiceWorker: Connection state is ${currentState}`);

  // 通知所有客户端连接状态变化
  broadcastToAllClients({
    type: 'connection_state_changed',
    payload: {
      state: currentState,
      error: error?.message,
      timestamp: Date.now()
    }
  });
}

/**
 * 停止连接健康检查
 */
function stopConnectionHealthCheck() {
  if (connectionHealthCheck) {
    clearInterval(connectionHealthCheck);
    connectionHealthCheck = null;
    console.log('ServiceWorker: Connection health check stopped');
  }
}

/**
 * 计算重连延迟（指数退避，但有最大值限制）
 */
function calculateReconnectDelay(): number {
  const delay = Math.min(
    RECONNECT_DELAY_BASE * Math.pow(2, Math.min(reconnectAttempts, 6)), // 最多 64 倍基础延迟
    RECONNECT_DELAY_MAX
  );
  return delay;
}

/**
 * 触发重连
 */
function triggerReconnection() {
  if (isReconnecting) {
    console.log('ServiceWorker: Reconnection already in progress, skipping');
    return;
  }

  isReconnecting = true;
  notifyConnectionStateChange();

  // 立即尝试重连（第一次重连延迟很小）
  const delay = reconnectAttempts === 0 ? RECONNECT_DELAY_BASE : calculateReconnectDelay();

  console.log(`ServiceWorker: Scheduling reconnection attempt ${reconnectAttempts + 1} in ${delay}ms`);

  reconnectTimer = setTimeout(async () => {
    await performReconnection();
  }, delay);
}

/**
 * 执行重连
 */
async function performReconnection() {
  if (!connectionConfig) {
    console.error('ServiceWorker: Cannot reconnect - no connection config available');
    isReconnecting = false;
    notifyConnectionStateChange();
    return;
  }

  if (db?.status !== ConnectionStatus.Disconnected && db?.status !== ConnectionStatus.Error) {
    return;
  }

  reconnectAttempts++;
  console.log(`ServiceWorker: Attempting reconnection #${reconnectAttempts} to ${connectionConfig.endpoint}`);

  try {
    // 清理当前连接
    if (db && isConnected) {
      try {
        await db.close();
        console.log('ServiceWorker: Closed existing connection for reconnection');
      } catch (e) {
        console.warn('ServiceWorker: Error closing connection during reconnection:', e);
      }
    }

    isConnected = false;

    // 确保数据库实例存在（使用单例模式）
    await initializeSurreal();

    // 设置连接超时
    const connectPromise = connectWithTimeout();
    await connectPromise;

    // 重连成功
    isConnected = true;
    reconnectAttempts = 0;
    isReconnecting = false;

    notifyConnectionStateChange();
    console.log('ServiceWorker: Reconnection successful');

    // 重新订阅所有 Live Query
    await resubscribeAllLiveQueries();

  } catch (error) {
    console.error(`ServiceWorker: Reconnection attempt #${reconnectAttempts} failed:`, error);

    // 如果还需要继续重连
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      isReconnecting = false;

      // 立即触发下一次重连
      triggerReconnection();
    } else {
      // 达到最大重连次数
      isReconnecting = false;
      notifyConnectionStateChange(error as Error);
      console.error('ServiceWorker: Max reconnection attempts reached');
    }
  }
}

/**
 * 带超时的连接函数
 */
async function connectWithTimeout(): Promise<void> {
  if (!connectionConfig) {
    throw new Error('No connection config available');
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, CONNECTION_TIMEOUT);

    const doConnect = async () => {
      try {
        const conn = await db!.connect(connectionConfig!.endpoint);
        console.log('ServiceWorker: connect resp:', conn)
        // 设置连接事件监听器
        setupConnectionEventListeners();

        await db!.use({ namespace: connectionConfig!.namespace, database: connectionConfig!.database });

        // 重新认证
        await ensureTokenManager();
        const token = await tokenManager!.getToken();

        if (token && token.access_token) {
          await db!.authenticate(token.access_token);
          console.log('ServiceWorker: Re-authenticated successfully during reconnection');

          // Token refresh is now handled automatically by TokenManager
        }

        clearTimeout(timeout);
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    };

    doConnect();
  });
}

/**
 * 设置连接事件监听器
 */
function setupConnectionEventListeners() {
  if (!db || !db.emitter) {
    return;
  }

  // 监听连接状态变化
  db.emitter.subscribe('disconnected', () => {
    console.warn('ServiceWorker: Database connection lost');
    isConnected = false;
    notifyConnectionStateChange();
    stopConnectionHealthCheck();

    // 立即触发重连
    triggerReconnection();
  });

  db.emitter.subscribe('error', (error: Error) => {
    console.error('ServiceWorker: Database connection error:', error);
    isConnected = false;
    notifyConnectionStateChange(error);
    stopConnectionHealthCheck();

    // 立即触发重连
    triggerReconnection();
  });

  console.log('ServiceWorker: Connection event listeners set up');
}

/**
 * 停止重连
 */
function stopReconnection() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  isReconnecting = false;
  reconnectAttempts = 0;
  console.log('ServiceWorker: Reconnection stopped');
}

/**
 * 从客户端的 localStorage 同步 token 到 Service Worker
 */
async function syncTokensFromLocalStorage() {
  try {
    const clients = await self.clients.matchAll();
    if (clients.length > 0) {
      // 向第一个客户端请求同步 token
      clients[0].postMessage({
        type: 'request_token_sync',
        payload: {}
      });
    }
  } catch (error) {
    console.error('ServiceWorker: Failed to sync tokens from localStorage:', error);
  }
}


// --- Cache and Storage Functions ---

/**
 * 清理旧版本的缓存
 */
async function cleanupOldCaches(): Promise<void> {
  try {
    console.log('ServiceWorker: Cleaning up old caches...');
    const cacheNames = await caches.keys();
    const oldCacheNames = cacheNames.filter(name =>
      name.startsWith('cuckoox-sw-') && name !== SW_CACHE_NAME
    );

    await Promise.all(
      oldCacheNames.map(cacheName => {
        console.log(`ServiceWorker: Deleting old cache: ${cacheName}`);
        return caches.delete(cacheName);
      })
    );

    console.log('ServiceWorker: Old caches cleaned up successfully');
  } catch (error) {
    console.warn('ServiceWorker: Failed to cleanup old caches:', error);
  }
}

/**
 * 预缓存 SurrealDB WASM 文件
 */
async function precacheSurrealDBWasm(): Promise<void> {
  try {
    console.log('ServiceWorker: Precaching WASM files...');

    // 预加载WASM和JS文件
    const [wasmResponse] = await Promise.all([
      fetch('https://unpkg.com/@surrealdb/wasm@1.4.1/dist/surreal/index_bg.wasm'),
    ]);

    if (wasmResponse.ok) {
      console.log('ServiceWorker: WASM files precached successfully');
    } else {
      console.warn('ServiceWorker: Failed to precache some WASM files');
    }
  } catch (error) {
    console.warn('ServiceWorker: WASM precaching failed, continuing without cache:', error);
  }
}

/**
 * 初始化本地 SurrealDB WASM 实例
 */
async function initializeLocalSurrealDB(): Promise<void> {
  if (isLocalDbInitialized && localDb) {
    console.log('ServiceWorker: Local SurrealDB already initialized, reusing singleton instance');
    return;
  }

  try {
    console.log('ServiceWorker: Initializing local SurrealDB singleton...');

    // 创建使用 WASM 引擎的 Surreal 实例 (单例)
    localDb = new Surreal({
      engines: await getWasmEngines(),
    });

    await localDb.connect('indxdb://cuckoox-storage');
    await localDb.use({ namespace: 'ck_go', database: 'local' });

    isLocalDbInitialized = true;
    console.log('ServiceWorker: Local SurrealDB singleton initialized successfully');
  } catch (error) {
    console.error('ServiceWorker: Failed to initialize local SurrealDB:', error);
    // 即使初始化失败，也标记为已尝试
    isLocalDbInitialized = true;
    throw error;
  }
}

/**
 * 初始化 TokenManager
 */
async function initializeTokenManager(): Promise<void> {
  if (tokenManager) return;

  try {
    console.log('ServiceWorker: Initializing TokenManager...');

    // 先初始化本地数据库
    await initializeLocalSurrealDB();

    // 创建 TokenManager 并传入 localDb
    tokenManager = new TokenManager({
      apiUrl: import.meta.env.VITE_API_URL || 'http://localhost:8082',
      broadcastToAllClients: broadcastToAllClients,
    });

    await tokenManager.initialize(localDb);
    console.log('ServiceWorker: TokenManager initialized successfully');
  } catch (error) {
    console.error('ServiceWorker: Failed to initialize TokenManager:', error);
    throw error;
  }
}

/**
 * 确保 TokenManager 已初始化
 */
async function ensureTokenManager(): Promise<void> {
  if (!tokenManager) {
    await initializeTokenManager();
  }
}


/**
 * 初始化 DataCacheManager
 */
async function initializeDataCacheManager(): Promise<void> {
  if (dataCacheManager) return;

  try {
    console.log('ServiceWorker: Initializing DataCacheManager...');

    // 先初始化本地数据库
    await initializeLocalSurrealDB();

    // 创建 DataCacheManager 实例
    dataCacheManager = new DataCacheManager({
      localDb: localDb!,
      remoteDb: db || undefined,
      broadcastToAllClients: broadcastToAllClients,
      defaultExpirationMs: 60 * 60 * 1000 // 1小时
    });

    await dataCacheManager.initialize();
    console.log('ServiceWorker: DataCacheManager initialized successfully');
  } catch (error) {
    console.error('ServiceWorker: Failed to initialize DataCacheManager:', error);
    throw error;
  }
}

/**
 * 确保 DataCacheManager 已初始化
 */
async function ensureDataCacheManager(): Promise<void> {
  if (!dataCacheManager) {
    await initializeDataCacheManager();
  }
}




// --- Helper Functions ---

/**
 * 从SQL查询中提取表名
 * 支持基本的SELECT、INSERT、UPDATE、DELETE语句
 */
function extractTableNamesFromQuery(sql: string): string[] {
  const tables: string[] = [];
  
  // 移除多余的空格和换行符
  const cleanSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
  
  // SELECT 语句：SELECT ... FROM table
  const selectMatches = cleanSql.matchAll(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
  for (const match of selectMatches) {
    tables.push(match[1]);
  }
  
  // INSERT 语句：INSERT INTO table
  const insertMatches = cleanSql.matchAll(/insert\s+into\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
  for (const match of insertMatches) {
    tables.push(match[1]);
  }
  
  // UPDATE 语句：UPDATE table
  const updateMatches = cleanSql.matchAll(/update\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
  for (const match of updateMatches) {
    tables.push(match[1]);
  }
  
  // DELETE 语句：DELETE FROM table
  const deleteMatches = cleanSql.matchAll(/delete\s+from\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
  for (const match of deleteMatches) {
    tables.push(match[1]);
  }
  
  // 去重并返回
  return [...new Set(tables)];
}

/**
 * 检查查询是否为简单的全表查询
 * 例如：SELECT * FROM table
 */
function isSimpleSelectAllQuery(sql: string, table: string): boolean {
  const cleanSql = sql.replace(/\s+/g, ' ').trim().toLowerCase();
  const pattern = new RegExp(`^select\\s+\\*\\s+from\\s+${table.toLowerCase()}\\s*;?$`);
  return pattern.test(cleanSql);
}

/**
 * 获取当前用户ID（从认证状态中提取）
 */
async function getCurrentUserId(): Promise<string | undefined> {
  try {
    await ensureConnection();
    if (!db) return undefined;
    
    // 查询当前认证状态
    const authResult = await db.query('RETURN $auth;');
    
    if (authResult && authResult.length > 0 && authResult[0]) {
      const auth = authResult[0] as any;
      // 从认证信息中提取用户ID
      if (auth.id) {
        const userId = String(auth.id);
        console.log('ServiceWorker: Current user ID:', userId);
        return userId;
      }
    }
    
    return undefined;
  } catch (error) {
    console.warn('ServiceWorker: Failed to get current user ID:', error);
    return undefined;
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
  if (typeof obj === 'object' && 'id' in obj && 'tb' in obj) {
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
async function checkTenantCode(): Promise<boolean> {
  await ensureTokenManager();

  const hasTenantCode = await tokenManager!.hasTenantCode();

  if (!hasTenantCode) {
    // 清除认证状态
    await tokenManager!.clearToken();

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


// --- SurrealDB Logic ---

async function initializeSurreal(): Promise<void> {
  if (db) {
    console.log("ServiceWorker: SurrealDB already initialized, reusing singleton instance");
    return;
  }

  try {
    // Create a new SurrealDB instance (singleton)
    db = new Surreal();
    console.log("ServiceWorker: SurrealDB singleton initialized successfully");
  } catch (error) {
    console.error("ServiceWorker: Failed to initialize SurrealDB:", error);
    throw error;
  }
}

let connecting = false;

async function ensureConnection(newConfig?: typeof connectionConfig): Promise<boolean> {
  if (connecting) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return true;
  }
  connecting = true;
  try {
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
        stopConnectionHealthCheck();

        if (isConnected && db) {
          try {
            await db.close();
            console.log("ServiceWorker: Closed existing connection for endpoint change");
          } catch (e) {
            console.warn("ServiceWorker: Error closing connection:", e);
          }
        }
        isConnected = false;
        notifyConnectionStateChange();
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
            await ensureTokenManager();
            const token = await tokenManager!.getToken();

            if (token && token.access_token) {
              await db.authenticate(token.access_token);
              console.log("ServiceWorker: Re-authenticated after namespace/database change.");
            }
          } catch (e) {
            console.error("ServiceWorker: Failed to switch namespace/database:", e);
            isConnected = false;
            notifyConnectionStateChange(e as Error);
            triggerReconnection();
          }
        }
        connectionConfig = newConfig;
      } else if (authChanged) {
        // 只有认证信息变化，只需要重新认证
        console.log("ServiceWorker: Auth changed, re-authenticating...");

        if (isConnected && db) {
          try {
            await ensureTokenManager();
            const token = await tokenManager!.getToken();

            if (token && token.access_token) {
              await db.authenticate(token.access_token);
              console.log("ServiceWorker: Re-authenticated with new auth info.");
            }
          } catch (e) {
            console.error("ServiceWorker: Re-authentication failed:", e);
            notifyConnectionStateChange(e as Error);
            triggerReconnection();
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
      notifyConnectionStateChange();
      return false;
    }

    if (db && db.status === ConnectionStatus.Disconnected) {
      try {
        notifyConnectionStateChange();
        console.log(`ServiceWorker: Connecting to ${connectionConfig.endpoint}...`);

        // 使用带超时的连接
        await connectWithTimeout();

        isConnected = true;
        notifyConnectionStateChange();
        console.log("ServiceWorker: Connection established.");

        // 重置重连计数
        reconnectAttempts = 0;

        // Resubscribe to all live queries
        await resubscribeAllLiveQueries();

      } catch (e) {
        console.error("ServiceWorker: Connection failed.", e);
        isConnected = false;
        notifyConnectionStateChange(e as Error);

        // 触发自动重连
        triggerReconnection();
        return false;
      }
    }
  } finally {
    connecting = false;
  }
  return true;
}

async function resubscribeAllLiveQueries() {
  console.log("ServiceWorker: Resubscribing to all live queries...");
  const subscriptionPromises: Promise<void>[] = [];

  for (const [uuid, sub] of liveQuerySubscriptions.entries()) {
    const subscriptionPromise = (async () => {
      try {
        if (!db) throw new Error("Database not initialized");

        // 重新创建 live query，使用原始的 uuid 作为标识
        const newUuid = await db.live(sub.query, (action, result) => {
          broadcastToClients({
            type: 'live_update',
            payload: { uuid, action, result }
          }, sub.clients);
        });

        // 如果新的 UUID 与原来的不同，需要更新映射
        if (String(newUuid) !== uuid) {
          console.log(`ServiceWorker: Live query UUID changed from ${uuid} to ${newUuid}`);
          // 创建新的订阅记录
          liveQuerySubscriptions.set(String(newUuid), {
            query: sub.query,
            vars: sub.vars,
            clients: sub.clients
          });
          // 删除旧的记录
          liveQuerySubscriptions.delete(uuid);

          // 通知客户端 UUID 变化
          broadcastToClients({
            type: 'live_query_uuid_changed',
            payload: { oldUuid: uuid, newUuid: String(newUuid) }
          }, sub.clients);
        }

        console.log(`ServiceWorker: Successfully resubscribed to live query ${uuid}`);
      } catch (e) {
        console.error(`ServiceWorker: Failed to resubscribe to live query ${uuid}`, e);

        // 通知客户端重订阅失败
        broadcastToClients({
          type: 'live_query_resubscribe_failed',
          payload: { uuid, error: (e as Error).message }
        }, sub.clients);
      }
    })();

    subscriptionPromises.push(subscriptionPromise);
  }

  // 等待所有重订阅完成
  await Promise.allSettled(subscriptionPromises);
  console.log("ServiceWorker: Live queries resubscription completed");
}

// --- 增量同步辅助函数 ---

/**
 * 处理增量更新
 */
async function processIncrementalUpdate(
  update: any,
  conflictResolution: 'local' | 'remote' | 'timestamp'
): Promise<void> {
  try {
    console.log('ServiceWorker: Processing incremental update:', update);

    // 获取本地数据
    const localData = await dataCacheManager!.queryCache(
      update.table_name,
      `SELECT * FROM ${update.table_name} WHERE id = $id`,
      { id: update.id }
    );

    const hasLocalData = localData && localData.length > 0;

    // 处理不同的操作类型
    switch (update.operation) {
      case 'insert':
        if (!hasLocalData) {
          // 直接插入新数据
          await dataCacheManager!.cacheData(
            update.table_name,
            [update.data],
            'temporary'
          );
        } else {
          // 存在冲突，根据策略处理
          await handleConflict(update, localData[0], conflictResolution);
        }
        break;

      case 'update':
        if (hasLocalData) {
          // 检查版本冲突
          const localVersion = localData[0].version || 0;
          const remoteVersion = update.version || 0;

          if (remoteVersion > localVersion) {
            // 远程版本更新，直接更新
            await dataCacheManager!.updateData(
              update.table_name,
              update.id,
              update.data
            );
          } else if (remoteVersion < localVersion) {
            // 本地版本更新，根据策略处理
            await handleConflict(update, localData[0], conflictResolution);
          }
          // 版本相同，不需要更新
        } else {
          // 本地没有数据，直接插入
          await dataCacheManager!.cacheData(
            update.table_name,
            [update.data],
            'temporary'
          );
        }
        break;

      case 'delete':
        if (hasLocalData) {
          // 删除本地数据
          await dataCacheManager!.clearTableCache(
            update.table_name,
            update.data.user_id,
            update.data.case_id
          );
        }
        break;
    }

    // 广播更新事件
    await broadcastToAllClients({
      type: 'incremental_update_processed',
      payload: {
        table: update.table_name,
        operation: update.operation,
        recordId: update.id,
        timestamp: Date.now()
      }
    });

  } catch (error) {
    console.error('ServiceWorker: Error processing incremental update:', error);
    throw error;
  }
}

/**
 * 处理冲突
 */
async function handleConflict(
  remoteUpdate: any,
  localData: any,
  conflictResolution: 'local' | 'remote' | 'timestamp'
): Promise<void> {
  console.log('ServiceWorker: Handling conflict with strategy:', conflictResolution);

  switch (conflictResolution) {
    case 'local':
      // 保留本地数据，忽略远程更新
      console.log('ServiceWorker: Keeping local data, ignoring remote update');
      break;

    case 'remote':
      // 使用远程数据覆盖本地数据
      console.log('ServiceWorker: Using remote data, overwriting local');
      await dataCacheManager!.updateData(
        remoteUpdate.table_name,
        remoteUpdate.id,
        remoteUpdate.data
      );
      break;

    case 'timestamp':
      // 根据时间戳决定使用哪个版本
      const localTimestamp = new Date(localData.updated_at).getTime();
      const remoteTimestamp = new Date(remoteUpdate.updated_at).getTime();

      if (remoteTimestamp > localTimestamp) {
        console.log('ServiceWorker: Remote data is newer, using remote');
        await dataCacheManager!.updateData(
          remoteUpdate.table_name,
          remoteUpdate.id,
          remoteUpdate.data
        );
      } else {
        console.log('ServiceWorker: Local data is newer, keeping local');
      }
      break;
  }
}

/**
 * 创建同步记录
 */
async function createSyncRecord(syncRecord: any): Promise<void> {
  try {
    await localDb!.create('sync_record', syncRecord);
    console.log('ServiceWorker: Created sync record:', syncRecord.id);
  } catch (error) {
    console.error('ServiceWorker: Error creating sync record:', error);
    throw error;
  }
}

/**
 * 获取同步记录
 */
async function getSyncRecord(
  table: string,
  userId: string,
  caseId?: string
): Promise<any> {
  try {
    const recordId = `sync_record:${table}_${userId}_${caseId || 'global'}`;
    const result = await localDb!.select(recordId);
    return result || null;
  } catch (error) {
    console.error('ServiceWorker: Error getting sync record:', error);
    return null;
  }
}

/**
 * 更新同步记录
 */
async function updateSyncRecord(
  syncRecordId: any,
  lastSyncTimestamp: number,
  lastSyncId?: string,
  status?: string
): Promise<void> {
  try {
    const updateData: any = {
      last_sync_timestamp: lastSyncTimestamp,
      updated_at: new Date()
    };

    if (lastSyncId) {
      updateData.last_sync_id = lastSyncId;
    }

    if (status) {
      updateData.sync_status = status;
    }

    await localDb!.update(syncRecordId, updateData);
    console.log('ServiceWorker: Updated sync record:', syncRecordId);
  } catch (error) {
    console.error('ServiceWorker: Error updating sync record:', error);
    throw error;
  }
}

/**
 * 更新同步状态
 */
async function updateSyncStatus(
  syncRecordId: any,
  status: string,
  lastSyncTimestamp?: number,
  errorMessage?: string
): Promise<void> {
  try {
    const updateData: any = {
      sync_status: status,
      updated_at: new Date()
    };

    if (lastSyncTimestamp) {
      updateData.last_sync_timestamp = lastSyncTimestamp;
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    // 如果状态是失败，增加重试次数
    if (status === 'failed') {
      const currentRecord = await localDb!.select(syncRecordId);
      updateData.retry_count = ((currentRecord as any)?.retry_count || 0) + 1;
    }

    await localDb!.update(syncRecordId, updateData);
    console.log('ServiceWorker: Updated sync status:', syncRecordId, status);
  } catch (error) {
    console.error('ServiceWorker: Error updating sync status:', error);
    throw error;
  }
}

/**
 * 清除同步记录
 */
async function clearSyncRecords(
  tables: string[],
  userId: string,
  caseId?: string
): Promise<void> {
  try {
    for (const table of tables) {
      const recordId = `sync_record:${table}_${userId}_${caseId || 'global'}`;
      await localDb!.delete(recordId);
    }
    console.log('ServiceWorker: Cleared sync records for tables:', tables);
  } catch (error) {
    console.error('ServiceWorker: Error clearing sync records:', error);
    throw error;
  }
}

// --- 双向同步辅助函数 ---

/**
 * 持久化离线队列
 */
async function persistOfflineQueue(syncKey: string, queue: any[]): Promise<void> {
  try {
    const queueRecord = {
      id: new RecordId('offline_queue', syncKey),
      sync_key: syncKey,
      queue_data: queue,
      created_at: new Date(),
      updated_at: new Date()
    };

    await localDb!.create('offline_queue', queueRecord);
    console.log('ServiceWorker: Persisted offline queue for sync key:', syncKey);
  } catch (error) {
    // 如果创建失败，尝试更新
    try {
      const queueRecord = {
        queue_data: queue,
        updated_at: new Date()
      };

      await localDb!.update(new RecordId('offline_queue', syncKey), queueRecord);
      console.log('ServiceWorker: Updated offline queue for sync key:', syncKey);
    } catch (updateError) {
      console.error('ServiceWorker: Error persisting offline queue:', updateError);
      throw updateError;
    }
  }
}

/**
 * 恢复离线队列
 */
async function restoreOfflineQueue(syncKey: string): Promise<any[]> {
  try {
    const recordId = new RecordId('offline_queue', syncKey);
    const result = await localDb!.select(recordId);

    if (result && (result as any).queue_data) {
      console.log('ServiceWorker: Restored offline queue for sync key:', syncKey);
      return (result as any).queue_data;
    }

    return [];
  } catch (error) {
    console.error('ServiceWorker: Error restoring offline queue:', error);
    return [];
  }
}

/**
 * 清除离线队列
 */
async function clearOfflineQueue(syncKey: string): Promise<void> {
  try {
    const recordId = new RecordId('offline_queue', syncKey);
    await localDb!.delete(recordId);
    console.log('ServiceWorker: Cleared offline queue for sync key:', syncKey);
  } catch (error) {
    console.error('ServiceWorker: Error clearing offline queue:', error);
    throw error;
  }
}