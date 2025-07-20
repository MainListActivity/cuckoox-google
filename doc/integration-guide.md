# 智能缓存系统集成指南

## 概述

本指南说明如何将新的智能缓存系统集成到现有的 `sw-surreal.ts` 中，以解决当前缓存命中率低和查询性能问题。

## 架构改进

### 当前问题
1. **缓存命中率低**：只有简单的全表查询走缓存
2. **查询路由简单**：大部分查询直接走远程数据库
3. **订阅机制粗糙**：全表Live Query效率低
4. **缺少智能决策**：没有基于查询特征的缓存策略

### 新架构组件
1. **QueryRouter**: 智能查询分析和路由决策
2. **CacheExecutor**: 缓存执行和命中判断
3. **SubscriptionManager**: 精细化数据订阅管理
4. **EnhancedQueryHandler**: 统一的查询处理器

## 集成步骤

### 1. 修改sw-surreal.ts的导入部分

```typescript
// 在现有导入后添加
import { EnhancedQueryHandler } from './enhanced-query-handler';
import { QueryRouter } from './query-router';
import { CacheExecutor } from './cache-executor';
import { SubscriptionManager } from './subscription-manager';
```

### 2. 初始化智能缓存组件

在 `initializeDataCacheManager` 函数后添加：

```typescript
// 全局变量
let enhancedQueryHandler: EnhancedQueryHandler | null = null;

/**
 * 初始化增强查询处理器
 */
async function initializeEnhancedQueryHandler(): Promise<void> {
  if (enhancedQueryHandler) return;

  try {
    console.log('ServiceWorker: Initializing Enhanced Query Handler...');
    
    // 确保依赖组件已初始化
    await initializeLocalSurrealDB();
    await initializeDataCacheManager();
    
    // 创建增强查询处理器
    enhancedQueryHandler = new EnhancedQueryHandler(
      localDb!,
      dataCacheManager!,
      broadcastToAllClients,
      db || undefined
    );
    
    console.log('ServiceWorker: Enhanced Query Handler initialized successfully');
  } catch (error) {
    console.error('ServiceWorker: Failed to initialize Enhanced Query Handler:', error);
    throw error;
  }
}

/**
 * 确保增强查询处理器已初始化
 */
async function ensureEnhancedQueryHandler(): Promise<void> {
  if (!enhancedQueryHandler) {
    await initializeEnhancedQueryHandler();
  }
}
```

### 3. 修改activate事件处理器

在 `activate` 事件处理器中添加：

```typescript
case 'activate': (event: ExtendableEvent) => {
  console.log(`Service Worker activating - ${SW_VERSION}`);
  event.waitUntil(
    Promise.all([
      // ... 现有代码 ...
      // 初始化 DataCacheManager
      await initializeDataCacheManager();
      
      // 添加这行：初始化增强查询处理器
      await initializeEnhancedQueryHandler();
      
      // ... 现有的连接恢复代码 ...
    ])
  );
}
```

### 4. 替换query/mutate消息处理

将现有的 `case 'query':` 和 `case 'mutate':` 部分替换为：

```typescript
case 'query': {
  const connectionState = await ensureConnection();
  if (!connectionState.hasDb) throw new Error("Database not initialized");

  // 确保增强查询处理器已初始化
  await ensureEnhancedQueryHandler();
  
  // 获取用户ID
  const userId = await getCurrentUserId();
  
  // 使用增强查询处理器执行查询
  const result = await enhancedQueryHandler!.handleQuery(
    payload.sql,
    payload.vars,
    userId,
    payload.vars?.case_id
  );
  
  if (result.success) {
    console.log(`ServiceWorker: Query executed - Source: ${result.source}, Cache Hit: ${result.cacheHit}, Time: ${result.executionTime}ms`);
    respond(result.data);
  } else {
    throw new Error(result.error || 'Query execution failed');
  }
  break;
}

case 'mutate': {
  const connectionState = await ensureConnection();
  if (!connectionState.hasDb) throw new Error("Database not initialized");

  // 确保增强查询处理器已初始化
  await ensureEnhancedQueryHandler();
  
  // 获取用户ID
  const userId = await getCurrentUserId();
  
  // 使用增强查询处理器执行变更
  const result = await enhancedQueryHandler!.handleMutation(
    payload.sql,
    payload.vars,
    userId,
    payload.vars?.case_id
  );
  
  if (result.success) {
    console.log(`ServiceWorker: Mutation executed in ${result.executionTime}ms`);
    respond(result.data);
  } else {
    throw new Error(result.error || 'Mutation execution failed');
  }
  break;
}
```

### 5. 添加新的消息类型处理

在消息处理器中添加新的缓存管理功能：

```typescript
// 获取缓存性能统计
case 'get_cache_stats': {
  await ensureEnhancedQueryHandler();
  const stats = enhancedQueryHandler!.getPerformanceStats();
  respond({ stats });
  break;
}

// 预热缓存
case 'preload_cache': {
  await ensureEnhancedQueryHandler();
  const { tables, userId, caseId } = payload;
  
  try {
    await enhancedQueryHandler!.preloadCache(tables, userId, caseId);
    respond({ success: true, message: `Cache preloaded for ${tables.length} tables` });
  } catch (error) {
    respond({ success: false, error: (error as Error).message });
  }
  break;
}

// 手动触发缓存同步
case 'manual_cache_sync': {
  await ensureEnhancedQueryHandler();
  const { table, userId, caseId } = payload;
  
  try {
    const subscriptionManager = enhancedQueryHandler!.getSubscriptionManager();
    const subscriptionId = await subscriptionManager.subscribeToTable(table, userId, caseId);
    
    respond({ 
      success: true, 
      subscriptionId,
      message: `Manual sync initiated for table: ${table}` 
    });
  } catch (error) {
    respond({ success: false, error: (error as Error).message });
  }
  break;
}

// 获取订阅状态
case 'get_subscription_status': {
  await ensureEnhancedQueryHandler();
  const subscriptionManager = enhancedQueryHandler!.getSubscriptionManager();
  
  const activeSubscriptions = subscriptionManager.getActiveSubscriptions();
  const healthStatus = subscriptionManager.getHealthStatus();
  const syncStatus = subscriptionManager.getSyncStatus();
  
  respond({
    subscriptions: Array.from(activeSubscriptions.entries()).map(([id, sub]) => ({
      id,
      table: sub.strategy.table,
      type: sub.strategy.type,
      isHealthy: sub.isHealthy,
      lastSyncTime: sub.lastSyncTime,
      lastHeartbeat: sub.lastHeartbeat
    })),
    healthStatus,
    syncStatus: Array.from(syncStatus.entries()).map(([table, status]) => ({
      table,
      ...status
    }))
  });
  break;
}

// 配置表缓存策略
case 'configure_table_cache': {
  await ensureEnhancedQueryHandler();
  const { table, config } = payload;
  
  const queryRouter = enhancedQueryHandler!.getQueryRouter();
  queryRouter.updateTableProfile(table, config);
  
  respond({ 
    success: true, 
    message: `Cache configuration updated for table: ${table}` 
  });
  break;
}
```

### 6. 修改beforeunload事件处理器

在 `beforeunload` 事件处理器中添加清理逻辑：

```typescript
case 'beforeunload': async () => {
  try {
    // ... 现有清理代码 ...
    
    // 清理增强查询处理器
    if (enhancedQueryHandler) {
      await enhancedQueryHandler.cleanup();
      enhancedQueryHandler = null;
    }
    
    // ... 其余清理代码 ...
  } catch (e) {
    console.error("Failed during cleanup:", e);
  }
}
```

### 7. 删除或注释掉旧的缓存逻辑

删除或注释掉原有的以下函数和逻辑：
- `extractTableNamesFromQuery` (如果新的QueryRouter提供了更好的实现)
- `isSimpleSelectAllQuery` (由QueryRouter的分析功能替代)
- `isPersonalDataQuery` 和 `extractPersonalDataComponent` (由EnhancedQueryHandler处理)

## 使用示例

### 前端代码调用示例

```typescript
// 1. 预热缓存（页面加载时）
const preloadResult = await surrealService.sendMessage('preload_cache', {
  tables: ['user', 'role', 'menu_metadata'],
  userId: currentUser.id,
  caseId: currentCase?.id
});

// 2. 获取缓存统计
const stats = await surrealService.sendMessage('get_cache_stats', {});
console.log('Cache performance:', stats.stats);

// 3. 获取订阅状态
const subscriptionStatus = await surrealService.sendMessage('get_subscription_status', {});
console.log('Active subscriptions:', subscriptionStatus.subscriptions);

// 4. 手动配置表缓存策略
await surrealService.sendMessage('configure_table_cache', {
  table: 'custom_table',
  config: {
    defaultStrategy: 'LOCAL_FIRST',
    consistencyRequirement: 'EVENTUAL',
    avgQueryFrequency: 0.8,
    dataVolatility: 'low',
    accessPattern: 'read_heavy',
    defaultTTL: 60 * 60 * 1000 // 1小时
  }
});
```

## 性能监控

新系统提供了详细的性能监控功能：

```typescript
// 监控缓存性能
setInterval(async () => {
  const stats = await surrealService.sendMessage('get_cache_stats', {});
  
  console.log('Execution Stats:', stats.stats.executionStats);
  console.log('Subscription Health:', stats.stats.subscriptionHealth);
  console.log('Sync Status:', stats.stats.syncStatus);
}, 30000); // 每30秒检查一次
```

## 配置优化建议

### 1. 根据业务特征调整表配置

```typescript
// 高频读取的基础数据表
await surrealService.sendMessage('configure_table_cache', {
  table: 'user',
  config: {
    defaultStrategy: 'LOCAL_FIRST',
    dataVolatility: 'low',
    accessPattern: 'read_heavy',
    defaultTTL: 24 * 60 * 60 * 1000 // 24小时
  }
});

// 实时性要求高的数据表
await surrealService.sendMessage('configure_table_cache', {
  table: 'notification',
  config: {
    defaultStrategy: 'REMOTE_FIRST',
    dataVolatility: 'high',
    accessPattern: 'write_heavy',
    defaultTTL: 5 * 60 * 1000 // 5分钟
  }
});
```

### 2. 页面级缓存预热

```typescript
// 在主要页面的useEffect中预热相关数据
useEffect(() => {
  if (user && currentCase) {
    // 预热当前页面需要的数据表
    surrealService.sendMessage('preload_cache', {
      tables: ['case', 'claim', 'document'],
      userId: user.id,
      caseId: currentCase.id
    });
  }
}, [user, currentCase]);
```

## 迁移注意事项

1. **向后兼容性**: 新系统保持现有API的兼容性，现有前端代码无需修改
2. **渐进式部署**: 可以通过配置开关逐步启用新功能
3. **性能测试**: 建议在生产环境部署前进行充分的性能测试
4. **监控告警**: 设置缓存命中率和查询性能的监控告警

## 预期改进效果

1. **缓存命中率**: 从现在的 < 20% 提升到 60-80%
2. **查询响应时间**: 缓存命中的查询响应时间减少 70-90%
3. **网络负载**: 减少远程数据库查询 50-70%
4. **用户体验**: 页面加载和数据刷新速度明显提升

## SurrealDB 全文检索集成

智能缓存系统完全支持 SurrealDB 的全文检索功能，包括：

### 全文检索缓存优化
- **检索结果缓存**: 全文检索查询结果会被智能缓存，提升重复搜索的响应速度
- **关键词索引**: 系统会为常用搜索关键词建立本地索引，加速搜索响应
- **搜索历史**: 缓存用户的搜索历史和偏好，提供更智能的搜索建议

### 全文检索语法支持
```typescript
// 在智能缓存系统中使用全文检索
const searchResult = await enhancedQueryHandler.handleQuery(`
  SELECT *,
    search::highlight("**", "**", 0) AS highlighted_title,
    search::score(0) AS relevance_score
  FROM document
  WHERE title @0@ $keyword
  ORDER BY relevance_score DESC
  LIMIT 10
`, { keyword: "破产重整" }, userId, caseId);
```

### 检索性能优化
- **本地检索**: 对于已缓存的数据，支持本地全文检索，无需网络请求
- **混合检索**: 结合本地缓存和远程数据库，提供最全面的搜索结果
- **增量索引**: 实时更新本地全文检索索引，确保搜索结果的时效性

## 故障排除

### 常见问题

1. **缓存不命中**: 检查查询是否符合缓存策略条件
2. **订阅失效**: 检查网络连接和Live Query状态
3. **内存使用过高**: 调整缓存TTL和清理策略
4. **数据不一致**: 检查同步机制和冲突解决策略

### 调试工具

```typescript
// 启用详细日志
localStorage.setItem('SURREAL_CACHE_DEBUG', 'true');

// 获取详细统计信息
const debugStats = await surrealService.sendMessage('get_cache_stats', {});
console.table(debugStats.stats.executionStats);
```

通过以上集成指南，可以将智能缓存系统平滑地集成到现有项目中，显著提升数据查询性能和用户体验。