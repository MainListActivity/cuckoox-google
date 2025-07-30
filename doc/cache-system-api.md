# 增强缓存系统 API 文档

## 概述

增强缓存系统提供了一套完整的API接口，用于管理智能缓存、监控性能和配置缓存策略。所有API都通过Service Worker消息机制进行通信。

## 🚧 当前状态

**核心架构重构进行中** - 智能缓存系统的核心组件已完成开发和集成，API接口已可用。

## 核心查询接口

### query / mutate
处理SurrealQL查询和变更操作，自动使用智能缓存路由。

```typescript
// 查询操作
const result = await surreal.query(
  'SELECT * FROM case WHERE status = "active"',
  {},
  userId,
  caseId
);

// 变更操作
const result = await surreal.mutate(
  'UPDATE case SET status = "closed" WHERE id = $id',
  { id: 'case:123' },
  userId,
  caseId
);
```

**特性**:
- ✅ 智能缓存路由：自动选择本地或远程数据源
- ✅ 性能监控：记录缓存命中率和响应时间
- ✅ 降级机制：缓存系统失败时自动回退到远程查询
- ✅ 认证状态管理：支持 `return $auth;` 语法的快速响应

## 缓存管理接口

### get_cache_stats
获取缓存性能统计信息。

```typescript
// Service Worker 消息
const response = await sendMessage({
  type: 'get_cache_stats',
  payload: {}
});

// 响应格式
interface CacheStatsResponse {
  success: boolean;
  stats: {
    cacheHitRate: number;           // 缓存命中率 (0-1)
    avgResponseTime: number;        // 平均响应时间 (ms)
    totalQueries: number;           // 总查询数
    localQueries: number;           // 本地查询数
    remoteQueries: number;          // 远程查询数
    timestamp: number;              // 统计时间戳
    version: string;                // Service Worker版本
  };
}
```

### preload_cache
预热指定表的缓存数据。

```typescript
// Service Worker 消息
const response = await sendMessage({
  type: 'preload_cache',
  payload: {
    tables: ['user', 'role', 'case'],
    userId: 'user:123',
    caseId: 'case:456'
  }
});

// 响应格式
interface PreloadCacheResponse {
  success: boolean;
  message: string;
  tables: string[];
}
```

### get_subscription_status
获取订阅状态和健康信息。

```typescript
// Service Worker 消息
const response = await sendMessage({
  type: 'get_subscription_status',
  payload: {}
});

// 响应格式
interface SubscriptionStatusResponse {
  success: boolean;
  subscriptions: {
    [table: string]: {
      active: boolean;
      lastUpdate: number;
      errorCount: number;
    };
  };
}
```

## 债权操作追踪系统 API

### 债权操作记录查询

```typescript
// 获取债权操作历史
const operationHistory = await surreal.query(`
  SELECT * FROM claim_operation_log 
  WHERE claim_id = $claimId 
  ORDER BY operation_time DESC 
  LIMIT 50
`, { claimId: 'claim:123' });

// 获取操作统计
const operationStats = await surreal.query(`
  SELECT 
    operation_type,
    count() as operation_count,
    avg(duration) as avg_duration
  FROM claim_operation_log 
  WHERE claim_id = $claimId 
  GROUP BY operation_type
`, { claimId: 'claim:123' });
```

**注意**: 债权操作追踪系统的数据库表结构正在开发中，上述查询需要在表结构创建完成后才能使用。

**当前状态**: 
- ✅ 服务层已实现：`ClaimOperationService`, `ClaimVersionService`, `ClaimStatusFlowService`, `ClaimAuditService`
- ✅ 前端组件已实现：`ClaimOperationHistory`, `ClaimVersionComparison`, `ClaimStatusFlowChart`
- ❌ 数据库表结构待创建：`claim_operation_log`, `claim_version_history`, `claim_status_flow`, `claim_access_log`

## WebRTC消息中心系统 API

### 群组消息查询

```typescript
// 获取群组消息历史
const groupMessages = await surreal.query(`
  SELECT 
    *,
    sender_id.name as sender_name,
    sender_id.avatar as sender_avatar,
    mentioned_users.*.name as mentioned_user_names
  FROM message 
  WHERE group_id = $groupId 
  ORDER BY created_at DESC 
  LIMIT 50
`, { groupId: 'message_group:123' });

// 获取群组成员列表
const groupMembers = await surreal.query(`
  SELECT 
    out.* as user_info,
    role,
    joined_at,
    last_read_at,
    is_muted,
    nickname
  FROM has_group_member 
  WHERE in = $groupId
  ORDER BY joined_at ASC
`, { groupId: 'message_group:123' });
```

### 群组管理操作

```typescript
// 创建群组
const newGroup = await surreal.query(`
  CREATE message_group SET
    group_name = $name,
    group_description = $description,
    group_type = $type,
    case_id = $caseId,
    created_by = $auth.id,
    created_at = time::now()
`, {
  name: '案件讨论组',
  description: '案件相关讨论',
  type: 'case_related',
  caseId: 'case:123'
});

// 添加群组成员
const addMember = await surreal.query(`
  RELATE $groupId->has_group_member->$userId SET
    role = $role,
    joined_at = time::now(),
    is_muted = false
`, {
  groupId: 'message_group:123',
  userId: 'user:456',
  role: 'member'
});
```

### WebRTC通话功能

```typescript
// 发起私聊语音通话
const startVoiceCall = async (targetUserId: string) => {
  const callId = await callManager.startPrivateCall(targetUserId, 'audio');
  return callId;
};

// 发起群组视频通话
const startGroupVideoCall = async (groupId: string) => {
  const callId = await callManager.startGroupCall(groupId, 'video');
  return callId;
};

// 获取通话记录
const callHistory = await surreal.query(`
  SELECT 
    *,
    initiator.name as initiator_name,
    participants.*.name as participant_names
  FROM call_record 
  WHERE group_id = $groupId OR participants CONTAINS $userId
  ORDER BY start_time DESC 
  LIMIT 20
`, { groupId: 'message_group:123', userId: 'user:456' });
```

### WebRTC信令消息

```typescript
// 发送WebRTC信令消息
const sendSignal = await surreal.query(`
  CREATE webrtc_signal SET
    signal_type = $signalType,
    from_user = $auth.id,
    to_user = $targetUserId,
    group_id = $groupId,
    signal_data = $signalData,
    call_id = $callId,
    created_at = time::now()
`, {
  signalType: 'offer',
  targetUserId: 'user:456',
  groupId: 'message_group:123',
  signalData: { sdp: '...', type: 'offer' },
  callId: 'call_123'
});

// 获取未处理的信令消息
const pendingSignals = await surreal.query(`
  SELECT * FROM webrtc_signal 
  WHERE to_user = $auth.id 
    AND processed = false 
  ORDER BY created_at ASC
`);
```

**当前状态**:
- ✅ **需求分析**: 100% 完成 - 7个核心需求领域，包含完整的用户故事和验收标准
- ✅ **技术设计**: 100% 完成 - 完整的架构设计、组件接口、数据模型设计
- ✅ **任务分解**: 100% 完成 - 12个主要任务模块，40+个具体实施任务
- ✅ **数据库设计**: 100% 完成 - `message_group`, `has_group_member`, `message_read_status`, `call_record`, `webrtc_signal`
- ❌ **数据库实现**: 0% 完成 - 需要在surreal_schemas.surql中添加表结构
- ❌ **WebRTC核心服务**: 0% 完成 - `WebRTCManager`, `CallManager`, `MediaFileHandler`, `SignalingService`待实现
- ❌ **群组管理服务**: 0% 完成 - `GroupManager`待实现
- ❌ **界面组件**: 0% 完成 - 所有WebRTC相关界面组件待实现

**详细开发状态**: 查看 [WebRTC消息中心开发状态文档](./webrtc-message-center-development-status.md)

### 债权版本历史查询

```typescript
// 获取版本历史
const versionHistory = await surreal.query(`
  SELECT * FROM claim_version_history 
  WHERE claim_id = $claimId 
  ORDER BY version_number DESC
`, { claimId: 'claim:123' });

// 版本对比查询
const versionDiff = await surreal.query(`
  SELECT 
    v1.snapshot_data as from_data,
    v2.snapshot_data as to_data,
    v1.version_number as from_version,
    v2.version_number as to_version
  FROM claim_version_history v1, claim_version_history v2
  WHERE v1.claim_id = $claimId AND v2.claim_id = $claimId
    AND v1.version_number = $fromVersion 
    AND v2.version_number = $toVersion
`, { 
  claimId: 'claim:123', 
  fromVersion: 1, 
  toVersion: 2 
});
```

### 债权状态流转查询

```typescript
// 获取状态流转历史
const statusFlow = await surreal.query(`
  SELECT 
    *,
    from_status.name as from_status_name,
    to_status.name as to_status_name,
    operator_id.name as operator_name
  FROM claim_status_flow 
  WHERE claim_id = $claimId 
  ORDER BY transition_time DESC
`, { claimId: 'claim:123' });

// 状态流转统计
const statusStats = await surreal.query(`
  SELECT 
    to_status.name as status_name,
    count() as transition_count,
    avg(duration_in_previous_status) as avg_duration
  FROM claim_status_flow 
  WHERE claim_id = $claimId 
  GROUP BY to_status
`, { claimId: 'claim:123' });
```

### 债权访问审计查询

```typescript
// 获取访问日志
const accessLog = await surreal.query(`
  SELECT 
    *,
    accessor_id.name as accessor_name
  FROM claim_access_log 
  WHERE claim_id = $claimId 
  ORDER BY access_time DESC 
  LIMIT 100
`, { claimId: 'claim:123' });

// 访问统计
const accessStats = await surreal.query(`
  SELECT 
    access_type,
    count() as access_count,
    count(DISTINCT accessor_id) as unique_accessors
  FROM claim_access_log 
  WHERE claim_id = $claimId 
  GROUP BY access_type
`, { claimId: 'claim:123' });
```

## 债权操作追踪缓存配置

### 缓存策略配置

```typescript
const claimTrackingCacheConfig = {
  tables: [
    'claim_operation_log',
    'claim_version_history', 
    'claim_status_flow',
    'claim_access_log'
  ],
  strategy: 'HYBRID',
  ttl: 300000, // 5分钟
  preload: true,
  subscriptions: {
    'claim_operation_log': {
      condition: 'claim_id = $current_claim_id',
      autoRefresh: true,
      refreshInterval: 30000 // 30秒
    },
    'claim_version_history': {
      condition: 'claim_id = $current_claim_id',
      autoRefresh: false // 版本历史不需要频繁刷新
    },
    'claim_status_flow': {
      condition: 'claim_id = $current_claim_id',
      autoRefresh: true,
      refreshInterval: 60000 // 1分钟
    },
    'claim_access_log': {
      condition: 'claim_id = $current_claim_id',
      autoRefresh: false // 访问日志按需加载
    }
  }
};
```

### 预加载债权追踪数据

```typescript
// 预加载当前债权的追踪数据
const response = await sendMessage({
  type: 'preload_cache',
  payload: {
    tables: [
      'claim_operation_log',
      'claim_version_history',
      'claim_status_flow'
    ],
    userId: 'user:123',
    caseId: 'case:456',
    claimId: 'claim:789' // 新增债权ID参数
  }
});
```

interface SubscriptionStatusResponse {
  success: boolean;
  subscriptionStatus: {
    activeSubscriptions: Array<{
      id: string;
      table: string;
      type: string;
      userId?: string;
      caseId?: string;
      isHealthy: boolean;
      lastSyncTime: number;
      subscriptionTime: number;
    }>;
    syncStatus: Array<{
      table: string;
      lastSyncTime: number;
      status: 'active' | 'paused' | 'error';
      errorMessage?: string;
    }>;
    healthStatus: {
      totalSubscriptions: number;
      healthySubscriptions: number;
      unhealthySubscriptions: number;
      lastHealthCheck: number;
    };
    timestamp: number;
  };
}
```

### configure_table_cache
动态配置表的缓存策略。

```typescript
// Service Worker 消息
const response = await sendMessage({
  type: 'configure_table_cache',
  payload: {
    table: 'case',
    config: {
      defaultStrategy: 'LOCAL_FIRST',
      consistencyRequirement: 'EVENTUAL',
      defaultTTL: 3600000,  // 1小时
      priority: 8,
      maxCacheSize: 5000
    }
  }
});

// 响应格式
interface ConfigureTableCacheResponse {
  success: boolean;
  message: string;
  table: string;
  config: TableCacheConfig;
}
```

## 数据缓存接口

### 自动同步相关

#### trigger_auto_sync
手动触发自动同步。

```typescript
const response = await sendMessage({
  type: 'trigger_auto_sync',
  payload: {
    userId: 'user:123',
    caseId: 'case:456'
  }
});
```

#### sync_user_personal_data
同步用户个人数据（权限、角色、菜单等）。

```typescript
const response = await sendMessage({
  type: 'sync_user_personal_data',
  payload: {
    personalData: {
      id: 'user:123',
      permissions: [...],
      roles: [...],
      menus: [...]
    }
  }
});
```

### 页面数据缓存

#### subscribe_page_data
订阅页面所需的数据表。

```typescript
const response = await sendMessage({
  type: 'subscribe_page_data',
  payload: {
    tables: ['case', 'claim', 'creditor']
  }
});
```

#### unsubscribe_page_data
取消订阅页面数据。

```typescript
const response = await sendMessage({
  type: 'unsubscribe_page_data',
  payload: {
    tables: ['case', 'claim', 'creditor']
  }
});
```

### 缓存操作

#### query_cached_data
查询缓存的数据。

```typescript
const response = await sendMessage({
  type: 'query_cached_data',
  payload: {
    query: 'SELECT * FROM case WHERE status = "active"',
    params: {}
  }
});
```

#### clear_table_cache
清除指定表的缓存。

```typescript
const response = await sendMessage({
  type: 'clear_table_cache',
  payload: {
    table: 'case',
    userId: 'user:123',
    caseId: 'case:456'
  }
});
```

#### clear_all_cache
清除所有缓存数据。

```typescript
const response = await sendMessage({
  type: 'clear_all_cache',
  payload: {}
});
```

## 缓存策略类型

### CacheStrategy 枚举

```typescript
enum CacheStrategy {
  LOCAL_FIRST = 'LOCAL_FIRST',     // 优先本地，适用于不经常变化的数据
  REMOTE_FIRST = 'REMOTE_FIRST',   // 优先远程，适用于实时性要求高的数据
  LOCAL_ONLY = 'LOCAL_ONLY',       // 仅本地，适用于已缓存的静态数据
  REMOTE_ONLY = 'REMOTE_ONLY',     // 仅远程，适用于写操作或一次性查询
  HYBRID = 'HYBRID'                // 混合模式，根据具体情况动态决定
}
```

### ConsistencyLevel 枚举

```typescript
enum ConsistencyLevel {
  EVENTUAL = 'EVENTUAL',           // 最终一致性，允许短期不一致
  STRONG = 'STRONG',               // 强一致性，必须实时同步
  WEAK = 'WEAK'                    // 弱一致性，允许较长时间不一致
}
```

## 性能监控指标

### 缓存性能指标

```typescript
interface PerformanceStats {
  cacheHitRate: number;           // 缓存命中率 (0-1)
  avgResponseTime: number;        // 平均响应时间 (ms)
  totalQueries: number;           // 总查询数
  localQueries: number;           // 本地查询数
  remoteQueries: number;          // 远程查询数
  
  // 按查询类型分组的统计
  queryTypeStats: {
    [queryType: string]: {
      count: number;
      avgTime: number;
      cacheHitRate: number;
    };
  };
  
  // 按表分组的统计
  tableStats: {
    [table: string]: {
      queries: number;
      cacheHits: number;
      avgResponseTime: number;
    };
  };
}
```

### 订阅健康状态

```typescript
interface SubscriptionHealthReport {
  totalSubscriptions: number;
  healthySubscriptions: number;
  unhealthySubscriptions: number;
  reconnectionAttempts: number;
  lastHealthCheck: number;
}
```

## 错误处理

### 错误响应格式

```typescript
interface ErrorResponse {
  success: false;
  error: string;
  details?: any;
}
```

### 常见错误类型

- **缓存系统未初始化**: `Cache system not initialized`
- **表配置无效**: `Invalid table configuration`
- **查询解析失败**: `Failed to parse query`
- **网络连接失败**: `Network connection failed`
- **权限不足**: `Insufficient permissions`

## 使用示例

### 基本查询使用

```typescript
// 在React组件中使用
import { useSurreal } from '@/src/contexts/SurrealProvider';

function CaseList() {
  const { surreal } = useSurreal();
  
  const loadCases = async () => {
    try {
      // 自动使用智能缓存路由
      const result = await surreal.query(
        'SELECT * FROM case WHERE status = "active" ORDER BY created_at DESC',
        {},
        userId,
        caseId
      );
      
      setCases(result);
    } catch (error) {
      console.error('Failed to load cases:', error);
    }
  };
  
  // ...
}
```

### 全文检索查询使用

```typescript
// 全文检索案件信息
function searchCases(keyword: string) {
  const { surreal } = useSurreal();
  
  const searchCases = async () => {
    try {
      // 使用 SurrealDB 全文检索功能
      const result = await surreal.query(`
        SELECT *,
          search::highlight("**", "**", 0) AS highlighted_name,
          search::highlight("##", "##", 1) AS highlighted_description,
          search::score(0) + search::score(1) AS relevance_score
        FROM case
        WHERE name @0@ $keyword
           OR description @1@ $keyword
        ORDER BY relevance_score DESC
        LIMIT 20
      `, {
        keyword: keyword
      }, userId, caseId);
      
      setCases(result);
    } catch (error) {
      console.error('Failed to search cases:', error);
    }
  };
  
  // ...
}

// 搜索债权人信息
function searchCreditors(searchTerm: string) {
  const { surreal } = useSurreal();
  
  const searchCreditors = async () => {
    try {
      const result = await surreal.query(`
        SELECT *,
          search::highlight("->", "<-", 0) AS highlighted_name,
          search::score(0) AS name_score
        FROM creditor
        WHERE name @0@ $searchTerm
        ORDER BY name_score DESC
        LIMIT 50
      `, {
        searchTerm: searchTerm
      }, userId, caseId);
      
      setCreditors(result);
    } catch (error) {
      console.error('Failed to search creditors:', error);
    }
  };
  
  // ...
}
```

### 缓存管理使用

```typescript
// 获取缓存统计
const getCacheStats = async () => {
  const response = await sendMessage({
    type: 'get_cache_stats',
    payload: {}
  });
  
  if (response.success) {
    console.log('缓存命中率:', response.stats.cacheHitRate);
    console.log('平均响应时间:', response.stats.avgResponseTime);
  }
};

// 预热缓存
const preloadCache = async () => {
  const response = await sendMessage({
    type: 'preload_cache',
    payload: {
      tables: ['user', 'role', 'case'],
      userId: currentUserId,
      caseId: currentCaseId
    }
  });
  
  if (response.success) {
    console.log('缓存预热完成:', response.message);
  }
};
```

## 最佳实践

### 1. 缓存策略选择
- **用户个人数据**: 使用`LOCAL_FIRST`策略，设置较长的TTL
- **实时业务数据**: 使用`HYBRID`策略，平衡性能和一致性
- **配置数据**: 使用`LOCAL_FIRST`策略，设置持久化缓存
- **写操作**: 始终使用`REMOTE_ONLY`策略

### 2. 性能优化建议
- 合理设置缓存TTL，避免过期数据影响业务
- 定期监控缓存命中率，调整缓存策略
- 使用缓存预热功能，提升首次访问性能
- 合理配置缓存容量，避免内存溢出

### 3. 调试和故障排除
- 使用`get_cache_stats`API监控缓存性能
- 检查Service Worker控制台日志
- 使用浏览器开发者工具的Application面板查看缓存状态
- 在开发环境使用`direct`模式进行调试

## 版本兼容性

- **当前版本**: v1.0.1
- **向后兼容**: 完全兼容现有API
- **降级支持**: 缓存系统失败时自动回退到原始查询
- **渐进式升级**: 支持新旧系统并存

## 多租户数据库管理

多租户数据库隔离现在完全自动化，系统在用户登录时自动获取租户信息并设置数据库连接，无需手动调用API接口。

**自动化特性**:
- ✅ **自动获取租户信息**: 系统在用户登录时自动从认证状态中提取租户代码
- ✅ **自动设置数据库连接**: 系统自动调用 `localDb.use()` 和 `remoteDb.use()` 方法连接到租户特定的database
- ✅ **透明操作**: 所有后续数据库操作都在正确的租户database中执行，无需额外处理
- ✅ **自动清理**: 用户退出登录时自动清除租户信息和数据库连接状态

**设计简化**:
- 🎯 **租户=Database**: 租户直接对应SurrealDB的database，简化映射关系
- 🚀 **零配置**: 无需手动设置或切换租户数据库
- 🔒 **数据安全**: 通过database级别隔离确保租户数据完全分离

**实现原理**:
```typescript
// 用户登录时自动设置租户数据库
async updateAuthState(authData: UnknownData): Promise<void> {
  this.currentAuthState = authData;
  
  // 如果有租户信息，自动设置数据库连接
  if (authData && typeof authData === 'object' && 'tenant_code' in authData) {
    const tenantCode = authData.tenant_code as string;
    if (tenantCode) {
      await this.tenantDatabaseManager.setTenantDatabase(tenantCode);
    }
  }
}
```

## 注意事项

1. **Service Worker模式**: 所有缓存功能仅在Service Worker模式下可用
2. **网络依赖**: 首次数据加载仍需要网络连接
3. **内存使用**: 缓存会占用一定的内存空间，需要合理配置
4. **数据一致性**: 缓存数据可能存在短暂的不一致，需要根据业务需求选择合适的一致性级别
5. **多租户隔离**: 租户数据库连接完全自动化，开发者无需关心租户切换逻辑

这套API为破产案件管理平台提供了强大的数据缓存能力，确保了在各种网络环境下的稳定运行和优秀的用户体验。