import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock globals before importing
vi.stubGlobal('self', {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
});

vi.stubGlobal('navigator', {
  onLine: true,
  connection: {
    type: 'wifi',
    effectiveType: '4g',
    downlink: 10,
    rtt: 50,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }
});

vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => 'test-uuid-123')
});

// Import after mocking globals
import { OfflineManager } from '@/src/workers/offline-manager';

afterEach(() => {
  vi.clearAllMocks();
});

describe('OfflineManager', () => {
  let offlineManager: OfflineManager;
  let mockLocalDb: any;
  let mockRemoteDb: any;
  let mockBroadcast: any;

  beforeEach(() => {
    mockLocalDb = {
      query: vi.fn().mockResolvedValue([])
    };

    mockRemoteDb = {
      query: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      merge: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({})
    };

    mockBroadcast = vi.fn().mockResolvedValue(undefined);

    offlineManager = new OfflineManager({
      localDb: mockLocalDb,
      remoteDb: mockRemoteDb,
      broadcastToAllClients: mockBroadcast
    });
  });

  afterEach(async () => {
    if (offlineManager) {
      await offlineManager.close();
    }
  });

  describe('初始化', () => {
    it('应该正确初始化网络监控', () => {
      expect(self.addEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(self.addEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });

    it('应该正确获取初始网络状态', () => {
      const networkStatus = offlineManager.getNetworkStatus();
      expect(networkStatus.isOnline).toBe(true);
      expect(networkStatus.connectionType).toBe('wifi');
      expect(networkStatus.effectiveType).toBe('4g');
    });
  });

  describe('离线状态检测', () => {
    it('应该正确检测在线状态', () => {
      expect(offlineManager.isOffline()).toBe(false);
    });

    it('应该在navigator.onLine为false时检测为离线', () => {
      vi.stubGlobal('navigator', { ...navigator, onLine: false });
      // 需要触发网络状态更新
      const networkStatus = offlineManager.getNetworkStatus();
      expect(networkStatus.isOnline).toBe(false);
    });
  });

  describe('离线查询', () => {
    it('应该能够执行离线查询', async () => {
      const testSql = 'SELECT * FROM test_table';
      const testParams = { id: 'test' };
      const expectedResult = [{ id: 'test', name: 'Test' }];

      mockLocalDb.query.mockResolvedValue(expectedResult);

      const result = await offlineManager.executeOfflineQuery(testSql, testParams);

      expect(mockLocalDb.query).toHaveBeenCalledWith(testSql, testParams);
      expect(result).toEqual(expectedResult);
    });

    it('应该在本地数据库不可用时抛出错误', async () => {
      const offlineManagerWithoutDb = new OfflineManager({
        localDb: null,
        remoteDb: mockRemoteDb,
        broadcastToAllClients: mockBroadcast
      });

      await expect(
        offlineManagerWithoutDb.executeOfflineQuery('SELECT * FROM test')
      ).rejects.toThrow('Local database not available for offline query');

      await offlineManagerWithoutDb.close();
    });
  });

  describe('离线操作队列', () => {
    it('应该能够添加离线操作到队列', async () => {
      const operation = {
        type: 'create' as const,
        table: 'test_table',
        data: { name: 'Test' },
        maxRetries: 3
      };

      const operationId = await offlineManager.queueOfflineOperation(operation);

      expect(operationId).toBe('test-uuid-123');
      expect(offlineManager.getPendingOperationsCount()).toBe(1);
      expect(mockBroadcast).toHaveBeenCalledWith({
        type: 'offline_queue_status',
        payload: expect.objectContaining({
          pendingOperations: 1,
          totalOperations: 1
        })
      });
    });

    it('应该正确统计操作状态', async () => {
      await offlineManager.queueOfflineOperation({
        type: 'create',
        table: 'test1',
        data: {},
        maxRetries: 3
      });

      await offlineManager.queueOfflineOperation({
        type: 'update',
        table: 'test2',
        data: {},
        maxRetries: 3
      });

      const stats = offlineManager.getOperationStats();
      expect(stats.total).toBe(2);
      expect(stats.pending).toBe(2);
      expect(stats.completed).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  describe('自动同步', () => {
    it('应该在离线模式下跳过同步', async () => {
      // 模拟离线状态
      vi.stubGlobal('navigator', { ...navigator, onLine: false });
      
      await offlineManager.queueOfflineOperation({
        type: 'create',
        table: 'test',
        data: {},
        maxRetries: 3
      });

      await offlineManager.startAutoSync();

      // 验证没有调用远程数据库
      expect(mockRemoteDb.create).not.toHaveBeenCalled();
    });

    it('应该在没有远程数据库时跳过同步', async () => {
      const offlineManagerWithoutRemote = new OfflineManager({
        localDb: mockLocalDb,
        remoteDb: undefined,
        broadcastToAllClients: mockBroadcast
      });

      await offlineManagerWithoutRemote.queueOfflineOperation({
        type: 'create',
        table: 'test',
        data: {},
        maxRetries: 3
      });

      await offlineManagerWithoutRemote.startAutoSync();

      // 验证没有调用远程数据库
      expect(mockRemoteDb.create).not.toHaveBeenCalled();

      await offlineManagerWithoutRemote.close();
    });

    it('应该能够同步创建操作', async () => {
      const testData = { name: 'Test Item' };
      
      await offlineManager.queueOfflineOperation({
        type: 'create',
        table: 'test_table',
        recordId: 'test:123',
        data: testData,
        maxRetries: 3
      });

      mockRemoteDb.create.mockResolvedValue({ id: 'test:123', ...testData });

      await offlineManager.startAutoSync();

      expect(mockRemoteDb.create).toHaveBeenCalledWith('test:123', testData);
      expect(mockBroadcast).toHaveBeenCalledWith({
        type: 'offline_sync_status',
        payload: expect.objectContaining({
          status: 'completed',
          totalOperations: 1,
          successCount: 1,
          failureCount: 0
        })
      });
    });
  });

  describe('清理操作', () => {
    it('应该能够清除已完成的操作', async () => {
      // 添加一个操作并标记为完成
      await offlineManager.queueOfflineOperation({
        type: 'create',
        table: 'test',
        data: {},
        maxRetries: 3
      });

      // 模拟同步完成
      await offlineManager.startAutoSync();

      const statsBefore = offlineManager.getOperationStats();
      expect(statsBefore.total).toBeGreaterThan(0);

      await offlineManager.clearCompletedOperations();

      // 验证已完成的操作被清除
      expect(mockBroadcast).toHaveBeenCalledWith({
        type: 'offline_queue_status',
        payload: expect.objectContaining({
          pendingOperations: expect.any(Number),
          totalOperations: expect.any(Number)
        })
      });
    });
  });

  describe('关闭管理器', () => {
    it('应该正确清理资源', async () => {
      await offlineManager.close();

      expect(self.removeEventListener).toHaveBeenCalledWith('online', expect.any(Function));
      expect(self.removeEventListener).toHaveBeenCalledWith('offline', expect.any(Function));
    });
  });
});