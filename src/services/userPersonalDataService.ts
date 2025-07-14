import { dataService } from './dataService';

/**
 * 用户个人信息数据结构
 */
export interface UserPersonalData {
  // 权限相关
  permissions: {
    operations: OperationPermission[];
  };
  
  // 角色相关
  roles: {
    global: string[];
    case: Record<string, string[]>; // case_id -> roles
  };
  
  // 菜单相关
  menus: MenuMetadata[];
  
  // 用户设置
  settings?: {
    theme: string;
    language: string;
    notifications: boolean;
    [key: string]: any;
  };
  
  // 最近访问
  recentAccess?: {
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
  
  // 内存缓存
  private memoryCache = new Map<string, { data: UserPersonalData; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5分钟缓存
  
  // 防止并发请求
  private pendingRequests = new Map<string, Promise<UserPersonalData>>();
  
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
    const cacheKey = `${userId}_${caseId || 'global'}`;
    
    // 检查内存缓存
    const cached = this.memoryCache.get(cacheKey);
    if (cached) {
      const now = Date.now();
      const cacheAge = now - cached.timestamp;
      
      if (cacheAge < this.CACHE_DURATION) {
        console.log('UserPersonalDataService: Returning cached data for:', userId);
        return cached.data;
      } else {
        // 缓存过期，删除
        this.memoryCache.delete(cacheKey);
      }
    }
    
    // 检查是否有正在进行的请求
    const pendingRequest = this.pendingRequests.get(cacheKey);
    if (pendingRequest) {
      console.log('UserPersonalDataService: Waiting for pending request for:', userId);
      return pendingRequest;
    }
    
    console.log('UserPersonalDataService: Fetching user personal data for:', userId);
    
    // 创建新的请求
    const fetchPromise = this.performFetch(userId, caseId);
    this.pendingRequests.set(cacheKey, fetchPromise);
    
    try {
      const result = await fetchPromise;
      
      // 存储到内存缓存
      this.memoryCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });
      
      console.log('UserPersonalDataService: Successfully fetched and cached user personal data');
      return result;
      
    } catch (error) {
      console.error('UserPersonalDataService: Error fetching user personal data:', error);
      throw error;
    } finally {
      // 清理pending请求
      this.pendingRequests.delete(cacheKey);
    }
  }
  
  /**
   * 实际执行数据获取的方法
   */
  private async performFetch(userId: string, caseId?: string): Promise<UserPersonalData> {
    try {
      // 并行获取所有个人数据
      const [permissions, roles, menus] = await Promise.all([
        this.fetchUserPermissions(userId, caseId),
        this.fetchUserRoles(userId, caseId),
        this.fetchUserMenus(userId, caseId),
      ]);
      
      const personalData: UserPersonalData = {
        permissions,
        roles,
        menus,
        syncTimestamp: Date.now()
      };
      
      return personalData;
      
    } catch (error) {
      console.error('UserPersonalDataService: Error in performFetch:', error);
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
      
      return {
        operations: operationPermissions,
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
        select * from operation_metadata;
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
   * 获取用户角色
   */
  private async fetchUserRoles(userId: string, _caseId?: string) {
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
        select * from menu_metadata;
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
      // 清理内存缓存
      const cacheKey = `${userId}_${caseId || 'global'}`;
      this.memoryCache.delete(cacheKey);
      
      // 清理pending请求
      this.pendingRequests.delete(cacheKey);
      
      // 清理Service Worker缓存
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
   * 清除所有内存缓存
   */
  clearAllMemoryCache(): void {
    this.memoryCache.clear();
    this.pendingRequests.clear();
    console.log('UserPersonalDataService: Cleared all memory cache');
  }
  
  private serviceWorkerComm: {
    sendMessage: (type: string, payload?: any) => Promise<any>;
    isAvailable: () => boolean;
    waitForReady: () => Promise<void>;
  } | null = null;

  /**
   * 设置Service Worker通信接口（由SurrealProvider注入）
   */
  setServiceWorkerComm(comm: {
    sendMessage: (type: string, payload?: any) => Promise<any>;
    isAvailable: () => boolean;
    waitForReady: () => Promise<void>;
  }) {
    this.serviceWorkerComm = comm;
  }

  /**
   * 发送消息到Service Worker
   */
  private async sendMessageToServiceWorker(type: string, payload: unknown): Promise<unknown> {
    if (!this.serviceWorkerComm) {
      throw new Error('Service Worker communication not available. Make sure SurrealProvider is properly initialized.');
    }
    
    if (!this.serviceWorkerComm.isAvailable()) {
      console.warn('UserPersonalDataService: Service Worker not available');
      return Promise.resolve({ success: true });
    }
    
    try {
      await this.serviceWorkerComm.waitForReady();
      return await this.serviceWorkerComm.sendMessage(type, payload);
    } catch (error) {
      console.error('UserPersonalDataService: Service Worker communication error:', error);
      throw error;
    }
  }
}
export const userPersonalDataService = new UserPersonalDataService();