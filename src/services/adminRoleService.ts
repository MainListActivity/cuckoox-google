export interface SystemUser {
  id: string;
  name: string;
}

export interface SystemMenu {
  id: string;
  name: string;
  parentId: string | null;
  order?: number; // Optional: for ordering menu items
}

export interface MenuPermission {
  id: string; // Corresponds to systemMenu.id
  name: string; // Corresponds to systemMenu.name
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface MenuPermissionInput {
  id: string; // Menu ID
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: MenuPermission[];
  assignedUserIds: string[];
}

// --- Mock Data ---
// Store initial state for resetting
const initialMockRoles: Role[] = [
  {
    id: 'role-1',
    name: '超级管理员',
    description: '拥有所有权限',
    permissions: [
      { id: 'dashboard', name: '系统首页', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
      { id: 'case-management', name: '案件管理', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
      { id: 'creditor-management', name: '债权人管理', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
      { id: 'claim-submission', name: '债权申报', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
      { id: 'claim-review', name: '债权审核', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
      { id: 'claim-dashboard', name: '数据大屏', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
      { id: 'online-meeting', name: '在线会议', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
      { id: 'message-center', name: '消息中心', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
      { id: 'admin', name: '系统管理', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
      { id: 'admin-roles', name: '角色权限', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
      { id: 'admin-audit-status', name: '审核状态', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
      { id: 'admin-notification-rules', name: '通知规则', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
    ],
    assignedUserIds: ['user-1'],
  },
  {
    id: 'role-2',
    name: '案件管理人',
    description: '负责案件处理和部分管理',
    permissions: [
      { id: 'dashboard', name: '系统首页', canRead: true, canCreate: false, canUpdate: false, canDelete: false },
      { id: 'case-management', name: '案件管理', canRead: true, canCreate: true, canUpdate: true, canDelete: false },
      { id: 'creditor-management', name: '债权人管理', canRead: true, canCreate: true, canUpdate: true, canDelete: false },
      { id: 'claim-review', name: '债权审核', canRead: true, canCreate: true, canUpdate: true, canDelete: true },
      { id: 'online-meeting', name: '在线会议', canRead: true, canCreate: true, canUpdate: false, canDelete: false },
      { id: 'message-center', name: '消息中心', canRead: true, canCreate: false, canUpdate: false, canDelete: false },
    ],
    assignedUserIds: ['user-2', 'user-3'],
  },
  {
    id: 'role-3',
    name: '普通用户/债权人',
    description: '主要进行债权申报和查看信息',
    permissions: [
      { id: 'dashboard', name: '系统首页', canRead: true, canCreate: false, canUpdate: false, canDelete: false },
      { id: 'claim-submission', name: '债权申报', canRead: true, canCreate: true, canUpdate: true, canDelete: true }, // Can manage their own submissions
      { id: 'message-center', name: '消息中心', canRead: true, canCreate: false, canUpdate: false, canDelete: false },
    ],
    assignedUserIds: ['user-4'],
  },
];

const initialMockSystemUsers: SystemUser[] = [
  { id: 'user-1', name: '张三 (Admin)' },
  { id: 'user-2', name: '李四 (Manager)' },
  { id: 'user-3', name: '王五 (Manager Assistant)' },
  { id: 'user-4', name: '赵六 (Creditor)' },
  { id: 'user-5', name: '钱七 (User)' },
];

const initialMockSystemMenus: SystemMenu[] = [
  { id: 'dashboard', name: '系统首页', parentId: null, order: 1 },
  { id: 'case-management', name: '案件管理', parentId: null, order: 2 },
  { id: 'creditor-management', name: '债权人管理', parentId: null, order: 3 },
  { id: 'claim-submission', name: '债权申报', parentId: null, order: 4 }, // Creditor facing
  { id: 'claim-review', name: '债权审核', parentId: null, order: 5 }, // Admin/Manager facing
  { id: 'claim-dashboard', name: '数据大屏', parentId: null, order: 6 },
  { id: 'online-meeting', name: '在线会议', parentId: null, order: 7 },
  { id: 'message-center', name: '消息中心', parentId: null, order: 8 },
  { id: 'admin', name: '系统管理', parentId: null, order: 9 },
  { id: 'admin-roles', name: '角色权限', parentId: 'admin', order: 1 },
  { id: 'admin-audit-status', name: '审核状态', parentId: 'admin', order: 2 },
  { id: 'admin-notification-rules', name: '通知规则', parentId: 'admin', order: 3 },
];

let mockRoles: Role[] = JSON.parse(JSON.stringify(initialMockRoles));
let mockSystemUsers: SystemUser[] = JSON.parse(JSON.stringify(initialMockSystemUsers));
let mockSystemMenus: SystemMenu[] = JSON.parse(JSON.stringify(initialMockSystemMenus));


const SIMULATED_DELAY = 0; // Use 0 for tests, or pass as arg if needed for specific timing tests

// --- Test Utilities ---
/**
 * Resets the mock data to its initial state.
 * IMPORTANT: This function should only be used in test environments.
 */
export const resetStateForTests = () => {
  mockRoles = JSON.parse(JSON.stringify(initialMockRoles));
  mockSystemUsers = JSON.parse(JSON.stringify(initialMockSystemUsers));
  mockSystemMenus = JSON.parse(JSON.stringify(initialMockSystemMenus));
  console.log('adminRoleService state has been reset for tests.');
};

// --- Service Functions ---

export const getRoles = (): Promise<Role[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(JSON.parse(JSON.stringify(mockRoles))); // Deep copy
    }, SIMULATED_DELAY);
  });
};

export const getRole = (roleId: string): Promise<Role | undefined> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const role = mockRoles.find(r => r.id === roleId);
      resolve(role ? JSON.parse(JSON.stringify(role)) : undefined);
    }, SIMULATED_DELAY);
  });
};

export const createRole = (
  roleData: Omit<Role, 'id' | 'assignedUserIds'> & { permissions: MenuPermissionInput[] }
): Promise<Role> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!roleData.name) {
        reject(new Error("Role name is required."));
        return;
      }
      const newRole: Role = {
        ...roleData,
        id: `role-${Date.now()}`,
        assignedUserIds: [], // New roles initially have no users assigned
        permissions: roleData.permissions.map(pInput => {
          const menu = mockSystemMenus.find(m => m.id === pInput.id);
          return { ...pInput, name: menu?.name || 'Unknown Menu' };
        }),
      };
      mockRoles.push(newRole);
      resolve(JSON.parse(JSON.stringify(newRole)));
    }, SIMULATED_DELAY);
  });
};

export const updateRole = (
  roleId: string,
  roleData: Partial<Omit<Role, 'id' | 'assignedUserIds'> & { permissions: MenuPermissionInput[] }>
): Promise<Role> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const roleIndex = mockRoles.findIndex(r => r.id === roleId);
      if (roleIndex === -1) {
        reject(new Error("Role not found."));
        return;
      }
      const existingRole = mockRoles[roleIndex];
      const updatedRole = { ...existingRole, ...roleData };

      if (roleData.permissions) {
        updatedRole.permissions = roleData.permissions.map(pInput => {
          const menu = mockSystemMenus.find(m => m.id === pInput.id);
          return { ...pInput, name: menu?.name || 'Unknown Menu' };
        });
      }
      
      mockRoles[roleIndex] = updatedRole;
      resolve(JSON.parse(JSON.stringify(updatedRole)));
    }, SIMULATED_DELAY);
  });
};

export const deleteRole = (roleId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const initialLength = mockRoles.length;
      mockRoles = mockRoles.filter(r => r.id !== roleId);
      if (mockRoles.length === initialLength) {
        reject(new Error("Role not found for deletion."));
        return;
      }
      resolve();
    }, SIMULATED_DELAY);
  });
};

export const getSystemUsers = (): Promise<SystemUser[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(JSON.parse(JSON.stringify(mockSystemUsers)));
    }, SIMULATED_DELAY);
  });
};

export const getSystemMenus = (): Promise<SystemMenu[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(JSON.parse(JSON.stringify(mockSystemMenus)));
    }, SIMULATED_DELAY);
  });
};

export const assignUsersToRole = (roleId: string, userIds: string[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const role = mockRoles.find(r => r.id === roleId);
      if (!role) {
        reject(new Error("Role not found for user assignment."));
        return;
      }
      // Validate userIds
      const validUserIds = userIds.filter(uid => mockSystemUsers.some(u => u.id === uid));
      if (validUserIds.length !== userIds.length) {
        console.warn("Some user IDs were invalid and ignored during assignment.");
      }
      role.assignedUserIds = validUserIds;
      resolve();
    }, SIMULATED_DELAY);
  });
};
