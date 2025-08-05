import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PageAwareSubscriptionManager } from '@/src/workers/page-aware-subscription-manager';
import { SubscriptionManager } from '@/src/workers/subscription-manager';
import { DataCacheManager } from '@/src/workers/data-cache-manager';

// Mock dependencies
const mockSubscriptionManager = {
  subscribeToTable: vi.fn(),
  unsubscribe: vi.fn(),
  getActiveSubscriptions: vi.fn(),
  getSyncStatus: vi.fn(),
  getHealthStatus: vi.fn(),
  close: vi.fn()
} as unknown as SubscriptionManager;

const mockDataCacheManager = {
  query: vi.fn(),
  cacheData: vi.fn(),
  clearTableCache: vi.fn(),
  close: vi.fn()
} as unknown as DataCacheManager;

const mockBroadcastToAllClients = vi.fn();

describe('PageAwareSubscriptionManager', () => {
  let pageAwareSubscriptionManager: PageAwareSubscriptionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    pageAwareSubscriptionManager = new PageAwareSubscriptionManager(
      mockSubscriptionManager,
      mockDataCacheManager,
      mockBroadcastToAllClients
    );
  });

  afterEach(async () => {
    await pageAwareSubscriptionManager.close();
  });

  describe('页面订阅激活', () => {
    it('应该能够激活页面订阅', async () => {
      // Mock subscription manager response
      (mockSubscriptionManager.subscribeToTable as any).mockResolvedValue('subscription-id-1');

      const pageId = await pageAwareSubscriptionManager.activatePageSubscription(
        '/cases',
        'user:123',
        'case:456'
      );

      expect(pageId).toBeDefined();
      expect(mockSubscriptionManager.subscribeToTable).toHaveBeenCalled();
      expect(mockBroadcastToAllClients).toHaveBeenCalledWith({
        type: 'page_subscription_activated',
        payload: expect.objectContaining({
          pageId,
          pagePath: '/cases',
          userId: 'user:123',
          caseId: 'case:456'
        })
      });
    });

    it('应该避免重复激活相同的页面订阅', async () => {
      (mockSubscriptionManager.subscribeToTable as any).mockResolvedValue('subscription-id-1');

      const pageId1 = await pageAwareSubscriptionManager.activatePageSubscription(
        '/cases',
        'user:123',
        'case:456'
      );

      const pageId2 = await pageAwareSubscriptionManager.activatePageSubscription(
        '/cases',
        'user:123',
        'case:456'
      );

      expect(pageId1).toBe(pageId2);
      expect(mockSubscriptionManager.subscribeToTable).toHaveBeenCalledTimes(5); // 5 tables for /cases page
    });

    it('应该处理自定义页面需求配置', async () => {
      (mockSubscriptionManager.subscribeToTable as any).mockResolvedValue('subscription-id-1');

      const customRequirement = {
        requiredTables: ['custom_table'],
        cacheStrategy: 'aggressive' as const,
        subscriptionPriority: 9
      };

      const pageId = await pageAwareSubscriptionManager.activatePageSubscription(
        '/custom-page',
        'user:123',
        undefined,
        customRequirement
      );

      expect(pageId).toBeDefined();
      expect(mockSubscriptionManager.subscribeToTable).toHaveBeenCalledWith(
        'custom_table',
        'user:123',
        undefined,
        expect.objectContaining({
          priority: 9
        })
      );
    });
  });

  describe('页面订阅停用', () => {
    it('应该能够停用页面订阅', async () => {
      (mockSubscriptionManager.subscribeToTable as any).mockResolvedValue('subscription-id-1');

      const pageId = await pageAwareSubscriptionManager.activatePageSubscription(
        '/cases',
        'user:123',
        'case:456'
      );

      await pageAwareSubscriptionManager.deactivatePageSubscription(pageId);

      expect(mockSubscriptionManager.unsubscribe).toHaveBeenCalled();
      expect(mockBroadcastToAllClients).toHaveBeenCalledWith({
        type: 'page_subscription_deactivated',
        payload: expect.objectContaining({
          pageId,
          pagePath: '/cases',
          userId: 'user:123',
          caseId: 'case:456'
        })
      });
    });

    it('应该处理不存在的页面订阅停用请求', async () => {
      await expect(
        pageAwareSubscriptionManager.deactivatePageSubscription('non-existent-page-id')
      ).resolves.not.toThrow();
    });
  });

  describe('页面路径匹配', () => {
    it('应该匹配精确的页面路径', async () => {
      (mockSubscriptionManager.subscribeToTable as any).mockResolvedValue('subscription-id-1');

      const pageId = await pageAwareSubscriptionManager.activatePageSubscription(
        '/cases',
        'user:123'
      );

      expect(pageId).toBeDefined();
    });

    it('应该匹配动态路径参数', async () => {
      (mockSubscriptionManager.subscribeToTable as any).mockResolvedValue('subscription-id-1');

      const pageId = await pageAwareSubscriptionManager.activatePageSubscription(
        '/cases/case123',
        'user:123'
      );

      expect(pageId).toBeDefined();
      // 应该匹配 /cases/:id 模式
    });
  });

  describe('订阅合并', () => {
    it('应该合并相同表的订阅', async () => {
      (mockSubscriptionManager.subscribeToTable as any).mockResolvedValue('subscription-id-1');

      // 激活两个页面，都需要 'case' 表
      const pageId1 = await pageAwareSubscriptionManager.activatePageSubscription(
        '/cases',
        'user:123',
        'case:456'
      );

      const pageId2 = await pageAwareSubscriptionManager.activatePageSubscription(
        '/dashboard',
        'user:123',
        'case:456'
      );

      expect(pageId1).toBeDefined();
      expect(pageId2).toBeDefined();

      // 检查合并订阅信息
      const mergedSubscriptions = pageAwareSubscriptionManager.getMergedSubscriptions();
      expect(mergedSubscriptions.length).toBeGreaterThan(0);
    });
  });

  describe('统计信息', () => {
    it('应该提供订阅统计信息', async () => {
      (mockSubscriptionManager.subscribeToTable as any).mockResolvedValue('subscription-id-1');

      await pageAwareSubscriptionManager.activatePageSubscription(
        '/cases',
        'user:123',
        'case:456'
      );

      const stats = pageAwareSubscriptionManager.getSubscriptionStats();
      expect(stats).toEqual(expect.objectContaining({
        totalPages: expect.any(Number),
        activePages: expect.any(Number),
        totalSubscriptions: expect.any(Number),
        mergedSubscriptions: expect.any(Number)
      }));
    });

    it('应该提供调试信息', () => {
      const debugInfo = pageAwareSubscriptionManager.getDebugInfo();
      expect(debugInfo).toEqual(expect.objectContaining({
        pageRequirements: expect.any(Array),
        activeSubscriptions: expect.any(Array),
        mergedSubscriptions: expect.any(Array),
        stats: expect.any(Object)
      }));
    });
  });

  describe('页面访问时间更新', () => {
    it('应该更新页面访问时间', async () => {
      (mockSubscriptionManager.subscribeToTable as any).mockResolvedValue('subscription-id-1');

      const pageId = await pageAwareSubscriptionManager.activatePageSubscription(
        '/cases',
        'user:123',
        'case:456'
      );

      const statusBefore = pageAwareSubscriptionManager.getPageSubscriptionStatus(pageId);
      const lastAccessTimeBefore = statusBefore?.lastAccessTime;

      // 等待一小段时间
      await new Promise(resolve => setTimeout(resolve, 10));

      pageAwareSubscriptionManager.updatePageAccessTime(pageId);

      const statusAfter = pageAwareSubscriptionManager.getPageSubscriptionStatus(pageId);
      const lastAccessTimeAfter = statusAfter?.lastAccessTime;

      expect(lastAccessTimeAfter).toBeGreaterThan(lastAccessTimeBefore || 0);
    });
  });

  describe('预定义页面需求', () => {
    it('应该为案件列表页面提供预定义配置', async () => {
      (mockSubscriptionManager.subscribeToTable as any).mockResolvedValue('subscription-id-1');

      const pageId = await pageAwareSubscriptionManager.activatePageSubscription(
        '/cases',
        'user:123'
      );

      expect(pageId).toBeDefined();
      expect(mockSubscriptionManager.subscribeToTable).toHaveBeenCalledWith(
        'case',
        'user:123',
        undefined,
        expect.objectContaining({
          priority: 8
        })
      );
    });

    it('应该为仪表盘页面提供预定义配置', async () => {
      (mockSubscriptionManager.subscribeToTable as any).mockResolvedValue('subscription-id-1');

      const pageId = await pageAwareSubscriptionManager.activatePageSubscription(
        '/dashboard',
        'user:123'
      );

      expect(pageId).toBeDefined();
      expect(mockSubscriptionManager.subscribeToTable).toHaveBeenCalledWith(
        'case',
        'user:123',
        undefined,
        expect.objectContaining({
          priority: 8
        })
      );
    });
  });

  describe('错误处理', () => {
    it('应该处理订阅失败的情况', async () => {
      // Even if subscription fails, the activation should succeed (resilient design)
      (mockSubscriptionManager.subscribeToTable as any).mockRejectedValue(new Error('Subscription failed'));

      // Should not throw error, but should still return a page ID
      const pageId = await pageAwareSubscriptionManager.activatePageSubscription('/cases', 'user:123');
      expect(pageId).toBeDefined();
      expect(typeof pageId).toBe('string');
    });

    it('应该处理停用订阅失败的情况', async () => {
      // Even if unsubscribe fails, deactivation should succeed (resilient design)
      (mockSubscriptionManager.subscribeToTable as any).mockResolvedValue('subscription-id-1');
      (mockSubscriptionManager.unsubscribe as any).mockRejectedValue(new Error('Unsubscribe failed'));

      const pageId = await pageAwareSubscriptionManager.activatePageSubscription(
        '/cases',
        'user:123'
      );

      // Should not throw error
      await expect(
        pageAwareSubscriptionManager.deactivatePageSubscription(pageId)
      ).resolves.not.toThrow();
    });
  });
});