import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useUserPersonalData } from './useUserPersonalData';

export interface PermissionCheckResult {
  hasPermission: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * 检查当前用户是否有执行特定操作的权限
 * @param operationId 操作ID，如 'case_create', 'claim_review' 等
 * @returns 权限检查结果
 */
export function useOperationPermission(operationId: string): PermissionCheckResult {
  const { user, selectedCaseId } = useAuth();
  const { data: personalData, isLoading, error } = useUserPersonalData();
  const [hasPermission, setHasPermission] = useState(false);
  
  useEffect(() => {
    if (!user || !operationId) {
      setHasPermission(false);
      return;
    }
    
    // 管理员拥有所有权限
    if (user.github_id === '--admin--') {
      setHasPermission(true);
      return;
    }
    
    if (personalData && personalData.permissions) {
      // 检查操作权限
      const operationPermissions = personalData.permissions.operations || [];
      const hasOp = operationPermissions.some(op => 
        op.operation_id === operationId && 
        op.can_execute &&
        (!selectedCaseId || op.case_id === selectedCaseId || !op.case_id)
      );
      setHasPermission(hasOp);
    } else {
      setHasPermission(false);
    }
  }, [user, operationId, selectedCaseId, personalData]);
  
  return { hasPermission, isLoading, error };
}

/**
 * 检查当前用户是否有访问特定菜单的权限
 * @param menuId 菜单ID，如 'cases', 'creditors' 等
 * @returns 权限检查结果
 */
export function useMenuPermission(menuId: string): PermissionCheckResult {
  const { user, selectedCaseId } = useAuth();
  const { data: personalData, isLoading, error } = useUserPersonalData();
  const [hasPermission, setHasPermission] = useState(false);
  
  useEffect(() => {
    if (!user || !menuId) {
      setHasPermission(false);
      return;
    }
    
    // 管理员拥有所有权限
    if (user.github_id === '--admin--') {
      setHasPermission(true);
      return;
    }
    
    if (personalData && personalData.permissions) {
      // 检查菜单权限
      const menuPermissions = personalData.permissions.menus || [];
      const hasMenu = menuPermissions.some(menu => 
        menu.menu_id === menuId && 
        menu.can_access &&
        (!selectedCaseId || menu.case_id === selectedCaseId || !menu.case_id)
      );
      setHasPermission(hasMenu);
    } else {
      setHasPermission(false);
    }
  }, [user, menuId, selectedCaseId, personalData]);
  
  return { hasPermission, isLoading, error };
}

/**
 * 检查当前用户对特定数据表的CRUD权限
 * @param tableName 数据表名称
 * @param crudType CRUD操作类型
 * @returns 权限检查结果
 */
export function useDataPermission(
  tableName: string,
  crudType: 'create' | 'read' | 'update' | 'delete'
): PermissionCheckResult {
  const { user, selectedCaseId } = useAuth();
  const { data: personalData, isLoading, error } = useUserPersonalData();
  const [hasPermission, setHasPermission] = useState(false);
  
  useEffect(() => {
    if (!user || !tableName) {
      setHasPermission(false);
      return;
    }
    
    // 管理员拥有所有权限
    if (user.github_id === '--admin--') {
      setHasPermission(true);
      return;
    }
    
    if (personalData && personalData.permissions) {
      // 检查数据权限
      const dataPermissions = personalData.permissions.data || [];
      const hasData = dataPermissions.some(data => 
        data.table_name === tableName && 
        data.crud_type === crudType &&
        data.can_access &&
        (!selectedCaseId || data.case_id === selectedCaseId || !data.case_id)
      );
      setHasPermission(hasData);
    } else {
      setHasPermission(false);
    }
  }, [user, tableName, crudType, selectedCaseId, personalData]);
  
  return { hasPermission, isLoading, error };
}

/**
 * 获取用户的角色列表（包括全局角色和案件角色）
 * @returns 用户角色列表
 */
export function useUserRoles() {
  const { user, selectedCaseId } = useAuth();
  const { data: personalData, isLoading, error } = useUserPersonalData();
  const [roles, setRoles] = useState<string[]>([]);
  
  useEffect(() => {
    if (!user) {
      setRoles([]);
      return;
    }
    
    // 管理员默认有admin角色
    if (user.github_id === '--admin--') {
      setRoles(['admin']);
      return;
    }
    
    if (personalData && personalData.roles) {
      // 获取用户角色
      const userRoles = personalData.roles.filter(role => 
        !selectedCaseId || role.case_id === selectedCaseId || !role.case_id
      ).map(role => role.role_name);
      setRoles(userRoles);
    } else {
      setRoles([]);
    }
  }, [user, selectedCaseId, personalData]);
  
  return { roles, isLoading, error };
}

/**
 * 批量检查操作权限
 * @param operationIds 操作ID列表
 * @returns 操作权限映射
 */
export function useOperationPermissions(operationIds: string[]) {
  const { user, selectedCaseId } = useAuth();
  const { data: personalData, isLoading, error } = useUserPersonalData();
  const [permissions, setPermissions] = useState<Record<string, boolean>>({});
  
  useEffect(() => {
    if (!user || !operationIds.length) {
      setPermissions({});
      return;
    }
    
    // 管理员拥有所有权限
    if (user.github_id === '--admin--') {
      const adminPermissions: Record<string, boolean> = {};
      operationIds.forEach(id => {
        adminPermissions[id] = true;
      });
      setPermissions(adminPermissions);
      return;
    }
    
    if (personalData && personalData.permissions) {
      const operationPermissions = personalData.permissions.operations || [];
      const permissionMap: Record<string, boolean> = {};
      
      operationIds.forEach(opId => {
        const hasOp = operationPermissions.some(op => 
          op.operation_id === opId && 
          op.can_execute &&
          (!selectedCaseId || op.case_id === selectedCaseId || !op.case_id)
        );
        permissionMap[opId] = hasOp;
      });
      
      setPermissions(permissionMap);
    } else {
      const emptyPermissions: Record<string, boolean> = {};
      operationIds.forEach(id => {
        emptyPermissions[id] = false;
      });
      setPermissions(emptyPermissions);
    }
  }, [user, operationIds, selectedCaseId, personalData]);
  
  return { permissions, isLoading, error };
}

/**
 * 清除用户权限缓存
 */
export function useClearPermissionCache() {
  const { user, selectedCaseId } = useAuth();

  const clearUserPermissions = async (caseId?: string) => {
    if (!user) return;

    try {
      // 使用新的数据缓存管理器清除用户个人数据
      await sendMessageToServiceWorker('clear_user_personal_data', {
        userId: user.id,
        caseId: caseId || selectedCaseId || null
      });
    } catch (error) {
      console.error('Error clearing user permissions:', error);
    }
  };

  const clearAllPermissions = async () => {
    try {
      // 使用新的数据缓存管理器清除所有缓存
      await sendMessageToServiceWorker('clear_all_cache', {});
    } catch (error) {
      console.error('Error clearing all permissions:', error);
    }
  };

  return { clearUserPermissions, clearAllPermissions };
}

/**
 * 同步权限数据到本地缓存
 */
export function useSyncPermissions() {
  const { user, selectedCaseId } = useAuth();

  const syncPermissions = async (personalData: unknown) => {
    if (!user) return;

    try {
      // 使用新的数据缓存管理器同步用户个人数据
      await sendMessageToServiceWorker('sync_user_personal_data', {
        userId: user.id,
        caseId: selectedCaseId || null,
        personalData
      });
    } catch (error) {
      console.error('Error syncing permissions:', error);
      throw error;
    }
  };

  return { syncPermissions };
}

// Service Worker 消息工具函数
async function sendMessageToServiceWorker(type: string, payload: unknown): Promise<unknown> {
  // 在测试环境中提供回退
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return Promise.resolve({ success: true });
  }
  
  return new Promise((resolve, reject) => {
    if (!navigator.serviceWorker.controller) {
      reject(new Error('Service Worker controller not available'));
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
    
    // 发送消息到 Service Worker
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