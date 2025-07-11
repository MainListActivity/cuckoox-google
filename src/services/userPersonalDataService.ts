import { RecordId } from 'surrealdb';
import { dataService } from './dataService';

/**
 * 用户个人信息数据结构
 */
export interface UserPersonalData {
  // 权限相关
  permissions: {
    operations: OperationPermission[];
    menus: MenuPermission[];
    dataAccess: DataPermission[];
  };
  
  // 角色相关
  roles: {
    global: string[];
    case: Record<string, string[]>; // case_id -> roles
  };
  
  // 菜单相关
  menus: MenuMetadata[];
  
  // 用户设置
  settings: {
    theme: string;
    language: string;
    notifications: boolean;
    [key: string]: any;
  };
  
  // 最近访问
  recentAccess: {
    cases: string[];
    documents: string[];
    contacts: string[];
  };
  
  // 同步时间戳
  syncTimestamp: number;
}

export interface OperationPermission {
  operation_id: string;
  case_id?: string;
  can_execute: boolean;
  conditions?: any; // 权限条件
}

export interface MenuPermission {
  menu_id: string;
  case_id?: string;
  can_access: boolean;
  visibility_level?: number;
}

export interface DataPermission {
  table_name: string;
  case_id?: string;
  crud_permissions: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  conditions?: any; // 数据权限条件
}

export interface MenuMetadata {
  id: string;
  path: string;
  labelKey: string;
  iconName: string;
  parent_id?: string;
  order_index: number;
  is_active: boolean;
  required_permissions?: string[];
  children?: MenuMetadata[];
}

/**
 * 用户个人数据缓存服务
 * 负责管理用户个人信息的缓存，包括权限、菜单、设置等
 */
export class UserPersonalDataService {
  private userId?: string;
  private currentCaseId?: string;
  
  /**
   * 设置当前用户上下文
   */
  setUserContext(userId: string, caseId?: string): void {
    this.userId = userId;
    this.currentCaseId = caseId;
  }
  
  /**
   * 获取用户完整的个人数据
   */
  async fetchUserPersonalData(userId: string, caseId?: string): Promise<UserPersonalData> {
    console.log('UserPersonalDataService: Fetching user personal data for:', userId);
    
    try {
      // 并行获取所有个人数据
      const [permissions, roles, menus, settings, recentAccess] = await Promise.all([
        this.fetchUserPermissions(userId, caseId),
        this.fetchUserRoles(userId, caseId),
        this.fetchUserMenus(userId, caseId),
        this.fetchUserSettings(userId),
        this.fetchUserRecentAccess(userId)
      ]);
      
      const personalData: UserPersonalData = {
        permissions,
        roles,
        menus,
        settings,
        recentAccess,
        syncTimestamp: Date.now()
      };
      
      console.log('UserPersonalDataService: Successfully fetched user personal data');
      return personalData;
      
    } catch (error) {
      console.error('UserPersonalDataService: Error fetching user personal data:', error);
      throw error;
    }
  }
  
  /**
   * 获取用户权限数据
   */
  private async fetchUserPermissions(userId: string, caseId?: string) {
    console.log('UserPersonalDataService: Fetching user permissions');
    
    try {
      // 获取操作权限
      const operationPermissions = await this.fetchOperationPermissions(userId, caseId);
      
      // 获取菜单权限
      const menuPermissions = await this.fetchMenuPermissions(userId, caseId);
      
      // 获取数据权限
      const dataPermissions = await this.fetchDataPermissions(userId, caseId);
      
      return {
        operations: operationPermissions,
        menus: menuPermissions,
        dataAccess: dataPermissions
      };
      
    } catch (error) {
      console.error('UserPersonalDataService: Error fetching user permissions:', error);
      return {
        operations: [],
        menus: [],
        dataAccess: []
      };
    }
  }
  
  /**
   * 获取操作权限
   */
  private async fetchOperationPermissions(userId: string, caseId?: string): Promise<OperationPermission[]> {
    try {
      const query = `
        LET $global_roles = (SELECT out FROM $user_id->has_role);
        LET $case_roles = IF $case_id THEN 
          (SELECT out FROM $user_id->has_case_role WHERE case_id = $case_id)
        ELSE [];
        END;
        LET $all_roles = array::concat($global_roles, $case_roles);
        
        SELECT 
          out.operation_id as operation_id,
          $case_id as case_id,
          can_execute,
          conditions
        FROM $all_roles->can_execute_operation 
        WHERE can_execute = true AND out.is_active = true;
      `;
      
      const result = await dataService.query(query, {
        user_id: userId,
        case_id: caseId || null
      });
      
      return Array.isArray(result) ? result.map(item => ({
        operation_id: item.operation_id,
        case_id: item.case_id,
        can_execute: item.can_execute,
        conditions: item.conditions
      })) : [];
      
    } catch (error) {
      console.error('UserPersonalDataService: Error fetching operation permissions:', error);
      return [];
    }
  }
  
  /**
   * 获取菜单权限
   */
  private async fetchMenuPermissions(userId: string, caseId?: string): Promise<MenuPermission[]> {
    try {
      const query = `
        LET $global_roles = (SELECT out FROM $user_id->has_role);
        LET $case_roles = IF $case_id THEN 
          (SELECT out FROM $user_id->has_case_role WHERE case_id = $case_id)
        ELSE [];
        END;
        LET $all_roles = array::concat($global_roles, $case_roles);
        
        SELECT 
          out.menu_id as menu_id,
          $case_id as case_id,
          can_access,
          visibility_level
        FROM $all_roles->can_access_menu 
        WHERE can_access = true AND out.is_active = true;
      `;
      
      const result = await dataService.query(query, {
        user_id: userId,
        case_id: caseId || null
      });
      
      return Array.isArray(result) ? result.map(item => ({
        menu_id: item.menu_id,
        case_id: item.case_id,
        can_access: item.can_access,
        visibility_level: item.visibility_level
      })) : [];
      
    } catch (error) {
      console.error('UserPersonalDataService: Error fetching menu permissions:', error);
      return [];
    }
  }
  
  /**
   * 获取数据权限
   */
  private async fetchDataPermissions(userId: string, caseId?: string): Promise<DataPermission[]> {
    try {
      const query = `
        LET $global_roles = (SELECT out FROM $user_id->has_role);
        LET $case_roles = IF $case_id THEN 
          (SELECT out FROM $user_id->has_case_role WHERE case_id = $case_id)
        ELSE [];
        END;
        LET $all_roles = array::concat($global_roles, $case_roles);
        
        SELECT 
          table_name,
          $case_id as case_id,
          {
            create: can_create,
            read: can_read,
            update: can_update,
            delete: can_delete
          } as crud_permissions,
          conditions
        FROM $all_roles->has_data_permission 
        WHERE is_active = true
        GROUP BY table_name;
      `;
      
      const result = await dataService.query(query, {
        user_id: userId,
        case_id: caseId || null
      });
      
      return Array.isArray(result) ? result.map(item => ({
        table_name: item.table_name,
        case_id: item.case_id,
        crud_permissions: item.crud_permissions,
        conditions: item.conditions
      })) : [];
      
    } catch (error) {
      console.error('UserPersonalDataService: Error fetching data permissions:', error);
      return [];
    }
  }
  
  /**
   * 获取用户角色
   */
  private async fetchUserRoles(userId: string, caseId?: string) {
    try {
      // 获取全局角色
      const globalRolesQuery = `
        SELECT out.name as role_name 
        FROM $user_id->has_role;
      `;
      
      const globalRoles = await dataService.query(globalRolesQuery, {
        user_id: userId
      });
      
      // 获取案件角色
      const caseRolesQuery = `
        SELECT 
          case_id,
          out.name as role_name 
        FROM $user_id->has_case_role;
      `;
      
      const caseRoles = await dataService.query(caseRolesQuery, {
        user_id: userId
      });
      
      // 组织角色数据
      const globalRoleNames = Array.isArray(globalRoles) 
        ? globalRoles.map(item => item.role_name)
        : [];
      
      const caseRoleMap: Record<string, string[]> = {};
      if (Array.isArray(caseRoles)) {
        caseRoles.forEach(item => {
          const caseId = String(item.case_id);
          if (!caseRoleMap[caseId]) {
            caseRoleMap[caseId] = [];
          }
          caseRoleMap[caseId].push(item.role_name);
        });
      }
      
      return {
        global: globalRoleNames,
        case: caseRoleMap
      };
      
    } catch (error) {
      console.error('UserPersonalDataService: Error fetching user roles:', error);
      return {
        global: [],
        case: {}
      };
    }
  }
  
  /**
   * 获取用户菜单
   */
  private async fetchUserMenus(userId: string, caseId?: string): Promise<MenuMetadata[]> {
    try {
      // 使用现有的菜单服务获取用户可访问的菜单
      const query = `
        LET $global_roles = (SELECT out FROM $user_id->has_role);
        LET $case_roles = IF $case_id THEN 
          (SELECT out FROM $user_id->has_case_role WHERE case_id = $case_id)
        ELSE [];
        END;
        LET $all_roles = array::concat($global_roles, $case_roles);
        
        SELECT 
          id,
          path,
          label_key as labelKey,
          icon_name as iconName,
          parent_id,
          order_index,
          is_active,
          required_permissions
        FROM (
          SELECT DISTINCT out.* 
          FROM $all_roles->can_access_menu 
          WHERE can_access = true AND out.is_active = true
        ) 
        ORDER BY order_index ASC;
      `;
      
      const result = await dataService.query(query, {
        user_id: userId,
        case_id: caseId || null
      });
      
      return Array.isArray(result) ? result.map(item => ({
        id: item.id,
        path: item.path,
        labelKey: item.labelKey,
        iconName: item.iconName,
        parent_id: item.parent_id,
        order_index: item.order_index,
        is_active: item.is_active,
        required_permissions: item.required_permissions
      })) : [];
      
    } catch (error) {
      console.error('UserPersonalDataService: Error fetching user menus:', error);
      return [];
    }
  }
  
  /**
   * 获取用户设置
   */
  private async fetchUserSettings(userId: string) {
    try {
      const query = `
        SELECT settings FROM user_settings 
        WHERE user_id = $user_id;
      `;
      
      const result = await dataService.query(query, {
        user_id: userId
      });
      
      const settings = result?.[0]?.settings || {};
      
      return {
        theme: settings.theme || 'light',
        language: settings.language || 'zh-CN',
        notifications: settings.notifications !== false,
        ...settings
      };
      
    } catch (error) {
      console.error('UserPersonalDataService: Error fetching user settings:', error);
      return {
        theme: 'light',
        language: 'zh-CN',
        notifications: true
      };
    }
  }
  
  /**
   * 获取用户最近访问
   */
  private async fetchUserRecentAccess(userId: string) {
    try {
      const query = `
        SELECT 
          recent_cases,
          recent_documents,
          recent_contacts
        FROM user_recent_access 
        WHERE user_id = $user_id;
      `;
      
      const result = await dataService.query(query, {
        user_id: userId
      });
      
      const recentData = result?.[0] || {};
      
      return {
        cases: recentData.recent_cases || [],
        documents: recentData.recent_documents || [],
        contacts: recentData.recent_contacts || []
      };
      
    } catch (error) {
      console.error('UserPersonalDataService: Error fetching user recent access:', error);
      return {
        cases: [],
        documents: [],
        contacts: []
      };
    }
  }
  
  /**
   * 同步用户个人数据到Service Worker
   */
  async syncUserPersonalDataToServiceWorker(userId: string, caseId?: string): Promise<void> {
    try {
      console.log('UserPersonalDataService: Syncing user personal data to Service Worker');
      
      // 获取完整的个人数据
      const personalData = await this.fetchUserPersonalData(userId, caseId);
      
      // 发送消息到Service Worker
      await this.sendMessageToServiceWorker('sync_user_personal_data', {
        userId,
        caseId: caseId || null,
        personalData
      });
      
      console.log('UserPersonalDataService: Successfully synced user personal data to Service Worker');
      
    } catch (error) {
      console.error('UserPersonalDataService: Error syncing user personal data to Service Worker:', error);
      throw error;
    }
  }
  
  /**
   * 更新用户设置
   */
  async updateUserSettings(userId: string, settings: Partial<UserPersonalData['settings']>): Promise<void> {
    try {
      const query = `
        UPDATE user_settings 
        SET settings = $settings, updated_at = time::now()
        WHERE user_id = $user_id;
      `;
      
      await dataService.query(query, {
        user_id: userId,
        settings
      });
      
      // 同步到Service Worker
      await this.syncUserPersonalDataToServiceWorker(userId, this.currentCaseId);
      
    } catch (error) {
      console.error('UserPersonalDataService: Error updating user settings:', error);
      throw error;
    }
  }
  
  /**
   * 更新用户最近访问
   */
  async updateUserRecentAccess(
    userId: string,
    type: 'cases' | 'documents' | 'contacts',
    itemId: string
  ): Promise<void> {
    try {
      const query = `
        LET $current = (SELECT * FROM user_recent_access WHERE user_id = $user_id);
        LET $existing = IF $current THEN $current[0] ELSE {} END;
        
        UPDATE user_recent_access 
        SET 
          recent_${type} = array::slice(
            array::concat([$item_id], $existing.recent_${type} OR []),
            0, 10
          ),
          updated_at = time::now()
        WHERE user_id = $user_id;
      `;
      
      await dataService.query(query, {
        user_id: userId,
        item_id: itemId
      });
      
      // 同步到Service Worker
      await this.syncUserPersonalDataToServiceWorker(userId, this.currentCaseId);
      
    } catch (error) {
      console.error('UserPersonalDataService: Error updating user recent access:', error);
      throw error;
    }
  }
  
  /**
   * 清除用户个人数据缓存
   */
  async clearUserPersonalDataCache(userId: string, caseId?: string): Promise<void> {
    try {
      await this.sendMessageToServiceWorker('clear_user_personal_data', {
        userId,
        caseId: caseId || null
      });
      
      console.log('UserPersonalDataService: Cleared user personal data cache');
      
    } catch (error) {
      console.error('UserPersonalDataService: Error clearing user personal data cache:', error);
      throw error;
    }
  }
  
  /**
   * 发送消息到Service Worker
   */
  private async sendMessageToServiceWorker(type: string, payload: unknown): Promise<unknown> {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
      console.warn('UserPersonalDataService: Service Worker not available');
      return Promise.resolve({ success: true });
    }
    
    return new Promise((resolve, reject) => {
      if (!navigator.serviceWorker.controller) {
        reject(new Error('Service Worker not available'));
        return;
      }
      
      const messageId = Date.now().toString();
      
      const handleMessage = (event: MessageEvent) => {
        if (event.data && event.data.messageId === messageId) {
          navigator.serviceWorker.removeEventListener('message', handleMessage);
          
          if (event.data.type === `${type}_response`) {
            resolve(event.data.payload);
          } else if (event.data.type === `${type}_error`) {
            reject(new Error(event.data.payload?.message || 'Unknown error'));
          }
        }
      };

      navigator.serviceWorker.addEventListener('message', handleMessage);
      
      // 发送消息
      navigator.serviceWorker.controller.postMessage({
        type,
        payload,
        messageId
      });
      
      // 设置超时
      setTimeout(() => {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
        reject(new Error('Service Worker message timeout'));
      }, 10000);
    });
  }
}

export const userPersonalDataService = new UserPersonalDataService();