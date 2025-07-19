import { RecordId } from 'surrealdb';
import type Surreal from 'surrealdb';
import type { QueryParams, UnknownData } from '../types/surreal';
import { MultiTenantManager, type TenantContext } from './multi-tenant-manager';

/**
 * 递归检查并重构被序列化的RecordId对象
 */
function deserializeRecordIds(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'object' && 'id' in obj && 'tb' in obj) {
    return new RecordId(obj.tb, obj.id);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => deserializeRecordIds(item));
  }

  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deserializeRecordIds(value);
    }
    return result;
  }

  return obj;
}

// 自动同步表列表
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

// 检查是否为自动同步表
export function isAutoSyncTable(table: string): table is AutoSyncTable {
  return AUTO_SYNC_TABLES.includes(table as AutoSyncTable);
}

/**
 * 简化的数据缓存管理器
 * 核心理念：简单的 SQL 转发 + 表级别缓存策略 + 多租户数据隔离
 */
export class DataCacheManager {
  private localDb: Surreal;
  private remoteDb?: Surreal;
  private broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>;
  private multiTenantManager: MultiTenantManager;

  // 简单的缓存状态跟踪
  private cachedTables = new Set<string>();
  private currentAuthState: UnknownData | null = null;
  
  // 租户特定的缓存状态跟踪
  private tenantCachedTables = new Map<string, Set<string>>();

  constructor(config: {
    localDb: Surreal;
    remoteDb?: Surreal;
    broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>;
    multiTenantManager?: MultiTenantManager;
  }) {
    this.localDb = config.localDb;
    this.remoteDb = config.remoteDb;
    this.broadcastToAllClients = config.broadcastToAllClients;
    this.multiTenantManager = config.multiTenantManager || new MultiTenantManager();
    
    // 注册租户切换回调
    this.multiTenantManager.onTenantSwitch(this.handleTenantSwitch.bind(this));
  }

  /**
   * 初始化缓存管理器
   */
  async initialize(): Promise<void> {
    console.log('DataCacheManager: Initializing simplified cache manager...');

    // 为自动同步表创建本地表结构（如果不存在）
    await this.createLocalTables();

    console.log('DataCacheManager: Initialized successfully');
  }

  /**
   * 主查询方法 - 智能路由到本地或远程，支持多租户隔离
   */
  async query(sql: string, params?: QueryParams): Promise<UnknownData[]> {
    console.log('DataCacheManager: Executing query:', sql);

    try {
      // 1. 处理认证查询
      if (this.containsAuth(sql)) {
        return await this.handleAuthQuery(sql, params);
      }

      // 2. 应用多租户隔离
      const { sql: isolatedSql, params: isolatedParams } = this.multiTenantManager.addTenantIsolationToQuery(sql, params);

      // 3. 提取主要表名
      const tableName = this.extractTableName(isolatedSql);

      // 4. 验证数据访问权限
      if (tableName && !this.multiTenantManager.validateDataAccess(tableName, undefined, 'read')) {
        throw new Error(`Access denied to table: ${tableName}`);
      }

      // 5. 检查租户特定的缓存状态
      const currentTenant = this.multiTenantManager.getCurrentTenant();
      const tenantCacheKey = currentTenant ? `${currentTenant.tenantId}:${tableName}` : tableName;
      
      // 6. 如果是自动同步表且已缓存，使用本地查询
      if (tableName && isAutoSyncTable(tableName) && this.isTenantTableCached(tableName)) {
        console.log(`DataCacheManager: Using local cache for table: ${tableName} (tenant: ${currentTenant?.tenantId})`);
        const result = await this.localDb.query(isolatedSql, isolatedParams);
        return deserializeRecordIds(result);
      }

      // 7. 使用远程查询
      if (!this.remoteDb) {
        console.warn('DataCacheManager: No remote database connection');
        return [];
      }

      console.log('DataCacheManager: Using remote query');
      const result = await this.remoteDb.query(isolatedSql, isolatedParams);

      // 8. 如果是自动同步表，缓存整个表的数据
      if (tableName && isAutoSyncTable(tableName) && !this.isTenantTableCached(tableName)) {
        await this.cacheTenantTableData(tableName);
      }

      return deserializeRecordIds(result);
    } catch (error) {
      console.error('DataCacheManager: Query error:', error);
      throw error;
    }
  }

  /**
   * 更新认证状态
   */
  async updateAuthState(authData: UnknownData): Promise<void> {
    this.currentAuthState = authData;
    console.log('DataCacheManager: Auth state updated');
  }

  /**
   * 清除认证状态
   */
  async clearAuthState(): Promise<void> {
    this.currentAuthState = null;
    console.log('DataCacheManager: Auth state cleared');
  }

  /**
   * 自动同步所有自动同步表
   */
  async autoSyncTables(userId?: string, caseId?: string): Promise<void> {
    if (!this.remoteDb) {
      console.warn('DataCacheManager: No remote database for auto sync');
      return;
    }

    console.log('DataCacheManager: Starting auto sync for all tables...');

    for (const table of AUTO_SYNC_TABLES) {
      try {
        await this.cacheTableData(table);
        console.log(`DataCacheManager: Auto synced table: ${table}`);
      } catch (error) {
        console.error(`DataCacheManager: Failed to sync table ${table}:`, error);
      }
    }
  }

  /**
   * 手动刷新指定表的缓存
   */
  async refreshTableCache(tableName: string): Promise<void> {
    if (!this.remoteDb) {
      console.warn('DataCacheManager: No remote database for cache refresh');
      return;
    }

    console.log(`DataCacheManager: Refreshing cache for table: ${tableName}`);

    try {
      // 清除本地表数据
      await this.localDb.query(`DELETE FROM ${tableName}`);
      this.cachedTables.delete(tableName);

      // 重新缓存
      await this.cacheTableData(tableName);

      console.log(`DataCacheManager: Cache refreshed for table: ${tableName}`);
    } catch (error) {
      console.error(`DataCacheManager: Failed to refresh cache for table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * 清除所有缓存
   */
  async clearAllCache(): Promise<void> {
    console.log('DataCacheManager: Clearing all cache...');

    for (const table of AUTO_SYNC_TABLES) {
      try {
        await this.localDb.query(`DELETE FROM ${table}`);
      } catch (error) {
        console.warn(`DataCacheManager: Failed to clear table ${table}:`, error);
      }
    }

    this.cachedTables.clear();
    this.currentAuthState = null;

    console.log('DataCacheManager: All cache cleared');
  }

  /**
   * 获取缓存状态
   */
  getCacheStatus(): { cachedTables: string[], hasAuth: boolean } {
    return {
      cachedTables: Array.from(this.cachedTables),
      hasAuth: this.currentAuthState !== null
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 检查SQL是否包含认证查询
   */
  private containsAuth(sql: string): boolean {
    return /return\s+\$auth/i.test(sql);
  }

  /**
   * 处理包含认证的查询
   */
  private async handleAuthQuery(sql: string, params?: QueryParams): Promise<UnknownData[]> {
    const authState = this.currentAuthState;

    // 移除 return $auth 部分
    const actualSql = sql.replace(/return\s+\$auth\s*;?\s*/i, '').trim();

    // 如果只是获取认证状态
    if (!actualSql) {
      return authState ? [authState] : [null];
    }

    // 执行实际查询
    let queryResult: UnknownData[] = [];

    const tableName = this.extractTableName(actualSql);
    if (tableName && isAutoSyncTable(tableName) && this.cachedTables.has(tableName)) {
      // 使用本地查询，需要处理 $auth 变量替换
      const { processedSql, processedParams } = this.processAuthVariables(actualSql, params, authState);
      queryResult = await this.localDb.query(processedSql, processedParams);
    } else if (this.remoteDb) {
      // 使用远程查询
      return await this.remoteDb.query(sql, params);
    }

    // 返回认证状态 + 查询结果
    return [authState, ...deserializeRecordIds(queryResult)];
  }

  /**
   * 处理本地查询中的 $auth 变量替换
   */
  private processAuthVariables(sql: string, params?: QueryParams, authState?: UnknownData | null): {
    processedSql: string;
    processedParams: QueryParams;
  } {
    let processedSql = sql;
    const processedParams = params ? { ...params } : {};

    // 检查 SQL 中是否包含 $auth 变量
    if (/\$auth\b/.test(sql)) {
      // 将 $auth 替换为 $userId
      processedSql = sql.replace(/\$auth\b/g, '$userId');

      // 在参数中添加 userId
      if (authState && typeof authState === 'object' && 'id' in authState) {
        processedParams.userId = authState.id;
      } else if (authState && typeof authState === 'object' && 'user_id' in authState) {
        processedParams.userId = authState.user_id;
      } else if (authState && typeof authState === 'object' && 'github_id' in authState) {
        processedParams.userId = authState.github_id;
      } else {
        // 如果无法提取用户ID，使用空值
        processedParams.userId = null;
      }

      console.log('DataCacheManager: Replaced $auth with $userId in local query');
      console.log('DataCacheManager: userId =', processedParams.userId);
    }

    return { processedSql, processedParams };
  }

  /**
   * 从SQL中提取主要表名
   */
  private extractTableName(sql: string): string | null {
    // 匹配 FROM table_name
    const fromMatch = sql.match(/(?:from|into|update|delete\s+from)\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (fromMatch) {
      return fromMatch[1];
    }

    // 匹配 SELECT * FROM table
    const selectMatch = sql.match(/select\s+.*\s+from\s+([a-zA-Z_][a-zA-Z0-9_]*)/i);
    if (selectMatch) {
      return selectMatch[1];
    }

    return null;
  }

  /**
   * 缓存表数据
   */
  private async cacheTableData(tableName: string): Promise<void> {
    if (!this.remoteDb) return;

    try {
      console.log(`DataCacheManager: Caching table data for: ${tableName}`);

      // 从远程获取全表数据
      const data = await this.remoteDb.select(tableName);

      if (Array.isArray(data) && data.length > 0) {
        // 清除本地现有数据
        await this.localDb.query(`DELETE FROM ${tableName}`);

        // 批量插入新数据
        for (const record of data) {
          try {
            await this.localDb.create(record.id || new RecordId(tableName, crypto.randomUUID()), record);
          } catch (error) {
            console.warn(`DataCacheManager: Failed to cache record in ${tableName}:`, error);
          }
        }

        this.cachedTables.add(tableName);
        console.log(`DataCacheManager: Cached ${data.length} records for table: ${tableName}`);
      } else {
        console.log(`DataCacheManager: No data to cache for table: ${tableName}`);
        this.cachedTables.add(tableName); // 标记为已缓存，即使是空表
      }
    } catch (error) {
      console.error(`DataCacheManager: Failed to cache table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * 创建本地表结构
   */
  private async createLocalTables(): Promise<void> {
    // 这里可以根据需要定义本地表结构
    // 或者让 SurrealDB 自动创建表结构
    console.log('DataCacheManager: Local tables ready');
  }

  /**
   * 缓存数据到指定表
   */
  async cacheData(
    table: string,
    data: UnknownData[],
    cacheType: 'persistent' | 'temporary',
    userId?: string,
    caseId?: string
  ): Promise<void> {
    if (isAutoSyncTable(table)) {
      await this.cacheTableData(table);
    }
  }

  /**
   * 更新数据
   */
  async updateData(
    table: string,
    recordId: string,
    data: UnknownData,
    userId?: string,
    caseId?: string
  ): Promise<UnknownData> {
    // 简化实现：直接返回数据
    return data;
  }

  /**
   * 清除表缓存
   */
  async clearTableCache(table: string, userId?: string, caseId?: string): Promise<void> {
    if (isAutoSyncTable(table)) {
      try {
        await this.localDb.query(`DELETE FROM ${table}`);
        this.cachedTables.delete(table);
        console.log(`DataCacheManager: Cleared cache for table: ${table}`);
      } catch (error) {
        console.warn(`DataCacheManager: Failed to clear cache for table ${table}:`, error);
      }
    }
  }

  /**
   * 缓存单个记录
   */
  async cacheRecord(
    table: string,
    recordId: string,
    record: UnknownData,
    cacheType: 'persistent' | 'temporary',
    userId?: string,
    caseId?: string
  ): Promise<void> {
    // 简化实现
    console.log(`DataCacheManager: Caching record ${recordId} in table ${table}`);
  }

  /**
   * 获取缓存的记录
   */
  async getCachedRecord(
    table: string,
    recordId: string,
    userId?: string,
    caseId?: string
  ): Promise<UnknownData | null> {
    // 简化实现
    return null;
  }

  /**
   * 清除缓存的记录
   */
  async clearCachedRecord(
    table: string,
    recordId: string,
    userId?: string,
    caseId?: string
  ): Promise<void> {
    // 简化实现
    console.log(`DataCacheManager: Clearing cached record ${recordId} from table ${table}`);
  }

  /**
   * 设置租户上下文
   */
  async setTenantContext(tenant: TenantContext | null): Promise<void> {
    await this.multiTenantManager.setCurrentTenant(tenant);
  }

  /**
   * 获取当前租户上下文
   */
  getCurrentTenant(): TenantContext | null {
    return this.multiTenantManager.getCurrentTenant();
  }

  /**
   * 处理租户切换
   */
  private async handleTenantSwitch(oldTenant: TenantContext | null, newTenant: TenantContext | null): Promise<void> {
    console.log('DataCacheManager: Handling tenant switch from', oldTenant?.tenantId, 'to', newTenant?.tenantId);

    try {
      // 清理旧租户的缓存数据
      if (oldTenant) {
        await this.clearTenantCache(oldTenant.tenantId);
      }

      // 为新租户预加载数据
      if (newTenant) {
        await this.preloadTenantData(newTenant);
      }

      // 广播租户切换事件
      await this.broadcastToAllClients({
        type: 'tenant_switched',
        oldTenant: oldTenant?.tenantId || null,
        newTenant: newTenant?.tenantId || null,
        timestamp: new Date().toISOString()
      });

      console.log('DataCacheManager: Tenant switch completed successfully');
    } catch (error) {
      console.error('DataCacheManager: Failed to handle tenant switch:', error);
      throw error;
    }
  }

  /**
   * 检查租户表是否已缓存
   */
  private isTenantTableCached(tableName: string): boolean {
    const currentTenant = this.multiTenantManager.getCurrentTenant();
    if (!currentTenant) {
      return this.cachedTables.has(tableName);
    }

    const tenantTables = this.tenantCachedTables.get(currentTenant.tenantId);
    return tenantTables ? tenantTables.has(tableName) : false;
  }

  /**
   * 缓存租户特定的表数据
   */
  private async cacheTenantTableData(tableName: string): Promise<void> {
    if (!this.remoteDb) return;

    const currentTenant = this.multiTenantManager.getCurrentTenant();
    
    try {
      console.log(`DataCacheManager: Caching tenant table data for: ${tableName} (tenant: ${currentTenant?.tenantId})`);

      // 构建租户特定的查询
      let query = `SELECT * FROM ${tableName}`;
      let params: QueryParams = {};

      if (currentTenant) {
        const { sql: isolatedSql, params: isolatedParams } = this.multiTenantManager.addTenantIsolationToQuery(query, {});
        query = isolatedSql;
        params = isolatedParams;
      }

      // 从远程获取租户特定的数据
      const data = await this.remoteDb.query(query, params);
      const records = Array.isArray(data) && Array.isArray(data[0]) ? data[0] : [];

      if (records.length > 0) {
        // 清除本地现有数据（租户特定）
        if (currentTenant) {
          const clearQuery = `DELETE FROM ${tableName} WHERE case_id = $tenant_id`;
          await this.localDb.query(clearQuery, { tenant_id: currentTenant.tenantId });
        } else {
          await this.localDb.query(`DELETE FROM ${tableName}`);
        }

        // 批量插入新数据
        for (const record of records) {
          try {
            await this.localDb.create(record.id || new RecordId(tableName, crypto.randomUUID()), record);
          } catch (error) {
            console.warn(`DataCacheManager: Failed to cache record in ${tableName}:`, error);
          }
        }

        // 更新缓存状态
        this.markTenantTableAsCached(tableName);
        console.log(`DataCacheManager: Cached ${records.length} records for table: ${tableName} (tenant: ${currentTenant?.tenantId})`);
      } else {
        console.log(`DataCacheManager: No data to cache for table: ${tableName} (tenant: ${currentTenant?.tenantId})`);
        this.markTenantTableAsCached(tableName); // 标记为已缓存，即使是空表
      }
    } catch (error) {
      console.error(`DataCacheManager: Failed to cache tenant table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * 标记租户表为已缓存
   */
  private markTenantTableAsCached(tableName: string): void {
    const currentTenant = this.multiTenantManager.getCurrentTenant();
    
    if (!currentTenant) {
      this.cachedTables.add(tableName);
      return;
    }

    if (!this.tenantCachedTables.has(currentTenant.tenantId)) {
      this.tenantCachedTables.set(currentTenant.tenantId, new Set());
    }

    this.tenantCachedTables.get(currentTenant.tenantId)!.add(tableName);
  }

  /**
   * 清理租户缓存
   */
  private async clearTenantCache(tenantId: string): Promise<void> {
    console.log('DataCacheManager: Clearing cache for tenant:', tenantId);

    try {
      // 清理租户特定的缓存表记录
      const tenantTables = this.tenantCachedTables.get(tenantId);
      if (tenantTables) {
        for (const tableName of tenantTables) {
          try {
            // 删除租户特定的数据
            const clearQuery = `DELETE FROM ${tableName} WHERE case_id = $tenant_id`;
            await this.localDb.query(clearQuery, { tenant_id: tenantId });
            console.log(`DataCacheManager: Cleared tenant data from table: ${tableName}`);
          } catch (error) {
            console.warn(`DataCacheManager: Failed to clear tenant data from table ${tableName}:`, error);
          }
        }
        
        // 清理租户缓存状态
        this.tenantCachedTables.delete(tenantId);
      }

      console.log('DataCacheManager: Tenant cache cleared successfully');
    } catch (error) {
      console.error('DataCacheManager: Failed to clear tenant cache:', error);
      throw error;
    }
  }

  /**
   * 预加载租户数据
   */
  private async preloadTenantData(tenant: TenantContext): Promise<void> {
    console.log('DataCacheManager: Preloading data for tenant:', tenant.tenantId);

    try {
      // 预加载自动同步表的租户数据
      for (const tableName of AUTO_SYNC_TABLES) {
        try {
          await this.cacheTenantTableData(tableName);
        } catch (error) {
          console.warn(`DataCacheManager: Failed to preload table ${tableName} for tenant:`, error);
        }
      }

      console.log('DataCacheManager: Tenant data preloading completed');
    } catch (error) {
      console.error('DataCacheManager: Failed to preload tenant data:', error);
      throw error;
    }
  }

  /**
   * 获取多租户统计信息
   */
  getMultiTenantStats(): {
    currentTenant: string | null;
    tenantCacheCount: number;
    totalCachedTables: number;
    tenantManager: ReturnType<MultiTenantManager['getTenantStats']>;
  } {
    const currentTenant = this.multiTenantManager.getCurrentTenant();
    let totalCachedTables = this.cachedTables.size;
    
    for (const tenantTables of this.tenantCachedTables.values()) {
      totalCachedTables += tenantTables.size;
    }

    return {
      currentTenant: currentTenant?.tenantId || null,
      tenantCacheCount: this.tenantCachedTables.size,
      totalCachedTables,
      tenantManager: this.multiTenantManager.getTenantStats()
    };
  }

  /**
   * 关闭缓存管理器
   */
  async close(): Promise<void> {
    console.log('DataCacheManager: Closing simplified cache manager...');
    
    // 关闭多租户管理器
    await this.multiTenantManager.close();
    
    // 清理所有缓存状态
    this.cachedTables.clear();
    this.tenantCachedTables.clear();
    this.currentAuthState = null;
    
    console.log('DataCacheManager: Closed successfully');
  }
}