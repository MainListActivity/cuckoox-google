import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataCacheManager } from '@/src/workers/data-cache-manager';
import { Surreal } from 'surrealdb';

describe('DataCacheManager Auth Variables', () => {
  let mockLocalDb: Surreal;
  let mockRemoteDb: Surreal;
  let dataCacheManager: DataCacheManager;
  let mockBroadcastToAllClients: (message: Record<string, unknown>) => Promise<void>;

  beforeEach(async () => {
    // 创建模拟数据库
    mockLocalDb = new Surreal();
    mockRemoteDb = new Surreal();
    
    // 模拟broadcastToAllClients函数
    mockBroadcastToAllClients = vi.fn().mockResolvedValue(undefined);

    // 创建DataCacheManager实例
    dataCacheManager = new DataCacheManager({
      localDb: mockLocalDb,
      remoteDb: mockRemoteDb,
      broadcastToAllClients: mockBroadcastToAllClients
    });

    // 模拟本地数据库操作
    vi.spyOn(mockLocalDb, 'query').mockResolvedValue([]);
    vi.spyOn(mockLocalDb, 'create').mockResolvedValue([]);
    vi.spyOn(mockLocalDb, 'update').mockResolvedValue([]);
    vi.spyOn(mockLocalDb, 'delete').mockResolvedValue([]);
    
    // 模拟远程数据库操作
    vi.spyOn(mockRemoteDb, 'query').mockResolvedValue([]);
    vi.spyOn(mockRemoteDb, 'select').mockResolvedValue([]);

    await dataCacheManager.initialize();

    // 设置认证状态
    await dataCacheManager.updateAuthState({
      id: 'user:123',
      github_id: 'test-user',
      name: 'Test User'
    });

    // 模拟已缓存的表
    await dataCacheManager.autoSyncTables();
  });

  afterEach(async () => {
    await dataCacheManager.close();
    vi.clearAllMocks();
  });

  describe('Auth Variable Replacement', () => {
    it('should replace $auth with $userId in local queries', async () => {
      const sql = 'return $auth; select * from user where user_id = $auth';
      
      // 模拟本地查询结果
      mockLocalDb.query.mockResolvedValueOnce([
        { id: 'user:456', name: 'Test User 2' }
      ]);

      const result = await dataCacheManager.query(sql);

      // 验证返回结果包含认证状态和查询结果
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'user:123',
        github_id: 'test-user',
        name: 'Test User'
      });

      // 验证本地数据库被调用了，并且SQL中的$auth被替换为$userId
      expect(mockLocalDb.query).toHaveBeenCalledWith(
        'select * from user where user_id = $userId',
        { userId: 'user:123' }
      );
    });

    it('should extract userId from different auth fields', async () => {
      // 测试使用 github_id 字段
      await dataCacheManager.updateAuthState({
        github_id: 'github-user-123',
        name: 'GitHub User'
      });

      const sql = 'return $auth; select * from user where user_id = $auth';
      
      mockLocalDb.query.mockResolvedValueOnce([]);

      await dataCacheManager.query(sql);

      expect(mockLocalDb.query).toHaveBeenCalledWith(
        'select * from user where user_id = $userId',
        { userId: 'github-user-123' }
      );
    });

    it('should handle multiple $auth occurrences in SQL', async () => {
      const sql = 'return $auth; select * from user where user_id = $auth AND creator = $auth';
      
      mockLocalDb.query.mockResolvedValueOnce([]);

      await dataCacheManager.query(sql);

      expect(mockLocalDb.query).toHaveBeenCalledWith(
        'select * from user where user_id = $userId AND creator = $userId',
        { userId: 'user:123' }
      );
    });

    it('should use remote query when table is not cached', async () => {
      // 使用一个非自动同步表
      const sql = 'return $auth; select * from claim where creator = $auth';
      
      mockRemoteDb.query.mockResolvedValueOnce([
        { id: 'user:123', github_id: 'test-user', name: 'Test User' }, // 认证状态
        [{ id: 'claim:1', creator: 'user:123' }] // 实际查询结果
      ]);

      const result = await dataCacheManager.query(sql);

      // 验证使用远程查询，包含完整的查询字符串
      expect(mockRemoteDb.query).toHaveBeenCalledWith('return $auth; select * from claim where creator = $auth', undefined);
      expect(mockLocalDb.query).not.toHaveBeenCalled();
      
      // 验证返回结果包含认证状态和查询结果
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'user:123',
        github_id: 'test-user',
        name: 'Test User'
      });
      expect(result[1]).toEqual([
        { id: 'claim:1', creator: 'user:123' }
      ]);
    });

    it('should handle auth state with null userId gracefully', async () => {
      await dataCacheManager.updateAuthState({
        name: 'User Without ID'
      });

      const sql = 'return $auth; select * from user where user_id = $auth';
      
      mockLocalDb.query.mockResolvedValueOnce([]);

      await dataCacheManager.query(sql);

      expect(mockLocalDb.query).toHaveBeenCalledWith(
        'select * from user where user_id = $userId',
        { userId: null }
      );
    });
  });
});