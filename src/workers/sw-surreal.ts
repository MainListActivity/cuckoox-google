/// <reference lib="WebWorker" />
// Extend the global scope to include ServiceWorker-specific types
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: any;
};

// Service Worker 版本号
const SW_VERSION = "v1.0.3-fix-tokenmanager-lock-1754900850736";
const SW_CACHE_NAME = `cuckoox-sw-${SW_VERSION}`;

// Workbox 预缓存支持
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { CacheFirst, NetworkFirst } from "workbox-strategies";

// 导入静态资源缓存管理器
import { StaticResourceCacheManager } from "./static-resource-cache-manager.js";
import {
  NetworkStateManager,
  type NetworkState,
} from "./network-state-manager.js";
import {
  PWAPushManager,
  type NotificationPayload,
} from "./pwa-push-manager.js";
import {
  PWACollaborationEnhancer,
  type CollaborationEvent,
} from "./pwa-collaboration-enhancer.js";
import {
  PWAPerformanceManager,
  type PWAPerformanceConfig,
} from "./pwa-performance-manager.js";
import {
  PWASecurityManager,
  type PWASecurityConfig,
} from "./pwa-security-manager.js";

// 导入新的连接管理器
import { SurrealDBConnectionManager } from "./surreal-connection-manager.js";

// 🔧 导入简化的连接管理器补丁
import {
  initializeSimplifiedConnectionManager,
  getSimplifiedConnectionManager,
  connectWithSimplifiedManager,
  forceReconnectWithSimplifiedManager,
  getSimplifiedConnectionState,
  getDatabaseFromSimplifiedManager,
  isConnectedViaSimplifiedManager,
  isAuthenticatedViaSimplifiedManager,
  disconnectSimplifiedManager,
  disposeSimplifiedConnectionManager,
} from "./sw-surreal-connection-patch";

// 导入 WASM shim 来初始化 SurrealDB WASM 引擎
import "./wasm-shim.js";

// --- 立即注册事件监听器（确保在任何异步代码之前注册） ---
console.log(`Service Worker script executing - ${SW_VERSION}`);

// 静态资源缓存管理器实例
let staticCacheManager: StaticResourceCacheManager | null = null;

// 网络状态管理器实例
let networkStateManager: NetworkStateManager | null = null;

// PWA推送通知管理器实例
let pwaPushManager: PWAPushManager | null = null;

// PWA协作增强器实例
let pwaCollaborationEnhancer: PWACollaborationEnhancer | null = null;

// PWA性能管理器实例
let pwaPerformanceManager: PWAPerformanceManager | null = null;

// PWA安全管理器实例
let pwaSecurityManager: PWASecurityManager | null = null;

// 🌟 新的统一连接管理器实例
let connectionManager: SurrealDBConnectionManager | null = null;

// 🔧 使用简化连接管理器的标志（默认启用）
const USE_SIMPLIFIED_CONNECTION_MANAGER = true;

// 🔧 获取当前数据库实例的辅助函数
function getCurrentDatabase(): Surreal | null {
  if (USE_SIMPLIFIED_CONNECTION_MANAGER) {
    return getDatabaseFromSimplifiedManager();
  } else {
    return db;
  }
}

// 🔧 检查连接状态的辅助函数
function checkCurrentConnectionState(): boolean {
  if (USE_SIMPLIFIED_CONNECTION_MANAGER) {
    return isConnectedViaSimplifiedManager();
  } else {
    return isConnected;
  }
}

// TokenManager 初始化锁定
let tokenManagerInitializing = false;

// Workbox 预缓存和路由设置
const manifest = self.__WB_MANIFEST;
if (manifest) {
  precacheAndRoute(manifest);
}
cleanupOutdatedCaches();

// 设置字体缓存策略 (来自原有的 workbox 配置)
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new CacheFirst({
    cacheName: "google-fonts-cache",
  }),
);

registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: "gstatic-fonts-cache",
  }),
);

const eventHandlers = {
  install: (event: ExtendableEvent) => {
    console.log(`🔧 Service Worker installing - ${SW_VERSION}`);
    event.waitUntil(
      Promise.all([
        self.skipWaiting(),
        // 🔧 新的连接管理器预初始化和 WASM 缓存
        new Promise((resolve) => {
          setTimeout(async () => {
            try {
              await precacheSurrealDBWasm();
              console.log("ServiceWorker: WASM precached");
            } catch (e) {
              console.warn("ServiceWorker: Failed to precache WASM:", e);
            }
            resolve(void 0);
          }, 0);
        }),
      ]),
    );
  },

  activate: (event: ExtendableEvent) => {
    console.log(`🔧 Service Worker activating - ${SW_VERSION}`);
    console.log(
      `🔧 USE_SIMPLIFIED_CONNECTION_MANAGER = ${USE_SIMPLIFIED_CONNECTION_MANAGER}`,
    );

    // 🚀 立即广播就绪状态，避免页面阻塞
    broadcastToAllClients({
      type: "service_worker_ready",
      payload: {
        ready: true,
        timestamp: Date.now(),
        initializing: true,
      },
    });

    event.waitUntil(
      Promise.all([
        self.clients.claim(),
        // 清理旧版本的缓存
        cleanupOldCaches(),
      ]).then(async () => {
        // 🔧 后台异步初始化，不阻塞页面
        Promise.resolve()
          .then(async () => {
            try {
              if (USE_SIMPLIFIED_CONNECTION_MANAGER) {
                // 🔧 使用简化的连接管理器
                console.log(
                  "🔧 ServiceWorker: Initializing simplified connection manager in background...",
                );
                try {
                  await initializeSimplifiedConnectionManager();
                  console.log(
                    "🔧 ServiceWorker: Simplified connection manager initialized successfully",
                  );

                  // 🎯 初始化依赖组件
                  await initializeAllDependentComponents();

                  // 🚀 广播完全就绪状态
                  broadcastToAllClients({
                    type: "service_worker_ready",
                    payload: {
                      ready: true,
                      initialized: true,
                      timestamp: Date.now(),
                    },
                  });
                } catch (error) {
                  console.error(
                    "🔧 SimplifiedConnectionManager initialization failed:",
                    error,
                  );
                  // 即使初始化失败也要广播状态，让页面继续工作
                  broadcastToAllClients({
                    type: "service_worker_ready",
                    payload: {
                      ready: true,
                      initialized: false,
                      error:
                        error instanceof Error
                          ? error.message
                          : "Unknown error",
                      timestamp: Date.now(),
                    },
                  });
                }
              } else {
                // 🚀 使用原有的连接管理器统一初始化
                console.log(
                  "ServiceWorker: Initializing new connection manager in background...",
                );

                // 获取连接管理器实例（单例模式）
                connectionManager =
                  await SurrealDBConnectionManager.getInstance();

                // 🔄 尝试恢复连接状态
                const restoredSuccessfully =
                  await connectionManager.restoreState();
                if (restoredSuccessfully) {
                  console.log(
                    "ServiceWorker: Connection state restored successfully",
                  );
                }

                // 🎯 初始化依赖组件（使用新管理器提供的数据库实例）
                await initializeAllDependentComponents();

                // 🚀 广播完全就绪状态
                broadcastToAllClients({
                  type: "service_worker_ready",
                  payload: {
                    ready: true,
                    initialized: true,
                    timestamp: Date.now(),
                  },
                });
              }

              // 🧹 清理工作
              console.log(
                "ServiceWorker: Background initialization completed successfully",
              );
            } catch (e) {
              console.error(
                "ServiceWorker: Background initialization failed:",
                e,
              );

              // 🔄 如果新管理器失败，回退到旧的初始化逻辑
              console.log(
                "ServiceWorker: Falling back to legacy initialization...",
              );
              try {
                await legacyInitialization();

                // 广播就绪状态
                broadcastToAllClients({
                  type: "service_worker_ready",
                  payload: {
                    ready: true,
                    initialized: true,
                    fallback: true,
                    timestamp: Date.now(),
                  },
                });
              } catch (fallbackError) {
                console.error(
                  "ServiceWorker: Fallback initialization also failed:",
                  fallbackError,
                );

                // 即使失败也要广播状态，让页面继续工作
                broadcastToAllClients({
                  type: "service_worker_ready",
                  payload: {
                    ready: true,
                    initialized: false,
                    error:
                      fallbackError instanceof Error
                        ? fallbackError.message
                        : "Unknown error",
                    timestamp: Date.now(),
                  },
                });
              }
            }
          })
          .catch((asyncError) => {
            console.error(
              "ServiceWorker: Async initialization error:",
              asyncError,
            );
            // 确保即使异步初始化失败也有状态报告
            broadcastToAllClients({
              type: "service_worker_ready",
              payload: {
                ready: true,
                initialized: false,
                error:
                  asyncError instanceof Error
                    ? asyncError.message
                    : "Async initialization failed",
                timestamp: Date.now(),
              },
            });
          });
      }),
    );
  },

  beforeunload: async () => {
    try {
      console.log("ServiceWorker: Graceful shutdown initiated");

      // 🌟 使用新的连接管理器进行优雅关闭
      if (connectionManager) {
        await connectionManager.gracefulShutdown();
        connectionManager = null;
        console.log("ServiceWorker: Connection manager shutdown completed");
      } else {
        // 🔄 回退到旧的清理逻辑
        console.log("ServiceWorker: Using legacy cleanup...");
        await legacyCleanup();
      }

      // 🧹 清理其他组件
      await cleanupAllComponents();

      console.log("ServiceWorker: Graceful shutdown completed");
    } catch (e) {
      console.error("ServiceWorker: Shutdown error:", e);
    }
  },

  push: async (event: PushEvent) => {
    console.log("ServiceWorker: Push event received");

    let notificationData: NotificationPayload;

    try {
      // 解析推送数据
      if (event.data) {
        notificationData = event.data.json();
      } else {
        // 默认通知
        notificationData = {
          title: "CuckooX 系统通知",
          body: "您有新的消息",
          icon: "/assets/logo/cuckoo-icon.svg",
          badge: "/assets/logo/favicon.svg",
        };
      }

      // 显示通知
      await self.registration.showNotification(notificationData.title, {
        body: notificationData.body,
        icon: notificationData.icon,
        badge: notificationData.badge,
        image: notificationData.image,
        tag: notificationData.tag,
        data: notificationData.data,
        actions: notificationData.actions,
        requireInteraction: notificationData.requireInteraction || false,
        silent: notificationData.silent || false,
      });

      console.log("ServiceWorker: Notification displayed successfully");
    } catch (error) {
      console.error("ServiceWorker: Error handling push event:", error);
    }
  },

  notificationclick: async (event: NotificationEvent) => {
    console.log("ServiceWorker: Notification clicked", event.notification);

    event.notification.close();

    try {
      const notificationData = event.notification.data || {};
      const action = event.action;

      // 处理通知操作
      if (action === "view" || !action) {
        // 打开应用
        let urlToOpen = "/";

        if (notificationData.url) {
          urlToOpen = notificationData.url;
        } else if (notificationData.type) {
          // 根据通知类型确定跳转URL
          const typeUrlMap = {
            case: "/cases",
            claim: "/claims",
            message: "/messages",
            system: "/dashboard",
          };
          urlToOpen =
            typeUrlMap[notificationData.type as keyof typeof typeUrlMap] || "/";
        }

        // 打开或聚焦窗口
        const clients = await self.clients.matchAll({ type: "window" });

        for (const client of clients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            await client.focus();
            if (client.url !== urlToOpen) {
              client.postMessage({
                type: "navigate",
                payload: { url: urlToOpen },
              });
            }
            return;
          }
        }

        // 没有打开的窗口，打开新窗口
        await self.clients.openWindow(urlToOpen);
      } else if (action === "dismiss") {
        // 忽略操作，什么都不做
        console.log("ServiceWorker: Notification dismissed");
      }

      // 向客户端发送通知点击事件
      broadcastToAllClients({
        type: "notification_clicked",
        payload: {
          action,
          data: notificationData,
        },
      });
    } catch (error) {
      console.error("ServiceWorker: Error handling notification click:", error);
    }
  },

  notificationclose: async (event: NotificationEvent) => {
    console.log("ServiceWorker: Notification closed", event.notification);

    try {
      const notificationData = event.notification.data || {};

      // 向客户端发送通知关闭事件
      broadcastToAllClients({
        type: "notification_closed",
        payload: {
          data: notificationData,
        },
      });
    } catch (error) {
      console.error("ServiceWorker: Error handling notification close:", error);
    }
  },

  fetch: (event: FetchEvent) => {
    const url = new URL(event.request.url);

    // 只处理需要特殊处理的请求，让 Workbox 处理其他请求
    // 跳过 Google Fonts 请求（已被 Workbox 处理）
    if (
      url.hostname === "fonts.googleapis.com" ||
      url.hostname === "fonts.gstatic.com"
    ) {
      return; // 让 Workbox 处理
    }

    // 跳过扩展程序相关请求
    if (
      url.protocol === "chrome-extension:" ||
      url.protocol === "moz-extension:"
    ) {
      return;
    }

    // 只处理需要缓存管理的请求
    const shouldHandle = pwaPerformanceManager || staticCacheManager;
    if (!shouldHandle) {
      return; // 让浏览器处理默认行为
    }

    // 必须同步调用 event.respondWith()，因此将异步操作包装在 Promise 中
    event.respondWith(
      (async () => {
        try {
          // 首先尝试性能管理器处理
          if (pwaPerformanceManager) {
            const performanceResponse =
              await pwaPerformanceManager.handleRequest(event.request);
            if (performanceResponse) {
              return performanceResponse;
            }
          }

          // 然后尝试静态缓存管理器处理
          if (staticCacheManager) {
            const cachedResponse = await staticCacheManager.handleFetch(
              event.request,
            );
            if (cachedResponse) {
              return cachedResponse;
            }
          }

          // 如果都没有处理这个请求，则使用默认的网络请求
          return fetch(event.request);
        } catch (error) {
          console.error("ServiceWorker fetch error:", error);
          // 发生错误时，尝试使用网络请求作为后备
          return fetch(event.request);
        }
      })(),
    );
  },

  message: async (event: ExtendableMessageEvent) => {
    if (!event.data || !event.data.type) {
      return;
    }

    // 递归处理payload.data中可能被序列化的RecordId对象
    const { type, payload, messageId } = deserializeRecordIds(event.data);
    const clientId = (event.source as any)?.id;

    if (!clientId) return;

    const respond = (responsePayload: unknown) =>
      postMessageToClient(clientId, {
        type: `${type}_response`,
        messageId,
        payload: responsePayload,
      });

    const respondError = (error: Error) =>
      postMessageToClient(clientId, {
        type: `${type}_error`,
        messageId,
        payload: { message: error.message, stack: error.stack },
      });

    try {
      switch (type) {
        case "connect": {
          if (USE_SIMPLIFIED_CONNECTION_MANAGER) {
            // 🔧 使用简化连接管理器处理连接
            console.log(
              "🔧 SW: Using simplified connection manager for connect",
            );
            console.log("🔧 SW: Payload received:", {
              endpoint: payload.endpoint,
              namespace: payload.namespace,
              database: payload.database,
              hasToken: !!payload.token,
              hasSyncTokens: !!payload.sync_tokens,
            });

            await ensureTokenManager();

            // Sync token information from localStorage if provided
            if (payload.sync_tokens) {
              console.log("🔧 SW: Syncing tokens to token manager...");
              const tokenInfo: Partial<TokenInfo> = {
                access_token: payload.sync_tokens.access_token,
                refresh_token: payload.sync_tokens.refresh_token,
                token_expires_at: payload.sync_tokens.token_expires_at,
                tenant_code: payload.sync_tokens.tenant_code,
              };
              await tokenManager!.storeToken(tokenInfo);
              console.log("🔧 SW: Tokens synced successfully");
            }

            try {
              const connectionConfig = {
                endpoint: payload.endpoint,
                namespace: payload.namespace,
                database: payload.database,
                auth: payload.token ? { token: payload.token } : undefined,
              };

              console.log(
                "🔧 SW: About to call connectWithSimplifiedManager...",
              );

              // 🔧 设置连接超时保护
              const connectPromise =
                connectWithSimplifiedManager(connectionConfig);
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                  reject(new Error("Service Worker connection timeout"));
                }, 10000); // 10秒超时
              });

              try {
                await Promise.race([connectPromise, timeoutPromise]);
                console.log("🔧 SW: connectWithSimplifiedManager completed");
              } catch (connectError) {
                console.warn(
                  "🔧 SW: Connection attempt failed or timed out:",
                  connectError,
                );
                // 继续执行，不阻塞响应
              }

              const state = getSimplifiedConnectionState();
              console.log("🔧 SW: Final connection state:", state);

              // 🔧 即使连接失败也返回状态信息，让前端知道当前状态
              respond({
                status: state.isConnected ? "connected" : "disconnected",
                state: state.state,
                isAuthenticated: state.isAuthenticated,
                hasDb: state.hasDb,
                error: state.error,
                degraded: !state.isConnected, // 标记为降级模式
              });
            } catch (error) {
              console.error("🔧 SW: Simplified connection failed:", error);
              respond({
                status: "disconnected",
                state: "error",
                isAuthenticated: false,
                hasDb: false,
                error: (error as Error).message,
                degraded: true,
              });
            }
          } else {
            // 🔄 使用原有逻辑
            await ensureTokenManager();

            if (payload.sync_tokens) {
              const tokenInfo: Partial<TokenInfo> = {
                access_token: payload.sync_tokens.access_token,
                refresh_token: payload.sync_tokens.refresh_token,
                token_expires_at: payload.sync_tokens.token_expires_at,
                tenant_code: payload.sync_tokens.tenant_code,
              };
              await tokenManager!.storeToken(tokenInfo);
            }

            const connectionState = await ensureConnection(payload);
            if (connectionState.isConnected && connectionConfig) {
              await saveConnectionConfig(connectionConfig);
            }

            respond({
              status: connectionState.isConnected
                ? "connected"
                : "disconnected",
              state: connectionState.state,
              isAuthenticated: connectionState.isAuthenticated,
              hasDb: connectionState.hasDb,
              error: connectionState.error,
            });
          }
          break;
        }

        case "authenticate": {
          await ensureTokenManager();
          const tokenInfo: Partial<TokenInfo> = {
            access_token: payload.token,
            refresh_token: payload.refresh_token,
            token_expires_at: payload.expires_in
              ? Date.now() + payload.expires_in * 1000
              : undefined,
            tenant_code: payload.tenant_code,
          };
          await tokenManager!.storeToken(tokenInfo);

          const connectionState = await ensureConnection();
          if (connectionState.isConnected && connectionState.hasDb) {
            await db!.authenticate(payload.token);

            // 认证成功后，立即刷新认证状态缓存
            try {
              await refreshAuthStateCache();
              // 启动认证状态定期刷新
              startAuthStateRefresh();
            } catch (cacheError) {
              console.warn(
                "ServiceWorker: Failed to refresh auth cache after authentication:",
                cacheError,
              );
            }

            // 登录成功后，自动同步所有自动同步表
            try {
              await ensureDataCacheManager();
              const userId = await getCurrentUserId();
              if (userId) {
                console.log(
                  "ServiceWorker: Starting auto sync after authentication",
                );
                await dataCacheManager!.autoSyncTables(userId, payload.case_id);
                console.log(
                  "ServiceWorker: Auto sync completed after authentication",
                );
              }
            } catch (syncError) {
              console.warn(
                "ServiceWorker: Auto sync failed after authentication:",
                syncError,
              );
            }

            // Token refresh is now handled automatically by TokenManager
            respond({ success: true });
          } else {
            throw new Error("Connection not established.");
          }
          break;
        }

        case "invalidate": {
          await ensureTokenManager();
          await tokenManager!.clearToken();
          // 清除认证状态缓存
          clearAuthStateCache();
          stopAuthStateRefresh();
          // Token refresh clearing is now handled by TokenManager
          const invalidateConnectionState = await ensureConnection();
          if (
            invalidateConnectionState.isConnected &&
            invalidateConnectionState.hasDb
          )
            await db!.invalidate();
          respond({ success: true });
          break;
        }

        case "query":
        case "mutate": {
          // 确保离线管理器已初始化
          await ensureOfflineManager();

          // 检查是否处于离线模式
          const isOffline = offlineManager!.isOffline();

          if (isOffline && type === "mutate") {
            // 离线模式下的写操作：添加到离线队列
            console.log(
              "ServiceWorker: Offline mode detected, queuing mutation operation",
            );

            const userId = await getCurrentUserId();
            const caseId = payload.case_id;

            const operationId = await offlineManager!.queueOfflineOperation({
              type: "query",
              table: extractTableNameFromSQL(payload.sql) || "unknown",
              sql: payload.sql,
              params: payload.vars,
              userId,
              caseId,
              maxRetries: 3,
            });

            respond({
              success: true,
              offline: true,
              operationId,
              message: "操作已添加到离线队列，将在网络恢复后自动同步",
            });
            break;
          }

          if (isOffline && type === "query") {
            // 离线模式下的查询：尝试从本地数据库查询
            try {
              console.log(
                "ServiceWorker: Offline mode detected, executing query from local database",
              );
              const result = await offlineManager!.executeOfflineQuery(
                payload.sql,
                payload.vars,
              );
              respond(result);
              break;
            } catch (error) {
              console.error("ServiceWorker: Offline query failed:", error);
              respondError(
                new Error("离线模式下无法执行此查询，请检查网络连接"),
              );
              break;
            }
          }

          // 在线模式：正常处理
          try {
            // 确保连接状态
            const connectionState = await ensureConnection();
            if (!connectionState.hasDb)
              throw new Error("Database not initialized");

            // 检查连接状态，如果我们认为未连接，先尝试重新连接
            if (!connectionState.isConnected) {
              console.log(
                "ServiceWorker: Query/mutate requested but not connected, attempting reconnection",
              );
              const reconnectionState = await ensureConnection();
              if (!reconnectionState.isConnected) {
                // 连接失败，切换到离线模式
                console.log(
                  "ServiceWorker: Connection failed, switching to offline mode",
                );

                if (type === "query") {
                  const result = await offlineManager!.executeOfflineQuery(
                    payload.sql,
                    payload.vars,
                  );
                  respond(result);
                } else {
                  const userId = await getCurrentUserId();
                  const caseId = payload.case_id;

                  const operationId =
                    await offlineManager!.queueOfflineOperation({
                      type: "query",
                      table: extractTableNameFromSQL(payload.sql) || "unknown",
                      sql: payload.sql,
                      params: payload.vars,
                      userId,
                      caseId,
                      maxRetries: 3,
                    });

                  respond({
                    success: true,
                    offline: true,
                    operationId,
                    message: "网络连接失败，操作已添加到离线队列",
                  });
                }
                break;
              }
            }

            // 确保 EnhancedQueryHandler 已初始化
            await ensureEnhancedQueryHandler();

            // 获取用户和案件信息
            const userId = await getCurrentUserId();
            const caseId = payload.case_id; // 从payload中获取案件ID

            // 使用 EnhancedQueryHandler 处理查询
            let result;
            if (type === "query") {
              result = await enhancedQueryHandler!.handleQuery(
                payload.sql,
                payload.vars,
                userId,
                caseId,
              );
            } else {
              result = await enhancedQueryHandler!.handleMutation(
                payload.sql,
                payload.vars,
                userId,
                caseId,
              );
            }

            // 记录性能日志
            const operationType = type === "query" ? "查询" : "变更";
            console.log(
              `ServiceWorker: ${operationType}完成 [${result.source}] 策略: ${result.strategy}, 响应时间: ${result.executionTime}ms, 缓存命中: ${result.cacheHit}`,
            );

            // 返回查询结果
            respond(result.data);
          } catch (error) {
            console.error(
              `ServiceWorker: Enhanced query handler failed for ${type}:`,
              error,
            );

            // 尝试离线降级处理
            try {
              if (type === "query") {
                console.log("ServiceWorker: Falling back to offline query");
                const result = await offlineManager!.executeOfflineQuery(
                  payload.sql,
                  payload.vars,
                );
                respond(result);
              } else {
                console.log(
                  "ServiceWorker: Falling back to offline queue for mutation",
                );
                const userId = await getCurrentUserId();
                const caseId = payload.case_id;

                const operationId = await offlineManager!.queueOfflineOperation(
                  {
                    type: "query",
                    table: extractTableNameFromSQL(payload.sql) || "unknown",
                    sql: payload.sql,
                    params: payload.vars,
                    userId,
                    caseId,
                    maxRetries: 3,
                  },
                );

                respond({
                  success: true,
                  offline: true,
                  operationId,
                  message: "操作失败，已添加到离线队列",
                });
              }
            } catch (offlineError) {
              console.error(
                "ServiceWorker: Offline fallback also failed:",
                offlineError,
              );
              respondError(error as Error);
            }
          }
          break;
        }

        case "create": {
          const operationStartTime = performance.now();
          const connectionState = await ensureConnection();
          if (!connectionState.hasDb)
            throw new Error("Database not initialized");

          const createResult = await db!.create(payload.thing, payload.data);

          const operationEndTime = performance.now();
          const responseTime =
            Math.round((operationEndTime - operationStartTime) * 100) / 100;
          console.log(
            `ServiceWorker: 创建完成 [远程] 表: ${payload.thing}, 响应时间: ${responseTime}ms, 数据源: RemoteDB`,
          );

          respond(createResult);
          break;
        }

        case "select": {
          const operationStartTime = performance.now();
          const connectionState = await ensureConnection();
          if (!connectionState.hasDb)
            throw new Error("Database not initialized");

          const selectResult = await db!.select(
            payload.thing as string | RecordId,
          );

          const operationEndTime = performance.now();
          const responseTime =
            Math.round((operationEndTime - operationStartTime) * 100) / 100;
          const resultCount = Array.isArray(selectResult)
            ? selectResult.length
            : selectResult
              ? 1
              : 0;
          console.log(
            `ServiceWorker: 查询完成 [远程] 记录: ${payload.thing}, 响应时间: ${responseTime}ms, 数据源: RemoteDB, 记录数: ${resultCount}`,
          );

          respond(selectResult);
          break;
        }

        case "update": {
          const operationStartTime = performance.now();
          const connectionState = await ensureConnection();
          if (!connectionState.hasDb)
            throw new Error("Database not initialized");

          const updateResult = await db!.update(
            payload.thing as string | RecordId,
            payload.data,
          );

          const operationEndTime = performance.now();
          const responseTime =
            Math.round((operationEndTime - operationStartTime) * 100) / 100;
          console.log(
            `ServiceWorker: 更新完成 [远程] 记录: ${payload.thing}, 响应时间: ${responseTime}ms, 数据源: RemoteDB`,
          );

          respond(updateResult);
          break;
        }

        case "merge": {
          const operationStartTime = performance.now();
          const connectionState = await ensureConnection();
          if (!connectionState.hasDb)
            throw new Error("Database not initialized");

          const mergeResult = await db!.merge(
            payload.thing as string | RecordId,
            payload.data,
          );

          const operationEndTime = performance.now();
          const responseTime =
            Math.round((operationEndTime - operationStartTime) * 100) / 100;
          console.log(
            `ServiceWorker: 合并完成 [远程] 记录: ${payload.thing}, 响应时间: ${responseTime}ms, 数据源: RemoteDB`,
          );

          respond(mergeResult);
          break;
        }

        case "delete": {
          const operationStartTime = performance.now();
          const connectionState = await ensureConnection();
          if (!connectionState.hasDb)
            throw new Error("Database not initialized");

          const deleteResult = await db!.delete(
            payload.thing as string | RecordId,
          );

          const operationEndTime = performance.now();
          const responseTime =
            Math.round((operationEndTime - operationStartTime) * 100) / 100;
          console.log(
            `ServiceWorker: 删除完成 [远程] 记录: ${payload.thing}, 响应时间: ${responseTime}ms, 数据源: RemoteDB`,
          );

          respond(deleteResult);
          break;
        }

        case "live": {
          const connectionState = await ensureConnection();
          if (!connectionState.hasDb)
            throw new Error("Database not initialized");
          const { query, vars } = payload;

          // For SurrealDB live queries, we need to run a query with variables, not use the live() method directly
          const queryWithVars = vars ? query : query;
          const uuid = await db!.live(queryWithVars, (action, result) => {
            const sub = liveQuerySubscriptions.get(String(uuid));
            if (sub) {
              broadcastToClients(
                {
                  type: "live_update",
                  payload: { uuid: String(uuid), action, result },
                },
                sub.clients,
              );
            }
          });

          const uuidStr = String(uuid);
          if (!liveQuerySubscriptions.has(uuidStr)) {
            liveQuerySubscriptions.set(uuidStr, {
              query,
              vars,
              clients: new Set(),
            });
          }
          liveQuerySubscriptions.get(uuidStr)!.clients.add(clientId);

          respond({ uuid: uuidStr });
          break;
        }

        case "kill": {
          const { uuid: killUuid } = payload;
          const subscription = liveQuerySubscriptions.get(killUuid);
          if (subscription) {
            subscription.clients.delete(clientId);
            if (subscription.clients.size === 0 && db) {
              await db.kill(killUuid);
              liveQuerySubscriptions.delete(killUuid);
              console.log(
                `ServiceWorker: Killed live query ${killUuid} as no clients are listening.`,
              );
            }
          }
          respond({ success: true });
          break;
        }

        case "setup_token_refresh": {
          // Token refresh is now handled automatically by TokenManager
          respond({ success: true });
          break;
        }

        case "clear_token_refresh": {
          // Token refresh clearing is now handled by TokenManager
          respond({ success: true });
          break;
        }

        case "refresh_token": {
          // Token refresh is now handled internally by TokenManager
          respond({
            success: false,
            message: "Token refresh is handled automatically",
          });
          break;
        }

        case "check_tenant_code": {
          const valid = await checkTenantCode();
          respond({ valid });
          break;
        }

        case "recover_tokens": {
          await ensureTokenManager();
          const token = await tokenManager!.getToken();
          respond({ success: !!token });
          break;
        }

        case "get_connection_state": {
          if (USE_SIMPLIFIED_CONNECTION_MANAGER) {
            // 🔧 使用简化连接管理器获取状态
            const state = getSimplifiedConnectionState();
            console.log(
              "🔧 SW get_connection_state (SimplifiedConnectionManager):",
              state,
            );
            respond(state);
          } else {
            // 🔄 使用原有逻辑
            const connectionState = await ensureConnection();
            respond({
              state: connectionState.state,
              isConnected: connectionState.isConnected,
              isAuthenticated: connectionState.isAuthenticated,
              hasDb: connectionState.hasDb,
              isReconnecting: isReconnecting,
              reconnectAttempts: reconnectAttempts,
              endpoint: connectionConfig?.endpoint,
              error: connectionState.error,
            });
          }
          break;
        }

        case "force_reconnect": {
          if (USE_SIMPLIFIED_CONNECTION_MANAGER) {
            // 🔧 使用简化连接管理器处理强制重连
            console.log(
              "ServiceWorker: Force reconnection requested by client (simplified manager)",
            );
            try {
              await forceReconnectWithSimplifiedManager();
              respond({ success: true });
            } catch (error) {
              console.error(
                "ServiceWorker: Simplified force reconnect failed:",
                error,
              );
              respond({ success: false, error: (error as Error).message });
            }
          } else {
            // 🔄 使用原有逻辑
            console.log(
              "ServiceWorker: Force reconnection requested by client",
            );
            stopConnectionHealthCheck();
            if (db) {
              try {
                await db.close();
                console.log(
                  "ServiceWorker: Closed connection for force reconnect",
                );
              } catch (e) {
                console.warn(
                  "ServiceWorker: Error closing connection during force reconnect:",
                  e,
                );
              }
            }
            isConnected = false;
            console.log(
              "ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 强制重连",
              {
                timestamp: new Date().toISOString(),
                previousState: true,
                newState: false,
                reason: "强制重连",
                dbStatus: db?.status,
                reconnectAttempts: reconnectAttempts,
                stackTrace: new Error().stack,
              },
            );
            stopReconnection();
            triggerReconnection();
            respond({ success: true });
          }
          break;
        }

        case "SKIP_WAITING": {
          console.log("ServiceWorker: 收到 SKIP_WAITING 消息，跳过等待");
          self.skipWaiting();
          respond({ success: true });
          break;
        }

        // 自动同步相关消息
        case "trigger_auto_sync": {
          await ensureDataCacheManager();
          const { userId, caseId } = payload;

          try {
            console.log(
              "ServiceWorker: Manual auto sync triggered for user:",
              userId,
            );
            await dataCacheManager!.autoSyncTables(userId, caseId);
            respond({
              success: true,
              message: "Auto sync completed successfully",
            });
          } catch (error) {
            console.error("ServiceWorker: Manual auto sync failed:", error);
            respond({ success: false, message: (error as Error).message });
          }
          break;
        }

        // 用户个人数据管理相关消息
        case "sync_user_personal_data": {
          try {
            await ensureDataCacheManager();
            const { personalData } = payload;

            // 更新认证状态（包含个人数据）
            await dataCacheManager!.updateAuthState(personalData);

            // 自动同步相关表
            try {
              await dataCacheManager!.autoSyncTables();
            } catch (syncError) {
              console.warn(
                "ServiceWorker: Failed to auto sync tables for user personal data:",
                syncError,
              );
            }

            respond({ success: true });
          } catch (error) {
            console.error(
              "ServiceWorker: Error in sync_user_personal_data:",
              error,
            );
            respond({ success: false, error: (error as Error).message });
          }
          break;
        }

        case "get_user_personal_data": {
          await ensureDataCacheManager();

          // 简化版本：返回当前认证状态
          const cacheStatus = dataCacheManager!.getCacheStatus();
          respond({ personalData: cacheStatus.hasAuth ? "Available" : null });
          break;
        }

        case "clear_user_personal_data": {
          await ensureDataCacheManager();

          await dataCacheManager!.clearAuthState();
          respond({ success: true });
          break;
        }

        // 页面感知订阅管理相关消息
        case "activate_page_subscription": {
          await ensurePageAwareSubscriptionManager();
          const { pagePath, userId, caseId, customRequirement } = payload;

          try {
            const pageId =
              await pageAwareSubscriptionManager!.activatePageSubscription(
                pagePath,
                userId,
                caseId,
                customRequirement,
              );
            respond({ success: true, pageId });
          } catch (error) {
            console.error(
              "ServiceWorker: Failed to activate page subscription:",
              error,
            );
            respond({ success: false, error: error.message });
          }
          break;
        }

        case "deactivate_page_subscription": {
          await ensurePageAwareSubscriptionManager();
          const { pageId } = payload;

          try {
            await pageAwareSubscriptionManager!.deactivatePageSubscription(
              pageId,
            );
            respond({ success: true });
          } catch (error) {
            console.error(
              "ServiceWorker: Failed to deactivate page subscription:",
              error,
            );
            respond({ success: false, error: error.message });
          }
          break;
        }

        case "update_page_access_time": {
          await ensurePageAwareSubscriptionManager();
          const { pageId } = payload;

          pageAwareSubscriptionManager!.updatePageAccessTime(pageId);
          respond({ success: true });
          break;
        }

        case "get_page_subscription_status": {
          await ensurePageAwareSubscriptionManager();
          const { pageId } = payload;

          const status =
            pageAwareSubscriptionManager!.getPageSubscriptionStatus(pageId);
          respond({ status });
          break;
        }

        case "get_subscription_debug_info": {
          await ensurePageAwareSubscriptionManager();

          const debugInfo = pageAwareSubscriptionManager!.getDebugInfo();
          respond({ debugInfo });
          break;
        }

        // 兼容性支持：保留原有的简化版页面数据订阅消息
        case "subscribe_page_data": {
          await ensurePageAwareSubscriptionManager();
          const { tables, userId, caseId, pagePath } = payload;

          try {
            // 如果提供了 pagePath，使用页面感知订阅
            if (pagePath) {
              const pageId =
                await pageAwareSubscriptionManager!.activatePageSubscription(
                  pagePath,
                  userId || "unknown",
                  caseId,
                  { requiredTables: tables },
                );
              respond({ success: true, pageId });
            } else {
              // 否则回退到简单的自动同步
              await ensureDataCacheManager();
              await dataCacheManager!.autoSyncTables();
              console.log(
                `ServiceWorker: Auto-synced tables for page data: ${tables.join(", ")}`,
              );
              respond({ success: true });
            }
          } catch (error) {
            console.warn(
              "ServiceWorker: Failed to process page data subscription:",
              error,
            );
            respond({ success: false, error: error.message });
          }
          break;
        }

        case "unsubscribe_page_data": {
          await ensurePageAwareSubscriptionManager();
          const { tables, pageId } = payload;

          try {
            // 如果提供了 pageId，使用页面感知取消订阅
            if (pageId) {
              await pageAwareSubscriptionManager!.deactivatePageSubscription(
                pageId,
              );
              respond({ success: true });
            } else {
              // 否则只是记录日志（兼容性）
              console.log(
                `ServiceWorker: Page data unsubscribe request processed for tables: ${tables.join(", ")}`,
              );
              respond({ success: true });
            }
          } catch (error) {
            console.warn(
              "ServiceWorker: Failed to process page data unsubscription:",
              error,
            );
            respond({ success: false, error: error.message });
          }
          break;
        }

        case "query_cached_data": {
          await ensureDataCacheManager();
          const { query, params } = payload;

          const data = await dataCacheManager!.query(query, params);
          respond({ data });
          break;
        }

        case "update_cached_data": {
          await ensureDataCacheManager();
          const { table, recordId, data, userId, caseId } = payload;

          const result = await dataCacheManager!.updateData(
            table,
            recordId,
            data,
            userId,
            caseId,
          );
          respond({ result });
          break;
        }

        case "clear_table_cache": {
          await ensureDataCacheManager();
          const { table, userId, caseId } = payload;

          await dataCacheManager!.clearTableCache(table, userId, caseId);
          respond({ success: true });
          break;
        }

        case "clear_all_cache": {
          await ensureDataCacheManager();
          await dataCacheManager!.clearAllCache();
          respond({ success: true });
          break;
        }

        case "cache_query_result": {
          await ensureDataCacheManager();
          const { table, result, userId, caseId } = payload;

          // 直接缓存查询结果
          await dataCacheManager!.cacheData(
            table,
            result,
            "temporary",
            userId,
            caseId,
          );

          respond({ success: true });
          break;
        }

        // 单个记录缓存相关消息（通用方法）
        case "cache_record": {
          await ensureDataCacheManager();
          const { table, recordId, record, cacheType, userId, caseId } =
            payload;
          await dataCacheManager!.cacheRecord(
            table,
            recordId,
            record,
            cacheType || "persistent",
            userId,
            caseId,
          );
          respond({ success: true });
          break;
        }

        case "get_cached_record": {
          await ensureDataCacheManager();
          const { table, recordId, userId, caseId } = payload;
          const record = await dataCacheManager!.getCachedRecord(
            table,
            recordId,
            userId,
            caseId,
          );
          respond({ record });
          break;
        }

        case "clear_cached_record": {
          await ensureDataCacheManager();
          const { table, recordId, userId, caseId } = payload;
          await dataCacheManager!.clearCachedRecord(
            table,
            recordId,
            userId,
            caseId,
          );
          respond({ success: true });
          break;
        }

        // 增量同步相关消息
        case "process_incremental_update": {
          await ensureDataCacheManager();
          const { update, conflictResolution } = payload;

          // 处理增量更新
          await processIncrementalUpdate(update, conflictResolution);

          respond({ success: true });
          break;
        }

        case "create_sync_record": {
          await ensureDataCacheManager();
          const { syncRecord } = payload;

          // 创建同步记录
          await createSyncRecord(syncRecord);

          respond({ success: true });
          break;
        }

        case "get_sync_record": {
          await ensureDataCacheManager();
          const { table, userId, caseId } = payload;

          // 获取同步记录
          const syncRecord = await getSyncRecord(table, userId, caseId);

          respond({ syncRecord });
          break;
        }

        case "update_sync_record": {
          await ensureDataCacheManager();
          const { syncRecordId, lastSyncTimestamp, lastSyncId, status } =
            payload;

          // 更新同步记录
          await updateSyncRecord(
            syncRecordId,
            lastSyncTimestamp,
            lastSyncId,
            status,
          );

          respond({ success: true });
          break;
        }

        case "update_sync_status": {
          await ensureDataCacheManager();
          const { syncRecordId, status, lastSyncTimestamp, errorMessage } =
            payload;

          // 更新同步状态
          await updateSyncStatus(
            syncRecordId,
            status,
            lastSyncTimestamp,
            errorMessage,
          );

          respond({ success: true });
          break;
        }

        case "clear_sync_records": {
          await ensureDataCacheManager();
          const { tables, userId, caseId } = payload;

          // 清除同步记录
          await clearSyncRecords(tables, userId, caseId);

          respond({ success: true });
          break;
        }

        // 双向同步相关消息
        case "persist_offline_queue": {
          await ensureDataCacheManager();
          const { syncKey, queue } = payload;

          // 持久化离线队列
          await persistOfflineQueue(syncKey, queue);

          respond({ success: true });
          break;
        }

        case "restore_offline_queue": {
          await ensureDataCacheManager();
          const { syncKey } = payload;

          // 恢复离线队列
          const queue = await restoreOfflineQueue(syncKey);

          respond({ queue });
          break;
        }

        case "clear_offline_queue": {
          await ensureDataCacheManager();
          const { syncKey } = payload;

          // 清除离线队列
          await clearOfflineQueue(syncKey);

          respond({ success: true });
          break;
        }

        // 新的缓存管理消息类型
        case "get_cache_stats": {
          await ensureEnhancedQueryHandler();

          try {
            const stats = enhancedQueryHandler!.getPerformanceStats();
            respond({
              success: true,
              stats: {
                ...stats,
                timestamp: Date.now(),
                version: SW_VERSION,
              },
            });
          } catch (error) {
            console.error("ServiceWorker: Failed to get cache stats:", error);
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "preload_cache": {
          await ensureEnhancedQueryHandler();

          try {
            const { tables, userId, caseId } = payload;

            if (!Array.isArray(tables) || tables.length === 0) {
              throw new Error("Tables array is required for cache preloading");
            }

            await enhancedQueryHandler!.preloadCache(tables, userId, caseId);

            respond({
              success: true,
              message: `Cache preloaded for ${tables.length} tables`,
              tables: tables,
            });
          } catch (error) {
            console.error("ServiceWorker: Failed to preload cache:", error);
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "get_subscription_status": {
          await ensureEnhancedQueryHandler();

          try {
            const subscriptionManager =
              enhancedQueryHandler!.getSubscriptionManager();
            const activeSubscriptions =
              subscriptionManager.getActiveSubscriptions();
            const syncStatus = subscriptionManager.getSyncStatus();
            const healthStatus = subscriptionManager.getHealthStatus();

            respond({
              success: true,
              subscriptionStatus: {
                activeSubscriptions: Array.from(
                  activeSubscriptions.entries(),
                ).map(([id, sub]) => ({
                  id,
                  table: sub.strategy.table,
                  type: sub.strategy.type,
                  userId: sub.userId,
                  caseId: sub.caseId,
                  isHealthy: sub.isHealthy,
                  lastSyncTime: sub.lastSyncTime,
                  subscriptionTime: sub.subscriptionTime,
                })),
                syncStatus: Array.from(syncStatus.entries()).map(
                  ([table, status]) => ({
                    table,
                    ...status,
                  }),
                ),
                healthStatus,
                timestamp: Date.now(),
              },
            });
          } catch (error) {
            console.error(
              "ServiceWorker: Failed to get subscription status:",
              error,
            );
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "configure_table_cache": {
          await ensureEnhancedQueryHandler();

          try {
            const { table, config } = payload;

            if (!table || typeof table !== "string") {
              throw new Error("Table name is required for cache configuration");
            }

            if (!config || typeof config !== "object") {
              throw new Error("Cache configuration object is required");
            }

            const queryRouter = enhancedQueryHandler!.getQueryRouter();
            queryRouter.updateTableProfile(table, config);

            respond({
              success: true,
              message: `Cache configuration updated for table: ${table}`,
              table,
              config,
            });
          } catch (error) {
            console.error(
              "ServiceWorker: Failed to configure table cache:",
              error,
            );
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        // 性能监控相关消息
        case "get_performance_report": {
          await ensureEnhancedQueryHandler();

          try {
            const { startTime, endTime } = payload;
            const performanceMonitor =
              enhancedQueryHandler!.getPerformanceMonitor();
            const report = performanceMonitor.generatePerformanceReport(
              startTime,
              endTime,
            );

            respond({
              success: true,
              report,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error(
              "ServiceWorker: Failed to get performance report:",
              error,
            );
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "get_performance_trend": {
          await ensureEnhancedQueryHandler();

          try {
            const { hours = 24 } = payload;
            const performanceMonitor =
              enhancedQueryHandler!.getPerformanceMonitor();
            const trendData = performanceMonitor.getPerformanceTrend(hours);

            respond({
              success: true,
              trendData,
              hours,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error(
              "ServiceWorker: Failed to get performance trend:",
              error,
            );
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "get_performance_anomalies": {
          await ensureEnhancedQueryHandler();

          try {
            const { hours = 24 } = payload;
            const performanceMonitor =
              enhancedQueryHandler!.getPerformanceMonitor();
            const anomalies = performanceMonitor.getAnomalies(hours);

            respond({
              success: true,
              anomalies,
              hours,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error(
              "ServiceWorker: Failed to get performance anomalies:",
              error,
            );
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "get_realtime_performance": {
          await ensureEnhancedQueryHandler();

          try {
            const performanceMonitor =
              enhancedQueryHandler!.getPerformanceMonitor();
            const realTimeStats = performanceMonitor.getRealTimeStats();

            respond({
              success: true,
              realTimeStats,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error(
              "ServiceWorker: Failed to get realtime performance:",
              error,
            );
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "export_performance_data": {
          await ensureEnhancedQueryHandler();

          try {
            const { format = "json" } = payload;
            const performanceMonitor =
              enhancedQueryHandler!.getPerformanceMonitor();
            const exportData = performanceMonitor.exportPerformanceData(format);

            respond({
              success: true,
              data: exportData,
              format,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error(
              "ServiceWorker: Failed to export performance data:",
              error,
            );
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "reset_performance_stats": {
          await ensureEnhancedQueryHandler();

          try {
            const performanceMonitor =
              enhancedQueryHandler!.getPerformanceMonitor();
            performanceMonitor.reset();

            respond({
              success: true,
              message: "Performance statistics have been reset",
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error(
              "ServiceWorker: Failed to reset performance stats:",
              error,
            );
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        // 缓存调试相关消息
        case "inspect_cache_state": {
          await ensureEnhancedQueryHandler();

          try {
            const { table } = payload;
            const cacheDebugger = enhancedQueryHandler!.getCacheDebugger();
            const inspection = await cacheDebugger.inspectCacheState(table);

            respond({
              success: true,
              inspection,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error(
              "ServiceWorker: Failed to inspect cache state:",
              error,
            );
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "trace_query_execution": {
          await ensureEnhancedQueryHandler();

          try {
            const { sql, params, userId, caseId } = payload;
            const cacheDebugger = enhancedQueryHandler!.getCacheDebugger();
            const trace = await cacheDebugger.traceQueryExecution(
              sql,
              params,
              userId,
              caseId,
            );

            respond({
              success: true,
              trace,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error(
              "ServiceWorker: Failed to trace query execution:",
              error,
            );
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "validate_cache_data": {
          await ensureEnhancedQueryHandler();

          try {
            const { table, forceRefresh = false } = payload;

            if (!table || typeof table !== "string") {
              throw new Error("Table name is required for cache validation");
            }

            const cacheDebugger = enhancedQueryHandler!.getCacheDebugger();
            const validation = await cacheDebugger.validateCacheData(
              table,
              forceRefresh,
            );

            respond({
              success: true,
              validation,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error(
              "ServiceWorker: Failed to validate cache data:",
              error,
            );
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "check_cache_content": {
          await ensureEnhancedQueryHandler();

          try {
            const { table } = payload;

            if (!table || typeof table !== "string") {
              throw new Error("Table name is required for cache content check");
            }

            const cacheDebugger = enhancedQueryHandler!.getCacheDebugger();
            const contentCheck = await cacheDebugger.checkCacheContent(table);

            respond({
              success: true,
              contentCheck,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error(
              "ServiceWorker: Failed to check cache content:",
              error,
            );
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "get_query_traces": {
          await ensureEnhancedQueryHandler();

          try {
            const { limit = 100 } = payload;
            const cacheDebugger = enhancedQueryHandler!.getCacheDebugger();
            const traces = cacheDebugger.getQueryTraces(limit);

            respond({
              success: true,
              traces,
              count: traces.length,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error("ServiceWorker: Failed to get query traces:", error);
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "export_debug_info": {
          await ensureEnhancedQueryHandler();

          try {
            const { includeTraces = true, includeValidation = true } = payload;
            const cacheDebugger = enhancedQueryHandler!.getCacheDebugger();
            const debugInfo = await cacheDebugger.exportDebugInfo(
              includeTraces,
              includeValidation,
            );

            respond({
              success: true,
              debugInfo,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error("ServiceWorker: Failed to export debug info:", error);
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        // 日志记录相关消息
        case "get_logs": {
          await ensureEnhancedQueryHandler();

          try {
            const { filter, limit = 1000 } = payload;
            const cacheLogger = enhancedQueryHandler!.getCacheLogger();
            const logs = cacheLogger.getLogs(filter, limit);

            respond({
              success: true,
              logs,
              count: logs.length,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error("ServiceWorker: Failed to get logs:", error);
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "analyze_logs": {
          await ensureEnhancedQueryHandler();

          try {
            const { startTime, endTime } = payload;
            const cacheLogger = enhancedQueryHandler!.getCacheLogger();
            const analysis = cacheLogger.analyzeLogs(startTime, endTime);

            respond({
              success: true,
              analysis,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error("ServiceWorker: Failed to analyze logs:", error);
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "export_logs": {
          await ensureEnhancedQueryHandler();

          try {
            const { format = "json", filter } = payload;
            const cacheLogger = enhancedQueryHandler!.getCacheLogger();
            const exportData = cacheLogger.exportLogs(format, filter);

            respond({
              success: true,
              data: exportData,
              format,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error("ServiceWorker: Failed to export logs:", error);
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "get_error_stats": {
          await ensureEnhancedQueryHandler();

          try {
            const cacheLogger = enhancedQueryHandler!.getCacheLogger();
            const errorStats = cacheLogger.getErrorStats();

            // 转换Map为普通对象以便序列化
            const statsArray = Array.from(errorStats.entries()).map(
              ([type, stats]) => ({
                errorType: type,
                count: stats.count,
                firstOccurrence: stats.firstOccurrence,
                lastOccurrence: stats.lastOccurrence,
                affectedUsers: Array.from(stats.affectedUsers),
                affectedTables: Array.from(stats.affectedTables),
                errorRate: stats.errorRate,
                avgFrequency: stats.avgFrequency,
                severity: stats.severity,
                sampleErrors: stats.sampleErrors.slice(0, 3), // 只返回前3个样本
              }),
            );

            respond({
              success: true,
              errorStats: statsArray,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error("ServiceWorker: Failed to get error stats:", error);
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "set_log_level": {
          await ensureEnhancedQueryHandler();

          try {
            const { level } = payload;

            if (typeof level !== "number" || level < 0 || level > 4) {
              throw new Error(
                "Invalid log level. Must be 0-4 (DEBUG, INFO, WARN, ERROR, CRITICAL)",
              );
            }

            const cacheLogger = enhancedQueryHandler!.getCacheLogger();
            cacheLogger.setLogLevel(level);

            respond({
              success: true,
              message: `Log level set to ${level}`,
              level,
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error("ServiceWorker: Failed to set log level:", error);
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        case "cleanup_logs": {
          await ensureEnhancedQueryHandler();

          try {
            const { maxAge } = payload;
            const cacheLogger = enhancedQueryHandler!.getCacheLogger();
            cacheLogger.cleanup(maxAge);

            respond({
              success: true,
              message: "Log cleanup completed",
              timestamp: Date.now(),
            });
          } catch (error) {
            console.error("ServiceWorker: Failed to cleanup logs:", error);
            respond({
              success: false,
              error: (error as Error).message,
            });
          }
          break;
        }

        // 离线管理相关消息
        case "get_offline_status": {
          await ensureOfflineManager();
          const isOffline = offlineManager!.isOffline();
          const networkStatus = offlineManager!.getNetworkStatus();
          const pendingOperations = offlineManager!.getPendingOperationsCount();
          const operationStats = offlineManager!.getOperationStats();

          respond({
            isOffline,
            networkStatus,
            pendingOperations,
            operationStats,
          });
          break;
        }

        case "queue_offline_operation": {
          await ensureOfflineManager();
          const { operation } = payload;
          const operationId =
            await offlineManager!.queueOfflineOperation(operation);
          respond({ operationId });
          break;
        }

        case "execute_offline_query": {
          await ensureOfflineManager();
          const { sql, params } = payload;
          try {
            const result = await offlineManager!.executeOfflineQuery(
              sql,
              params,
            );
            respond(result);
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "start_offline_sync": {
          await ensureOfflineManager();
          try {
            await offlineManager!.startAutoSync();
            respond({ success: true });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "clear_completed_operations": {
          await ensureOfflineManager();
          await offlineManager!.clearCompletedOperations();
          respond({ success: true });
          break;
        }

        case "clear_failed_operations": {
          await ensureOfflineManager();
          await offlineManager!.clearFailedOperations();
          respond({ success: true });
          break;
        }

        case "retry_failed_operations": {
          await ensureOfflineManager();
          await offlineManager!.retryFailedOperations();
          respond({ success: true });
          break;
        }

        // 连接恢复管理相关消息
        case "get_connection_stats": {
          await ensureConnectionRecoveryManager();
          const connectionState =
            connectionRecoveryManager!.getConnectionState();
          const connectionStats =
            connectionRecoveryManager!.getConnectionStats();

          respond({
            connectionState,
            connectionStats,
          });
          break;
        }

        case "retry_connection": {
          await ensureConnectionRecoveryManager();
          try {
            const success = await connectionRecoveryManager!.retryConnection();
            respond({ success });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "reset_connection_state": {
          await ensureConnectionRecoveryManager();
          connectionRecoveryManager!.resetConnectionState();
          respond({ success: true });
          break;
        }

        // 数据一致性管理相关消息
        case "validate_data_integrity": {
          await ensureDataConsistencyManager();
          const { table, data } = payload;
          try {
            const result = await dataConsistencyManager!.validateDataIntegrity(
              table,
              data,
            );
            respond(result);
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "detect_data_conflict": {
          await ensureDataConsistencyManager();
          const { table, recordId, localData, remoteData } = payload;
          try {
            const conflict = await dataConsistencyManager!.detectConflict(
              table,
              recordId,
              localData,
              remoteData,
            );
            respond({ conflict });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "resolve_data_conflict": {
          await ensureDataConsistencyManager();
          const { conflictId, strategy, manualData } = payload;
          try {
            const resolvedData = await dataConsistencyManager!.resolveConflict(
              conflictId,
              strategy,
              manualData,
            );
            respond({ resolvedData });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "get_data_conflicts": {
          await ensureDataConsistencyManager();
          const conflicts = dataConsistencyManager!.getConflicts();
          const unresolvedConflicts =
            dataConsistencyManager!.getUnresolvedConflicts();

          respond({
            allConflicts: conflicts,
            unresolvedConflicts,
          });
          break;
        }

        case "clear_resolved_conflicts": {
          await ensureDataConsistencyManager();
          dataConsistencyManager!.clearResolvedConflicts();
          respond({ success: true });
          break;
        }

        case "begin_transaction": {
          await ensureDataConsistencyManager();
          const { transactionId } = payload;
          try {
            await dataConsistencyManager!.beginTransaction(transactionId);
            respond({ success: true });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "commit_transaction": {
          await ensureDataConsistencyManager();
          const { transactionId } = payload;
          try {
            await dataConsistencyManager!.commitTransaction(transactionId);
            respond({ success: true });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "rollback_transaction": {
          await ensureDataConsistencyManager();
          const { transactionId } = payload;
          try {
            await dataConsistencyManager!.rollbackTransaction(transactionId);
            respond({ success: true });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "static_cache_update": {
          await ensureStaticCacheManager();
          const { strategyName } = payload;
          try {
            await staticCacheManager!.updateCache(strategyName);
            respond({ success: true });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "static_cache_clear": {
          await ensureStaticCacheManager();
          try {
            await staticCacheManager!.clearOldCaches();
            respond({ success: true });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "static_cache_status": {
          await ensureStaticCacheManager();
          try {
            const status = staticCacheManager!.getCacheStatus();
            respond({ status });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "get_network_state": {
          await ensureNetworkStateManager();
          try {
            const state = networkStateManager!.getCurrentState();
            respond({ state });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "check_network_state": {
          await ensureNetworkStateManager();
          try {
            const state = await networkStateManager!.checkNetworkStatus();
            respond({ state });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "test_connection_quality": {
          await ensureNetworkStateManager();
          try {
            const quality = await networkStateManager!.testConnectionQuality();
            respond({ quality });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "show_notification": {
          try {
            const notificationData = payload as NotificationPayload;

            await self.registration.showNotification(notificationData.title, {
              body: notificationData.body,
              icon: notificationData.icon,
              badge: notificationData.badge,
              image: notificationData.image,
              tag: notificationData.tag,
              data: notificationData.data,
              actions: notificationData.actions,
              requireInteraction: notificationData.requireInteraction || false,
              silent: notificationData.silent || false,
            });

            respond({ success: true });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "get_notification_permission": {
          try {
            // Service Workers 无法直接检查权限，返回信息让客户端处理
            respond({
              needsClientCheck: true,
              message: "Permission check must be done on client side",
            });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "set_collaboration_user": {
          await ensurePWACollaborationEnhancer();
          try {
            const { userId, userName } = payload;
            pwaCollaborationEnhancer!.setUserInfo(userId, userName);
            respond({ success: true });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "enhance_live_query": {
          await ensurePWACollaborationEnhancer();
          try {
            const { query, vars } = payload;
            const uuid = await pwaCollaborationEnhancer!.enhanceLiveQuery(
              query,
              vars,
            );
            respond({ uuid });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "handle_collaboration_event": {
          await ensurePWACollaborationEnhancer();
          try {
            const event = payload as CollaborationEvent;
            await pwaCollaborationEnhancer!.handleCollaborationEvent(event);
            respond({ success: true });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "get_performance_metrics": {
          await ensurePWAPerformanceManager();
          try {
            const metrics = pwaPerformanceManager!.getPerformanceMetrics();
            respond({ metrics });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "get_app_shell_state": {
          await ensurePWAPerformanceManager();
          try {
            const state = pwaPerformanceManager!.getAppShellState();
            respond({ state });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "preload_resources": {
          await ensurePWAPerformanceManager();
          try {
            const { urls } = payload;
            await pwaPerformanceManager!.preloadResources(urls);
            respond({ success: true });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "force_memory_cleanup": {
          await ensurePWAPerformanceManager();
          try {
            await pwaPerformanceManager!.forceMemoryCleanup();
            respond({ success: true });
          } catch (error) {
            respondError(error as Error);
          }
          break;
        }

        case "debug_tokenmanager_init": {
          try {
            console.log(
              "ServiceWorker: Debug TokenManager initialization request",
            );

            // 检查当前状态
            const currentState = {
              tokenManagerExists: !!tokenManager,
              tokenManagerInitialized: tokenManager?.initialized || false,
              localDbExists: !!localDb,
              localDbInitialized: isLocalDbInitialized,
            };

            console.log(
              "ServiceWorker: Current TokenManager state:",
              currentState,
            );

            // 尝试初始化
            try {
              await ensureTokenManager();
              respond({
                success: true,
                beforeState: currentState,
                afterState: {
                  tokenManagerExists: !!tokenManager,
                  tokenManagerInitialized: tokenManager?.initialized || false,
                  localDbExists: !!localDb,
                  localDbInitialized: isLocalDbInitialized,
                },
              });
            } catch (initError) {
              console.error(
                "ServiceWorker: TokenManager init failed:",
                initError,
              );
              respond({
                success: false,
                error: (initError as Error).message,
                stack: (initError as Error).stack,
                currentState,
              });
            }
          } catch (error) {
            console.error(
              "ServiceWorker: Debug TokenManager init error:",
              error,
            );
            respondError(error as Error);
          }
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
  },
};

// 立即注册事件监听器
self.addEventListener("install", eventHandlers.install);
self.addEventListener("activate", eventHandlers.activate);
self.addEventListener("beforeunload", eventHandlers.beforeunload);
self.addEventListener("push", eventHandlers.push);
self.addEventListener("notificationclick", eventHandlers.notificationclick);
self.addEventListener("notificationclose", eventHandlers.notificationclose);
self.addEventListener("fetch", eventHandlers.fetch);
self.addEventListener("message", eventHandlers.message);

console.log("Service Worker event listeners registered");

import { Surreal, RecordId, ConnectionStatus, StringRecordId } from "surrealdb";
import { TokenManager, TokenInfo } from "./token-manager";
import { DataCacheManager } from "./data-cache-manager";
import { EnhancedQueryHandler } from "./enhanced-query-handler";
import { PageAwareSubscriptionManager } from "./page-aware-subscription-manager";
import { OfflineManager } from "./offline-manager";
import { ConnectionRecoveryManager } from "./connection-recovery-manager";
import { DataConsistencyManager } from "./data-consistency-manager";

// 获取WASM引擎的函数
async function getWasmEngines() {
  // 等待__surrealdbWasmEngines 加载
  let retryCount = 0;
  const maxRetries = 50; // 最多等待 5 秒（50 * 100ms）

  while (!(self as any).__surrealdbWasmEngines && retryCount < maxRetries) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    retryCount++;
  }

  if (!(self as any).__surrealdbWasmEngines) {
    throw new Error("WASM engines not loaded after waiting");
  }

  return (self as any).__surrealdbWasmEngines();
}

// SurrealDB WASM 相关常量（现在已通过 ES 模块导入，无需外部 URL）

// Define AnyAuth type based on SurrealDB
export type AnyAuth =
  | {
      username: string;
      password: string;
    }
  | {
      token: string;
    }
  | {
      namespace: string;
      database: string;
      scope: string;
      [key: string]: unknown;
    };

// --- Global State ---
// 远程 SurrealDB 实例 (单例)
let db: Surreal;
// 本地 SurrealDB WASM 实例 (单例)
let localDb: Surreal | null = null;
let tokenManager: TokenManager | null = null;
let dataCacheManager: DataCacheManager | null = null;
// 增强查询处理器实例
let enhancedQueryHandler: EnhancedQueryHandler | null = null;
// 页面感知订阅管理器实例
let pageAwareSubscriptionManager: PageAwareSubscriptionManager | null = null;
// 离线管理器实例
let offlineManager: OfflineManager | null = null;
// 连接恢复管理器实例
let connectionRecoveryManager: ConnectionRecoveryManager | null = null;
// 数据一致性管理器实例
let dataConsistencyManager: DataConsistencyManager | null = null;

let isConnected = false;
let isLocalDbInitialized = false;
let connectionConfig: {
  endpoint: string;
  namespace: string;
  database: string;
  auth?: AnyAuth;
} | null = null;

// --- 认证状态缓存管理 ---
interface AuthState {
  userId: string | null;
  isAuthenticated: boolean;
  lastUpdated: number;
  expiresAt: number;
}

let authStateCache: AuthState | null = null;
let authStateTimer: NodeJS.Timeout | null = null;
const AUTH_CACHE_DURATION = 30000; // 30秒缓存有效期
const AUTH_REFRESH_INTERVAL = 25000; // 25秒刷新间隔

// 防抖：用于避免过度频繁的认证状态变化广播
let lastAuthStateBroadcast: {
  isAuthenticated: boolean;
  timestamp: number;
} | null = null;
const AUTH_BROADCAST_DEBOUNCE_TIME = 5000; // 5秒防抖间隔

// Live query management
const liveQuerySubscriptions = new Map<
  string,
  {
    query: string;
    vars?: Record<string, unknown>;
    clients: Set<string>; // Set of client IDs
  }
>();

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

// --- 认证状态缓存管理函数 ---

/**
 * 启动认证状态定期刷新
 */
function startAuthStateRefresh() {
  stopAuthStateRefresh(); // 先停止现有的定时器

  authStateTimer = setInterval(async () => {
    try {
      if (isConnected && db) {
        await refreshAuthStateCache();
      }
    } catch (error) {
      console.warn("ServiceWorker: Auth state refresh failed:", error);
    }
  }, AUTH_REFRESH_INTERVAL);

  console.log("ServiceWorker: Auth state refresh timer started");
}

/**
 * 停止认证状态定期刷新
 */
function stopAuthStateRefresh() {
  if (authStateTimer) {
    clearInterval(authStateTimer);
    authStateTimer = null;
    console.log("ServiceWorker: Auth state refresh timer stopped");
  }
}

/**
 * 等待 TokenManager 初始化完成后刷新认证状态缓存
 */
async function waitForTokenManagerAndRefreshAuth(): Promise<void> {
  try {
    // 等待 TokenManager 初始化完成
    const maxWaitTime = 5000; // 最大等待 5 秒
    const checkInterval = 50; // 每 50ms 检查一次
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        await ensureTokenManager();
        // 如果成功获取到 TokenManager，则跳出循环
        break;
      } catch (error) {
        // TokenManager 还未初始化，继续等待
        await new Promise((resolve) => setTimeout(resolve, checkInterval));
      }
    }

    // 再次尝试获取 TokenManager
    await ensureTokenManager();

    // TokenManager 已经初始化，现在可以安全地刷新认证状态缓存
    console.log(
      "ServiceWorker: TokenManager initialized, refreshing auth cache",
    );
    await refreshAuthStateCache();
  } catch (error) {
    console.warn(
      "ServiceWorker: Failed to wait for TokenManager or refresh auth cache:",
      error,
    );
    // 如果 TokenManager 初始化失败，仍然尝试刷新缓存（但可能会失败）
    try {
      await refreshAuthStateCache();
    } catch (refreshError) {
      console.warn(
        "ServiceWorker: Fallback auth cache refresh also failed:",
        refreshError,
      );
    }
  }
}

/**
 * 刷新认证状态缓存
 */
async function refreshAuthStateCache(): Promise<void> {
  try {
    if (!db || !isConnected) {
      clearAuthStateCache();
      return;
    }

    const result = await Promise.race([
      db.query("RETURN $auth;"),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Auth refresh timeout")), 3000),
      ),
    ]);

    let authResult = null;
    if (Array.isArray(result) && result.length > 0) {
      authResult = result[0];
    } else {
      authResult = result;
    }

    const isAuthenticated =
      authResult && typeof authResult === "object" && authResult !== null;
    const userId = isAuthenticated
      ? String((authResult as any).id || null)
      : null;

    const now = Date.now();
    authStateCache = {
      userId,
      isAuthenticated,
      lastUpdated: now,
      expiresAt: now + AUTH_CACHE_DURATION,
    };

    console.log("ServiceWorker: Auth state cache refreshed", {
      userId: userId ? `${userId.substring(0, 10)}...` : null,
      isAuthenticated,
    });
  } catch (error) {
    console.warn("ServiceWorker: Failed to refresh auth state cache:", error);
    // 在刷新失败时，保持现有缓存但标记为过期
    if (authStateCache) {
      authStateCache.expiresAt = Date.now() - 1; // 标记为过期
    }
  }
}

/**
 * 清除认证状态缓存
 */
function clearAuthStateCache(): void {
  authStateCache = null;
  console.log("ServiceWorker: Auth state cache cleared");
}

/**
 * 获取缓存的认证状态
 */
function getCachedAuthState(): AuthState | null {
  if (!authStateCache) {
    return null;
  }

  // 检查缓存是否过期
  if (Date.now() > authStateCache.expiresAt) {
    console.log("ServiceWorker: Auth state cache expired");
    return null;
  }

  return authStateCache;
}

/**
 * 强制更新认证状态缓存
 */
async function updateAuthStateCache(
  userId: string | null,
  isAuthenticated: boolean,
): Promise<void> {
  const now = Date.now();
  // 确保 isAuthenticated 是明确的 boolean 值
  const authenticatedBool = Boolean(isAuthenticated);

  authStateCache = {
    userId,
    isAuthenticated: authenticatedBool,
    lastUpdated: now,
    expiresAt: now + AUTH_CACHE_DURATION,
  };

  console.log("ServiceWorker: Auth state cache updated", {
    userId: userId ? `${userId.substring(0, 10)}...` : null,
    isAuthenticated: authenticatedBool,
  });
}

/**
 * 防抖的认证状态广播
 */
function broadcastAuthStateChange(
  isAuthenticated: boolean,
  reason: string = "query_check",
): void {
  const now = Date.now();

  // 检查是否需要防抖
  if (
    lastAuthStateBroadcast &&
    lastAuthStateBroadcast.isAuthenticated === isAuthenticated &&
    now - lastAuthStateBroadcast.timestamp < AUTH_BROADCAST_DEBOUNCE_TIME
  ) {
    console.log("ServiceWorker: Auth state broadcast skipped (debounced)");
    return;
  }

  // 更新最后广播时间
  lastAuthStateBroadcast = {
    isAuthenticated,
    timestamp: now,
  };

  console.log("ServiceWorker: Broadcasting auth state change:", {
    isAuthenticated,
    reason,
  });
  broadcastToAllClients({
    type: "auth_state_changed",
    payload: {
      isAuthenticated,
      reason,
      timestamp: now,
    },
  });
}

// --- Helper Functions for Event Handlers ---

/**
 * 检查是否为用户个人数据查询
 */
function isPersonalDataQuery(sql: string, tableNames: string[]): boolean {
  // 检查是否包含认证检查
  const hasAuthCheck = sql.includes("return $auth");
  if (!hasAuthCheck) return false;

  // 检查是否涉及个人数据相关的表或关系
  const personalDataPatterns = [
    "operation_metadata", // 操作权限
    "menu_metadata", // 菜单权限
    "has_role", // 用户角色关系
    "has_case_role", // 用户案件角色关系
  ];

  // 检查SQL中是否包含个人数据相关的表名或关系
  const sqlLower = sql.toLowerCase();
  return personalDataPatterns.some(
    (pattern) => sqlLower.includes(pattern) || tableNames.includes(pattern),
  );
}

/**
 * 从查询结果中提取个人数据组件
 */
function extractPersonalDataComponent(
  sql: string,
  result: any,
): { type: string; data: any } | null {
  const sqlLower = sql.toLowerCase();

  // 检查认证状态（第一个结果应该是认证检查）
  if (!Array.isArray(result) || result.length === 0) {
    return null;
  }

  const authResult = result[0];
  if (!authResult || authResult.length === 0) {
    console.warn(
      "ServiceWorker: Authentication failed for personal data query",
    );
    return null;
  }

  // 获取实际查询结果（从索引1开始）
  const actualResult = result.slice(1);
  if (!actualResult || actualResult.length === 0) {
    return null;
  }

  // 根据查询类型识别数据组件
  if (sqlLower.includes("operation_metadata")) {
    return {
      type: "operations",
      data: actualResult[0] || [],
    };
  } else if (sqlLower.includes("menu_metadata")) {
    return {
      type: "menus",
      data: actualResult[0] || [],
    };
  } else if (
    sqlLower.includes("has_role") &&
    !sqlLower.includes("has_case_role")
  ) {
    return {
      type: "globalRoles",
      data: actualResult[0] || [],
    };
  } else if (sqlLower.includes("has_case_role")) {
    return {
      type: "caseRoles",
      data: actualResult[0] || [],
    };
  }

  return null;
}

/**
 * 通知客户端连接状态变化
 */
function notifyConnectionStateChange(error?: Error) {
  // 优先使用我们维护的连接状态，而不是 db.status
  const currentState = isConnected ? "connected" : "disconnected";
  const dbStatus = db?.status || ConnectionStatus.Disconnected;

  console.log(
    `ServiceWorker: Connection state is ${currentState} (isConnected=${isConnected}, db.status=${dbStatus})`,
  );

  // 通知所有客户端连接状态变化
  broadcastToAllClients({
    type: "connection_state_changed",
    payload: {
      state: currentState,
      isConnected: isConnected,
      dbStatus: dbStatus,
      error: error?.message,
      timestamp: Date.now(),
    },
  });
}

/**
 * 停止连接健康检查
 */
function stopConnectionHealthCheck() {
  if (connectionHealthCheck) {
    clearInterval(connectionHealthCheck);
    connectionHealthCheck = null;
    console.log("ServiceWorker: Connection health check stopped");
  }
}

/**
 * 开始连接健康检查
 */
function startConnectionHealthCheck() {
  stopConnectionHealthCheck(); // 先停止现有的检查

  connectionHealthCheck = setInterval(async () => {
    try {
      // 只有在我们认为已连接时才进行健康检查
      if (!isConnected) {
        console.log(
          "ServiceWorker: Skipping health check - isConnected is false",
        );
        return;
      }

      // 使用更轻量的连接测试
      if (!db) {
        console.warn("ServiceWorker: Health check - db instance not available");
        const previousState = isConnected;
        isConnected = false;
        console.log(
          "ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 健康检查中db实例不可用",
          {
            timestamp: new Date().toISOString(),
            previousState: previousState,
            newState: false,
            reason: "健康检查中db实例不可用",
            reconnectAttempts: reconnectAttempts,
            stackTrace: new Error().stack,
          },
        );
        notifyConnectionStateChange();
        triggerReconnection();
        return;
      }

      // 🔧 增强的连接状态检测
      try {
        // 首先检查 SurrealDB 内部连接状态
        const dbStatus = db.status;
        if (dbStatus !== ConnectionStatus.Connected) {
          console.warn(
            "ServiceWorker: Health check - DB status indicates disconnection:",
            dbStatus,
          );
          const wasConnected = isConnected;
          isConnected = false;
          console.log(
            "ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: DB状态检查显示断开连接",
            {
              timestamp: new Date().toISOString(),
              previousState: wasConnected,
              newState: false,
              dbStatus,
              reason: "DB状态检查显示断开连接",
              stackTrace: new Error().stack,
            },
          );
          notifyConnectionStateChange();
          triggerReconnection();
          return;
        }

        // 执行心跳查询测试
        const startTime = Date.now();
        const testResult = await Promise.race([
          db.query("return 1;"),
          new Promise(
            (_, reject) =>
              setTimeout(() => reject(new Error("Health check timeout")), 3000), // 缩短超时时间
          ),
        ]);
        const endTime = Date.now();
        const latency = endTime - startTime;

        if (testResult) {
          // 连接正常，保持现有状态并存储延迟
          console.log(
            "ServiceWorker: Health check passed - connection is healthy, latency:",
            latency + "ms",
          );

          // 存储延迟数据并通知页面
          await self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
              client.postMessage({
                type: "network_latency_update",
                payload: {
                  latency,
                  timestamp: endTime,
                  connectionQuality:
                    latency < 100
                      ? "excellent"
                      : latency < 300
                        ? "good"
                        : latency < 1000
                          ? "fair"
                          : "poor",
                },
              });
            });
          });
        }
      } catch (testError) {
        console.warn(
          "ServiceWorker: Health check failed - connection appears broken:",
          testError,
        );

        // 🔧 区分不同类型的连接错误
        const errorMessage =
          testError instanceof Error ? testError.message : String(testError);
        const isTimeoutError = errorMessage.includes("timeout");
        const isNetworkError =
          errorMessage.includes("network") ||
          errorMessage.includes("WebSocket");

        // 健康检查失败，更新连接状态
        const previousState = isConnected;
        isConnected = false;
        console.log(
          "ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 健康检查失败",
          {
            timestamp: new Date().toISOString(),
            previousState: previousState,
            newState: false,
            reason: "健康检查失败",
            error: testError,
            errorType: isTimeoutError
              ? "timeout"
              : isNetworkError
                ? "network"
                : "other",
            dbStatus: db?.status,
            reconnectAttempts: reconnectAttempts,
            stackTrace: new Error().stack,
          },
        );
        notifyConnectionStateChange();

        // 对于超时和网络错误，立即触发重连
        if (isTimeoutError || isNetworkError) {
          console.log(
            "ServiceWorker: Detected potential WebSocket disconnect, triggering immediate reconnection",
          );
        }

        // 触发重连
        if (!isReconnecting) {
          triggerReconnection();
        }
      }
    } catch (error) {
      console.error("ServiceWorker: Health check error:", error);
      // 健康检查本身出错，认为连接有问题
      const previousState = isConnected;
      isConnected = false;
      console.log(
        "ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 健康检查异常",
        {
          timestamp: new Date().toISOString(),
          previousState: previousState,
          newState: false,
          reason: "健康检查异常",
          error: error,
          dbStatus: db?.status,
          reconnectAttempts: reconnectAttempts,
          stackTrace: new Error().stack,
        },
      );
      notifyConnectionStateChange();

      if (!isReconnecting) {
        triggerReconnection();
      }
    }
  }, 15000); // 每15秒检查一次，更频繁检测

  console.log("ServiceWorker: Connection health check started");
}

/**
 * 彻底重建数据库实例
 * 当检测到db.status状态不一致或多次重连失败时调用
 */
async function recreateDatabaseInstance(): Promise<void> {
  console.log("ServiceWorker: Starting database instance recreation...");

  try {
    // 停止所有连接相关的活动
    stopConnectionHealthCheck();
    stopReconnection();

    // 彻底关闭并销毁现有的数据库实例
    if (db) {
      try {
        console.log(
          "ServiceWorker: Closing existing database instance for recreation...",
        );
        await db.close();
        console.log("ServiceWorker: Database instance closed successfully");
      } catch (closeError) {
        console.warn(
          "ServiceWorker: Error closing database during recreation:",
          closeError,
        );
      }
    }

    // 清除数据库实例引用，强制重新创建
    db = null as any;

    // 重置所有连接状态
    isConnected = false;
    isReconnecting = false;
    connecting = false;

    console.log(
      "ServiceWorker: [连接状态变更] 数据库对象完全重建 - 所有状态已重置",
      {
        timestamp: new Date().toISOString(),
        reason: "内部数据库重建",
        resetStates: {
          isConnected: false,
          isReconnecting: false,
          connecting: false,
          db: null,
        },
      },
    );

    // 重新初始化数据库实例
    await initializeSurreal();
    console.log("ServiceWorker: New database instance created successfully");

    // 如果有连接配置，立即尝试连接
    if (connectionConfig) {
      await connectWithTimeout();
      console.log(
        "ServiceWorker: Database recreated and reconnected successfully",
      );
    }
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to recreate database instance:",
      error,
    );
    throw error;
  }
}

/**
 * 计算重连延迟（指数退避，但有最大值限制）
 */
function calculateReconnectDelay(): number {
  const delay = Math.min(
    RECONNECT_DELAY_BASE * Math.pow(2, Math.min(reconnectAttempts, 6)), // 最多 64 倍基础延迟
    RECONNECT_DELAY_MAX,
  );
  return delay;
}

/**
 * 触发重连
 */
function triggerReconnection() {
  if (isReconnecting) {
    console.log("ServiceWorker: Reconnection already in progress, skipping");
    return;
  }

  isReconnecting = true;
  notifyConnectionStateChange();

  // 立即尝试重连（第一次重连延迟很小）
  const delay =
    reconnectAttempts === 0 ? RECONNECT_DELAY_BASE : calculateReconnectDelay();

  console.log(
    `ServiceWorker: Scheduling reconnection attempt ${reconnectAttempts + 1} in ${delay}ms`,
  );

  reconnectTimer = setTimeout(async () => {
    await performReconnection().finally(() => (isReconnecting = false));
  }, delay);
}

/**
 * 执行重连
 */
async function performReconnection() {
  if (!connectionConfig) {
    console.error(
      "ServiceWorker: Cannot reconnect - no connection config available",
    );
    isReconnecting = false;
    notifyConnectionStateChange();
    return;
  }

  // 如果我们认为连接正常，但实际上需要重连，则跳过状态检查
  if (isConnected && db?.status === ConnectionStatus.Connected) {
    console.log(
      "ServiceWorker: Skipping reconnection - connection appears healthy",
    );
    return;
  }

  reconnectAttempts++;
  console.log(
    `ServiceWorker: Attempting reconnection #${reconnectAttempts} to ${connectionConfig.endpoint}`,
  );

  // 智能检测：当重连次数达到一定阈值时，考虑重建数据库对象
  const shouldRecreateDatabase =
    reconnectAttempts >= 3 &&
    (!db ||
      (db?.status === ConnectionStatus.Disconnected && isConnected === true) || // 状态不一致
      (db?.status === ConnectionStatus.Connected && isConnected === false) || // 状态不一致
      db?.status === ConnectionStatus.Error);

  if (shouldRecreateDatabase) {
    console.log(
      "ServiceWorker: Detected connection state inconsistency or multiple failures, recreating database object...",
    );
    try {
      // 彻底重建数据库对象
      await recreateDatabaseInstance();
      // 重连成功后重置计数器
      reconnectAttempts = 0;
      isReconnecting = false;
      console.log(
        "ServiceWorker: Database recreation and reconnection successful",
      );
      notifyConnectionStateChange();
      startConnectionHealthCheck();
      await resubscribeAllLiveQueries();
      return;
    } catch (recreateError) {
      console.error(
        "ServiceWorker: Database recreation failed:",
        recreateError,
      );
      // 如果重建失败，继续尝试常规重连
    }
  }

  try {
    // 清理当前连接
    if (db) {
      try {
        await db.close();
        console.log(
          "ServiceWorker: Closed existing connection for reconnection",
        );
      } catch (e) {
        console.warn(
          "ServiceWorker: Error closing connection during reconnection:",
          e,
        );
      }
    }

    // 明确设置为断开状态
    const previousState = isConnected;
    isConnected = false;
    console.log(
      "ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 重连前状态重置",
      {
        timestamp: new Date().toISOString(),
        previousState: previousState,
        newState: false,
        reason: "重连前状态重置",
        reconnectAttempts: reconnectAttempts,
        dbStatus: db?.status,
        stackTrace: new Error().stack,
      },
    );

    // 确保数据库实例存在（使用单例模式）
    await initializeSurreal();

    // 设置连接超时（连接成功时，connectWithTimeout内部会设置isConnected=true）
    const connectPromise = connectWithTimeout();
    await connectPromise;

    // 重连成功 - isConnected已经在connectWithTimeout中设置为true了
    reconnectAttempts = 0;
    isReconnecting = false;

    console.log(
      "ServiceWorker: Reconnection successful, isConnected state:",
      isConnected,
    );
    notifyConnectionStateChange();
    startConnectionHealthCheck();

    // 重新订阅所有 Live Query
    await resubscribeAllLiveQueries();
  } catch (error) {
    console.error(
      `ServiceWorker: Reconnection attempt #${reconnectAttempts} failed:`,
      error,
    );

    // 如果还需要继续重连
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      isReconnecting = false;

      // 立即触发下一次重连
      triggerReconnection();
    } else {
      // 达到最大重连次数
      isReconnecting = false;
      notifyConnectionStateChange(error as Error);
      console.error("ServiceWorker: Max reconnection attempts reached");
    }
  }
}

/**
 * 带超时的连接函数
 */
async function connectWithTimeout(): Promise<void> {
  if (!connectionConfig) {
    throw new Error("No connection config available");
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Connection timeout"));
    }, CONNECTION_TIMEOUT);

    const doConnect = async () => {
      try {
        const conn = await db!.connect(connectionConfig!.endpoint);
        console.log("ServiceWorker: connect resp:", conn);

        // 连接成功，更新状态
        isConnected = true;
        console.log(
          "ServiceWorker: Connection established, isConnected set to true",
        );

        await db!.use({
          namespace: connectionConfig!.namespace,
          database: connectionConfig!.database,
        });

        // 更新 EnhancedQueryHandler 及其组件的远程数据库引用
        updateEnhancedQueryHandlerRemoteDb();

        // 重新认证
        await ensureTokenManager();
        const token = await tokenManager!.getToken();

        if (token && token.access_token) {
          await db!.authenticate(token.access_token);
          console.log(
            "ServiceWorker: Re-authenticated successfully during reconnection",
          );

          // 认证成功后，立即刷新认证状态缓存
          try {
            await refreshAuthStateCache();
          } catch (cacheError) {
            console.warn(
              "ServiceWorker: Failed to refresh auth cache after re-authentication:",
              cacheError,
            );
          }

          // Token refresh is now handled automatically by TokenManager
        }

        clearTimeout(timeout);
        resolve();
      } catch (error) {
        // 连接失败，确保状态正确
        const previousState = isConnected;
        isConnected = false;
        console.log(
          "ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 连接失败",
          {
            timestamp: new Date().toISOString(),
            previousState: previousState,
            newState: false,
            reason: "连接失败",
            error: error,
            connectionConfig: connectionConfig,
            stackTrace: new Error().stack,
          },
        );
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
    console.warn(
      "ServiceWorker: Cannot setup connection event listeners - db or emitter not available",
    );
    return;
  }

  // 监听连接状态变化
  db.emitter.subscribe("disconnected", () => {
    console.warn(
      "ServiceWorker: Database connection lost (disconnected event)",
    );
    const wasConnected = isConnected;
    isConnected = false;
    console.log(
      "ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 数据库断开连接事件",
      {
        timestamp: new Date().toISOString(),
        previousState: wasConnected,
        newState: false,
        reason: "数据库断开连接事件",
        dbStatus: db?.status,
        reconnectAttempts: reconnectAttempts,
        stackTrace: new Error().stack,
      },
    );

    if (wasConnected) {
      console.log(
        "ServiceWorker: Connection state changed from connected to disconnected",
      );
      notifyConnectionStateChange();
    }

    stopConnectionHealthCheck();
    // 连接断开时清除认证状态缓存
    clearAuthStateCache();
    stopAuthStateRefresh();

    // 🔧 增强重连策略 - WebSocket断开时立即重连，不等待延迟
    console.log(
      "ServiceWorker: WebSocket disconnected event detected, triggering immediate reconnection",
    );
    if (!isReconnecting) {
      triggerReconnection();
    }
  });

  db.emitter.subscribe("error", (error: Error) => {
    console.error("ServiceWorker: Database connection error:", error);
    const wasConnected = isConnected;
    isConnected = false;
    console.log(
      "ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 数据库错误事件",
      {
        timestamp: new Date().toISOString(),
        previousState: wasConnected,
        newState: false,
        reason: "数据库错误事件",
        error: error,
        dbStatus: db?.status,
        reconnectAttempts: reconnectAttempts,
        stackTrace: new Error().stack,
      },
    );

    if (wasConnected) {
      console.log(
        "ServiceWorker: Connection state changed to disconnected due to error",
      );
    }

    notifyConnectionStateChange(error);
    stopConnectionHealthCheck();
    // 连接错误时清除认证状态缓存
    clearAuthStateCache();
    stopAuthStateRefresh();

    // 立即触发重连
    if (!isReconnecting) {
      triggerReconnection();
    }
  });

  // 监听连接成功事件
  db.emitter.subscribe("connected", () => {
    console.log(
      "ServiceWorker: Database connection established (connected event)",
    );
    const wasDisconnected = !isConnected;
    isConnected = true;
    isReconnecting = false;
    reconnectAttempts = 0;

    if (wasDisconnected) {
      console.log(
        "ServiceWorker: Connection state changed from disconnected to connected",
      );
    }

    notifyConnectionStateChange();
    startConnectionHealthCheck();

    // 连接成功后，等待 TokenManager 初始化完成再刷新认证状态缓存
    if (db) {
      waitForTokenManagerAndRefreshAuth().catch((error: unknown) => {
        console.warn(
          "ServiceWorker: Failed to refresh auth cache after connection:",
          error,
        );
      });
    }
  });

  // 监听重连事件
  db.emitter.subscribe("reconnecting", () => {
    console.log("ServiceWorker: Database reconnecting... (reconnecting event)");
    // 注意：reconnecting 时不要修改 isConnected 状态，
    // 因为这只是表示正在重连，实际连接状态要等 connected 或 disconnected 事件
    isReconnecting = true;
    notifyConnectionStateChange();
  });

  console.log("ServiceWorker: Connection event listeners set up successfully");
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
  console.log("ServiceWorker: Reconnection stopped");
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
        type: "request_token_sync",
        payload: {},
      });
    }
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to sync tokens from localStorage:",
      error,
    );
  }
}

/**
 * 保存连接配置到持久化存储
 */
async function saveConnectionConfig(
  config: typeof connectionConfig,
): Promise<void> {
  try {
    if (!config) {
      console.warn("ServiceWorker: Cannot save null connection config");
      return;
    }

    await ensureDataCacheManager();

    // 使用本地数据库存储连接配置
    if (localDb) {
      const updated = await localDb.upsert(
        new StringRecordId("sw_connection_config:current"),
        {
          endpoint: config.endpoint,
          namespace: config.namespace,
          database: config.database,
          auth: config.auth,
          saved_at: Date.now(),
        },
      );

      console.log(
        "ServiceWorker: Connection config saved to persistent storage",
        updated,
        config,
      );
    }
  } catch (error) {
    console.error("ServiceWorker: Failed to save connection config:", error);
  }
}

/**
 * 从持久化存储恢复连接配置
 */
async function restoreConnectionConfig(): Promise<typeof connectionConfig> {
  try {
    await ensureDataCacheManager();

    if (localDb) {
      const storedConfig = await localDb.select(
        new StringRecordId("sw_connection_config:current"),
      );
      console.log(
        "ServiceWorker: Connection config restored from persistent storage",
        storedConfig,
      );
      if (storedConfig && typeof storedConfig === "object") {
        const config = storedConfig as any;

        // 验证配置有效性
        if (config.endpoint && config.namespace && config.database) {
          return {
            endpoint: config.endpoint,
            namespace: config.namespace,
            database: config.database,
            auth: config.auth,
          };
        }
      }
    }

    console.log(
      "ServiceWorker: No valid connection config found in persistent storage",
    );
    return null;
  } catch (error) {
    console.error("ServiceWorker: Failed to restore connection config:", error);
    return null;
  }
}

// --- Cache and Storage Functions ---

/**
 * 清理旧版本的缓存
 */
async function cleanupOldCaches(): Promise<void> {
  try {
    console.log("ServiceWorker: Cleaning up old caches...");
    const cacheNames = await caches.keys();
    const oldCacheNames = cacheNames.filter(
      (name) => name.startsWith("cuckoox-sw-") && name !== SW_CACHE_NAME,
    );

    await Promise.all(
      oldCacheNames.map((cacheName) => {
        console.log(`ServiceWorker: Deleting old cache: ${cacheName}`);
        return caches.delete(cacheName);
      }),
    );

    console.log("ServiceWorker: Old caches cleaned up successfully");
  } catch (error) {
    console.warn("ServiceWorker: Failed to cleanup old caches:", error);
  }
}

/**
 * 预缓存 SurrealDB WASM 文件
 */
async function precacheSurrealDBWasm(): Promise<void> {
  try {
    console.log("ServiceWorker: Precaching WASM files...");

    // 预加载WASM和JS文件
    const [wasmResponse] = await Promise.all([
      fetch(
        "https://unpkg.com/@surrealdb/wasm@1.4.1/dist/surreal/index_bg.wasm",
      ),
    ]);

    if (wasmResponse.ok) {
      console.log("ServiceWorker: WASM files precached successfully");
    } else {
      console.warn("ServiceWorker: Failed to precache some WASM files");
    }
  } catch (error) {
    console.warn(
      "ServiceWorker: WASM precaching failed, continuing without cache:",
      error,
    );
  }
}

/**
 * 初始化本地 SurrealDB WASM 实例
 */
async function initializeLocalSurrealDB(): Promise<void> {
  if (isLocalDbInitialized && localDb) {
    // console.log('ServiceWorker: Local SurrealDB already initialized, reusing singleton instance');
    return;
  }

  try {
    console.log("ServiceWorker: Initializing local SurrealDB singleton...");

    // 创建使用 WASM 引擎的 Surreal 实例 (单例)
    localDb = new Surreal({
      engines: await getWasmEngines(),
    });

    await localDb.connect("indxdb://cuckoox-storage");
    await localDb.use({ namespace: "ck_go", database: "local" });

    isLocalDbInitialized = true;
    console.log(
      "ServiceWorker: Local SurrealDB singleton initialized successfully",
    );
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to initialize local SurrealDB:",
      error,
    );
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
    console.log("ServiceWorker: Initializing TokenManager...");

    // 先初始化本地数据库
    await initializeLocalSurrealDB();

    // 创建 TokenManager 并传入 localDb
    tokenManager = new TokenManager({
      apiUrl: import.meta.env.VITE_API_URL || "http://localhost:8082",
      broadcastToAllClients: broadcastToAllClients,
    });

    await tokenManager.initialize(localDb);
    console.log("ServiceWorker: TokenManager initialized successfully");
  } catch (error) {
    console.error("ServiceWorker: Failed to initialize TokenManager:", error);
    throw error;
  }
}

/**
 * 确保 TokenManager 已初始化
 */
async function ensureTokenManager(): Promise<void> {
  // 如果已经有 TokenManager 且已初始化，直接返回
  if (tokenManager && tokenManager.initialized) {
    return;
  }

  // 如果正在初始化中，等待初始化完成
  if (tokenManagerInitializing) {
    let retries = 0;
    const maxRetries = 50; // 最多等待 5 秒
    while (tokenManagerInitializing && retries < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      retries++;
    }

    // 如果等待超时或初始化失败，抛出错误
    if (
      tokenManagerInitializing ||
      !tokenManager ||
      !tokenManager.initialized
    ) {
      throw new Error("TokenManager initialization timeout or failed");
    }
    return;
  }

  // 开始初始化
  tokenManagerInitializing = true;

  try {
    // 清除可能存在的未完全初始化的实例
    if (tokenManager && !tokenManager.initialized) {
      console.log(
        "ServiceWorker: Clearing uninitialized TokenManager instance",
      );
      tokenManager = null;
    }

    await initializeTokenManager();

    // 验证初始化是否成功
    if (!tokenManager || !tokenManager.initialized) {
      throw new Error("TokenManager initialization validation failed");
    }

    console.log("ServiceWorker: TokenManager ensured and validated");
  } catch (error) {
    console.error("ServiceWorker: Failed to ensure TokenManager:", error);
    tokenManager = null; // 清理失败的实例
    throw error;
  } finally {
    tokenManagerInitializing = false;
  }
}

/**
 * 初始化 DataCacheManager
 */
async function initializeDataCacheManager(): Promise<void> {
  if (dataCacheManager) return;

  try {
    console.log("ServiceWorker: Initializing DataCacheManager...");

    // 先初始化本地数据库
    await initializeLocalSurrealDB();

    // 创建 DataCacheManager 实例
    dataCacheManager = new DataCacheManager({
      localDb: localDb!,
      remoteDb: db!,
      broadcastToAllClients: broadcastToAllClients,
    });

    await dataCacheManager.initialize();
    console.log("ServiceWorker: DataCacheManager initialized successfully");
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to initialize DataCacheManager:",
      error,
    );
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

/**
 * 初始化 EnhancedQueryHandler
 */
async function initializeEnhancedQueryHandler(): Promise<void> {
  if (enhancedQueryHandler) return;

  try {
    console.log("ServiceWorker: Initializing EnhancedQueryHandler...");

    // 确保依赖组件已初始化
    await initializeLocalSurrealDB();
    await ensureDataCacheManager();

    // 创建 EnhancedQueryHandler 实例
    enhancedQueryHandler = new EnhancedQueryHandler(
      localDb!,
      dataCacheManager!,
      broadcastToAllClients,
      db || undefined, // 远程数据库可能为空，在连接建立后会更新
    );

    console.log("ServiceWorker: EnhancedQueryHandler initialized successfully");
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to initialize EnhancedQueryHandler:",
      error,
    );
    throw error;
  }
}

/**
 * 初始化 PageAwareSubscriptionManager
 */
async function initializePageAwareSubscriptionManager(): Promise<void> {
  if (pageAwareSubscriptionManager) return;

  try {
    console.log("ServiceWorker: Initializing PageAwareSubscriptionManager...");

    // 确保依赖组件已初始化
    await ensureEnhancedQueryHandler();

    // 获取 SubscriptionManager 实例
    const subscriptionManager = enhancedQueryHandler!.getSubscriptionManager();

    // 创建 PageAwareSubscriptionManager 实例
    pageAwareSubscriptionManager = new PageAwareSubscriptionManager(
      subscriptionManager,
      dataCacheManager!,
      broadcastToAllClients,
    );

    console.log(
      "ServiceWorker: PageAwareSubscriptionManager initialized successfully",
    );
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to initialize PageAwareSubscriptionManager:",
      error,
    );
    throw error;
  }
}

/**
 * 确保 PageAwareSubscriptionManager 已初始化
 */
async function ensurePageAwareSubscriptionManager(): Promise<void> {
  if (!pageAwareSubscriptionManager) {
    await initializePageAwareSubscriptionManager();
  }
}

/**
 * 初始化 OfflineManager
 */
async function initializeOfflineManager(): Promise<void> {
  if (offlineManager) return;

  try {
    console.log("ServiceWorker: Initializing OfflineManager...");

    // 确保本地数据库已初始化
    await initializeLocalSurrealDB();

    // 创建 OfflineManager 实例
    offlineManager = new OfflineManager({
      localDb: localDb!,
      remoteDb: db,
      broadcastToAllClients,
    });

    console.log("ServiceWorker: OfflineManager initialized successfully");
  } catch (error) {
    console.error("ServiceWorker: Failed to initialize OfflineManager:", error);
    throw error;
  }
}

/**
 * 确保 OfflineManager 已初始化
 */
async function ensureOfflineManager(): Promise<void> {
  if (!offlineManager) {
    await initializeOfflineManager();
  }
}

/**
 * 初始化 ConnectionRecoveryManager
 */
async function initializeConnectionRecoveryManager(): Promise<void> {
  if (connectionRecoveryManager) return;

  try {
    console.log("ServiceWorker: Initializing ConnectionRecoveryManager...");

    // 创建 ConnectionRecoveryManager 实例
    connectionRecoveryManager = new ConnectionRecoveryManager({
      broadcastToAllClients,
      connectFunction: async (config) => {
        try {
          // 使用现有的连接逻辑
          connectionConfig = config;
          const connectionState = await ensureConnection();
          return connectionState.isConnected;
        } catch (error) {
          console.error(
            "ConnectionRecoveryManager: Connect function failed:",
            error,
          );
          return false;
        }
      },
      disconnectFunction: async () => {
        try {
          if (db) {
            await db.close();
          }
          isConnected = false;
        } catch (error) {
          console.warn(
            "ConnectionRecoveryManager: Disconnect function failed:",
            error,
          );
        }
      },
      maxReconnectAttempts: 10,
    });

    // 设置连接配置
    if (connectionConfig) {
      connectionRecoveryManager.setConnectionConfig({
        url: connectionConfig.endpoint,
        namespace: connectionConfig.namespace,
        database: connectionConfig.database,
        token: connectionConfig.auth?.token,
        username: connectionConfig.auth?.username,
        password: connectionConfig.auth?.password,
      });
    }

    console.log(
      "ServiceWorker: ConnectionRecoveryManager initialized successfully",
    );
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to initialize ConnectionRecoveryManager:",
      error,
    );
    throw error;
  }
}

/**
 * 确保 ConnectionRecoveryManager 已初始化
 */
async function ensureConnectionRecoveryManager(): Promise<void> {
  if (!connectionRecoveryManager) {
    await initializeConnectionRecoveryManager();
  }
}

/**
 * 初始化 DataConsistencyManager
 */
async function initializeDataConsistencyManager(): Promise<void> {
  if (dataConsistencyManager) return;

  try {
    console.log("ServiceWorker: Initializing DataConsistencyManager...");

    // 确保本地数据库已初始化
    await initializeLocalSurrealDB();

    // 创建 DataConsistencyManager 实例
    dataConsistencyManager = new DataConsistencyManager({
      localDb: localDb!,
      remoteDb: db,
      broadcastToAllClients,
    });

    console.log(
      "ServiceWorker: DataConsistencyManager initialized successfully",
    );
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to initialize DataConsistencyManager:",
      error,
    );
    throw error;
  }
}

/**
 * 确保 DataConsistencyManager 已初始化
 */
async function ensureDataConsistencyManager(): Promise<void> {
  if (!dataConsistencyManager) {
    await initializeDataConsistencyManager();
  }
}

/**
 * 初始化静态资源缓存管理器
 */
async function initializeStaticCacheManager(): Promise<void> {
  if (staticCacheManager) return;

  try {
    console.log("ServiceWorker: Initializing StaticResourceCacheManager...");

    // 创建静态资源缓存管理器实例
    staticCacheManager = new StaticResourceCacheManager();

    // 初始化缓存管理器
    await staticCacheManager.initialize();

    // 缓存 App Shell 资源
    await staticCacheManager.cacheStaticResources("app-shell");

    // 后台缓存其他资源
    setTimeout(async () => {
      try {
        if (staticCacheManager) {
          await staticCacheManager.cacheStaticResources("static-assets");
          await staticCacheManager.cacheStaticResources("wasm-resources");
        }
      } catch (error) {
        console.warn("ServiceWorker: Background caching failed:", error);
      }
    }, 5000);

    console.log(
      "ServiceWorker: StaticResourceCacheManager initialized successfully",
    );
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to initialize StaticResourceCacheManager:",
      error,
    );
    // 不抛出错误，静态缓存失败不应该阻止整个 Service Worker
  }
}

/**
 * 确保静态资源缓存管理器已初始化
 */
async function ensureStaticCacheManager(): Promise<void> {
  if (!staticCacheManager) {
    await initializeStaticCacheManager();
  }
}

/**
 * 初始化网络状态管理器
 */
async function initializeNetworkStateManager(): Promise<void> {
  if (networkStateManager) return;

  try {
    console.log("ServiceWorker: Initializing NetworkStateManager...");

    // 创建网络状态管理器实例
    networkStateManager = new NetworkStateManager();

    // 初始化，传入 offlineManager 以便集成
    await networkStateManager.initialize(offlineManager);

    // 监听网络状态变化并广播给客户端
    networkStateManager.onStateChange((state: NetworkState) => {
      broadcastToAllClients({
        type: "network_state_change",
        payload: { state },
      });
    });

    console.log("ServiceWorker: NetworkStateManager initialized successfully");
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to initialize NetworkStateManager:",
      error,
    );
    // 不抛出错误，网络状态管理失败不应该阻止整个 Service Worker
  }
}

/**
 * 确保网络状态管理器已初始化
 */
async function ensureNetworkStateManager(): Promise<void> {
  if (!networkStateManager) {
    await initializeNetworkStateManager();
  }
}

/**
 * 初始化PWA协作增强器
 */
async function initializePWACollaborationEnhancer(): Promise<void> {
  if (pwaCollaborationEnhancer) return;

  try {
    console.log("ServiceWorker: Initializing PWACollaborationEnhancer...");

    // 创建PWA协作增强器实例
    pwaCollaborationEnhancer = new PWACollaborationEnhancer({
      enableBackgroundSync: true,
      pushNotificationConfig: {
        enabled: true,
      },
      reconnectionConfig: {
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 30000,
      },
      visibilityConfig: {
        enableVisibilityAPI: true,
        backgroundSyncInterval: 30000, // 30秒
      },
    });

    // 初始化，传入现有的管理器实例
    await pwaCollaborationEnhancer.initialize({
      networkStateManager,
      connectionRecoveryManager: connectionRecoveryManager,
      subscriptionManager: pageAwareSubscriptionManager,
    });

    // 监听协作事件并广播给客户端
    pwaCollaborationEnhancer.onCollaborationEvent(
      (event: CollaborationEvent) => {
        broadcastToAllClients({
          type: "collaboration_event",
          payload: event,
        });
      },
    );

    console.log(
      "ServiceWorker: PWACollaborationEnhancer initialized successfully",
    );
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to initialize PWACollaborationEnhancer:",
      error,
    );
    // 不抛出错误，协作增强失败不应该阻止整个 Service Worker
  }
}

/**
 * 确保PWA协作增强器已初始化
 */
async function ensurePWACollaborationEnhancer(): Promise<void> {
  if (!pwaCollaborationEnhancer) {
    await initializePWACollaborationEnhancer();
  }
}

/**
 * 初始化PWA性能管理器
 */
async function initializePWAPerformanceManager(): Promise<void> {
  if (pwaPerformanceManager) return;

  try {
    console.log("ServiceWorker: Initializing PWAPerformanceManager...");

    // 创建性能管理器配置
    const performanceConfig: PWAPerformanceConfig = {
      appShell: {
        coreResources: [
          "/",
          "/index.html",
          "/static/css/main.css",
          "/static/js/main.js",
          "/manifest.json",
          "/assets/logo/cuckoo-icon.svg",
          "/assets/logo/cuckoo-logo-main.svg",
        ],
        shellCacheName: "cuckoox-app-shell-v1",
        version: SW_VERSION,
      },
      preloading: {
        criticalResources: [
          "/cases",
          "/claims",
          "/dashboard",
          "/static/fonts/roboto.woff2",
        ],
        preloadStrategy: "adaptive",
        maxPreloadSize: 5 * 1024 * 1024, // 5MB
      },
      lazyLoading: {
        routes: ["/admin", "/reports", "/settings"],
        chunkSize: 100 * 1024, // 100KB
        loadingThreshold: 200, // 200ms
      },
      performance: {
        memoryThreshold: 150, // 150MB
        cleanupInterval: 5 * 60 * 1000, // 5分钟
        targetFCP: 1500, // 1.5秒
        targetLCP: 2500, // 2.5秒
      },
    };

    // 创建性能管理器实例
    pwaPerformanceManager = new PWAPerformanceManager(performanceConfig);

    // 初始化性能管理器
    await pwaPerformanceManager.initialize();

    console.log(
      "ServiceWorker: PWAPerformanceManager initialized successfully",
    );
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to initialize PWAPerformanceManager:",
      error,
    );
    // 不抛出错误，性能优化失败不应该阻止整个 Service Worker
  }
}

/**
 * 确保PWA性能管理器已初始化
 */
async function ensurePWAPerformanceManager(): Promise<void> {
  if (!pwaPerformanceManager) {
    await initializePWAPerformanceManager();
  }
}

/**
 * 初始化PWA安全管理器
 */
async function initializePWASecurityManager(): Promise<void> {
  if (pwaSecurityManager) return;

  try {
    console.log("ServiceWorker: Initializing PWASecurityManager...");

    // 创建安全管理器配置
    const securityConfig: PWASecurityConfig = {
      encryption: {
        enabled: true,
        algorithm: "AES-GCM",
        keyLength: 256,
        ivLength: 12,
      },
      authentication: {
        autoLockTimeout: 30 * 60 * 1000, // 30分钟
        maxInactivity: 60 * 60 * 1000, // 1小时
        requireReauth: true,
        sessionStorageKey: "cuckoox-session",
      },
      threats: {
        enableDetection: true,
        maxFailedAttempts: 3,
        lockoutDuration: 15 * 60 * 1000, // 15分钟
      },
      cache: {
        encryptSensitiveData: true,
        sensitiveDataPatterns: [
          "/api/auth",
          "/api/user",
          "/api/cases/\\d+",
          "/api/claims/\\d+",
          "token",
          "jwt",
        ],
        maxCacheAge: 24 * 60 * 60 * 1000, // 24小时
      },
    };

    // 创建安全管理器实例
    pwaSecurityManager = new PWASecurityManager(securityConfig);

    // 初始化安全管理器
    await pwaSecurityManager.initialize();

    console.log("ServiceWorker: PWASecurityManager initialized successfully");
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to initialize PWASecurityManager:",
      error,
    );
    // 不抛出错误，安全管理失败不应该阻止整个 Service Worker
  }
}

/**
 * 确保PWA安全管理器已初始化
 */
async function ensurePWASecurityManager(): Promise<void> {
  if (!pwaSecurityManager) {
    await initializePWASecurityManager();
  }
}

/**
 * 确保 EnhancedQueryHandler 已初始化
 */
async function ensureEnhancedQueryHandler(): Promise<void> {
  if (!enhancedQueryHandler) {
    await initializeEnhancedQueryHandler();
  } else {
    // 如果已初始化，确保远程数据库引用是最新的
    updateEnhancedQueryHandlerRemoteDb();
  }
}

/**
 * 更新 EnhancedQueryHandler 中的远程数据库引用
 */
function updateEnhancedQueryHandlerRemoteDb(): void {
  if (enhancedQueryHandler && db) {
    // 通过反射更新私有属性（这是一个临时解决方案）
    (enhancedQueryHandler as any).remoteDb = db;

    // 同时更新 CacheExecutor 的 remoteDb 引用
    if ((enhancedQueryHandler as any).cacheExecutor) {
      (enhancedQueryHandler as any).cacheExecutor.remoteDb = db;
      console.log(
        "ServiceWorker: Updated CacheExecutor remote database reference",
      );
    }

    // 同时更新 SubscriptionManager 的 remoteDb 引用
    if ((enhancedQueryHandler as any).subscriptionManager) {
      (enhancedQueryHandler as any).subscriptionManager.remoteDb = db;
      console.log(
        "ServiceWorker: Updated SubscriptionManager remote database reference",
      );
    }

    console.log(
      "ServiceWorker: Updated EnhancedQueryHandler and related components remote database reference",
    );
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
  const cleanSql = sql.replace(/\s+/g, " ").trim().toLowerCase();

  // SELECT 语句：SELECT ... FROM table
  const selectMatches = cleanSql.matchAll(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
  for (const match of selectMatches) {
    tables.push(match[1]);
  }

  // INSERT 语句：INSERT INTO table
  const insertMatches = cleanSql.matchAll(
    /insert\s+into\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
  );
  for (const match of insertMatches) {
    tables.push(match[1]);
  }

  // UPDATE 语句：UPDATE table
  const updateMatches = cleanSql.matchAll(/update\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);
  for (const match of updateMatches) {
    tables.push(match[1]);
  }

  // DELETE 语句：DELETE FROM table
  const deleteMatches = cleanSql.matchAll(
    /delete\s+from\s+([a-zA-Z_][a-zA-Z0-9_]*)/g,
  );
  for (const match of deleteMatches) {
    tables.push(match[1]);
  }

  // 去重并返回
  return [...new Set(tables)];
}

/**
 * 从SQL查询中提取主要表名（返回第一个找到的表名）
 */
function extractTableNameFromSQL(sql: string): string | null {
  const tables = extractTableNamesFromQuery(sql);
  return tables.length > 0 ? tables[0] : null;
}

/**
 * 获取当前用户ID（优先从缓存中获取）
 */
async function getCurrentUserId(): Promise<string | undefined> {
  try {
    // 优先从缓存获取
    const cachedAuth = getCachedAuthState();
    if (cachedAuth && cachedAuth.isAuthenticated && cachedAuth.userId) {
      console.log(
        "ServiceWorker: Current user ID from cache:",
        cachedAuth.userId,
      );
      return cachedAuth.userId;
    }

    // 缓存不可用时，检查连接状态
    const connectionState = await ensureConnection();
    if (!connectionState.hasDb || !connectionState.isConnected) {
      console.warn(
        "ServiceWorker: Cannot get user ID - no database connection",
      );
      return undefined;
    }

    // 确保 TokenManager 已初始化再执行认证查询
    try {
      await ensureTokenManager();
    } catch (error) {
      console.warn(
        "ServiceWorker: TokenManager not ready for getCurrentUserId, returning undefined:",
        error,
      );
      return undefined;
    }

    // 执行查询并更新缓存
    const authResult = await db!.query("RETURN $auth;");

    if (authResult && authResult.length > 0 && authResult[0]) {
      const auth = authResult[0] as any;
      // 从认证信息中提取用户ID
      if (auth.id) {
        const userId = String(auth.id);
        console.log("ServiceWorker: Current user ID from query:", userId);

        // 更新缓存
        await updateAuthStateCache(userId, true);

        return userId;
      }
    }

    // 未认证状态，更新缓存
    await updateAuthStateCache(null, false);
    return undefined;
  } catch (error) {
    console.warn("ServiceWorker: Failed to get current user ID:", error);
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
  if (typeof obj === "object" && "id" in obj && "tb" in obj) {
    // 这很可能是一个被序列化的RecordId，重新构造它
    return new RecordId(obj.tb, obj.id);
  }

  // 如果是数组，递归处理每个元素
  if (Array.isArray(obj)) {
    return obj.map((item) => deserializeRecordIds(item));
  }

  // 如果是对象，递归处理每个属性
  if (typeof obj === "object") {
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

async function postMessageToClient(
  clientId: string,
  message: Record<string, unknown>,
) {
  const client = await self.clients.get(clientId);
  if (client) {
    client.postMessage(message);
  } else {
    console.warn(`ServiceWorker: Client with ID ${clientId} not found.`);
  }
}

async function broadcastToClients(
  message: Record<string, unknown>,
  clientIds: Set<string>,
) {
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
      type: "tenant_code_missing",
      payload: { message: "Tenant code is missing, user needs to login again" },
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
    // console.log("ServiceWorker: SurrealDB already initialized, reusing singleton instance");
    return;
  }

  try {
    // Create a new SurrealDB instance with WASM engines (singleton)
    const wasmEngines = await getWasmEngines();
    db = new Surreal({
      engines: wasmEngines,
    });
    console.log(
      "ServiceWorker: SurrealDB singleton initialized successfully with WASM engines",
    );

    // 设置连接事件监听器
    setupConnectionEventListeners();
  } catch (error) {
    console.error("ServiceWorker: Failed to initialize SurrealDB:", error);
    throw error;
  }
}

// 连接状态结果接口
interface ConnectionState {
  state: "connected" | "disconnected" | "connecting" | "error";
  isConnected: boolean;
  isAuthenticated: boolean;
  hasDb: boolean;
  error?: string;
}

let connecting = false;

async function ensureConnection(
  newConfig?: typeof connectionConfig,
): Promise<ConnectionState> {
  if (connecting) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // 如果正在连接，等待完成后继续检查连接状态
  }

  connecting = true;

  try {
    // 1. 确保数据库实例存在
    await initializeSurreal();

    if (!db) {
      console.error("ServiceWorker: Failed to initialize database instance");
      const previousState = isConnected;
      isConnected = false;
      console.log(
        "ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 数据库实例初始化失败",
        {
          timestamp: new Date().toISOString(),
          previousState: previousState,
          newState: false,
          reason: "数据库实例初始化失败",
          stackTrace: new Error().stack,
        },
      );
      return {
        state: "error",
        isConnected: false,
        isAuthenticated: false,
        hasDb: false,
        error: "Database initialization failed",
      };
    }

    // 2. 处理配置变化或设置新配置
    await handleConfigurationChanges(newConfig);

    // 3. 检查是否有配置
    if (!connectionConfig) {
      console.log(
        "ServiceWorker: Connection config not set, attempting to restore from storage",
      );

      const restoredConfig = await restoreConnectionConfig();
      if (restoredConfig) {
        connectionConfig = restoredConfig;
        console.log("ServiceWorker: Connection config restored from storage");
      } else {
        console.error(
          "ServiceWorker: No connection config available and cannot restore from storage",
        );
        notifyConnectionStateChange();
        return {
          state: "disconnected",
          isConnected: false,
          isAuthenticated: false,
          hasDb: true,
          error: "No connection configuration available",
        };
      }
    }

    // 4. 检查当前连接状态和建立连接（融合 checkActualConnectionState 逻辑）
    console.log("ServiceWorker: Current isConnected state:", isConnected);

    // 如果我们认为已经断开连接，先检查 db.status 是否有变化
    if (!isConnected) {
      const dbStatus = db.status;
      console.log("ServiceWorker: db.status when isConnected=false:", dbStatus);

      // 如果 db.status 也显示未连接，尝试重新连接
      if (dbStatus !== ConnectionStatus.Connected) {
        try {
          notifyConnectionStateChange();
          console.log(
            `ServiceWorker: Connecting to ${connectionConfig.endpoint}...`,
          );

          // 使用带超时的连接
          await connectWithTimeout();

          isConnected = true;
          notifyConnectionStateChange();
          startConnectionHealthCheck();
          console.log("ServiceWorker: Connection established.");

          // 保存连接配置
          await saveConnectionConfig(connectionConfig);

          // 重置重连计数
          reconnectAttempts = 0;

          // Resubscribe to all live queries
          await resubscribeAllLiveQueries();
        } catch (e) {
          console.error("ServiceWorker: Connection failed.", e);
          const previousState = isConnected;
          isConnected = false;
          console.log(
            "ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 连接建立失败",
            {
              timestamp: new Date().toISOString(),
              previousState: previousState,
              newState: false,
              reason: "连接建立失败",
              error: e,
              connectionConfig: connectionConfig,
              reconnectAttempts: reconnectAttempts,
              stackTrace: new Error().stack,
            },
          );
          notifyConnectionStateChange(e as Error);

          // 触发自动重连
          triggerReconnection();

          return {
            state: "error",
            isConnected: false,
            isAuthenticated: false,
            hasDb: true,
            error: (e as Error).message,
          };
        }
      } else {
        // db.status 显示已连接，但我们的状态是断开，需要同步状态
        console.log(
          "ServiceWorker: db.status shows connected but isConnected=false, syncing state...",
        );

        // 通过执行简单查询来验证连接是否真正可用
        try {
          await Promise.race([
            db.query("return 1;"),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Connection sync test timeout")),
                3000,
              ),
            ),
          ]);

          // 查询成功，同步状态
          isConnected = true;
          console.log(
            "ServiceWorker: Connection state synced - db is actually connected",
          );
          notifyConnectionStateChange();
        } catch (syncError) {
          console.warn(
            "ServiceWorker: Connection sync test failed, forcing reconnection:",
            syncError,
          );
          // 强制重连
          try {
            await connectWithTimeout();
            isConnected = true;
            notifyConnectionStateChange();
          } catch (reconnectError) {
            console.error(
              "ServiceWorker: Forced reconnection failed:",
              reconnectError,
            );
          }
        }
      }
    }

    // 5. 检查认证状态（优先使用缓存）
    try {
      let isAuthenticated = false;

      // 优先从缓存获取认证状态
      const cachedAuth = getCachedAuthState();
      if (cachedAuth && cachedAuth.isAuthenticated) {
        isAuthenticated = true;
        console.log(
          "ServiceWorker: Authentication status from cache: authenticated",
        );
      } else {
        // 缓存不可用时，检查 TokenManager 是否已初始化
        let result: any = null;
        try {
          await ensureTokenManager();

          // TokenManager 已初始化，使用简单的查询测试连接和认证状态
          result = await Promise.race([
            db.query("return $auth;"),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Connection test timeout")),
                8000,
              ),
            ),
          ]);

          // 查询成功，连接正常
          if (!isConnected) {
            isConnected = true;
            console.log(
              "ServiceWorker: Connection state corrected to connected after test",
            );
          }

          // 检查认证状态
          let authResult = null;
          if (Array.isArray(result) && result.length > 0) {
            authResult = result[0];
          } else {
            authResult = result;
          }

          isAuthenticated =
            authResult && typeof authResult === "object" && authResult !== null;

          console.log(
            "ServiceWorker: Authentication status from query:",
            isAuthenticated ? "authenticated" : "not authenticated",
          );

          // 更新认证状态缓存
          const userId = isAuthenticated
            ? String((authResult as any).id || null)
            : null;
          await updateAuthStateCache(userId, isAuthenticated);
        } catch (tokenError) {
          console.log(
            "ServiceWorker: TokenManager not ready for auth check, assuming unauthenticated:",
            tokenError,
          );
          // TokenManager 未初始化，假设未认证状态，但连接是正常的
          isAuthenticated = false;

          // 仍然标记连接为正常，因为这只是 TokenManager 初始化问题
          if (!isConnected) {
            isConnected = true;
            console.log(
              "ServiceWorker: Connection state corrected to connected (TokenManager not ready)",
            );
          }
        }

        // 确保 isAuthenticated 是明确的 boolean 值
        isAuthenticated = Boolean(isAuthenticated);
      }

      // 如果未认证，广播认证状态变化
      if (!isAuthenticated) {
        console.log(
          "ServiceWorker: User not authenticated, broadcasting auth state change",
        );
        broadcastAuthStateChange(false, "connection_check");
      }

      return {
        state: "connected",
        isConnected: true,
        isAuthenticated: isAuthenticated,
        hasDb: true,
      };
    } catch (queryError) {
      // 查询失败，连接有问题，需要重新连接
      console.warn("ServiceWorker: Connection test query failed:", queryError);

      // 更新我们维护的连接状态
      const wasConnected = isConnected;
      isConnected = false;
      console.log(
        "ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 连接测试查询失败",
        {
          timestamp: new Date().toISOString(),
          previousState: wasConnected,
          newState: false,
          reason: "连接测试查询失败",
          error: queryError,
          dbStatus: db?.status,
          reconnectAttempts: reconnectAttempts,
          stackTrace: new Error().stack,
        },
      );

      // 尝试重新连接
      try {
        console.log(
          "ServiceWorker: Attempting to reconnect due to query failure...",
        );
        notifyConnectionStateChange();

        // 使用带超时的连接
        await connectWithTimeout();

        isConnected = true;
        notifyConnectionStateChange();
        startConnectionHealthCheck();
        console.log(
          "ServiceWorker: Reconnection successful after query failure.",
        );

        // 保存连接配置
        await saveConnectionConfig(connectionConfig);

        // 重置重连计数
        reconnectAttempts = 0;

        // Resubscribe to all live queries
        await resubscribeAllLiveQueries();

        // 重新测试认证状态
        try {
          // 确保 TokenManager 已初始化再执行认证查询
          await ensureTokenManager();

          const retestResult = await db.query<RecordId[]>("return $auth;");
          let retestAuthResult = null;
          if (Array.isArray(retestResult) && retestResult.length > 0) {
            retestAuthResult = retestResult[0];
          } else {
            retestAuthResult = retestResult;
          }

          const retestIsAuthenticated =
            retestAuthResult &&
            typeof retestAuthResult === "object" &&
            retestAuthResult !== null;

          // 更新认证状态缓存
          const userId = retestIsAuthenticated
            ? String((retestAuthResult as any).id || null)
            : null;
          await updateAuthStateCache(userId, retestIsAuthenticated);

          return {
            state: "connected",
            isConnected: true,
            isAuthenticated: retestIsAuthenticated,
            hasDb: true,
          };
        } catch {
          // 重新连接后认证测试失败，但连接是成功的
          await updateAuthStateCache(null, false);
          return {
            state: "connected",
            isConnected: true,
            isAuthenticated: false,
            hasDb: true,
          };
        }
      } catch (reconnectError) {
        console.error(
          "ServiceWorker: Reconnection failed after query failure:",
          reconnectError,
        );

        // 触发重连机制
        if (!isReconnecting) {
          triggerReconnection();
        }

        return {
          state: "disconnected",
          isConnected: false,
          isAuthenticated: false,
          hasDb: true,
          error: (reconnectError as Error).message,
        };
      }
    }
  } catch (error) {
    console.error("ServiceWorker: Error in ensureConnection:", error);
    const previousState = isConnected;
    isConnected = false;
    console.log(
      "ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: ensureConnection异常",
      {
        timestamp: new Date().toISOString(),
        previousState: previousState,
        newState: false,
        reason: "ensureConnection异常",
        error: error,
        dbStatus: db?.status,
        stackTrace: new Error().stack,
      },
    );

    return {
      state: "error",
      isConnected: false,
      isAuthenticated: false,
      hasDb: !!db,
      error: (error as Error).message,
    };
  } finally {
    connecting = false;
  }
}

/**
 * 处理配置变化
 */
async function handleConfigurationChanges(
  newConfig?: typeof connectionConfig,
): Promise<void> {
  if (newConfig && connectionConfig) {
    // 检查配置变化的具体部分
    const endpointChanged = connectionConfig.endpoint !== newConfig.endpoint;
    const namespaceChanged = connectionConfig.namespace !== newConfig.namespace;
    const databaseChanged = connectionConfig.database !== newConfig.database;
    const authChanged =
      JSON.stringify(connectionConfig.auth) !== JSON.stringify(newConfig.auth);

    if (endpointChanged) {
      // endpoint 变化需要重新建立连接
      console.log(
        "ServiceWorker: Endpoint changed, reconnecting...",
        connectionConfig.endpoint,
        "->",
        newConfig.endpoint,
      );
      stopConnectionHealthCheck();

      if (isConnected && db) {
        try {
          await db.close();
          console.log(
            "ServiceWorker: Closed existing connection for endpoint change",
          );
        } catch (e) {
          console.warn("ServiceWorker: Error closing connection:", e);
        }
      }
      const previousState = isConnected;
      isConnected = false;
      console.log(
        "ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 端点变更",
        {
          timestamp: new Date().toISOString(),
          previousState: previousState,
          newState: false,
          reason: "端点变更",
          oldEndpoint: connectionConfig.endpoint,
          newEndpoint: newConfig.endpoint,
          dbStatus: db?.status,
          stackTrace: new Error().stack,
        },
      );
      notifyConnectionStateChange();
      connectionConfig = newConfig;
    } else if (namespaceChanged || databaseChanged) {
      // namespace 或 database 变化只需要重新执行 use 和 authenticate
      console.log(
        "ServiceWorker: Namespace/Database changed, switching...",
        {
          namespace: connectionConfig.namespace,
          database: connectionConfig.database,
        },
        "->",
        { namespace: newConfig.namespace, database: newConfig.database },
      );

      if (isConnected && db) {
        try {
          await db.use({
            namespace: newConfig.namespace,
            database: newConfig.database,
          });
          await localDb!.use({
            namespace: newConfig.namespace,
            database: newConfig.database,
          });

          // 重新认证
          await ensureTokenManager();
          const token = await tokenManager!.getToken();

          if (token && token.access_token) {
            await db.authenticate(token.access_token);
            console.log(
              "ServiceWorker: Re-authenticated after namespace/database change.",
            );
          }
        } catch (e) {
          console.error(
            "ServiceWorker: Failed to switch namespace/database:",
            e,
          );
          const previousState = isConnected;
          isConnected = false;
          console.log(
            "ServiceWorker: [连接状态变更] isConnected 设置为 false - 原因: 命名空间/数据库切换失败",
            {
              timestamp: new Date().toISOString(),
              previousState: previousState,
              newState: false,
              reason: "命名空间/数据库切换失败",
              error: e,
              oldConfig: {
                namespace: connectionConfig.namespace,
                database: connectionConfig.database,
              },
              newConfig: {
                namespace: newConfig.namespace,
                database: newConfig.database,
              },
              dbStatus: db?.status,
              stackTrace: new Error().stack,
            },
          );
          notifyConnectionStateChange(e as Error);
          triggerReconnection();
        }
      }
      connectionConfig = newConfig;
    } else if (authChanged) {
      // 只有认证信息变化，只需要重新认证
      console.log("ServiceWorker: Auth changed, re-authenticating...");

      if (!db) {
        throw new Error(
          "Database instance not available for re-authentication",
        );
      }
      if (
        db.status === ConnectionStatus.Disconnected ||
        db.status === ConnectionStatus.Error
      ) {
        await connectWithTimeout();
      }
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
      connectionConfig = newConfig;
    } else {
      // 没有变化，直接更新配置引用
      connectionConfig = newConfig;
    }
  } else if (newConfig) {
    // 第一次设置配置
    connectionConfig = newConfig;
  }
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
          broadcastToClients(
            {
              type: "live_update",
              payload: { uuid, action, result },
            },
            sub.clients,
          );
        });

        // 如果新的 UUID 与原来的不同，需要更新映射
        if (String(newUuid) !== uuid) {
          console.log(
            `ServiceWorker: Live query UUID changed from ${uuid} to ${newUuid}`,
          );
          // 创建新的订阅记录
          liveQuerySubscriptions.set(String(newUuid), {
            query: sub.query,
            vars: sub.vars,
            clients: sub.clients,
          });
          // 删除旧的记录
          liveQuerySubscriptions.delete(uuid);

          // 通知客户端 UUID 变化
          broadcastToClients(
            {
              type: "live_query_uuid_changed",
              payload: { oldUuid: uuid, newUuid: String(newUuid) },
            },
            sub.clients,
          );
        }

        console.log(
          `ServiceWorker: Successfully resubscribed to live query ${uuid}`,
        );
      } catch (e) {
        console.error(
          `ServiceWorker: Failed to resubscribe to live query ${uuid}`,
          e,
        );

        // 通知客户端重订阅失败
        broadcastToClients(
          {
            type: "live_query_resubscribe_failed",
            payload: { uuid, error: (e as Error).message },
          },
          sub.clients,
        );
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
  conflictResolution: "local" | "remote" | "timestamp",
): Promise<void> {
  try {
    console.log("ServiceWorker: Processing incremental update:", update);

    // 获取本地数据
    const localData = await dataCacheManager!.query(
      `SELECT * FROM ${update.table_name} WHERE id = $id`,
      { id: update.id },
    );

    const hasLocalData = localData && localData.length > 0;

    // 处理不同的操作类型
    switch (update.operation) {
      case "insert":
        if (!hasLocalData) {
          // 直接插入新数据
          await dataCacheManager!.cacheData(
            update.table_name,
            [update.data],
            "temporary",
          );
        } else {
          // 存在冲突，根据策略处理
          await handleConflict(update, localData[0], conflictResolution);
        }
        break;

      case "update":
        if (hasLocalData) {
          // 检查版本冲突
          const localVersion = localData[0].version || 0;
          const remoteVersion = update.version || 0;

          if (remoteVersion > localVersion) {
            // 远程版本更新，直接更新
            await dataCacheManager!.updateData(
              update.table_name,
              update.id,
              update.data,
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
            "temporary",
          );
        }
        break;

      case "delete":
        if (hasLocalData) {
          // 删除本地数据
          await dataCacheManager!.clearTableCache(
            update.table_name,
            update.data.user_id,
            update.data.case_id,
          );
        }
        break;
    }

    // 广播更新事件
    await broadcastToAllClients({
      type: "incremental_update_processed",
      payload: {
        table: update.table_name,
        operation: update.operation,
        recordId: update.id,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("ServiceWorker: Error processing incremental update:", error);
    throw error;
  }
}

/**
 * 处理冲突
 */
async function handleConflict(
  remoteUpdate: any,
  localData: any,
  conflictResolution: "local" | "remote" | "timestamp",
): Promise<void> {
  console.log(
    "ServiceWorker: Handling conflict with strategy:",
    conflictResolution,
  );

  switch (conflictResolution) {
    case "local":
      // 保留本地数据，忽略远程更新
      console.log("ServiceWorker: Keeping local data, ignoring remote update");
      break;

    case "remote":
      // 使用远程数据覆盖本地数据
      console.log("ServiceWorker: Using remote data, overwriting local");
      await dataCacheManager!.updateData(
        remoteUpdate.table_name,
        remoteUpdate.id,
        remoteUpdate.data,
      );
      break;

    case "timestamp": {
      // 根据时间戳决定使用哪个版本
      const localTimestamp = new Date(localData.updated_at).getTime();
      const remoteTimestamp = new Date(remoteUpdate.updated_at).getTime();

      if (remoteTimestamp > localTimestamp) {
        console.log("ServiceWorker: Remote data is newer, using remote");
        await dataCacheManager!.updateData(
          remoteUpdate.table_name,
          remoteUpdate.id,
          remoteUpdate.data,
        );
      } else {
        console.log("ServiceWorker: Local data is newer, keeping local");
      }
      break;
    }
  }
}

/**
 * 创建同步记录
 */
async function createSyncRecord(syncRecord: any): Promise<void> {
  try {
    await localDb!.create("sync_record", syncRecord);
    console.log("ServiceWorker: Created sync record:", syncRecord.id);
  } catch (error) {
    console.error("ServiceWorker: Error creating sync record:", error);
    throw error;
  }
}

/**
 * 获取同步记录
 */
async function getSyncRecord(
  table: string,
  userId: string,
  caseId?: string,
): Promise<any> {
  try {
    const recordId = `sync_record:${table}_${userId}_${caseId || "global"}`;
    const result = await localDb!.select(recordId);
    return result || null;
  } catch (error) {
    console.error("ServiceWorker: Error getting sync record:", error);
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
  status?: string,
): Promise<void> {
  try {
    const updateData: any = {
      last_sync_timestamp: lastSyncTimestamp,
      updated_at: new Date(),
    };

    if (lastSyncId) {
      updateData.last_sync_id = lastSyncId;
    }

    if (status) {
      updateData.sync_status = status;
    }

    await localDb!.update(syncRecordId, updateData);
    console.log("ServiceWorker: Updated sync record:", syncRecordId);
  } catch (error) {
    console.error("ServiceWorker: Error updating sync record:", error);
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
  errorMessage?: string,
): Promise<void> {
  try {
    const updateData: any = {
      sync_status: status,
      updated_at: new Date(),
    };

    if (lastSyncTimestamp) {
      updateData.last_sync_timestamp = lastSyncTimestamp;
    }

    if (errorMessage) {
      updateData.error_message = errorMessage;
    }

    // 如果状态是失败，增加重试次数
    if (status === "failed") {
      const currentRecord = await localDb!.select(syncRecordId);
      updateData.retry_count = ((currentRecord as any)?.retry_count || 0) + 1;
    }

    await localDb!.update(syncRecordId, updateData);
    console.log("ServiceWorker: Updated sync status:", syncRecordId, status);
  } catch (error) {
    console.error("ServiceWorker: Error updating sync status:", error);
    throw error;
  }
}

/**
 * 清除同步记录
 */
async function clearSyncRecords(
  tables: string[],
  userId: string,
  caseId?: string,
): Promise<void> {
  try {
    for (const table of tables) {
      const recordId = `sync_record:${table}_${userId}_${caseId || "global"}`;
      await localDb!.delete(recordId);
    }
    console.log("ServiceWorker: Cleared sync records for tables:", tables);
  } catch (error) {
    console.error("ServiceWorker: Error clearing sync records:", error);
    throw error;
  }
}

// --- 双向同步辅助函数 ---

/**
 * 持久化离线队列
 */
async function persistOfflineQueue(
  syncKey: string,
  queue: any[],
): Promise<void> {
  try {
    const queueRecord = {
      id: new RecordId("offline_queue", syncKey),
      sync_key: syncKey,
      queue_data: queue,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await localDb!.create("offline_queue", queueRecord);
    console.log(
      "ServiceWorker: Persisted offline queue for sync key:",
      syncKey,
    );
  } catch {
    // 如果创建失败，尝试更新
    try {
      const queueRecord = {
        queue_data: queue,
        updated_at: new Date(),
      };

      await localDb!.update(
        new RecordId("offline_queue", syncKey),
        queueRecord,
      );
      console.log(
        "ServiceWorker: Updated offline queue for sync key:",
        syncKey,
      );
    } catch (updateError) {
      console.error(
        "ServiceWorker: Error persisting offline queue:",
        updateError,
      );
      throw updateError;
    }
  }
}

/**
 * 恢复离线队列
 */
async function restoreOfflineQueue(syncKey: string): Promise<any[]> {
  try {
    const recordId = new RecordId("offline_queue", syncKey);
    const result = await localDb!.select(recordId);

    if (result && (result as any).queue_data) {
      console.log(
        "ServiceWorker: Restored offline queue for sync key:",
        syncKey,
      );
      return (result as any).queue_data;
    }

    return [];
  } catch (error) {
    console.error("ServiceWorker: Error restoring offline queue:", error);
    return [];
  }
}

/**
 * 清除离线队列
 */
async function clearOfflineQueue(syncKey: string): Promise<void> {
  try {
    const recordId = new RecordId("offline_queue", syncKey);
    await localDb!.delete(recordId);
    console.log("ServiceWorker: Cleared offline queue for sync key:", syncKey);
  } catch (error) {
    console.error("ServiceWorker: Error clearing offline queue:", error);
    throw error;
  }
}

// === 新的连接管理器集成辅助函数 ===

/**
 * 🎯 初始化所有依赖组件
 * 使用新的连接管理器提供的数据库实例
 */
async function initializeAllDependentComponents(): Promise<void> {
  if (!connectionManager) {
    throw new Error("Connection manager not initialized");
  }

  try {
    console.log("ServiceWorker: Initializing all dependent components...");

    // 🔗 获取统一的数据库引用
    const remoteDb = connectionManager.getRemoteDb();
    const localDb = connectionManager.getLocalDb();

    if (!localDb) {
      throw new Error("Local database not available from connection manager");
    }

    // 📊 按依赖顺序初始化组件
    const initializationSteps = [
      // 基础组件
      () => initializeTokenManagerWithDb(localDb),
      () => initializeDataCacheManagerWithDb(localDb, remoteDb),

      // 高级组件
      () => initializeEnhancedQueryHandlerWithDb(localDb, remoteDb),
      () => initializePageAwareSubscriptionManager(),
      () => initializeOfflineManagerWithDb(localDb, remoteDb),

      // 管理组件
      () => initializeConnectionRecoveryManager(),
      () => initializeDataConsistencyManagerWithDb(localDb, remoteDb),

      // PWA 组件
      () => initializeStaticCacheManager(),
      () => initializeNetworkStateManager(),
      () => initializePWACollaborationEnhancer(),
      () => initializePWAPerformanceManager(),
      () => initializePWASecurityManager(),
    ];

    // 🔄 按顺序初始化，确保依赖关系正确
    for (const step of initializationSteps) {
      await step();
    }

    console.log("ServiceWorker: All components initialized successfully");
  } catch (error) {
    console.error("ServiceWorker: Component initialization failed:", error);
    throw error;
  }
}

/**
 * 🔄 初始化 TokenManager（使用新的数据库引用）
 */
async function initializeTokenManagerWithDb(localDb: any): Promise<void> {
  if (tokenManager) return;

  try {
    console.log(
      "ServiceWorker: Initializing TokenManager with new db reference...",
    );

    const { TokenManager } = await import("./token-manager.js");
    tokenManager = new TokenManager({
      apiUrl: import.meta.env.VITE_API_URL || "http://localhost:8082",
      broadcastToAllClients: broadcastToAllClients,
    });

    await tokenManager.initialize(localDb);
    console.log("ServiceWorker: TokenManager initialized successfully");
  } catch (error) {
    console.error("ServiceWorker: Failed to initialize TokenManager:", error);
    throw error;
  }
}

/**
 * 🔄 初始化 DataCacheManager（使用新的数据库引用）
 */
async function initializeDataCacheManagerWithDb(
  localDb: any,
  remoteDb: any,
): Promise<void> {
  if (dataCacheManager) return;

  try {
    console.log(
      "ServiceWorker: Initializing DataCacheManager with new db references...",
    );

    const { DataCacheManager } = await import("./data-cache-manager.js");
    dataCacheManager = new DataCacheManager({
      localDb: localDb,
      remoteDb: remoteDb,
      broadcastToAllClients: broadcastToAllClients,
    });

    await dataCacheManager.initialize();
    console.log("ServiceWorker: DataCacheManager initialized successfully");
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to initialize DataCacheManager:",
      error,
    );
    throw error;
  }
}

/**
 * 🔄 初始化 EnhancedQueryHandler（使用新的数据库引用）
 */
async function initializeEnhancedQueryHandlerWithDb(
  localDb: any,
  remoteDb: any,
): Promise<void> {
  if (enhancedQueryHandler) return;

  try {
    console.log(
      "ServiceWorker: Initializing EnhancedQueryHandler with new db references...",
    );

    // 确保依赖组件已初始化
    if (!dataCacheManager) {
      throw new Error("DataCacheManager must be initialized first");
    }

    const { EnhancedQueryHandler } = await import(
      "./enhanced-query-handler.js"
    );
    enhancedQueryHandler = new EnhancedQueryHandler(
      localDb,
      dataCacheManager,
      broadcastToAllClients,
      remoteDb,
    );

    console.log("ServiceWorker: EnhancedQueryHandler initialized successfully");
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to initialize EnhancedQueryHandler:",
      error,
    );
    throw error;
  }
}

/**
 * 🔄 初始化 OfflineManager（使用新的数据库引用）
 */
async function initializeOfflineManagerWithDb(
  localDb: any,
  remoteDb: any,
): Promise<void> {
  if (offlineManager) return;

  try {
    console.log(
      "ServiceWorker: Initializing OfflineManager with new db references...",
    );

    const { OfflineManager } = await import("./offline-manager.js");
    offlineManager = new OfflineManager({
      localDb: localDb,
      remoteDb: remoteDb,
      broadcastToAllClients,
    });

    console.log("ServiceWorker: OfflineManager initialized successfully");
  } catch (error) {
    console.error("ServiceWorker: Failed to initialize OfflineManager:", error);
    throw error;
  }
}

/**
 * 🔄 初始化 DataConsistencyManager（使用新的数据库引用）
 */
async function initializeDataConsistencyManagerWithDb(
  localDb: any,
  remoteDb: any,
): Promise<void> {
  if (dataConsistencyManager) return;

  try {
    console.log(
      "ServiceWorker: Initializing DataConsistencyManager with new db references...",
    );

    const { DataConsistencyManager } = await import(
      "./data-consistency-manager.js"
    );
    dataConsistencyManager = new DataConsistencyManager({
      localDb: localDb,
      remoteDb: remoteDb,
      broadcastToAllClients,
    });

    console.log(
      "ServiceWorker: DataConsistencyManager initialized successfully",
    );
  } catch (error) {
    console.error(
      "ServiceWorker: Failed to initialize DataConsistencyManager:",
      error,
    );
    throw error;
  }
}

/**
 * 🔄 回退到旧的初始化逻辑
 */
async function legacyInitialization(): Promise<void> {
  console.log("ServiceWorker: Starting legacy initialization...");

  try {
    // 初始化本地 SurrealDB
    await initializeLocalSurrealDB();
    // 初始化 TokenManager
    await initializeTokenManager();
    // 初始化 DataCacheManager
    await initializeDataCacheManager();
    // 初始化 EnhancedQueryHandler
    await initializeEnhancedQueryHandler();
    // 初始化 PageAwareSubscriptionManager
    await initializePageAwareSubscriptionManager();
    // 初始化 OfflineManager
    await initializeOfflineManager();
    // 初始化 ConnectionRecoveryManager
    await initializeConnectionRecoveryManager();
    // 初始化 DataConsistencyManager
    await initializeDataConsistencyManager();

    // 初始化静态资源缓存管理器
    await initializeStaticCacheManager();

    // 初始化网络状态管理器
    await initializeNetworkStateManager();

    // 初始化PWA协作增强器
    await initializePWACollaborationEnhancer();

    // 初始化PWA性能管理器
    await initializePWAPerformanceManager();

    // 初始化PWA安全管理器
    await initializePWASecurityManager();

    // 尝试恢复连接配置
    const restoredConfig = await restoreConnectionConfig();
    if (restoredConfig) {
      connectionConfig = restoredConfig;
      console.log(
        "ServiceWorker: Connection config restored during activation",
      );

      // 尝试自动重连
      try {
        const connectionState = await ensureConnection();
        if (connectionState.isConnected) {
          console.log(
            "ServiceWorker: Auto-reconnection successful after activation",
          );
        } else {
          console.warn(
            "ServiceWorker: Auto-reconnection failed after activation:",
            connectionState.error,
          );
        }
      } catch (reconnectError) {
        console.warn(
          "ServiceWorker: Auto-reconnection failed after activation:",
          reconnectError,
        );
      }
    }

    // Service Worker 激活后，主动同步 localStorage 中的 token
    await syncTokensFromLocalStorage();

    console.log("ServiceWorker: Legacy initialization completed");
  } catch (error) {
    console.error("ServiceWorker: Legacy initialization failed:", error);
    throw error;
  }
}

/**
 * 🔄 回退到旧的清理逻辑
 */
async function legacyCleanup(): Promise<void> {
  try {
    stopReconnection();
    stopConnectionHealthCheck();
    stopAuthStateRefresh();
    clearAuthStateCache();
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

    // 关闭 PageAwareSubscriptionManager
    if (pageAwareSubscriptionManager) {
      await pageAwareSubscriptionManager.close();
      pageAwareSubscriptionManager = null;
    }

    // 关闭 OfflineManager
    if (offlineManager) {
      await offlineManager.close();
      offlineManager = null;
    }

    // 关闭 ConnectionRecoveryManager
    if (connectionRecoveryManager) {
      await connectionRecoveryManager.close();
      connectionRecoveryManager = null;
    }

    // 关闭 DataConsistencyManager
    if (dataConsistencyManager) {
      await dataConsistencyManager.close();
      dataConsistencyManager = null;
    }

    // 关闭 EnhancedQueryHandler
    if (enhancedQueryHandler) {
      await enhancedQueryHandler.cleanup();
      enhancedQueryHandler = null;
    }

    // 关闭本地数据库
    if (localDb) {
      await localDb.close();
      localDb = null;
    }

    console.log("ServiceWorker: Legacy cleanup completed");
  } catch (error) {
    console.error("ServiceWorker: Legacy cleanup failed:", error);
  }
}

/**
 * 🧹 清理所有组件
 */
async function cleanupAllComponents(): Promise<void> {
  try {
    // 清理静态缓存管理器
    if (staticCacheManager) {
      staticCacheManager = null;
    }

    // 清理网络状态管理器
    if (networkStateManager) {
      networkStateManager = null;
    }

    // 清理PWA组件
    if (pwaPushManager) {
      pwaPushManager = null;
    }

    if (pwaCollaborationEnhancer) {
      pwaCollaborationEnhancer = null;
    }

    if (pwaPerformanceManager) {
      pwaPerformanceManager = null;
    }

    if (pwaSecurityManager) {
      pwaSecurityManager = null;
    }

    console.log("ServiceWorker: All components cleaned up");
  } catch (error) {
    console.error("ServiceWorker: Component cleanup failed:", error);
  }
}
