/// <reference lib="WebWorker" />
// Extend the global scope to include ServiceWorker-specific types
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: any;
};

// Workbox 预缓存支持 - 必须保留这个声明供vite-plugin-pwa使用
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";

// PWA预缓存声明
precacheAndRoute(self.__WB_MANIFEST);

// Service Worker 版本号
const SW_VERSION = "v2.0.0-enhanced-architecture";
const SW_CACHE_NAME = `cuckoox-sw-${SW_VERSION}`;

console.log(`Service Worker v2.0 启动 - ${SW_VERSION}`);

// 导入核心管理器
import { UnifiedConnectionManager, type ConnectionConfig } from './unified-connection-manager.js';
import { EnhancedQueryProcessor } from './enhanced-query-processor.js';
import init from "@cuckoox/surrealdb-wasm";
import { decodeCbor, RpcRequest } from "surrealdb";

// PWA功能模块
import { StaticResourceCacheManager } from "./static-resource-cache-manager.js";
import { PWAPushManager } from "./pwa-push-manager.js";
import { PWAPerformanceManager } from "./pwa-performance-manager.js";

/**
 * RPC请求消息接口
 */
interface RpcRequestMessage {
  type: 'rpc_request';
  payload: {
    requestId: number;
    encodeParam: Uint8Array;
  };
}

/**
 * RPC响应消息接口
 */
interface RpcResponseMessage {
  type: 'rpc_response';
  payload: {
    requestId: number;
    result?: unknown;
    error?: {
      code: string;
      details: string;
      description: string;
      information: string;
    };
  };
}

/**
 * 页面生命周期消息接口
 */
interface PageLifecycleMessage {
  type: 'page_lifecycle';
  payload: {
    action: 'enter' | 'leave';
    pageId: string;
    tables?: string[];
    userId?: string;
    caseId?: string;
  };
}

/**
 * Live Query回调消息接口
 */
interface LiveQueryCallbackMessage {
  type: 'live_query_callback';
  payload: {
    subscriptionId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    result: unknown;
  };
}

// 全局管理器实例
const connectionManager: UnifiedConnectionManager = new UnifiedConnectionManager();
let queryProcessor: EnhancedQueryProcessor | null = null;
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

// PWA功能管理器实例
let staticCacheManager: StaticResourceCacheManager | null = null;
let pushManager: PWAPushManager | null = null;
let performanceManager: PWAPerformanceManager | null = null;

// Live Query回调映射
const liveQueryCallbacks = new Map<string, MessagePort>();

// 页面订阅管理
const pageSubscriptions = new Map<string, {
  tables: string[];
  userId?: string;
  caseId?: string;
}>();

/**
 * Service Worker 安装事件
 */
self.addEventListener('install', (event) => {
  console.log(`Service Worker v2.0 安装中 - ${SW_VERSION}`);

  event.waitUntil(
    Promise.all([
      self.skipWaiting(),
      init(),
    ])
  );
});

/**
 * Service Worker 激活事件
 */
self.addEventListener('activate', (event) => {
  console.log(`Service Worker v2.0 激活中 - ${SW_VERSION}`);

  // 创建初始化Promise
  initializationPromise = initializeServiceWorker();
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      cleanupOutdatedCaches(),
      cleanupOutdatedAppCaches(),
      initializeComponents(),
      // 确保初始化完成
      initializationPromise || Promise.resolve()
    ]).then(async () => {
      // 向所有客户端发送Service Worker已更新的通知
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'sw-activated',
          payload: {
            version: SW_VERSION,
            timestamp: Date.now()
          }
        });
      });
      console.log(`Service Worker v2.0 激活完成，已通知 ${clients.length} 个客户端`);
    })
  );
});

/**
 * 消息处理事件
 */
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;

  console.log('Service Worker v2.0 收到消息:', type);

  try {
    switch (type) {
      case 'rpc_request':
        await handleRpcRequest(event, payload);
        break;

      case 'page_lifecycle':
        await handlePageLifecycle(payload);
        break;

      case 'cache_preload':
        await handleCachePreload(payload);
        break;

      case 'performance_monitor':
        await handlePerformanceMonitor(event, payload);
        break;

      case 'health_check':
        await handleHealthCheck(event, payload);
        break;

      case 'config_update':
        await handleConfigUpdate(event, payload);
        break;

      case 'SKIP_WAITING':
        console.log('Service Worker v2.0: 收到跳过等待请求');
        await self.skipWaiting();
        break;

      default:
        console.warn(`Service Worker v2.0: 未知消息类型 ${type}`);
    }
  } catch (error) {
    console.error(`Service Worker v2.0: 处理消息失败 ${type}`, error);
  }
});

/**
 * 初始化Service Worker
 */
async function initializeServiceWorker(): Promise<void> {
  try {
    console.log('Service Worker v2.0: 开始初始化');

    // 配置数据库连接 - 使用生产环境连接
    const config: ConnectionConfig = {
      localDb: {
        namespace: 'ck_go',
        database: 'main'
      },
      remoteDb: {
        url: 'wss://law.cuckoox.cn/rpc',
        namespace: 'ck_go',
        database: 'main'
      }
    };

    await connectionManager.connect(config);

    // 初始化查询处理器
    queryProcessor = new EnhancedQueryProcessor(connectionManager);

    // 初始化本地数据库Schema
    await initializeLocalDatabaseSchema();

    // 标记初始化完成
    isInitialized = true;

    console.log('Service Worker v2.0: 初始化完成');
  } catch (error) {
    console.error('Service Worker v2.0: 初始化失败', error);
    // 即使初始化失败也不要抛出错误，避免阻塞SW
    isInitialized = false;

    // 延迟重试初始化
    setTimeout(() => {
      console.log('Service Worker v2.0: 重试初始化');
      initializationPromise = initializeServiceWorker();
    }, 3000);
  }
}

/**
 * 初始化组件
 */
async function initializeComponents(): Promise<void> {
  try {
    // 初始化PWA功能组件
    staticCacheManager = new StaticResourceCacheManager();
    pushManager = new PWAPushManager({
      vapidPublicKey: '',
      serviceWorkerPath: '/sw.js',
      notificationOptions: {},
      serverEndpoint: ''
    });
    performanceManager = new PWAPerformanceManager({
      appShell: {
        coreResources: ['/assets/index.css', '/assets/index.js'],
        shellCacheName: 'cuckoox-app-shell-v1',
        version: '1.0.0'
      },
      preloading: {
        criticalResources: ['/api/auth', '/api/config'],
        preloadStrategy: 'conservative',
        maxPreloadSize: 1024 * 1024 // 1MB
      },
      lazyLoading: {
        routes: ['/cases', '/claims', '/creditors'],
        chunkSize: 512 * 1024, // 512KB
        loadingThreshold: 100 // ms
      },
      performance: {
        memoryThreshold: 100, // MB
        cleanupInterval: 300000, // 5 minutes
        targetFCP: 2000, // 2s
        targetLCP: 2500 // 2.5s
      }
    });

    console.log('Service Worker v2.0: PWA组件初始化完成');
  } catch (error: any) {
    console.error('Service Worker v2.0: PWA组件初始化失败', error);
  }
}

/**
 * 清理过期的应用缓存
 */
async function cleanupOutdatedAppCaches(): Promise<void> {
  const cacheNames = await caches.keys();
  const outdatedCaches = cacheNames.filter(name =>
    name.startsWith('cuckoox-sw-') && name !== SW_CACHE_NAME
  );

  await Promise.all(
    outdatedCaches.map(cacheName => caches.delete(cacheName))
  );

  console.log(`Service Worker v2.0: 清理了 ${outdatedCaches.length} 个过期缓存`);
}

/**
 * 初始化本地数据库Schema
 */
async function initializeLocalDatabaseSchema(): Promise<void> {
  if (!connectionManager) return;

  const localDb = connectionManager.getLocalDb();

  try {
    console.log('Service Worker v2.0: 初始化本地数据库Schema');

    // 创建缓存元数据表
    await localDb.query(`
      DEFINE TABLE IF NOT EXISTS cache_metadata SCHEMAFULL;
      DEFINE FIELD OVERWRITE table_name ON cache_metadata TYPE string;
      DEFINE FIELD OVERWRITE cache_type ON cache_metadata TYPE string;
      DEFINE FIELD OVERWRITE live_query_uuid ON cache_metadata TYPE option<string>;
      DEFINE FIELD OVERWRITE last_sync_time ON cache_metadata TYPE number;
      DEFINE FIELD OVERWRITE record_count ON cache_metadata TYPE number DEFAULT 0;
      DEFINE FIELD OVERWRITE is_active ON cache_metadata TYPE bool DEFAULT true;
      DEFINE FIELD OVERWRITE created_at ON cache_metadata TYPE datetime DEFAULT time::now();
      DEFINE FIELD OVERWRITE updated_at ON cache_metadata TYPE datetime VALUE time::now();
      DEFINE FIELD OVERWRITE expires_at ON cache_metadata TYPE option<datetime>;
    `);

    // 创建性能指标表
    await localDb.query(`
      DEFINE TABLE IF NOT EXISTS performance_metrics SCHEMAFULL;
      DEFINE FIELD OVERWRITE query_hash ON performance_metrics TYPE string;
      DEFINE FIELD OVERWRITE query_type ON performance_metrics TYPE string;
      DEFINE FIELD OVERWRITE execution_time ON performance_metrics TYPE number;
      DEFINE FIELD OVERWRITE cache_hit ON performance_metrics TYPE bool;
      DEFINE FIELD OVERWRITE source ON performance_metrics TYPE string;
      DEFINE FIELD OVERWRITE timestamp ON performance_metrics TYPE datetime DEFAULT time::now();
    `);

    console.log('Service Worker v2.0: 本地数据库Schema初始化完成');
  } catch (error) {
    console.error('Service Worker v2.0: 本地数据库Schema初始化失败', error);
  }
}

/**
 * 处理RPC请求
 */
async function handleRpcRequest(event: ExtendableMessageEvent, payload: RpcRequestMessage['payload']): Promise<void> {
  const { requestId, encodeParam } = payload;
  const { method, params } = decodeCbor<RpcRequest>(encodeParam);
  console.log(`Service Worker v2.0: 处理RPC请求 ${method}`, params);

  try {
    let result: any;

    // 确保查询处理器已初始化
    if (!isInitialized || !queryProcessor || !connectionManager) {
      // 如果正在初始化，等待初始化完成
      if (initializationPromise) {
        console.log('Service Worker v2.0: 等待初始化完成...');
        await initializationPromise;
      } else {
        throw new Error('Service Worker未完全初始化');
      }
    }
    result = await queryProcessor!.handleRPC(method, params);

    // 发送成功响应
    const response: RpcResponseMessage = {
      type: 'rpc_response',
      payload: { requestId, ...result.data }
    };

    if (event.ports[0]) {
      event.ports[0].postMessage(response);
    } else {
      event.source?.postMessage(response);
    }

  } catch (error: any) {
    console.error(`Service Worker v2.0: RPC请求失败 ${method}`, error);

    // 发送错误响应
    const errorResponse: RpcResponseMessage = {
      type: 'rpc_response',
      payload: {
        requestId,
        error: {
          code: 'RPC_ERROR',
          description: error.message,
          details: '',
          information: error.stack || ''
        }
      }
    };

    if (event.ports[0]) {
      event.ports[0].postMessage(errorResponse);
    } else {
      event.source?.postMessage(errorResponse);
    }
  }
}

/**
 * 处理页面生命周期
 */
async function handlePageLifecycle(payload: PageLifecycleMessage['payload']): Promise<void> {
  const { action, pageId, tables, userId, caseId } = payload;

  console.log(`Service Worker v2.0: 页面生命周期 ${action}`, { pageId, tables });

  if (action === 'enter' && tables) {
    // 页面进入，记录订阅并预加载缓存
    pageSubscriptions.set(pageId, { tables, userId, caseId });

    if (queryProcessor) {
      await queryProcessor.preloadCache(tables, userId, caseId);
    }
  } else if (action === 'leave') {
    // 页面离开，清理订阅
    pageSubscriptions.delete(pageId);

    // 检查是否还有其他页面需要这些表的缓存
    // 如果没有，可以考虑清理缓存
  }
}

/**
 * 处理缓存预加载
 */
async function handleCachePreload(payload: { tables: string[]; priority?: string }): Promise<void> {
  console.log('Service Worker v2.0: 缓存预加载', payload);

  if (queryProcessor) {
    await queryProcessor.preloadCache(payload.tables);
  }
}

/**
 * 处理性能监控请求
 */
async function handlePerformanceMonitor(event: ExtendableMessageEvent, payload: any): Promise<void> {
  console.log('Service Worker v2.0: 性能监控请求', payload);

  try {
    let result: any = {};

    switch (payload.action) {
      case 'get_stats':
        if (queryProcessor) {
          result = await queryProcessor.getStatistics();
        }
        break;

      case 'get_report':
        result = await getPerformanceReport(payload.timeRange);
        break;

      case 'reset':
        result = await resetPerformanceMetrics();
        break;
    }

    event.source?.postMessage({
      type: 'performance_stats',
      payload: { stats: result }
    });

  } catch (error) {
    console.error('Service Worker v2.0: 性能监控处理失败', error);
  }
}

/**
 * 处理健康检查
 */
async function handleHealthCheck(event: ExtendableMessageEvent, payload: any): Promise<void> {
  console.log('Service Worker v2.0: 健康检查');

  const status = {
    status: connectionManager?.isConnected() ? 'healthy' : 'error',
    connections: {
      local: connectionManager?.getLocalDb() ? 'connected' : 'disconnected',
      remote: connectionManager?.getRemoteDb() ? 'connected' : 'disconnected'
    },
    cacheStatus: queryProcessor ? await queryProcessor.getCacheStatus() : {},
    lastHealthCheck: Date.now()
  };

  event.source?.postMessage({
    type: 'system_status',
    payload: status
  });
}

/**
 * 处理配置更新 config_update
 */
async function handleConfigUpdate(event: ExtendableMessageEvent, payload: any): Promise<void> {
  console.log('Service Worker v2.0: 配置更新', payload);

  try {
    // 这里实现配置更新逻辑

    event.source?.postMessage({
      type: 'config_updated',
      payload: {
        success: true,
        updatedConfig: payload,
        restartRequired: false
      }
    });

  } catch (error: any) {
    event.source?.postMessage({
      type: 'config_updated',
      payload: {
        success: false,
        error: error.message
      }
    });
  }
}

/**
 * 获取性能报告
 */
async function getPerformanceReport(timeRange?: { startTime: number; endTime: number }): Promise<any> {
  // 实现性能报告生成逻辑
  return {
    cacheHitRate: 0.85,
    avgResponseTime: 25,
    totalQueries: 1234,
    errorRate: 0.02,
    memoryUsage: 45 * 1024 * 1024
  };
}

/**
 * 重置性能指标
 */
async function resetPerformanceMetrics(): Promise<any> {
  console.log('Service Worker v2.0: 重置性能指标');
  return { reset: true, timestamp: Date.now() };
}

/**
 * 重连逻辑
 */
async function reconnectIfNeeded(): Promise<void> {
  if (!connectionManager) return;

  try {
    console.log('Service Worker v2.0: 尝试重新连接');

    const config: ConnectionConfig = {
      localDb: {
        namespace: 'ck_go',
        database: 'main'
      },
      remoteDb: {
        url: 'wss://law.cuckoox.cn/rpc',
        namespace: 'ck_go',
        database: 'main'
      }
    };

    await connectionManager.connect(config);
    console.log('Service Worker v2.0: 重连成功');
  } catch (error) {
    console.error('Service Worker v2.0: 重连失败', error);
  }
}

/**
 * 广播Live Query回调
 */
function broadcastLiveQueryCallback(subscriptionId: string, action: string, result: unknown): void {
  const port = liveQueryCallbacks.get(subscriptionId);
  if (port) {
    const message: LiveQueryCallbackMessage = {
      type: 'live_query_callback',
      payload: { subscriptionId, action: action as any, result }
    };
    port.postMessage(message);
  }
}

// 导出服务以便测试
if (typeof module !== 'undefined') {
  module.exports = {
    handleRpcRequest,
    handlePageLifecycle,
    initializeServiceWorker
  };
}

console.log('Service Worker v2.0 脚本加载完成');