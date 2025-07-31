import { RecordId } from 'surrealdb';
import type { QueryParams, UnknownData } from '../types/surreal';
// 多租户上下文类型（简化版本）
interface TenantContext {
  tenantId: string;
  namespace: string;
  database: string;
}

// 查询类型枚举
export enum QueryType {
  SELECT = 'SELECT',
  INSERT = 'INSERT', 
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LIVE = 'LIVE',
  CREATE = 'CREATE',
  RELATE = 'RELATE',
  COMPLEX = 'COMPLEX'
}

// 缓存策略枚举
export enum CacheStrategy {
  LOCAL_FIRST = 'LOCAL_FIRST',     // 优先本地，适用于不经常变化的数据
  REMOTE_FIRST = 'REMOTE_FIRST',   // 优先远程，适用于实时性要求高的数据
  LOCAL_ONLY = 'LOCAL_ONLY',       // 仅本地，适用于已缓存的静态数据
  REMOTE_ONLY = 'REMOTE_ONLY',     // 仅远程，适用于写操作或一次性查询
  HYBRID = 'HYBRID'                // 混合模式，根据具体情况动态决定
}

// 数据一致性级别
export enum ConsistencyLevel {
  EVENTUAL = 'EVENTUAL',           // 最终一致性，允许短期不一致
  STRONG = 'STRONG',               // 强一致性，必须实时同步
  WEAK = 'WEAK'                    // 弱一致性，允许较长时间不一致
}

// 查询特征分析结果
export interface QueryAnalysis {
  queryType: QueryType;
  tables: string[];
  hasConditions: boolean;
  hasJoins: boolean;
  hasAggregations: boolean;
  isSimpleSelect: boolean;
  isPersonalDataQuery: boolean;
  estimatedResultSize: 'small' | 'medium' | 'large';
  frequencyScore: number;  // 查询频率评分 0-1
}

// 缓存路由决策结果
export interface CacheRoutingDecision {
  strategy: CacheStrategy;
  consistencyLevel: ConsistencyLevel;
  cacheTTL: number;        // 缓存存活时间（毫秒）
  enableLiveQuery: boolean;
  enableIncrementalSync: boolean;
  priority: number;        // 优先级 0-10
  reasoning: string;       // 决策理由
}

// 表缓存配置
export interface TableCacheProfile {
  table: string;
  defaultStrategy: CacheStrategy;
  consistencyRequirement: ConsistencyLevel;
  avgQueryFrequency: number;
  dataVolatility: 'low' | 'medium' | 'high';  // 数据变化频率
  accessPattern: 'read_heavy' | 'write_heavy' | 'balanced';
  maxCacheSize: number;
  defaultTTL: number;
  priority: number; // 优先级 1-10
}

/**
 * 智能查询路由器
 * 负责分析查询特征并决定最优的缓存策略
 */
export class QueryRouter {
  private tableProfiles = new Map<string, TableCacheProfile>();
  private queryFrequencyMap = new Map<string, number>();
  private performanceMetrics = new Map<string, { localAvg: number; remoteAvg: number }>();

  constructor() {
    this.initializeTableProfiles();
  }

  /**
   * 初始化表缓存配置
   */
  private initializeTableProfiles(): void {
    // 自动同步表 - 低变化频率，读重度
    const autoSyncTables = ['user', 'role', 'has_role', 'menu_metadata', 'operation_button'];
    autoSyncTables.forEach(table => {
      this.tableProfiles.set(table, {
        table,
        defaultStrategy: CacheStrategy.LOCAL_FIRST,
        consistencyRequirement: ConsistencyLevel.EVENTUAL,
        avgQueryFrequency: 0.8,
        dataVolatility: 'low',
        accessPattern: 'read_heavy',
        maxCacheSize: 10000,
        defaultTTL: 24 * 60 * 60 * 1000, // 24小时
        priority: 9
      });
    });

    // 案件相关表 - 中等变化频率
    const caseTables = ['case', 'claim', 'document'];
    caseTables.forEach(table => {
      this.tableProfiles.set(table, {
        table,
        defaultStrategy: CacheStrategy.HYBRID,
        consistencyRequirement: ConsistencyLevel.STRONG,
        avgQueryFrequency: 0.6,
        dataVolatility: 'medium',
        accessPattern: 'balanced',
        maxCacheSize: 5000,
        defaultTTL: 4 * 60 * 60 * 1000, // 4小时
        priority: 8
      });
    });

    // 实时数据表 - 高变化频率
    const realtimeTables = ['notification', 'message', 'activity_log'];
    realtimeTables.forEach(table => {
      this.tableProfiles.set(table, {
        table,
        defaultStrategy: CacheStrategy.REMOTE_FIRST,
        consistencyRequirement: ConsistencyLevel.STRONG,
        avgQueryFrequency: 0.3,
        dataVolatility: 'high',
        accessPattern: 'write_heavy',
        maxCacheSize: 1000,
        defaultTTL: 5 * 60 * 1000, // 5分钟
        priority: 10
      });
    });

    // 债权追踪相关表 - 中等到高变化频率，需要及时同步
    const claimTrackingTables = [
      {
        table: 'claim_operation_log',
        strategy: CacheStrategy.HYBRID,
        consistency: ConsistencyLevel.STRONG,
        ttl: 10 * 60 * 1000, // 10分钟
        priority: 8
      },
      {
        table: 'claim_version_history',
        strategy: CacheStrategy.LOCAL_FIRST,
        consistency: ConsistencyLevel.EVENTUAL,
        ttl: 30 * 60 * 1000, // 30分钟
        priority: 7
      },
      {
        table: 'claim_status_flow',
        strategy: CacheStrategy.HYBRID,
        consistency: ConsistencyLevel.STRONG,
        ttl: 15 * 60 * 1000, // 15分钟
        priority: 8
      },
      {
        table: 'claim_access_log',
        strategy: CacheStrategy.REMOTE_FIRST,
        consistency: ConsistencyLevel.STRONG,
        ttl: 5 * 60 * 1000, // 5分钟
        priority: 9
      }
    ];

    claimTrackingTables.forEach(config => {
      this.tableProfiles.set(config.table, {
        table: config.table,
        defaultStrategy: config.strategy,
        consistencyRequirement: config.consistency,
        avgQueryFrequency: 0.5,
        dataVolatility: 'medium',
        accessPattern: 'read_heavy',
        maxCacheSize: 3000,
        defaultTTL: config.ttl,
        priority: config.priority
      });
    });
  }

  /**
   * 分析SQL查询特征
   */
  analyzeQuery(sql: string, params?: QueryParams): QueryAnalysis {
    const normalizedSql = sql.toLowerCase().trim();
    
    // 提取查询类型
    const queryType = this.extractQueryType(normalizedSql);
    
    // 提取表名
    const tables = this.extractTableNames(normalizedSql);
    
    // 分析查询特征
    const hasConditions = /where|having/.test(normalizedSql);
    const hasJoins = /join|->/.test(normalizedSql);
    const hasAggregations = /count|sum|avg|max|min|group by/.test(normalizedSql);
    const isSimpleSelect = queryType === QueryType.SELECT && 
                          !hasJoins && 
                          !hasAggregations && 
                          tables.length === 1;
    
    // 检查是否为个人数据查询
    const isPersonalDataQuery = normalizedSql.includes('return $auth') ||
                               tables.some(table => ['user_personal_data', 'has_role', 'has_case_role', 'menu_metadata', 'operation_metadata'].includes(table));
    
    // 估算结果大小
    const estimatedResultSize = this.estimateResultSize(normalizedSql, tables, hasConditions);
    
    // 计算查询频率评分
    const queryHash = this.generateQueryHash(sql, params);
    const frequencyScore = this.calculateFrequencyScore(queryHash);

    return {
      queryType,
      tables,
      hasConditions,
      hasJoins,
      hasAggregations,
      isSimpleSelect,
      isPersonalDataQuery,
      estimatedResultSize,
      frequencyScore
    };
  }

  /**
   * 根据查询分析决定缓存路由策略，支持多租户上下文
   */
  decideCacheStrategy(analysis: QueryAnalysis, userId?: string, tenantContext?: TenantContext | null): CacheRoutingDecision {
    // 个人数据查询优先本地缓存（优先级高于查询类型检查）
    if (analysis.isPersonalDataQuery) {
      const tenantReasoning = tenantContext ? ` (租户: ${tenantContext.tenantId})` : '';
      return {
        strategy: CacheStrategy.LOCAL_FIRST,
        consistencyLevel: ConsistencyLevel.EVENTUAL,
        cacheTTL: 60 * 60 * 1000, // 1小时
        enableLiveQuery: true,
        enableIncrementalSync: true,
        priority: 8,
        reasoning: `个人数据查询优先使用本地缓存${tenantReasoning}`
      };
    }

    // 写操作直接走远程
    if (analysis.queryType !== QueryType.SELECT) {
      const tenantReasoning = tenantContext ? ` (租户: ${tenantContext.tenantId})` : '';
      return {
        strategy: CacheStrategy.REMOTE_ONLY,
        consistencyLevel: ConsistencyLevel.STRONG,
        cacheTTL: 0,
        enableLiveQuery: false,
        enableIncrementalSync: false,
        priority: 10,
        reasoning: `写操作必须走远程数据库${tenantReasoning}`
      };
    }

    // 单表简单查询
    if (analysis.isSimpleSelect && analysis.tables.length === 1) {
      const table = analysis.tables[0];
      const profile = this.tableProfiles.get(table);
      
      if (profile) {
        return this.createDecisionFromProfile(profile, analysis);
      }

      // 未知表的默认策略
      const tenantReasoning = tenantContext ? ` (租户: ${tenantContext.tenantId})` : '';
      return {
        strategy: CacheStrategy.HYBRID,
        consistencyLevel: ConsistencyLevel.EVENTUAL,
        cacheTTL: 30 * 60 * 1000, // 30分钟
        enableLiveQuery: true,
        enableIncrementalSync: true,
        priority: 5,
        reasoning: `未知表使用混合缓存策略${tenantReasoning}`
      };
    }

    // 复杂查询（连接、聚合等）
    if (analysis.hasJoins || analysis.hasAggregations) {
      // 复杂查询根据频率决定
      if (analysis.frequencyScore > 0.7) {
        return {
          strategy: CacheStrategy.LOCAL_FIRST,
          consistencyLevel: ConsistencyLevel.EVENTUAL,
          cacheTTL: 15 * 60 * 1000, // 15分钟
          enableLiveQuery: false,
          enableIncrementalSync: false,
          priority: 6,
          reasoning: '高频复杂查询使用本地缓存'
        };
      } else {
        return {
          strategy: CacheStrategy.REMOTE_FIRST,
          consistencyLevel: ConsistencyLevel.STRONG,
          cacheTTL: 5 * 60 * 1000, // 5分钟
          enableLiveQuery: false,
          enableIncrementalSync: false,
          priority: 4,
          reasoning: '低频复杂查询优先远程执行'
        };
      }
    }

    // 多表查询
    if (analysis.tables.length > 1) {
      // 检查所有涉及的表是否都是低变化频率
      const allTablesLowVolatility = analysis.tables.every(table => {
        const profile = this.tableProfiles.get(table);
        return profile && profile.dataVolatility === 'low';
      });

      if (allTablesLowVolatility && analysis.frequencyScore > 0.5) {
        return {
          strategy: CacheStrategy.LOCAL_FIRST,
          consistencyLevel: ConsistencyLevel.EVENTUAL,
          cacheTTL: 20 * 60 * 1000, // 20分钟
          enableLiveQuery: true,
          enableIncrementalSync: true,
          priority: 7,
          reasoning: '低变化频率多表查询使用本地缓存'
        };
      } else {
        return {
          strategy: CacheStrategy.REMOTE_FIRST,
          consistencyLevel: ConsistencyLevel.STRONG,
          cacheTTL: 10 * 60 * 1000, // 10分钟
          enableLiveQuery: false,
          enableIncrementalSync: false,
          priority: 3,
          reasoning: '多表查询优先远程执行以保证一致性'
        };
      }
    }

    // 默认策略
    return {
      strategy: CacheStrategy.HYBRID,
      consistencyLevel: ConsistencyLevel.EVENTUAL,
      cacheTTL: 30 * 60 * 1000,
      enableLiveQuery: true,
      enableIncrementalSync: true,
      priority: 5,
      reasoning: '使用默认混合缓存策略'
    };
  }

  /**
   * 根据表配置创建缓存决策
   */
  private createDecisionFromProfile(profile: TableCacheProfile, analysis: QueryAnalysis): CacheRoutingDecision {
    let strategy = profile.defaultStrategy;
    let ttl = profile.defaultTTL;
    let priority = 5;

    // 根据查询频率调整策略
    if (analysis.frequencyScore > 0.8) {
      // 高频查询倾向于使用本地缓存
      if (strategy === CacheStrategy.REMOTE_FIRST) {
        strategy = CacheStrategy.HYBRID;
      }
      priority += 2;
    } else if (analysis.frequencyScore < 0.3) {
      // 低频查询倾向于远程
      if (strategy === CacheStrategy.LOCAL_FIRST) {
        strategy = CacheStrategy.HYBRID;
      }
      priority -= 1;
    }

    // 根据数据变化频率调整TTL
    if (profile.dataVolatility === 'high') {
      ttl = Math.min(ttl, 10 * 60 * 1000); // 最多10分钟
    } else if (profile.dataVolatility === 'low') {
      ttl = Math.max(ttl, 60 * 60 * 1000); // 最少1小时
    }

    return {
      strategy,
      consistencyLevel: profile.consistencyRequirement,
      cacheTTL: ttl,
      enableLiveQuery: profile.accessPattern === 'read_heavy',
      enableIncrementalSync: profile.dataVolatility !== 'high',
      priority,
      reasoning: `基于表 ${profile.table} 的预定义配置`
    };
  }

  /**
   * 提取查询类型
   */
  private extractQueryType(sql: string): QueryType {
    // 处理复合查询，如 "return $auth;select * from table"
    // 查找主要的查询操作关键字
    if (sql.includes('select') && (sql.startsWith('select') || sql.includes(';select'))) {
      return QueryType.SELECT;
    }
    if (sql.includes('insert') && (sql.startsWith('insert') || sql.includes(';insert'))) {
      return QueryType.INSERT;
    }
    if (sql.includes('update') && (sql.startsWith('update') || sql.includes(';update'))) {
      return QueryType.UPDATE;
    }
    if (sql.includes('delete') && (sql.startsWith('delete') || sql.includes(';delete'))) {
      return QueryType.DELETE;
    }
    if (sql.includes('live') && (sql.startsWith('live') || sql.includes(';live'))) {
      return QueryType.LIVE;
    }
    if (sql.includes('create') && (sql.startsWith('create') || sql.includes(';create'))) {
      return QueryType.CREATE;
    }
    if (sql.includes('relate') && (sql.startsWith('relate') || sql.includes(';relate'))) {
      return QueryType.RELATE;
    }
    return QueryType.COMPLEX;
  }

  /**
   * 提取表名
   */
  private extractTableNames(sql: string): string[] {
    const tables: string[] = [];
    
    // SELECT ... FROM table
    const fromMatches = Array.from(sql.matchAll(/from\s+([a-zA-Z_][a-zA-Z0-9_]*)/g));
    for (const match of fromMatches) {
      tables.push(match[1]);
    }
    
    // INSERT INTO table
    const insertMatches = Array.from(sql.matchAll(/insert\s+into\s+([a-zA-Z_][a-zA-Z0-9_]*)/g));
    for (const match of insertMatches) {
      tables.push(match[1]);
    }
    
    // UPDATE table
    const updateMatches = Array.from(sql.matchAll(/update\s+([a-zA-Z_][a-zA-Z0-9_]*)/g));
    for (const match of updateMatches) {
      tables.push(match[1]);
    }
    
    // DELETE FROM table
    const deleteMatches = Array.from(sql.matchAll(/delete\s+from\s+([a-zA-Z_][a-zA-Z0-9_]*)/g));
    for (const match of deleteMatches) {
      tables.push(match[1]);
    }
    
    return Array.from(new Set(tables)); // 去重
  }

  /**
   * 估算查询结果大小
   */
  private estimateResultSize(sql: string, tables: string[], hasConditions: boolean): 'small' | 'medium' | 'large' {
    // 有条件限制通常结果较小
    if (hasConditions && sql.includes('limit')) {
      return 'small';
    }
    
    // 全表查询根据表类型判断
    if (!hasConditions) {
      if (tables.some(t => ['user', 'case', 'claim'].includes(t))) {
        return 'large';
      }
      if (tables.some(t => ['notification', 'message'].includes(t))) {
        return 'medium';
      }
    }
    
    return hasConditions ? 'small' : 'medium';
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
   * 计算查询频率评分
   */
  private calculateFrequencyScore(queryHash: string): number {
    const count = this.queryFrequencyMap.get(queryHash) || 0;
    this.queryFrequencyMap.set(queryHash, count + 1);
    
    // 简单的频率评分：基于查询次数的对数函数
    // 频率越高评分越高，但增长递减
    return Math.min(Math.log(count + 1) / Math.log(100), 1);
  }

  /**
   * 更新性能指标
   */
  updatePerformanceMetrics(queryHash: string, isLocal: boolean, executionTime: number): void {
    const current = this.performanceMetrics.get(queryHash) || { localAvg: 0, remoteAvg: 0 };
    
    if (isLocal) {
      current.localAvg = (current.localAvg + executionTime) / 2;
    } else {
      current.remoteAvg = (current.remoteAvg + executionTime) / 2;
    }
    
    this.performanceMetrics.set(queryHash, current);
  }

  /**
   * 基于性能指标调整策略
   */
  getPerformanceBasedStrategy(queryHash: string): CacheStrategy | null {
    const metrics = this.performanceMetrics.get(queryHash);
    if (!metrics || metrics.localAvg === 0 || metrics.remoteAvg === 0) {
      return null;
    }
    
    // 如果本地缓存比远程快50%以上，优先本地
    if (metrics.localAvg * 1.5 < metrics.remoteAvg) {
      return CacheStrategy.LOCAL_FIRST;
    }
    
    // 如果远程比本地快30%以上，优先远程
    if (metrics.remoteAvg * 1.3 < metrics.localAvg) {
      return CacheStrategy.REMOTE_FIRST;
    }
    
    return CacheStrategy.HYBRID;
  }

  /**
   * 获取表缓存配置
   */
  getTableProfile(table: string): TableCacheProfile | undefined {
    return this.tableProfiles.get(table);
  }

  /**
   * 更新表缓存配置
   */
  updateTableProfile(table: string, profile: Partial<TableCacheProfile>): void {
    const current = this.tableProfiles.get(table);
    if (current) {
      this.tableProfiles.set(table, { ...current, ...profile });
    }
  }

  /**
   * 清理频率统计（定期执行以防止内存泄漏）
   */
  cleanupFrequencyStats(): void {
    // 保留使用频率高的查询，清理低频查询
    const highFrequencyThreshold = 5;
    
    for (const [hash, count] of Array.from(this.queryFrequencyMap.entries())) {
      if (count < highFrequencyThreshold) {
        this.queryFrequencyMap.delete(hash);
        this.performanceMetrics.delete(hash);
      }
    }
  }
}