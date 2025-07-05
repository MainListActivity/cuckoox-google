import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback, useMemo } from 'react';
import authService from '@/src/services/authService';
// import { db } from '@/src/lib/surreal'; // REMOVED
import {useSurreal} from '@/src/contexts/SurrealProvider'; // ADDED
import { User as OidcUser } from 'oidc-client-ts';
import { jsonify, RecordId } from 'surrealdb'; // Import for typing record IDs
import { menuService } from '@/src/services/menuService';
import { checkTenantCodeAndRedirect } from '@/src/lib/surrealClient';

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

// From user_case_role table, joining with case and role details
interface UserCaseRoleDetails {
  id: RecordId; // ID of the user_case_role record itself
  user_id: RecordId;
  case_details: Case; // Populated by SurrealDB FETCH
  role_details: Role;  // Populated by SurrealDB FETCH
}

export interface AuthContextType {
  isLoggedIn: boolean;
  user: AppUser | null;
  oidcUser: OidcUser | null;
  setAuthState: (appUser: AppUser, oidcUserInstance?: OidcUser | null) => void; // MODIFIED
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

  // Test-only methods (only available in test environment)
  __TEST_setCurrentUserCaseRoles?: (roles: Role[]) => void;
  __TEST_setSelectedCaseId?: (caseId: RecordId | null) => void;
  __TEST_setUserCases?: (cases: Case[]) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
const CREDITOR_MANAGEMENT_PATH = '/creditors'; // Define target path

// 序列化函数：将包含RecordId的对象转换为可存储的JSON字符串
const serializeAppUser = (user: AppUser): string => {
  return JSON.stringify(jsonify(user));
};

// 反序列化函数：将JSON字符串转换回包含RecordId的对象
const deserializeAppUser = (userJson: string): AppUser => {
  const parsed = JSON.parse(userJson);
  return {
    ...parsed,
    id: typeof parsed.id === 'string' ? new RecordId(parsed.id.split(':')[0], parsed.id.split(':')[1]) : parsed.id,
    last_login_case_id: parsed.last_login_case_id 
      ? (typeof parsed.last_login_case_id === 'string' 
          ? new RecordId(parsed.last_login_case_id.split(':')[0], parsed.last_login_case_id.split(':')[1])
          : parsed.last_login_case_id)
      : null
  };
};

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
  const {surreal:client,signout,setTokens,clearTokens,isSuccess,handleSessionError} = useSurreal(); // ADDED
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [oidcUser, setOidcUser] = useState<OidcUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize menuService with SurrealDB client
  useEffect(() => {
    console.log('Setting menuService client:', client);
    menuService.setClient(client);
  }, [client]);



  const clearNavigateTo = () => setNavigateTo(null);

  // Token refresh functionality
  const refreshAccessToken = async (): Promise<boolean> => {
    try {
      const refreshToken = localStorage.getItem('refresh_token'); // Updated key name
      if (!refreshToken) {
        console.error('No refresh token available');
        return false;
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8082'}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      const data = await response.json();

      // Handle the current backend response which returns 501 Not Implemented
      if (response.status === 501) {
        console.warn('Token refresh not yet implemented on backend:', data.message);
        clearAuthState();//Token过期且无法刷新的情况下，直接重新登录
        return false;
      }

      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }
      
      if (data.access_token) {
        // Store the new tokens
        setTokens(data.access_token, data.refresh_token, data.expires_in);
        
        // Re-authenticate with SurrealDB using the new token
        await client.authenticate(data.access_token);
        
        console.log('Access token refreshed successfully');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      return false;
    }
  };

  // Set up automatic token refresh
  const setupTokenRefresh = () => {
    // Clear existing timer
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    const checkAndRefreshToken = async () => {
      // 首先检查租户代码是否存在
      if (!checkTenantCodeAndRedirect()) {
        // 租户代码丢失，用户已被重定向到登录页面
        console.log('Tenant code missing, user redirected to login');
        clearAuthState();
        return;
      }
      
      const expiresAtStr = localStorage.getItem('token_expires_at'); // Updated key name
      if (!expiresAtStr) return;
      
      const expiresAt = parseInt(expiresAtStr, 10);
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      
      // Refresh token if it expires within 10 minutes (600000 ms)
      if (timeUntilExpiry <= 600000 && timeUntilExpiry > 0) {
        console.log('Token expiring soon, attempting refresh...');
        const success = await refreshAccessToken();
        if (!success) {
          console.error('Failed to refresh token, logging out user');
          // Don't call logout here to avoid potential infinite loops
          clearAuthState();
        }
      }
    };

    // Check every 5 minutes instead of every minute to reduce frequency
    refreshTimerRef.current = setInterval(checkAndRefreshToken, 300000);
    
    // Also check immediately, but with a delay to avoid blocking
    setTimeout(checkAndRefreshToken, 1000);
  };

  // Clear token refresh timer
  const clearTokenRefresh = () => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  };

  useEffect(() => {
    let isMounted = true; // Flag to prevent state updates after unmount
    
    const checkCurrentUser = async () => {
      if (!isMounted) return;
      setIsLoading(true);
      
      try {
        // 首先检查租户代码是否存在（除了管理员用户）
        const storedUser = localStorage.getItem('cuckoox-user');
        const storedIsLoggedIn = localStorage.getItem('cuckoox-isLoggedIn');
        
        if (storedUser && storedIsLoggedIn === 'true') {
          // 如果有本地存储的用户信息，先使用它来初始化会话
          const appUser = deserializeAppUser(storedUser);
          
          // 对于非管理员用户，检查租户代码
          if (appUser.github_id !== '--admin--' && !appUser.github_id.startsWith('root_admin_')) {
            if (!checkTenantCodeAndRedirect()) {
              // 租户代码丢失，清除状态并退出
              if (isMounted) {
                clearAuthState();
                setIsLoading(false);
              }
              return;
            }
          }
          
          // 对于管理员用户，不需要检查 OIDC
          if (appUser.github_id === '--admin--') {
            if (isMounted) {
              await initializeUserSession(appUser, null);
            }
            return;
          }
          
          // 对于普通用户，先恢复会话，然后异步检查 OIDC 状态
          if (isMounted) {
            await initializeUserSession(appUser, null);
          }
          
          // 异步检查 OIDC 状态（不阻塞用户使用）
          authService.getUser().then(async (currentOidcUser) => {
            if (!isMounted) return;
            
            if (currentOidcUser && !currentOidcUser.expired) {
              // OIDC 会话有效，更新 oidcUser
              setOidcUser(currentOidcUser);
              
              // 可选：同步更新数据库中的用户信息
              const githubId = currentOidcUser.profile.sub;
              if (githubId && githubId === appUser.github_id) {
                const userRecordId = `user:${githubId}`;
                try {
                  const result = await client.select(userRecordId);
                  if (result && result.length > 0 && isMounted) {
                    const appUserFromDb = result[0] as unknown as AppUser;
                    setUser(appUserFromDb);
                    localStorage.setItem('cuckoox-user', serializeAppUser(appUserFromDb));
                  }
                } catch (error) {
                  console.error("Error syncing user data from DB:", error);
                }
              }
            } else {
              // OIDC 会话已过期，但保持用户登录状态
              console.log("OIDC session expired, but keeping user logged in with stored credentials");
              if (isMounted) setOidcUser(null);
            }
          }).catch((error) => {
            console.error("Error checking OIDC session:", error);
            // 即使 OIDC 检查失败，也保持用户登录状态
            if (isMounted) setOidcUser(null);
          });
        } else {
          // 没有本地存储的用户信息，检查 OIDC
          const currentOidcUser = await authService.getUser();
          if (currentOidcUser && !currentOidcUser.expired) {
            const githubId = currentOidcUser.profile.sub;
            if (!githubId) {
              throw new Error("No github_id (sub) found in OIDC user profile during session check.");
            }
            const userRecordId = `user:${githubId}`;
            const result = await client.select(userRecordId);

            if (result && result.length > 0) {
              const appUserFromDb = result[0] as unknown as AppUser;
              if (isMounted) {
                await initializeUserSession(appUserFromDb, currentOidcUser);
              }
            } else {
              console.warn(`User ${githubId} found in OIDC but not in DB. Logging out.`);
              if (isMounted) clearAuthState();
            }
          } else {
            // 没有有效的会话
            if (isMounted) clearAuthState();
          }
        }
      } catch (error) {
        console.error("Error checking current user session:", error);
        if (isMounted) clearAuthState();
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    checkCurrentUser();
    
    return () => {
      isMounted = false; // Cleanup flag
    };
  }, []); // Empty dependency array is correct here

  const clearAuthState = () => {
    setUser(null);
    setOidcUser(null);
    setIsLoggedIn(false);
    setSelectedCaseId(null);
    setUserCases([]);
    setCurrentUserCaseRoles([]);
    setNavMenuItems([]);
    clearTokenRefresh(); // Clear token refresh timer
    clearTokens(); // Clear tokens from localStorage
    localStorage.removeItem('cuckoox-isLoggedIn');
    localStorage.removeItem('cuckoox-user');
    localStorage.removeItem('cuckoox-selectedCaseId');
    // 清理租户代码
    localStorage.removeItem('tenant_code');
  };

  const initializeUserSession = async (appUser: AppUser, oidcUserInstance?: OidcUser | null) => { // MODIFIED
    setUser(appUser);
    setOidcUser(oidcUserInstance || null); // MODIFIED to handle undefined
    setIsLoggedIn(true);
    localStorage.setItem('cuckoox-isLoggedIn', 'true');
    localStorage.setItem('cuckoox-user', serializeAppUser(appUser));
    
    // Set up automatic token refresh for authenticated users
    setupTokenRefresh();
    
    await loadUserCasesAndRoles(appUser);
  };
  
  const setAuthState = (appUser: AppUser, oidcUserInstance?: OidcUser | null) => { // MODIFIED
    initializeUserSession(appUser, oidcUserInstance);
  };

  const loadUserCasesAndRoles = async (currentAppUser: AppUser | null) => {
    if (!currentAppUser || !currentAppUser.id) {
      setUserCases([]);
      setCurrentUserCaseRoles([]);
      setSelectedCaseId(null);
      localStorage.removeItem('cuckoox-selectedCaseId');
      setNavMenuItems([]); // Clear menu if no user
      return;
    }
    setIsCaseLoading(true);
    try {
      const query = `
        SELECT 
            id, 
            user_id, 
            case_id.* AS case_details, 
            role_id.* AS role_details 
        FROM user_case_role 
        WHERE user_id = $userId
        FETCH case_id, role_id;
      `;
      const results: UserCaseRoleDetails[][] = await client.query(query, { userId: currentAppUser.id }); // MODIFIED db.query to client.query
      
      const casesMap = new Map<RecordId, Case>();
      let actualResults: UserCaseRoleDetails[] = [];

      if (results && results.length > 0 && Array.isArray(results[0])) {
         actualResults = results[0]; // Assuming the first element of the outer array is the array of records
         actualResults.forEach(ucr => {
            if (ucr.case_details && ucr.case_details.id) {
                 casesMap.set(ucr.case_details.id, ucr.case_details);
            }
         });
      }

      const fetchedCases = Array.from(casesMap.values());
      setUserCases(fetchedCases);

      const lastCaseId = currentAppUser.last_login_case_id;
      const previouslySelectedCaseId = deserializeRecordId(localStorage.getItem('cuckoox-selectedCaseId') || 'null');
      
      let caseToSelect: RecordId | null = null;

      if (previouslySelectedCaseId && casesMap.has(previouslySelectedCaseId)) {
        caseToSelect = previouslySelectedCaseId;
      } else if (lastCaseId && casesMap.has(lastCaseId)) {
        caseToSelect = lastCaseId;
      } else if (fetchedCases.length === 1 && fetchedCases[0].id) {
        caseToSelect = fetchedCases[0].id;
      }

      if (caseToSelect) {
        // Call selectCaseInternal - note: it's not async, so no await needed here
        selectCaseInternal(caseToSelect, actualResults);
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
  };



  // 更新菜单状态
  const fetchAndUpdateMenuPermissions = useCallback(async () => {
    console.log('fetchAndUpdateMenuPermissions called');
    
    if (!user || !isSuccess) {
      console.log('No user or client not ready, clearing menu items');
      setNavMenuItems([]);
      return;
    }

    console.log('Loading menus for user:', user.id, 'case:', selectedCaseId);
    setIsMenuLoading(true);
    
    try {
      // 直接使用图查询函数加载用户可访问的菜单
      console.log('Loading menus using fn::get_user_menus...');
      const dbMenuItems = await menuService.loadUserMenus(
        selectedCaseId || null
      );
      console.log('Database menu items:', dbMenuItems);
      
      // 设置菜单项，如果为空则显示空菜单
      setNavMenuItems(dbMenuItems);
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
  }, [user, isSuccess, selectedCaseId]);
  
  // Helper function to update last selected case in DB
  const updateLastSelectedCaseInDB = async (userId: RecordId, caseId: RecordId) => {
    if (!client || !userId || !caseId) {
      console.warn('updateLastSelectedCaseInDB: Surreal client not available or missing userId/caseId.');
      return;
    }
    try {
      await client.query('UPDATE user SET last_selected_case_id = $caseId WHERE id = $userId;', {
        userId,
        caseId,
      });
      console.log(`Successfully updated last_selected_case_id for user ${userId} to ${caseId}`);
    } catch (error) {
      console.error('Failed to update last_selected_case_id in DB:', error);
    }
  };

  // Internal helper to set roles based on a selected case ID and pre-fetched UserCaseRoleDetails
  const selectCaseInternal = (caseIdToSelect: RecordId, allUserCaseRolesDetails: UserCaseRoleDetails[]) => {
    setSelectedCaseId(caseIdToSelect);
    localStorage.setItem('cuckoox-selectedCaseId', serializeRecordId(caseIdToSelect));

    const rolesForSelectedCase: Role[] = [];
    if (allUserCaseRolesDetails && Array.isArray(allUserCaseRolesDetails)) {
        allUserCaseRolesDetails.forEach(ucr => {
            if (ucr.case_details && ucr.case_details.id === caseIdToSelect && ucr.role_details) {
                rolesForSelectedCase.push(ucr.role_details);
            }
        });
    }
    setCurrentUserCaseRoles(rolesForSelectedCase);
    fetchAndUpdateMenuPermissions(); // Call menu update
  };

  const selectCase = async (caseIdToSelect: RecordId | string) => {
    if (!user || !user.id) {
      console.error("User not available for selecting case.");
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
      // Fetch all user_case_role entries for the user to correctly populate roles for the selected case
      const query = `
        SELECT id, user_id, case_id.* AS case_details, role_id.* AS role_details 
        FROM user_case_role WHERE user_id = $userId FETCH case_id, role_id;`;
      const results: UserCaseRoleDetails[][] = await client.query(query, { userId: user.id }); // MODIFIED db.query to client.query

      let userCaseRolesDetails: UserCaseRoleDetails[] = [];
      if (results && results.length > 0 && Array.isArray(results[0])) {
        userCaseRolesDetails = results[0];
      }
      
      // Check if the caseIdToSelect is one of the user's cases
      const caseExistsForUser = userCases.some(c => c.id.toString() === recordId.toString());
      if (!caseExistsForUser && userCaseRolesDetails.some(ucrd => ucrd.case_details.id.toString() === recordId.toString())) {
          // This implies userCases might be stale if selectCase is called with a new valid case not yet in userCases
          // This could happen if roles/cases are modified externally and refreshUserCasesAndRoles wasn't called yet
          // For simplicity, we'll rely on userCases being up-to-date from loadUserCasesAndRoles or refreshUserCasesAndRoles
          // Or, ensure loadUserCasesAndRoles is called if caseIdToSelect is not in userCases
          console.warn("selectCase called with a caseId not in the current userCases list. Roles might be based on a fresh fetch.");
      }


      selectCaseInternal(recordId, userCaseRolesDetails);

      // Convert string caseIdToSelect to RecordId for storage
      await client.merge(user.id, { last_login_case_id: recordId }); // MODIFIED db.merge to client.merge
      
      // Update user object in context with the new last_login_case_id
      setUser(prevUser => prevUser ? { ...prevUser, last_login_case_id: recordId } : null);
      // Also update localStorage for the user object
      if (user) {
          const updatedUser = { ...user, last_login_case_id: recordId };
          localStorage.setItem('cuckoox-user', serializeAppUser(updatedUser));
      }

      // Update last selected case in DB
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
    if (user) {
      await loadUserCasesAndRoles(user);
    }
  };

  const logout = async () => {
    // 检查是否有用户会话
    if (!user) {
      console.warn("Logout called without a user session.");
      clearAuthState();
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const isAdmin = user.github_id === '--admin--';

    try {
      // 统一先清理本地存储和状态
      clearAuthState();

      // 根据用户类型执行不同的登出操作
      if (isAdmin) {
        await signout();
        console.log('Admin user signed out from SurrealDB.');
      } else {
        await authService.logoutRedirect();
      }
    } catch (error) {
      // 统一错误处理
      console.error("Error during logout process:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // 只要用户存在且客户端连接成功就加载菜单
    if (user && isSuccess) {
      console.log('User and client ready, loading menus...');
      fetchAndUpdateMenuPermissions();
    } else {
      setNavMenuItems([]); // Clear menu if no user or client not ready
    }
  }, [user, isSuccess, fetchAndUpdateMenuPermissions]); // 添加 fetchAndUpdateMenuPermissions 作为依赖

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

  // Cleanup effect for token refresh timer
  useEffect(() => {
    return () => {
      clearTokenRefresh();
    };
  }, []);

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
