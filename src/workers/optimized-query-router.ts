import { Surreal } from 'surrealdb';

/**
 * 查询路由策略
 */
export type QueryRouteStrategy = 'CACHED' | 'REMOTE' | 'WRITE_THROUGH';

/**
 * 查询路由结果
 */
export interface QueryRoute {
  strategy: QueryRouteStrategy;
  source: 'local' | 'remote';
  reasoning: string;
}

/**
 * 查询分析结果
 */
export interface QueryAnalysis {
  isWriteOperation: boolean;
  tables: string[];
  hasAuth: boolean;
  queryType: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'CREATE' | 'RELATE' | 'LIVE' | 'KILL' | 'OTHER';
}

/**
 * 缓存策略配置
 */
export interface CacheStrategy {
  table: string;
  cacheType: 'persistent' | 'temporary';
  enableLiveSync: boolean;
  priority: number;
  ttl?: number;
}

/**
 * 预定义的缓存策略
 */
export const CACHE_STRATEGIES: Record<string, CacheStrategy> = {
  // 用户权限数据 - 持久化缓存，Live Query同步
  user: {
    table: 'user',
    cacheType: 'persistent',
    enableLiveSync: true,
    priority: 9
  },

  role: {
    table: 'role',
    cacheType: 'persistent',
    enableLiveSync: true,
    priority: 8
  },

  has_role: {
    table: 'has_role',
    cacheType: 'persistent',
    enableLiveSync: true,
    priority: 9
  },

  menu_metadata: {
    table: 'menu_metadata',
    cacheType: 'persistent',
    enableLiveSync: true,
    priority: 8
  },

  operation_metadata: {
    table: 'operation_metadata',
    cacheType: 'persistent',
    enableLiveSync: true,
    priority: 8
  },

  // 业务数据 - 临时缓存，Live Query同步
  case: {
    table: 'case',
    cacheType: 'temporary',
    enableLiveSync: true,
    priority: 8,
    ttl: 4 * 60 * 60 * 1000 // 4小时
  },

  claim: {
    table: 'claim',
    cacheType: 'temporary',
    enableLiveSync: true,
    priority: 7,
    ttl: 2 * 60 * 60 * 1000 // 2小时
  },

  creditor: {
    table: 'creditor',
    cacheType: 'temporary',
    enableLiveSync: true,
    priority: 7,
    ttl: 2 * 60 * 60 * 1000 // 2小时
  }
};

/**
 * 优化的查询路由器
 * 基于表缓存状态智能路由查询，实现简化的缓存策略
 */
export class OptimizedQueryRouter {
  constructor(private localDb: Surreal) { }

  /**
   * 查询路由决策
   */
  async routeQuery(analysis: QueryAnalysis): Promise<QueryRoute> {

    console.log('OptimizedQueryRouter: 查询分析结果', analysis);

    // 写操作直接路由到远程
    if (analysis.isWriteOperation) {
      return {
        strategy: 'WRITE_THROUGH',
        source: 'remote',
        reasoning: '写操作必须通过远程数据库执行'
      };
    }

    // 检查涉及的表是否已缓存
    const cachedTables = await this.getCachedTables(analysis.tables);
    const allTablesCached = analysis.tables.every(table => cachedTables.has(table));

    if (allTablesCached && analysis.tables.length > 0) {
      // 检查缓存是否有效
      const cacheValid = await this.validateCacheStatus(analysis.tables);

      if (cacheValid) {
        return {
          strategy: 'CACHED',
          source: 'local',
          reasoning: `所有涉及的表都已缓存且有效: ${analysis.tables.join(', ')}`
        };
      }
    }

    // 部分表缓存或缓存无效，使用远程查询
    return {
      strategy: 'REMOTE',
      source: 'remote',
      reasoning: analysis.tables.length > 0
        ? `表未完全缓存或缓存无效: ${analysis.tables.join(', ')}`
        : '非表查询，使用远程执行'
    };
  }

  /**
   * 分析SQL查询
   */
  analyzeQuery(sql: string, params?: Record<string, unknown>): QueryAnalysis {
    const upperSql = sql.toUpperCase().trim();

    // 检查是否包含认证查询
    const hasAuth = sql.includes('$auth') || sql.includes('return $auth');

    // 判断查询类型
    let queryType: QueryAnalysis['queryType'] = 'OTHER';
    let isWriteOperation = false;

    if (upperSql.startsWith('SELECT')) {
      queryType = 'SELECT';
    } else if (upperSql.startsWith('INSERT')) {
      queryType = 'INSERT';
      isWriteOperation = true;
    } else if (upperSql.startsWith('UPDATE')) {
      queryType = 'UPDATE';
      isWriteOperation = true;
    } else if (upperSql.startsWith('DELETE')) {
      queryType = 'DELETE';
      isWriteOperation = true;
    } else if (upperSql.startsWith('CREATE')) {
      queryType = 'CREATE';
      isWriteOperation = true;
    } else if (upperSql.startsWith('RELATE')) {
      queryType = 'RELATE';
      isWriteOperation = true;
    } else if (upperSql.startsWith('LIVE')) {
      queryType = 'LIVE';
    } else if (upperSql.startsWith('KILL')) {
      queryType = 'KILL';
    }

    // 提取表名
    const tables = this.extractTableNames(sql);

    return {
      isWriteOperation,
      tables,
      hasAuth,
      queryType
    };
  }

  /**
   * 提取SQL中的表名
   */
  private extractTableNames(sql: string): string[] {
    const tables = new Set<string>();

    // 匹配 FROM table_name 模式
    const fromMatches = sql.match(/\bFROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    if (fromMatches) {
      fromMatches.forEach(match => {
        const tableName = match.split(/\s+/)[1];
        if (tableName && !tableName.startsWith('$')) {
          tables.add(tableName.toLowerCase());
        }
      });
    }

    // 匹配 UPDATE table_name 模式
    const updateMatches = sql.match(/\bUPDATE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    if (updateMatches) {
      updateMatches.forEach(match => {
        const tableName = match.split(/\s+/)[1];
        if (tableName && !tableName.startsWith('$')) {
          tables.add(tableName.toLowerCase());
        }
      });
    }

    // 匹配 INSERT INTO table_name 模式
    const insertMatches = sql.match(/\bINSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    if (insertMatches) {
      insertMatches.forEach(match => {
        const tableName = match.split(/\s+/)[2];
        if (tableName && !tableName.startsWith('$')) {
          tables.add(tableName.toLowerCase());
        }
      });
    }

    // 匹配 DELETE FROM table_name 模式
    const deleteMatches = sql.match(/\bDELETE\s+FROM\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    if (deleteMatches) {
      deleteMatches.forEach(match => {
        const tableName = match.split(/\s+/)[2];
        if (tableName && !tableName.startsWith('$')) {
          tables.add(tableName.toLowerCase());
        }
      });
    }

    // 匹配 CREATE table_name 模式
    const createMatches = sql.match(/\bCREATE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    if (createMatches) {
      createMatches.forEach(match => {
        const parts = match.split(/\s+/);
        if (parts.length >= 2) {
          const tableName = parts[1];
          if (tableName && !tableName.startsWith('$') && !tableName.includes(':')) {
            tables.add(tableName.toLowerCase());
          }
        }
      });
    }

    // 匹配 LIVE table_name 模式
    const liveMatches = sql.match(/\bLIVE\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi);
    if (liveMatches) {
      liveMatches.forEach(match => {
        const tableName = match.split(/\s+/)[1];
        if (tableName && !tableName.startsWith('$')) {
          tables.add(tableName.toLowerCase());
        }
      });
    }

    return Array.from(tables);
  }

  /**
   * 获取已缓存的表
   */
  private async getCachedTables(tables: string[]): Promise<Set<string>> {
    const cachedTables = new Set<string>();

    try {
      for (const table of tables) {
        const metadata = await this.localDb.query(
          'SELECT * FROM cache_metadata WHERE table_name = $table AND is_active = true',
          { table }
        );

        if (Array.isArray(metadata) && metadata.length > 0) {
          cachedTables.add(table);
        }
      }
    } catch (error) {
      console.warn('OptimizedQueryRouter: 检查缓存表时发生错误', error);
    }

    console.log(`OptimizedQueryRouter: 已缓存的表`, cachedTables);
    return cachedTables;
  }

  /**
   * 验证缓存状态
   */
  private async validateCacheStatus(tables: string[]): Promise<boolean> {
    try {
      for (const table of tables) {
        const metadata = await this.localDb.query<any[]>(
          'SELECT * FROM cache_metadata WHERE table_name = $table',
          { table }
        );

        if (!Array.isArray(metadata) || metadata.length === 0) {
          console.log(`OptimizedQueryRouter: 表 ${table} 未找到缓存元数据`);
          return false;
        }

        const cache = metadata[0];

        // 检查临时缓存是否过期
        if (cache.cache_type === 'temporary' && cache.expires_at) {
          const expiresAt = new Date(cache.expires_at);
          if (expiresAt < new Date()) {
            console.log(`OptimizedQueryRouter: 表 ${table} 的临时缓存已过期`);
            return false;
          }
        }

        // 检查Live Query是否活跃
        if (!cache.live_query_uuid || !cache.is_active) {
          console.log(`OptimizedQueryRouter: 表 ${table} 的Live Query不活跃`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('OptimizedQueryRouter: 验证缓存状态时发生错误', error);
      return false;
    }
  }

  /**
   * 检查表是否已缓存
   */
  async isTableCached(table: string): Promise<boolean> {
    try {
      const metadata = await this.localDb.query(
        'SELECT * FROM cache_metadata WHERE table_name = $table AND is_active = true',
        { table }
      );

      return Array.isArray(metadata) && metadata.length > 0;
    } catch (error) {
      console.warn(`OptimizedQueryRouter: 检查表 ${table} 缓存状态时发生错误`, error);
      return false;
    }
  }

  /**
   * 获取表的缓存策略
   */
  getTableCacheStrategy(table: string): CacheStrategy | undefined {
    return CACHE_STRATEGIES[table];
  }

  /**
   * 获取所有支持缓存的表
   */
  getCacheableTables(): string[] {
    return Object.keys(CACHE_STRATEGIES);
  }
}