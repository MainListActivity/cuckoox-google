import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userPersonalDataService, UserPersonalData } from '../services/userPersonalDataService';

export interface UseUserPersonalDataResult {
  personalData: UserPersonalData | null;
  isLoading: boolean;
  error: string | null;
  
  // 权限检查函数
  hasOperationPermission: (operationId: string) => boolean;
  hasMenuPermission: (menuId: string) => boolean;
  hasDataPermission: (tableName: string, crudType: 'create' | 'read' | 'update' | 'delete') => boolean;
  getUserRoles: () => string[];
  
  // 设置和最近访问相关
  updateSettings: (settings: Partial<UserPersonalData['settings']>) => Promise<void>;
  updateRecentAccess: (type: 'cases' | 'documents' | 'contacts', itemId: string) => Promise<void>;
  
  // 缓存管理
  refreshPersonalData: () => Promise<void>;
  clearCache: () => Promise<void>;
}

/**
 * 用户个人数据管理 Hook
 * 提供用户个人信息、权限、设置等数据的管理
 */
export function useUserPersonalData(): UseUserPersonalDataResult {
  const { user, selectedCaseId } = useAuth();
  const [personalData, setPersonalData] = useState<UserPersonalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 从Service Worker获取个人数据
  const fetchPersonalDataFromServiceWorker = useCallback(async () => {
    if (!user) return null;
    
    try {
      const result = await sendMessageToServiceWorker('get_user_personal_data', {
        userId: user.id.toString(),
        caseId: selectedCaseId?.toString() || null
      });
      
      return result.personalData as UserPersonalData;
    } catch (error) {
      console.error('useUserPersonalData: Error fetching from Service Worker:', error);
      return null;
    }
  }, [user, selectedCaseId]);

  // 从远程服务器获取个人数据
  const fetchPersonalDataFromRemote = useCallback(async () => {
    if (!user) return null;
    
    try {
      setIsLoading(true);
      setError(null);
      
      userPersonalDataService.setUserContext(user.id.toString(), selectedCaseId?.toString());
      
      const data = await userPersonalDataService.fetchUserPersonalData(
        user.id.toString(),
        selectedCaseId?.toString()
      );
      
      // 同步到Service Worker
      await userPersonalDataService.syncUserPersonalDataToServiceWorker(
        user.id.toString(),
        selectedCaseId?.toString()
      );
      
      return data;
    } catch (err) {
      console.error('useUserPersonalData: Error fetching from remote:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user, selectedCaseId]);

  // 加载个人数据
  const loadPersonalData = useCallback(async () => {
    if (!user) {
      setPersonalData(null);
      setIsLoading(false);
      return;
    }

    // 首先尝试从Service Worker获取缓存数据
    const cachedData = await fetchPersonalDataFromServiceWorker();
    
    if (cachedData) {
      setPersonalData(cachedData);
      setIsLoading(false);
      
      // 在后台检查是否需要更新
      const now = Date.now();
      const cacheAge = now - cachedData.syncTimestamp;
      const maxAge = 5 * 60 * 1000; // 5分钟
      
      if (cacheAge > maxAge) {
        // 缓存过期，在后台刷新
        fetchPersonalDataFromRemote().then(freshData => {
          if (freshData) {
            setPersonalData(freshData);
          }
        });
      }
    } else {
      // 没有缓存，从远程获取
      const freshData = await fetchPersonalDataFromRemote();
      if (freshData) {
        setPersonalData(freshData);
      }
    }
  }, [user, fetchPersonalDataFromServiceWorker, fetchPersonalDataFromRemote]);

  // 当用户或选中案件变化时重新加载数据
  useEffect(() => {
    loadPersonalData();
  }, [loadPersonalData]);

  // 权限检查函数
  const hasOperationPermission = useCallback((operationId: string): boolean => {
    if (!personalData) return false;
    
    // 检查操作权限
    return personalData.permissions.operations.some(permission => 
      permission.operation_id === operationId && 
      permission.can_execute &&
      (!permission.case_id || permission.case_id === selectedCaseId?.toString())
    );
  }, [personalData, selectedCaseId]);

  const hasMenuPermission = useCallback((menuId: string): boolean => {
    if (!personalData) return false;
    
    // 检查菜单权限
    return personalData.permissions.menus.some(permission => 
      permission.menu_id === menuId && 
      permission.can_access &&
      (!permission.case_id || permission.case_id === selectedCaseId?.toString())
    );
  }, [personalData, selectedCaseId]);

  const hasDataPermission = useCallback((
    tableName: string,
    crudType: 'create' | 'read' | 'update' | 'delete'
  ): boolean => {
    if (!personalData) return false;
    
    // 检查数据权限
    const dataPermission = personalData.permissions.dataAccess.find(permission => 
      permission.table_name === tableName &&
      (!permission.case_id || permission.case_id === selectedCaseId?.toString())
    );
    
    return dataPermission ? dataPermission.crud_permissions[crudType] : false;
  }, [personalData, selectedCaseId]);

  const getUserRoles = useCallback((): string[] => {
    if (!personalData) return [];
    
    const roles = [...personalData.roles.global];
    
    // 添加当前案件的角色
    if (selectedCaseId) {
      const caseRoles = personalData.roles.case[selectedCaseId.toString()] || [];
      roles.push(...caseRoles);
    }
    
    return [...new Set(roles)]; // 去重
  }, [personalData, selectedCaseId]);

  // 更新设置
  const updateSettings = useCallback(async (settings: Partial<UserPersonalData['settings']>) => {
    if (!user) return;
    
    try {
      await userPersonalDataService.updateUserSettings(user.id.toString(), settings);
      
      // 更新本地状态
      setPersonalData(prev => prev ? {
        ...prev,
        settings: { ...prev.settings, ...settings },
        syncTimestamp: Date.now()
      } : null);
      
    } catch (error) {
      console.error('useUserPersonalData: Error updating settings:', error);
      throw error;
    }
  }, [user]);

  // 更新最近访问
  const updateRecentAccess = useCallback(async (
    type: 'cases' | 'documents' | 'contacts',
    itemId: string
  ) => {
    if (!user) return;
    
    try {
      await userPersonalDataService.updateUserRecentAccess(user.id.toString(), type, itemId);
      
      // 更新本地状态
      setPersonalData(prev => {
        if (!prev) return null;
        
        const currentList = prev.recentAccess[type] || [];
        const newList = [itemId, ...currentList.filter(id => id !== itemId)].slice(0, 10);
        
        return {
          ...prev,
          recentAccess: {
            ...prev.recentAccess,
            [type]: newList
          },
          syncTimestamp: Date.now()
        };
      });
      
    } catch (error) {
      console.error('useUserPersonalData: Error updating recent access:', error);
      throw error;
    }
  }, [user]);

  // 刷新个人数据
  const refreshPersonalData = useCallback(async () => {
    const freshData = await fetchPersonalDataFromRemote();
    if (freshData) {
      setPersonalData(freshData);
    }
  }, [fetchPersonalDataFromRemote]);

  // 清除缓存
  const clearCache = useCallback(async () => {
    if (!user) return;
    
    try {
      await userPersonalDataService.clearUserPersonalDataCache(
        user.id.toString(),
        selectedCaseId?.toString()
      );
      
      // 重新加载数据
      await refreshPersonalData();
      
    } catch (error) {
      console.error('useUserPersonalData: Error clearing cache:', error);
      throw error;
    }
  }, [user, selectedCaseId, refreshPersonalData]);

  return {
    personalData,
    isLoading,
    error,
    hasOperationPermission,
    hasMenuPermission,
    hasDataPermission,
    getUserRoles,
    updateSettings,
    updateRecentAccess,
    refreshPersonalData,
    clearCache
  };
}

// Service Worker 消息工具函数
async function sendMessageToServiceWorker(type: string, payload: unknown): Promise<any> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    throw new Error('Service Worker not available');
  }
  
  // 等待Service Worker就绪
  await waitForServiceWorkerReady();
  
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

// Service Worker 就绪等待函数
async function waitForServiceWorkerReady(): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) {
    throw new Error('Service Worker not available');
  }
  
  // 如果已经有controller，直接返回
  if (navigator.serviceWorker.controller) {
    return;
  }
  
  // 等待Service Worker就绪
  try {
    await navigator.serviceWorker.ready;
    
    // 等待一小段时间确保controller已设置
    let attempts = 0;
    const maxAttempts = 50; // 最多等待5秒
    
    while (!navigator.serviceWorker.controller && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    if (!navigator.serviceWorker.controller) {
      throw new Error('Service Worker controller not available after waiting');
    }
  } catch (error) {
    console.error('Failed to wait for Service Worker:', error);
    throw error;
  }
}

/**
 * 专门用于权限检查的简化 Hook
 */
export function usePermissionCheck() {
  const { hasOperationPermission, hasMenuPermission, hasDataPermission, getUserRoles } = useUserPersonalData();
  
  return {
    hasOperationPermission,
    hasMenuPermission,
    hasDataPermission,
    getUserRoles
  };
}

/**
 * 用户设置管理 Hook
 */
export function useUserSettings() {
  const { personalData, updateSettings, isLoading, error } = useUserPersonalData();
  
  return {
    settings: personalData?.settings || null,
    updateSettings,
    isLoading,
    error
  };
}

/**
 * 用户最近访问管理 Hook
 */
export function useUserRecentAccess() {
  const { personalData, updateRecentAccess, isLoading, error } = useUserPersonalData();
  
  return {
    recentAccess: personalData?.recentAccess || { cases: [], documents: [], contacts: [] },
    updateRecentAccess,
    isLoading,
    error
  };
}