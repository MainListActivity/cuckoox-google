/**
 * 增强的查询处理器
 * 集成智能缓存系统，替换sw-surreal.ts中的简单缓存逻辑
 */

import { QueryRouter } from './query-router';
import { CacheExecutor } from './cache-executor';
import { SubscriptionManager } from './subscription-manager';
import { DataCacheManager } from './data-cache-manager';
import { PerformanceMonitor } from './performance-monitor';
import { CacheDebugger } from './cache-debugger';
import { CacheLogger, LogCategory } from './cache-logger';
import type { Surreal } from 'surrealdb';
import type { QueryParams, UnknownData } from '../types/surreal';

// 查询处理结果
export interface QueryHandlerResult {
  success: boolean;
  data?: UnknownData[];
  error?: string;
  source: 'local' | 'remote' | 'hybrid';
  executionTime: number;
  cacheHit: boolean;
  strategy: string;
}

/**
 * 增强的查询处理器
 * 替换sw-surreal.ts中简单的查询处理逻辑
 */
export class EnhancedQueryHandler {
  private queryRouter: QueryRouter;
  private cacheExecutor: CacheExecutor;
  private subscriptionManager: SubscriptionManager;
  private dataCacheManager: DataCacheManager;
  private performanceMonitor: PerformanceMonitor;
  private cacheDebugger: CacheDebugger;
  private cacheLogger: CacheLogger;
  private localDb: Surreal;
  private remoteDb?: Surreal;

  constructor(
    localDb: Surreal,
    dataCacheManager: DataCacheManager,
    broadcastToAllClients: (message: Record<string, unknown>) => Promise<void>,
    remoteDb?: Surreal
  ) {
    this.localDb = localDb;
    this.remoteDb = remoteDb;
    this.dataCacheManager = dataCacheManager;

    // 初始化智能缓存组件
    this.cacheLogger = new CacheLogger();
    this.performanceMonitor = new PerformanceMonitor();
    this.queryRouter = new QueryRouter();
    this.cacheDebugger = new CacheDebugger(
      this.localDb,
      this.dataCacheManager,
      this.queryRouter
    );
    this.cacheExecutor = new CacheExecutor(
      this.queryRouter,
      this.dataCacheManager,
      this.localDb,
      this.remoteDb
    );
    this.subscriptionManager = new SubscriptionManager(
      this.localDb,
      this.dataCacheManager,
      broadcastToAllClients,
      this.remoteDb
    );

    // 记录系统启动日志
    this.cacheLogger.info(LogCategory.SYSTEM, 'Enhanced query handler initialized', {
      hasRemoteDb: !!this.remoteDb,
      components: ['QueryRouter', 'CacheExecutor', 'SubscriptionManager', 'PerformanceMonitor', 'CacheDebugger']
    }, 'EnhancedQueryHandler');
  }

  /**
   * 处理查询请求（替换sw-surreal.ts中的query/mutate处理）
   */
  async handleQuery(
    sql: string,
    params?: QueryParams,
    userId?: string,
    caseId?: string
  ): Promise<QueryHandlerResult> {
    const startTime = Date.now();

    try {
      this.cacheLogger.debug(LogCategory.QUERY, 'Processing query', {
        sql: sql.substring(0, 200),
        hasParams: !!params,
        userId,
        caseId
      }, 'EnhancedQueryHandler');

      // 开始性能计时
      const timerId = `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.cacheLogger.startTimer(timerId);

      // 使用智能缓存执行器执行查询
      const result = await this.cacheExecutor.executeQuery(sql, params, userId, caseId);

      // 结束性能计时
      this.cacheLogger.endTimer(timerId, LogCategory.QUERY, 'Query execution completed', {
        source: result.source,
        cacheHit: result.cacheHit,
        strategy: result.strategy,
        userId,
        caseId
      }, 'EnhancedQueryHandler');

      // 记录查询执行日志
      this.cacheLogger.logQuery(sql, params, result.executionTime, result.source, result.cacheHit, userId, caseId);

      // 记录性能指标
      const analysis = this.queryRouter.analyzeQuery(sql, params);
      this.performanceMonitor.recordQueryPerformance(
        sql,
        params,
        result.source,
        result.executionTime,
        result.cacheHit,
        analysis.tables
      );

      // 处理订阅逻辑
      await this.handleSubscriptionLogic(sql, result, userId, caseId);

      // 处理个人数据缓存逻辑
      await this.handlePersonalDataCaching(sql, result.data, userId, caseId);

      return {
        success: true,
        data: result.data,
        source: result.source,
        executionTime: result.executionTime,
        cacheHit: result.cacheHit,
        strategy: result.strategy
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // 记录错误日志
      this.cacheLogger.error(LogCategory.QUERY, 'Query execution failed', error as Error, {
        sql: sql.substring(0, 200),
        hasParams: !!params,
        userId,
        caseId,
        executionTime
      }, 'EnhancedQueryHandler');
      
      // 记录错误性能指标
      const analysis = this.queryRouter.analyzeQuery(sql, params);
      this.performanceMonitor.recordQueryPerformance(
        sql,
        params,
        'remote',
        executionTime,
        false,
        analysis.tables,
        (error as Error).message
      );
      
      return {
        success: false,
        error: (error as Error).message,
        source: 'remote',
        executionTime,
        cacheHit: false,
        strategy: 'ERROR'
      };
    }
  }

  /**
   * 处理写操作（INSERT, UPDATE, DELETE）
   */
  async handleMutation(
    sql: string,
    params?: QueryParams,
    userId?: string,
    caseId?: string
  ): Promise<QueryHandlerResult> {
    const startTime = Date.now();

    try {
      this.cacheLogger.info(LogCategory.QUERY, 'Processing mutation', {
        sql: sql.substring(0, 200),
        hasParams: !!params,
        userId,
        caseId
      }, 'EnhancedQueryHandler');

      // 写操作必须走远程数据库
      if (!this.remoteDb) {
        throw new Error('Remote database not available for mutations');
      }

      const result = await this.remoteDb.query(sql, params);

      // 分析写操作影响的表
      const analysis = this.queryRouter.analyzeQuery(sql, params);
      
      // 如果是写操作，需要清理相关缓存或触发更新
      await this.handleMutationCacheInvalidation(analysis.tables, userId, caseId);

      // 广播数据变更事件
      await this.broadcastMutationEvent(analysis, result, userId, caseId);

      const executionTime = Date.now() - startTime;
      
      // 记录写操作日志
      this.cacheLogger.info(LogCategory.QUERY, 'Mutation completed', {
        executionTime,
        affectedTables: analysis.tables,
        queryType: analysis.queryType,
        userId,
        caseId
      }, 'EnhancedQueryHandler');

      // 记录写操作性能指标
      this.performanceMonitor.recordQueryPerformance(
        sql,
        params,
        'remote',
        executionTime,
        false,
        analysis.tables
      );

      return {
        success: true,
        data: result,
        source: 'remote',
        executionTime,
        cacheHit: false,
        strategy: 'REMOTE_ONLY'
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // 记录写操作错误日志
      this.cacheLogger.error(LogCategory.QUERY, 'Mutation execution failed', error as Error, {
        sql: sql.substring(0, 200),
        hasParams: !!params,
        userId,
        caseId,
        executionTime
      }, 'EnhancedQueryHandler');
      
      // 记录写操作错误性能指标
      const analysis = this.queryRouter.analyzeQuery(sql, params);
      this.performanceMonitor.recordQueryPerformance(
        sql,
        params,
        'remote',
        executionTime,
        false,
        analysis.tables,
        (error as Error).message
      );
      
      return {
        success: false,
        error: (error as Error).message,
        source: 'remote',
        executionTime,
        cacheHit: false,
        strategy: 'ERROR'
      };
    }
  }

  /**
   * 处理订阅逻辑
   */
  private async handleSubscriptionLogic(
    sql: string,
    result: any,
    userId?: string,
    caseId?: string
  ): Promise<void> {
    try {
      const analysis = this.queryRouter.analyzeQuery(sql);
      
      // 只对SELECT查询处理订阅
      if (analysis.queryType !== 'SELECT') {
        return;
      }

      // 检查是否需要设置新的订阅
      for (const table of analysis.tables) {
        const shouldSubscribe = await this.shouldCreateSubscription(table, analysis, userId, caseId);
        
        if (shouldSubscribe) {
          console.log(`EnhancedQueryHandler: Creating subscription for table: ${table}`);
          
          try {
            const subscriptionId = await this.subscriptionManager.subscribeToTable(
              table,
              userId,
              caseId
            );
            console.log(`EnhancedQueryHandler: Subscription created: ${subscriptionId}`);
          } catch (subscriptionError) {
            console.warn(`EnhancedQueryHandler: Failed to create subscription for ${table}:`, subscriptionError);
          }
        }
      }
    } catch (error) {
      console.warn('EnhancedQueryHandler: Error in subscription logic:', error);
    }
  }

  /**
   * 判断是否应该创建订阅
   */
  private async shouldCreateSubscription(
    table: string,
    analysis: any,
    userId?: string,
    caseId?: string
  ): Promise<boolean> {
    // 检查表的缓存配置
    const tableProfile = this.queryRouter.getTableProfile(table);
    
    // 如果是高优先级表且用户已认证，创建订阅
    if (tableProfile && tableProfile.priority >= 7 && userId) {
      // 检查是否已存在订阅
      const activeSubscriptions = this.subscriptionManager.getActiveSubscriptions();
      const subscriptionId = `${table}::USER_SPECIFIC::user:${userId}${caseId ? `::case:${caseId}` : ''}`;
      
      return !activeSubscriptions.has(subscriptionId);
    }

    // 对于个人数据查询，总是确保有订阅
    if (analysis.isPersonalDataQuery && userId) {
      return true;
    }

    return false;
  }

  /**
   * 处理个人数据缓存
   */
  private async handlePersonalDataCaching(
    sql: string,
    data: UnknownData[],
    userId?: string,
    _caseId?: string
  ): Promise<void> {
    if (!userId || !data) return;

    try {
      // 检查是否为个人数据查询
      if (this.isPersonalDataQuery(sql)) {
        console.log('EnhancedQueryHandler: Processing personal data caching');

        const personalDataComponent = this.extractPersonalDataComponent(sql, data);
        
        if (personalDataComponent) {
          // 获取现有个人数据
          let existingPersonalData = this.dataCacheManager.getCacheStatus().hasAuth ? {} : null;

          if (!existingPersonalData) {
            existingPersonalData = {
              permissions: { operations: [] },
              roles: { global: [], case: {} },
              menus: [],
              syncTimestamp: Date.now()
            };
          }

          // 合并新数据
          this.mergePersonalDataComponent(existingPersonalData, personalDataComponent);

          // 更新认证状态
          await this.dataCacheManager.updateAuthState(existingPersonalData);

          console.log(`EnhancedQueryHandler: Personal data cached for user ${userId}`);
        }
      }
    } catch (error) {
      console.warn('EnhancedQueryHandler: Error in personal data caching:', error);
    }
  }

  /**
   * 检查是否为个人数据查询
   */
  private isPersonalDataQuery(sql: string): boolean {
    const sqlLower = sql.toLowerCase();
    
    // 检查是否包含认证检查
    const hasAuthCheck = sqlLower.includes('return $auth');
    if (!hasAuthCheck) return false;

    // 检查是否涉及个人数据相关的表或关系
    const personalDataPatterns = [
      'operation_metadata',
      'menu_metadata',
      'has_role',
      'has_case_role',
      'user_personal_data'
    ];

    return personalDataPatterns.some(pattern => sqlLower.includes(pattern));
  }

  /**
   * 从查询结果中提取个人数据组件
   */
  private extractPersonalDataComponent(sql: string, result: UnknownData[]): any {
    const sqlLower = sql.toLowerCase();

    // 检查认证状态（第一个结果应该是认证检查）
    if (!Array.isArray(result) || result.length === 0) {
      return null;
    }

    const authResult = result[0];
    if (!authResult || (Array.isArray(authResult) && authResult.length === 0)) {
      console.warn('EnhancedQueryHandler: Authentication failed for personal data query');
      return null;
    }

    // 获取实际查询结果（从索引1开始）
    const actualResult = result.slice(1);
    if (!actualResult || actualResult.length === 0) {
      return null;
    }

    // 根据查询类型识别数据组件
    if (sqlLower.includes('operation_metadata')) {
      return {
        type: 'operations',
        data: actualResult[0] || []
      };
    } else if (sqlLower.includes('menu_metadata')) {
      return {
        type: 'menus',
        data: actualResult[0] || []
      };
    } else if (sqlLower.includes('has_role') && !sqlLower.includes('has_case_role')) {
      return {
        type: 'globalRoles',
        data: actualResult[0] || []
      };
    } else if (sqlLower.includes('has_case_role')) {
      return {
        type: 'caseRoles',
        data: actualResult[0] || []
      };
    }

    return null;
  }

  /**
   * 合并个人数据组件
   */
  private mergePersonalDataComponent(existingData: any, component: any): void {
    switch (component.type) {
      case 'operations':
        existingData.permissions.operations = component.data.map((item: any) => ({
          operation_id: item.operation_id,
          case_id: item.case_id,
          can_execute: item.can_execute,
          conditions: item.conditions
        }));
        break;

      case 'menus':
        existingData.menus = component.data.map((item: any) => ({
          id: item.id,
          path: item.path,
          labelKey: item.labelKey,
          iconName: item.iconName,
          parent_id: item.parent_id,
          order_index: item.order_index,
          is_active: item.is_active,
          required_permissions: item.required_permissions
        }));
        break;

      case 'globalRoles':
        existingData.roles.global = component.data.map((item: any) => item.role_name);
        break;

      case 'caseRoles':
        const caseRoleMap: Record<string, string[]> = {};
        component.data.forEach((item: any) => {
          const caseId = String(item.case_id);
          if (!caseRoleMap[caseId]) {
            caseRoleMap[caseId] = [];
          }
          caseRoleMap[caseId].push(item.role_name);
        });
        existingData.roles.case = { ...existingData.roles.case, ...caseRoleMap };
        break;
    }

    // 更新同步时间戳
    existingData.syncTimestamp = Date.now();
  }

  /**
   * 处理写操作的缓存失效
   */
  private async handleMutationCacheInvalidation(
    tables: string[],
    userId?: string,
    caseId?: string
  ): Promise<void> {
    try {
      for (const table of tables) {
        console.log(`EnhancedQueryHandler: Invalidating cache for table: ${table}`);
        
        // 根据表的重要性决定失效策略
        const tableProfile = this.queryRouter.getTableProfile(table);
        
        if (tableProfile && tableProfile.priority >= 8) {
          // 高优先级表：触发后台同步而不是清除缓存
          this.scheduleBackgroundSync(table, userId, caseId);
        } else {
          // 普通表：清除相关缓存
          await this.dataCacheManager.clearTableCache(table, userId, caseId);
        }
      }
    } catch (error) {
      console.warn('EnhancedQueryHandler: Error in cache invalidation:', error);
    }
  }

  /**
   * 安排后台同步
   */
  private scheduleBackgroundSync(table: string, userId?: string, caseId?: string): void {
    setTimeout(async () => {
      try {
        console.log(`EnhancedQueryHandler: Background syncing table: ${table}`);
        
        if (this.remoteDb) {
          const data = await this.remoteDb.select(table);
          const cacheType = this.queryRouter.getTableProfile(table)?.priority >= 8 ? 'persistent' : 'temporary';
          
          await this.dataCacheManager.cacheData(table, data, cacheType, userId, caseId);
          console.log(`EnhancedQueryHandler: Background sync completed for table: ${table}`);
        }
      } catch (error) {
        console.warn(`EnhancedQueryHandler: Background sync failed for table ${table}:`, error);
      }
    }, 100); // 100ms延迟
  }

  /**
   * 广播数据变更事件
   */
  private async broadcastMutationEvent(
    analysis: any,
    result: UnknownData[],
    userId?: string,
    caseId?: string
  ): Promise<void> {
    try {
      // 这里可以实现更详细的变更事件广播逻辑
      const message = {
        type: 'data_mutation',
        payload: {
          queryType: analysis.queryType,
          tables: analysis.tables,
          userId,
          caseId,
          timestamp: Date.now(),
          resultCount: Array.isArray(result) ? result.length : 1
        }
      };

      // 注意：这里需要访问broadcastToAllClients，可能需要通过构造函数传入
      console.log('EnhancedQueryHandler: Broadcasting mutation event:', message);
    } catch (error) {
      console.warn('EnhancedQueryHandler: Error broadcasting mutation event:', error);
    }
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): any {
    return {
      executionStats: this.cacheExecutor.getExecutionStats(),
      subscriptionHealth: this.subscriptionManager.getHealthStatus(),
      syncStatus: this.subscriptionManager.getSyncStatus(),
      performanceReport: this.performanceMonitor.generatePerformanceReport(),
      realTimeStats: this.performanceMonitor.getRealTimeStats(),
      anomalies: this.performanceMonitor.getAnomalies()
    };
  }

  /**
   * 获取性能监控器
   */
  getPerformanceMonitor(): PerformanceMonitor {
    return this.performanceMonitor;
  }

  /**
   * 获取缓存调试器
   */
  getCacheDebugger(): CacheDebugger {
    return this.cacheDebugger;
  }

  /**
   * 获取缓存日志记录器
   */
  getCacheLogger(): CacheLogger {
    return this.cacheLogger;
  }

  /**
   * 预热缓存
   */
  async preloadCache(tables: string[], userId?: string, caseId?: string): Promise<void> {
    console.log(`EnhancedQueryHandler: Preloading cache for tables: ${tables.join(', ')}`);
    
    await this.cacheExecutor.preloadCache(tables, userId, caseId);
    
    // 同时为这些表设置订阅
    for (const table of tables) {
      try {
        await this.subscriptionManager.subscribeToTable(table, userId, caseId);
      } catch (error) {
        console.warn(`EnhancedQueryHandler: Failed to subscribe to ${table} during preload:`, error);
      }
    }
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    this.cacheLogger.info(LogCategory.SYSTEM, 'Cleaning up resources', {}, 'EnhancedQueryHandler');
    
    // 清理统计数据
    this.cacheExecutor.cleanupStats();
    this.queryRouter.cleanupFrequencyStats();
    this.performanceMonitor.cleanup();
    this.cacheDebugger.cleanup();
    this.cacheLogger.cleanup();
    
    // 关闭订阅管理器
    await this.subscriptionManager.close();
    
    this.cacheLogger.info(LogCategory.SYSTEM, 'Cleanup completed', {}, 'EnhancedQueryHandler');
  }

  /**
   * 获取查询路由器（用于外部配置）
   */
  getQueryRouter(): QueryRouter {
    return this.queryRouter;
  }

  /**
   * 获取订阅管理器（用于外部监控）
   */
  getSubscriptionManager(): SubscriptionManager {
    return this.subscriptionManager;
  }
}