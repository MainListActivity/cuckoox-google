import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock queryWithAuth using proper vitest syntax
vi.mock("@/src/utils/surrealAuth", () => ({
  queryWithAuth: vi.fn(),
}));

import {
  loadUserMenus,
  loadUserOperations,
  hasOperation,
} from "@/src/services/menuService";
import { queryWithAuth } from "@/src/utils/surrealAuth";

// Get the mocked function
const mockQueryWithAuth = vi.mocked(queryWithAuth);

describe("MenuService (使用MockFactory)", () => {
  let mockClient: any;

  beforeEach(() => {
    // 创建简单的mock客户端
    mockClient = {
      query: vi.fn(),
      select: vi.fn(),
    };

    // 重置mock
    mockQueryWithAuth.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("loadUserMenus", () => {
    it("应该使用queryWithAuth而不是直接查询", async () => {
      // Arrange
      const mockMenuData = [
        {
          id: "menu:1",
          menu_id: "dashboard",
          path: "/dashboard",
          label_key: "dashboard",
          icon_name: "mdiViewDashboard",
          display_order: 1,
          is_active: true,
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z",
        },
        {
          id: "menu:2",
          menu_id: "cases",
          path: "/cases",
          label_key: "cases",
          icon_name: "mdiFolder",
          display_order: 2,
          is_active: true,
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z",
        },
      ];

      mockQueryWithAuth.mockResolvedValue(mockMenuData);

      // Act
      const result = await loadUserMenus(mockClient);

      // Assert
      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        "select * from menu_metadata",
        {},
      );
      expect(result).toEqual([
        {
          id: "dashboard",
          path: "/dashboard",
          labelKey: "dashboard",
          iconName: "mdiViewDashboard",
        },
        {
          id: "cases",
          path: "/cases",
          labelKey: "cases",
          iconName: "mdiFolder",
        },
      ]);
    });

    it("应该正确处理认证错误", async () => {
      // Arrange
      mockQueryWithAuth.mockRejectedValue(new Error("Authentication failed"));

      // Act
      const result = await loadUserMenus(mockClient);

      // Assert
      expect(mockQueryWithAuth).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("应该正确处理空数据响应", async () => {
      // Arrange
      mockQueryWithAuth.mockResolvedValue([]);

      // Act
      const result = await loadUserMenus(mockClient);

      // Assert
      expect(mockQueryWithAuth).toHaveBeenCalled();
      expect(result).toEqual([]);
    });

    it("应该正确处理无效数据格式", async () => {
      // Arrange
      const invalidData = [
        {
          // 缺少必要字段
          id: "menu:1",
          // menu_id: 'dashboard', // 缺少此字段
          path: "/dashboard",
        },
      ];

      mockQueryWithAuth.mockResolvedValue(invalidData);

      // Act
      const result = await loadUserMenus(mockClient);

      // Assert
      expect(result).toEqual([]);
    });

    it("应该正确过滤非活跃菜单", async () => {
      // Arrange
      const mockMenuData = [
        {
          id: "menu:1",
          menu_id: "dashboard",
          path: "/dashboard",
          label_key: "dashboard",
          icon_name: "mdiViewDashboard",
          display_order: 1,
          is_active: true,
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z",
        },
        {
          id: "menu:2",
          menu_id: "disabled_menu",
          path: "/disabled",
          label_key: "disabled",
          icon_name: "mdiBlock",
          display_order: 2,
          is_active: false, // 非活跃菜单
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z",
        },
      ];

      mockQueryWithAuth.mockResolvedValue(mockMenuData);

      // Act
      const result = await loadUserMenus(mockClient);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("dashboard");
    });
  });

  describe("loadUserOperations", () => {
    it("应该使用queryWithAuth查询操作权限", async () => {
      // Arrange
      const mockOperations = [
        {
          id: "operation:1",
          operation_id: "create_case",
          label_key: "create_case",
          menu_id: "cases",
          is_active: true,
        },
        {
          id: "operation:2",
          operation_id: "edit_case",
          label_key: "edit_case",
          menu_id: "cases",
          is_active: true,
        },
      ];

      mockQueryWithAuth.mockResolvedValue(mockOperations);

      // Act
      const result = await loadUserOperations(mockClient, "cases");

      // Assert
      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        "select * from operation_metadata where menu_id = $menu_id",
        { menu_id: "cases" },
      );
      expect(result).toEqual([
        {
          id: "operation:1",
          operation_id: "create_case",
          label_key: "create_case",
          menu_id: "cases",
          is_active: true,
        },
        {
          id: "operation:2",
          operation_id: "edit_case",
          label_key: "edit_case",
          menu_id: "cases",
          is_active: true,
        },
      ]);
    });

    it("应该正确处理无操作权限的情况", async () => {
      // Arrange
      mockQueryWithAuth.mockResolvedValue([]);

      // Act
      const result = await loadUserOperations(mockClient, "restricted_menu");

      // Assert
      expect(result).toEqual([]);
    });

    it("应该正确处理查询错误", async () => {
      // Arrange
      mockQueryWithAuth.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await loadUserOperations(mockClient, "cases");

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("hasOperation", () => {
    it("应该正确检查用户是否有指定操作权限", async () => {
      // Arrange
      const mockOperation = [
        {
          id: "operation:1",
          operation_id: "create_case",
          label_key: "create_case",
          menu_id: "cases",
          is_active: true,
        },
      ];

      mockQueryWithAuth.mockResolvedValue(mockOperation);

      // Act
      const result = await hasOperation(mockClient, "create_case");

      // Assert
      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        "select * from operation_metadata where operation_id = $operation_id",
        { operation_id: "create_case" },
      );
      expect(result).toBe(true);
    });

    it("应该处理不存在的操作", async () => {
      // Arrange
      mockQueryWithAuth.mockResolvedValue([]);

      // Act
      const result = await hasOperation(mockClient, "nonexistent_operation");

      // Assert
      expect(result).toBe(false);
    });

    it("应该正确处理查询错误", async () => {
      // Arrange
      mockQueryWithAuth.mockRejectedValue(new Error("Database error"));

      // Act
      const result = await hasOperation(mockClient, "create_case");

      // Assert
      expect(result).toBe(false);
    });

    it("应该支持案件级别的操作检查", async () => {
      // Arrange
      const mockOperation = [
        {
          id: "operation:1",
          operation_id: "case_specific_operation",
          label_key: "case_operation",
          menu_id: "cases",
          is_active: true,
        },
      ];

      mockQueryWithAuth.mockResolvedValue(mockOperation);

      // Act
      const caseId = { tb: "case", id: "test123" };
      const result = await hasOperation(
        mockClient,
        "case_specific_operation",
        caseId,
      );

      // Assert
      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        "select * from operation_metadata where operation_id = $operation_id",
        { case_id: caseId, operation_id: "case_specific_operation" },
      );
      expect(result).toBe(true);
    });
  });

  describe("性能和边界测试", () => {
    it("应该处理大量菜单数据", async () => {
      // Arrange
      const largeMenuData = Array.from({ length: 1000 }, (_, i) => ({
        id: `menu:${i}`,
        menu_id: `menu_${i}`,
        path: `/menu${i}`,
        label_key: `menu_${i}`,
        icon_name: "mdiFolder",
        display_order: i,
        is_active: true,
        created_at: "2023-01-01T00:00:00Z",
        updated_at: "2023-01-01T00:00:00Z",
      }));

      mockQueryWithAuth.mockResolvedValue(largeMenuData);

      // Act
      const start = performance.now();
      const result = await loadUserMenus(mockClient);
      const end = performance.now();

      // Assert
      expect(result).toHaveLength(1000);
      expect(end - start).toBeLessThan(100); // 应该在100ms内完成
    });

    it("应该正确处理网络超时", async () => {
      // Arrange
      mockQueryWithAuth.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Network timeout")), 10),
          ),
      );

      // Act
      const result = await loadUserMenus(mockClient);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("数据格式转换测试", () => {
    it("应该正确转换菜单数据格式", async () => {
      // Arrange
      const rawMenuData = [
        {
          id: "menu:dashboard",
          menu_id: "dashboard",
          path: "/dashboard",
          label_key: "menu.dashboard",
          icon_name: "mdiViewDashboard",
          display_order: 1,
          is_active: true,
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z",
          parent_id: null,
          description: "Dashboard menu item",
        },
      ];

      mockQueryWithAuth.mockResolvedValue(rawMenuData);

      // Act
      const result = await loadUserMenus(mockClient);

      // Assert
      expect(result[0]).toEqual({
        id: "dashboard",
        path: "/dashboard",
        labelKey: "menu.dashboard",
        iconName: "mdiViewDashboard",
      });
    });

    it("应该正确处理嵌套菜单结构", async () => {
      // Arrange
      const nestedMenuData = [
        {
          id: "menu:cases",
          menu_id: "cases",
          path: "/cases",
          label_key: "cases",
          icon_name: "mdiFolder",
          display_order: 1,
          is_active: true,
          parent_id: null,
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z",
        },
        {
          id: "menu:cases_list",
          menu_id: "cases_list",
          path: "/cases/list",
          label_key: "cases_list",
          icon_name: "mdiFormatListBulleted",
          display_order: 1,
          is_active: true,
          parent_id: "cases",
          created_at: "2023-01-01T00:00:00Z",
          updated_at: "2023-01-01T00:00:00Z",
        },
      ];

      mockQueryWithAuth.mockResolvedValue(nestedMenuData);

      // Act
      const result = await loadUserMenus(mockClient);

      // Assert
      expect(result).toHaveLength(2);
      expect(result.find((m) => m.id === "cases")).toBeDefined();
      expect(result.find((m) => m.id === "cases_list")).toBeDefined();
    });
  });
});
