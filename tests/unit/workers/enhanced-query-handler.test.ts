/**
 * EnhancedQueryHandler 单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock SurrealDB
const mockLocalDb = {
  query: vi.fn(),
  close: vi.fn()
};

const mockDataCacheManager = {
  query: vi.fn(),
  updateAuthState: vi.fn(),
  getCacheStatus: vi.fn(() => ({ hasAuth: false }))
};

const mockBroadcast = vi.fn();

describe('EnhancedQueryHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be importable', async () => {
    // 简单的导入测试
    const { EnhancedQueryHandler } = await import('../../../src/workers/enhanced-query-handler');
    expect(EnhancedQueryHandler).toBeDefined();
  });

  it('should create instance with required dependencies', async () => {
    const { EnhancedQueryHandler } = await import('../../../src/workers/enhanced-query-handler');
    
    const handler = new EnhancedQueryHandler(
      mockLocalDb as any,
      mockDataCacheManager as any,
      mockBroadcast,
      undefined
    );
    
    expect(handler).toBeDefined();
    expect(handler.getQueryRouter).toBeDefined();
    expect(handler.getSubscriptionManager).toBeDefined();
  });

  it('should handle query failure gracefully', async () => {
    const { EnhancedQueryHandler } = await import('../../../src/workers/enhanced-query-handler');
    
    const handler = new EnhancedQueryHandler(
      mockLocalDb as any,
      mockDataCacheManager as any,
      mockBroadcast,
      undefined
    );

    const result = await handler.handleQuery('SELECT * FROM test');
    
    // 修改后的行为：没有远程数据库时应该返回空结果但标记为成功
    // 这是因为 LOCAL_FIRST 策略会回退到本地并返回空结果而不是抛出错误
    expect(result.success).toBe(true);
    expect(result.data).toEqual([]);
    expect(result.source).toBe('local');
  });
});