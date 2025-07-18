import { RecordId } from 'surrealdb';
import type Surreal from 'surrealdb';
import type { DatabaseQueryResult, DatabaseSubscriptionItem, FlexibleRecord, UnknownData, QueryParams, UpdateData, CacheData, QueryResultItem } from '../types/surreal';

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

// 自动同步表配置
export const AUTO_SYNC_TABLES = [
  'user',
  'role', 
  'has_case_role',
  'has_role',
  'case',
  'has_member',
  'menu_metadata',
  'operation_button',
  'user_personal_data'
] as const;

export type AutoSyncTable = typeof AUTO_SYNC_TABLES[number];

// 缓存配置类型
export type CacheModeType = 'auto_sync' | 'manual_cache';

// 表缓存配置
export interface TableCacheConfig {
  table: string;
  mode: CacheModeType;
  enableLiveQuery: boolean;
  enableIncrementalSync: boolean;
  syncInterval?: number;
  expirationMs?: number;
}

// 检查是否为自动同步表
export function isAutoSyncTable(table: string): table is AutoSyncTable {
  return AUTO_SYNC_TABLES.includes(table as AutoSyncTable);
}

// 获取表的缓存配置
export function getTableCacheConfig(table: string): TableCacheConfig {
  if (isAutoSyncTable(table)) {
    return {
      table,
      mode: 'auto_sync',
      enableLiveQuery: true,
      enableIncrementalSync: true,
      syncInterval: 5 * 60 * 1000, // 5分钟
      expirationMs: 24 * 60 * 60 * 1000 // 24小时
    };
  } else {
    return {
      table,
      mode: 'manual_cache',
      enableLiveQuery: true,
      enableIncrementalSync: false,
      syncInterval: 30 * 1000, // 30秒
      expirationMs: 60 * 60 * 1000 // 1小时
    };
  }
}

// 缓存策略类型
export type CacheStrategyType = 'persistent' | 'temporary' | 'auto_sync';

// 缓存配置
export interface CacheConfig {
  type: CacheStrategyType;
  tables: string[];
  enableLiveQuery: boolean;
  enableIncrementalSync: boolean;
  syncInterval?: number; // 同步间隔（毫秒）
  expirationMs?: number; // 缓存过期时间
}

// 数据表缓存项
export interface DataTableCache {
  id: RecordId;
  table_name: string;
  cache_key: string; // 唯一缓存键
  data: CacheData;
  created_at: Date;
  updated_at: Date;
  sync_timestamp: number;
  cache_type: CacheStrategyType;
  user_id?: string;
  case_id?: string;
  expires_at?: Date;
}

// 订阅管理项
export interface SubscriptionItem {
  id: string;
  table_name: string;
  cache_type: CacheStrategyType;
  user_id?: string;
  case_id?: string;
  live_query_uuid?: string;
  last_sync_time: number;
  is_active: boolean;
  created_at: Date;
}

// 增量同步数据
export interface IncrementalSyncData {
  table_name: string;
  records: QueryResultItem[];
  last_sync_time: number;
  has_more: boolean;
}

// 数据缓存管理器配置
export interface DataCacheManagerConfig {
  localDb: Surreal;
  remoteDb?: Surreal;
  broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>;
  defaultExpirationMs?: number;
}

/**
 * 通用数据表缓存管理器
 * 支持两种缓存策略：
 * 1. 持久化缓存（用户个人信息，如权限菜单、操作按钮）
 * 2. 临时缓存（页面数据，进入页面时订阅，离开页面时取消订阅）
 */
export class DataCacheManager {
  private localDb: Surreal;
  private remoteDb?: Surreal;
  private broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>;
  private defaultExpirationMs: number;
  
  // 活跃的订阅管理
  private activeSubscriptions = new Map<string, SubscriptionItem>();
  
  // Live Query 管理
  private liveQueries = new Map<string, string>(); // subscription_id -> uuid
  
  // 同步定时器
  private syncTimers = new Map<string, NodeJS.Timeout>();
  
  constructor(config: DataCacheManagerConfig) {
    this.localDb = config.localDb;
    this.remoteDb = config.remoteDb;
    this.broadcastToAllClients = config.broadcastToAllClients;
    this.defaultExpirationMs = config.defaultExpirationMs || 60 * 60 * 1000; // 1小时
  }

  /**
   * 检查表是否为自动同步表
   */
  static isAutoSyncTable(table: string): boolean {
    return AUTO_SYNC_TABLES.includes(table as AutoSyncTable);
  }

  /**
   * 获取表的缓存配置
   */
  static getTableCacheConfig(table: string): Partial<CacheConfig> {
    if (isAutoSyncTable(table)) {
      return {
        type: 'auto_sync',
        enableLiveQuery: true,
        enableIncrementalSync: false, // 自动同步表使用全表同步
        expirationMs: 24 * 60 * 60 * 1000, // 24小时
      };
    }
    
    return {
      type: 'temporary',
      enableLiveQuery: false,
      enableIncrementalSync: true,
      expirationMs: 60 * 60 * 1000, // 1小时
    };
  }

  /**
   * 初始化数据缓存管理器
   */
  async initialize(): Promise<void> {
    console.log('DataCacheManager: Initializing...');
    
    // 创建缓存相关表
    await this.createCacheTables();
    
    // 清理无效的订阅记录
    await this.cleanupInvalidSubscriptions();
    
    // 恢复活跃订阅
    await this.restoreActiveSubscriptions();
    
    console.log('DataCacheManager: Initialized successfully');
  }


  /**
   * 同步单个表
   */
  private async syncSingleTable(table: string, userId: string, caseId?: string): Promise<void> {
    console.log(`DataCacheManager: Syncing table: ${table}`);
    
    try {
      // 从远程获取全表数据
      const remoteData = await this.remoteDb!.select(table);
      
      // 缓存到本地
      await this.cacheData(table, remoteData, 'auto_sync', userId, caseId);
      
      // 设置Live Query订阅
      const subscriptionId = this.generateSubscriptionId(table, 'auto_sync', userId, caseId);
      await this.recordSubscription(subscriptionId, table, 'auto_sync', userId, caseId);
      await this.setupLiveQuery(subscriptionId, table, userId, caseId);
      
      console.log(`DataCacheManager: Successfully synced table: ${table}`);
    } catch (error) {
      console.error(`DataCacheManager: Failed to sync table ${table}:`, error);
      throw error;
    }
  }


  /**
   * 自动同步指定表（登录时调用）
   * 为自动同步表执行全表同步并设置live query
   */
  async autoSyncTables(userId: string, caseId?: string): Promise<void> {
    console.log('DataCacheManager: Starting auto sync for user:', userId);
    
    for (const table of AUTO_SYNC_TABLES) {
      try {
        const config = getTableCacheConfig(table);
        
        // 为自动同步表订阅持久化缓存
        await this.subscribePersistent([table], userId, caseId, {
          type: 'persistent',
          tables: [table],
          enableLiveQuery: config.enableLiveQuery,
          enableIncrementalSync: config.enableIncrementalSync,
          syncInterval: config.syncInterval,
          expirationMs: config.expirationMs
        });
        
        console.log(`DataCacheManager: Auto sync setup completed for table: ${table}`);
      } catch (error) {
        console.error(`DataCacheManager: Failed to setup auto sync for table: ${table}`, error);
      }
    }
    
    console.log('DataCacheManager: Auto sync setup completed for all tables');
  }

  /**
   * 检查并自动处理表查询
   * 如果是自动同步表且未缓存，则自动从远程同步
   */
  async checkAndAutoCache(table: string, userId?: string, caseId?: string): Promise<boolean> {
    if (!isAutoSyncTable(table)) {
      return false; // 不是自动同步表，不处理
    }
    
    // 检查是否已有缓存
    const hasCache = await this.hasCachedData(table, userId, caseId);
    if (hasCache) {
      return true; // 已有缓存，直接返回
    }
    
    // 没有缓存，需要自动同步
    console.log(`DataCacheManager: Auto syncing table: ${table} for user: ${userId}`);
    
    try {
      if (userId) {
        await this.autoSyncTables(userId, caseId);
      } else {
        // 如果没有用户ID，执行匿名全表同步
        await this.performFullSync(table, 'anonymous', caseId, 'temporary');
      }
      return true;
    } catch (error) {
      console.error(`DataCacheManager: Failed to auto sync table: ${table}`, error);
      return false;
    }
  }

  /**
   * 检查是否有缓存数据
   */
  private async hasCachedData(table: string, userId?: string, caseId?: string): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT() as count FROM data_table_cache 
        WHERE table_name = $table_name 
          AND (user_id = $user_id OR user_id IS NULL)
          AND (case_id = $case_id OR case_id IS NULL)
          AND (expires_at IS NULL OR expires_at > time::now())
      `;
      
      const result = await this.localDb.query(query, {
        table_name: table,
        user_id: userId,
        case_id: caseId
      });
      
      const count = (result as any[])?.[0]?.count || 0;
      return count > 0;
    } catch (error) {
      console.warn('DataCacheManager: Failed to check cached data:', error);
      return false;
    }
  }

  /**
   * 清理无效的订阅记录
   */
  private async cleanupInvalidSubscriptions(): Promise<void> {
    try {
      console.log('DataCacheManager: Cleaning up invalid subscription records...');
      
      // 删除缺少 cache_type 字段的记录
      const deleteQuery = `
        DELETE FROM subscription_management 
        WHERE cache_type IS NULL OR cache_type = NONE
      `;
      
      await this.localDb.query(deleteQuery);
      
      console.log('DataCacheManager: Invalid subscription records cleaned up');
    } catch (error) {
      console.warn('DataCacheManager: Failed to cleanup invalid subscriptions:', error);
    }
  }

  /**
   * 创建缓存表
   */
  private async createCacheTables(): Promise<void> {
    const tableDefinitions = [
      // 数据表缓存
      `DEFINE TABLE data_table_cache SCHEMAFULL;
       DEFINE FIELD table_name ON data_table_cache TYPE string;
       DEFINE FIELD cache_key ON data_table_cache TYPE string;
       DEFINE FIELD data ON data_table_cache TYPE any;
       DEFINE FIELD created_at ON data_table_cache TYPE datetime DEFAULT time::now();
       DEFINE FIELD updated_at ON data_table_cache TYPE datetime DEFAULT time::now();
       DEFINE FIELD sync_timestamp ON data_table_cache TYPE number;
       DEFINE FIELD cache_type ON data_table_cache TYPE string ASSERT $value IN ['persistent', 'temporary', 'auto_sync'];
       DEFINE FIELD user_id ON data_table_cache TYPE option<string>;
       DEFINE FIELD case_id ON data_table_cache TYPE option<string>;
       DEFINE FIELD expires_at ON data_table_cache TYPE option<datetime>;
       DEFINE INDEX idx_data_table_cache_key ON data_table_cache COLUMNS cache_key;
       DEFINE INDEX idx_data_table_cache_table_user ON data_table_cache COLUMNS table_name, user_id, case_id;`,

      // 订阅管理
      `DEFINE TABLE subscription_management SCHEMAFULL;
       DEFINE FIELD table_name ON subscription_management TYPE string;
       DEFINE FIELD cache_type ON subscription_management TYPE string ASSERT $value IN ['persistent', 'temporary', 'auto_sync'];
       DEFINE FIELD user_id ON subscription_management TYPE option<string>;
       DEFINE FIELD case_id ON subscription_management TYPE option<string>;
       DEFINE FIELD live_query_uuid ON subscription_management TYPE option<string>;
       DEFINE FIELD last_sync_time ON subscription_management TYPE number;
       DEFINE FIELD is_active ON subscription_management TYPE bool DEFAULT true;
       DEFINE FIELD created_at ON subscription_management TYPE datetime DEFAULT time::now();
       DEFINE INDEX idx_subscription_table_user ON subscription_management COLUMNS table_name, user_id, case_id;`,

      // 增量同步日志
      `DEFINE TABLE sync_log SCHEMAFULL;
       DEFINE FIELD table_name ON sync_log TYPE string;
       DEFINE FIELD sync_type ON sync_log TYPE string ASSERT $value IN ['full', 'incremental'];
       DEFINE FIELD user_id ON sync_log TYPE option<string>;
       DEFINE FIELD case_id ON sync_log TYPE option<string>;
       DEFINE FIELD sync_timestamp ON sync_log TYPE number;
       DEFINE FIELD records_synced ON sync_log TYPE number;
       DEFINE FIELD created_at ON sync_log TYPE datetime DEFAULT time::now();
       DEFINE INDEX idx_sync_log_table_time ON sync_log COLUMNS table_name, sync_timestamp;`,

      // 同步记录表
      `DEFINE TABLE sync_record SCHEMAFULL;
       DEFINE FIELD table_name ON sync_record TYPE string;
       DEFINE FIELD user_id ON sync_record TYPE string;
       DEFINE FIELD case_id ON sync_record TYPE option<string>;
       DEFINE FIELD last_sync_timestamp ON sync_record TYPE number;
       DEFINE FIELD last_sync_id ON sync_record TYPE option<string>;
       DEFINE FIELD sync_status ON sync_record TYPE string ASSERT $value IN ['pending', 'in_progress', 'completed', 'failed'];
       DEFINE FIELD error_message ON sync_record TYPE option<string>;
       DEFINE FIELD retry_count ON sync_record TYPE number DEFAULT 0;
       DEFINE FIELD created_at ON sync_record TYPE datetime DEFAULT time::now();
       DEFINE FIELD updated_at ON sync_record TYPE datetime DEFAULT time::now();
       DEFINE INDEX idx_sync_record_table_user ON sync_record COLUMNS table_name, user_id, case_id;`,

      // 离线队列表
      `DEFINE TABLE offline_queue SCHEMAFULL;
       DEFINE FIELD sync_key ON offline_queue TYPE string;
       DEFINE FIELD queue_data ON offline_queue TYPE any;
       DEFINE FIELD created_at ON offline_queue TYPE datetime DEFAULT time::now();
       DEFINE FIELD updated_at ON offline_queue TYPE datetime DEFAULT time::now();
       DEFINE INDEX idx_offline_queue_sync_key ON offline_queue COLUMNS sync_key;`
    ];

    for (const definition of tableDefinitions) {
      try {
        await this.localDb.query(definition);
      } catch (error) {
        console.warn('DataCacheManager: Failed to create table definition:', error);
      }
    }
  }

  /**
   * 订阅数据表（持久化缓存）
   * 用于用户个人信息，如权限菜单、操作按钮
   */
  async subscribePersistent(
    tables: string[],
    userId: string,
    caseId?: string,
    config?: Partial<CacheConfig>
  ): Promise<void> {
    const cacheConfig: CacheConfig = {
      type: 'persistent',
      tables,
      enableLiveQuery: true,
      enableIncrementalSync: true,
      syncInterval: 5 * 60 * 1000, // 5分钟
      expirationMs: 24 * 60 * 60 * 1000, // 24小时
      ...config
    };

    console.log(`DataCacheManager: Subscribing to persistent cache for tables: ${tables.join(', ')}`);
    
    for (const table of tables) {
      const subscriptionId = this.generateSubscriptionId(table, 'persistent', userId, caseId);
      
      // 记录订阅
      await this.recordSubscription(subscriptionId, table, 'persistent', userId, caseId);
      
      // 初始化全量同步
      await this.performFullSync(table, userId, caseId, 'persistent');
      
      // 设置 Live Query
      if (cacheConfig.enableLiveQuery && this.remoteDb) {
        await this.setupLiveQuery(subscriptionId, table, userId, caseId);
      }
      
      // 设置定时增量同步
      if (cacheConfig.enableIncrementalSync && cacheConfig.syncInterval) {
        this.setupIncrementalSync(subscriptionId, table, userId, caseId, cacheConfig.syncInterval);
      }
    }
  }

  /**
   * 订阅数据表（临时缓存）
   * 用于页面数据，进入页面时订阅，离开页面时取消订阅
   */
  async subscribeTemporary(
    tables: string[],
    userId: string,
    caseId?: string,
    config?: Partial<CacheConfig>
  ): Promise<void> {
    const cacheConfig: CacheConfig = {
      type: 'temporary',
      tables,
      enableLiveQuery: true,
      enableIncrementalSync: true,
      syncInterval: 30 * 1000, // 30秒
      expirationMs: 60 * 60 * 1000, // 1小时
      ...config
    };

    console.log(`DataCacheManager: Subscribing to temporary cache for tables: ${tables.join(', ')}`);
    
    for (const table of tables) {
      const subscriptionId = this.generateSubscriptionId(table, 'temporary', userId, caseId);
      
      // 记录订阅
      await this.recordSubscription(subscriptionId, table, 'temporary', userId, caseId);
      
      // 初始化增量同步（基于最后更新时间）
      await this.performIncrementalSync(table, userId, caseId, 'temporary');
      
      // 设置 Live Query
      if (cacheConfig.enableLiveQuery && this.remoteDb) {
        await this.setupLiveQuery(subscriptionId, table, userId, caseId);
      }
      
      // 设置定时增量同步
      if (cacheConfig.enableIncrementalSync && cacheConfig.syncInterval) {
        this.setupIncrementalSync(subscriptionId, table, userId, caseId, cacheConfig.syncInterval);
      }
    }
  }

  /**
   * 取消订阅
   */
  async unsubscribe(
    tables: string[],
    cacheType: CacheStrategyType,
    userId: string,
    caseId?: string
  ): Promise<void> {
    console.log(`DataCacheManager: Unsubscribing from ${cacheType} cache for tables: ${tables.join(', ')}`);
    
    for (const table of tables) {
      const subscriptionId = this.generateSubscriptionId(table, cacheType, userId, caseId);
      
      // 取消 Live Query
      await this.cancelLiveQuery(subscriptionId);
      
      // 取消定时同步
      this.cancelIncrementalSync(subscriptionId);
      
      // 移除订阅记录
      await this.removeSubscription(subscriptionId);
      
      // 如果是临时缓存，清除缓存数据
      if (cacheType === 'temporary') {
        await this.clearTableCache(table, userId, caseId);
      }
    }
  }

  /**
   * 查询缓存数据
   */
  async queryCache(
    table: string,
    query: string,
    params?: QueryParams,
    userId?: string,
    caseId?: string
  ): Promise<UnknownData[]> {
    try {
      // 构建缓存查询
      const cacheQuery = `
        SELECT data, created_at FROM data_table_cache 
        WHERE table_name = $table_name 
          AND (user_id = $user_id OR user_id IS NULL)
          AND (case_id = $case_id OR case_id IS NULL)
          AND (expires_at IS NULL OR expires_at > time::now())
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const cacheResult = await this.localDb.query(cacheQuery, {
        table_name: table,
        user_id: userId,
        case_id: caseId
      });
      
      if (cacheResult && cacheResult.length > 0) {
        // 从缓存中获取数据
        const cachedData = cacheResult.map((item: DatabaseQueryResult) => item.data).flat();
        
        // 如果有缓存数据，直接返回缓存数据
        if (cachedData && cachedData.length > 0) {
          // 对于简单查询，直接返回缓存数据，但需要反序列化RecordId
          // 复杂查询的本地执行暂时跳过，直接返回缓存数据
          return deserializeRecordIds(cachedData);
        }
      }
      
      // 缓存中没有数据，返回空数组让调用者去远程获取
      return [];
    } catch (error) {
      console.error('DataCacheManager: Error querying cache:', error);
      return [];
    }
  }

  /**
   * 更新缓存数据（本地和远程同步）
   */
  async updateData(
    table: string,
    recordId: string | RecordId,
    data: UpdateData,
    userId?: string,
    caseId?: string
  ): Promise<UnknownData> {
    try {
      // 同时更新本地和远程
      const [localResult, remoteResult] = await Promise.all([
        this.updateLocalCache(table, recordId, data, userId, caseId),
        this.remoteDb ? this.remoteDb.update(recordId, data) : Promise.resolve(null)
      ]);
      
      // 广播数据更新事件
      await this.broadcastToAllClients({
        type: 'data_updated',
        payload: {
          table,
          recordId,
          data,
          userId,
          caseId,
          timestamp: Date.now()
        }
      });
      
      return remoteResult || localResult;
    } catch (error) {
      console.error('DataCacheManager: Error updating data:', error);
      throw error;
    }
  }

  /**
   * 生成订阅ID
   */
  private generateSubscriptionId(
    table: string,
    cacheType: CacheStrategyType,
    userId: string,
    caseId?: string
  ): string {
    return `${table}_${cacheType}_${userId}_${caseId || 'global'}`;
  }

  /**
   * 记录订阅
   */
  private async recordSubscription(
    subscriptionId: string,
    table: string,
    cacheType: CacheStrategyType,
    userId: string,
    caseId?: string
  ): Promise<void> {
    const subscription: SubscriptionItem = {
      id: subscriptionId,
      table_name: table,
      cache_type: cacheType,
      user_id: userId,
      case_id: caseId, // 直接使用caseId，让undefined自然处理
      last_sync_time: Date.now(),
      is_active: true,
      created_at: new Date()
    };
    
    this.activeSubscriptions.set(subscriptionId, subscription);
    
    try {
      // 使用指定的 RecordId 而不是让数据库自动生成
      const recordId = new RecordId('subscription_management', subscriptionId);
      
      // 准备订阅数据，确保所有必需字段都存在
      const subscriptionData: any = {
        table_name: table,
        cache_type: cacheType, // 确保 cache_type 字段始终存在
        user_id: userId,
        case_id: caseId, // 显式设置为null，符合option<string>类型要求
        last_sync_time: Date.now(),
        is_active: true,
        created_at: new Date()
      };
      
      // 使用UPSERT来避免重复创建问题
      try {
        await this.localDb.upsert(recordId, subscriptionData as unknown as FlexibleRecord);
      } catch {
        // 如果UPSERT失败，尝试删除后重新创建
        try {
          await this.localDb.delete(recordId);
          await this.localDb.create(recordId, subscriptionData as unknown as FlexibleRecord);
        } catch (createError) {
          console.warn('DataCacheManager: Failed to create subscription after delete:', createError);
        }
      }
    } catch (error) {
      console.warn('DataCacheManager: Failed to record subscription:', error);
      throw error; // 重新抛出错误以便上层处理
    }
  }

  /**
   * 执行全量同步
   */
  private async performFullSync(
    table: string,
    userId: string,
    caseId?: string,
    cacheType: CacheStrategyType = 'persistent'
  ): Promise<void> {
    if (!this.remoteDb) return;
    
    try {
      console.log(`DataCacheManager: Performing full sync for table: ${table}`);
      
      // 从远程获取所有数据
      const remoteData = await this.remoteDb.select(table);
      
      // 缓存到本地
      await this.cacheData(table, remoteData, cacheType, userId, caseId);
      
      // 记录同步日志
      await this.recordSyncLog(table, 'full', userId, caseId, Array.isArray(remoteData) ? remoteData.length : 1);
      
      console.log(`DataCacheManager: Full sync completed for table: ${table}`);
    } catch (error) {
      console.error(`DataCacheManager: Full sync failed for table: ${table}`, error);
    }
  }

  /**
   * 执行增量同步
   */
  private async performIncrementalSync(
    table: string,
    userId: string,
    caseId?: string,
    cacheType: CacheStrategyType = 'temporary'
  ): Promise<void> {
    if (!this.remoteDb) return;
    
    try {
      // 获取最后同步时间
      const lastSyncTime = await this.getLastSyncTime(table, userId, caseId);
      
      console.log(`DataCacheManager: Performing incremental sync for table: ${table}, last sync: ${new Date(lastSyncTime).toISOString()}`);
      
      // 查询自上次同步以来的变更
      const query = `
        SELECT * FROM ${table} 
        WHERE updated_at > $last_sync_time 
        ORDER BY updated_at ASC
      `;
      
      const changedData = await this.remoteDb.query(query, {
        last_sync_time: new Date(lastSyncTime).toISOString()
      });
      
      if (changedData && changedData.length > 0) {
        // 更新本地缓存
        await this.mergeCacheData(table, changedData, cacheType, userId, caseId);
        
        // 记录同步日志
        await this.recordSyncLog(table, 'incremental', userId, caseId, changedData.length);
        
        console.log(`DataCacheManager: Incremental sync completed for table: ${table}, ${changedData.length} records updated`);
      }
    } catch (error) {
      console.error(`DataCacheManager: Incremental sync failed for table: ${table}`, error);
    }
  }

  /**
   * 缓存数据到本地
   */
  async cacheData(
    table: string,
    data: CacheData,
    cacheType: CacheStrategyType,
    userId?: string,
    caseId?: string
  ): Promise<void> {
    const cacheKey = this.generateDataCacheKey(table, userId, caseId);
    let expiresAt: Date | undefined;
    
    // 根据缓存类型设置过期时间
    switch (cacheType) {
      case 'temporary':
        expiresAt = new Date(Date.now() + this.defaultExpirationMs);
        break;
      case 'auto_sync':
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24小时
        break;
      case 'persistent':
      default:
        expiresAt = undefined; // 不过期
        break;
    }
    
    const cacheItem: DataTableCache = {
      id: new RecordId('data_table_cache', cacheKey),
      table_name: table,
      cache_key: cacheKey,
      data,
      created_at: new Date(),
      updated_at: new Date(),
      sync_timestamp: Date.now(),
      cache_type: cacheType,
      user_id: userId,
      case_id: caseId,
      expires_at: expiresAt
    };
    
    try {
      // 过滤掉 undefined 值，避免在 SurrealDB 中变成 NONE
      const cacheData = Object.fromEntries(
        Object.entries(cacheItem).filter(([_, value]) => value !== undefined)
      );
      
      await this.localDb.create(cacheItem.id, cacheData as unknown as FlexibleRecord);
    } catch {
      // 如果创建失败，可能是因为记录已存在，尝试更新
      try {
        const cacheData = Object.fromEntries(
          Object.entries(cacheItem).filter(([_, value]) => value !== undefined)
        );
        
        await this.localDb.update(cacheItem.id, cacheData as unknown as FlexibleRecord);
      } catch (updateError) {
        console.warn('DataCacheManager: Failed to cache data:', updateError);
      }
    }
  }

  /**
   * 生成数据缓存键（用于数据表缓存）
   */
  private generateDataCacheKey(table: string, userId?: string, caseId?: string): string {
    return `${table}_${userId || 'global'}_${caseId || 'all'}_${Date.now()}`;
  }

  /**
   * 获取最后同步时间
   */
  private async getLastSyncTime(table: string, userId?: string, caseId?: string): Promise<number> {
    try {
      const query = `
        SELECT sync_timestamp FROM sync_log 
        WHERE table_name = $table_name 
          AND (user_id = $user_id OR user_id IS NULL)
          AND (case_id = $case_id OR case_id IS NULL)
        ORDER BY sync_timestamp DESC 
        LIMIT 1
      `;
      
      const result = await this.localDb.query(query, {
        table_name: table,
        user_id: userId,
        case_id: caseId
      });
      
      return (result as DatabaseQueryResult[])?.[0]?.sync_timestamp || 0;
    } catch (error) {
      console.warn('DataCacheManager: Failed to get last sync time:', error);
      return 0;
    }
  }

  /**
   * 记录同步日志
   */
  private async recordSyncLog(
    table: string,
    syncType: 'full' | 'incremental',
    userId?: string,
    caseId?: string,
    recordsCount: number = 0
  ): Promise<void> {
    try {
      await this.localDb.create('sync_log', {
        table_name: table,
        sync_type: syncType,
        user_id: userId,
        case_id: caseId,
        sync_timestamp: Date.now(),
        records_synced: recordsCount,
        created_at: new Date()
      });
    } catch (error) {
      console.warn('DataCacheManager: Failed to record sync log:', error);
    }
  }

  /**
   * 设置 Live Query
   */
  private async setupLiveQuery(
    subscriptionId: string,
    table: string,
    userId?: string,
    caseId?: string
  ): Promise<void> {
    if (!this.remoteDb) return;
    
    try {
      const query = `LIVE SELECT * FROM ${table}`;
      
      const uuid = await this.remoteDb.live(query, async (action, result) => {
        // 处理 Live Query 更新
        await this.handleLiveQueryUpdate(subscriptionId, table, action, result, userId, caseId);
      });
      
      this.liveQueries.set(subscriptionId, String(uuid));
      
      // 更新订阅记录
      const subscription = this.activeSubscriptions.get(subscriptionId);
      if (subscription) {
        subscription.live_query_uuid = String(uuid);
        await this.localDb.update(new RecordId('subscription_management', subscriptionId), {
          live_query_uuid: String(uuid)
        });
      }
      
      console.log(`DataCacheManager: Live query setup for table: ${table}, UUID: ${uuid}`);
    } catch (error) {
      console.error(`DataCacheManager: Failed to setup live query for table: ${table}`, error);
    }
  }

  /**
   * 处理 Live Query 更新
   */
  private async handleLiveQueryUpdate(
    subscriptionId: string,
    table: string,
    action: string,
    result: UnknownData,
    userId?: string,
    caseId?: string
  ): Promise<void> {
    try {
      console.log(`DataCacheManager: Live query update for table: ${table}, action: ${action}`);
      
      // 更新本地缓存
      await this.updateLocalCacheFromLiveQuery(table, action, result, userId, caseId);
      
      // 广播更新事件
      await this.broadcastToAllClients({
        type: 'live_data_update',
        payload: {
          subscriptionId,
          table,
          action,
          result,
          userId,
          caseId,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      console.error('DataCacheManager: Failed to handle live query update:', error);
    }
  }

  /**
   * 更新本地缓存（从 Live Query）
   */
  private async updateLocalCacheFromLiveQuery(
    table: string,
    action: string,
    result: UnknownData,
    userId?: string,
    caseId?: string
  ): Promise<void> {
    // 根据 action 类型更新缓存
    switch (action) {
      case 'CREATE':
      case 'UPDATE':
        await this.mergeCacheData(table, [result], 'temporary', userId, caseId);
        break;
      case 'DELETE':
        await this.removeCacheData(table, result.id as string | RecordId, userId, caseId);
        break;
      default:
        console.warn(`DataCacheManager: Unknown live query action: ${action}`);
    }
  }

  /**
   * 合并缓存数据
   */
  private async mergeCacheData(
    table: string,
    data: QueryResultItem[],
    cacheType: CacheStrategyType,
    userId?: string,
    caseId?: string
  ): Promise<void> {
    // 获取现有缓存
    const existingCache = await this.getCachedData(table, userId, caseId);
    
    // 合并数据
    const mergedData = this.mergeData(existingCache, data);
    
    // 更新缓存
    await this.cacheData(table, mergedData, cacheType, userId, caseId);
  }

  /**
   * 获取缓存数据
   */
  private async getCachedData(table: string, userId?: string, caseId?: string): Promise<QueryResultItem[]> {
    try {
      const query = `
        SELECT data, created_at FROM data_table_cache 
        WHERE table_name = $table_name 
          AND (user_id = $user_id OR user_id IS NULL)
          AND (case_id = $case_id OR case_id IS NULL)
          AND (expires_at IS NULL OR expires_at > time::now())
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const result = await this.localDb.query(query, {
        table_name: table,
        user_id: userId,
        case_id: caseId
      });
      
      const data = (result as DatabaseQueryResult[])?.[0]?.data || [];
      return deserializeRecordIds(data);
    } catch (error) {
      console.warn('DataCacheManager: Failed to get cached data:', error);
      return [];
    }
  }

  /**
   * 合并数据
   */
  private mergeData(existingData: QueryResultItem[], newData: QueryResultItem[]): QueryResultItem[] {
    const merged = [...existingData];
    
    for (const newItem of newData) {
      const existingIndex = merged.findIndex(item => 
        item.id && newItem.id && String(item.id) === String(newItem.id)
      );
      
      if (existingIndex >= 0) {
        // 更新现有项
        merged[existingIndex] = newItem;
      } else {
        // 添加新项
        merged.push(newItem);
      }
    }
    
    return merged;
  }

  /**
   * 移除缓存数据
   */
  private async removeCacheData(
    table: string,
    recordId: string | RecordId,
    userId?: string,
    caseId?: string
  ): Promise<void> {
    const existingData = await this.getCachedData(table, userId, caseId);
    const filteredData = existingData.filter(item => 
      !(item.id && String(item.id) === String(recordId))
    );
    
    await this.cacheData(table, filteredData, 'temporary', userId, caseId);
  }

  /**
   * 更新本地缓存
   */
  private async updateLocalCache(
    table: string,
    recordId: string | RecordId,
    data: UpdateData,
    userId?: string,
    caseId?: string
  ): Promise<UpdateData> {
    const existingData = await this.getCachedData(table, userId, caseId);
    const updatedData = existingData.map(item => 
      item.id && String(item.id) === String(recordId) ? { ...item, ...data } : item
    );
    
    await this.cacheData(table, updatedData, 'temporary', userId, caseId);
    
    return data;
  }

  /**
   * 设置增量同步定时器
   */
  private setupIncrementalSync(
    subscriptionId: string,
    table: string,
    userId: string,
    caseId: string | undefined,
    interval: number
  ): void {
    const timer = setInterval(async () => {
      await this.performIncrementalSync(table, userId, caseId, 'temporary');
    }, interval);
    
    this.syncTimers.set(subscriptionId, timer);
  }

  /**
   * 取消增量同步定时器
   */
  private cancelIncrementalSync(subscriptionId: string): void {
    const timer = this.syncTimers.get(subscriptionId);
    if (timer) {
      clearInterval(timer);
      this.syncTimers.delete(subscriptionId);
    }
  }

  /**
   * 取消 Live Query
   */
  private async cancelLiveQuery(subscriptionId: string): Promise<void> {
    const uuid = this.liveQueries.get(subscriptionId);
    if (uuid && this.remoteDb) {
      try {
        await this.remoteDb.kill(uuid);
        this.liveQueries.delete(subscriptionId);
        console.log(`DataCacheManager: Live query cancelled for subscription: ${subscriptionId}`);
      } catch (error) {
        console.error(`DataCacheManager: Failed to cancel live query: ${subscriptionId}`, error);
      }
    }
  }

  /**
   * 移除订阅记录
   */
  private async removeSubscription(subscriptionId: string): Promise<void> {
    this.activeSubscriptions.delete(subscriptionId);
    
    try {
      await this.localDb.delete(new RecordId('subscription_management', subscriptionId));
    } catch (error) {
      console.warn('DataCacheManager: Failed to remove subscription:', error);
    }
  }


  /**
   * 恢复活跃订阅
   */
  private async restoreActiveSubscriptions(): Promise<void> {
    try {
      const query = `SELECT * FROM subscription_management WHERE is_active = true`;
      const subscriptions = await this.localDb.query(query);
      
      if (Array.isArray(subscriptions)) {
        for (const sub of subscriptions) {
          const subscription = sub as DatabaseSubscriptionItem;
          this.activeSubscriptions.set(subscription.id, {
            id: subscription.id,
            table_name: subscription.table_name,
            cache_type: subscription.cache_type,
            user_id: subscription.user_id,
            case_id: subscription.case_id,
            live_query_uuid: subscription.live_query_uuid,
            last_sync_time: subscription.last_sync_time,
            is_active: subscription.is_active,
            created_at: subscription.created_at
          });
          
          // 重新设置 Live Query
          if (subscription.live_query_uuid && this.remoteDb) {
            // 注意：这里可能需要重新创建 Live Query，因为 UUID 可能已经失效
            await this.setupLiveQuery(subscription.id, subscription.table_name, subscription.user_id, subscription.case_id);
          }
        }
      }
      
      console.log(`DataCacheManager: Restored ${this.activeSubscriptions.size} active subscriptions`);
    } catch (error) {
      console.warn('DataCacheManager: Failed to restore active subscriptions:', error);
    }
  }

  /**
   * 清除所有缓存
   */
  async clearAllCache(): Promise<void> {
    const tables = ['data_table_cache', 'subscription_management', 'sync_log'];
    
    for (const table of tables) {
      try {
        await this.localDb.query(`DELETE FROM ${table}`);
      } catch (error) {
        console.warn(`DataCacheManager: Failed to clear table ${table}:`, error);
      }
    }
    
    // 清除内存状态
    this.activeSubscriptions.clear();
    this.liveQueries.clear();
    
    // 清除所有定时器
    this.syncTimers.forEach(timer => clearInterval(timer));
    this.syncTimers.clear();
  }

  /**
   * 缓存用户个人数据
   */
  async cachePersonalData(userId: string, caseId: string | undefined, personalData: UnknownData): Promise<void> {
    const cacheKey = this.generateDataCacheKey('user_personal_data', userId, caseId);
    
    const cacheItem: DataTableCache = {
      id: new RecordId('data_table_cache', cacheKey),
      table_name: 'user_personal_data',
      cache_key: cacheKey,
      data: personalData,
      created_at: new Date(),
      updated_at: new Date(),
      sync_timestamp: Date.now(),
      cache_type: 'persistent',
      user_id: userId,
      case_id: caseId,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时后过期
    };
    
    try {
      // 过滤掉 undefined 值，避免在 SurrealDB 中变成 NONE
      const cacheData = Object.fromEntries(
        Object.entries(cacheItem).filter(([_, value]) => value !== undefined)
      );
      
      await this.localDb.create(cacheItem.id, cacheData as unknown as FlexibleRecord);
    } catch {
      // 如果创建失败，尝试更新
      try {
        const cacheData = Object.fromEntries(
          Object.entries(cacheItem).filter(([_, value]) => value !== undefined)
        );
        
        await this.localDb.update(cacheItem.id, cacheData as unknown as FlexibleRecord);
      } catch (updateError) {
        console.warn('DataCacheManager: Failed to cache personal data:', updateError);
      }
    }
  }

  /**
   * 获取用户个人数据
   */
  async getPersonalData(userId: string, caseId: string | undefined): Promise<UnknownData | null> {
    try {
      const query = `
        SELECT data, created_at FROM data_table_cache 
        WHERE table_name = 'user_personal_data'
          AND user_id = $user_id 
          AND (case_id = $case_id OR case_id IS NULL)
          AND (expires_at IS NULL OR expires_at > time::now())
        ORDER BY created_at DESC
        LIMIT 1
      `;
      
      const result = await this.localDb.query(query, {
        user_id: userId,
        case_id: caseId
      });
      
      const data = (result as DatabaseQueryResult[])?.[0]?.data;
      return deserializeRecordIds(data);
    } catch (error) {
      console.warn('DataCacheManager: Failed to get personal data:', error);
      return null;
    }
  }

  /**
   * 清除用户个人数据
   */
  async clearPersonalData(userId: string, caseId: string | undefined): Promise<void> {
    try {
      const query = `
        DELETE FROM data_table_cache 
        WHERE table_name = 'user_personal_data'
          AND user_id = $user_id 
          AND (case_id = $case_id OR case_id IS NULL)
      `;
      
      await this.localDb.query(query, {
        user_id: userId,
        case_id: caseId
      });
    } catch (error) {
      console.warn('DataCacheManager: Failed to clear personal data:', error);
    }
  }

  /**
   * 清除表缓存（公共方法）
   */
  async clearTableCache(table: string, userId?: string, caseId?: string): Promise<void> {
    try {
      const query = `
        DELETE FROM data_table_cache 
        WHERE table_name = $table_name 
          AND (user_id = $user_id OR user_id IS NULL)
          AND (case_id = $case_id OR case_id IS NULL)
      `;
      
      await this.localDb.query(query, {
        table_name: table,
        user_id: userId,
        case_id: caseId
      });
    } catch (error) {
      console.warn('DataCacheManager: Failed to clear table cache:', error);
    }
  }


  /**
   * 缓存单个记录（通用方法）
   */
  async cacheRecord(
    table: string,
    recordId: string | RecordId,
    record: QueryResultItem,
    cacheType: CacheStrategyType = 'persistent',
    userId?: string,
    caseId?: string
  ): Promise<void> {
    try {
      const cacheKey = this.generateRecordCacheKey(table, recordId.toString(), userId, caseId);
      const expiresAt = cacheType === 'persistent' 
        ? new Date(Date.now() + 24 * 60 * 60 * 1000) // 24小时
        : new Date(Date.now() + this.defaultExpirationMs);

      const cacheData = {
        id: new RecordId('data_table_cache', cacheKey),
        table_name: table,
        cache_key: cacheKey,
        data: [record], // 单个记录也存储为数组，保持一致性
        created_at: new Date(),
        updated_at: new Date(),
        sync_timestamp: Date.now(),
        cache_type: cacheType,
        user_id: userId,
        case_id: caseId,
        expires_at: expiresAt
      };

      // 尝试创建或更新缓存项
      const existingCacheItems = await this.localDb.query(
        `SELECT * FROM data_table_cache WHERE cache_key = $cache_key LIMIT 1`,
        { cache_key: cacheKey }
      );

      if (existingCacheItems && existingCacheItems.length > 0) {
        // 更新现有缓存
        const existingItem = existingCacheItems[0] as DataTableCache;
        await this.localDb.update(existingItem.id, {
          data: [record],
          updated_at: new Date(),
          sync_timestamp: Date.now()
        });
      } else {
        // 创建新缓存
        await this.localDb.create(cacheData.id, cacheData as unknown as FlexibleRecord);
      }

      console.log(`DataCacheManager: Cached record ${recordId} for table: ${table}`);
    } catch (error) {
      console.error('DataCacheManager: Failed to cache record:', error);
    }
  }

  /**
   * 获取单个缓存记录（通用方法）
   */
  async getCachedRecord(
    table: string,
    recordId: string | RecordId,
    userId?: string,
    caseId?: string
  ): Promise<QueryResultItem | null> {
    try {
      const cacheKey = this.generateRecordCacheKey(table, recordId.toString(), userId, caseId);
      
      const query = `
        SELECT data FROM data_table_cache 
        WHERE cache_key = $cache_key 
          AND (expires_at IS NULL OR expires_at > time::now())
        LIMIT 1
      `;
      
      const result = await this.localDb.query(query, { cache_key: cacheKey });
      
      if (result && result.length > 0) {
        const cacheData = (result[0] as any)?.data;
        if (Array.isArray(cacheData) && cacheData.length > 0) {
          console.log(`DataCacheManager: Found cached record ${recordId} for table: ${table}`);
          return deserializeRecordIds(cacheData[0]);
        }
      }
      
      console.log(`DataCacheManager: No cached record found for ${recordId} in table: ${table}`);
      return null;
    } catch (error) {
      console.error('DataCacheManager: Failed to get cached record:', error);
      return null;
    }
  }

  /**
   * 生成记录缓存键（用于单个记录缓存）
   */
  private generateRecordCacheKey(table: string, recordId: string, userId?: string, caseId?: string): string {
    const parts = [table, recordId];
    if (userId) parts.push(`user:${userId}`);
    if (caseId) parts.push(`case:${caseId}`);
    return parts.join('::');
  }

  /**
   * 清除单个记录缓存
   */
  async clearCachedRecord(
    table: string,
    recordId: string | RecordId,
    userId?: string,
    caseId?: string
  ): Promise<void> {
    try {
      const cacheKey = this.generateRecordCacheKey(table, recordId.toString(), userId, caseId);
      
      const query = `DELETE FROM data_table_cache WHERE cache_key = $cache_key`;
      await this.localDb.query(query, { cache_key: cacheKey });
      
      console.log(`DataCacheManager: Cleared cached record ${recordId} for table: ${table}`);
    } catch (error) {
      console.error('DataCacheManager: Failed to clear cached record:', error);
    }
  }

  /**
   * 关闭数据缓存管理器
   */
  async close(): Promise<void> {
    console.log('DataCacheManager: Closing...');
    
    // 取消所有 Live Query
    for (const subscriptionId of this.liveQueries.keys()) {
      await this.cancelLiveQuery(subscriptionId);
    }
    
    // 取消所有定时器
    this.syncTimers.forEach(timer => clearInterval(timer));
    
    // 清除内存状态
    this.activeSubscriptions.clear();
    this.liveQueries.clear();
    this.syncTimers.clear();
    
    console.log('DataCacheManager: Closed successfully');
  }
}