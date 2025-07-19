import { RecordId } from 'surrealdb';
import { NavItemType } from '../contexts/AuthContext';
import { queryWithAuth } from '@/src/utils/surrealAuth';
import type { SurrealWorkerAPI } from '@/src/contexts/SurrealProvider';

// 菜单元数据接口，对应数据库中的 menu_metadata 表
interface MenuMetadata {
  id: string;
  menu_id: string;
  path: string;
  label_key: string;
  icon_name: string;
  parent_menu_id?: string;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 操作元数据接口，对应数据库中的 operation_metadata 表
interface OperationMetadata {
  id: string;
  operation_id: string;
  menu_id: string;
  operation_name: string;
  operation_type: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// 操作权限查询结果接口
interface OperationQueryResult {
  operation_id: string;
}

/**
 * 使用图查询函数获取用户可访问的菜单
 * @param client SurrealDB client instance
 * @param caseId 案件ID（可选）
 * @returns 用户可访问的菜单列表
 */
export async function loadUserMenus(client: SurrealWorkerAPI, caseId?: RecordId | null): Promise<NavItemType[]> {
  console.log('MenuService.loadUserMenus using surrealClient');
  
  try {
    // 使用权限检查查询获取用户可访问的菜单
    // 菜单查询需要用户登录后才能访问，所以使用 queryWithAuth
    const query = `select * from menu_metadata`;
    
    const params = caseId ? { case_id: caseId } : {};
    console.log('Executing menu permission query with params:', params);
    
    const menuItems = await queryWithAuth<MenuMetadata[]>(client, query, params);

    if (!Array.isArray(menuItems) || menuItems.length === 0) {
      console.log('No menus found in results');
      return [];
    }
    console.log('Menu items from DB:', menuItems);
    
    // 转换为 NavItemType 格式
    const navItems: NavItemType[] = menuItems
      .filter((menu) => menu.is_active) // 只返回激活的菜单
      .sort((a, b) => a.display_order - b.display_order) // 按显示顺序排序
      .map((menu) => ({
        id: menu.menu_id,
        path: menu.path,
        labelKey: menu.label_key,
        iconName: menu.icon_name,
      }));

    console.log('Converted nav items:', navItems);
    
    // TODO: 处理多级菜单（如果有 parent_menu_id）
    // 目前假设都是一级菜单
    
    return navItems;
  } catch (error) {
    console.error('Error loading user menus:', error);
    return [];
  }
}

/**
 * 加载用户在特定菜单中可执行的操作
 * @param client SurrealDB client instance
 * @param menuId 菜单ID
 * @param caseId 案件ID（可选）
 * @returns 用户可执行的操作列表
 */
export async function loadUserOperations(client: SurrealWorkerAPI, menuId: string, caseId?: RecordId | null): Promise<OperationMetadata[]> {
  try {
    const query = `select * from operation_metadata where menu_id = $menu_id`;
    const params = caseId ? { case_id: caseId, menu_id: menuId } : { menu_id: menuId };
    const ops = await queryWithAuth<OperationMetadata[]>(client, query, params);

    if (!Array.isArray(ops) || ops.length === 0) {
      console.log(`No operations found in menu ${menuId}`);
      return [];
    }
    console.log('Operations from DB:', ops);
    return ops;
  } catch (error) {
    console.error(`Error loading operations in menu ${menuId}:`, error);
    return [];
  }
}

/**
 * 检查用户是否有特定操作权限
 * @param client SurrealDB client instance
 * @param operationId 操作ID
 * @param caseId 案件ID（可选）
 * @returns 是否有权限
 */
export async function hasOperation(client: SurrealWorkerAPI, operationId: string, caseId?: RecordId | null): Promise<boolean> {
  try {
    const query = `select * from operation_metadata where operation_id = $operation_id`;
    const params = caseId ? { case_id: caseId, operation_id: operationId } : { operation_id: operationId };
    const result = await queryWithAuth<OperationMetadata[]>(client, query, params);
    return Array.isArray(result) && result.length > 0;
  } catch (error) {
    console.error(`Error checking operation ${operationId}:`, error);
    return false;
  }
}

/**
 * 批量检查用户是否有多个操作权限
 * @param client SurrealDB client instance
 * @param operationIds 操作ID列表
 * @param caseId 案件ID（可选）
 * @returns 操作ID到权限的映射
 */
export async function hasOperations(client: SurrealWorkerAPI, operationIds: string[], caseId?: RecordId | null): Promise<Record<string, boolean>> {
  try {
    const query = `select * from operation_metadata`;
    const params = caseId ? { case_id: caseId } : {};
    const operations = await queryWithAuth<OperationQueryResult[]>(client, query, params);
    const operationsArray = Array.isArray(operations) ? operations : [];
    const availableOperations = new Set(operationsArray.map((item) => item.operation_id));
    console.log('Available operations:', availableOperations);
    const permissions: Record<string, boolean> = {};
    operationIds.forEach(id => {
      permissions[id] = availableOperations.has(id);
    });
    
    return permissions;
  } catch (error) {
    console.error('Error checking operations:', error);
    // 返回所有操作都没有权限
    const permissions: Record<string, boolean> = {};
    operationIds.forEach(id => {
      permissions[id] = false;
    });
    return permissions;
  }
}

/**
 * 检查用户是否有特定菜单访问权限
 * @param client SurrealDB client instance
 * @param userId 用户ID
 * @param menuId 菜单ID
 * @param caseId 案件ID（可选）
 * @returns 是否有权限
 */
export async function hasMenuAccess(client: SurrealWorkerAPI, userId: string, menuId: string, caseId?: string | null): Promise<boolean> {
  try {
    const query = `
      LET $global_roles = (SELECT out FROM $user_id->has_role);
      LET $case_roles = IF $case_id THEN 
        (SELECT out FROM $user_id->has_case_role WHERE case_id = $case_id)
      ELSE [];
      END;
      LET $all_roles = array::concat($global_roles, $case_roles);
      
      SELECT * FROM (
        SELECT * FROM $all_roles->can_access_menu 
        WHERE out.menu_id = $menu_id 
          AND can_access = true 
          AND out.is_active = true
      ) LIMIT 1;
    `;
    
    const result = await queryWithAuth<any[]>(client, query, {
      user_id: userId,
      menu_id: menuId,
      case_id: caseId || null
    });
    return Array.isArray(result) && result.length > 0;
  } catch (error) {
    console.error(`Error checking menu access ${menuId} for user ${userId}:`, error);
    return false;
  }
}

// Backward compatibility: create a service object with methods that require client to be passed
export const menuService = {
  loadUserMenus,
  loadUserOperations,
  hasOperation,
  hasOperations,
  hasMenuAccess,
  // Legacy methods for compatibility - will be removed later
  setDataService: () => {
    console.warn('menuService.setDataService is deprecated. Use direct function calls instead.');
  }
};