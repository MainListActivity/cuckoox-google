import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadUserMenus, loadUserOperations, hasOperation } from '@/src/services/menuService';

// Mock queryWithAuth
vi.mock('@/src/utils/surrealAuth', () => ({
  queryWithAuth: vi.fn()
}));

import { queryWithAuth } from '@/src/utils/surrealAuth';
const mockQueryWithAuth = vi.mocked(queryWithAuth);

// Mock surrealClient
const mockClient = {
  query: vi.fn(),
} as any;

describe('MenuService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loadUserMenus', () => {
    it('should use queryWithAuth instead of query', async () => {
      // Arrange
      const mockMenuData = [
        {
          id: 'menu:1',
          menu_id: 'dashboard',
          path: '/dashboard',
          label_key: 'dashboard',
          icon_name: 'mdiViewDashboard',
          display_order: 1,
          is_active: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      mockQueryWithAuth.mockResolvedValue(mockMenuData);

      // Act
      const result = await loadUserMenus(mockClient);

      // Assert
      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        'select * from menu_metadata',
        {}
      );
      expect(result).toEqual([
        {
          id: 'dashboard',
          path: '/dashboard',
          labelKey: 'dashboard',
          iconName: 'mdiViewDashboard',
        },
      ]);
    });

    it('should handle authentication errors gracefully', async () => {
      // Arrange
      mockQueryWithAuth.mockRejectedValue(new Error('Authentication failed'));

      // Act
      const result = await loadUserMenus(mockClient);

      // Assert
      expect(mockQueryWithAuth).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('loadUserOperations', () => {
    it('should use queryWithAuth for operations', async () => {
      // Arrange
      const mockOperations = [
        {
          id: 'operation:1',
          operation_id: 'create_case',
          label_key: 'create_case',
          menu_id: 'cases',
        },
      ];

      mockQueryWithAuth.mockResolvedValue(mockOperations);

      // Act
      const result = await loadUserOperations(mockClient, 'cases');

      // Assert
      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        'select * from operation_metadata where menu_id = $menu_id',
        { menu_id: 'cases' }
      );
      expect(result).toEqual([
        {
          id: 'operation:1',
          operation_id: 'create_case',
          label_key: 'create_case',
          menu_id: 'cases',
        },
      ]);
    });
  });

  describe('hasOperation', () => {
    it('should use queryWithAuth for permission check', async () => {
      // Arrange
      const mockOperation = [
        {
          id: 'operation:1',
          operation_id: 'create_case',
        },
      ];

      mockQueryWithAuth.mockResolvedValue(mockOperation);

      // Act
      const result = await hasOperation(mockClient, 'create_case');

      // Assert
      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        'select * from operation_metadata where operation_id = $operation_id',
        { operation_id: 'create_case' }
      );
      expect(result).toBe(true);
    });
  });
});
