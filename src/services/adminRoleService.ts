import Surreal from 'surrealdb.js';
import { DB_CONFIG } from '../config'; // Assuming DB_CONFIG might be needed for namespace/db

// Helper to get DB instance. In a real app, this might come from a context or a global singleton.
// For now, direct instantiation or using Surreal.instance if available.
// Let's assume Surreal.instance is configured and ready from main app setup.
const db = Surreal.instance;

export interface SystemUser {
  id: string; // SurrealDB record ID, e.g., "user:uuid"
  name: string;
  // Add other fields if needed by UI, e.g., email
}

export interface SystemMenu {
  id: string; // SurrealDB record ID, e.g., "menu_item:uuid"
  name: string; // This should be the label_key for i18n, or actual name if not i18n'd
  parentId: string | null; // Record ID of parent menu_item
  order?: number;
  path?: string; // path from menu_item schema
  label_key?: string; // label_key from menu_item schema
  icon?: string; // icon from menu_item schema
}

export interface MenuPermission {
  id: string; // Corresponds to SystemMenu.id (menu_item record ID)
  name: string; // Corresponds to SystemMenu.name (menu_item label or name)
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

// Input for creating/updating role permissions
export interface MenuPermissionInput {
  id: string; // Menu ID (menu_item record ID)
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface Role {
  id: string; // SurrealDB record ID, e.g., "role:uuid"
  name: string;
  description: string;
  permissions: MenuPermission[]; // Populated by combining menu_item, permission, role_permission
  assignedUserIds: string[]; // Array of user record IDs
}


// --- Service Functions ---

export const getSystemUsers = async (): Promise<SystemUser[]> => {
  try {
    const users = await db.select<SystemUser>('user');
    // Ensure users have id and name, map if necessary (SurrealDB results are usually typed)
    return users.map(u => ({ id: u.id, name: u.name || 'Unnamed User' }));
  } catch (error) {
    console.error('Error fetching system users:', error);
    throw new Error('Failed to fetch system users.');
  }
};

export const getSystemMenus = async (): Promise<SystemMenu[]> => {
  try {
    // Fetch all menu items, ordered by display_order then name/label_key
    const menus = await db.query<[SystemMenu[]]>('SELECT *, meta::id as id FROM menu_item ORDER BY display_order ASC, name ASC, label_key ASC;');
    if (menus && menus[0] && menus[0].result) {
         return menus[0].result.map(m => ({
            ...m,
            id: m.id, // Ensure id is the record ID string
            parentId: m.parent_id || null, // Assuming parent_id is the field name in DB
            name: m.label_key || m.name || m.path || 'Unnamed Menu' // Prioritize label_key, then name, then path
        }));
    }
    return [];
  } catch (error) {
    console.error('Error fetching system menus:', error);
    throw new Error('Failed to fetch system menus.');
  }
};


export const getRoles = async (): Promise<Role[]> => {
  try {
    const rolesFromDb = await db.select<Omit<Role, 'permissions' | 'assignedUserIds'>>('role');
    
    const roles: Role[] = await Promise.all(
      rolesFromDb.map(async (roleData) => {
        // Fetch users assigned to this role
        // Assuming user.global_roles stores an array of role IDs (strings or records)
        // If global_roles stores record<role>, the query needs adjustment.
        // For now, assuming global_roles stores an array of role *strings* (role IDs).
        const assignedUsersQuery = `SELECT meta::id as id FROM user WHERE global_roles CONTAINS "${roleData.id}";`;
        const assignedUsersResult = await db.query<[{id: string}[]]>(assignedUsersQuery);
        const assignedUserIds = assignedUsersResult[0]?.result?.map(u => u.id) || [];

        // TODO: Implement detailed permission fetching based on menu_item, permission, role_permission
        // For now, returning empty permissions to get core functionality working.
        const permissions: MenuPermission[] = []; 
        // Placeholder: iterate over all system menus and set default false permissions
        // This is a simplified placeholder and does not reflect actual stored permissions.
        // const systemMenus = await getSystemMenus();
        // permissions = systemMenus.map(menu => ({
        //   id: menu.id,
        //   name: menu.name,
        //   canRead: false, 
        //   canCreate: false,
        //   canUpdate: false,
        //   canDelete: false,
        // }));


        return {
          ...roleData,
          id: roleData.id, // Ensure id is the record ID string
          permissions,
          assignedUserIds,
        };
      })
    );
    return roles;
  } catch (error) {
    console.error('Error fetching roles:', error);
    throw new Error('Failed to fetch roles.');
  }
};

export const getRole = async (roleId: string): Promise<Role | undefined> => {
  try {
    const roleResult = await db.select<Omit<Role, 'permissions' | 'assignedUserIds'>>(roleId);
    if (!roleResult || roleResult.length === 0) { // db.select returns an array
      return undefined;
    }
    const roleData = roleResult[0];

    const assignedUsersQuery = `SELECT meta::id as id FROM user WHERE global_roles CONTAINS "${roleData.id}";`;
    const assignedUsersResult = await db.query<[{id: string}[]]>(assignedUsersQuery);
    const assignedUserIds = assignedUsersResult[0]?.result?.map(u => u.id) || [];
    
    // TODO: Implement detailed permission fetching (same as getRoles)
    const permissions: MenuPermission[] = []; // Placeholder

    return {
      ...roleData,
      id: roleData.id,
      permissions,
      assignedUserIds,
    };
  } catch (error) {
    console.error(`Error fetching role ${roleId}:`, error);
    throw new Error(`Failed to fetch role ${roleId}.`);
  }
};

export const createRole = async (
  roleData: Omit<Role, 'id' | 'assignedUserIds'> & { permissions: MenuPermissionInput[] }
): Promise<Role> => {
  if (!roleData.name) {
    throw new Error("Role name is required.");
  }
  try {
    const { permissions: menuPermissionsInput, ...basicRoleData } = roleData;

    // Create the basic role record
    // SurrealDB's CREATE command returns an array of created records
    const createdRoleArray = await db.create<Omit<Role, 'permissions' | 'assignedUserIds'>>('role', basicRoleData);
    
    if (!createdRoleArray || createdRoleArray.length === 0) {
      throw new Error('Role creation failed, no record returned.');
    }
    const newRoleRecord = createdRoleArray[0];

    // TODO: Implement detailed permission creation based on menuPermissionsInput.
    // This involves:
    // 1. For each MenuPermissionInput, find the menu_item.
    // 2. Create corresponding 'permission' records if they don't exist (e.g., for read_menu_dashboard, create_menu_dashboard).
    // 3. Create 'role_permission' links between the newRoleRecord.id and these permission records.
    // 4. If canRead is true, create 'role_menu_item' link.
    // For now, this part is skipped. Permissions will be effectively empty.
    console.warn(`Permissions for role ${newRoleRecord.id} (${newRoleRecord.name}) are not fully implemented yet in createRole.`);


    return {
      ...newRoleRecord,
      id: newRoleRecord.id,
      permissions: [], // Placeholder, as detailed permissions are not yet saved
      assignedUserIds: [], // New roles have no users assigned initially
    };
  } catch (error) {
    console.error('Error creating role:', error);
    throw new Error('Failed to create role.');
  }
};

export const updateRole = async (
  roleId: string,
  roleData: Partial<Omit<Role, 'id' | 'assignedUserIds'> & { permissions: MenuPermissionInput[] }>
): Promise<Role> => {
  try {
    const { permissions: menuPermissionsInput, ...basicRoleUpdateData } = roleData;
    
    // Update basic role fields
    const updatedRoleArray = await db.update<Omit<Role, 'permissions' | 'assignedUserIds'>>(roleId, basicRoleUpdateData);

    if (!updatedRoleArray || updatedRoleArray.length === 0) {
      // Check if the role exists first, as update might return empty if record not found
      const existing = await db.select(roleId);
      if (!existing || existing.length === 0) throw new Error("Role not found.");
      // If it exists but update returned empty, it's an unexpected issue
      throw new Error('Role update failed, no record returned.');
    }
    const updatedRoleRecord = updatedRoleArray[0];

    // TODO: Implement detailed permission updates.
    // This involves:
    // 1. Deleting existing 'role_permission' and 'role_menu_item' links for this role.
    // 2. Creating new links based on menuPermissionsInput (similar to createRole).
    console.warn(`Permissions for role ${roleId} are not fully updated yet in updateRole.`);

    // Re-fetch assigned users as they are not part of this update operation.
    const assignedUsersQuery = `SELECT meta::id as id FROM user WHERE global_roles CONTAINS "${roleId}";`;
    const assignedUsersResult = await db.query<[{id: string}[]]>(assignedUsersQuery);
    const assignedUserIds = assignedUsersResult[0]?.result?.map(u => u.id) || [];

    return {
      ...updatedRoleRecord,
      id: updatedRoleRecord.id,
      permissions: [], // Placeholder
      assignedUserIds,
    };
  } catch (error) {
    console.error(`Error updating role ${roleId}:`, error);
    if (error instanceof Error && error.message.includes("Role not found")) {
        throw error;
    }
    throw new Error(`Failed to update role ${roleId}.`);
  }
};

export const deleteRole = async (roleId: string): Promise<void> => {
  try {
    // Check if role exists before attempting to delete and update users
    const roleExists = await db.select(roleId);
    if (!roleExists || roleExists.length === 0) {
        throw new Error("Role not found for deletion.");
    }

    // Start a transaction
    const queries = [
        // Remove the role from all users' global_roles arrays
        `UPDATE user SET global_roles = array::remove(global_roles, "${roleId}");`,
        // TODO: Delete associated role_permission records: `DELETE role_permission WHERE role_id = ${roleId};`
        // TODO: Delete associated role_menu_item records: `DELETE role_menu_item WHERE role_id = ${roleId};`
        // Delete the role itself
        `DELETE ${roleId};`
    ];
    
    // For now, only role deletion and user update are implemented without explicit transaction for simplicity
    // In a real scenario, use db.transaction or ensure all queries succeed.
    
    // Remove role from users
    // This might be slow if there are many users. Consider alternative strategies if performance is an issue.
    const usersWithRole = await db.query<[{id: string}[]]>(`SELECT meta::id as id FROM user WHERE global_roles CONTAINS "${roleId}";`);
    if (usersWithRole[0]?.result) {
        for (const user of usersWithRole[0].result) {
            // Using PATCH to modify array, simpler than constructing complex MERGE for array removal
            // This is an example, actual array removal might need `array::remove` if SurrealQL supports it directly in PATCH
            // Or fetch user, modify array, then UPDATE.
            // For now, using a specific UPDATE with array::remove for each user.
            await db.query(`UPDATE ${user.id} SET global_roles = array::remove(global_roles, "${roleId}");`);
        }
    }
    
    // Delete the role
    await db.delete(roleId);

    console.log(`Role ${roleId} deleted and unassigned from users.`);
    // TODO: Add deletion of role_permission and role_menu_item records.
    console.warn(`Deletion of associated role_permission and role_menu_item records for role ${roleId} is not yet implemented.`);

  } catch (error) {
    console.error(`Error deleting role ${roleId}:`, error);
    if (error instanceof Error && error.message.includes("Role not found for deletion")) {
        throw error;
    }
    throw new Error(`Failed to delete role ${roleId}.`);
  }
};


export const assignUsersToRole = async (roleId: string, newUserIds: string[]): Promise<void> => {
  try {
    // Check if role exists
    const roleExists = await db.select(roleId);
    if (!roleExists || roleExists.length === 0) {
        throw new Error("Role not found for user assignment.");
    }

    // Fetch all users to determine who needs to be updated
    const allUsers = await db.select<SystemUser>('user');
    
    const transactionQueries: string[] = [];

    for (const user of allUsers) {
      const userRecordId = user.id;
      // Fetch current global_roles for the user to avoid issues if it's null or undefined
      const userWithRoles = await db.select<{global_roles?: string[]}>(userRecordId);
      const currentGlobalRoles = userWithRoles[0]?.global_roles || [];

      const hasRole = currentGlobalRoles.includes(roleId);
      const shouldHaveRole = newUserIds.includes(userRecordId);

      if (hasRole && !shouldHaveRole) {
        // Remove role
        const updatedRoles = currentGlobalRoles.filter(r => r !== roleId);
        transactionQueries.push(`UPDATE ${userRecordId} SET global_roles = ${JSON.stringify(updatedRoles)};`);
      } else if (!hasRole && shouldHaveRole) {
        // Add role (ensure uniqueness, though global_roles should ideally be a set or handled with array::add_unique)
        const updatedRoles = Array.from(new Set([...currentGlobalRoles, roleId]));
        transactionQueries.push(`UPDATE ${userRecordId} SET global_roles = ${JSON.stringify(updatedRoles)};`);
      }
    }
    
    if (transactionQueries.length > 0) {
        // SurrealDB's query method can execute multiple statements separated by semicolons
        // or you can use db.transaction if your surrealdb.js version supports it well for multiple typed queries.
        // For now, join queries as a single string.
        // Note: Some versions/drivers of SurrealDB might have limitations on multi-statement queries.
        // It's safer to execute them one by one or use a transaction block if available and robust.
        // console.log("Executing transaction for user role assignment:", transactionQueries.join('\n'));
        // await db.query(transactionQueries.join('\n'));
        // Executing one by one for safety:
        for (const query of transactionQueries) {
            await db.query(query);
        }
    }
    console.log(`User assignments for role ${roleId} updated.`);

  } catch (error) {
    console.error(`Error assigning users to role ${roleId}:`, error);
    if (error instanceof Error && error.message.includes("Role not found for user assignment")) {
        throw error;
    }
    throw new Error(`Failed to assign users to role ${roleId}.`);
  }
};

// Remove mock data, SIMULATED_DELAY, and resetStateForTests
// const initialMockRoles, initialMockSystemUsers, initialMockSystemMenus, mockRoles, mockSystemUsers, mockSystemMenus
// const SIMULATED_DELAY
// export const resetStateForTests

/**
 * NOTE ON PERMISSIONS:
 * The full implementation of mapping granular `permission`, `role_permission`, 
 * and `role_menu_item` records to/from the `MenuPermission[]` and `MenuPermissionInput[]` 
 * structures is complex and requires careful planning of SurrealQL queries, especially for 
 * create/update operations to ensure atomicity or handle rollbacks.
 * 
 * For `getRoles`/`getRole`:
 * - Fetch all `menu_item` records.
 * - For each role:
 *   - Query `SELECT <-role_permission<-permission.* as p, <-role_menu_item<-menu_item.id as mid FROM $roleId;`
 *   - This would give related permissions and menu items.
 *   - Then, construct the `MenuPermission` array by iterating through all system menus and checking
 *     if corresponding permissions (e.g., read, create, update, delete for that menu resource) exist for the role.
 * 
 * For `createRole`/`updateRole` (given `MenuPermissionInput[]`):
 * - Begin transaction.
 * - For each menu item in `MenuPermissionInput[]`:
 *   - Define permission resources (e.g., `menu_dashboard_read`, `menu_dashboard_create`).
 *   - `CREATE permission CONTENT {action: 'read', resource: 'menu_dashboard'} ON DUPLICATE KEY UPDATE;` (or similar).
 *   - `RELATE $roleId->role_permission->$permissionId;`
 *   - If `canRead` is true: `RELATE $roleId->role_menu_item->$menuItemId;`
 * - Commit transaction.
 * 
 * The current implementation simplifies this by returning/saving empty permissions.
 * A dedicated follow-up task is recommended for robust permission management.
 */
