import { RecordId, Surreal } from 'surrealdb';
import { NavItemType } from '../contexts/AuthContext';

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

class MenuService {
  private client: Surreal | null = null;

  setClient(client: Surreal | null) {
    this.client = client;
  }

  /**
   * 使用图查询函数获取用户可访问的菜单
   * @param userId 用户ID  
   * @param caseId 案件ID（可选）
   * @returns 用户可访问的菜单列表
   */
  async loadUserMenus(caseId?: RecordId | null): Promise<NavItemType[]> {
    console.log('MenuService.loadUserMenus called, client:', this.client);
    
    if (!this.client) {
      console.error('MenuService: SurrealDB client not initialized');
      return [];
    }

    try {
      // 使用数据库中定义的图查询函数获取用户可访问的菜单
      const query = `select * from menu_metadata`;
      
      const params = caseId ? { case_id: caseId } : {};
      console.log('Executing query:', query, 'with params:', params);
      
      const results = await this.client.query<MenuMetadata[][]>(query, params);
      
      console.log('Query results:', results);
      
      if (!results || results.length === 0 || !results[0]) {
        console.log('No menus found in results');
        return [];
      }

      const menuItems = results[0];
      console.log('Menu items from DB:', menuItems);
      
      // 转换为 NavItemType 格式
      const navItems: NavItemType[] = menuItems
        .filter((menu: MenuMetadata) => menu.is_active) // 只返回激活的菜单
        .sort((a: MenuMetadata, b: MenuMetadata) => a.display_order - b.display_order) // 按显示顺序排序
        .map((menu: MenuMetadata) => ({
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
   * @param userId 用户ID
   * @param menuId 菜单ID
   * @param caseId 案件ID（可选）
   * @returns 用户可执行的操作列表
   */
  async loadUserOperations(userId: string, menuId: string, caseId?: string | null): Promise<OperationMetadata[]> {
    if (!this.client) {
      console.error('MenuService: SurrealDB client not initialized');
      return [];
    }

    try {
      // 使用图查询检查用户在特定菜单中可执行的操作
      const query = `
        LET $global_roles = (SELECT out FROM $user_id->has_role);
        LET $case_roles = IF $case_id THEN 
          (SELECT out FROM $user_id->has_case_role WHERE case_id = $case_id)
        ELSE [];
        END;
        LET $all_roles = array::concat($global_roles, $case_roles);
        
        SELECT DISTINCT out.* FROM (
          SELECT * FROM $all_roles->can_execute_operation 
          WHERE out.menu_id = $menu_id 
            AND can_execute = true 
            AND out.is_active = true
        );
      `;
      
      const results = await this.client.query<OperationMetadata[][]>(query, {
        user_id: userId,
        menu_id: menuId,
        case_id: caseId || null
      });
      
      if (!results || results.length === 0 || !results[0]) {
        console.log(`No operations found for user ${userId} in menu ${menuId}`);
        return [];
      }

      return results[0];
    } catch (error) {
      console.error(`Error loading operations for user ${userId} in menu ${menuId}:`, error);
      return [];
    }
  }

  /**
   * 检查用户是否有特定操作权限
   * @param userId 用户ID
   * @param operationId 操作ID
   * @param caseId 案件ID（可选）
   * @returns 是否有权限
   */
  async hasOperation(userId: string, operationId: string, caseId?: string | null): Promise<boolean> {
    if (!this.client) {
      console.error('MenuService: SurrealDB client not initialized');
      return false;
    }

    try {
      const query = `
        LET $global_roles = (SELECT out FROM $user_id->has_role);
        LET $case_roles = IF $case_id THEN 
          (SELECT out FROM $user_id->has_case_role WHERE case_id = $case_id)
        ELSE [];
        END;
        LET $all_roles = array::concat($global_roles, $case_roles);
        
        SELECT * FROM (
          SELECT * FROM $all_roles->can_execute_operation 
          WHERE out.operation_id = $operation_id 
            AND can_execute = true 
            AND out.is_active = true
        ) LIMIT 1;
      `;
      
      const results = await this.client.query<unknown[][]>(query, {
        user_id: userId,
        operation_id: operationId,
        case_id: caseId || null
      });
      
      return !!(results && results[0] && results[0].length > 0);
    } catch (error) {
      console.error(`Error checking operation ${operationId} for user ${userId}:`, error);
      return false;
    }
  }

  /**
   * 批量检查用户是否有多个操作权限
   * @param userId 用户ID
   * @param operationIds 操作ID列表
   * @param caseId 案件ID（可选）
   * @returns 操作ID到权限的映射
   */
  async hasOperations(userId: string, operationIds: string[], caseId?: string | null): Promise<Record<string, boolean>> {
    if (!this.client) {
      console.error('MenuService: SurrealDB client not initialized');
      const permissions: Record<string, boolean> = {};
      operationIds.forEach(id => {
        permissions[id] = false;
      });
      return permissions;
    }

    try {
      const query = `select * from operation_metadata`;
      const params = caseId ? { case_id: caseId } : {};
      const results = await this.client.query<OperationQueryResult[][]>(query, params);
      
      const availableOperations = new Set(
        results && results[0] ? results[0].map((item: OperationQueryResult) => item.operation_id) : []
      );
      
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
   * @param userId 用户ID
   * @param menuId 菜单ID
   * @param caseId 案件ID（可选）
   * @returns 是否有权限
   */
  async hasMenuAccess(userId: string, menuId: string, caseId?: string | null): Promise<boolean> {
    if (!this.client) {
      console.error('MenuService: SurrealDB client not initialized');
      return false;
    }

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
      
      const results = await this.client.query<unknown[][]>(query, {
        user_id: userId,
        menu_id: menuId,
        case_id: caseId || null
      });
      
      return !!(results && results[0] && results[0].length > 0);
    } catch (error) {
      console.error(`Error checking menu access ${menuId} for user ${userId}:`, error);
      return false;
    }
  }
}

export const menuService = new MenuService(); 