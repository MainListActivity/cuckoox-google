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
      broadcastToAllClients: mockBroadcastToAllClients
    });

    // 模拟本地数据库操作
    vi.spyOn(mockLocalDb, 'query').mockResolvedValue([]);
    vi.spyOn(mockLocalDb, 'create').mockResolvedValue([]);
    vi.spyOn(mockLocalDb, 'update').mockResolvedValue([]);
    vi.spyOn(mockLocalDb, 'delete').mockResolvedValue([]);
    vi.spyOn(mockLocalDb, 'live').mockResolvedValue('test-uuid');
    
    // 模拟远程数据库操作
    vi.spyOn(mockRemoteDb, 'query').mockResolvedValue([]);
    vi.spyOn(mockRemoteDb, 'select').mockResolvedValue([]);
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
      expect(isAutoSyncTable('case')).toBe(true);
      expect(isAutoSyncTable('has_member')).toBe(true);
      expect(isAutoSyncTable('menu_metadata')).toBe(true);
      expect(isAutoSyncTable('operation_button')).toBe(true);
      expect(isAutoSyncTable('user_personal_data')).toBe(true);
    });

    it('should correctly identify non-auto sync tables', () => {
      expect(isAutoSyncTable('claim')).toBe(false);
      expect(isAutoSyncTable('document')).toBe(false);
      expect(isAutoSyncTable('notification')).toBe(false);
    });

    it('should correctly identify auto sync tables using standalone function', () => {
      expect(isAutoSyncTable('user')).toBe(true);
      expect(isAutoSyncTable('invalid_table')).toBe(false);
    });
  });

  describe('AUTO_SYNC_TABLES Configuration', () => {
    it('should have correct auto sync tables configured', () => {
      const expectedTables = [
        'user',
        'role', 
        'has_case_role',
        'has_role',
        'case',
        'has_member',
        'menu_metadata',
        'operation_button',
        'user_personal_data',
        'claim_operation_log',
        'claim_version_history',
        'claim_status_flow',
        'claim_access_log'
      ];
      
      expect(AUTO_SYNC_TABLES).toEqual(expectedTables);
    });
  });

  describe('autoSyncTables method', () => {
    it('should sync all auto sync tables when called', async () => {
      // 模拟远程数据库数据
      const mockUserData = [{ id: 'user:1', name: 'Test User' }];
      mockRemoteDb.select.mockResolvedValue(mockUserData);
      
      await dataCacheManager.autoSyncTables();
      
      // 验证所有自动同步表都被调用
      expect(mockRemoteDb.select).toHaveBeenCalledTimes(AUTO_SYNC_TABLES.length);
      AUTO_SYNC_TABLES.forEach(table => {
        expect(mockRemoteDb.select).toHaveBeenCalledWith(table);
      });
    });

    it('should handle errors gracefully during auto sync', async () => {
      // 模拟部分表同步失败
      mockRemoteDb.select.mockImplementation((table) => {
        if (table === 'user') {
          throw new Error('Sync failed');
        }
        return Promise.resolve([]);
      });
      
      // 应该不抛出错误
      await expect(dataCacheManager.autoSyncTables()).resolves.not.toThrow();
    });
  });
});