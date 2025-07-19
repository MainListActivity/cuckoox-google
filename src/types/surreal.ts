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