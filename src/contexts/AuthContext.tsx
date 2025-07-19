import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import authService from '@/src/services/authService';
import { useSurrealClient, useServiceWorkerComm, useSurreal } from '@/src/contexts/SurrealProvider';
import { queryWithAuth } from '@/src/utils/surrealAuth';
import { User as OidcUser } from 'oidc-client-ts';
import { jsonify, RecordId } from 'surrealdb';
import { menuService } from '@/src/services/menuService';


// Matches AppUser in authService and user table in SurrealDB
export interface AppUser {
  id: RecordId; // SurrealDB record ID, e.g., user:xxxx
  github_id: string;
  name: string;
  email?: string;
  created_at?: Date;
  updated_at?: Date;
  last_login_case_id?: RecordId | null; // SurrealDB record ID for case
}

// Define Case and Role interfaces based on SurrealDB schema

// START NavItemType definition
export interface NavItemType {
  id: string; // Unique identifier for the menu item
  path: string;
  labelKey: string; // Key for i18n translation
  iconName: string; // String key to map to an MDI icon (e.g., 'mdiViewDashboard')
  requiredRoles?: readonly string[]; // 修改为只读数组
  children?: readonly NavItemType[]; // 修改为只读数组
}
// END NavItemType definition

export interface Case {
  id: RecordId; // e.g., case:xxxx
  name: string;
  case_number?: string;
  status?: string; // For case process status, e.g., "立案"
  // Add other case properties as needed
}

export interface Role {
  id: RecordId; // e.g., role:xxxx
  name: string;
  description?: string;
  // Add other role properties
}


// 权限检查结果接口
export interface PermissionCheckResult {
  hasPermission: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface AuthContextType {
  isLoggedIn: boolean;
  user: AppUser | null;
  oidcUser: OidcUser | null;
  setAuthState: (appUser: AppUser, oidcUserInstance?: OidcUser | null) => void;
  logout: () => Promise<void>;
  isLoading: boolean; // For main auth state

  // Case and Role specific state and functions
  selectedCaseId: RecordId | null; // Store as string (e.g. "case:xxxx")
  selectedCase: Case | null;
  userCases: Case[];
  currentUserCaseRoles: Role[];
  isCaseLoading: boolean; // For loading cases and case-specific roles
  selectCase: (caseId: RecordId | string) => Promise<void>;
  hasRole: (roleName: string) => boolean;
  refreshUserCasesAndRoles: () => Promise<void>; // Exposed function to manually refresh

  // Menu specific state and functions
  navMenuItems: NavItemType[] | null;
  isMenuLoading: boolean;

  // Navigation state
  navigateTo: string | null;
  clearNavigateTo: () => void;

  // Permission related methods (compatible with usePermission hooks)
  useOperationPermission: (operationId: string) => PermissionCheckResult;
  useOperationPermissions: (operationIds: string[]) => { permissions: Record<string, boolean>; isLoading: boolean; error: string | null };
  useMenuPermission: (menuId: string) => PermissionCheckResult;
  useDataPermission: (tableName: string, crudType: 'create' | 'read' | 'update' | 'delete') => PermissionCheckResult;
  useUserRoles: () => { roles: string[]; isLoading: boolean; error: string | null };
  useClearPermissionCache: () => { clearUserPermissions: (caseId?: string) => Promise<void>; clearAllPermissions: () => Promise<void> };
  useSyncPermissions: () => { syncPermissions: (userData: unknown) => Promise<void> };

  // Test-only methods (only available in test environment)
  __TEST_setCurrentUserCaseRoles?: (roles: Role[]) => void;
  __TEST_setSelectedCaseId?: (caseId: RecordId | null) => void;
  __TEST_setUserCases?: (cases: Case[]) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
const CREDITOR_MANAGEMENT_PATH = '/creditors'; // Define target path


// 序列化RecordId为localStorage
const serializeRecordId = (recordId: RecordId | null): string => {
  return JSON.stringify(recordId ? jsonify(recordId) : null);
};

// 反序列化RecordId从localStorage
const deserializeRecordId = (recordIdJson: string): RecordId | null => {
  const parsed = JSON.parse(recordIdJson);
  if (!parsed) return null;
  if (typeof parsed === 'string') {
    const parts = parsed.split(':');
    return new RecordId(parts[0], parts[1]);
  }
  return parsed;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const client = useSurrealClient(); // Use SurrealClient directly
  const serviceWorkerComm = useServiceWorkerComm();
  const { isConnected, getAuthStatus, surreal } = useSurreal(); // 获取连接状态
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [oidcUser, setOidcUser] = useState<OidcUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isCheckingUser = useRef<boolean>(false); // 追踪是否正在检查用户状态
  authService.setSurrealClient(surreal);

  // 注意：现在直接使用queryWithAuth，通过service worker进行数据库查询
  const [selectedCaseId, setSelectedCaseId] = useState<RecordId | null>(deserializeRecordId(localStorage.getItem('cuckoox-selectedCaseId') || 'null'));
  const [userCases, setUserCases] = useState<Case[]>([]);
  const selectedCase = useMemo(() => {
    return userCases.find(c => selectedCaseId && String(c.id) === String(selectedCaseId)) || null;
  }, [userCases, selectedCaseId]);
  const [currentUserCaseRoles, setCurrentUserCaseRoles] = useState<Role[]>([]);
  const [isCaseLoading, setIsCaseLoading] = useState<boolean>(false);
  const [navMenuItems, setNavMenuItems] = useState<NavItemType[] | null>(null);
  const [isMenuLoading, setIsMenuLoading] = useState<boolean>(false);
  const [navigateTo, setNavigateTo] = useState<string | null>(null); // Navigation state

  // 权限缓存状态
  const [operationPermissionsCache, setOperationPermissionsCache] = useState<Record<string, boolean>>({});
  const [menuPermissionsCache, setMenuPermissionsCache] = useState<Record<string, boolean>>({});
  const [dataPermissionsCache, setDataPermissionsCache] = useState<Record<string, boolean>>({});
  const [permissionsLoading, setPermissionsLoading] = useState<Record<string, boolean>>({});

  // Services are now automatically initialized in SurrealProvider

  const clearNavigateTo = () => setNavigateTo(null);

  // 权限缓存管理
  const clearPermissionCache = useCallback(() => {
    setOperationPermissionsCache({});
    setMenuPermissionsCache({});
    setDataPermissionsCache({});
    setPermissionsLoading({});
  }, []);

  // 异步加载权限并更新缓存
  const loadOperationPermission = useCallback(async (operationId: string): Promise<boolean> => {
    if (!user || !client) return false;

    // 管理员拥有所有权限
    if (user.github_id === '--admin--') {
      setOperationPermissionsCache(prev => ({ ...prev, [operationId]: true }));
      return true;
    }

    try {
      setPermissionsLoading(prev => ({ ...prev, [operationId]: true }));
      const result = await menuService.hasOperation(client, operationId, selectedCaseId);
      setOperationPermissionsCache(prev => ({ ...prev, [operationId]: result }));
      return result;
    } catch (error) {
      console.error('Error checking operation permission:', error);
      setOperationPermissionsCache(prev => ({ ...prev, [operationId]: false }));
      return false;
    } finally {
      setPermissionsLoading(prev => ({ ...prev, [operationId]: false }));
    }
  }, [user, client, selectedCaseId]);

  const loadOperationPermissions = useCallback(async (operationIds: string[]): Promise<Record<string, boolean>> => {
    if (!user || !client) {
      const result: Record<string, boolean> = {};
      operationIds.forEach(id => {
        result[id] = false;
      });
      return result;
    }

    // 管理员拥有所有权限
    if (user.github_id === '--admin--') {
      const result: Record<string, boolean> = {};
      operationIds.forEach(id => {
        result[id] = true;
      });
      setOperationPermissionsCache(prev => ({ ...prev, ...result }));
      return result;
    }

    try {
      operationIds.forEach(id => {
        setPermissionsLoading(prev => ({ ...prev, [id]: true }));
      });
      const result = await menuService.hasOperations(client, operationIds, selectedCaseId);
      setOperationPermissionsCache(prev => ({ ...prev, ...result }));
      return result;
    } catch (error) {
      console.error('Error checking operation permissions:', error);
      const result: Record<string, boolean> = {};
      operationIds.forEach(id => {
        result[id] = false;
      });
      setOperationPermissionsCache(prev => ({ ...prev, ...result }));
      return result;
    } finally {
      operationIds.forEach(id => {
        setPermissionsLoading(prev => ({ ...prev, [id]: false }));
      });
    }
  }, [user, client, selectedCaseId]);

  // 权限 hooks 实现
  const useOperationPermission = useCallback((operationId: string): PermissionCheckResult => {
    if (!user || !client) {
      return { hasPermission: false, isLoading: false, error: null };
    }

    // 管理员拥有所有权限
    if (user.github_id === '--admin--') {
      return { hasPermission: true, isLoading: false, error: null };
    }

    const hasPermission = operationPermissionsCache[operationId] !== undefined
      ? operationPermissionsCache[operationId]
      : false;
    const isLoading = permissionsLoading[operationId] || false;

    // 如果权限不在缓存中且不在加载状态，则异步加载
    if (operationPermissionsCache[operationId] === undefined && !isLoading) {
      loadOperationPermission(operationId);
    }

    return {
      hasPermission,
      isLoading,
      error: null
    };
  }, [operationPermissionsCache, permissionsLoading, user, client, loadOperationPermission]);

  const useOperationPermissions = useCallback((operationIds: string[]) => {
    if (!user || !client) {
      const permissions: Record<string, boolean> = {};
      operationIds.forEach(id => {
        permissions[id] = false;
      });
      return { permissions, isLoading: false, error: null };
    }

    // 管理员拥有所有权限
    if (user.github_id === '--admin--') {
      const permissions: Record<string, boolean> = {};
      operationIds.forEach(id => {
        permissions[id] = true;
      });
      return { permissions, isLoading: false, error: null };
    }

    const permissions: Record<string, boolean> = {};
    let isLoading = false;

    operationIds.forEach(id => {
      permissions[id] = operationPermissionsCache[id] !== undefined
        ? operationPermissionsCache[id]
        : false;
      if (permissionsLoading[id]) {
        isLoading = true;
      }
    });

    // 检查是否有未缓存的权限需要加载
    const uncachedIds = operationIds.filter(id =>
      operationPermissionsCache[id] === undefined && !permissionsLoading[id]
    );
    if (uncachedIds.length > 0) {
      loadOperationPermissions(uncachedIds);
    }

    return {
      permissions,
      isLoading,
      error: null
    };
  }, [operationPermissionsCache, permissionsLoading, user, client, loadOperationPermissions]);

  const useMenuPermission = useCallback((menuId: string): PermissionCheckResult => {
    // 先检查当前已加载的菜单项中是否包含该菜单
    if (navMenuItems) {
      const hasMenu = navMenuItems.some(menu => menu.id === menuId);
      if (hasMenu) {
        return { hasPermission: true, isLoading: false, error: null };
      }
    }

    const hasPermission = menuPermissionsCache[menuId] || false;
    const isLoading = permissionsLoading[menuId] || false;

    return {
      hasPermission,
      isLoading,
      error: null
    };
  }, [navMenuItems, menuPermissionsCache, permissionsLoading]);

  const useDataPermission = useCallback((tableName: string, crudType: 'create' | 'read' | 'update' | 'delete'): PermissionCheckResult => {
    const cacheKey = `${tableName}:${crudType}`;
    const hasPermission = dataPermissionsCache[cacheKey] || false;
    const isLoading = permissionsLoading[cacheKey] || false;

    return {
      hasPermission,
      isLoading,
      error: null
    };
  }, [dataPermissionsCache, permissionsLoading]);

  const useUserRoles = useCallback(() => {
    const roles = currentUserCaseRoles.map(role => role.name);
    return {
      roles,
      isLoading: false,
      error: null
    };
  }, [currentUserCaseRoles]);

  const useClearPermissionCache = useCallback(() => {
    const clearUserPermissions = async (caseId?: string) => {
      if (!user) return;

      try {
        // 清除用户缓存数据
        await serviceWorkerComm.sendMessage('clear_user_cache', {
          userId: user.id,
          caseId: caseId || null
        });
        clearPermissionCache();
      } catch (error) {
        console.error('Error clearing user permissions:', error);
      }
    };

    const clearAllPermissions = async () => {
      try {
        // 清除所有缓存
        await serviceWorkerComm.sendMessage('clear_all_cache', {});
        clearPermissionCache();
      } catch (error) {
        console.error('Error clearing all permissions:', error);
      }
    };

    return { clearUserPermissions, clearAllPermissions };
  }, [user, serviceWorkerComm, clearPermissionCache]);

  const useSyncPermissions = useCallback(() => {
    const syncPermissions = async (userData: unknown) => {
      if (!user) return;

      try {
        // 同步用户数据
        await serviceWorkerComm.sendMessage('sync_user_data', {
          userId: user.id,
          userData
        });
      } catch (error) {
        console.error('Error syncing permissions:', error);
        throw error;
      }
    };

    return { syncPermissions };
  }, [user, serviceWorkerComm]);

  // 当用户或案件改变时清除权限缓存
  useEffect(() => {
    clearPermissionCache();
  }, [user, selectedCaseId, clearPermissionCache]);

  const loadUserCasesAndRoles = useCallback(async (currentAppUser: AppUser | null) => {
    if (!currentAppUser || !currentAppUser.id || !isConnected) {
      if (!isConnected) {
        console.log('loadUserCasesAndRoles: SurrealDB not connected, skipping...');
      }
      setUserCases([]);
      setCurrentUserCaseRoles([]);
      setSelectedCaseId(null);
      localStorage.removeItem('cuckoox-selectedCaseId');
      setNavMenuItems([]); // Clear menu if no user
      return;
    }
    setIsCaseLoading(true);
    try {
      // 直接查询用户可访问的案件列表
      const casesQuery = `SELECT * FROM case;`;
      const fetchedCases: Case[] = await queryWithAuth(client, casesQuery);
      
      setUserCases(fetchedCases || []);

      // 确定要选择的案件
      const lastCaseId = currentAppUser.last_login_case_id;
      const previouslySelectedCaseId = deserializeRecordId(localStorage.getItem('cuckoox-selectedCaseId') || 'null');

      let caseToSelect: RecordId | null = null;

      // 优先使用localStorage中的选择
      if (previouslySelectedCaseId && fetchedCases?.some(c => String(c.id) === String(previouslySelectedCaseId))) {
        caseToSelect = previouslySelectedCaseId;
      } 
      // 其次使用用户上次登录的案件
      else if (lastCaseId && fetchedCases?.some(c => String(c.id) === String(lastCaseId))) {
        caseToSelect = lastCaseId;
      } 
      // 最后选择第一个可用案件
      else if (fetchedCases && fetchedCases.length > 0 && fetchedCases[0].id) {
        caseToSelect = fetchedCases[0].id;
      }

      if (caseToSelect) {
        setSelectedCaseId(caseToSelect);
        localStorage.setItem('cuckoox-selectedCaseId', serializeRecordId(caseToSelect));
        // 清空当前案件角色，后续通过权限系统查询
        setCurrentUserCaseRoles([]);
      } else {
        setCurrentUserCaseRoles([]);
        setSelectedCaseId(null);
        localStorage.removeItem('cuckoox-selectedCaseId');
        setNavMenuItems([]); // Clear menu if no case is selected after loading
      }

    } catch (error) {
      console.error("Error loading user cases and roles:", error);
      setUserCases([]);
      setCurrentUserCaseRoles([]);
      setSelectedCaseId(null);
      localStorage.removeItem('cuckoox-selectedCaseId');
      setNavMenuItems([]); // Clear menu on error
    } finally {
      setIsCaseLoading(false);
    }
  }, [isConnected, client]); // 简化依赖

  const clearAuthState = useCallback(async (shouldInvalidate: boolean = true) => {
    const currentUser = user;

    // 如果已经是清空状态，避免重复清除
    if (!currentUser && !isLoggedIn) {
      console.log('AuthContext: Already in cleared state, skipping clearAuthState');
      return;
    }

    setUser(null);
    setOidcUser(null);
    setIsLoggedIn(false);
    setSelectedCaseId(null);
    setUserCases([]);
    setCurrentUserCaseRoles([]);
    setNavMenuItems([]);

    // 只有在明确需要时才调用 invalidate
    if (shouldInvalidate) {
      authService.clearTokens(); // Clear tokens from localStorage
    }


    localStorage.removeItem('cuckoox-selectedCaseId');
    // 清理租户代码
    localStorage.removeItem('tenant_code');
  }, [user, isLoggedIn]);
  const initializeUserSession = useCallback(async (appUser: AppUser, oidcUserInstance?: OidcUser | null) => {
    setUser(appUser);
    setOidcUser(oidcUserInstance || null);
    setIsLoggedIn(true);

    // 注意：现在不需要手动保存用户数据，queryWithAuth会自动缓存

    await loadUserCasesAndRoles(appUser);
  }, [loadUserCasesAndRoles]);
  // 检查当前用户的函数
  const checkCurrentUser = useCallback(async (isMounted: () => boolean) => {
    if (!isMounted()) return;

    // 防止重复检查
    if (isCheckingUser.current) {
      console.log('AuthContext: Already checking user, skipping duplicate call');
      return;
    }

    // 使用函数内部的状态检查而不是依赖闭包
    const currentUser = user;
    const currentIsLoggedIn = isLoggedIn;

    // 如果已经有用户且已登录，避免重复检查
    if (currentUser && currentIsLoggedIn) {
      console.log('AuthContext: User already authenticated, skipping checkCurrentUser');
      return;
    }

    isCheckingUser.current = true;
    setIsLoading(true);

    try {
      // 等待Service Worker就绪
      await serviceWorkerComm.waitForReady();

      const result = await queryWithAuth<AppUser[]>(client, 'select * from user where id=$auth;');
      // 从SurrealDB获取登录状态
      if (result && result.length > 0) {
        await initializeUserSession(result[0], null);
        if (isMounted()) {
          setIsLoading(false);
        }
        return;
      }
      if (isMounted()) {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error checking current user session:", error);
      // 只有在关键错误时才清除状态，而不是每次都清除
      if (isMounted() && isConnected) {
        await clearAuthState(false);
      }
    } finally {
      isCheckingUser.current = false;
      if (isMounted()) setIsLoading(false);
    }
  }, [serviceWorkerComm, getAuthStatus, isConnected, initializeUserSession, clearAuthState]);

  useEffect(() => {
    let isMounted = true;

    // 创建一个稳定的检查函数，避免依赖checkCurrentUser本身
    const performUserCheck = async () => {
      if (!isMounted) return;

      // 防止重复检查
      if (isCheckingUser.current) {
        console.log('AuthContext: Already checking user, skipping duplicate call');
        return;
      }

      // 如果已经有用户且已登录，避免重复检查
      if (user && isLoggedIn) {
        console.log('AuthContext: User already authenticated, skipping checkCurrentUser');
        return;
      }

      await checkCurrentUser(() => isMounted);
    };

    // 只有在有意义的状态变化时才检查用户
    if (isConnected) {
      performUserCheck();
    }

    return () => {
      isMounted = false;
    };
  }, [isConnected]); // 移除checkCurrentUser依赖

  // 监听认证状态变化事件
  useEffect(() => {
    const handleAuthStateChange = (event: CustomEvent) => {
      const { isAuthenticated, reason, timestamp } = event.detail;
      console.log('AuthContext: Received auth state change event:', { isAuthenticated, reason, timestamp });

      // 如果用户未认证，清除认证状态并重定向到登录页面
      if (!isAuthenticated) {
        console.log('AuthContext: User not authenticated, clearing auth state');

        // 异步清除认证状态，避免阻塞事件处理
        setTimeout(async () => {
          try {
            await clearAuthState(true);

            // 重定向到登录页面
            if (window.location.pathname !== '/login') {
              console.log('AuthContext: Redirecting to login page');
              window.location.href = '/login';
            }
          } catch (error) {
            console.error('AuthContext: Error clearing auth state:', error);
          }
        }, 0);
      }
    };

    // 添加事件监听器
    window.addEventListener('auth-state-changed', handleAuthStateChange as EventListener);

    // 清理事件监听器
    return () => {
      window.removeEventListener('auth-state-changed', handleAuthStateChange as EventListener);
    };
  }, [clearAuthState]);

  const setAuthState = (appUser: AppUser, oidcUserInstance?: OidcUser | null) => {
    initializeUserSession(appUser, oidcUserInstance);
  };

  // 更新菜单状态
  const fetchAndUpdateMenuPermissions = useCallback(async () => {
    console.log('fetchAndUpdateMenuPermissions called');

    if (!user) {
      console.log('No user, clearing menu items');
      setNavMenuItems([]);
      return;
    }

    if (!client) {
      console.log('No client available, skipping menu load');
      return;
    }

    console.log('Loading menus for user:', user.id, 'case:', selectedCaseId);
    setIsMenuLoading(true);

    try {
      // 直接使用图查询函数加载用户可访问的菜单
      console.log('Loading menus using fn::get_user_menus...');
      const dbMenuItems = await menuService.loadUserMenus(
        client,
        selectedCaseId || null
      );
      console.log('Database menu items:', dbMenuItems);

      // 只有当菜单项确实发生变化时才更新状态
      setNavMenuItems(prevMenuItems => {
        // 比较新旧菜单项是否相同
        if (JSON.stringify(prevMenuItems) === JSON.stringify(dbMenuItems)) {
          return prevMenuItems; // 返回旧状态，避免不必要的重新渲染
        }
        return dbMenuItems;
      });

      console.log('Menu items loaded:', {
        userId: user.id.toString(),
        caseId: selectedCaseId?.toString() || null,
        menuCount: dbMenuItems.length
      });

    } catch (error) {
      console.error('Error updating menu permissions:', error);
      // 出错时设置为空菜单
      setNavMenuItems([]);
    } finally {
      setIsMenuLoading(false);
    }
  }, [user, selectedCaseId, client]); // 修复依赖

  // Helper function to update last selected case in DB
  const updateLastSelectedCaseInDB = async (userId: RecordId, caseId: RecordId) => {
    if (!userId || !caseId || !isConnected) {
      console.warn('updateLastSelectedCaseInDB: missing userId/caseId or DB not connected.');
      return;
    }
    try {
      await queryWithAuth(client, 'UPDATE user SET last_login_case_id = $caseId WHERE id = $userId;', {
        userId,
        caseId,
      });
      console.log(`Successfully updated last_selected_case_id for user ${userId} to ${caseId}`);
    } catch (error) {
      console.error('Failed to update last_selected_case_id in DB:', error);
    }
  };


  const selectCase = async (caseIdToSelect: RecordId | string) => {
    if (!user || !user.id || !isConnected) {
      console.error("User not available or SurrealDB not connected for selecting case.");
      setIsCaseLoading(false); // Ensure loading state is reset
      return;
    }

    // 将字符串转换为RecordId对象
    let recordId: RecordId;
    if (typeof caseIdToSelect === 'string') {
      if (caseIdToSelect.includes(':')) {
        const parts = caseIdToSelect.split(':');
        recordId = new RecordId(parts[0], parts[1]);
      } else {
        recordId = new RecordId('case', caseIdToSelect);
      }
    } else {
      recordId = caseIdToSelect;
    }

    setIsCaseLoading(true);
    try {
      // 检查案件是否在用户可访问的案件列表中
      const caseExistsForUser = userCases.some(c => c.id.toString() === recordId.toString());
      if (!caseExistsForUser) {
        console.warn("selectCase called with a caseId not in the current userCases list.");
        return;
      }

      // 直接设置选中的案件ID
      setSelectedCaseId(recordId);
      localStorage.setItem('cuckoox-selectedCaseId', serializeRecordId(recordId));
      
      // 清空当前案件角色，后续通过权限系统查询
      setCurrentUserCaseRoles([]);

      // 更新数据库中的用户last_login_case_id
      await client.merge(user.id, { last_login_case_id: recordId });

      // 更新本地用户对象
      setUser(prevUser => prevUser ? { ...prevUser, last_login_case_id: recordId } : null);

      // 更新数据库中的last_login_case_id（备用方式）
      if (user?.id) {
        await updateLastSelectedCaseInDB(user.id, recordId);
      }

    } catch (error) {
      console.error(`Error selecting case ${recordId}:`, error);
    } finally {
      setIsCaseLoading(false);
    }
  };

  const refreshUserCasesAndRoles = async () => {
    if (user && isConnected) {
      await loadUserCasesAndRoles(user);
    } else if (!isConnected) {
      console.log('refreshUserCasesAndRoles: SurrealDB not connected, skipping...');
    }
  };

  const logout = async () => {
    // 检查是否有用户会话
    if (!user) {
      console.warn("Logout called without a user session.");
      await clearAuthState();
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const isAdmin = user.github_id === '--admin--';
    const isRootAdmin = user.github_id.startsWith('root_admin_');
    const isPasswordUser = user.github_id.startsWith('local_') || isRootAdmin;

    try {
      // 统一先清理本地存储和状态
      await clearAuthState();

      // 根据用户类型执行不同的登出操作
      if (isAdmin) {
        await authService.signout();
        console.log('Admin user signed out from SurrealDB.');
      } else if (isPasswordUser) {
        // 密码登录用户，只清理令牌，不走 OIDC 流程
        await authService.signout();
        console.log('Password user signed out from SurrealDB.');
        // 直接重定向到登录页面
        window.location.href = '/login';
      } else {
        // OIDC 登录用户，走 OIDC 退出流程
        await authService.logoutRedirect();
      }
    } catch (error) {
      // 统一错误处理
      console.error("Error during logout process:", error);
      // 确保即使出错也能重定向到登录页面
      window.location.href = '/login';
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 只有当用户存在并且 SurrealDB 连接已建立并且 client 可用时才加载菜单
    if (user && isConnected && client) {
      console.log('User ready and SurrealDB connected, loading menus...');
      fetchAndUpdateMenuPermissions();
    } else if (!user) {
      setNavMenuItems([]); // Clear menu if no user
    } else if (user && !isConnected) {
      console.log('User ready but SurrealDB not connected yet, waiting...');
    } else if (user && isConnected && !client) {
      console.log('User ready and SurrealDB connected but client not available yet, waiting...');
    }
  }, [user, isConnected, selectedCaseId, fetchAndUpdateMenuPermissions, client]);

  // Effect for automatic navigation to creditor management
  useEffect(() => {
    if (isLoggedIn && selectedCaseId && userCases.length > 0 && navMenuItems && !isCaseLoading && !isMenuLoading) {
      const selectedCase = userCases.find(c => c.id === selectedCaseId);
      if (selectedCase && selectedCase.status === '立案') {
        const canNavigateToCreditors = navMenuItems.some(item => item.path === CREDITOR_MANAGEMENT_PATH);
        if (canNavigateToCreditors) {
          // Check if already on the creditors page to prevent navigation loop
          // This requires access to current location, which is not ideal in context.
          // The consuming component (App.tsx) will handle preventing re-navigation if already there.
          setNavigateTo(CREDITOR_MANAGEMENT_PATH);
        }
      }
    }
  }, [isLoggedIn, selectedCaseId, userCases, navMenuItems, isCaseLoading, isMenuLoading]);

  const hasRole = (roleName: string): boolean => {
    // 如果没有用户登录,直接返回false
    if (!user) {
      return false;
    }

    // 检查是否为管理员
    if (user.github_id === '--admin--') {
      return true; // 管理员拥有所有权限
    }

    // 对于普通用户,需要检查具体角色权限
    if (roleName === 'admin') {
      return false; // 非管理员用户没有admin权限
    }

    // 其他角色权限判断
    // 如果没有选择案件或没有角色,返回false
    if (!selectedCaseId || currentUserCaseRoles.length === 0) {
      return false;
    }

    // 检查用户在当前案件中是否拥有指定角色
    return currentUserCaseRoles.some(role => role.name === roleName);
  };

  // Test-only methods
  const __TEST_setCurrentUserCaseRoles = process.env.NODE_ENV === 'test' ? setCurrentUserCaseRoles : undefined;
  const __TEST_setSelectedCaseId = process.env.NODE_ENV === 'test' ? setSelectedCaseId : undefined;
  const __TEST_setUserCases = process.env.NODE_ENV === 'test' ? setUserCases : undefined;

  return (
    <AuthContext.Provider value={{
      isLoggedIn,
      user,
      oidcUser,
      setAuthState,
      logout,
      isLoading,
      selectedCaseId,
      selectedCase,
      userCases,
      currentUserCaseRoles,
      isCaseLoading,
      selectCase,
      hasRole,
      refreshUserCasesAndRoles,
      navMenuItems,
      isMenuLoading, // Expose new menu state
      navigateTo,
      clearNavigateTo, // Expose navigation state and clear function
      // Permission related methods (compatible with usePermission hooks)
      useOperationPermission,
      useOperationPermissions,
      useMenuPermission,
      useDataPermission,
      useUserRoles,
      useClearPermissionCache,
      useSyncPermissions,
      __TEST_setCurrentUserCaseRoles,
      __TEST_setSelectedCaseId,
      __TEST_setUserCases // Expose test-only methods
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};