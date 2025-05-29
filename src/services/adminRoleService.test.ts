import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Surreal from 'surrealdb.js';
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getSystemUsers,
  getSystemMenus,
  assignUsersToRole,
  type Role,
  type MenuPermissionInput,
  type SystemUser,
  type SystemMenu,
} from './adminRoleService';

// Mock SurrealDB instance
const mockDbInstance = {
  select: vi.fn(),
  query: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  merge: vi.fn(),
  relate: vi.fn(), // Added if needed for permissions later
};

// Spy on the static getter 'instance' of the Surreal class
// and make it return our mockDbInstance
vi.spyOn(Surreal, 'instance', 'get').mockReturnValue(mockDbInstance);


describe('adminRoleService', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();

    // Default mock implementations (can be overridden in specific tests)
    mockDbInstance.select.mockResolvedValue([]);
    mockDbInstance.query.mockResolvedValue([[]]); // Default for queries returning array of results
    mockDbInstance.create.mockResolvedValue([]);
    mockDbInstance.update.mockResolvedValue([]);
    mockDbInstance.delete.mockResolvedValue([]);
    mockDbInstance.merge.mockResolvedValue([]);
  });

  afterEach(() => {
    // Clear all mocks after each test to ensure isolation
    vi.clearAllMocks();
  });

  describe('getSystemUsers', () => {
    it('should return system users from DB', async () => {
      const mockUsersFromDb = [
        { id: 'user:1', name: 'Admin User' },
        { id: 'user:2', name: 'Normal User' },
      ];
      mockDbInstance.select.mockResolvedValueOnce(mockUsersFromDb);

      const users = await getSystemUsers();

      expect(mockDbInstance.select).toHaveBeenCalledWith('user');
      expect(users).toEqual(mockUsersFromDb.map(u => ({ id: u.id, name: u.name || 'Unnamed User' })));
      expect(users.length).toBe(2);
    });

    it('should throw an error if DB call fails for getSystemUsers', async () => {
      mockDbInstance.select.mockRejectedValueOnce(new Error('DB error'));
      await expect(getSystemUsers()).rejects.toThrow('Failed to fetch system users.');
    });
  });

  describe('getSystemMenus', () => {
    it('should return system menus from DB, transforming parent_id and name', async () => {
      const mockMenusFromDb = [
        { id: 'menu_item:1', name: 'Dashboard Menu', label_key: 'dashboard.menu', parent_id: null, order: 1, path: '/dashboard' },
        { id: 'menu_item:2', name: 'Cases Menu', label_key: 'cases.menu', parent_id: 'menu_item:1', order: 2, path: '/cases' },
      ];
      // Surreal.query returns [{ result: [...] }]
      mockDbInstance.query.mockResolvedValueOnce([{ result: mockMenusFromDb }]);

      const menus = await getSystemMenus();

      expect(mockDbInstance.query).toHaveBeenCalledWith('SELECT *, meta::id as id FROM menu_item ORDER BY display_order ASC, name ASC, label_key ASC;');
      expect(menus).toEqual([
        { id: 'menu_item:1', name: 'dashboard.menu', parentId: null, order: 1, path: '/dashboard', label_key: 'dashboard.menu', icon: undefined },
        { id: 'menu_item:2', name: 'cases.menu', parentId: 'menu_item:1', order: 2, path: '/cases', label_key: 'cases.menu', icon: undefined },
      ]);
    });
     it('should prioritize label_key then name then path for menu name', async () => {
      const mockMenus = [
        { id: 'menu_item:1', label_key: 'key1', name: 'name1', path: 'path1', parent_id: null },
        { id: 'menu_item:2', name: 'name2', path: 'path2', parent_id: null }, // No label_key
        { id: 'menu_item:3', path: 'path3', parent_id: null }, // No label_key or name
        { id: 'menu_item:4', parent_id: null }, // None of them
      ];
      mockDbInstance.query.mockResolvedValueOnce([{ result: mockMenus }]);
      const menus = await getSystemMenus();
      expect(menus[0].name).toBe('key1');
      expect(menus[1].name).toBe('name2');
      expect(menus[2].name).toBe('path3');
      expect(menus[3].name).toBe('Unnamed Menu');
    });
  });

  describe('getRoles', () => {
    it('should fetch roles, their assigned users, and placeholder permissions', async () => {
      const mockRoleRecords = [
        { id: 'role:admin', name: 'Admin Role', description: 'Superuser' },
        { id: 'role:manager', name: 'Manager Role', description: 'Manages cases' },
      ];
      mockDbInstance.select.mockResolvedValueOnce(mockRoleRecords); // For db.select('role')

      // Mock for assigned users query for 'role:admin'
      mockDbInstance.query.mockResolvedValueOnceOnce([{ result: [{ id: 'user:1' }, { id: 'user:2' }] }]);
      // Mock for assigned users query for 'role:manager'
      mockDbInstance.query.mockResolvedValueOnceOnce([{ result: [{ id: 'user:3' }] }]);

      // (Simplified permissions: not mocking menu/permission table calls yet as service returns [])

      const roles = await getRoles();

      expect(mockDbInstance.select).toHaveBeenCalledWith('role');
      expect(mockDbInstance.query).toHaveBeenCalledWith(`SELECT meta::id as id FROM user WHERE global_roles CONTAINS "role:admin";`);
      expect(mockDbInstance.query).toHaveBeenCalledWith(`SELECT meta::id as id FROM user WHERE global_roles CONTAINS "role:manager";`);
      
      expect(roles.length).toBe(2);
      expect(roles[0]).toEqual({
        id: 'role:admin',
        name: 'Admin Role',
        description: 'Superuser',
        permissions: [], // Placeholder as per service logic
        assignedUserIds: ['user:1', 'user:2'],
      });
      expect(roles[1].assignedUserIds).toEqual(['user:3']);
    });
  });

  describe('getRole', () => {
    it('should fetch a single role, its assigned users, and placeholder permissions', async () => {
        const mockRoleRecord = { id: 'role:editor', name: 'Editor Role', description: 'Edits content' };
        mockDbInstance.select.mockResolvedValueOnce([mockRoleRecord]); // For db.select(roleId)

        mockDbInstance.query.mockResolvedValueOnce([{ result: [{ id: 'user:4' }] }]); // For assigned users

        const role = await getRole('role:editor');

        expect(mockDbInstance.select).toHaveBeenCalledWith('role:editor');
        expect(mockDbInstance.query).toHaveBeenCalledWith(`SELECT meta::id as id FROM user WHERE global_roles CONTAINS "role:editor";`);
        
        expect(role).toBeDefined();
        expect(role).toEqual({
            ...mockRoleRecord,
            permissions: [], // Placeholder
            assignedUserIds: ['user:4'],
        });
    });

    it('should return undefined if role not found', async () => {
        mockDbInstance.select.mockResolvedValueOnce([]); // Role not found
        const role = await getRole('role:nonexistent');
        expect(role).toBeUndefined();
    });
  });

  describe('createRole', () => {
    it('should create a new role and return it with empty permissions/users', async () => {
      const newRoleData = {
        name: 'Newbie Role',
        description: 'Limited access',
        permissions: [] as MenuPermissionInput[], // Input permissions (not yet processed by service)
      };
      const createdDbRecord = { ...newRoleData, id: 'role:newbie123' };
      mockDbInstance.create.mockResolvedValueOnce([createdDbRecord]); // For db.create('role', ...)

      // Mock console.warn for permission implementation note
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const role = await createRole(newRoleData);

      expect(mockDbInstance.create).toHaveBeenCalledWith('role', { name: 'Newbie Role', description: 'Limited access' });
      expect(role).toEqual({
        ...createdDbRecord,
        permissions: [], // Placeholder as per service logic
        assignedUserIds: [],
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Permissions for role role:newbie123 (Newbie Role) are not fully implemented yet in createRole.'));
      consoleWarnSpy.mockRestore();
    });

    it('should throw error if role name is missing', async () => {
      await expect(createRole({ name: '', description: '', permissions: [] })).rejects.toThrow('Role name is required.');
    });
  });

  describe('updateRole', () => {
    it('should update an existing role and return it with re-fetched users', async () => {
      const roleId = 'role:updater';
      const updatePayload = { name: 'Updated Role Name', description: 'New desc' };
      const dbUpdatedRecord = { id: roleId, ...updatePayload };

      mockDbInstance.update.mockResolvedValueOnce([dbUpdatedRecord]); // For db.update(roleId, ...)
      mockDbInstance.query.mockResolvedValueOnce([{ result: [{ id: 'user:5' }] }]); // For assigned users query

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const role = await updateRole(roleId, updatePayload);

      expect(mockDbInstance.update).toHaveBeenCalledWith(roleId, { name: 'Updated Role Name', description: 'New desc' });
      expect(mockDbInstance.query).toHaveBeenCalledWith(`SELECT meta::id as id FROM user WHERE global_roles CONTAINS "${roleId}";`);
      expect(role).toEqual({
        ...dbUpdatedRecord,
        permissions: [], // Placeholder
        assignedUserIds: ['user:5'],
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Permissions for role ${roleId} are not fully updated yet in updateRole.`));
      consoleWarnSpy.mockRestore();
    });
    
    it('should throw Role not found if update target does not exist', async () => {
      mockDbInstance.update.mockResolvedValueOnce([]); // Simulate record not found by update
      mockDbInstance.select.mockResolvedValueOnce([]); // Simulate record not found by select check
      await expect(updateRole('role:ghost', { name: 'Ghost' })).rejects.toThrow('Role not found.');
    });
  });

  describe('deleteRole', () => {
    it('should delete a role and attempt to update users', async () => {
      const roleId = 'role:toBeDeleted';
      mockDbInstance.select.mockResolvedValueOnce([{ id: roleId, name: 'ToDelete' }]); // Role exists
      mockDbInstance.query
        .mockResolvedValueOnceOnce([{ result: [{ id: 'user:abc' }, { id: 'user:def' }] }]) // Users having the role
        .mockResolvedValueOnceOnce(undefined) // For user:abc update global_roles
        .mockResolvedValueOnceOnce(undefined); // For user:def update global_roles
      mockDbInstance.delete.mockResolvedValueOnce([{ id: roleId }]); // Role deleted

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      await deleteRole(roleId);

      expect(mockDbInstance.select).toHaveBeenCalledWith(roleId);
      expect(mockDbInstance.query).toHaveBeenCalledWith(`SELECT meta::id as id FROM user WHERE global_roles CONTAINS "${roleId}";`);
      expect(mockDbInstance.query).toHaveBeenCalledWith(`UPDATE user:abc SET global_roles = array::remove(global_roles, "${roleId}");`);
      expect(mockDbInstance.query).toHaveBeenCalledWith(`UPDATE user:def SET global_roles = array::remove(global_roles, "${roleId}");`);
      expect(mockDbInstance.delete).toHaveBeenCalledWith(roleId);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining(`Deletion of associated role_permission and role_menu_item records for role ${roleId} is not yet implemented.`));
      consoleWarnSpy.mockRestore();
    });
    
    it('should throw Role not found if role to delete does not exist', async () => {
      mockDbInstance.select.mockResolvedValueOnce([]); // Role does not exist
      await expect(deleteRole('role:ghost')).rejects.toThrow('Role not found for deletion.');
    });
  });

  describe('assignUsersToRole', () => {
    const roleId = 'role:assignTest';
    const mockAllUsers = [
        { id: 'user:1', name: 'User One', global_roles: [] },
        { id: 'user:2', name: 'User Two', global_roles: [roleId] }, // Initially has the role
        { id: 'user:3', name: 'User Three', global_roles: ['role:other'] },
    ];

    beforeEach(() => {
        mockDbInstance.select
            .mockResolvedValueOnce([{ id: roleId, name: 'Test Role' }]) // Role exists check
            .mockResolvedValueOnce(mockAllUsers) // Fetch all users
            .mockImplementation(async (recordId: string) => { // For individual user select
                const user = mockAllUsers.find(u => u.id === recordId);
                return user ? [user] : [];
            });
        mockDbInstance.query.mockResolvedValue(undefined); // For user updates
    });

    it('should assign and unassign users correctly', async () => {
        const newUserIds = ['user:1', 'user:3']; // User1 gets role, User2 loses role, User3 gets role

        await assignUsersToRole(roleId, newUserIds);

        // User1 (add role)
        expect(mockDbInstance.query).toHaveBeenCalledWith(expect.stringContaining(`UPDATE user:1 SET global_roles = ["${roleId}"];`));
        // User2 (remove role)
        expect(mockDbInstance.query).toHaveBeenCalledWith(expect.stringContaining(`UPDATE user:2 SET global_roles = [];`));
        // User3 (add role)
        expect(mockDbInstance.query).toHaveBeenCalledWith(expect.stringContaining(`UPDATE user:3 SET global_roles = ["role:other","${roleId}"];`));
        
        // Verify total update calls
        expect(mockDbInstance.query).toHaveBeenCalledTimes(3); // 3 users changed
    });

    it('should handle empty newUserIds (unassign all)', async () => {
        await assignUsersToRole(roleId, []);
        // User2 (remove role)
        expect(mockDbInstance.query).toHaveBeenCalledWith(expect.stringContaining(`UPDATE user:2 SET global_roles = [];`));
        expect(mockDbInstance.query).toHaveBeenCalledTimes(1); // Only User2 needs update
    });
    
    it('should throw "Role not found" if role does not exist', async () => {
      mockDbInstance.select.mockReset(); // Clear previous beforeEach mocks for select
      mockDbInstance.select.mockResolvedValueOnce([]); // Role does not exist
      await expect(assignUsersToRole('role:ghost', ['user:1'])).rejects.toThrow('Role not found for user assignment.');
    });
  });
});
