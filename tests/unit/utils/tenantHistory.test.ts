import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import TenantHistoryManager from '@/src/utils/tenantHistory';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

// @ts-expect-error - Mock localStorage for testing
global.localStorage = localStorageMock;

describe('TenantHistoryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.resetModules();
    localStorageMock.clear();
  });

  describe('getTenantHistory', () => {
    it('should return empty array when no history exists', () => {
      localStorageMock.getItem.mockReturnValue(null);
      const result = TenantHistoryManager.getTenantHistory();
      expect(result).toEqual([]);
    });

    it('should return parsed history sorted by lastUsed', () => {
      const mockHistory = [
        { code: 'TENANT1', lastUsed: 1000 },
        { code: 'TENANT2', lastUsed: 2000 },
        { code: 'TENANT3', lastUsed: 1500 },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory));
      
      const result = TenantHistoryManager.getTenantHistory();
      expect(result).toEqual([
        { code: 'TENANT2', lastUsed: 2000 },
        { code: 'TENANT3', lastUsed: 1500 },
        { code: 'TENANT1', lastUsed: 1000 },
      ]);
    });

    it('should handle invalid JSON gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json');
      const result = TenantHistoryManager.getTenantHistory();
      expect(result).toEqual([]);
    });
  });

  describe('addTenantToHistory', () => {
    it('should add new tenant to history', () => {
      localStorageMock.getItem.mockReturnValue(null);
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);

      TenantHistoryManager.addTenantToHistory('TENANT1', 'Test Tenant');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tenant_history',
        JSON.stringify([{
          code: 'TENANT1',
          name: 'Test Tenant',
          lastUsed: mockNow,
        }])
      );
    });

    it('should update existing tenant in history', () => {
      const existingHistory = [
        { code: 'TENANT1', name: 'Old Name', lastUsed: 1000 },
        { code: 'TENANT2', lastUsed: 2000 },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingHistory));
      
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);

      TenantHistoryManager.addTenantToHistory('TENANT1', 'New Name');

      // 检查调用是否正确，顺序由于内部排序可能不同
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tenant_history',
        expect.any(String)
      );
      
      // 验证保存的数据内容
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData).toContainEqual({ code: 'TENANT1', name: 'New Name', lastUsed: mockNow });
      expect(savedData).toContainEqual({ code: 'TENANT2', lastUsed: 2000 });
    });

    it('should limit history to maximum entries', () => {
      // Create 11 entries (one more than the limit)
      const existingHistory = Array.from({ length: 11 }, (_, i) => ({
        code: `TENANT${i}`,
        lastUsed: i * 1000,
      }));
      localStorageMock.getItem.mockReturnValue(JSON.stringify(existingHistory));
      
      const mockNow = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);

      TenantHistoryManager.addTenantToHistory('NEWTENANT');

      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData).toHaveLength(10); // Should be limited to 10 entries
      expect(savedData[0].code).toBe('NEWTENANT'); // New tenant should be first
    });
  });

  describe('getLastUsedTenant', () => {
    it('should return null when no history exists', () => {
      localStorageMock.getItem.mockReturnValue(null);
      const result = TenantHistoryManager.getLastUsedTenant();
      expect(result).toBeNull();
    });

    it('should return the most recently used tenant', () => {
      const mockHistory = [
        { code: 'TENANT1', lastUsed: 1000 },
        { code: 'TENANT2', lastUsed: 2000 },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory));
      
      const result = TenantHistoryManager.getLastUsedTenant();
      expect(result).toBe('TENANT2');
    });
  });

  describe('removeTenantFromHistory', () => {
    it('should remove specified tenant from history', () => {
      const mockHistory = [
        { code: 'TENANT1', lastUsed: 1000 },
        { code: 'TENANT2', lastUsed: 2000 },
        { code: 'TENANT3', lastUsed: 1500 },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory));

      TenantHistoryManager.removeTenantFromHistory('TENANT2');

      // 检查调用是否正确，顺序由于内部排序可能不同
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'tenant_history',
        expect.any(String)
      );
      
      // 验证保存的数据内容
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
      expect(savedData).toContainEqual({ code: 'TENANT1', lastUsed: 1000 });
      expect(savedData).toContainEqual({ code: 'TENANT3', lastUsed: 1500 });
      expect(savedData).toHaveLength(2);
    });
  });

  describe('clearTenantHistory', () => {
    it('should clear all tenant history', () => {
      TenantHistoryManager.clearTenantHistory();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith('tenant_history');
    });
  });

  describe('searchTenantHistory', () => {
    it('should return all history when query is empty', () => {
      const mockHistory = [
        { code: 'TENANT1', lastUsed: 1000 },
        { code: 'TENANT2', lastUsed: 2000 },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory));

      const result = TenantHistoryManager.searchTenantHistory('');
      // 结果会被排序，所以检查内容而不是顺序
      expect(result).toContainEqual({ code: 'TENANT1', lastUsed: 1000 });
      expect(result).toContainEqual({ code: 'TENANT2', lastUsed: 2000 });
      expect(result).toHaveLength(2);
    });

    it('should filter history by code', () => {
      const mockHistory = [
        { code: 'TENANT1', lastUsed: 1000 },
        { code: 'TENANT2', lastUsed: 2000 },
        { code: 'COMPANY1', lastUsed: 1500 },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory));

      const result = TenantHistoryManager.searchTenantHistory('TENANT');
      // 结果会被排序，所以检查内容而不是顺序
      expect(result).toContainEqual({ code: 'TENANT1', lastUsed: 1000 });
      expect(result).toContainEqual({ code: 'TENANT2', lastUsed: 2000 });
      expect(result).toHaveLength(2);
    });

    it('should filter history by name', () => {
      const mockHistory = [
        { code: 'TENANT1', name: 'Test Company', lastUsed: 1000 },
        { code: 'TENANT2', name: 'Another Org', lastUsed: 2000 },
      ];
      localStorageMock.getItem.mockReturnValue(JSON.stringify(mockHistory));

      const result = TenantHistoryManager.searchTenantHistory('Company');
      expect(result).toEqual([
        { code: 'TENANT1', name: 'Test Company', lastUsed: 1000 },
      ]);
    });
  });
});