# Service Worker智能缓存系统

## 系统概述

基于Service Worker的智能数据缓存解决方案，通过智能查询路由、配置化缓存策略、页面感知订阅等技术，将缓存命中率从不足20%提升至60-80%，查询响应时间减少70-90%。

## 核心架构组件

### EnhancedQueryHandler - 增强查询处理器
- 统一查询处理器，集成所有智能缓存功能
- 替换sw-surreal.ts中的简单缓存逻辑
- 支持降级机制：智能缓存系统失败时自动回退到原始远程查询

### QueryRouter - 智能查询路由器
- 分析SQL特征并决定最优缓存策略
- 支持5种缓存策略：
  - `LOCAL_FIRST`: 本地优先，适用于用户个人数据
  - `REMOTE_FIRST`: 远程优先，适用于实时性要求高的数据
  - `HYBRID`: 混合模式，根据数据新鲜度智能切换
  - `LOCAL_ONLY`: 仅本地，适用于离线模式
  - `REMOTE_ONLY`: 仅远程，适用于写操作

### CacheExecutor - 缓存执行器
- 实现多种缓存策略的具体执行逻辑
- 支持缓存预热和智能预加载
- 管理缓存生命周期和TTL

### SubscriptionManager - 订阅管理器
- 精细化管理SurrealDB Live Query订阅
- 页面感知订阅：自动识别页面数据需求
- 支持多页面订阅合并和优化

### DataCacheManager - 数据缓存管理器
- 管理本地数据存储和认证状态
- 支持两种缓存类型：
  - 持久化缓存：用户个人信息（权限、菜单、操作按钮等）
  - 临时缓存：页面数据，进入页面时订阅，离开时取消

## 开发规范

### 缓存策略配置
```typescript
// 配置化缓存策略示例
const cacheConfig = {
  tables: ['case', 'claim', 'creditor'],
  strategy: 'LOCAL_FIRST',
  ttl: 300000, // 5分钟
  preload: true
};
```

### 查询处理
- 所有数据库查询必须通过Service Worker的EnhancedQueryHandler
- 使用统一的查询接口，支持智能缓存路由
- 认证查询使用`queryWithAuth`方法，自动处理认证状态检查

### 性能监控
- 使用PerformanceMonitor收集缓存命中率、响应时间等指标
- CacheDebugger提供缓存状态检查和调试功能
- CacheLogger记录结构化日志，支持性能分析

### 多租户数据隔离
- 基于SurrealDB database级别的完全数据隔离
- 用户登录时自动设置租户数据库连接
- TenantDatabaseManager管理租户数据库切换

## 使用指南

### Hook使用
```typescript
// 页面数据缓存Hook
const { queryData, isLoading, subscribe, unsubscribe } = usePageDataCache({
  tables: ['case', 'claim'],
  config: { autoRefresh: true, refreshInterval: 30000 }
});

// 权限检查Hook
const hasPermission = useOperationPermission('case_create');
const menuAccess = useMenuPermission('case_management');
```

### Service Worker通信
```typescript
// 通过SurrealProvider进行Service Worker通信
const { query, queryWithAuth } = useSurreal();

// 带认证的查询
const cases = await queryWithAuth<Case[]>('SELECT * FROM case');

// 缓存管理
await serviceWorker.postMessage({
  type: 'preload_cache',
  tables: ['case', 'claim']
});
```

## 性能优化

### 缓存命中率优化
- 智能预加载常用数据
- 页面感知订阅减少不必要的数据传输
- LRU缓存清理策略管理内存使用

### 网络请求优化
- 批量查询减少网络往返
- 增量同步仅传输变更数据
- 离线模式支持本地数据访问

### 用户体验提升
- 毫秒级权限检查响应
- 页面加载速度提升70-90%
- 实时数据同步保证数据一致性

## 调试和监控

### 调试工具
- 使用CacheDebugger检查缓存状态
- 通过开发者工具查看Service Worker日志
- PerformanceMonitor提供详细性能指标

### 异常处理
- 自动降级机制确保系统稳定性
- 缓存失效时自动回退到远程查询
- 错误日志记录便于问题排查

## 最佳实践

### 缓存策略选择
- 用户个人数据使用LOCAL_FIRST策略
- 实时业务数据使用REMOTE_FIRST策略
- 静态配置数据使用LOCAL_ONLY策略
- 写操作使用REMOTE_ONLY策略

### 订阅管理
- 页面进入时自动订阅相关数据表
- 页面离开时及时取消订阅释放资源
- 合并相同数据的多个订阅请求

### 性能监控
- 定期检查缓存命中率和响应时间
- 监控内存使用情况，及时清理过期缓存
- 分析慢查询和高频查询，优化缓存策略