import { Surreal, Uuid,Table, LiveHandler } from 'surrealdb';
import { OptimizedQueryRouter, QueryRoute, } from './optimized-query-router.js';

/**
 * 查询执行结果
 */
export interface QueryResult {
  data: any;
  source: 'local' | 'remote';
  executionTime: number;
  cacheHit: boolean;
}

/**
 * 优化的缓存执行器
 * 实现直接表缓存策略，缓存表与原始表结构完全一致
 */
export class OptimizedCacheExecutor {
  constructor(
    private queryRouter: OptimizedQueryRouter,
    private localDb: Surreal,
    private remoteDb?: Surreal
  ) { }

  /**
   * 执行查询
   */
  async executeRpc(route: QueryRoute,method: string, params?: unknown[]): Promise<QueryResult> {
    const startTime = Date.now();

    const sql = params&&params[0] as string || '';
    const paramArray = params&&params[1] as Record<string, unknown> || {};
    try {

      let result: QueryResult;
      if (method === 'query') {
        console.log('OptimizedCacheExecutor: 查询路由结果', route);

        switch (route.strategy) {
          case 'CACHED': {
            result = await this.executeLocalRpc(method, params);
            break;
          }

          case 'REMOTE': {
            result = await this.executeRemoteRpc(method, params);
            // 检查是否需要启用表缓存
            const analysis = this.queryRouter.analyzeQuery(sql, paramArray);
            await this.considerEnablingCache(analysis.tables);
            break;
          }

          case 'WRITE_THROUGH': {
            result = await this.executeWriteThroughRpc(method, params);
            break;
          }

          default:
            throw new Error(`不支持的查询策略: ${route.strategy}`);
        }
      } else {
        // 其他方法默认使用WRITE_THROUGH
        result = await this.executeWriteThroughRpc(method, params);
      }

      const executionTime = Date.now() - startTime;
      result.executionTime = executionTime;

      console.log(`OptimizedCacheExecutor: 查询完成，耗时${executionTime}ms，来源${result.source}`);
      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      console.error(`OptimizedCacheExecutor: 查询执行失败，耗时${executionTime}ms`, error);
      throw error;
    }
  }

  /**
   * 执行本地查询
   */
  private async executeLocalRpc(method: string, params?: unknown[]): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      // 检查是否包含认证查询

      const sql = params&&params[0] as string || '';
      const paramArray = params&&params[1] as Record<string, unknown> || {};
      const hasAuth = sql.includes('return $auth');
      if (method == 'query' && hasAuth) {
        // 处理包含认证的查询
        return await this.executeAuthQuery(sql, paramArray);
      } else {
        // 直接在本地数据库执行查询
        const data = await this.localDb.rpc(method, params);
        const executionTime = Date.now() - startTime;

        return {
          data,
          source: 'local',
          executionTime,
          cacheHit: true
        };
      }
    } catch (error) {
      console.error('OptimizedCacheExecutor: 本地查询执行失败', error);
      throw error;
    }
  }

  /**
   * 执行远程查询
   */
  private async executeRemoteRpc(method: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.remoteDb) {
      throw new Error('远程数据库未连接');
    }

    const startTime = Date.now();

    try {
      const data = await this.remoteDb.rpc(method, params);
      const executionTime = Date.now() - startTime;

      return {
        data,
        source: 'remote',
        executionTime,
        cacheHit: false
      };
    } catch (error) {
      console.error('OptimizedCacheExecutor: 远程查询执行失败', error);
      throw error;
    }
  }
  /**
   * 执行写透查询（Write-Through）
   */
  private async executeWriteThroughRpc(method: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.remoteDb) {
      throw new Error('远程数据库未连接');
    }

    const startTime = Date.now();

    try {
      // 写操作先写远程数据库
      //use 方法只在本地执行， authenticate 只在远程执行
      let data = null;
      if (method === 'use') {
        data = await this.localDb.rpc(method, params);
      } else if (method === 'authenticate') {
        data = await this.remoteDb.rpc(method, params);
      } else {
        data = await this.remoteDb.rpc(method, params);
        await this.localDb.rpc(method, params);
      }
      const executionTime = Date.now() - startTime;

      // Live Query会自动更新本地缓存，这里不需要手动更新
      console.log('OptimizedCacheExecutor: 写操作完成，Live Query将自动同步到本地缓存');

      return {
        data,
        source: 'remote',
        executionTime,
        cacheHit: false
      };
    } catch (error) {
      console.error('OptimizedCacheExecutor: 写透查询执行失败', error);
      throw error;
    }
  }

  /**
   * 执行包含认证的查询
   */
  private async executeAuthQuery(sql: string, params?: Record<string, unknown>): Promise<QueryResult> {
    const startTime = Date.now();

    try {
      // 如果缓存命中，从内存中获取认证状态
      const authResult = this.getAuthStateFromMemory();

      // 解析查询，将认证查询和业务查询分离
      const { authQuery, businessQuery } = this.parseAuthQuery(sql);

      let result: any[] = [];

      // 添加认证状态到结果的第0个位置
      if (authQuery) {
        result.push(authResult);
      }

      // 执行业务查询（如果有）
      if (businessQuery) {
        const businessResult = await this.localDb.query(businessQuery, params);
        if (Array.isArray(businessResult)) {
          result = result.concat(businessResult);
        } else {
          result.push(businessResult);
        }
      }

      const executionTime = Date.now() - startTime;

      return {
        data: result,
        source: 'local',
        executionTime,
        cacheHit: true
      };
    } catch (error) {
      console.error('OptimizedCacheExecutor: 认证查询执行失败', error);
      throw error;
    }
  }

  /**
   * 从内存获取认证状态
   */
  private getAuthStateFromMemory(): any {
    // 这里应该从内存中的认证状态获取
    // 暂时返回默认值，后续与认证管理器集成
    return {
      id: 'user123',
      tenant_code: 'default',
      authenticated: true
    };
  }

  /**
   * 解析认证查询
   */
  private parseAuthQuery(sql: string): { authQuery?: string; businessQuery?: string } {
    const lines = sql.split(';').map(line => line.trim()).filter(line => line.length > 0);

    let authQuery: string | undefined;
    let businessQuery: string | undefined;

    const businessLines: string[] = [];

    for (const line of lines) {
      if (line.toLowerCase().includes('return $auth')) {
        authQuery = line;
      } else {
        businessLines.push(line);
      }
    }

    if (businessLines.length > 0) {
      businessQuery = businessLines.join(';');
    }

    return { authQuery, businessQuery };
  }

  /**
   * 考虑启用表缓存
   */
  private async considerEnablingCache(tables: string[]): Promise<void> {
    for (const table of tables) {
      const strategy = this.queryRouter.getTableCacheStrategy(table);
      if (strategy && !await this.queryRouter.isTableCached(table)) {
        // 异步启用缓存，不阻塞当前查询
        this.enableTableCacheAsync(table).catch(error => {
          console.warn(`OptimizedCacheExecutor: 启用表 ${table} 缓存失败`, error);
        });
      }
    }
  }

  /**
   * 异步启用表缓存
   */
  private async enableTableCacheAsync(table: string): Promise<void> {
    console.log(`OptimizedCacheExecutor: 异步启用表 ${table} 缓存`);

    try {
      const strategy = this.queryRouter.getTableCacheStrategy(table);
      if (!strategy || !this.remoteDb) {
        return;
      }

      // 1. 初始数据同步
      await this.initialTableSync(table);

      // 2. 启用Live Query同步（如果配置了）
      if (strategy.enableLiveSync) {
        await this.setupTableLiveQuerySync(table);
      }

      // 3. 记录缓存元数据
      await this.updateCacheMetadata(table, strategy);

      console.log(`OptimizedCacheExecutor: 表 ${table} 缓存启用完成`);
    } catch (error) {
      console.error(`OptimizedCacheExecutor: 启用表 ${table} 缓存失败`, error);
    }
  }

  /**
   * 初始表数据同步
   */
  private async initialTableSync(table: string): Promise<void> {
    if (!this.remoteDb) return;

    console.log(`OptimizedCacheExecutor: 开始同步表 ${table} 的初始数据`);

    try {
      // 从远程数据库获取全表数据
      const data = await this.remoteDb.select(new Table(table));

      // 清空本地表
      await this.localDb.query(`DELETE FROM ${table}`);

      // 批量插入数据到本地表（保持原始结构）
      if (Array.isArray(data) && data.length > 0) {
        for (const record of data) {
          if (record.id) {
            await this.localDb.create(record.id, record);
          }
        }
      }

      console.log(`OptimizedCacheExecutor: 表 ${table} 初始同步完成，记录数: ${Array.isArray(data) ? data.length : 0}`);
    } catch (error) {
      console.error(`OptimizedCacheExecutor: 表 ${table} 初始同步失败`, error);
      throw error;
    }
  }

  /**
   * 设置表的Live Query同步
   */
  private async setupTableLiveQuerySync(table: string): Promise<Uuid | undefined> {
    if (!this.remoteDb) return;

    try {
      // 创建Live Query订阅
      const queryResult = await this.remoteDb.live(new Table(table));
      queryResult.subscribe((...[action, result]) => {
        this.handleTableLiveQueryUpdate(table, action, result);
      });

      console.log(`OptimizedCacheExecutor: 表 ${table} 的Live Query同步已启用，UUID: ${queryResult.id}`);
      return queryResult.id;
    } catch (error) {
      console.error(`OptimizedCacheExecutor: 设置表 ${table} 的Live Query同步失败`, error);
      return undefined;
    }
  }

  /**
   * 处理表的Live Query更新
   */
  private async handleTableLiveQueryUpdate(
    table: string,
    action: "CLOSED" | "CREATE" | "UPDATE" | "DELETE",
    result: any
  ): Promise<void> {
    try {
      console.log(`OptimizedCacheExecutor: 表 ${table} 收到Live Query更新`, action, result);

      switch (action) {
        case 'CREATE':
          // 直接插入到本地表
          if (result.id) {
            await this.localDb.create(result.id, result);
          }
          break;

        case 'UPDATE':
          // 直接更新本地表记录
          if (result.id) {
            await this.localDb.update(result.id, result);
          }
          break;

        case 'DELETE':
          // 直接删除本地表记录
          if (result.id) {
            await this.localDb.delete(result.id);
          }
          break;
      }

      // 更新缓存统计
      await this.updateCacheStats(table, action);

    } catch (error) {
      console.error(`OptimizedCacheExecutor: 处理表 ${table} 的Live Query更新失败`, error);
    }
  }

  /**
   * 更新缓存元数据
   */
  private async updateCacheMetadata(table: string, strategy: any, liveQueryUuid?: string): Promise<void> {
    try {
      const now = new Date();
      const expiresAt = strategy.ttl ? new Date(Date.now() + strategy.ttl) : undefined;

      await this.localDb.query(`
        UPDATE cache_metadata SET {
          cache_type: $cache_type,
          live_query_uuid: $live_query_uuid,
          last_sync_time: $last_sync_time,
          is_active: true,
          updated_at: $updated_at,
          expires_at: $expires_at
        } WHERE table_name = $table_name
        OR CREATE cache_metadata SET {
          table_name: $table_name,
          cache_type: $cache_type,
          live_query_uuid: $live_query_uuid,
          last_sync_time: $last_sync_time,
          record_count: 0,
          is_active: true,
          created_at: $created_at,
          updated_at: $updated_at,
          expires_at: $expires_at
        }
      `, {
        table_name: table,
        cache_type: strategy.cacheType,
        live_query_uuid: liveQueryUuid,
        last_sync_time: Date.now(),
        created_at: now,
        updated_at: now,
        expires_at: expiresAt
      });
    } catch (error) {
      console.error(`OptimizedCacheExecutor: 更新表 ${table} 缓存元数据失败`, error);
    }
  }

  /**
   * 更新缓存统计
   */
  private async updateCacheStats(table: string, action: string): Promise<void> {
    try {
      // 这里可以实现缓存统计更新逻辑
      console.log(`OptimizedCacheExecutor: 更新表 ${table} 缓存统计，操作: ${action}`);
    } catch (error) {
      console.error(`OptimizedCacheExecutor: 更新缓存统计失败`, error);
    }
  }
}