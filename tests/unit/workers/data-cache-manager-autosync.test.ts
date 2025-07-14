import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataCacheManager, isAutoSyncTable, AUTO_SYNC_TABLES } from '@/src/workers/data-cache-manager';
import { Surreal } from 'surrealdb';

describe('DataCacheManager Auto Sync', () => {
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
      broadcastToAllClients: mockBroadcastToAllClients,
      defaultExpirationMs: 60 * 60 * 1000
    });

    // 模拟本地数据库操作
    vi.spyOn(mockLocalDb, 'query').mockResolvedValue([]);
    vi.spyOn(mockLocalDb, 'create').mockResolvedValue([]);
    vi.spyOn(mockLocalDb, 'update').mockResolvedValue([]);
    vi.spyOn(mockLocalDb, 'delete').mockResolvedValue([]);
    vi.spyOn(mockLocalDb, 'live').mockResolvedValue('test-uuid');
    
    // 模拟远程数据库操作
    vi.spyOn(mockRemoteDb, 'query').mockResolvedValue([]);
    vi.spyOn(mockRemoteDb, 'live').mockResolvedValue('test-uuid');

    await dataCacheManager.initialize();
  });

  afterEach(async () => {
    await dataCacheManager.close();
    vi.clearAllMocks();
  });

  describe('Auto Sync Table Detection', () => {
    it('should correctly identify auto sync tables', () => {
      expect(isAutoSyncTable('user')).toBe(true);
      expect(isAutoSyncTable('role')).toBe(true);
      expect(isAutoSyncTable('has_case_role')).toBe(true);
      expect(isAutoSyncTable('has_role')).toBe(true);
      expect(isAutoSyncTable('menu_metadata')).toBe(true);
      expect(isAutoSyncTable('operation_button')).toBe(true);
      expect(isAutoSyncTable('user_personal_data')).toBe(true);
    });

    it('should correctly identify non-auto sync tables', () => {
      expect(isAutoSyncTable('case')).toBe(false);
      expect(isAutoSyncTable('claim')).toBe(false);
      expect(isAutoSyncTable('document')).toBe(false);
    });

    it('should correctly identify auto sync tables using static method', () => {
      expect(DataCacheManager.isAutoSyncTable('user')).toBe(true);
      expect(DataCacheManager.isAutoSyncTable('invalid_table')).toBe(false);
    });
  });

  describe('AUTO_SYNC_TABLES Configuration', () => {
    it('should have correct auto sync tables configured', () => {
      const expectedTables = [
        'user',
        'role', 
        'has_case_role',
        'has_role',
        'menu_metadata',
        'operation_button',
        'user_personal_data'
      ];
      
      expect(AUTO_SYNC_TABLES).toEqual(expectedTables);
    });
  });

  describe('checkAndAutoCache method', () => {
    it('should return false for non-auto sync tables', async () => {
      const result = await dataCacheManager.checkAndAutoCache('case', 'user:test');
      expect(result).toBe(false);
    });

    it('should return true for auto sync tables when cache exists', async () => {
      // 模拟存在缓存数据
      vi.spyOn(dataCacheManager as any, 'hasCachedData').mockResolvedValue(true);
      
      const result = await dataCacheManager.checkAndAutoCache('user', 'user:test');
      expect(result).toBe(true);
    });

    it('should trigger auto sync for auto sync tables when no cache exists', async () => {
      // 模拟没有缓存数据
      vi.spyOn(dataCacheManager as any, 'hasCachedData').mockResolvedValue(false);
      vi.spyOn(dataCacheManager, 'autoSyncTables').mockResolvedValue(undefined);
      
      const result = await dataCacheManager.checkAndAutoCache('user', 'user:test');
      expect(result).toBe(true);
      expect(dataCacheManager.autoSyncTables).toHaveBeenCalledWith('user:test', undefined);
    });
  });
});