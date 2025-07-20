import {RecordId} from 'surrealdb';
import type Surreal from 'surrealdb';
import type {QueryParams, UnknownData} from '../types/surreal';

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
 * 核心理念：简单的 SQL 转发 + 表级别缓存策略 + 基于database的租户隔离
 */
export class DataCacheManager {
    public localDb: Surreal;
    public remoteDb?: Surreal;

    // 简单的缓存状态跟踪
    private cachedTables = new Set<string>();
    private currentAuthState: UnknownData | null = null;

    constructor(config: {
        localDb: Surreal;
        remoteDb?: Surreal;
        broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>;
    }) {
        this.localDb = config.localDb;
        this.remoteDb = config.remoteDb;
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
     * 主查询方法 - 智能路由到本地或远程，支持基于database的租户隔离
     */
    async query(sql: string, params?: QueryParams): Promise<UnknownData[]> {
        console.log('DataCacheManager: Executing query:', sql);

        try {
            // 1. 处理认证查询
            if (this.containsAuth(sql)) {
                return await this.handleAuthQuery(sql, params);
            }

            // 2. 直接使用本地和远程数据库连接（租户已通过use方法设置）
            const localDb = this.localDb;
            const remoteDb = this.remoteDb;

            // 3. 提取主要表名
            const tableName = this.extractTableName(sql);

            // 4. 如果是自动同步表且已缓存，使用本地查询
            if (tableName && isAutoSyncTable(tableName) && this.cachedTables.has(tableName)) {
                console.log(`DataCacheManager: Using local cache for table: ${tableName}`);
                const result = await localDb.query(sql, params);
                return deserializeRecordIds(result);
            }

            // 5. 使用远程查询
            if (!remoteDb) {
                console.warn('DataCacheManager: No remote database connection');
                return [];
            }

            console.log('DataCacheManager: Using remote query');
            const result = await remoteDb.query(sql, params);

            // 6. 如果是自动同步表，缓存整个表的数据
            if (tableName && isAutoSyncTable(tableName) && !this.cachedTables.has(tableName)) {
                await this.cacheTableData(tableName);
            }

            return deserializeRecordIds(result);
        } catch (error) {
            console.error('DataCacheManager: Query error:', error);
            throw error;
        }
    }

    /**
     * 更新认证状态（登录时调用）
     */
    async updateAuthState(authData: UnknownData): Promise<void> {
        this.currentAuthState = authData;

        // 如果有租户信息，自动设置数据库连接
        if (authData && typeof authData === 'object' && 'tenant_code' in authData) {
            const tenantCode = authData.tenant_code as string;
            await this.localDb.use({namespace: "ck_go", database: tenantCode});
        }

        console.log('DataCacheManager: Auth state updated');
    }

    /**
     * 清除认证状态（退出登录时调用）
     */
    async clearAuthState(): Promise<void> {
        this.currentAuthState = null;
        console.log('DataCacheManager: Auth state cleared');
    }

    /**
     * 自动同步所有自动同步表
     */
    async autoSyncTables(): Promise<void> {
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
            await this.localDb.query(`DELETE
                                      FROM ${tableName}`);
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
                await this.localDb.query(`DELETE
                                          FROM ${table}`);
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
            const {processedSql, processedParams} = this.processAuthVariables(actualSql, params, authState);
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
        const processedParams = params ? {...params} : {};

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

        return {processedSql, processedParams};
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
                await this.localDb.query(`DELETE
                                          FROM ${tableName}`);

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
    ): Promise<void> {
        if (isAutoSyncTable(table)) {
            await this.cacheTableData(table);
        }
    }

    /**
     * 更新数据
     */
    async updateData(
        data: UnknownData,
    ): Promise<UnknownData> {
        // 简化实现：直接返回数据
        return data;
    }

    /**
     * 清除表缓存
     */
    async clearTableCache(table: string): Promise<void> {
        if (isAutoSyncTable(table)) {
            try {
                await this.localDb.query(`DELETE
                                          FROM ${table}`);
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
    ): Promise<void> {
        // 简化实现
        console.log(`DataCacheManager: Caching record ${recordId} in table ${table}`);
    }

    /**
     * 获取缓存的记录
     */
    async getCachedRecord(): Promise<UnknownData | null> {
        // 简化实现
        return null;
    }

    /**
     * 清除缓存的记录
     */
    async clearCachedRecord(
        table: string,
        recordId: string,
    ): Promise<void> {
        // 简化实现
        console.log(`DataCacheManager: Clearing cached record ${recordId} from table ${table}`);
    }

    /**
     * 检查数据库连接状态
     */
    isConnected(): boolean {
        return this.localDb !== null && (this.remoteDb !== null || this.remoteDb === undefined);
    }

    /**
     * 关闭缓存管理器
     */
    async close(): Promise<void> {
        console.log('DataCacheManager: Closing simplified cache manager...');

        // 清理所有缓存状态
        this.cachedTables.clear();
        this.currentAuthState = null;

        console.log('DataCacheManager: Closed successfully');
    }
}