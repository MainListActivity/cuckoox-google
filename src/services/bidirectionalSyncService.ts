import { RecordId } from 'surrealdb';
import { incrementalSyncService } from './incrementalSyncService';

// Data service interface for dependency injection
interface DataServiceInterface {
  query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T>;
  mutate<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T>;
  create<T = unknown>(thing: string, data: unknown): Promise<T>;
  update<T = unknown>(thing: string | RecordId, data: unknown): Promise<T>;
  delete<T = unknown>(thing: string | RecordId): Promise<T>;
}

/**
 * 双向同步配置
 */
export interface BidirectionalSyncConfig {
  tables: string[]; // 需要同步的表
  syncInterval: number; // 同步间隔
  maxRetryAttempts: number; // 最大重试次数
  retryDelay: number; // 重试延迟
  conflictResolution: 'local' | 'remote' | 'timestamp' | 'manual'; // 冲突解决策略
  offlineQueueSize: number; // 离线队列大小
  networkTimeout: number; // 网络超时时间
  enableBatching: boolean; // 是否启用批处理
  batchSize: number; // 批处理大小
  batchTimeout: number; // 批处理超时时间
}

/**
 * 同步操作
 */
export interface SyncOperation {
  id: string;
  table: string;
  operation: 'create' | 'update' | 'delete';
  recordId: RecordId;
  data: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  userId?: string;
  caseId?: string;
}

/**
 * 网络状态
 */
export interface NetworkStatus {
  isOnline: boolean;
  lastOnlineTime: number;
  lastOfflineTime: number;
  connectionQuality: 'excellent' | 'good' | 'fair' | 'poor';
  reconnectAttempts: number;
}

/**
 * 同步状态
 */
export interface SyncStatus {
  isActive: boolean;
  direction: 'local-to-remote' | 'remote-to-local' | 'bidirectional';
  lastSyncTime: number;
  pendingOperations: number;
  failedOperations: number;
  conflictedOperations: number;
  networkStatus: NetworkStatus;
}

/**
 * 双向数据同步服务
 * 
 * 提供本地和远程数据库之间的双向同步功能，包括：
 * - 本地数据修改后自动同步到远程
 * - 远程数据变更自动同步到本地
 * - 智能冲突检测和解决
 * - 离线模式支持
 * - 网络恢复时的数据恢复
 * - 批处理优化
 */
export class BidirectionalSyncService {
  private dataService: DataServiceInterface | null = null;
  private syncQueues = new Map<string, SyncOperation[]>();
  private activeSync = new Set<string>();
  private syncTimers = new Map<string, NodeJS.Timeout>();
  private networkStatus: NetworkStatus = {
    isOnline: navigator.onLine,
    lastOnlineTime: Date.now(),
    lastOfflineTime: 0,
    connectionQuality: 'excellent',
    reconnectAttempts: 0
  };
  
  private defaultConfig: BidirectionalSyncConfig = {
    tables: [],
    syncInterval: 5 * 1000, // 5秒
    maxRetryAttempts: 3,
    retryDelay: 1000,
    conflictResolution: 'timestamp',
    offlineQueueSize: 1000,
    networkTimeout: 10000,
    enableBatching: true,
    batchSize: 20,
    batchTimeout: 2000
  };

  constructor() {
    this.setupNetworkMonitoring();
    this.setupOfflineQueuePersistence();
  }

  /**
   * Set DataService for dependency injection
   * @param dataService DataService instance 
   */
  setDataService(dataService: DataServiceInterface) {
    this.dataService = dataService;
  }

  /**
   * Ensure dataService is available
   */
  private ensureDataService(): DataServiceInterface {
    if (!this.dataService) {
      throw new Error('DataService not initialized. Call setDataService() first.');
    }
    return this.dataService;
  }

  /**
   * 启动双向同步
   */
  async startBidirectionalSync(
    tables: string[],
    userId: string,
    caseId?: string,
    config?: Partial<BidirectionalSyncConfig>
  ): Promise<void> {
    const syncConfig = { ...this.defaultConfig, ...config, tables };
    const syncKey = this.generateSyncKey(tables, userId, caseId);
    
    console.log('BidirectionalSyncService: Starting bidirectional sync for:', syncKey);
    
    // 初始化同步队列
    this.syncQueues.set(syncKey, []);
    
    // 启动本地到远程同步
    await this.startLocalToRemoteSync(syncConfig, userId, caseId);
    
    // 启动远程到本地同步
    await this.startRemoteToLocalSync(syncConfig, userId, caseId);
    
    // 启动定时同步
    this.setupPeriodicSync(syncKey, syncConfig, userId, caseId);
    
    console.log('BidirectionalSyncService: Bidirectional sync started for:', syncKey);
  }

  /**
   * 停止双向同步
   */
  async stopBidirectionalSync(
    tables: string[],
    userId: string,
    caseId?: string
  ): Promise<void> {
    const syncKey = this.generateSyncKey(tables, userId, caseId);
    
    console.log('BidirectionalSyncService: Stopping bidirectional sync for:', syncKey);
    
    // 停止定时同步
    const timer = this.syncTimers.get(syncKey);
    if (timer) {
      clearInterval(timer);
      this.syncTimers.delete(syncKey);
    }
    
    // 清理同步队列
    this.syncQueues.delete(syncKey);
    this.activeSync.delete(syncKey);
    
    console.log('BidirectionalSyncService: Bidirectional sync stopped for:', syncKey);
  }

  /**
   * 添加本地操作到同步队列
   */
  async queueLocalOperation(
    table: string,
    operation: 'create' | 'update' | 'delete',
    recordId: RecordId,
    data: any,
    userId: string,
    caseId?: string
  ): Promise<void> {
    const syncKey = this.generateSyncKey([table], userId, caseId);
    
    const syncOperation: SyncOperation = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      table,
      operation,
      recordId,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
      userId,
      caseId
    };
    
    // 添加到同步队列
    const queue = this.syncQueues.get(syncKey) || [];
    queue.push(syncOperation);
    this.syncQueues.set(syncKey, queue);
    
    console.log('BidirectionalSyncService: Queued local operation:', syncOperation);
    
    // 如果在线，立即尝试同步
    if (this.networkStatus.isOnline) {
      await this.processLocalToRemoteSync(syncKey, [syncOperation]);
    }
    
    // 持久化队列
    await this.persistOfflineQueue(syncKey, queue);
  }

  /**
   * 启动本地到远程同步
   */
  private async startLocalToRemoteSync(
    config: BidirectionalSyncConfig,
    userId: string,
    caseId?: string
  ): Promise<void> {
    const syncKey = this.generateSyncKey(config.tables, userId, caseId);
    
    console.log('BidirectionalSyncService: Starting local-to-remote sync for:', syncKey);
    
    // 恢复离线队列
    await this.restoreOfflineQueue(syncKey);
    
    // 如果有待同步的操作，立即开始同步
    const queue = this.syncQueues.get(syncKey) || [];
    if (queue.length > 0 && this.networkStatus.isOnline) {
      await this.processLocalToRemoteSync(syncKey, queue);
    }
  }

  /**
   * 启动远程到本地同步
   */
  private async startRemoteToLocalSync(
    config: BidirectionalSyncConfig,
    userId: string,
    caseId?: string
  ): Promise<void> {
    console.log('BidirectionalSyncService: Starting remote-to-local sync');
    
    // 启动增量同步服务
    await incrementalSyncService.startIncrementalSync(
      config.tables,
      userId,
      caseId,
      {
        syncInterval: config.syncInterval,
        batchSize: config.batchSize,
        retryAttempts: config.maxRetryAttempts,
        retryDelay: config.retryDelay,
        conflictResolution: config.conflictResolution
      }
    );
  }

  /**
   * 处理本地到远程同步
   */
  private async processLocalToRemoteSync(
    syncKey: string,
    operations: SyncOperation[]
  ): Promise<void> {
    if (this.activeSync.has(syncKey) || !this.networkStatus.isOnline) {
      return;
    }
    
    this.activeSync.add(syncKey);
    
    try {
      console.log(`BidirectionalSyncService: Processing ${operations.length} local operations for sync key: ${syncKey}`);
      
      const config = this.defaultConfig;
      
      // 根据配置决定是否批处理
      if (config.enableBatching && operations.length > 1) {
        await this.processBatchOperations(operations, config);
      } else {
        await this.processIndividualOperations(operations, config);
      }
      
      // 清理成功的操作
      const queue = this.syncQueues.get(syncKey) || [];
      const remainingOperations = queue.filter(op => op.status !== 'completed');
      this.syncQueues.set(syncKey, remainingOperations);
      
      // 更新持久化队列
      await this.persistOfflineQueue(syncKey, remainingOperations);
      
    } catch (error) {
      console.error('BidirectionalSyncService: Error processing local-to-remote sync:', error);
    } finally {
      this.activeSync.delete(syncKey);
    }
  }

  /**
   * 处理批量操作
   */
  private async processBatchOperations(
    operations: SyncOperation[],
    config: BidirectionalSyncConfig
  ): Promise<void> {
    // 按表分组操作
    const operationsByTable = new Map<string, SyncOperation[]>();
    
    for (const operation of operations) {
      const tableOps = operationsByTable.get(operation.table) || [];
      tableOps.push(operation);
      operationsByTable.set(operation.table, tableOps);
    }
    
    // 为每个表处理批量操作
    for (const [table, tableOperations] of operationsByTable) {
      await this.processBatchOperationsForTable(table, tableOperations, config);
    }
  }

  /**
   * 处理单个表的批量操作
   */
  private async processBatchOperationsForTable(
    table: string,
    operations: SyncOperation[],
    config: BidirectionalSyncConfig
  ): Promise<void> {
    try {
      console.log(`BidirectionalSyncService: Processing batch operations for table: ${table}`);
      
      // 构建批量操作查询
      const batchQueries: string[] = [];
      const batchParams: Record<string, any> = {};
      
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        const paramKey = `op_${i}`;
        
        switch (operation.operation) {
          case 'create':
            batchQueries.push(`CREATE ${table} CONTENT $${paramKey}_data`);
            batchParams[`${paramKey}_data`] = operation.data;
            break;
            
          case 'update':
            batchQueries.push(`UPDATE $${paramKey}_id MERGE $${paramKey}_data`);
            batchParams[`${paramKey}_id`] = operation.recordId;
            batchParams[`${paramKey}_data`] = operation.data;
            break;
            
          case 'delete':
            batchQueries.push(`DELETE $${paramKey}_id`);
            batchParams[`${paramKey}_id`] = operation.recordId;
            break;
        }
      }
      
      // 执行批量查询
      const batchQuery = batchQueries.join('; ');
      const results = await this.ensureDataService().query(batchQuery, batchParams);
      
      // 更新操作状态
      for (const operation of operations) {
        operation.status = 'completed';
        operation.timestamp = Date.now();
      }
      
      console.log(`BidirectionalSyncService: Successfully processed batch operations for table: ${table}`);
      
    } catch (error) {
      console.error(`BidirectionalSyncService: Error processing batch operations for table: ${table}`, error);
      
      // 标记操作为失败
      for (const operation of operations) {
        operation.status = 'failed';
        operation.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        operation.retryCount++;
      }
    }
  }

  /**
   * 处理单个操作
   */
  private async processIndividualOperations(
    operations: SyncOperation[],
    config: BidirectionalSyncConfig
  ): Promise<void> {
    for (const operation of operations) {
      try {
        operation.status = 'processing';
        
        await this.processIndividualOperation(operation);
        
        operation.status = 'completed';
        operation.timestamp = Date.now();
        
      } catch (error) {
        console.error('BidirectionalSyncService: Error processing individual operation:', error);
        
        operation.status = 'failed';
        operation.errorMessage = error instanceof Error ? error.message : 'Unknown error';
        operation.retryCount++;
        
        // 如果重试次数未达到上限，重新排队
        if (operation.retryCount < config.maxRetryAttempts) {
          operation.status = 'pending';
          
          // 延迟重试
          setTimeout(async () => {
            await this.processIndividualOperation(operation);
          }, config.retryDelay * operation.retryCount);
        }
      }
    }
  }

  /**
   * 处理单个操作
   */
  private async processIndividualOperation(operation: SyncOperation): Promise<void> {
    console.log('BidirectionalSyncService: Processing individual operation:', operation);
    
    try {
      switch (operation.operation) {
        case 'create':
          await this.ensureDataService().create(operation.table, operation.data);
          break;
          
        case 'update':
          await this.ensureDataService().update(operation.recordId, operation.data);
          break;
          
        case 'delete':
          await this.ensureDataService().delete(operation.recordId);
          break;
      }
      
      console.log('BidirectionalSyncService: Successfully processed individual operation:', operation.id);
      
    } catch (error) {
      console.error('BidirectionalSyncService: Error processing individual operation:', error);
      throw error;
    }
  }

  /**
   * 设置定时同步
   */
  private setupPeriodicSync(
    syncKey: string,
    config: BidirectionalSyncConfig,
    userId: string,
    caseId?: string
  ): void {
    const timer = setInterval(async () => {
      if (this.networkStatus.isOnline) {
        const queue = this.syncQueues.get(syncKey) || [];
        const pendingOperations = queue.filter(op => op.status === 'pending');
        
        if (pendingOperations.length > 0) {
          await this.processLocalToRemoteSync(syncKey, pendingOperations);
        }
      }
    }, config.syncInterval);
    
    this.syncTimers.set(syncKey, timer);
  }

  /**
   * 设置网络监控
   */
  private setupNetworkMonitoring(): void {
    // 监听网络状态变化
    window.addEventListener('online', () => {
      console.log('BidirectionalSyncService: Network came online');
      this.networkStatus.isOnline = true;
      this.networkStatus.lastOnlineTime = Date.now();
      this.networkStatus.reconnectAttempts = 0;
      
      // 恢复所有待同步的操作
      this.resumeAllSyncs();
    });
    
    window.addEventListener('offline', () => {
      console.log('BidirectionalSyncService: Network went offline');
      this.networkStatus.isOnline = false;
      this.networkStatus.lastOfflineTime = Date.now();
    });
    
    // 定期检查网络质量
    setInterval(() => {
      this.checkNetworkQuality();
    }, 30000); // 每30秒检查一次
  }

  /**
   * 检查网络质量
   */
  private async checkNetworkQuality(): Promise<void> {
    if (!this.networkStatus.isOnline) return;
    
    try {
      const startTime = Date.now();
      
      // 发送一个小的请求来测试网络延迟
      const response = await fetch('/api/ping', {
        method: 'GET',
        cache: 'no-cache'
      });
      
      const endTime = Date.now();
      const latency = endTime - startTime;
      
      // 根据延迟判断网络质量
      if (latency < 100) {
        this.networkStatus.connectionQuality = 'excellent';
      } else if (latency < 300) {
        this.networkStatus.connectionQuality = 'good';
      } else if (latency < 1000) {
        this.networkStatus.connectionQuality = 'fair';
      } else {
        this.networkStatus.connectionQuality = 'poor';
      }
      
    } catch (error) {
      console.warn('BidirectionalSyncService: Network quality check failed:', error);
      this.networkStatus.connectionQuality = 'poor';
    }
  }

  /**
   * 恢复所有同步
   */
  private async resumeAllSyncs(): Promise<void> {
    console.log('BidirectionalSyncService: Resuming all syncs after network recovery');
    
    for (const [syncKey, queue] of this.syncQueues) {
      const pendingOperations = queue.filter(op => op.status === 'pending' || op.status === 'failed');
      
      if (pendingOperations.length > 0) {
        console.log(`BidirectionalSyncService: Resuming sync for ${syncKey} with ${pendingOperations.length} pending operations`);
        await this.processLocalToRemoteSync(syncKey, pendingOperations);
      }
    }
  }

  /**
   * 设置离线队列持久化
   */
  private setupOfflineQueuePersistence(): void {
    // 在页面关闭前保存离线队列
    window.addEventListener('beforeunload', () => {
      for (const [syncKey, queue] of this.syncQueues) {
        this.persistOfflineQueue(syncKey, queue);
      }
    });
  }

  /**
   * 持久化离线队列
   */
  private async persistOfflineQueue(syncKey: string, queue: SyncOperation[]): Promise<void> {
    try {
      await this.sendMessageToServiceWorker('persist_offline_queue', {
        syncKey,
        queue
      });
    } catch (error) {
      console.error('BidirectionalSyncService: Error persisting offline queue:', error);
    }
  }

  /**
   * 恢复离线队列
   */
  private async restoreOfflineQueue(syncKey: string): Promise<void> {
    try {
      const result = await this.sendMessageToServiceWorker('restore_offline_queue', {
        syncKey
      });
      
      if (result.queue && result.queue.length > 0) {
        this.syncQueues.set(syncKey, result.queue);
        console.log(`BidirectionalSyncService: Restored offline queue for ${syncKey} with ${result.queue.length} operations`);
      }
    } catch (error) {
      console.error('BidirectionalSyncService: Error restoring offline queue:', error);
    }
  }

  /**
   * 获取同步状态
   */
  getSyncStatus(tables: string[], userId: string, caseId?: string): SyncStatus {
    const syncKey = this.generateSyncKey(tables, userId, caseId);
    const queue = this.syncQueues.get(syncKey) || [];
    
    return {
      isActive: this.activeSync.has(syncKey),
      direction: 'bidirectional',
      lastSyncTime: Date.now(),
      pendingOperations: queue.filter(op => op.status === 'pending').length,
      failedOperations: queue.filter(op => op.status === 'failed').length,
      conflictedOperations: 0, // TODO: 实现冲突统计
      networkStatus: this.networkStatus
    };
  }

  /**
   * 清理同步数据
   */
  async clearSyncData(tables: string[], userId: string, caseId?: string): Promise<void> {
    const syncKey = this.generateSyncKey(tables, userId, caseId);
    
    // 停止同步
    await this.stopBidirectionalSync(tables, userId, caseId);
    
    // 清理持久化数据
    await this.sendMessageToServiceWorker('clear_offline_queue', {
      syncKey
    });
    
    console.log('BidirectionalSyncService: Cleared sync data for:', syncKey);
  }

  /**
   * 生成同步键
   */
  private generateSyncKey(tables: string[], userId: string, caseId?: string): string {
    return `${tables.join('_')}_${userId}_${caseId || 'global'}`;
  }

  /**
   * 发送消息到Service Worker
   */
  private async sendMessageToServiceWorker(type: string, payload: any): Promise<any> {
    // 使用统一的Service Worker客户端
    const { surrealServiceWorkerClient } = await import('@/src/lib/surrealServiceWorkerClient');
    
    if (!surrealServiceWorkerClient.isServiceWorkerAvailable()) {
      console.warn('BidirectionalSyncService: Service Worker not available');
      return Promise.resolve({ success: true });
    }
    
    try {
      await surrealServiceWorkerClient.waitForReady();
      return await surrealServiceWorkerClient.sendGenericMessage(type, payload);
    } catch (error) {
      console.error('BidirectionalSyncService: Service Worker communication error:', error);
      throw error;
    }
  }

  /**
   * 停止所有同步
   */
  stopAllSyncs(): void {
    console.log('BidirectionalSyncService: Stopping all syncs');
    
    for (const syncKey of this.syncTimers.keys()) {
      const timer = this.syncTimers.get(syncKey);
      if (timer) {
        clearInterval(timer);
      }
    }
    
    this.syncTimers.clear();
    this.activeSync.clear();
    
    // 停止增量同步
    incrementalSyncService.stopAllSyncs();
  }
}

export const bidirectionalSyncService = new BidirectionalSyncService();