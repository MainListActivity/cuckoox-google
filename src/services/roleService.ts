import type { SurrealLike } from '@/src/types/db';
import { RecordId } from 'surrealdb';

export interface Role {
  id: RecordId;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

/**
 * 获取所有可用角色
 */
export const getAllRoles = async (client: SurrealLike): Promise<Role[]> => {
  console.log('[RoleService] Fetching all roles from database');
  
  try {
    const result = await (client as any).query<Role[]>('SELECT * FROM role ORDER BY name');
    
    if (!Array.isArray(result) || result.length === 0) {
      console.warn('[RoleService] No roles found in database');
      return [];
    }
    
    const roles: Role[] = result;
    console.log(`[RoleService] Found ${roles.length} roles:`, roles.map(r => r.name));
    
    return roles;
  } catch (error) {
    console.error('[RoleService] Error fetching roles:', error);
    throw new Error('获取角色列表失败');
  }
};

/**
 * 根据ID获取单个角色
 */
export const getRoleById = async (client: SurrealLike, roleId: RecordId): Promise<Role | null> => {
  console.log(`[RoleService] Fetching role by ID: ${roleId}`);
  
  try {
    const result = await (client as any).select(roleId);
    
    if (!result) {
      console.warn(`[RoleService] Role not found: ${roleId}`);
      return null;
    }
    
    console.log(`[RoleService] Found role:`, result.name);
    return result;
  } catch (error) {
    console.error(`[RoleService] Error fetching role ${roleId}:`, error);
    throw new Error('获取角色信息失败');
  }
};

/**
 * 根据名称获取角色
 */
export const getRoleByName = async (client: SurrealLike, roleName: string): Promise<Role | null> => {
  console.log(`[RoleService] Fetching role by name: ${roleName}`);
  
  try {
    const result = await (client as any).query<Role[]>('SELECT * FROM role WHERE name = $roleName LIMIT 1', {
      roleName
    });
    
    if (!Array.isArray(result) || result.length === 0) {
      console.warn(`[RoleService] Role not found: ${roleName}`);
      return null;
    }
    
    const role: Role = result[0];
    console.log(`[RoleService] Found role:`, role.name);
    return role;
  } catch (error) {
    console.error(`[RoleService] Error fetching role ${roleName}:`, error);
    throw new Error('获取角色信息失败');
  }
};

/**
 * 获取适合案件成员的角色列表
 * 过滤掉一些不适合作为案件成员的角色（如admin）
 */
export const getCaseMemberRoles = async (client: SurrealLike): Promise<Role[]> => {
  console.log('[RoleService] Fetching case member roles from database');
  
  try {
    // 获取适合案件成员的角色，排除系统管理员角色
    const result = await (client as any).query<Role[]>(
      `
      SELECT * FROM role 
      WHERE name != 'admin' 
      ORDER BY name
    `
    );
    
    if (!Array.isArray(result) || result.length === 0) {
      console.warn('[RoleService] No case member roles found in database');
      return [];
    }
    
    const roles: Role[] = result;
    console.log(`[RoleService] Found ${roles.length} case member roles:`, roles.map(r => r.name));
    
    return roles;
  } catch (error) {
    console.error('[RoleService] Error fetching case member roles:', error);
    throw new Error('获取案件成员角色列表失败');
  }
}; 