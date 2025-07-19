import { RecordId } from 'surrealdb';
import type { Surreal } from 'surrealdb';
import { DataCacheManager } from './data-cache-manager';
import type { UnknownData, QueryParams } from '@/src/types/surreal';

// 订阅类型
export enum SubscriptionType {
  FULL_TABLE = 'FULL_TABLE',           // 全表订阅
  CONDITIONAL = 'CONDITIONAL',         // 条件订阅
  USER_SPECIFIC = 'USER_SPECIFIC',     // 用户特定数据
  CASE_SPECIFIC = 'CASE_SPECIFIC',     // 案件特定数据
  REAL_TIME = 'REAL_TIME'              // 实时数据
}

// 订阅策略
export interface SubscriptionStrategy {
  type: SubscriptionType;
  table: string;
  conditions?: string;              // SQL WHERE条件
  updateFrequency: number;          // 更新频率（毫秒）
  batchSize: number;                // 批处理大小
  priority: number;                 // 优先级 1-10
  enableIncrementalSync: boolean;   // 是否启用增量同步
  maxRetries: number;               // 最大重试次数
}

// 活跃订阅信息
export interface ActiveSubscription {
  id: string;
  strategy: SubscriptionStrategy;
  liveQueryUuid?: string;
  userId?: string;
  caseId?: string;
  lastSyncTime: number;
  lastHeartbeat: number;
  isHealthy: boolean;
  retryCount: number;
  subscriptionTime: number;
  syncTimer?: NodeJS.Timeout;
}

// 数据变更事件
export interface DataChangeEvent {
  table: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  recordId: string | RecordId;
  oldData?: UnknownData;
  newData?: UnknownData;
  timestamp: number;
  userId?: string;
  caseId?: string;
}

// 同步状态
export interface SyncStatus {
  table: string;
  lastSyncTime: number;
  syncCount: number;
  errorCount: number;
  lastError?: string;
  isActive: boolean;
  nextSyncTime: number;
}

/**
 * 精细化数据订阅管理器
 * 负责管理远程数据变更订阅和本地数据同步
 */
export class SubscriptionManager {
  private remoteDb?: Surreal;
  private localDb: Surreal;
  private dataCacheManager: DataCacheManager;
  private broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>;

  // 活跃订阅管理
  private activeSubscriptions = new Map<string, ActiveSubscription>();
  
  // 数据变更事件队列
  private changeEventQueue: DataChangeEvent[] = [];
  private isProcessingQueue = false;
  
  // 健康检查
  private healthCheckTimer?: NodeJS.Timeout;
  private readonly HEALTH_CHECK_INTERVAL = 30 * 1000; // 30秒
  
  // 同步状态跟踪
  private syncStatusMap = new Map<string, SyncStatus>();

  // 预定义订阅策略
  private readonly SUBSCRIPTION_STRATEGIES: Record<string, SubscriptionStrategy> = {
    // 用户权限相关表 - 低频更新，高优先级
    user: {
      type: SubscriptionType.FULL_TABLE,
      table: 'user',
      updateFrequency: 10 * 60 * 1000, // 10分钟
      batchSize: 100,
      priority: 9,
      enableIncrementalSync: true,
      maxRetries: 3
    },
    
    role: {
      type: SubscriptionType.FULL_TABLE,
      table: 'role',
      updateFrequency: 30 * 60 * 1000, // 30分钟
      batchSize: 50,
      priority: 8,
      enableIncrementalSync: true,
      maxRetries: 3
    },
    
    menu_metadata: {
      type: SubscriptionType.FULL_TABLE,
      table: 'menu_metadata',
      updateFrequency: 60 * 60 * 1000, // 1小时
      batchSize: 50,
      priority: 7,
      enableIncrementalSync: false, // 菜单变化不频繁，全量同步
      maxRetries: 2
    },
    
    // 案件相关表 - 中等频率更新
    case: {
      type: SubscriptionType.CONDITIONAL,
      table: 'case',
      conditions: 'status != "archived"', // 只订阅活跃案件
      updateFrequency: 5 * 60 * 1000, // 5分钟
      batchSize: 200,
      priority: 8,
      enableIncrementalSync: true,
      maxRetries: 3
    },
    
    claim: {
      type: SubscriptionType.CASE_SPECIFIC,
      table: 'claim',
      updateFrequency: 2 * 60 * 1000, // 2分钟
      batchSize: 100,
      priority: 7,
      enableIncrementalSync: true,
      maxRetries: 3
    },
    
    // 实时数据表 - 高频更新
    notification: {
      type: SubscriptionType.USER_SPECIFIC,
      table: 'notification',
      updateFrequency: 30 * 1000, // 30秒
      batchSize: 50,
      priority: 10,
      enableIncrementalSync: true,
      maxRetries: 5
    },
    
    message: {
      type: SubscriptionType.REAL_TIME,
      table: 'message',
      updateFrequency: 10 * 1000, // 10秒
      batchSize: 20,
      priority: 10,
      enableIncrementalSync: true,
      maxRetries: 5
    },
    
    // 关系表 - 用户特定
    has_role: {
      type: SubscriptionType.USER_SPECIFIC,
      table: 'has_role',
      updateFrequency: 15 * 60 * 1000, // 15分钟
      batchSize: 100,
      priority: 8,
      enableIncrementalSync: true,
      maxRetries: 3
    },
    
    has_case_role: {
      type: SubscriptionType.USER_SPECIFIC,
      table: 'has_case_role',
      updateFrequency: 10 * 60 * 1000, // 10分钟
      batchSize: 100,
      priority: 8,
      enableIncrementalSync: true,
      maxRetries: 3
    }
  };

  constructor(
    localDb: Surreal,
    dataCacheManager: DataCacheManager,
    broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>,
    remoteDb?: Surreal
  ) {
    this.localDb = localDb;
    this.remoteDb = remoteDb;
    this.dataCacheManager = dataCacheManager;
    this.broadcastToAllClients = broadcastToAllClients;
    
    this.startHealthCheck();
    this.startChangeEventProcessor();
  }

  /**
   * 订阅表数据变更
   */
  async subscribeToTable(
    table: string,
    userId?: string,
    caseId?: string,
    customStrategy?: Partial<SubscriptionStrategy>
  ): Promise<string> {
    
    const baseStrategy = this.SUBSCRIPTION_STRATEGIES[table] || this.getDefaultStrategy(table);
    const strategy: SubscriptionStrategy = { ...baseStrategy, ...customStrategy };
    
    const subscriptionId = this.generateSubscriptionId(table, strategy.type, userId, caseId);
    
    // 检查是否已存在相同订阅
    if (this.activeSubscriptions.has(subscriptionId)) {
      console.log(`SubscriptionManager: Subscription ${subscriptionId} already exists`);
      return subscriptionId;
    }

    try {
      // 创建活跃订阅记录
      const subscription: ActiveSubscription = {
        id: subscriptionId,
        strategy,
        userId,
        caseId,
        lastSyncTime: 0,
        lastHeartbeat: Date.now(),
        isHealthy: true,
        retryCount: 0,
        subscriptionTime: Date.now()
      };

      this.activeSubscriptions.set(subscriptionId, subscription);

      // 设置Live Query
      await this.setupLiveQuery(subscription);

      // 初始化同步
      await this.performInitialSync(subscription);

      // 设置定时同步
      this.setupPeriodicSync(subscription);

      // 更新同步状态
      this.updateSyncStatus(table, Date.now(), 0, 0, undefined, true);

      console.log(`SubscriptionManager: Successfully subscribed to table: ${table} with strategy: ${strategy.type}`);
      return subscriptionId;

    } catch (error) {
      console.error(`SubscriptionManager: Failed to subscribe to table: ${table}`, error);
      this.activeSubscriptions.delete(subscriptionId);
      throw error;
    }
  }

  /**
   * 取消订阅
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const subscription = this.activeSubscriptions.get(subscriptionId);
    if (!subscription) {
      console.warn(`SubscriptionManager: Subscription ${subscriptionId} not found`);
      return;
    }

    try {
      // 取消Live Query
      if (subscription.liveQueryUuid && this.remoteDb) {
        await this.remoteDb.kill(subscription.liveQueryUuid as any);
      }

      // 清除定时器
      if (subscription.syncTimer) {
        clearInterval(subscription.syncTimer);
      }

      // 移除订阅
      this.activeSubscriptions.delete(subscriptionId);

      // 更新同步状态
      this.updateSyncStatus(subscription.strategy.table, Date.now(), 0, 0, undefined, false);

      console.log(`SubscriptionManager: Successfully unsubscribed: ${subscriptionId}`);

    } catch (error) {
      console.error(`SubscriptionManager: Failed to unsubscribe: ${subscriptionId}`, error);
    }
  }

  /**
   * 设置Live Query
   */
  private async setupLiveQuery(subscription: ActiveSubscription): Promise<void> {
    if (!this.remoteDb) {
      console.warn('SubscriptionManager: Remote database not available for live query');
      return;
    }

    try {
      const query = this.buildLiveQuery(subscription);
      
      const uuid = await this.remoteDb.live(query, async (action, result) => {
        await this.handleLiveQueryUpdate(subscription, action, result);
      });

      subscription.liveQueryUuid = String(uuid);
      subscription.lastHeartbeat = Date.now();

      console.log(`SubscriptionManager: Live query setup for ${subscription.strategy.table}, UUID: ${uuid}`);

    } catch (error) {
      console.error(`SubscriptionManager: Failed to setup live query for ${subscription.strategy.table}:`, error);
      throw error;
    }
  }

  /**
   * 构建Live Query语句
   */
  private buildLiveQuery(subscription: ActiveSubscription): string {
    const { strategy, userId, caseId } = subscription;
    
    let query = `LIVE SELECT * FROM ${strategy.table}`;
    
    const conditions: string[] = [];
    
    // 添加策略条件
    if (strategy.conditions) {
      conditions.push(strategy.conditions);
    }
    
    // 添加用户特定条件
    if (strategy.type === SubscriptionType.USER_SPECIFIC && userId) {
      conditions.push(`user_id = "${userId}"`);
    }
    
    // 添加案件特定条件
    if (strategy.type === SubscriptionType.CASE_SPECIFIC && caseId) {
      conditions.push(`case_id = "${caseId}"`);
    }
    
    // 添加用户和案件组合条件
    if (strategy.type === SubscriptionType.USER_SPECIFIC && userId && caseId) {
      conditions.push(`(user_id = "${userId}" OR case_id = "${caseId}")`);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    return query;
  }

  /**
   * 处理Live Query更新
   */
  private async handleLiveQueryUpdate(
    subscription: ActiveSubscription,
    action: string,
    result: UnknownData
  ): Promise<void> {
    
    subscription.lastHeartbeat = Date.now();
    
    try {
      // 创建数据变更事件
      const changeEvent: DataChangeEvent = {
        table: subscription.strategy.table,
        action: action as any,
        recordId: (result as any)?.id || 'unknown',
        newData: action !== 'DELETE' ? result : undefined,
        oldData: action === 'DELETE' ? result : undefined,
        timestamp: Date.now(),
        userId: subscription.userId,
        caseId: subscription.caseId
      };

      // 添加到变更队列
      this.changeEventQueue.push(changeEvent);

      // 立即更新本地缓存
      await this.updateLocalCacheFromChange(changeEvent);

      // 广播变更事件
      await this.broadcastToAllClients({
        type: 'live_data_change',
        payload: {
          subscriptionId: subscription.id,
          table: subscription.strategy.table,
          action,
          data: result,
          timestamp: Date.now()
        }
      });

      console.log(`SubscriptionManager: Processed live update for ${subscription.strategy.table}: ${action}`);

    } catch (error) {
      console.error(`SubscriptionManager: Failed to handle live query update:`, error);
      this.incrementErrorCount(subscription.strategy.table);
    }
  }

  /**
   * 执行初始同步
   */
  private async performInitialSync(subscription: ActiveSubscription): Promise<void> {
    if (!this.remoteDb) return;

    const { strategy, userId, caseId } = subscription;

    try {
      console.log(`SubscriptionManager: Performing initial sync for table: ${strategy.table}`);

      let query = `SELECT * FROM ${strategy.table}`;
      const queryParams: QueryParams = {};

      // 构建查询条件
      const conditions: string[] = [];
      
      if (strategy.conditions) {
        conditions.push(strategy.conditions);
      }
      
      if (strategy.type === SubscriptionType.USER_SPECIFIC && userId) {
        conditions.push('user_id = $user_id');
        queryParams.user_id = userId;
      }
      
      if (strategy.type === SubscriptionType.CASE_SPECIFIC && caseId) {
        conditions.push('case_id = $case_id');
        queryParams.case_id = caseId;
      }
      
      if (conditions.length > 0) {
        query += ` WHERE ${conditions.join(' AND ')}`;
      }

      // 添加排序和分页
      query += ` ORDER BY updated_at DESC LIMIT ${strategy.batchSize}`;

      // 执行查询
      const data = await this.remoteDb.query(query, queryParams);

      if (data && data.length > 0) {
        // 缓存数据
        const cacheType = strategy.priority >= 8 ? 'persistent' : 'temporary';
        await this.dataCacheManager.cacheData(strategy.table, data, cacheType, userId, caseId);

        // 更新同步状态
        subscription.lastSyncTime = Date.now();
        this.incrementSyncCount(strategy.table, data.length);

        console.log(`SubscriptionManager: Initial sync completed for ${strategy.table}: ${data.length} records`);
      }

    } catch (error) {
      console.error(`SubscriptionManager: Initial sync failed for ${strategy.table}:`, error);
      this.incrementErrorCount(strategy.table, error.message);
      throw error;
    }
  }

  /**
   * 设置定时同步
   */
  private setupPeriodicSync(subscription: ActiveSubscription): void {
    if (!subscription.strategy.enableIncrementalSync) {
      return;
    }

    subscription.syncTimer = setInterval(async () => {
      await this.performIncrementalSync(subscription);
    }, subscription.strategy.updateFrequency);
  }

  /**
   * 执行增量同步
   */
  private async performIncrementalSync(subscription: ActiveSubscription): Promise<void> {
    if (!this.remoteDb || !subscription.strategy.enableIncrementalSync) return;

    const { strategy, userId, caseId, lastSyncTime } = subscription;

    try {
      console.log(`SubscriptionManager: Performing incremental sync for table: ${strategy.table}`);

      let query = `SELECT * FROM ${strategy.table} WHERE updated_at > $last_sync_time`;
      const queryParams: QueryParams = {
        last_sync_time: new Date(lastSyncTime).toISOString()
      };

      // 添加额外条件
      if (strategy.conditions) {
        query += ` AND (${strategy.conditions})`;
      }
      
      if (strategy.type === SubscriptionType.USER_SPECIFIC && userId) {
        query += ' AND user_id = $user_id';
        queryParams.user_id = userId;
      }
      
      if (strategy.type === SubscriptionType.CASE_SPECIFIC && caseId) {
        query += ' AND case_id = $case_id';
        queryParams.case_id = caseId;
      }

      query += ` ORDER BY updated_at ASC LIMIT ${strategy.batchSize}`;

      const data = await this.remoteDb.query(query, queryParams);

      if (data && data.length > 0) {
        // 合并到本地缓存
        await this.mergeIncrementalData(strategy.table, data, userId, caseId);

        // 更新同步时间
        subscription.lastSyncTime = Date.now();
        this.incrementSyncCount(strategy.table, data.length);

        console.log(`SubscriptionManager: Incremental sync completed for ${strategy.table}: ${data.length} records`);

        // 如果获取到了批量大小的数据，说明可能还有更多数据，安排下一次同步
        if (data.length === strategy.batchSize) {
          setTimeout(() => this.performIncrementalSync(subscription), 1000);
        }
      }

    } catch (error) {
      console.error(`SubscriptionManager: Incremental sync failed for ${strategy.table}:`, error);
      this.incrementErrorCount(strategy.table, error.message);
      
      // 增加重试计数
      subscription.retryCount++;
      if (subscription.retryCount >= strategy.maxRetries) {
        console.error(`SubscriptionManager: Max retries reached for ${strategy.table}, marking as unhealthy`);
        subscription.isHealthy = false;
      }
    }
  }

  /**
   * 合并增量数据
   */
  private async mergeIncrementalData(
    table: string,
    data: UnknownData[],
    userId?: string,
    caseId?: string
  ): Promise<void> {
    
    try {
      // 获取现有缓存数据
      const existingData = await this.getCachedTableData(table, userId, caseId);
      
      // 合并数据
      const mergedData = this.mergeDataArrays(existingData, data);
      
      // 重新缓存合并后的数据
      const cacheType = this.getCacheTypeForTable(table);
      await this.dataCacheManager.cacheData(table, mergedData, cacheType, userId, caseId);
      
    } catch (error) {
      console.error(`SubscriptionManager: Failed to merge incremental data for ${table}:`, error);
    }
  }

  /**
   * 获取缓存的表数据
   */
  private async getCachedTableData(
    table: string,
    userId?: string,
    caseId?: string
  ): Promise<UnknownData[]> {
    
    try {
      const query = `
        SELECT data FROM data_table_cache 
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
      
      return (result as any[])?.[0]?.data || [];
    } catch (error) {
      console.warn(`SubscriptionManager: Failed to get cached data for ${table}:`, error);
      return [];
    }
  }

  /**
   * 合并数据数组
   */
  private mergeDataArrays(existingData: UnknownData[], newData: UnknownData[]): UnknownData[] {
    const merged = [...existingData];
    
    for (const newItem of newData) {
      const existingIndex = merged.findIndex(item => 
        (item as any).id && (newItem as any).id && 
        String((item as any).id) === String((newItem as any).id)
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
   * 从变更事件更新本地缓存
   */
  private async updateLocalCacheFromChange(event: DataChangeEvent): Promise<void> {
    try {
      const existingData = await this.getCachedTableData(event.table, event.userId, event.caseId);
      let updatedData = [...existingData];

      switch (event.action) {
        case 'CREATE':
        case 'UPDATE':
          if (event.newData) {
            const existingIndex = updatedData.findIndex(item => 
              (item as any).id && String((item as any).id) === String(event.recordId)
            );
            
            if (existingIndex >= 0) {
              updatedData[existingIndex] = event.newData;
            } else {
              updatedData.push(event.newData);
            }
          }
          break;
          
        case 'DELETE':
          updatedData = updatedData.filter(item => 
            !((item as any).id && String((item as any).id) === String(event.recordId))
          );
          break;
      }

      // 更新缓存
      const cacheType = this.getCacheTypeForTable(event.table);
      await this.dataCacheManager.cacheData(event.table, updatedData, cacheType, event.userId, event.caseId);

    } catch (error) {
      console.error('SubscriptionManager: Failed to update local cache from change event:', error);
    }
  }

  /**
   * 获取表的缓存类型
   */
  private getCacheTypeForTable(table: string): 'persistent' | 'temporary' {
    const strategy = this.SUBSCRIPTION_STRATEGIES[table];
    return strategy && strategy.priority >= 8 ? 'persistent' : 'temporary';
  }

  /**
   * 启动变更事件处理器
   */
  private startChangeEventProcessor(): void {
    setInterval(async () => {
      if (this.isProcessingQueue || this.changeEventQueue.length === 0) {
        return;
      }

      this.isProcessingQueue = true;
      
      try {
        const batchSize = 10;
        const batch = this.changeEventQueue.splice(0, batchSize);
        
        for (const event of batch) {
          // 这里可以添加额外的事件处理逻辑
          // 比如数据验证、业务逻辑触发等
        }
        
      } catch (error) {
        console.error('SubscriptionManager: Error processing change events:', error);
      } finally {
        this.isProcessingQueue = false;
      }
    }, 1000); // 每秒处理一次
  }

  /**
   * 启动健康检查
   */
  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.HEALTH_CHECK_INTERVAL);
  }

  /**
   * 执行健康检查
   */
  private performHealthCheck(): void {
    const now = Date.now();
    const maxHeartbeatAge = 5 * 60 * 1000; // 5分钟

    for (const [id, subscription] of this.activeSubscriptions.entries()) {
      const heartbeatAge = now - subscription.lastHeartbeat;
      
      if (heartbeatAge > maxHeartbeatAge) {
        console.warn(`SubscriptionManager: Subscription ${id} appears unhealthy (no heartbeat for ${heartbeatAge}ms)`);
        subscription.isHealthy = false;
        
        // 尝试重新建立连接
        this.attemptReconnection(subscription);
      }
    }
  }

  /**
   * 尝试重新连接
   */
  private async attemptReconnection(subscription: ActiveSubscription): Promise<void> {
    if (subscription.retryCount >= subscription.strategy.maxRetries) {
      console.error(`SubscriptionManager: Max retries reached for subscription ${subscription.id}`);
      return;
    }

    try {
      console.log(`SubscriptionManager: Attempting to reconnect subscription ${subscription.id}`);
      
      // 取消旧的Live Query
      if (subscription.liveQueryUuid && this.remoteDb) {
        try {
          await this.remoteDb.kill(subscription.liveQueryUuid as any);
        } catch (e) {
          // 忽略kill错误
        }
      }

      // 重新设置Live Query
      await this.setupLiveQuery(subscription);
      
      subscription.isHealthy = true;
      subscription.retryCount = 0;
      subscription.lastHeartbeat = Date.now();
      
      console.log(`SubscriptionManager: Successfully reconnected subscription ${subscription.id}`);
      
    } catch (error) {
      console.error(`SubscriptionManager: Failed to reconnect subscription ${subscription.id}:`, error);
      subscription.retryCount++;
    }
  }

  /**
   * 生成订阅ID
   */
  private generateSubscriptionId(
    table: string,
    type: SubscriptionType,
    userId?: string,
    caseId?: string
  ): string {
    const parts = [table, type];
    if (userId) parts.push(`user:${userId}`);
    if (caseId) parts.push(`case:${caseId}`);
    return parts.join('::');
  }

  /**
   * 获取默认策略
   */
  private getDefaultStrategy(table: string): SubscriptionStrategy {
    return {
      type: SubscriptionType.FULL_TABLE,
      table,
      updateFrequency: 30 * 60 * 1000, // 30分钟
      batchSize: 100,
      priority: 5,
      enableIncrementalSync: true,
      maxRetries: 3
    };
  }

  /**
   * 更新同步状态
   */
  private updateSyncStatus(
    table: string,
    lastSyncTime: number,
    syncCount: number,
    errorCount: number,
    lastError?: string,
    isActive: boolean = true
  ): void {
    const current = this.syncStatusMap.get(table) || {
      table,
      lastSyncTime: 0,
      syncCount: 0,
      errorCount: 0,
      isActive: false,
      nextSyncTime: 0
    };

    current.lastSyncTime = lastSyncTime;
    current.syncCount += syncCount;
    current.errorCount += errorCount;
    current.isActive = isActive;
    if (lastError) current.lastError = lastError;

    // 计算下次同步时间
    const strategy = this.SUBSCRIPTION_STRATEGIES[table];
    if (strategy) {
      current.nextSyncTime = lastSyncTime + strategy.updateFrequency;
    }

    this.syncStatusMap.set(table, current);
  }

  /**
   * 增加同步计数
   */
  private incrementSyncCount(table: string, count: number = 1): void {
    this.updateSyncStatus(table, Date.now(), count, 0, undefined, true);
  }

  /**
   * 增加错误计数
   */
  private incrementErrorCount(table: string, error?: string): void {
    this.updateSyncStatus(table, Date.now(), 0, 1, error, true);
  }

  /**
   * 获取所有活跃订阅
   */
  getActiveSubscriptions(): Map<string, ActiveSubscription> {
    return new Map(this.activeSubscriptions);
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(): Map<string, SyncStatus> {
    return new Map(this.syncStatusMap);
  }

  /**
   * 获取订阅健康状态
   */
  getHealthStatus(): { healthy: number; unhealthy: number; total: number } {
    let healthy = 0;
    let unhealthy = 0;

    for (const subscription of this.activeSubscriptions.values()) {
      if (subscription.isHealthy) {
        healthy++;
      } else {
        unhealthy++;
      }
    }

    return {
      healthy,
      unhealthy,
      total: this.activeSubscriptions.size
    };
  }

  /**
   * 关闭订阅管理器
   */
  async close(): Promise<void> {
    console.log('SubscriptionManager: Closing...');

    // 停止健康检查
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // 取消所有订阅
    const unsubscribePromises = Array.from(this.activeSubscriptions.keys()).map(id => 
      this.unsubscribe(id)
    );
    
    await Promise.allSettled(unsubscribePromises);

    // 清理状态
    this.activeSubscriptions.clear();
    this.syncStatusMap.clear();
    this.changeEventQueue = [];

    console.log('SubscriptionManager: Closed successfully');
  }
}