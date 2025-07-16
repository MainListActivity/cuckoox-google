import { describe, it, expect, vi, beforeEach } from 'vitest';
import { menuService } from '@/src/services/menuService';

// Mock dataService interface
const mockDataService = {
  queryWithAuth: vi.fn(),
  query: vi.fn(),
};

describe('MenuService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    menuService.setDataService(mockDataService);
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

      mockDataService.queryWithAuth.mockResolvedValue(mockMenuData);

      // Act
      const result = await menuService.loadUserMenus();

      // Assert
      expect(mockDataService.queryWithAuth).toHaveBeenCalledWith(
        'select * from menu_metadata',
        {}
      );
      expect(dataService.query).not.toHaveBeenCalled();
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
      mockDataService.queryWithAuth.mockRejectedValue(
        new Error('Authentication required')
      );

      // Act
      const result = await menuService.loadUserMenus();

      // Assert
      expect(mockDataService.queryWithAuth).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('loadUserOperations', () => {
    it('should use queryWithAuth for operations', async () => {
      // Arrange
      const mockOperations = [
        {
          id: 'op:1',
          operation_id: 'create_case',
          menu_id: 'cases',
          operation_name: 'Create Case',
          operation_type: 'create',
          is_active: true,
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
        },
      ];

      mockDataService.queryWithAuth.mockResolvedValue(mockOperations);

      // Act
      const result = await menuService.loadUserOperations('cases');

      // Assert
      expect(mockDataService.queryWithAuth).toHaveBeenCalledWith(
        'select * from operation_metadata where menu_id = $menu_id',
        { menu_id: 'cases' }
      );
      expect(result).toEqual(mockOperations);
    });
  });

  describe('hasOperation', () => {
    it('should use queryWithAuth for permission check', async () => {
      // Arrange
      const mockResult = [{ operation_id: 'create_case' }];
      mockDataService.queryWithAuth.mockResolvedValue(mockResult);

      // Act
      const result = await menuService.hasOperation('create_case');

      // Assert
      expect(mockDataService.queryWithAuth).toHaveBeenCalledWith(
        'select * from operation_metadata where operation_id = $operation_id',
        { operation_id: 'create_case' }
      );
      expect(result).toBe(true);
    });
  });
});