/**
 * SurrealDB 相关类型定义
 */

import { RecordId } from 'surrealdb';

// 查询参数类型
export type QueryParams = Record<string, unknown>;

// 未知数据类型
export type UnknownData = unknown;

// 数据库记录类型
export interface DatabaseRecord {
  id: string | RecordId;
  [key: string]: unknown;
}

// 查询结果类型
export type QueryResult = UnknownData[];

// 缓存类型
export type CacheType = 'persistent' | 'temporary';

// 同步状态
export interface SyncRecord {
  id: string | RecordId;
  table_name: string;
  user_id?: string;
  case_id?: string;
  last_sync_timestamp: string;
  last_sync_id?: string;
  status: 'active' | 'paused' | 'error';
  error_message?: string;
  created_at: string;
  updated_at: string;
}

// 增量更新记录
export interface IncrementalUpdate {
  table: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  record_id: string | RecordId;
  old_data?: UnknownData;
  new_data?: UnknownData;
  timestamp: string;
  user_id?: string;
  case_id?: string;
}

// 冲突解决策略
export type ConflictResolution = 'local_wins' | 'remote_wins' | 'merge' | 'manual';

// 操作追踪相关缓存策略
export interface TrackingCacheConfig {
  tables: string[];
  strategy: CacheStrategy;
  ttl: number;
  preload: boolean;
  subscriptions?: {
    [tableName: string]: {
      condition?: string;
      autoRefresh: boolean;
      refreshInterval?: number;
    };
  };
}

// 缓存策略枚举
export type CacheStrategy = 'LOCAL_FIRST' | 'REMOTE_FIRST' | 'HYBRID' | 'LOCAL_ONLY' | 'REMOTE_ONLY';

// 操作追踪同步配置
export interface TrackingSyncConfig {
  enableRealTimeSync: boolean;
  batchSize: number;
  syncInterval: number;
  conflictResolution: ConflictResolution;
  retryAttempts: number;
  retryDelay: number;
}

// 版本控制元数据
export interface VersionMetadata {
  current_version: number;
  last_operation_time: string;
  operation_count: number;
  has_pending_changes: boolean;
  last_sync_version?: number;
}

// 扩展的数据库记录类型（包含版本信息）
export interface VersionedDatabaseRecord extends DatabaseRecord {
  current_version?: number;
  last_operation_time?: string;
  operation_count?: number;
}

// 操作追踪表名枚举
export enum TrackingTableName {
  CLAIM_OPERATION_LOG = 'claim_operation_log',
  CLAIM_VERSION_HISTORY = 'claim_version_history',
  CLAIM_STATUS_FLOW = 'claim_status_flow',
  CLAIM_ACCESS_LOG = 'claim_access_log'
}

// 实时同步事件类型
export interface TrackingSyncEvent {
  type: 'operation_logged' | 'version_created' | 'status_changed' | 'access_logged';
  table: TrackingTableName;
  record_id: string | RecordId;
  claim_id: string | RecordId;
  data: UnknownData;
  timestamp: string;
}

// 缓存失效策略
export interface CacheInvalidationRule {
  trigger_table: string;
  trigger_operation: 'CREATE' | 'UPDATE' | 'DELETE';
  invalidate_tables: string[];
  invalidate_conditions?: Record<string, unknown>;
}

// 操作追踪缓存配置
export const TRACKING_CACHE_CONFIG: TrackingCacheConfig = {
  tables: [
    TrackingTableName.CLAIM_OPERATION_LOG,
    TrackingTableName.CLAIM_VERSION_HISTORY,
    TrackingTableName.CLAIM_STATUS_FLOW,
    TrackingTableName.CLAIM_ACCESS_LOG
  ],
  strategy: 'HYBRID',
  ttl: 300000, // 5分钟
  preload: true,
  subscriptions: {
    [TrackingTableName.CLAIM_OPERATION_LOG]: {
      condition: 'claim_id = $current_claim_id',
      autoRefresh: true,
      refreshInterval: 30000
    },
    [TrackingTableName.CLAIM_VERSION_HISTORY]: {
      condition: 'claim_id = $current_claim_id',
      autoRefresh: false
    },
    [TrackingTableName.CLAIM_STATUS_FLOW]: {
      condition: 'claim_id = $current_claim_id',
      autoRefresh: true,
      refreshInterval: 60000
    },
    [TrackingTableName.CLAIM_ACCESS_LOG]: {
      condition: 'claim_id = $current_claim_id',
      autoRefresh: false
    }
  }
};