/**
 * SurrealDB 类型扩展
 * 为了避免使用 as any，定义更宽松的类型接口
 */

import { RecordId, Uuid } from 'surrealdb';

// 扩展 SurrealDB 接口以支持更灵活的 create 和 update 方法
declare module 'surrealdb' {
  interface Surreal {
    /**
     * 创建记录的扩展方法，接受任意数据类型
     */
    create<T = any>(
      table: string | RecordId,
      data?: Record<string, unknown>
    ): Promise<T | T[]>;

    /**
     * 更新记录的扩展方法，接受任意数据类型
     */
    update<T = any>(
      recordId: string | RecordId,
      data?: Record<string, unknown>
    ): Promise<T | T[]>;

    /**
     * 查询方法的扩展，返回任意类型
     */
    query<T = any>(
      query: string,
      bindings?: Record<string, unknown>
    ): Promise<T[]>;

    /**
     * Live Query 的 kill 方法，接受字符串或 Uuid
     */
    kill(queryUuid: string | Uuid | readonly (string | Uuid)[]): Promise<void>;

    /**
     * Live Query 方法，返回字符串或 Uuid
     */
    live<T = any>(
      query: string,
      callback?: (action: string, result: T) => void | Promise<void>
    ): Promise<string | Uuid>;
  }
}

// 数据库查询结果类型
export interface DatabaseQueryResult<T = any> {
  data?: T;
  sync_timestamp?: number;
  [key: string]: any;
}

// 订阅项类型，匹配 SubscriptionItem 接口
export interface DatabaseSubscriptionItem extends Record<string, unknown> {
  id: string;
  table_name: string;
  cache_type: 'persistent' | 'temporary';
  user_id?: string;
  case_id?: string;
  live_query_uuid?: string;
  last_sync_time: number;
  is_active: boolean;
  created_at: Date;
}

// 数据缓存项类型
export interface DatabaseCacheItem extends Record<string, unknown> {
  id: RecordId;
  table_name: string;
  cache_key: string;
  data: unknown;
  created_at: Date;
  updated_at: Date;
  sync_timestamp: number;
  cache_type: 'persistent' | 'temporary';
  user_id?: string;
  case_id?: string;
  expires_at?: Date;
}

// 可索引对象类型
export interface IndexableObject {
  [key: string]: unknown;
}

// 扩展 Record 类型以支持索引访问
export type FlexibleRecord<T = Record<string, unknown>> = T & IndexableObject;

// 通用数据类型
export type UnknownData = Record<string, unknown>;

// 查询参数类型
export type QueryParams = Record<string, unknown>;

// 数据更新参数类型
export type UpdateData = Record<string, unknown>;

// 缓存数据类型
export type CacheData = Record<string, unknown> | Record<string, unknown>[];

// 合并数据类型
export type MergeableData = Record<string, unknown> & { id?: string | RecordId };

// 查询结果项类型
export type QueryResultItem<T = UnknownData> = T & {
  id?: string | RecordId;
  [key: string]: unknown;
};