import { RecordId } from 'surrealdb';
import Surreal from 'surrealdb';

export interface MenuMetadata {
  menu_id: string;
  path: string;
  label_key: string;
  icon_name: string;
  parent_menu_id?: string;
  display_order: number;
  is_active: boolean;
}

export interface OperationMetadata {
  operation_id: string;
  menu_id: string;
  operation_name: string;
  operation_type: string;
  description?: string;
  is_active: boolean;
}

export interface NavItemType {
  id: string;
  path: string;
  labelKey: string;
  iconName: string;
  children?: NavItemType[];
}

class MenuService {
  private client: Surreal | null = null;

  setClient(client: Surreal) {
    this.client = client;
  }

  /**
   * 从数据库加载用户可访问的菜单
   * @returns 用户可访问的菜单列表
   */
  async loadUserMenus(): Promise<NavItemType[]> {
    console.log('MenuService.loadUserMenus called, client:', this.client);
    
    if (!this.client) {
      console.error('MenuService: SurrealDB client not initialized');
      return [];
    }

    try {
      const query = 'SELECT * FROM menu_metadata ORDER BY display_order ASC';
      console.log('Executing query:', query);
      
      const results = await this.client.query<MenuMetadata[][]>(query);
      console.log('Query results:', results);
      
      if (!results || results.length === 0 || !results[0]) {
        console.log('No menus found in results');
        return [];
      }

      const menuItems = results[0];
      console.log('Menu items from DB:', menuItems);
      
      // 转换为 NavItemType 格式
      const navItems: NavItemType[] = menuItems.map((menu: MenuMetadata) => ({
        id: menu.menu_id,
        path: menu.path,
        labelKey: menu.label_key,
        iconName: menu.icon_name,
      }));

      console.log('Converted nav items:', navItems);
      
      // TODO: 处理多级菜单（如果有 parent_menu_id）
      
      return navItems;
    } catch (error) {
      console.error('Error loading user menus:', error);
      return [];
    }
  }

  /**
   * 加载用户在特定菜单中可执行的操作
   * @param menuId 菜单ID
   * @returns 用户可执行的操作列表
   */
  async loadUserOperations(menuId: string): Promise<OperationMetadata[]> {
    if (!this.client) {
      console.error('MenuService: SurrealDB client not initialized');
      return [];
    }

    try {
      const results = await this.client.query<OperationMetadata[][]>(
        'SELECT * FROM operation_metadata WHERE menu_id = $menuId',
        { menuId }
      );
      
      if (!results || results.length === 0 || !results[0]) {
        console.log(`No operations found for menu ${menuId}`);
        return [];
      }

      return results[0];
    } catch (error) {
      console.error(`Error loading operations for menu ${menuId}:`, error);
      return [];
    }
  }

  /**
   * 检查用户是否有特定操作权限
   * @param operationId 操作ID
   * @returns 是否有权限
   */
  async hasOperation(operationId: string): Promise<boolean> {
    if (!this.client) {
      console.error('MenuService: SurrealDB client not initialized');
      return false;
    }

    try {
      const results = await this.client.query<OperationMetadata[][]>(
        'SELECT * FROM operation_metadata WHERE operation_id = $operationId',
        { operationId }
      );
      
      return results && results.length > 0 && results[0] && results[0].length > 0;
    } catch (error) {
      console.error(`Error checking operation ${operationId}:`, error);
      return false;
    }
  }

  /**
   * 批量检查用户是否有多个操作权限
   * @param operationIds 操作ID列表
   * @returns 操作ID到权限的映射
   */
  async hasOperations(operationIds: string[]): Promise<Record<string, boolean>> {
    if (!this.client) {
      console.error('MenuService: SurrealDB client not initialized');
      const permissions: Record<string, boolean> = {};
      operationIds.forEach(id => {
        permissions[id] = false;
      });
      return permissions;
    }

    try {
      const results = await this.client.query<OperationMetadata[][]>(
        'SELECT operation_id FROM operation_metadata WHERE operation_id IN $operationIds',
        { operationIds }
      );
      
      const availableOperations = new Set(
        results && results[0] ? results[0].map((op: OperationMetadata) => op.operation_id) : []
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
}

export const menuService = new MenuService(); 