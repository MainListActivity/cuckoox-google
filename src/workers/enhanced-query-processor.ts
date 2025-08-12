import { Surreal } from 'surrealdb';
import { UnifiedConnectionManager } from './unified-connection-manager.js';
import { OptimizedQueryRouter } from './optimized-query-router.js';
import { OptimizedCacheExecutor, type QueryResult } from './optimized-cache-executor.js';

/**
 * 查询处理器结果
 */
export interface QueryProcessorResult {
  data: any;
  source: 'local' | 'remote' | 'hybrid';
  executionTime: number;
  cacheHit: boolean;
  metadata?: {
    strategy: string;
    reasoning: string;
    tablesInvolved: string[];
  };
}

/**
 * 增强查询处理器
 * 集成查询路由、缓存执行和性能监控的核心处理器
 */
export class EnhancedQueryProcessor {
  private queryRouter: OptimizedQueryRouter;
  private cacheExecutor: OptimizedCacheExecutor;
  private localDb: Surreal;
  private remoteDb?: Surreal;

  constructor(private connectionManager: UnifiedConnectionManager) {
    this.localDb = connectionManager.getLocalDb();
    this.remoteDb = connectionManager.getRemoteDb();

    this.queryRouter = new OptimizedQueryRouter(this.localDb);
    this.cacheExecutor = new OptimizedCacheExecutor(
      this.queryRouter,
      this.localDb,
      this.remoteDb
    );

    console.log('EnhancedQueryProcessor: 增强查询处理器已初始化');
  }

  /**
   * 处理查询请求
   */
  async handleRPC(
    method: string,
    params: unknown[],
    userId?: string,
    caseId?: string
  ): Promise<QueryProcessorResult> {
    const startTime = Date.now();

    console.log('EnhancedQueryProcessor: 处理rpc', { method, params, userId, caseId });

    const sql = params[0] as string || '';
    const paramArray = params[1] as Record<string, unknown> || {};
    try {
      // 检查连接状态
      if (!this.connectionManager.isConnected()) {
        throw new Error('数据库连接未建立');
      }
      // 分析查询并获取路由信息
      const analysis = this.queryRouter.analyzeQuery(sql, paramArray);
      const route = await this.queryRouter.routeQuery(sql, paramArray);

      console.log('EnhancedQueryProcessor: 查询分析完成', { analysis, route });

      // 执行查询
      const result = await this.cacheExecutor.executeRpc(method, params);

      // 记录性能指标
      await this.recordPerformanceMetrics(sql, result, analysis, route);

      const totalExecutionTime = Date.now() - startTime;

      // 构建最终结果
      const processorResult: QueryProcessorResult = {
        data: result.data,
        source: result.source,
        executionTime: totalExecutionTime,
        cacheHit: result.cacheHit,
        metadata: {
          strategy: route.strategy,
          reasoning: route.reasoning,
          tablesInvolved: analysis.tables
        }
      };

      console.log(`EnhancedQueryProcessor: 查询处理完成，总耗时${totalExecutionTime}ms`);
      return processorResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`EnhancedQueryProcessor: 查询处理失败，耗时${executionTime}ms`, error);

      // 记录错误指标
      await this.recordErrorMetrics(sql, error, executionTime);

      throw error;
    }
  }

  /**
   * 预加载缓存
   */
  async preloadCache(
    tables: string[],
    userId?: string,
    caseId?: string
  ): Promise<void> {
    console.log('EnhancedQueryProcessor: 预加载缓存', { tables, userId, caseId });

    const preloadPromises = tables.map(async table => {
      try {
        const strategy = this.queryRouter.getTableCacheStrategy(table);
        if (strategy && !await this.queryRouter.isTableCached(table)) {
          // 触发一个简单查询来启动缓存
          await this.remoteDb?.query(`SELECT * FROM ${table} LIMIT 1`, { userId, caseId });
          console.log(`EnhancedQueryProcessor: 表 ${table} 预加载完成`);
        }
      } catch (error) {
        console.warn(`EnhancedQueryProcessor: 预加载表 ${table} 失败`, error);
      }
    });

    await Promise.allSettled(preloadPromises);
    console.log('EnhancedQueryProcessor: 缓存预加载完成');
  }

  /**
   * 获取缓存状态
   */
  async getCacheStatus(): Promise<any> {
    try {
      const cacheMetadata = await this.localDb.query<any[]>(`
        SELECT * FROM cache_metadata WHERE is_active = true ORDER BY table_name
      `);

      const status = {
        totalTables: 0,
        cachedTables: 0,
        activeLiveQueries: 0,
        cacheTypes: { persistent: 0, temporary: 0 },
        tables: []
      };

      if (Array.isArray(cacheMetadata) && cacheMetadata.length > 0) {
        status.cachedTables = cacheMetadata.length;

        for (const cache of cacheMetadata) {
          if (cache.live_query_uuid) {
            status.activeLiveQueries++;
          }

          if (cache.cache_type === 'persistent') {
            status.cacheTypes.persistent++;
          } else if (cache.cache_type === 'temporary') {
            status.cacheTypes.temporary++;
          }

          (status.tables as any[]).push({
            name: cache.table_name,
            type: cache.cache_type,
            recordCount: cache.record_count || 0,
            lastSync: cache.last_sync_time,
            hasLiveQuery: !!cache.live_query_uuid,
            expiresAt: cache.expires_at
          });
        }
      }

      // 总表数（包括可缓存的表）
      status.totalTables = this.queryRouter.getCacheableTables().length;

      return status;
    } catch (error: any) {
      console.error('EnhancedQueryProcessor: 获取缓存状态失败', error);
      return { error: error.message };
    }
  }

  /**
   * 清理缓存
   */
  async clearCache(tables?: string[]): Promise<void> {
    console.log('EnhancedQueryProcessor: 清理缓存', tables);

    try {
      if (tables && tables.length > 0) {
        // 清理指定表的缓存
        for (const table of tables) {
          await this.clearTableCache(table);
        }
      } else {
        // 清理所有缓存
        const cacheMetadata = await this.localDb.query<any[]>(`
          SELECT table_name FROM cache_metadata WHERE is_active = true
        `);

        if (Array.isArray(cacheMetadata)) {
          for (const cache of cacheMetadata) {
            await this.clearTableCache(cache.table_name);
          }
        }
      }

      console.log('EnhancedQueryProcessor: 缓存清理完成');
    } catch (error) {
      console.error('EnhancedQueryProcessor: 缓存清理失败', error);
      throw error;
    }
  }

  /**
   * 清理单个表的缓存
   */
  private async clearTableCache(table: string): Promise<void> {
    try {
      // 停止Live Query订阅
      const metadata = await this.localDb.query<any[]>(`
        SELECT live_query_uuid FROM cache_metadata WHERE table_name = $table
      `, { table });

      if (Array.isArray(metadata) && metadata.length > 0 && metadata[0].live_query_uuid) {
        if (this.remoteDb) {
          await this.remoteDb.kill(metadata[0].live_query_uuid);
        }
      }

      // 删除缓存数据
      await this.localDb.query(`DELETE FROM ${table}`);

      // 删除缓存元数据
      await this.localDb.query(`DELETE FROM cache_metadata WHERE table_name = $table`, { table });

      console.log(`EnhancedQueryProcessor: 表 ${table} 缓存已清理`);
    } catch (error) {
      console.error(`EnhancedQueryProcessor: 清理表 ${table} 缓存失败`, error);
    }
  }

  /**
   * 记录性能指标
   */
  private async recordPerformanceMetrics(
    sql: string,
    result: QueryResult,
    analysis: any,
    route: any
  ): Promise<void> {
    try {
      // 这里可以实现更详细的性能指标记录
      const metrics = {
        queryHash: this.hashQuery(sql),
        queryType: analysis.queryType,
        executionTime: result.executionTime,
        cacheHit: result.cacheHit,
        source: result.source,
        strategy: route.strategy,
        tablesCount: analysis.tables.length,
        timestamp: new Date().toISOString()
      };

      console.log('EnhancedQueryProcessor: 性能指标', metrics);

      // 可以存储到性能指标表中
      // await this.localDb.create('performance_metrics', metrics);
    } catch (error) {
      console.warn('EnhancedQueryProcessor: 记录性能指标失败', error);
    }
  }

  /**
   * 记录错误指标
   */
  private async recordErrorMetrics(sql: string, error: any, executionTime: number): Promise<void> {
    try {
      const errorMetrics = {
        queryHash: this.hashQuery(sql),
        errorType: error.name || 'Error',
        errorMessage: error.message,
        executionTime,
        timestamp: new Date().toISOString()
      };

      console.log('EnhancedQueryProcessor: 错误指标', errorMetrics);

      // 可以存储到错误指标表中
      // await this.localDb.create('error_metrics', errorMetrics);
    } catch (err) {
      console.warn('EnhancedQueryProcessor: 记录错误指标失败', err);
    }
  }

  /**
   * 生成查询哈希
   */
  private hashQuery(sql: string): string {
    // 简单的查询哈希实现
    let hash = 0;
    for (let i = 0; i < sql.length; i++) {
      const char = sql.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 获取查询处理器统计信息
   */
  async getStatistics(): Promise<any> {
    try {
      const cacheStatus = await this.getCacheStatus();
      const connectionState = this.connectionManager.getConnectionState();
      const authState = this.connectionManager.getAuthState();

      return {
        connectionState,
        isAuthenticated: this.connectionManager.isAuthenticated(),
        currentTenant: this.connectionManager.getCurrentTenant(),
        cache: cacheStatus,
        user: authState ? {
          id: authState.id,
          tenant: authState.tenant_code
        } : null,
        timestamp: new Date().toISOString()
      };
    } catch (error: any) {
      console.error('EnhancedQueryProcessor: 获取统计信息失败', error);
      return { error: error.message };
    }
  }
}