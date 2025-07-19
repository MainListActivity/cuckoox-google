import type { QueryParams, UnknownData } from '../types/surreal';
import { RecordId } from 'surrealdb';

/**
 * 离线修改操作类型
 */
export interface OfflineOperation {
  id: string;
  type: 'create' | 'update' | 'merge' | 'delete' | 'query';
  table: string;
  recordId?: string | RecordId;
  data?: UnknownData;
  sql?: string;
  params?: QueryParams;
  timestamp: number;
  userId?: string;
  caseId?: string;
  retryCount: number;
  maxRetries: number;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  error?: string;
}

/**
 * 网络状态
 */
export interface NetworkStatus {
  isOnline: boolean;
  connectionType?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

/**
 * 离线管理器
 * 负责离线模式检测、本地修改暂存、网络恢复后的自动同步
 */
export class OfflineManager {
  private isOfflineMode = false;
  private offlineOperations = new Map<string, OfflineOperation>();
  private networkStatus: NetworkStatus = { isOnline: navigator.onLine };
  private syncInProgress = false;
  private broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>;
  private localDb: any; // SurrealDB instance
  private remoteDb: any; // SurrealDB instance
  
  // 事件监听器
  private onlineHandler?: () => void;
  private offlineHandler?: () => void;
  private networkChangeHandler?: (event: Event) => void;

  constructor(config: {
    localDb: any;
    remoteDb?: any;
    broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>;
  }) {
    this.localDb = config.localDb;
    this.remoteDb = config.remoteDb;
    this.broadcastToAllClients = config.broadcastToAllClients;
    
    this.initializeNetworkMonitoring();
  }

  /**
   * 初始化网络监控
   */
  private initializeNetworkMonitoring(): void {
    // 监听在线/离线事件
    this.onlineHandler = () => this.handleNetworkOnline();
    this.offlineHandler = () => this.handleNetworkOffline();
    
    self.addEventListener('online', this.onlineHandler);
    self.addEventListener('offline', this.offlineHandler);

    // 监听网络状态变化（如果支持）
    if ('connection' in navigator) {
      this.networkChangeHandler = () => this.updateNetworkStatus();
      (navigator as any).connection.addEventListener('change', this.networkChangeHandler);
    }

    // 初始化网络状态
    this.updateNetworkStatus();
    
    console.log('OfflineManager: Network monitoring initialized');
  }

  /**
   * 更新网络状态
   */
  private updateNetworkStatus(): void {
    const connection = (navigator as any).connection;
    
    this.networkStatus = {
      isOnline: navigator.onLine,
      connectionType: connection?.type,
      effectiveType: connection?.effectiveType,
      downlink: connection?.downlink,
      rtt: connection?.rtt
    };

    console.log('OfflineManager: Network status updated:', this.networkStatus);
  }

  /**
   * 处理网络上线事件
   */
  private async handleNetworkOnline(): Promise<void> {
    console.log('OfflineManager: Network came online');
    
    this.updateNetworkStatus();
    
    // 如果之前是离线模式，尝试自动同步
    if (this.isOfflineMode) {
      this.isOfflineMode = false;
      
      // 广播网络状态变化
      await this.broadcastNetworkStatus();
      
      // 启动自动同步
      await this.startAutoSync();
    }
  }

  /**
   * 处理网络离线事件
   */
  private async handleNetworkOffline(): Promise<void> {
    console.log('OfflineManager: Network went offline');
    
    this.updateNetworkStatus();
    this.isOfflineMode = true;
    
    // 广播网络状态变化
    await this.broadcastNetworkStatus();
  }

  /**
   * 广播网络状态
   */
  private async broadcastNetworkStatus(): Promise<void> {
    await this.broadcastToAllClients({
      type: 'network_status_change',
      payload: {
        isOffline: this.isOfflineMode,
        networkStatus: this.networkStatus,
        pendingOperations: this.offlineOperations.size
      }
    });
  }

  /**
   * 检查是否处于离线模式
   */
  isOffline(): boolean {
    return this.isOfflineMode || !this.networkStatus.isOnline;
  }

  /**
   * 获取网络状态
   */
  getNetworkStatus(): NetworkStatus {
    return { ...this.networkStatus };
  }

  /**
   * 执行离线查询（仅从本地数据库）
   */
  async executeOfflineQuery(sql: string, params?: QueryParams): Promise<UnknownData[]> {
    if (!this.localDb) {
      throw new Error('Local database not available for offline query');
    }

    try {
      console.log('OfflineManager: Executing offline query:', sql);
      const result = await this.localDb.query(sql, params);
      return Array.isArray(result) ? result : [result];
    } catch (error) {
      console.error('OfflineManager: Offline query failed:', error);
      throw new Error(`Offline query failed: ${error}`);
    }
  }

  /**
   * 添加离线操作到队列
   */
  async queueOfflineOperation(operation: Omit<OfflineOperation, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<string> {
    const operationId = crypto.randomUUID();
    
    const offlineOp: OfflineOperation = {
      ...operation,
      id: operationId,
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };

    this.offlineOperations.set(operationId, offlineOp);
    
    console.log(`OfflineManager: Queued offline operation: ${operation.type} on ${operation.table}`);
    
    // 广播队列状态更新
    await this.broadcastQueueStatus();
    
    return operationId;
  }

  /**
   * 获取待同步的操作数量
   */
  getPendingOperationsCount(): number {
    return Array.from(this.offlineOperations.values())
      .filter(op => op.status === 'pending').length;
  }

  /**
   * 获取所有离线操作
   */
  getOfflineOperations(): OfflineOperation[] {
    return Array.from(this.offlineOperations.values());
  }

  /**
   * 启动自动同步
   */
  async startAutoSync(): Promise<void> {
    if (this.syncInProgress || this.isOffline() || !this.remoteDb) {
      return;
    }

    this.syncInProgress = true;
    
    try {
      console.log('OfflineManager: Starting auto sync...');
      
      const pendingOps = Array.from(this.offlineOperations.values())
        .filter(op => op.status === 'pending')
        .sort((a, b) => a.timestamp - b.timestamp); // 按时间顺序同步

      if (pendingOps.length === 0) {
        console.log('OfflineManager: No pending operations to sync');
        return;
      }

      console.log(`OfflineManager: Syncing ${pendingOps.length} pending operations`);
      
      // 广播同步开始
      await this.broadcastSyncStatus('started', pendingOps.length);

      let successCount = 0;
      let failureCount = 0;

      for (const operation of pendingOps) {
        try {
          await this.syncOperation(operation);
          successCount++;
        } catch (error) {
          console.error(`OfflineManager: Failed to sync operation ${operation.id}:`, error);
          failureCount++;
          
          // 更新操作状态
          operation.retryCount++;
          operation.error = String(error);
          
          if (operation.retryCount >= operation.maxRetries) {
            operation.status = 'failed';
            console.error(`OfflineManager: Operation ${operation.id} failed permanently after ${operation.retryCount} retries`);
          } else {
            operation.status = 'pending'; // 重试
          }
        }
      }

      console.log(`OfflineManager: Sync completed. Success: ${successCount}, Failed: ${failureCount}`);
      
      // 广播同步完成
      await this.broadcastSyncStatus('completed', pendingOps.length, successCount, failureCount);
      
    } catch (error) {
      console.error('OfflineManager: Auto sync failed:', error);
      await this.broadcastSyncStatus('failed', 0, 0, 0, String(error));
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 同步单个操作
   */
  private async syncOperation(operation: OfflineOperation): Promise<void> {
    if (!this.remoteDb) {
      throw new Error('Remote database not available');
    }

    operation.status = 'syncing';
    
    try {
      let result: any;
      
      switch (operation.type) {
        case 'create':
          if (!operation.data) throw new Error('Create operation missing data');
          result = await this.remoteDb.create(
            operation.recordId || new RecordId(operation.table, crypto.randomUUID()),
            operation.data
          );
          break;
          
        case 'update':
          if (!operation.recordId || !operation.data) {
            throw new Error('Update operation missing recordId or data');
          }
          result = await this.remoteDb.update(operation.recordId, operation.data);
          break;
          
        case 'merge':
          if (!operation.recordId || !operation.data) {
            throw new Error('Merge operation missing recordId or data');
          }
          result = await this.remoteDb.merge(operation.recordId, operation.data);
          break;
          
        case 'delete':
          if (!operation.recordId) {
            throw new Error('Delete operation missing recordId');
          }
          result = await this.remoteDb.delete(operation.recordId);
          break;
          
        case 'query':
          if (!operation.sql) throw new Error('Query operation missing SQL');
          result = await this.remoteDb.query(operation.sql, operation.params);
          break;
          
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }

      // 标记为完成
      operation.status = 'completed';
      
      console.log(`OfflineManager: Successfully synced operation ${operation.id}: ${operation.type} on ${operation.table}`);
      
      // 可以选择从队列中移除已完成的操作
      // this.offlineOperations.delete(operation.id);
      
    } catch (error) {
      operation.status = 'failed';
      throw error;
    }
  }

  /**
   * 广播同步状态
   */
  private async broadcastSyncStatus(
    status: 'started' | 'completed' | 'failed',
    totalOperations: number,
    successCount?: number,
    failureCount?: number,
    error?: string
  ): Promise<void> {
    await this.broadcastToAllClients({
      type: 'offline_sync_status',
      payload: {
        status,
        totalOperations,
        successCount,
        failureCount,
        error,
        timestamp: Date.now()
      }
    });
  }

  /**
   * 广播队列状态
   */
  private async broadcastQueueStatus(): Promise<void> {
    const pendingCount = this.getPendingOperationsCount();
    const totalCount = this.offlineOperations.size;
    
    await this.broadcastToAllClients({
      type: 'offline_queue_status',
      payload: {
        pendingOperations: pendingCount,
        totalOperations: totalCount,
        isOffline: this.isOffline(),
        timestamp: Date.now()
      }
    });
  }

  /**
   * 清除已完成的操作
   */
  async clearCompletedOperations(): Promise<void> {
    const completedOps = Array.from(this.offlineOperations.entries())
      .filter(([_, op]) => op.status === 'completed');
    
    for (const [id, _] of completedOps) {
      this.offlineOperations.delete(id);
    }
    
    console.log(`OfflineManager: Cleared ${completedOps.length} completed operations`);
    await this.broadcastQueueStatus();
  }

  /**
   * 清除失败的操作
   */
  async clearFailedOperations(): Promise<void> {
    const failedOps = Array.from(this.offlineOperations.entries())
      .filter(([_, op]) => op.status === 'failed');
    
    for (const [id, _] of failedOps) {
      this.offlineOperations.delete(id);
    }
    
    console.log(`OfflineManager: Cleared ${failedOps.length} failed operations`);
    await this.broadcastQueueStatus();
  }

  /**
   * 重试失败的操作
   */
  async retryFailedOperations(): Promise<void> {
    const failedOps = Array.from(this.offlineOperations.values())
      .filter(op => op.status === 'failed');
    
    for (const op of failedOps) {
      op.status = 'pending';
      op.retryCount = 0;
      op.error = undefined;
    }
    
    console.log(`OfflineManager: Reset ${failedOps.length} failed operations for retry`);
    await this.broadcastQueueStatus();
    
    // 如果在线，启动同步
    if (!this.isOffline()) {
      await this.startAutoSync();
    }
  }

  /**
   * 获取离线操作统计
   */
  getOperationStats(): {
    total: number;
    pending: number;
    syncing: number;
    completed: number;
    failed: number;
  } {
    const operations = Array.from(this.offlineOperations.values());
    
    return {
      total: operations.length,
      pending: operations.filter(op => op.status === 'pending').length,
      syncing: operations.filter(op => op.status === 'syncing').length,
      completed: operations.filter(op => op.status === 'completed').length,
      failed: operations.filter(op => op.status === 'failed').length
    };
  }

  /**
   * 关闭离线管理器
   */
  async close(): Promise<void> {
    console.log('OfflineManager: Closing...');
    
    // 移除事件监听器
    if (this.onlineHandler) {
      self.removeEventListener('online', this.onlineHandler);
    }
    if (this.offlineHandler) {
      self.removeEventListener('offline', this.offlineHandler);
    }
    if (this.networkChangeHandler && 'connection' in navigator) {
      (navigator as any).connection.removeEventListener('change', this.networkChangeHandler);
    }
    
    // 清理资源
    this.offlineOperations.clear();
    this.syncInProgress = false;
    
    console.log('OfflineManager: Closed successfully');
  }
}