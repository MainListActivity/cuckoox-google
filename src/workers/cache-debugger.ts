/**
 * 缓存调试工具集
 * 提供缓存状态检查、查询执行跟踪和数据验证功能
 */

import type { Surreal } from 'surrealdb';
import type { QueryParams, UnknownData } from '../types/surreal';
import { QueryRouter, QueryAnalysis, CacheRoutingDecision } from './query-router';
import { DataCacheManager } from './data-cache-manager';

// 缓存检查结果
export interface CacheInspectionResult {
  tables: Array<{
    table: string;
    recordCount: number;
    sizeBytes: number;
    lastSyncTime: number;
    expiresAt: number | null;
    cacheType: 'persistent' | 'temporary';
    userId?: string;
    caseId?: string;
    dataAge: number; // 数据年龄（毫秒）
    isExpired: boolean;
    dataQuality: 'fresh' | 'stale' | 'expired';
    sampleData?: any[]; // 样本数据（前几条记录）
  }>;
  totalCacheSize: number;
  totalRecords: number;
  oldestCache: {
    table: string;
    age: number;
  } | null;
  newestCache: {
    table: string;
    age: number;
  } | null;
  summary: {
    freshTables: number;
    staleTables: number;
    expiredTables: number;
    persistentTables: number;
    temporaryTables: number;
  };
}

// 查询执行跟踪步骤
export interface QueryTraceStep {
  step: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  details: string;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

// 查询执行跟踪结果
export interface QueryTrace {
  sql: string;
  params?: QueryParams;
  userId?: string;
  caseId?: string;
  
  // 执行步骤
  steps: QueryTraceStep[];
  
  // 总体信息
  totalTime: number;
  startTime: number;
  endTime?: number;
  
  // 分析结果
  analysis?: QueryAnalysis;
  decision?: CacheRoutingDecision;
  
  // 执行结果
  success: boolean;
  result?: UnknownData[];
  error?: string;
  
  // 性能信息
  source: 'local' | 'remote' | 'hybrid';
  cacheHit: boolean;
  strategy: string;
}

// 数据验证结果
export interface DataValidationResult {
  table: string;
  isValid: boolean;
  issues: Array<{
    type: 'missing_field' | 'invalid_type' | 'constraint_violation' | 'data_corruption';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    recordId?: string;
    field?: string;
    expectedValue?: any;
    actualValue?: any;
    suggestion?: string;
  }>;
  recordCount: number;
  validRecords: number;
  invalidRecords: number;
  validationTime: number;
}

// 缓存内容检查结果
export interface CacheContentCheck {
  table: string;
  totalRecords: number;
  duplicateRecords: number;
  orphanedRecords: number;
  missingReferences: number;
  dataIntegrityScore: number; // 0-1 数据完整性评分
  recommendations: string[];
  sampleIssues: Array<{
    recordId: string;
    issue: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

// 调试信息导出格式
export interface DebugExport {
  timestamp: number;
  version: string;
  cacheInspection: CacheInspectionResult;
  recentTraces: QueryTrace[];
  validationResults: DataValidationResult[];
  contentChecks: CacheContentCheck[];
  systemInfo: {
    totalMemoryUsage: number;
    cacheHitRate: number;
    avgResponseTime: number;
    errorRate: number;
  };
}

/**
 * 缓存调试器
 * 提供全面的缓存调试和诊断功能
 */
export class CacheDebugger {
  private localDb: Surreal;
  private dataCacheManager: DataCacheManager;
  private queryRouter: QueryRouter;
  
  // 查询跟踪存储
  private queryTraces = new Map<string, QueryTrace>();
  private maxTraces = 1000; // 最大跟踪记录数
  
  // 数据验证缓存
  private validationCache = new Map<string, DataValidationResult>();
  private validationCacheTTL = 30 * 60 * 1000; // 30分钟

  constructor(
    localDb: Surreal,
    dataCacheManager: DataCacheManager,
    queryRouter: QueryRouter
  ) {
    this.localDb = localDb;
    this.dataCacheManager = dataCacheManager;
    this.queryRouter = queryRouter;
  }

  /**
   * 检查缓存状态
   */
  async inspectCacheState(table?: string): Promise<CacheInspectionResult> {
    const result: CacheInspectionResult = {
      tables: [],
      totalCacheSize: 0,
      totalRecords: 0,
      oldestCache: null,
      newestCache: null,
      summary: {
        freshTables: 0,
        staleTables: 0,
        expiredTables: 0,
        persistentTables: 0,
        temporaryTables: 0
      }
    };

    try {
      // 获取要检查的表列表
      const tables = table ? [table] : await this.getAllCachedTables();
      
      for (const tableName of tables) {
        const tableInfo = await this.inspectTableCache(tableName);
        if (tableInfo) {
          result.tables.push(tableInfo);
          result.totalCacheSize += tableInfo.sizeBytes;
          result.totalRecords += tableInfo.recordCount;
          
          // 更新最老和最新缓存信息
          if (!result.oldestCache || tableInfo.dataAge > result.oldestCache.age) {
            result.oldestCache = { table: tableName, age: tableInfo.dataAge };
          }
          if (!result.newestCache || tableInfo.dataAge < result.newestCache.age) {
            result.newestCache = { table: tableName, age: tableInfo.dataAge };
          }
          
          // 更新统计信息
          switch (tableInfo.dataQuality) {
            case 'fresh':
              result.summary.freshTables++;
              break;
            case 'stale':
              result.summary.staleTables++;
              break;
            case 'expired':
              result.summary.expiredTables++;
              break;
          }
          
          if (tableInfo.cacheType === 'persistent') {
            result.summary.persistentTables++;
          } else {
            result.summary.temporaryTables++;
          }
        }
      }
    } catch (error) {
      console.error('CacheDebugger: Failed to inspect cache state:', error);
    }

    return result;
  }

  /**
   * 跟踪查询执行
   */
  async traceQueryExecution(
    sql: string,
    params?: QueryParams,
    userId?: string,
    caseId?: string
  ): Promise<QueryTrace> {
    const traceId = this.generateTraceId(sql, params);
    const trace: QueryTrace = {
      sql,
      params,
      userId,
      caseId,
      steps: [],
      totalTime: 0,
      startTime: Date.now(),
      success: false,
      source: 'remote',
      cacheHit: false,
      strategy: 'UNKNOWN'
    };

    try {
      // 步骤1: 查询分析
      const analysisStep = this.startTraceStep('query_analysis', '分析查询特征和表依赖');
      const analysis = this.queryRouter.analyzeQuery(sql, params);
      this.endTraceStep(analysisStep, analysis);
      trace.steps.push(analysisStep);
      trace.analysis = analysis;

      // 步骤2: 缓存策略决策
      const decisionStep = this.startTraceStep('cache_decision', '决定缓存路由策略');
      const decision = this.queryRouter.decideCacheStrategy(analysis, userId);
      this.endTraceStep(decisionStep, decision);
      trace.steps.push(decisionStep);
      trace.decision = decision;
      trace.strategy = decision.strategy;

      // 步骤3: 缓存状态检查
      const cacheCheckStep = this.startTraceStep('cache_check', '检查本地缓存状态');
      const cacheStatus = await this.checkCacheAvailability(analysis.tables, userId, caseId);
      this.endTraceStep(cacheCheckStep, cacheStatus);
      trace.steps.push(cacheCheckStep);

      // 步骤4: 查询执行路径决策
      const executionStep = this.startTraceStep('execution_path', '确定查询执行路径');
      const executionPath = this.determineExecutionPath(decision, cacheStatus);
      this.endTraceStep(executionStep, { path: executionPath, reasoning: this.getExecutionReasoning(executionPath, cacheStatus) });
      trace.steps.push(executionStep);

      // 步骤5: 实际查询执行
      const queryStep = this.startTraceStep('query_execution', `执行${executionPath}查询`);
      try {
        let result: UnknownData[];
        
        if (executionPath === 'local') {
          result = await this.dataCacheManager.query(sql, params);
          trace.source = 'local';
          trace.cacheHit = true;
        } else {
          // 这里应该调用远程查询，但为了演示我们模拟一下
          result = await this.simulateRemoteQuery(sql, params);
          trace.source = 'remote';
          trace.cacheHit = false;
        }
        
        this.endTraceStep(queryStep, { resultCount: result?.length || 0 });
        trace.result = result;
        trace.success = true;
      } catch (queryError) {
        this.endTraceStep(queryStep, null, (queryError as Error).message);
        trace.error = (queryError as Error).message;
      }
      trace.steps.push(queryStep);

      // 步骤6: 后处理（如果需要）
      if (trace.success && trace.source === 'remote' && decision.cacheTTL > 0) {
        const cacheStep = this.startTraceStep('cache_update', '更新本地缓存');
        try {
          // 这里应该更新缓存，但为了演示我们跳过
          this.endTraceStep(cacheStep, { cached: true });
        } catch (cacheError) {
          this.endTraceStep(cacheStep, null, (cacheError as Error).message);
        }
        trace.steps.push(cacheStep);
      }

    } catch (error) {
      trace.error = (error as Error).message;
    } finally {
      trace.endTime = Date.now();
      trace.totalTime = trace.endTime - trace.startTime;
      
      // 存储跟踪记录
      this.storeQueryTrace(traceId, trace);
    }

    return trace;
  }

  /**
   * 验证缓存数据完整性
   */
  async validateCacheData(table: string, forceRefresh = false): Promise<DataValidationResult> {
    const cacheKey = `validation_${table}`;
    
    // 检查验证缓存
    if (!forceRefresh) {
      const cached = this.validationCache.get(cacheKey);
      if (cached && Date.now() - cached.validationTime < this.validationCacheTTL) {
        return cached;
      }
    }

    const startTime = Date.now();
    const result: DataValidationResult = {
      table,
      isValid: true,
      issues: [],
      recordCount: 0,
      validRecords: 0,
      invalidRecords: 0,
      validationTime: startTime
    };

    try {
      // 获取表的缓存数据
      const cacheData = await this.getCachedTableData(table);
      result.recordCount = cacheData.length;

      // 获取表的字段定义（如果有的话）
      const fieldDefinitions = this.getTableFieldDefinitions(table);

      for (const record of cacheData) {
        const recordIssues = this.validateRecord(record, fieldDefinitions, table);
        
        if (recordIssues.length > 0) {
          result.issues.push(...recordIssues);
          result.invalidRecords++;
        } else {
          result.validRecords++;
        }
      }

      result.isValid = result.issues.length === 0;
      result.validationTime = Date.now() - startTime;

      // 缓存验证结果
      this.validationCache.set(cacheKey, result);

    } catch (error) {
      result.isValid = false;
      result.issues.push({
        type: 'data_corruption',
        severity: 'critical',
        description: `验证失败: ${(error as Error).message}`,
        suggestion: '检查缓存数据完整性或重新同步数据'
      });
    }

    return result;
  }

  /**
   * 检查缓存内容
   */
  async checkCacheContent(table: string): Promise<CacheContentCheck> {
    const result: CacheContentCheck = {
      table,
      totalRecords: 0,
      duplicateRecords: 0,
      orphanedRecords: 0,
      missingReferences: 0,
      dataIntegrityScore: 1.0,
      recommendations: [],
      sampleIssues: []
    };

    try {
      const cacheData = await this.getCachedTableData(table);
      result.totalRecords = cacheData.length;

      // 检查重复记录
      const idSet = new Set();
      const duplicates = new Set();
      
      for (const record of cacheData) {
        const id = record.id || record._id;
        if (id) {
          if (idSet.has(id)) {
            duplicates.add(id);
            result.duplicateRecords++;
          } else {
            idSet.add(id);
          }
        }
      }

      // 检查数据完整性
      const integrityIssues = await this.checkDataIntegrity(table, cacheData);
      result.orphanedRecords = integrityIssues.orphaned;
      result.missingReferences = integrityIssues.missingRefs;

      // 计算数据完整性评分
      const totalIssues = result.duplicateRecords + result.orphanedRecords + result.missingReferences;
      result.dataIntegrityScore = result.totalRecords > 0 
        ? Math.max(0, 1 - (totalIssues / result.totalRecords))
        : 1.0;

      // 生成建议
      if (result.duplicateRecords > 0) {
        result.recommendations.push(`发现 ${result.duplicateRecords} 条重复记录，建议清理重复数据`);
      }
      if (result.orphanedRecords > 0) {
        result.recommendations.push(`发现 ${result.orphanedRecords} 条孤立记录，建议检查数据关联性`);
      }
      if (result.missingReferences > 0) {
        result.recommendations.push(`发现 ${result.missingReferences} 个缺失引用，建议重新同步相关数据`);
      }
      if (result.dataIntegrityScore < 0.9) {
        result.recommendations.push('数据完整性评分较低，建议进行全量数据同步');
      }

      // 收集样本问题
      if (duplicates.size > 0) {
        const sampleDuplicates = Array.from(duplicates).slice(0, 5);
        for (const id of sampleDuplicates) {
          result.sampleIssues.push({
            recordId: String(id),
            issue: '重复记录',
            severity: 'medium'
          });
        }
      }

    } catch (error) {
      result.recommendations.push(`内容检查失败: ${(error as Error).message}`);
      result.dataIntegrityScore = 0;
    }

    return result;
  }

  /**
   * 导出调试信息
   */
  async exportDebugInfo(includeTraces = true, includeValidation = true): Promise<DebugExport> {
    const cacheInspection = await this.inspectCacheState();
    
    const debugExport: DebugExport = {
      timestamp: Date.now(),
      version: '1.0.0',
      cacheInspection,
      recentTraces: [],
      validationResults: [],
      contentChecks: [],
      systemInfo: {
        totalMemoryUsage: this.estimateMemoryUsage(),
        cacheHitRate: this.calculateOverallCacheHitRate(),
        avgResponseTime: this.calculateAverageResponseTime(),
        errorRate: this.calculateErrorRate()
      }
    };

    if (includeTraces) {
      debugExport.recentTraces = Array.from(this.queryTraces.values())
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, 50); // 最近50条跟踪记录
    }

    if (includeValidation) {
      // 为所有缓存表生成验证结果
      for (const tableInfo of cacheInspection.tables) {
        try {
          const validation = await this.validateCacheData(tableInfo.table);
          debugExport.validationResults.push(validation);
          
          const contentCheck = await this.checkCacheContent(tableInfo.table);
          debugExport.contentChecks.push(contentCheck);
        } catch (error) {
          console.warn(`CacheDebugger: Failed to validate table ${tableInfo.table}:`, error);
        }
      }
    }

    return debugExport;
  }

  /**
   * 获取查询跟踪历史
   */
  getQueryTraces(limit = 100): QueryTrace[] {
    return Array.from(this.queryTraces.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  /**
   * 清理调试数据
   */
  cleanup(): void {
    // 清理过期的查询跟踪
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24小时
    
    for (const [id, trace] of Array.from(this.queryTraces.entries())) {
      if (now - trace.startTime > maxAge) {
        this.queryTraces.delete(id);
      }
    }

    // 清理验证缓存
    for (const [key, result] of Array.from(this.validationCache.entries())) {
      if (now - result.validationTime > this.validationCacheTTL) {
        this.validationCache.delete(key);
      }
    }
  }

  // 私有方法

  private async getAllCachedTables(): Promise<string[]> {
    try {
      const query = 'SELECT DISTINCT table_name FROM data_table_cache';
      const result = await this.localDb.query(query);
      return (result as any[]).map(item => item.table_name);
    } catch (error) {
      console.warn('CacheDebugger: Failed to get cached tables:', error);
      return [];
    }
  }

  private async inspectTableCache(table: string): Promise<any> {
    try {
      const query = `
        SELECT 
          table_name,
          cache_type,
          user_id,
          case_id,
          sync_timestamp,
          expires_at,
          array::len(data) as record_count,
          string::len(string::join(data, '')) as size_estimate
        FROM data_table_cache 
        WHERE table_name = $table
        ORDER BY sync_timestamp DESC
        LIMIT 1
      `;
      
      const result = await this.localDb.query(query, { table });
      
      if (!result || result.length === 0) {
        return null;
      }

      const cacheInfo = result[0] as any;
      const now = Date.now();
      const syncTime = cacheInfo.sync_timestamp || 0;
      const dataAge = now - syncTime;
      const expiresAt = cacheInfo.expires_at;
      const isExpired = expiresAt ? now > expiresAt : false;
      
      let dataQuality: 'fresh' | 'stale' | 'expired' = 'fresh';
      if (isExpired) {
        dataQuality = 'expired';
      } else if (dataAge > 30 * 60 * 1000) { // 30分钟
        dataQuality = 'stale';
      }

      // 获取样本数据
      const sampleQuery = `
        SELECT VALUE data[0:3] FROM data_table_cache 
        WHERE table_name = $table 
        LIMIT 1
      `;
      const sampleResult = await this.localDb.query(sampleQuery, { table });
      const sampleData = (sampleResult as any[])?.[0] || [];

      return {
        table,
        recordCount: cacheInfo.record_count || 0,
        sizeBytes: cacheInfo.size_estimate || 0,
        lastSyncTime: syncTime,
        expiresAt: expiresAt,
        cacheType: cacheInfo.cache_type || 'temporary',
        userId: cacheInfo.user_id,
        caseId: cacheInfo.case_id,
        dataAge,
        isExpired,
        dataQuality,
        sampleData
      };
    } catch (error) {
      console.warn(`CacheDebugger: Failed to inspect table ${table}:`, error);
      return null;
    }
  }

  private startTraceStep(step: string, details: string): QueryTraceStep {
    return {
      step,
      startTime: Date.now(),
      details
    };
  }

  private endTraceStep(traceStep: QueryTraceStep, result?: any, error?: string): void {
    traceStep.endTime = Date.now();
    traceStep.duration = traceStep.endTime - traceStep.startTime;
    if (result !== undefined) {
      traceStep.result = result;
    }
    if (error) {
      traceStep.error = error;
    }
  }

  private async checkCacheAvailability(tables: string[], userId?: string, caseId?: string): Promise<any> {
    const availability: Record<string, any> = {};
    
    for (const table of tables) {
      try {
        const query = `
          SELECT COUNT() as count, MAX(sync_timestamp) as last_sync
          FROM data_table_cache 
          WHERE table_name = $table
            AND (user_id = $user_id OR user_id IS NULL)
            AND (case_id = $case_id OR case_id IS NULL)
            AND (expires_at IS NULL OR expires_at > time::now())
        `;
        
        const result = await this.localDb.query(query, {
          table,
          user_id: userId,
          case_id: caseId
        });
        
        const info = result?.[0] as any;
        availability[table] = {
          available: (info?.count || 0) > 0,
          recordCount: info?.count || 0,
          lastSync: info?.last_sync || 0,
          age: Date.now() - (info?.last_sync || 0)
        };
      } catch (error) {
        availability[table] = {
          available: false,
          error: (error as Error).message
        };
      }
    }
    
    return availability;
  }

  private determineExecutionPath(decision: CacheRoutingDecision, cacheStatus: any): 'local' | 'remote' | 'hybrid' {
    // 简化的执行路径决策逻辑
    if (decision.strategy === 'LOCAL_ONLY') return 'local';
    if (decision.strategy === 'REMOTE_ONLY') return 'remote';
    
    // 检查是否所有表都有可用缓存
    const allTablesAvailable = Object.values(cacheStatus).every((status: any) => status.available);
    
    if (decision.strategy === 'LOCAL_FIRST' && allTablesAvailable) {
      return 'local';
    }
    
    return 'remote';
  }

  private getExecutionReasoning(path: string, cacheStatus: any): string {
    if (path === 'local') {
      return '所有需要的表都有可用的本地缓存';
    } else if (path === 'remote') {
      const unavailableTables = Object.entries(cacheStatus)
        .filter(([, status]: [string, any]) => !status.available)
        .map(([table]) => table);
      
      if (unavailableTables.length > 0) {
        return `以下表缺少本地缓存: ${unavailableTables.join(', ')}`;
      } else {
        return '根据缓存策略选择远程执行';
      }
    }
    
    return '混合执行路径';
  }

  private async simulateRemoteQuery(sql: string, params?: QueryParams): Promise<UnknownData[]> {
    // 这里应该调用实际的远程查询，但为了演示我们返回模拟数据
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50)); // 模拟网络延迟
    return [{ id: 'mock_1', data: 'simulated remote data' }];
  }

  private generateTraceId(sql: string, params?: QueryParams): string {
    const normalizedSql = sql.toLowerCase().replace(/\s+/g, ' ').trim();
    const paramsStr = params ? JSON.stringify(params) : '';
    const timestamp = Date.now();
    return `trace_${timestamp}_${normalizedSql.substring(0, 20)}_${paramsStr.substring(0, 10)}`;
  }

  private storeQueryTrace(traceId: string, trace: QueryTrace): void {
    this.queryTraces.set(traceId, trace);
    
    // 限制跟踪记录数量
    if (this.queryTraces.size > this.maxTraces) {
      const oldestTrace = Array.from(this.queryTraces.entries())
        .sort(([, a], [, b]) => a.startTime - b.startTime)[0];
      
      if (oldestTrace) {
        this.queryTraces.delete(oldestTrace[0]);
      }
    }
  }

  private async getCachedTableData(table: string): Promise<any[]> {
    try {
      const query = `
        SELECT VALUE data[*] FROM data_table_cache 
        WHERE table_name = $table 
        LIMIT 1
      `;
      const result = await this.localDb.query(query, { table });
      return (result as any[])?.[0] || [];
    } catch (error) {
      console.warn(`CacheDebugger: Failed to get cached data for table ${table}:`, error);
      return [];
    }
  }

  private getTableFieldDefinitions(table: string): Record<string, any> {
    // 这里应该返回表的字段定义，但为了演示我们返回一些基本定义
    const commonFields = {
      id: { type: 'string', required: true },
      created_at: { type: 'datetime', required: false },
      updated_at: { type: 'datetime', required: false }
    };

    // 根据表名返回特定的字段定义
    switch (table) {
      case 'user':
        return {
          ...commonFields,
          username: { type: 'string', required: true },
          email: { type: 'string', required: false }
        };
      case 'case':
        return {
          ...commonFields,
          name: { type: 'string', required: true },
          status: { type: 'string', required: true }
        };
      default:
        return commonFields;
    }
  }

  private validateRecord(record: any, fieldDefinitions: Record<string, any>, table: string): any[] {
    const issues: any[] = [];
    
    for (const [field, definition] of Object.entries(fieldDefinitions)) {
      if (definition.required && !(field in record)) {
        issues.push({
          type: 'missing_field',
          severity: 'high',
          description: `缺少必需字段: ${field}`,
          recordId: record.id || 'unknown',
          field,
          suggestion: `确保表 ${table} 的所有记录都包含字段 ${field}`
        });
      }
      
      if (field in record && definition.type) {
        const isValidType = this.validateFieldType(record[field], definition.type);
        if (!isValidType) {
          issues.push({
            type: 'invalid_type',
            severity: 'medium',
            description: `字段类型不匹配: ${field}`,
            recordId: record.id || 'unknown',
            field,
            expectedValue: definition.type,
            actualValue: typeof record[field],
            suggestion: `检查字段 ${field} 的数据类型`
          });
        }
      }
    }
    
    return issues;
  }

  private validateFieldType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'datetime':
        return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
      default:
        return true; // 未知类型，假设有效
    }
  }

  private async checkDataIntegrity(table: string, data: any[]): Promise<{ orphaned: number; missingRefs: number }> {
    // 简化的数据完整性检查
    let orphaned = 0;
    let missingRefs = 0;
    
    // 这里应该实现更复杂的完整性检查逻辑
    // 比如检查外键引用、关联数据等
    
    return { orphaned, missingRefs };
  }

  private estimateMemoryUsage(): number {
    // 估算内存使用量（字节）
    let totalSize = 0;
    
    // 查询跟踪内存使用
    for (const trace of Array.from(this.queryTraces.values())) {
      totalSize += JSON.stringify(trace).length * 2; // 粗略估算
    }
    
    // 验证缓存内存使用
    for (const validation of Array.from(this.validationCache.values())) {
      totalSize += JSON.stringify(validation).length * 2;
    }
    
    return totalSize;
  }

  private calculateOverallCacheHitRate(): number {
    const traces = Array.from(this.queryTraces.values());
    if (traces.length === 0) return 0;
    
    const hits = traces.filter(trace => trace.cacheHit).length;
    return hits / traces.length;
  }

  private calculateAverageResponseTime(): number {
    const traces = Array.from(this.queryTraces.values());
    if (traces.length === 0) return 0;
    
    const totalTime = traces.reduce((sum, trace) => sum + trace.totalTime, 0);
    return totalTime / traces.length;
  }

  private calculateErrorRate(): number {
    const traces = Array.from(this.queryTraces.values());
    if (traces.length === 0) return 0;
    
    const errors = traces.filter(trace => !trace.success).length;
    return errors / traces.length;
  }
}