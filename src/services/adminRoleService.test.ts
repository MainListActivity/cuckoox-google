import { describe, it, expect, beforeEach } from 'vitest';
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getSystemUsers,
  getSystemMenus,
  assignUsersToRole,
  resetStateForTests, // Import the reset function
  type Role,
  type MenuPermissionInput,
  type SystemUser,
  type SystemMenu,
} from './adminRoleService';

// Initial state snapshot (adjust if your initial mock data changes)
const INITIAL_ROLES_COUNT = 3;
const INITIAL_USERS_COUNT = 5;
const INITIAL_MENUS_COUNT = 12;

describe('adminRoleService', () => {
  beforeEach(() => {
    resetStateForTests(); // Reset state before each test
  });

  describe('getRoles', () => {
    it('should return initial roles', async () => {
      const roles = await getRoles();
      expect(roles).toBeInstanceOf(Array);
      expect(roles.length).toBe(INITIAL_ROLES_COUNT);
      expect(roles[0].name).toBe('超级管理员');
    });
  });

  describe('createRole', () => {
    it('should create a new role and assign an ID', async () => {
      const newRoleData = {
        name: '测试角色',
        description: '这是一个测试角色',
        permissions: [{ id: 'dashboard', canRead: true, canCreate: false, canUpdate: false, canDelete: false }] as MenuPermissionInput[],
      };
      const createdRole = await createRole(newRoleData);
      expect(createdRole).toHaveProperty('id');
      expect(createdRole.name).toBe(newRoleData.name);
      expect(createdRole.description).toBe(newRoleData.description);
      expect(createdRole.permissions.length).toBe(1);
      expect(createdRole.permissions[0].name).toBe('系统首页'); // Check if menu name is populated

      const roles = await getRoles();
      expect(roles.length).toBe(INITIAL_ROLES_COUNT + 1);
      const foundRole = roles.find(r => r.id === createdRole.id);
      expect(foundRole).toEqual(createdRole);
    });

    it('should reject if role name is missing', async () => {
      const newRoleData = {
        name: '', // Empty name
        description: '测试描述',
        permissions: [] as MenuPermissionInput[],
      };
      await expect(createRole(newRoleData)).rejects.toThrow('Role name is required.');
    });
  });

  describe('updateRole', () => {
    it('should update an existing role', async () => {
      const rolesBefore = await getRoles();
      const roleToUpdateId = rolesBefore[1].id; // '案件管理人'
      
      const updateData = {
        name: '高级案件管理人',
        description: '更新后的描述',
        permissions: [
          { id: 'dashboard', canRead: true, canCreate: true, canUpdate: true, canDelete: false },
          { id: 'case-management', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
        ] as MenuPermissionInput[],
      };

      const updatedRole = await updateRole(roleToUpdateId, updateData);
      expect(updatedRole.name).toBe(updateData.name);
      expect(updatedRole.description).toBe(updateData.description);
      expect(updatedRole.permissions.length).toBe(2);
      expect(updatedRole.permissions[1].name).toBe('案件管理');


      const roleAfterUpdate = await getRole(roleToUpdateId);
      expect(roleAfterUpdate).toBeDefined();
      expect(roleAfterUpdate?.name).toBe(updateData.name);
    });

    it('should reject if role to update is not found', async () => {
      await expect(updateRole('non-existent-id', { name: 'test' })).rejects.toThrow('Role not found.');
    });
  });

  describe('deleteRole', () => {
    it('should delete an existing role', async () => {
      const rolesBefore = await getRoles();
      const roleToDeleteId = rolesBefore[0].id;

      await deleteRole(roleToDeleteId);

      const rolesAfter = await getRoles();
      expect(rolesAfter.length).toBe(INITIAL_ROLES_COUNT - 1);
      const foundRole = rolesAfter.find(r => r.id === roleToDeleteId);
      expect(foundRole).toBeUndefined();
    });

    it('should reject if role to delete is not found', async () => {
      await expect(deleteRole('non-existent-id')).rejects.toThrow('Role not found for deletion.');
    });
  });

  describe('getSystemUsers', () => {
    it('should return system users', async () => {
      const users = await getSystemUsers();
      expect(users).toBeInstanceOf(Array);
      expect(users.length).toBe(INITIAL_USERS_COUNT);
      expect(users[0].name).toBe('张三 (Admin)');
    });
  });

  describe('getSystemMenus', () => {
    it('should return system menus', async () => {
      const menus = await getSystemMenus();
      expect(menus).toBeInstanceOf(Array);
      expect(menus.length).toBe(INITIAL_MENUS_COUNT);
      expect(menus.find(m => m.id === 'admin-roles')?.name).toBe('角色权限');
    });
  });

  describe('assignUsersToRole', () => {
    it('should assign users to a role', async () => {
      const roles = await getRoles();
      const roleToAssign = roles[1]; // '案件管理人'
      expect(roleToAssign.assignedUserIds.length).toBe(2); // Initial assignment

      const usersToAssign = ['user-1', 'user-4', 'user-5'];
      await assignUsersToRole(roleToAssign.id, usersToAssign);

      const updatedRole = await getRole(roleToAssign.id);
      expect(updatedRole).toBeDefined();
      expect(updatedRole?.assignedUserIds).toEqual(usersToAssign);
    });
    
    it('should filter out invalid user IDs during assignment', async () => {
      const roles = await getRoles();
      const roleToAssign = roles[1];
      const usersToAssign = ['user-1', 'invalid-user-id', 'user-2'];
      const validUsersToAssign = ['user-1', 'user-2']; // Expected valid users

      // Suppress console.warn for this specific test if desired, or check if it was called
      // For now, we'll just check the outcome
      const originalWarn = console.warn;
      console.warn = () => {}; // Suppress warning

      await assignUsersToRole(roleToAssign.id, usersToAssign);
      
      console.warn = originalWarn; // Restore console.warn

      const updatedRole = await getRole(roleToAssign.id);
      expect(updatedRole).toBeDefined();
      // Check that only valid users were assigned
      expect(updatedRole?.assignedUserIds).toEqual(expect.arrayContaining(validUsersToAssign));
      expect(updatedRole?.assignedUserIds.length).toEqual(validUsersToAssign.length);
    });


    it('should reject if role for user assignment is not found', async () => {
      await expect(assignUsersToRole('non-existent-role-id', ['user-1'])).rejects.toThrow('Role not found for user assignment.');
    });
  });
});
