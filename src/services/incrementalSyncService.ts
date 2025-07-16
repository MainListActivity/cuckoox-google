import { RecordId } from 'surrealdb';

// Data service interface for dependency injection
interface DataServiceInterface {
  query<T = unknown>(sql: string, vars?: Record<string, unknown>): Promise<T>;
}

/**
 * 增量同步配置
 */
export interface IncrementalSyncConfig {
  tables: string[]; // 需要同步的表
  syncInterval: number; // 同步间隔（毫秒）
  batchSize: number; // 批量同步大小
  retryAttempts: number; // 重试次数
  retryDelay: number; // 重试延迟（毫秒）
  conflictResolution: 'local' | 'remote' | 'timestamp'; // 冲突解决策略
}

/**
 * 同步记录
 */
export interface SyncRecord {
  id: RecordId;
  table_name: string;
  user_id: string;
  case_id?: string;
  last_sync_timestamp: number;
  last_sync_id?: string; // 最后同步的记录ID
  sync_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error_message?: string;
  retry_count: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * 增量更新数据
 */
export interface IncrementalUpdateData {
  id: RecordId;
  table_name: string;
  operation: 'insert' | 'update' | 'delete';
  data: any;
  version: number;
  updated_at: Date;
  sync_timestamp: number;
}

/**
 * 同步结果
 */
export interface SyncResult {
  table: string;
  success: boolean;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsDeleted: number;
  conflicts: number;
  errors: string[];
  syncTimestamp: number;
  duration: number;
}

/**
 * 增量数据同步服务
 * 
 * 负责管理本地和远程数据库之间的增量同步，包括：
 * - 基于更新时间的增量获取
 * - 处理insert、update和delete操作
 * - 冲突检测和解决
 * - 同步状态管理
 * - 错误处理和重试机制
 */
export class IncrementalSyncService {
  private serviceWorkerComm: {
    sendMessage: (type: string, payload?: any) => Promise<any>;
    isAvailable: () => boolean;
    waitForReady: () => Promise<void>;
  } | null = null;

  /**
   * 设置 Service Worker 通信接口 - 由 SurrealProvider 调用
   */
  setServiceWorkerComm(comm: {
    sendMessage: (type: string, payload?: any) => Promise<any>;
    isAvailable: () => boolean;
    waitForReady: () => Promise<void>;
  }) {
    this.serviceWorkerComm = comm;
  }
  private dataService: DataServiceInterface | null = null;
  private syncTimers = new Map<string, NodeJS.Timeout>();
  private activeSyncs = new Set<string>();
  private defaultConfig: IncrementalSyncConfig = {
    tables: [],
    syncInterval: 30 * 1000, // 30秒
    batchSize: 100,
    retryAttempts: 3,
    retryDelay: 1000, // 1秒
    conflictResolution: 'timestamp'
  };

  /**
   * 启动增量同步
   */
  async startIncrementalSync(
    tables: string[],
    userId: string,
    caseId?: string,
    config?: Partial<IncrementalSyncConfig>
  ): Promise<void> {
    const syncConfig = { ...this.defaultConfig, ...config, tables };
    const syncKey = this.generateSyncKey(tables, userId, caseId);
    
    console.log('IncrementalSyncService: Starting incremental sync for:', syncKey);
    
    // 如果同步已经在进行，先停止
    if (this.syncTimers.has(syncKey)) {
      this.stopIncrementalSync(syncKey);
    }
    
    // 初始化同步记录
    await this.initializeSyncRecords(tables, userId, caseId);
    
    // 执行首次同步
    await this.performSync(syncConfig, userId, caseId);
    
    // 设置定时同步
    const timer = setInterval(async () => {
      if (!this.activeSyncs.has(syncKey)) {
        await this.performSync(syncConfig, userId, caseId);
      }
    }, syncConfig.syncInterval);
    
    this.syncTimers.set(syncKey, timer);
    
    console.log('IncrementalSyncService: Incremental sync started for:', syncKey);
  }

  /**
   * 停止增量同步
   */
  stopIncrementalSync(syncKey: string): void {
    console.log('IncrementalSyncService: Stopping incremental sync for:', syncKey);
    
    const timer = this.syncTimers.get(syncKey);
    if (timer) {
      clearInterval(timer);
      this.syncTimers.delete(syncKey);
    }
    
    this.activeSyncs.delete(syncKey);
  }

  /**
   * 执行同步
   */
  private async performSync(
    config: IncrementalSyncConfig,
    userId: string,
    caseId?: string
  ): Promise<SyncResult[]> {
    const syncKey = this.generateSyncKey(config.tables, userId, caseId);
    
    // 防止重复同步
    if (this.activeSyncs.has(syncKey)) {
      console.log('IncrementalSyncService: Sync already in progress for:', syncKey);
      return [];
    }
    
    this.activeSyncs.add(syncKey);
    
    try {
      const results: SyncResult[] = [];
      
      // 为每个表执行增量同步
      for (const table of config.tables) {
        const result = await this.syncTable(table, config, userId, caseId);
        results.push(result);
      }
      
      return results;
    } finally {
      this.activeSyncs.delete(syncKey);
    }
  }

  /**
   * 同步单个表
   */
  private async syncTable(
    table: string,
    config: IncrementalSyncConfig,
    userId: string,
    caseId?: string
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const result: SyncResult = {
      table,
      success: false,
      recordsProcessed: 0,
      recordsInserted: 0,
      recordsUpdated: 0,
      recordsDeleted: 0,
      conflicts: 0,
      errors: [],
      syncTimestamp: startTime,
      duration: 0
    };
    
    try {
      console.log('IncrementalSyncService: Syncing table:', table);
      
      // 获取同步记录
      const syncRecord = await this.getSyncRecord(table, userId, caseId);
      if (!syncRecord) {
        result.errors.push(`No sync record found for table: ${table}`);
        return result;
      }
      
      // 更新同步状态
      await this.updateSyncStatus(syncRecord.id, 'in_progress');
      
      // 获取增量更新数据
      const incrementalUpdates = await this.getIncrementalUpdates(
        table,
        syncRecord.last_sync_timestamp,
        config.batchSize,
        userId,
        caseId
      );
      
      if (incrementalUpdates.length === 0) {
        console.log('IncrementalSyncService: No incremental updates for table:', table);
        result.success = true;
        await this.updateSyncStatus(syncRecord.id, 'completed', Date.now());
        return result;
      }
      
      console.log(`IncrementalSyncService: Processing ${incrementalUpdates.length} incremental updates for table: ${table}`);
      
      // 处理增量更新
      for (const update of incrementalUpdates) {
        try {
          await this.processIncrementalUpdate(update, config, result);
          result.recordsProcessed++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Error processing update for record ${update.id}: ${errorMessage}`);
          console.error('IncrementalSyncService: Error processing update:', error);
        }
      }
      
      // 更新同步记录
      const lastUpdate = incrementalUpdates[incrementalUpdates.length - 1];
      await this.updateSyncRecord(
        syncRecord.id,
        lastUpdate.sync_timestamp,
        lastUpdate.id.toString(),
        'completed'
      );
      
      result.success = true;
      console.log(`IncrementalSyncService: Successfully synced table ${table}: ${result.recordsProcessed} records processed`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Table sync failed: ${errorMessage}`);
      console.error('IncrementalSyncService: Table sync error:', error);
      
      // 更新同步状态为失败
      const syncRecord = await this.getSyncRecord(table, userId, caseId);
      if (syncRecord) {
        await this.updateSyncStatus(syncRecord.id, 'failed', undefined, errorMessage);
      }
    } finally {
      result.duration = Date.now() - startTime;
    }
    
    return result;
  }

  /**
   * 获取增量更新数据
   */
  private async getIncrementalUpdates(
    table: string,
    lastSyncTimestamp: number,
    batchSize: number,
    userId: string,
    caseId?: string
  ): Promise<IncrementalUpdateData[]> {
    try {
      // 构建查询条件
      let whereClause = 'updated_at > $last_sync_time';
      const params: Record<string, any> = {
        last_sync_time: new Date(lastSyncTimestamp).toISOString(),
        batch_size: batchSize
      };
      
      // 如果有案件ID，添加案件过滤条件
      if (caseId) {
        whereClause += ' AND case_id = $case_id';
        params.case_id = caseId;
      }
      
      // 查询增量更新数据
      const query = `
        SELECT 
          id,
          '${table}' as table_name,
          'update' as operation,
          *,
          time::unix(updated_at) * 1000 as sync_timestamp
        FROM ${table}
        WHERE ${whereClause}
        ORDER BY updated_at ASC
        LIMIT $batch_size
      `;
      
      const result = await this.ensureDataService().query(query, params);
      
      return Array.isArray(result) ? result.map(item => ({
        id: item.id,
        table_name: table,
        operation: item.operation || 'update',
        data: item,
        version: item.version || 1,
        updated_at: new Date(item.updated_at),
        sync_timestamp: item.sync_timestamp
      })) : [];
      
    } catch (error) {
      console.error('IncrementalSyncService: Error getting incremental updates:', error);
      return [];
    }
  }

  /**
   * 处理增量更新
   */
  private async processIncrementalUpdate(
    update: IncrementalUpdateData,
    config: IncrementalSyncConfig,
    result: SyncResult
  ): Promise<void> {
    try {
      // 发送到Service Worker进行本地缓存更新
      await this.sendMessageToServiceWorker('process_incremental_update', {
        update,
        conflictResolution: config.conflictResolution
      });
      
      // 根据操作类型更新统计
      switch (update.operation) {
        case 'insert':
          result.recordsInserted++;
          break;
        case 'update':
          result.recordsUpdated++;
          break;
        case 'delete':
          result.recordsDeleted++;
          break;
      }
      
    } catch (error) {
      console.error('IncrementalSyncService: Error processing incremental update:', error);
      throw error;
    }
  }

  /**
   * 初始化同步记录
   */
  private async initializeSyncRecords(
    tables: string[],
    userId: string,
    caseId?: string
  ): Promise<void> {
    for (const table of tables) {
      const existingRecord = await this.getSyncRecord(table, userId, caseId);
      if (!existingRecord) {
        await this.createSyncRecord(table, userId, caseId);
      }
    }
  }

  /**
   * 创建同步记录
   */
  private async createSyncRecord(
    table: string,
    userId: string,
    caseId?: string
  ): Promise<void> {
    try {
      const syncRecord: SyncRecord = {
        id: new RecordId('sync_record', `${table}_${userId}_${caseId || 'global'}`),
        table_name: table,
        user_id: userId,
        case_id: caseId,
        last_sync_timestamp: Date.now() - 24 * 60 * 60 * 1000, // 24小时前
        sync_status: 'pending',
        retry_count: 0,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      // 发送到Service Worker
      await this.sendMessageToServiceWorker('create_sync_record', { syncRecord });
      
    } catch (error) {
      console.error('IncrementalSyncService: Error creating sync record:', error);
      throw error;
    }
  }

  /**
   * 获取同步记录
   */
  private async getSyncRecord(
    table: string,
    userId: string,
    caseId?: string
  ): Promise<SyncRecord | null> {
    try {
      const result = await this.sendMessageToServiceWorker('get_sync_record', {
        table,
        userId,
        caseId: caseId || null
      });
      
      return result.syncRecord || null;
    } catch (error) {
      console.error('IncrementalSyncService: Error getting sync record:', error);
      return null;
    }
  }

  /**
   * 更新同步记录
   */
  private async updateSyncRecord(
    syncRecordId: RecordId,
    lastSyncTimestamp: number,
    lastSyncId?: string,
    status?: 'pending' | 'in_progress' | 'completed' | 'failed'
  ): Promise<void> {
    try {
      await this.sendMessageToServiceWorker('update_sync_record', {
        syncRecordId,
        lastSyncTimestamp,
        lastSyncId,
        status
      });
    } catch (error) {
      console.error('IncrementalSyncService: Error updating sync record:', error);
    }
  }

  /**
   * 更新同步状态
   */
  private async updateSyncStatus(
    syncRecordId: RecordId,
    status: 'pending' | 'in_progress' | 'completed' | 'failed',
    lastSyncTimestamp?: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.sendMessageToServiceWorker('update_sync_status', {
        syncRecordId,
        status,
        lastSyncTimestamp,
        errorMessage
      });
    } catch (error) {
      console.error('IncrementalSyncService: Error updating sync status:', error);
    }
  }

  /**
   * 生成同步键
   */
  private generateSyncKey(tables: string[], userId: string, caseId?: string): string {
    return `${tables.join('_')}_${userId}_${caseId || 'global'}`;
  }

  /**
   * 手动触发同步
   */
  async triggerSync(
    tables: string[],
    userId: string,
    caseId?: string,
    config?: Partial<IncrementalSyncConfig>
  ): Promise<SyncResult[]> {
    const syncConfig = { ...this.defaultConfig, ...config, tables };
    
    console.log('IncrementalSyncService: Manual sync triggered for tables:', tables);
    
    return await this.performSync(syncConfig, userId, caseId);
  }

  /**
   * 获取同步状态
   */
  async getSyncStatus(
    tables: string[],
    userId: string,
    caseId?: string
  ): Promise<SyncRecord[]> {
    const syncRecords: SyncRecord[] = [];
    
    for (const table of tables) {
      const record = await this.getSyncRecord(table, userId, caseId);
      if (record) {
        syncRecords.push(record);
      }
    }
    
    return syncRecords;
  }

  /**
   * 清除同步数据
   */
  async clearSyncData(
    tables: string[],
    userId: string,
    caseId?: string
  ): Promise<void> {
    try {
      console.log('IncrementalSyncService: Clearing sync data for tables:', tables);
      
      // 停止相关的同步
      const syncKey = this.generateSyncKey(tables, userId, caseId);
      this.stopIncrementalSync(syncKey);
      
      // 清除同步记录
      await this.sendMessageToServiceWorker('clear_sync_records', {
        tables,
        userId,
        caseId: caseId || null
      });
      
    } catch (error) {
      console.error('IncrementalSyncService: Error clearing sync data:', error);
      throw error;
    }
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
   * 发送消息到Service Worker
   */
  private async sendMessageToServiceWorker(type: string, payload: any): Promise<any> {
    if (!this.serviceWorkerComm) {
      console.warn('IncrementalSyncService: Service Worker communication not available. Ensure service is properly initialized.');
      return Promise.resolve({ success: true });
    }
    
    if (!this.serviceWorkerComm.isAvailable()) {
      console.warn('IncrementalSyncService: Service Worker not available');
      return Promise.resolve({ success: true });
    }
    
    try {
      await this.serviceWorkerComm.waitForReady();
      return await this.serviceWorkerComm.sendMessage(type, payload);
    } catch (error) {
      console.error('IncrementalSyncService: Service Worker communication error:', error);
      throw error;
    }
  }

  /**
   * 停止所有同步
   */
  stopAllSyncs(): void {
    console.log('IncrementalSyncService: Stopping all syncs');
    
    for (const syncKey of this.syncTimers.keys()) {
      this.stopIncrementalSync(syncKey);
    }
    
    this.syncTimers.clear();
    this.activeSyncs.clear();
  }
}

export const incrementalSyncService = new IncrementalSyncService();