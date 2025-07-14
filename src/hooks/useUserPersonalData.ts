import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useServiceWorkerComm } from '../contexts/SurrealProvider';
import { userPersonalDataService, UserPersonalData } from '../services/userPersonalDataService';

export interface UseUserPersonalDataResult {
  personalData: UserPersonalData | null;
  isLoading: boolean;
  error: string | null;
  
  // 权限检查函数
  hasOperationPermission: (operationId: string) => boolean;
  hasMenuPermission: (menuId: string) => boolean;
  // hasDataPermission: (tableName: string, crudType: 'create' | 'read' | 'update' | 'delete') => boolean;
  getUserRoles: () => string[];
  
  // 设置和最近访问相关
  // updateSettings: (settings: Partial<UserPersonalData['settings']>) => Promise<void>;
  // updateRecentAccess: (type: 'cases' | 'documents' | 'contacts', itemId: string) => Promise<void>;
  
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
  const serviceWorkerComm = useServiceWorkerComm();
  const [personalData, setPersonalData] = useState<UserPersonalData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 使用 useRef 来存储稳定的引用，避免循环依赖
  const loadingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);
  const lastCaseIdRef = useRef<string | null>(null);

  // 从Service Worker获取个人数据
  const fetchPersonalDataFromServiceWorker = useCallback(async (userId: string, caseId?: string) => {
    try {
      const result = await serviceWorkerComm.sendMessage('get_user_personal_data', {
        userId,
        caseId: caseId || null
      });
      
      return result.personalData as UserPersonalData;
    } catch (error) {
      console.error('useUserPersonalData: Error fetching from Service Worker:', error);
      return null;
    }
  }, [serviceWorkerComm]);

  // 从远程服务器获取个人数据
  const fetchPersonalDataFromRemote = useCallback(async (userId: string, caseId?: string) => {
    try {
      setError(null);
      
      userPersonalDataService.setUserContext(userId, caseId);
      
      const data = await userPersonalDataService.fetchUserPersonalData(userId, caseId);
      
      // 同步到Service Worker
      await userPersonalDataService.syncUserPersonalDataToServiceWorker(userId, caseId);
      
      return data;
    } catch (err) {
      console.error('useUserPersonalData: Error fetching from remote:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      return null;
    }
  }, []);

  // 加载个人数据
  const loadPersonalData = useCallback(async (userId: string, caseId?: string) => {
    // 防止并发请求
    if (loadingRef.current) {
      return;
    }
    
    loadingRef.current = true;
    setIsLoading(true);

    try {
      // 首先尝试从Service Worker获取缓存数据
      const cachedData = await fetchPersonalDataFromServiceWorker(userId, caseId);
      
      if (cachedData) {
        setPersonalData(cachedData);
        setIsLoading(false);
        
        // 在后台检查是否需要更新
        const now = Date.now();
        const cacheAge = now - cachedData.syncTimestamp;
        const maxAge = 5 * 60 * 1000; // 5分钟
        
        if (cacheAge > maxAge) {
          // 缓存过期，在后台刷新
          const freshData = await fetchPersonalDataFromRemote(userId, caseId);
          if (freshData) {
            setPersonalData(freshData);
          }
        }
      } else {
        // 没有缓存，从远程获取
        const freshData = await fetchPersonalDataFromRemote(userId, caseId);
        if (freshData) {
          setPersonalData(freshData);
        }
        setIsLoading(false);
      }
    } catch (error) {
      console.error('useUserPersonalData: Error loading personal data:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setIsLoading(false);
    } finally {
      loadingRef.current = false;
    }
  }, [fetchPersonalDataFromServiceWorker, fetchPersonalDataFromRemote]);

  // 当用户或选中案件变化时重新加载数据
  useEffect(() => {
    if (!user) {
      setPersonalData(null);
      setIsLoading(false);
      setError(null);
      lastUserIdRef.current = null;
      lastCaseIdRef.current = null;
      return;
    }

    const userId = user.id.toString();
    const caseId = selectedCaseId?.toString();
    
    // 检查是否真的需要重新加载
    if (lastUserIdRef.current === userId && lastCaseIdRef.current === caseId) {
      return;
    }

    // 更新引用
    lastUserIdRef.current = userId;
    lastCaseIdRef.current = caseId;

    // 重新加载数据
    loadPersonalData(userId, caseId);
  }, [user, selectedCaseId, loadPersonalData]);

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
    return personalData.menus.some(permission => 
      permission.id === menuId
    );
  }, [personalData]);


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

  // 刷新个人数据
  const refreshPersonalData = useCallback(async () => {
    if (!user) return;
    
    const userId = user.id.toString();
    const caseId = selectedCaseId?.toString();
    
    const freshData = await fetchPersonalDataFromRemote(userId, caseId);
    if (freshData) {
      setPersonalData(freshData);
    }
  }, [user, selectedCaseId, fetchPersonalDataFromRemote]);

  // 清除缓存
  const clearCache = useCallback(async () => {
    if (!user) return;
    
    try {
      await userPersonalDataService.clearUserPersonalDataCache(
        user.id.toString(),
        selectedCaseId?.toString()
      );
      
      // 重新加载数据
      await loadPersonalData(user.id.toString(), selectedCaseId?.toString());
      
    } catch (error) {
      console.error('useUserPersonalData: Error clearing cache:', error);
      throw error;
    }
  }, [user, selectedCaseId, loadPersonalData]);

  return {
    personalData,
    isLoading,
    error,
    hasOperationPermission,
    hasMenuPermission,
    getUserRoles,
    refreshPersonalData,
    clearCache
  };
}

/**
 * 专门用于权限检查的简化 Hook
 */
export function usePermissionCheck() {
  const { hasOperationPermission, hasMenuPermission, getUserRoles } = useUserPersonalData();
  
  return {
    hasOperationPermission,
    hasMenuPermission,
    getUserRoles
  };
}