import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecordId } from 'surrealdb';
import type { Role } from '@/src/services/roleService';

// 直接导入函数而不是整个模块来避免副作用
const { getAllRoles, getRoleById, getRoleByName, getCaseMemberRoles } = await import('@/src/services/roleService');

// Mock queryWithAuth
const mockQueryWithAuth = vi.fn();
vi.mock('@/src/utils/surrealAuth', () => ({
  queryWithAuth: mockQueryWithAuth
}));

// Mock SurrealWorkerAPI
const mockClient = {} as any;

// Test data
const mockRoles: Role[] = [
  {
    id: new RecordId('role', 'judge'),
    name: 'judge',
    description: '审判员',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z'
  },
  {
    id: new RecordId('role', 'clerk'),
    name: 'clerk', 
    description: '书记员',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z'
  }
];

describe('RoleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAllRoles', () => {
    it('应该使用queryWithAuth查询所有角色', async () => {
      mockQueryWithAuth.mockResolvedValue(mockRoles);

      const result = await getAllRoles(mockClient);

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        'SELECT * FROM role ORDER BY name'
      );
      expect(result).toEqual(mockRoles);
    });

    it('当没有角色时应该返回空数组', async () => {
      mockQueryWithAuth.mockResolvedValue([]);

      const result = await getAllRoles(mockClient);

      expect(result).toEqual([]);
    });

    it('当查询失败时应该抛出错误', async () => {
      mockQueryWithAuth.mockRejectedValue(new Error('Database error'));

      await expect(getAllRoles(mockClient)).rejects.toThrow('获取角色列表失败');
    });
  });

  describe('getRoleById', () => {
    it('应该使用queryWithAuth根据ID查询角色', async () => {
      const roleId = new RecordId('role', 'judge');
      mockQueryWithAuth.mockResolvedValue([mockRoles[0]]);

      const result = await getRoleById(mockClient, roleId);

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        'SELECT * FROM $roleId LIMIT 1',
        { roleId }
      );
      expect(result).toEqual(mockRoles[0]);
    });

    it('当角色不存在时应该返回null', async () => {
      const roleId = new RecordId('role', 'nonexistent');
      mockQueryWithAuth.mockResolvedValue([]);

      const result = await getRoleById(mockClient, roleId);

      expect(result).toBeNull();
    });
  });

  describe('getRoleByName', () => {
    it('应该使用queryWithAuth根据名称查询角色', async () => {
      mockQueryWithAuth.mockResolvedValue([mockRoles[0]]);

      const result = await getRoleByName(mockClient, 'judge');

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        'SELECT * FROM role WHERE name = $roleName LIMIT 1',
        { roleName: 'judge' }
      );
      expect(result).toEqual(mockRoles[0]);
    });

    it('当角色不存在时应该返回null', async () => {
      mockQueryWithAuth.mockResolvedValue([]);

      const result = await getRoleByName(mockClient, 'nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getCaseMemberRoles', () => {
    it('应该使用queryWithAuth查询案件成员角色', async () => {
      mockQueryWithAuth.mockResolvedValue(mockRoles);

      const result = await getCaseMemberRoles(mockClient);

      expect(mockQueryWithAuth).toHaveBeenCalledWith(
        mockClient,
        expect.stringContaining("WHERE name != 'admin'")
      );
      expect(result).toEqual(mockRoles);
    });

    it('当没有案件成员角色时应该返回空数组', async () => {
      mockQueryWithAuth.mockResolvedValue([]);

      const result = await getCaseMemberRoles(mockClient);

      expect(result).toEqual([]);
    });
  });
});
