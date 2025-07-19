# 增强缓存系统 API 文档

## 概述

本文档详细描述了增强本地数据库缓存同步系统提供的API接口。这些接口允许开发者充分利用智能缓存功能，监控系统性能，并根据业务需求进行优化配置。

## Service Worker 消息接口

### 查询操作

#### `query` - 智能查询
执行SurrealQL查询，系统自动选择最优的数据源（本地缓存或远程数据库）。

```typescript
// 发送消息
const result = await sendMessage({
  type: 'query',
  data: {
    sql: 'SELECT * FROM case WHERE status = "active"',
    params: { limit: 100 },
    userId: 'user:123',
    caseId: 'case:456'
  }
});

// 响应格式
interface QueryResponse {
  success: boolean;
  data: any[];
  metadata: {
    source: 'local' | 'remote' | 'hybrid';
    executionTime: number;
    cacheHit: boolean;
    fromCache: boolean;
  };
  error?: string;
}
```

#### `mutate` - 数据变更
执行数据修改操作，始终使用远程数据库并更新本地缓存。

```typescript
// 发送消息
const result = await sendMessage({
  type: 'mutate',
  data: {
    sql: 'UPDATE case:123 SET status = "closed"',
    params: {},
    userId: 'user:123',
    caseId: 'case:456'
  }
});

// 响应格式同 query
```

### 缓存管理操作

#### `get_cache_stats` - 获取缓存统计
获取详细的缓存性能统计信息。

```typescript
// 发送消息
const stats = await sendMessage({
  type: 'get_cache_stats',
  data: {}
});

// 响应格式
interface CacheStatsResponse {
  success: boolean;
  data: {
    // 总体统计
    totalQueries: number;
    cacheHitRate: number;
    avgResponseTime: number;
    
    // 执行统计
    executionStats: {
      localQueries: number;
      remoteQueries: number;
      hybridQueries: number;
      avgLocalTime: number;
      avgRemoteTime: number;
    };
    
    // 表级统计
    tableStats: Record<string, {
      queries: number;
      cacheHits: number;
      hitRate: number;
      avgResponseTime: number;
      lastAccessed: number;
    }>;
    
    // 订阅健康状态
    subscriptionHealth: {
      totalSubscriptions: number;
      healthySubscriptions: number;
      unhealthySubscriptions: number;
      reconnectionAttempts: number;
      lastHealthCheck: number;
    };
    
    // 同步状态
    syncStatus: {
      lastSyncTime: number;
      pendingSyncs: number;
      failedSyncs: number;
      syncErrors: string[];
    };
  };
}
```

#### `preload_cache` - 缓存预热
预加载指定表的数据到本地缓存。

```typescript
// 发送消息
const result = await sendMessage({
  type: 'preload_cache',
  data: {
    tables: ['user', 'role', 'case'],
    userId: 'user:123',
    caseId: 'case:456',
    priority: 'high' // 'high' | 'normal' | 'low'
  }
});

// 响应格式
interface PreloadResponse {
  success: boolean;
  data: {
    preloadedTables: string[];
    totalRecords: number;
    executionTime: number;
    errors: string[];
  };
}
```

#### `get_subscription_status` - 获取订阅状态
获取当前活跃的Live Query订阅状态。

```typescript
// 发送消息
const status = await sendMessage({
  type: 'get_subscription_status',
  data: {}
});

// 响应格式
interface SubscriptionStatusResponse {
  success: boolean;
  data: {
    activeSubscriptions: Array<{
      id: string;
      table: string;
      type: 'FULL_TABLE' | 'CONDITIONAL' | 'USER_SPECIFIC' | 'CASE_SPECIFIC';
      conditions?: string;
      userId?: string;
      caseId?: string;
      createdAt: number;
      lastUpdate: number;
      isHealthy: boolean;
      reconnectCount: number;
    }>;
    totalSubscriptions: number;
    healthyCount: number;
    unhealthyCount: number;
  };
}
```

#### `configure_table_cache` - 配置表缓存策略
动态配置特定表的缓存策略。

```typescript
// 发送消息
const result = await sendMessage({
  type: 'configure_table_cache',
  data: {
    table: 'custom_table',
    config: {
      cacheType: 'persistent', // 'persistent' | 'temporary'
      syncStrategy: 'auto',    // 'auto' | 'manual' | 'live'
      syncInterval: 300000,    // 5分钟（毫秒）
      ttl: 3600000,           // 1小时（毫秒）
      priority: 8,            // 1-10
      consistencyLevel: 'eventual', // 'strong' | 'eventual' | 'weak'
      enableLiveQuery: true,
      enableIncrementalSync: true
    }
  }
});

// 响应格式
interface ConfigureResponse {
  success: boolean;
  data: {
    table: string;
    previousConfig: TableCacheConfig;
    newConfig: TableCacheConfig;
    appliedAt: number;
  };
}
```

#### `clear_table_cache` - 清除表缓存
清除指定表的本地缓存数据。

```typescript
// 发送消息
const result = await sendMessage({
  type: 'clear_table_cache',
  data: {
    tables: ['case', 'claim'], // 要清除的表名数组
    userId?: 'user:123',       // 可选：仅清除特定用户的缓存
    caseId?: 'case:456'        // 可选：仅清除特定案件的缓存
  }
});

// 响应格式
interface ClearCacheResponse {
  success: boolean;
  data: {
    clearedTables: string[];
    totalRecordsCleared: number;
    executionTime: number;
  };
}
```

#### `inspect_cache_state` - 检查缓存状态
检查缓存的详细状态信息，用于调试和监控。

```typescript
// 发送消息
const state = await sendMessage({
  type: 'inspect_cache_state',
  data: {
    table?: 'case' // 可选：检查特定表，不指定则检查所有表
  }
});

// 响应格式
interface CacheStateResponse {
  success: boolean;
  data: {
    tables: Array<{
      table: string;
      recordCount: number;
      sizeBytes: number;
      lastUpdated: number;
      ttl: number;
      expiresAt: number;
      isExpired: boolean;
      cacheType: 'persistent' | 'temporary';
      priority: number;
      accessCount: number;
      lastAccessed: number;
      hitRate: number;
    }>;
    totalCacheSize: number;
    totalRecords: number;
    oldestCache: number;
    newestCache: number;
    memoryUsage: {
      used: number;
      available: number;
      percentage: number;
    };
  };
}
```

## 前端 Hook 接口

### usePageDataCache Hook

用于页面级的数据缓存管理，自动处理订阅和预加载。

```typescript
import { usePageDataCache } from '@/hooks/usePageDataCache';

interface UsePageDataCacheOptions {
  tables: string[];                    // 需要的数据表
  cacheStrategy?: 'aggressive' | 'conservative'; // 缓存策略
  preloadQueries?: Array<{
    table: string;
    query: string;
    priority: 'high' | 'normal' | 'low';
  }>;
  autoSubscribe?: boolean;             // 是否自动订阅
  userId?: string;                     // 用户ID
  caseId?: string;                     // 案件ID
}

interface UsePageDataCacheResult {
  data: any;                          // 缓存的数据
  loading: boolean;                   // 加载状态
  error: Error | null;                // 错误信息
  refresh: () => Promise<void>;       // 刷新数据
  clearCache: () => Promise<void>;    // 清除缓存
  stats: {                           // 性能统计
    cacheHitRate: number;
    avgResponseTime: number;
    lastUpdate: number;
  };
}

// 使用示例
function CasesPage() {
  const { data, loading, error, refresh, stats } = usePageDataCache({
    tables: ['case', 'case_status', 'claim'],
    cacheStrategy: 'aggressive',
    preloadQueries: [
      {
        table: 'case',
        query: 'SELECT * FROM case WHERE status != "archived" ORDER BY created_at DESC LIMIT 100',
        priority: 'high'
      }
    ],
    autoSubscribe: true
  });

  return (
    <div>
      {loading && <div>加载中...</div>}
      {error && <div>错误: {error.message}</div>}
      {data && <CaseList cases={data} />}
      <div>缓存命中率: {(stats.cacheHitRate * 100).toFixed(1)}%</div>
    </div>
  );
}
```

### useCacheStats Hook

用于监控缓存系统的性能指标。

```typescript
import { useCacheStats } from '@/hooks/useCacheStats';

interface UseCacheStatsOptions {
  refreshInterval?: number;           // 刷新间隔（毫秒）
  autoRefresh?: boolean;             // 是否自动刷新
}

interface UseCacheStatsResult {
  stats: CacheStatsResponse['data'] | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// 使用示例
function CacheMonitor() {
  const { stats, loading, refresh } = useCacheStats({
    refreshInterval: 30000, // 30秒刷新一次
    autoRefresh: true
  });

  if (loading) return <div>加载统计中...</div>;

  return (
    <div>
      <h3>缓存性能监控</h3>
      <div>总查询数: {stats?.totalQueries}</div>
      <div>缓存命中率: {((stats?.cacheHitRate || 0) * 100).toFixed(1)}%</div>
      <div>平均响应时间: {stats?.avgResponseTime}ms</div>
      <div>活跃订阅: {stats?.subscriptionHealth.healthySubscriptions}</div>
      <button onClick={refresh}>刷新统计</button>
    </div>
  );
}
```

## SurrealService 扩展接口

### 缓存管理方法

```typescript
interface SurrealService {
  // 基础查询方法（已有）
  query(sql: string, params?: any): Promise<any[]>;
  mutate(sql: string, params?: any): Promise<any[]>;
  
  // 新增缓存管理方法
  getCacheStats(): Promise<CacheStatsResponse['data']>;
  preloadCache(tables: string[], userId?: string, caseId?: string): Promise<void>;
  getSubscriptionStatus(): Promise<SubscriptionStatusResponse['data']>;
  configureTableCache(table: string, config: TableCacheConfig): Promise<void>;
  clearTableCache(tables: string[], userId?: string, caseId?: string): Promise<void>;
  inspectCacheState(table?: string): Promise<CacheStateResponse['data']>;
  
  // 调试和监控方法
  setLogLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;
  traceQueryExecution(sql: string, params?: any): Promise<QueryTrace>;
  configureCacheLimit(options: CacheLimitOptions): Promise<void>;
  configureConflictResolution(options: ConflictResolutionOptions): Promise<void>;
}
```

### 类型定义

```typescript
interface TableCacheConfig {
  table: string;
  cacheType: 'persistent' | 'temporary';
  syncStrategy: 'auto' | 'manual' | 'live';
  syncInterval: number;
  maxCacheSize: number;
  ttl: number;
  priority: number;
  consistencyLevel: 'strong' | 'eventual' | 'weak';
  enableLiveQuery: boolean;
  enableIncrementalSync: boolean;
}

interface QueryTrace {
  sql: string;
  params?: any;
  steps: Array<{
    step: string;
    startTime: number;
    endTime?: number;
    duration?: number;
    details: string;
    result?: any;
  }>;
  totalTime: number;
  source: 'local' | 'remote' | 'hybrid';
  cacheHit: boolean;
}

interface CacheLimitOptions {
  maxSize: number;                    // 最大缓存大小（字节）
  cleanupThreshold: number;           // 清理阈值（0-1）
  cleanupTarget: number;              // 清理目标（0-1）
  enableAutoCleanup: boolean;         // 是否启用自动清理
}

interface ConflictResolutionOptions {
  strategy: 'local_wins' | 'remote_wins' | 'merge' | 'manual';
  autoResolve: boolean;
  notifyOnConflict: boolean;
}
```

## 错误处理

### 错误类型

```typescript
enum CacheErrorType {
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  CACHE_FULL = 'CACHE_FULL',
  SYNC_FAILED = 'SYNC_FAILED',
  SUBSCRIPTION_FAILED = 'SUBSCRIPTION_FAILED',
  DATA_CONFLICT = 'DATA_CONFLICT',
  INVALID_CONFIG = 'INVALID_CONFIG'
}

interface CacheError extends Error {
  type: CacheErrorType;
  details: any;
  timestamp: number;
  recoverable: boolean;
}
```

### 错误处理示例

```typescript
try {
  const result = await surrealService.query('SELECT * FROM case');
} catch (error) {
  if (error instanceof CacheError) {
    switch (error.type) {
      case CacheErrorType.CONNECTION_FAILED:
        // 网络连接失败，使用本地缓存
        console.warn('使用本地缓存数据');
        break;
      case CacheErrorType.CACHE_FULL:
        // 缓存空间不足，清理缓存
        await surrealService.clearTableCache(['temporary_table']);
        break;
      case CacheErrorType.SYNC_FAILED:
        // 同步失败，稍后重试
        setTimeout(() => retry(), 5000);
        break;
    }
  }
}
```

## 最佳实践

### 1. 性能监控

```typescript
// 定期监控缓存性能
const monitorCachePerformance = async () => {
  const stats = await surrealService.getCacheStats();
  
  // 缓存命中率过低时的处理
  if (stats.cacheHitRate < 0.5) {
    console.warn('缓存命中率过低，考虑调整缓存策略');
    
    // 预热常用数据
    await surrealService.preloadCache(['user', 'role', 'case']);
  }
  
  // 响应时间过长时的处理
  if (stats.avgResponseTime > 200) {
    console.warn('响应时间过长，检查网络和缓存配置');
  }
};

// 每分钟检查一次
setInterval(monitorCachePerformance, 60000);
```

### 2. 缓存策略优化

```typescript
// 根据业务特点配置缓存策略
const optimizeCacheStrategy = async () => {
  // 用户权限数据 - 持久化缓存
  await surrealService.configureTableCache('user', {
    cacheType: 'persistent',
    syncInterval: 10 * 60 * 1000, // 10分钟
    ttl: 24 * 60 * 60 * 1000,     // 24小时
    priority: 9
  });
  
  // 实时通知 - 高频更新
  await surrealService.configureTableCache('notification', {
    cacheType: 'temporary',
    syncInterval: 30 * 1000,      // 30秒
    ttl: 10 * 60 * 1000,          // 10分钟
    priority: 10
  });
};
```

### 3. 错误恢复

```typescript
// 实现自动错误恢复机制
const setupErrorRecovery = () => {
  // 监听缓存错误事件
  surrealService.on('cache_error', async (error: CacheError) => {
    if (error.recoverable) {
      // 可恢复错误，尝试自动修复
      switch (error.type) {
        case CacheErrorType.SYNC_FAILED:
          // 重新同步数据
          await surrealService.preloadCache(['case', 'claim']);
          break;
        case CacheErrorType.SUBSCRIPTION_FAILED:
          // 重新建立订阅
          const status = await surrealService.getSubscriptionStatus();
          // 重新订阅失败的表
          break;
      }
    } else {
      // 不可恢复错误，记录并通知用户
      console.error('缓存系统严重错误:', error);
      // 可以显示用户友好的错误提示
    }
  });
};
```

## 总结

增强缓存系统提供了丰富的API接口，支持：

- **智能查询路由**: 自动选择最优数据源
- **灵活的缓存配置**: 支持表级、查询级的策略配置
- **全面的性能监控**: 提供详细的统计和调试信息
- **强大的错误处理**: 自动恢复和降级机制
- **易用的Hook接口**: 简化前端集成和使用

通过合理使用这些API，可以充分发挥智能缓存系统的优势，显著提升应用性能和用户体验。