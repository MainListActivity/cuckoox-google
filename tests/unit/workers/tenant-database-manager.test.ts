import { describe, it, expect, beforeEach, vi } from 'vitest';

// 先测试基本功能
describe('TenantDatabaseManager', () => {
  it('should be importable', async () => {
    const { TenantDatabaseManager } = await import('@/src/workers/tenant-database-manager');
    expect(TenantDatabaseManager).toBeDefined();
  });

  it('should create instance with mock manager', async () => {
    const { TenantDatabaseManager } = await import('@/src/workers/tenant-database-manager');
    
    const mockDataCacheManager = {
      localDb: {
        use: vi.fn().mockResolvedValue(undefined)
      },
      remoteDb: {
        use: vi.fn().mockResolvedValue(undefined)
      },
      isConnected: vi.fn().mockReturnValue(true)
    } as any;

    const tenantManager = new TenantDatabaseManager(mockDataCacheManager);
    expect(tenantManager).toBeDefined();
    expect(tenantManager.getCurrentTenantCode()).toBeNull();
  });

  it('should set tenant database', async () => {
    const { TenantDatabaseManager } = await import('@/src/workers/tenant-database-manager');
    
    const mockDataCacheManager = {
      localDb: {
        use: vi.fn().mockResolvedValue(undefined)
      },
      remoteDb: {
        use: vi.fn().mockResolvedValue(undefined)
      },
      isConnected: vi.fn().mockReturnValue(true)
    } as any;

    const tenantManager = new TenantDatabaseManager(mockDataCacheManager);
    
    await tenantManager.setTenantDatabase('tenant001');

    expect(mockDataCacheManager.localDb.use).toHaveBeenCalledWith({
      namespace: 'ck_go',
      database: 'tenant001'
    });
    expect(mockDataCacheManager.remoteDb.use).toHaveBeenCalledWith({
      namespace: 'ck_go',
      database: 'tenant001'
    });
    expect(tenantManager.getCurrentTenantCode()).toBe('tenant001');
  });
});