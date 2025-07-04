import { RecordId } from 'surrealdb';
import { NavItemType } from '../contexts/AuthContext';
import { surrealClient } from '@/src/lib/surrealClient';

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

type SurrealQueryable = {
  query: (sql: string, vars?: Record<string, unknown>) => Promise<unknown>;
};

class MenuService {
  private client: SurrealQueryable | null = null;

  /**
   * Allow external injection of a pre-initialised client (e.g. via SurrealProvider).
   */
  setClient(client: SurrealQueryable | null) {
    this.client = client;
  }

  /**
   * Ensure we have a usable Surreal client with a `query` method. Falls back to creating
   * (or reusing) the global worker proxy via `surrealClient()` if the injected client is
   * missing or invalid.
   */
  private async ensureClient(): Promise<SurrealQueryable> {
    if (this.client && typeof (this.client as any).query === 'function') {
      return this.client;
    }

    // Create / reuse the global proxy
    this.client = await surrealClient();
    return this.client;
  }

  /**
   * 使用图查询函数获取用户可访问的菜单
   * @param userId 用户ID  
   * @param caseId 案件ID（可选）
   * @returns 用户可访问的菜单列表
   */
  async loadUserMenus(caseId?: RecordId | null): Promise<NavItemType[]> {
    const client = await this.ensureClient();
    console.log('MenuService.loadUserMenus using client:', client);
    
    try {
      // 使用数据库中定义的图查询函数获取用户可访问的菜单
      const query = `select * from menu_metadata`;
      
      const params = caseId ? { case_id: caseId } : {};
      console.log('Executing query:', query, 'with params:', params);
      
      const raw = (await client.query(query, params)) as unknown;

      const rows: unknown = (raw as { result?: unknown }).result ?? raw;

      if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(rows[0])) {
        console.log('No menus found in results');
        return [];
      }

      const menuItems = rows[0] as MenuMetadata[];
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
  async loadUserOperations(menuId: string, caseId?: RecordId | null): Promise<OperationMetadata[]> {
    const client = await this.ensureClient();
    try {
      const query = `select * from operation_metadata where menu_id = $menu_id`;
      const params = caseId ? { case_id: caseId, menu_id: menuId } : { menu_id: menuId };
      const raw = (await client.query(query, params)) as unknown;
      const rows: unknown = (raw as { result?: unknown }).result ?? raw;

      if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(rows[0])) {
        console.log(`No operations found in menu ${menuId}`);
        return [];
      }
      const ops = rows[0] as OperationMetadata[];
      console.log('Operations from DB:', ops);
      return ops;
    } catch (error) {
      console.error(`Error loading operations in menu ${menuId}:`, error);
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
  async hasOperation(operationId: string, caseId?: RecordId | null): Promise<boolean> {
    const client = await this.ensureClient();
    try {
      const query = `select * from operation_metadata where operation_id = $operation_id`;
      const params = caseId ? { case_id: caseId, operation_id: operationId } : { operation_id: operationId };
      const raw = (await client.query(query, params)) as unknown;
      const rows: unknown = (raw as { result?: unknown }).result ?? raw;
      return Array.isArray(rows) && Array.isArray(rows[0]) && rows[0].length > 0;
    } catch (error) {
      console.error(`Error checking operation ${operationId}:`, error);
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
  async hasOperations(operationIds: string[], caseId?: RecordId | null): Promise<Record<string, boolean>> {
    const client = await this.ensureClient();
    
    try {
      const query = `select * from operation_metadata`;
      const params = caseId ? { case_id: caseId } : {};
      const raw = (await client.query(query, params)) as unknown;
      const rows: unknown = (raw as { result?: unknown }).result ?? raw;
      const firstRowArray = Array.isArray(rows) && Array.isArray(rows[0]) ? (rows[0] as OperationQueryResult[]) : [];
      const availableOperations = new Set(firstRowArray.map((item) => item.operation_id));
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
   * @param userId 用户ID
   * @param menuId 菜单ID
   * @param caseId 案件ID（可选）
   * @returns 是否有权限
   */
  async hasMenuAccess(userId: string, menuId: string, caseId?: string | null): Promise<boolean> {
    const client = await this.ensureClient();
    
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
      
      const raw = (await client.query(query, {
        user_id: userId,
        menu_id: menuId,
        case_id: caseId || null
      })) as unknown;
      const rows: unknown = (raw as { result?: unknown }).result ?? raw;
      return Array.isArray(rows) && Array.isArray(rows[0]) && rows[0].length > 0;
    } catch (error) {
      console.error(`Error checking menu access ${menuId} for user ${userId}:`, error);
      return false;
    }
  }
}

export const menuService = new MenuService(); 