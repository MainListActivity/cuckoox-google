import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import authService from '@/src/services/authService';
// import { db } from '@/src/lib/surreal'; // REMOVED
import {useSurreal} from '@/src/contexts/SurrealProvider'; // ADDED
import { User as OidcUser } from 'oidc-client-ts';
import { RecordId } from 'surrealdb'; // Import for typing record IDs

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
  selectedCaseId: string | null; // Store as string (e.g. "case:xxxx")
  userCases: Case[];
  currentUserCaseRoles: Role[];
  isCaseLoading: boolean; // For loading cases and case-specific roles
  selectCase: (caseId: string) => Promise<void>;
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
  __TEST_setSelectedCaseId?: (caseId: string | null) => void;
  __TEST_setUserCases?: (cases: Case[]) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
const CREDITOR_MANAGEMENT_PATH = '/creditors'; // Define target path

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {surreal:client,signout} = useSurreal(); // ADDED
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [oidcUser, setOidcUser] = useState<OidcUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(localStorage.getItem('cuckoox-selectedCaseId'));
  const [userCases, setUserCases] = useState<Case[]>([]);
  const [currentUserCaseRoles, setCurrentUserCaseRoles] = useState<Role[]>([]);
  const [isCaseLoading, setIsCaseLoading] = useState<boolean>(false);
  const [navMenuItems, setNavMenuItems] = useState<NavItemType[] | null>(null);
  const [isMenuLoading, setIsMenuLoading] = useState<boolean>(false);
  const [navigateTo, setNavigateTo] = useState<string | null>(null); // Navigation state

  const clearNavigateTo = () => setNavigateTo(null);

  useEffect(() => {
    const checkCurrentUser = async () => {
      setIsLoading(true);
      try {
        // 首先检查本地存储的用户信息
        const storedUser = localStorage.getItem('cuckoox-user');
        const storedIsLoggedIn = localStorage.getItem('cuckoox-isLoggedIn');
        
        if (storedUser && storedIsLoggedIn === 'true') {
          // 如果有本地存储的用户信息，先使用它来初始化会话
          const appUser = JSON.parse(storedUser) as AppUser;
          
          // 对于管理员用户，不需要检查 OIDC
          if (appUser.github_id === '--admin--') {
            await initializeUserSession(appUser, null);
            setIsLoading(false);
            return;
          }
          
          // 对于普通用户，先恢复会话，然后异步检查 OIDC 状态
          await initializeUserSession(appUser, null);
          
          // 异步检查 OIDC 状态（不阻塞用户使用）
          authService.getUser().then(async (currentOidcUser) => {
            if (currentOidcUser && !currentOidcUser.expired) {
              // OIDC 会话有效，更新 oidcUser
              setOidcUser(currentOidcUser);
              
              // 可选：同步更新数据库中的用户信息
              const githubId = currentOidcUser.profile.sub;
              if (githubId && githubId === appUser.github_id) {
                const userRecordId = `user:${githubId}`;
                try {
                  const result = await client.select(userRecordId);
                  if (result && result.length > 0) {
                    const appUserFromDb = result[0] as unknown as AppUser;
                    setUser(appUserFromDb);
                    localStorage.setItem('cuckoox-user', JSON.stringify(appUserFromDb));
                  }
                } catch (error) {
                  console.error("Error syncing user data from DB:", error);
                }
              }
            } else {
              // OIDC 会话已过期，但保持用户登录状态
              console.log("OIDC session expired, but keeping user logged in with stored credentials");
              setOidcUser(null);
            }
          }).catch((error) => {
            console.error("Error checking OIDC session:", error);
            // 即使 OIDC 检查失败，也保持用户登录状态
            setOidcUser(null);
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
              await initializeUserSession(appUserFromDb, currentOidcUser);
            } else {
              console.warn(`User ${githubId} found in OIDC but not in DB. Logging out.`);
              clearAuthState();
            }
          } else {
            // 没有有效的会话
            clearAuthState();
          }
        }
      } catch (error) {
        console.error("Error checking current user session:", error);
        clearAuthState();
      } finally {
        setIsLoading(false);
      }
    };
    checkCurrentUser();
  }, []);

  const clearAuthState = () => {
    setUser(null);
    setOidcUser(null);
    setIsLoggedIn(false);
    setSelectedCaseId(null);
    setUserCases([]);
    setCurrentUserCaseRoles([]);
    setNavMenuItems([]);
    localStorage.removeItem('cuckoox-isLoggedIn');
    localStorage.removeItem('cuckoox-user');
    localStorage.removeItem('cuckoox-selectedCaseId');
  };

  const initializeUserSession = async (appUser: AppUser, oidcUserInstance?: OidcUser | null) => { // MODIFIED
    setUser(appUser);
    setOidcUser(oidcUserInstance || null); // MODIFIED to handle undefined
    setIsLoggedIn(true);
    localStorage.setItem('cuckoox-isLoggedIn', 'true');
    localStorage.setItem('cuckoox-user', JSON.stringify(appUser));
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
      
      const casesMap = new Map<string, Case>();
      let actualResults: UserCaseRoleDetails[] = [];

      if (results && results.length > 0 && Array.isArray(results[0])) {
         actualResults = results[0]; // Assuming the first element of the outer array is the array of records
         actualResults.forEach(ucr => {
            if (ucr.case_details && ucr.case_details.id) {
                 casesMap.set(ucr.case_details.id.toString(), ucr.case_details);
            }
         });
      }

      const fetchedCases = Array.from(casesMap.values());
      setUserCases(fetchedCases);

      const lastCaseId = currentAppUser.last_login_case_id;
      const previouslySelectedCaseId = localStorage.getItem('cuckoox-selectedCaseId');
      
      let caseToSelect: string | null = null;

      if (previouslySelectedCaseId && casesMap.has(previouslySelectedCaseId)) {
        caseToSelect = previouslySelectedCaseId;
      } else if (lastCaseId && casesMap.has(lastCaseId.toString())) {
        caseToSelect = lastCaseId.toString();
      } else if (fetchedCases.length === 1 && fetchedCases[0].id) {
        caseToSelect = fetchedCases[0].id.toString();
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

  // 菜单配置常量
  const ALL_NAV_ITEMS = [
    { 
      id: 'dashboard', 
      path: '/dashboard', 
      labelKey: 'nav_dashboard', 
      iconName: 'mdiViewDashboard', 
      requiredRoles: ['case_manager', 'admin', 'creditor_representative'] 
    },
    { 
      id: 'cases', 
      path: '/cases', 
      labelKey: 'nav_case_management', 
      iconName: 'mdiBriefcase', 
      requiredRoles: ['case_manager', 'admin'] 
    },
    { 
      id: 'creditors', 
      path: '/creditors', 
      labelKey: 'nav_creditor_management', 
      iconName: 'mdiAccountGroup', 
      requiredRoles: ['case_manager', 'admin'] 
    },
    { 
      id: 'claims_list', 
      path: '/claims', 
      labelKey: 'nav_claim_management', 
      iconName: 'mdiFileDocumentOutline', 
      requiredRoles: ['case_manager', 'admin'] 
    },
    { 
      id: 'my_claims', 
      path: '/my-claims', 
      labelKey: 'nav_my_claims', 
      iconName: 'mdiFileDocumentSearchOutline', 
      requiredRoles: ['creditor_representative'] 
    },
    { 
      id: 'claims_submit', 
      path: '/claims/submit', 
      labelKey: 'nav_claim_submission', 
      iconName: 'mdiFileUploadOutline', 
      requiredRoles: ['creditor_representative'] 
    },
    { 
      id: 'claim_dashboard', 
      path: '/claim-dashboard', 
      labelKey: 'nav_claim_dashboard', 
      iconName: 'mdiChartBar', 
      requiredRoles: ['case_manager', 'admin'] 
    },
    { 
      id: 'online_meetings', 
      path: '/online-meetings', 
      labelKey: 'nav_online_meetings', 
      iconName: 'mdiVideo', 
      requiredRoles: ['case_manager', 'admin', 'creditor_representative'] 
    },
    { 
      id: 'messages', 
      path: '/messages', 
      labelKey: 'nav_message_center', 
      iconName: 'mdiMessageTextOutline', 
      requiredRoles: ['case_manager', 'admin', 'creditor_representative'] 
    },
    { 
      id: 'admin_home', 
      path: '/admin', 
      labelKey: 'nav_system_management', 
      iconName: 'mdiCog', 
      requiredRoles: ['admin'] 
    }
  ] as const;

  // 菜单权限逻辑
  const getAccessibleMenuItems = (userRoles: readonly Role[], isAdmin: boolean): NavItemType[] => {
    if (isAdmin) return [...ALL_NAV_ITEMS]; // 创建一个新的数组
    const userRoleNames = userRoles.map(role => role.name);
    return ALL_NAV_ITEMS.filter(item => {
      if (!item.requiredRoles?.length) return true;
      return item.requiredRoles.some(requiredRole => userRoleNames.includes(requiredRole));
    }) as NavItemType[]; // 类型断言为非只读数组
  };

  // 更新菜单状态
  const fetchAndUpdateMenuPermissions = async (currentRoles: Role[]) => {
    if (!user) {
      setNavMenuItems([]);
      return;
    }

    const isAdmin = user.github_id === '--admin--';
    setIsMenuLoading(true);
    
    try {
      if (!isAdmin && (!currentRoles?.length)) {
        console.log('No roles assigned - returning empty menu');
        setNavMenuItems([]);
        return;
      }
      
      const accessibleMenuItems = getAccessibleMenuItems(currentRoles, isAdmin);
      
      setNavMenuItems(accessibleMenuItems);
      console.log('Menu items updated:', {
        userRoles: isAdmin ? ['admin'] : currentRoles.map(r => r.name),
        menuCount: accessibleMenuItems.length
      });

    } catch (error) {
      console.error('Error updating menu permissions:', error);
      setNavMenuItems([]);
    } finally {
      setIsMenuLoading(false);
    }
  };
  
  // Helper function to update last selected case in DB
  const updateLastSelectedCaseInDB = async (userId: string, caseId: string) => {
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
  const selectCaseInternal = (caseIdToSelect: string, allUserCaseRolesDetails: UserCaseRoleDetails[]) => {
    setSelectedCaseId(caseIdToSelect);
    localStorage.setItem('cuckoox-selectedCaseId', caseIdToSelect);

    const rolesForSelectedCase: Role[] = [];
    if (allUserCaseRolesDetails && Array.isArray(allUserCaseRolesDetails)) {
        allUserCaseRolesDetails.forEach(ucr => {
            if (ucr.case_details && ucr.case_details.id.toString() === caseIdToSelect && ucr.role_details) {
                rolesForSelectedCase.push(ucr.role_details);
            }
        });
    }
    setCurrentUserCaseRoles(rolesForSelectedCase);
    fetchAndUpdateMenuPermissions(rolesForSelectedCase); // Call menu update
  };

  const selectCase = async (caseIdToSelect: string) => {
    if (!user || !user.id) {
      console.error("User not available for selecting case.");
      setIsCaseLoading(false); // Ensure loading state is reset
      return;
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
      const caseExistsForUser = userCases.some(c => c.id.toString() === caseIdToSelect);
      if (!caseExistsForUser && userCaseRolesDetails.some(ucrd => ucrd.case_details.id.toString() === caseIdToSelect)) {
          // This implies userCases might be stale if selectCase is called with a new valid case not yet in userCases
          // This could happen if roles/cases are modified externally and refreshUserCasesAndRoles wasn't called yet
          // For simplicity, we'll rely on userCases being up-to-date from loadUserCasesAndRoles or refreshUserCasesAndRoles
          // Or, ensure loadUserCasesAndRoles is called if caseIdToSelect is not in userCases
          console.warn("selectCase called with a caseId not in the current userCases list. Roles might be based on a fresh fetch.");
      }


      selectCaseInternal(caseIdToSelect, userCaseRolesDetails);

      // Convert string caseIdToSelect to RecordId for storage
      const caseRecordId = new RecordId('case', caseIdToSelect.replace('case:', ''));
      await client.merge(user.id, { last_login_case_id: caseRecordId }); // MODIFIED db.merge to client.merge
      
      // Update user object in context with the new last_login_case_id
      setUser(prevUser => prevUser ? { ...prevUser, last_login_case_id: caseRecordId } : null);
      // Also update localStorage for the user object
      if (user) {
          const updatedUser = { ...user, last_login_case_id: caseRecordId };
          localStorage.setItem('cuckoox-user', JSON.stringify(updatedUser));
      }

      // Update last selected case in DB
      if (user?.id) {
        await updateLastSelectedCaseInDB(user.id.toString(), caseIdToSelect);
      }

    } catch (error) {
      console.error(`Error selecting case ${caseIdToSelect}:`, error);
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
    // Check if user is admin
    const isAdmin = user && user.github_id === '--admin--';
    
    if (isAdmin) {
      // Admin users should see all menus regardless of case selection
      fetchAndUpdateMenuPermissions([]);
    } else if (selectedCaseId && currentUserCaseRoles && currentUserCaseRoles.length > 0) {
      fetchAndUpdateMenuPermissions(currentUserCaseRoles);
    } else if (!selectedCaseId) {
      setNavMenuItems([]); // Clear menu if no case is selected
    }
  }, [selectedCaseId, currentUserCaseRoles, user]); // Added user as dependency

  // Effect for automatic navigation to creditor management
  useEffect(() => {
    if (isLoggedIn && selectedCaseId && userCases.length > 0 && navMenuItems && !isCaseLoading && !isMenuLoading) {
      const selectedCase = userCases.find(c => c.id.toString() === selectedCaseId);
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
      isLoggedIn, user, oidcUser, setAuthState, logout, isLoading,
      selectedCaseId, userCases, currentUserCaseRoles, isCaseLoading, selectCase, hasRole, refreshUserCasesAndRoles,
      navMenuItems, isMenuLoading, // Expose new menu state
      navigateTo, clearNavigateTo, // Expose navigation state and clear function
      __TEST_setCurrentUserCaseRoles, __TEST_setSelectedCaseId, __TEST_setUserCases // Expose test-only methods
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
