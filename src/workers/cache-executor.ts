import { QueryRouter, CacheStrategy, QueryAnalysis, CacheRoutingDecision } from './query-router';
import { DataCacheManager } from './data-cache-manager';
import type { Surreal } from 'surrealdb';
import type { QueryParams, UnknownData } from '../types/surreal';

// 执行结果类型
export interface QueryExecutionResult {
  data: UnknownData[];
  source: 'local' | 'remote' | 'hybrid';
  executionTime: number;
  cacheHit: boolean;
  strategy: CacheStrategy;
  fromCache?: boolean;
}

// 缓存命中状态
export interface CacheHitStatus {
  hasLocalData: boolean;
  isExpired: boolean;
  dataQuality: 'fresh' | 'stale' | 'missing';
  localDataAge: number; // 数据年龄（毫秒）
  estimatedFreshness: number; // 数据新鲜度评分 0-1
}

/**
 * 智能缓存执行器
 * 根据QueryRouter的决策执行具体的缓存操作
 */
export class CacheExecutor {
  private queryRouter: QueryRouter;
  private dataCacheManager: DataCacheManager;
  private remoteDb?: Surreal;
  private localDb: Surreal;

  // 性能统计
  private executionStats = new Map<string, {
    localCount: number;
    remoteCount: number;
    localTotalTime: number;
    remoteTotalTime: number;
    lastUpdated: number;
  }>();

  // 缓存预热队列
  private preloadQueue = new Set<string>();

  constructor(
    queryRouter: QueryRouter,
    dataCacheManager: DataCacheManager,
    localDb: Surreal,
    remoteDb?: Surreal
  ) {
    this.queryRouter = queryRouter;
    this.dataCacheManager = dataCacheManager;
    this.localDb = localDb;
    this.remoteDb = remoteDb;
  }

  /**
   * 执行智能查询
   */
  async executeQuery(
    sql: string,
    params?: QueryParams,
    userId?: string,
    caseId?: string
  ): Promise<QueryExecutionResult> {
    const startTime = Date.now();
    
    // 1. 分析查询
    const analysis = this.queryRouter.analyzeQuery(sql, params);
    
    // 2. 决定缓存策略
    const decision = this.queryRouter.decideCacheStrategy(analysis, userId);
    
    // 3. 执行查询
    const result = await this.executeWithStrategy(sql, params, analysis, decision, userId, caseId);
    
    // 4. 更新性能统计
    const executionTime = Date.now() - startTime;
    this.updateExecutionStats(sql, params, result.source, executionTime);
    
    return {
      ...result,
      executionTime,
      strategy: decision.strategy
    };
  }

  /**
   * 根据策略执行查询
   */
  private async executeWithStrategy(
    sql: string,
    params: QueryParams | undefined,
    analysis: QueryAnalysis,
    decision: CacheRoutingDecision,
    userId?: string,
    caseId?: string
  ): Promise<Omit<QueryExecutionResult, 'executionTime' | 'strategy'>> {
    
    switch (decision.strategy) {
      case CacheStrategy.LOCAL_FIRST:
        return this.executeLocalFirst(sql, params, analysis, decision, userId, caseId);
      
      case CacheStrategy.REMOTE_FIRST:
        return this.executeRemoteFirst(sql, params, analysis, decision, userId, caseId);
      
      case CacheStrategy.LOCAL_ONLY:
        return this.executeLocalOnly(sql, params, analysis, userId, caseId);
      
      case CacheStrategy.REMOTE_ONLY:
        return this.executeRemoteOnly(sql, params, analysis);
      
      case CacheStrategy.HYBRID:
        return this.executeHybrid(sql, params, analysis, decision, userId, caseId);
      
      default:
        return this.executeRemoteOnly(sql, params, analysis);
    }
  }

  /**
   * 本地优先策略
   */
  private async executeLocalFirst(
    sql: string,
    params: QueryParams | undefined,
    analysis: QueryAnalysis,
    decision: CacheRoutingDecision,
    userId?: string,
    caseId?: string
  ): Promise<Omit<QueryExecutionResult, 'executionTime' | 'strategy'>> {
    
    // 检查本地缓存状态
    const cacheStatus = await this.checkCacheStatus(analysis.tables, userId, caseId);
    
    if (cacheStatus.hasLocalData && cacheStatus.dataQuality !== 'missing') {
      try {
        // 尝试从本地查询
        const localData = await this.queryFromLocal(sql, params, analysis.tables, userId, caseId);
        
        if (localData && localData.length > 0) {
          // 异步检查是否需要后台更新
          if (cacheStatus.dataQuality === 'stale') {
            this.scheduleBackgroundSync(analysis.tables, userId, caseId);
          }
          
          return {
            data: localData,
            source: 'local',
            cacheHit: true,
            fromCache: true
          };
        }
      } catch (localError) {
        console.warn('CacheExecutor: Local query failed, falling back to remote:', localError);
      }
    }

    // 本地查询失败或无数据，尝试回退到远程
    try {
      return await this.executeRemoteWithCache(sql, params, analysis, decision, userId, caseId);
    } catch (remoteError) {
      console.warn('CacheExecutor: Remote fallback failed, returning empty result:', remoteError);
      // 远程也失败，返回空结果而不是抛出错误
      return {
        data: [],
        source: 'local',
        cacheHit: false,
        fromCache: false
      };
    }
  }

  /**
   * 远程优先策略
   */
  private async executeRemoteFirst(
    sql: string,
    params: QueryParams | undefined,
    analysis: QueryAnalysis,
    decision: CacheRoutingDecision,
    userId?: string,
    caseId?: string
  ): Promise<Omit<QueryExecutionResult, 'executionTime' | 'strategy'>> {
    
    if (!this.remoteDb) {
      // 没有远程连接，尝试本地
      return this.executeLocalOnly(sql, params, analysis, userId, caseId);
    }

    try {
      // 优先从远程查询
      const remoteData = await this.remoteDb.query(sql, params);
      
      // 根据决策缓存结果
      if (decision.cacheTTL > 0) {
        await this.cacheQueryResult(analysis.tables, remoteData, decision, userId, caseId);
      }
      
      return {
        data: remoteData,
        source: 'remote',
        cacheHit: false,
        fromCache: false
      };
    } catch (remoteError) {
      console.warn('CacheExecutor: Remote query failed, trying local cache:', remoteError);
      
      // 远程失败，尝试本地缓存
      const localData = await this.queryFromLocal(sql, params, analysis.tables, userId, caseId);
      
      if (localData && localData.length > 0) {
        return {
          data: localData,
          source: 'local',
          cacheHit: true,
          fromCache: true
        };
      }
      
      throw remoteError; // 本地也没有数据，抛出原始错误
    }
  }

  /**
   * 仅本地策略
   */
  private async executeLocalOnly(
    sql: string,
    params: QueryParams | undefined,
    analysis: QueryAnalysis,
    userId?: string,
    caseId?: string
  ): Promise<Omit<QueryExecutionResult, 'executionTime' | 'strategy'>> {
    
    const localData = await this.queryFromLocal(sql, params, analysis.tables, userId, caseId);
    
    return {
      data: localData || [],
      source: 'local',
      cacheHit: localData ? localData.length > 0 : false,
      fromCache: true
    };
  }

  /**
   * 仅远程策略
   */
  private async executeRemoteOnly(
    sql: string,
    params: QueryParams | undefined,
    analysis: QueryAnalysis
  ): Promise<Omit<QueryExecutionResult, 'executionTime' | 'strategy'>> {
    
    if (!this.remoteDb) {
      throw new Error('Remote database not available');
    }

    const remoteData = await this.remoteDb.query(sql, params);
    
    return {
      data: remoteData,
      source: 'remote',
      cacheHit: false,
      fromCache: false
    };
  }

  /**
   * 混合策略
   */
  private async executeHybrid(
    sql: string,
    params: QueryParams | undefined,
    analysis: QueryAnalysis,
    decision: CacheRoutingDecision,
    userId?: string,
    caseId?: string
  ): Promise<Omit<QueryExecutionResult, 'executionTime' | 'strategy'>> {
    
    // 检查缓存状态
    const cacheStatus = await this.checkCacheStatus(analysis.tables, userId, caseId);
    
    // 根据数据质量和性能指标决定执行路径
    if (cacheStatus.hasLocalData && cacheStatus.estimatedFreshness > 0.7) {
      // 数据新鲜度高，优先本地
      return this.executeLocalFirst(sql, params, analysis, decision, userId, caseId);
    } else if (this.remoteDb && cacheStatus.estimatedFreshness < 0.3) {
      // 数据陈旧，优先远程
      return this.executeRemoteFirst(sql, params, analysis, decision, userId, caseId);
    } else {
      // 根据性能指标决定
      const queryHash = this.generateQueryHash(sql, params);
      const performanceStrategy = this.queryRouter.getPerformanceBasedStrategy(queryHash);
      
      if (performanceStrategy === CacheStrategy.LOCAL_FIRST) {
        return this.executeLocalFirst(sql, params, analysis, decision, userId, caseId);
      } else if (performanceStrategy === CacheStrategy.REMOTE_FIRST) {
        return this.executeRemoteFirst(sql, params, analysis, decision, userId, caseId);
      } else {
        // 默认本地优先
        return this.executeLocalFirst(sql, params, analysis, decision, userId, caseId);
      }
    }
  }

  /**
   * 从远程查询并缓存
   */
  private async executeRemoteWithCache(
    sql: string,
    params: QueryParams | undefined,
    analysis: QueryAnalysis,
    decision: CacheRoutingDecision,
    userId?: string,
    caseId?: string
  ): Promise<Omit<QueryExecutionResult, 'executionTime' | 'strategy'>> {
    
    if (!this.remoteDb) {
      throw new Error('Remote database not available');
    }

    const remoteData = await this.remoteDb.query(sql, params);
    
    // 缓存结果
    if (decision.cacheTTL > 0) {
      await this.cacheQueryResult(analysis.tables, remoteData, decision, userId, caseId);
    }
    
    return {
      data: remoteData,
      source: 'remote',
      cacheHit: false,
      fromCache: false
    };
  }

  /**
   * 检查缓存状态
   */
  private async checkCacheStatus(
    tables: string[],
    userId?: string,
    caseId?: string
  ): Promise<CacheHitStatus> {
    
    let hasLocalData = false;
    let oldestDataAge = 0;
    let newestDataAge = Infinity;
    
    for (const table of tables) {
      try {
        const query = `
          SELECT sync_timestamp, created_at FROM data_table_cache 
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
        
        if (result && result.length > 0) {
          hasLocalData = true;
          const cacheItem = result[0] as any;
          const dataAge = Date.now() - (cacheItem.sync_timestamp || 0);
          oldestDataAge = Math.max(oldestDataAge, dataAge);
          newestDataAge = Math.min(newestDataAge, dataAge);
        }
      } catch (error) {
        console.warn(`CacheExecutor: Failed to check cache for table ${table}:`, error);
      }
    }

    // 评估数据质量
    let dataQuality: 'fresh' | 'stale' | 'missing' = 'missing';
    let estimatedFreshness = 0;
    
    if (hasLocalData) {
      const avgAge = (oldestDataAge + newestDataAge) / 2;
      
      if (avgAge < 5 * 60 * 1000) { // 5分钟内
        dataQuality = 'fresh';
        estimatedFreshness = 0.9;
      } else if (avgAge < 30 * 60 * 1000) { // 30分钟内
        dataQuality = 'fresh';
        estimatedFreshness = 0.7;
      } else if (avgAge < 2 * 60 * 60 * 1000) { // 2小时内
        dataQuality = 'stale';
        estimatedFreshness = 0.4;
      } else {
        dataQuality = 'stale';
        estimatedFreshness = 0.1;
      }
    }

    return {
      hasLocalData,
      isExpired: oldestDataAge > 24 * 60 * 60 * 1000, // 24小时过期
      dataQuality,
      localDataAge: oldestDataAge,
      estimatedFreshness
    };
  }

  /**
   * 从本地查询数据
   */
  private async queryFromLocal(
    sql: string,
    params: QueryParams | undefined,
    tables: string[],
    userId?: string,
    caseId?: string
  ): Promise<UnknownData[] | null> {
    
    // 对于单表简单查询，直接从缓存获取
    if (tables.length === 1 && this.isSimpleSelectQuery(sql)) {
      return this.dataCacheManager.query(sql, params);
    }
    
    // 对于复杂查询，尝试在本地数据库执行
    try {
      // 首先检查所有涉及的表是否都有缓存
      const allTablesCached = await this.checkAllTablesCached(tables, userId, caseId);
      
      if (!allTablesCached) {
        return null; // 有表没有缓存，无法在本地执行
      }
      
      // 在本地数据库执行查询
      // 注意：这里需要将查询转换为针对缓存表的查询
      const localQuery = this.adaptQueryForLocalCache(sql, tables);
      return await this.localDb.query(localQuery, params);
      
    } catch (error) {
      console.warn('CacheExecutor: Local complex query failed:', error);
      return null;
    }
  }

  /**
   * 检查所有表是否都有缓存
   */
  private async checkAllTablesCached(tables: string[], userId?: string, caseId?: string): Promise<boolean> {
    for (const table of tables) {
      const hasCache = await this.hasCachedData(table, userId, caseId);
      if (!hasCache) {
        return false;
      }
    }
    return true;
  }

  /**
   * 检查表是否有缓存数据
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
      return false;
    }
  }

  /**
   * 将查询适配为本地缓存查询
   */
  private adaptQueryForLocalCache(sql: string, tables: string[]): string {
    // 简单的表名替换，将原表名替换为缓存表的data字段
    let adaptedSql = sql;
    
    for (const table of tables) {
      // 这是一个简化的实现，实际可能需要更复杂的SQL解析和重写
      const cacheQuery = `(
        SELECT VALUE data[*] FROM data_table_cache 
        WHERE table_name = '${table}' 
        AND (expires_at IS NULL OR expires_at > time::now())
        LIMIT 1
      )[*]`;
      
      adaptedSql = adaptedSql.replace(new RegExp(`\\b${table}\\b`, 'g'), cacheQuery);
    }
    
    return adaptedSql;
  }

  /**
   * 判断是否为简单查询
   */
  private isSimpleSelectQuery(sql: string): boolean {
    const normalizedSql = sql.toLowerCase().trim();
    return normalizedSql.startsWith('select') && 
           !normalizedSql.includes('join') && 
           !normalizedSql.includes('->') &&
           !normalizedSql.includes('union');
  }

  /**
   * 缓存查询结果
   */
  private async cacheQueryResult(
    tables: string[],
    data: UnknownData[],
    decision: CacheRoutingDecision,
    userId?: string,
    caseId?: string
  ): Promise<void> {
    
    for (const table of tables) {
      try {
        const cacheType = decision.cacheTTL > 60 * 60 * 1000 ? 'persistent' : 'temporary';
        await this.dataCacheManager.cacheData(table, data, cacheType, userId, caseId);
      } catch (error) {
        console.warn(`CacheExecutor: Failed to cache data for table ${table}:`, error);
      }
    }
  }

  /**
   * 安排后台同步
   */
  private scheduleBackgroundSync(tables: string[], userId?: string, caseId?: string): void {
    // 异步执行后台同步，不阻塞当前请求
    setTimeout(async () => {
      if (!this.remoteDb) return;
      
      for (const table of tables) {
        try {
          console.log(`CacheExecutor: Background syncing table: ${table}`);
          const remoteData = await this.remoteDb.select(table);
          await this.dataCacheManager.cacheData(table, remoteData, 'persistent', userId, caseId);
          console.log(`CacheExecutor: Background sync completed for table: ${table}`);
        } catch (error) {
          console.warn(`CacheExecutor: Background sync failed for table ${table}:`, error);
        }
      }
    }, 100); // 100ms延迟执行
  }

  /**
   * 生成查询哈希
   */
  private generateQueryHash(sql: string, params?: QueryParams): string {
    const normalizedSql = sql.toLowerCase().replace(/\s+/g, ' ').trim();
    const paramsStr = params ? JSON.stringify(params) : '';
    return `${normalizedSql}::${paramsStr}`;
  }

  /**
   * 更新执行统计
   */
  private updateExecutionStats(
    sql: string,
    params: QueryParams | undefined,
    source: 'local' | 'remote' | 'hybrid',
    executionTime: number
  ): void {
    const queryHash = this.generateQueryHash(sql, params);
    const current = this.executionStats.get(queryHash) || {
      localCount: 0,
      remoteCount: 0,
      localTotalTime: 0,
      remoteTotalTime: 0,
      lastUpdated: Date.now()
    };

    if (source === 'local') {
      current.localCount++;
      current.localTotalTime += executionTime;
    } else if (source === 'remote') {
      current.remoteCount++;
      current.remoteTotalTime += executionTime;
    }

    current.lastUpdated = Date.now();
    this.executionStats.set(queryHash, current);

    // 更新QueryRouter的性能指标
    if (current.localCount > 0 && current.remoteCount > 0) {
      const localAvg = current.localTotalTime / current.localCount;
      const remoteAvg = current.remoteTotalTime / current.remoteCount;
      this.queryRouter.updatePerformanceMetrics(queryHash, source === 'local', executionTime);
    }
  }

  /**
   * 预热缓存
   */
  async preloadCache(tables: string[], userId?: string, caseId?: string): Promise<void> {
    if (!this.remoteDb) return;

    for (const table of tables) {
      const preloadKey = `${table}_${userId || 'global'}_${caseId || 'all'}`;
      
      if (this.preloadQueue.has(preloadKey)) {
        continue; // 已在预热队列中
      }

      this.preloadQueue.add(preloadKey);
      
      try {
        console.log(`CacheExecutor: Preloading cache for table: ${table}`);
        const data = await this.remoteDb.select(table);
        await this.dataCacheManager.cacheData(table, data, 'persistent', userId, caseId);
        console.log(`CacheExecutor: Cache preloaded for table: ${table}`);
      } catch (error) {
        console.warn(`CacheExecutor: Failed to preload cache for table ${table}:`, error);
      } finally {
        this.preloadQueue.delete(preloadKey);
      }
    }
  }

  /**
   * 获取执行统计
   */
  getExecutionStats(): Map<string, any> {
    return new Map(this.executionStats);
  }

  /**
   * 清理统计数据
   */
  cleanupStats(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时

    for (const [hash, stats] of Array.from(this.executionStats.entries())) {
      if (now - stats.lastUpdated > maxAge) {
        this.executionStats.delete(hash);
      }
    }

    // 同时清理QueryRouter的统计
    this.queryRouter.cleanupFrequencyStats();
  }

}