import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useMemo,
} from "react";
import authService from "@/src/services/authService";
import {
  useSurrealClient,
} from "@/src/contexts/SurrealProvider";
import { queryWithAuth } from "@/src/utils/surrealAuth";
import { strToId } from "@/src/utils/id";
import { User as OidcUser } from "oidc-client-ts";
import { RecordId } from "surrealdb";
import { menuService } from "@/src/services/menuService";

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
  isInitialized: boolean; // Whether initial auth check is complete

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
  useOperationPermissions: (operationIds: string[]) => {
    permissions: Record<string, boolean>;
    isLoading: boolean;
    error: string | null;
  };
  useMenuPermission: (menuId: string) => PermissionCheckResult;
  useDataPermission: (
    tableName: string,
    crudType: "create" | "read" | "update" | "delete",
  ) => PermissionCheckResult;
  useUserRoles: () => {
    roles: string[];
    isLoading: boolean;
    error: string | null;
  };
  useClearPermissionCache: () => {
    clearUserPermissions: (caseId?: string) => Promise<void>;
    clearAllPermissions: () => Promise<void>;
  };
  useSyncPermissions: () => {
    syncPermissions: (userData: unknown) => Promise<void>;
  };

  // Permission preloading methods to avoid render loop issues
  preloadOperationPermission: (operationId: string) => Promise<void>;
  preloadOperationPermissions: (operationIds: string[]) => Promise<void>;

  // Test-only methods (only available in test environment)
  __TEST_setCurrentUserCaseRoles?: (roles: Role[]) => void;
  __TEST_setSelectedCaseId?: (caseId: RecordId | null) => void;
  __TEST_setUserCases?: (cases: Case[]) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);
const CREDITOR_MANAGEMENT_PATH = "/creditors"; // Define target path

export const AuthProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const client = useSurrealClient(); // Use SurrealClient directly
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [oidcUser, setOidcUser] = useState<OidcUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  authService.setSurrealClient(client);

  // 注意：现在直接使用queryWithAuth，通过service worker进行数据库查询
  const [selectedCaseId, setSelectedCaseId] = useState<RecordId | null>(
    strToId(localStorage.getItem("cuckoox-selectedCaseId") || "null"),
  );
  const [userCases, setUserCases] = useState<Case[]>([]);
  const selectedCase = useMemo(() => {
    return (
      userCases.find(
        (c) => selectedCaseId && String(c.id) === String(selectedCaseId),
      ) || null
    );
  }, [userCases, selectedCaseId]);
  const [currentUserCaseRoles, setCurrentUserCaseRoles] = useState<Role[]>([]);
  const [isCaseLoading, setIsCaseLoading] = useState<boolean>(false);
  const [navMenuItems, setNavMenuItems] = useState<NavItemType[] | null>(null);
  const [isMenuLoading, setIsMenuLoading] = useState<boolean>(false);
  const [navigateTo, setNavigateTo] = useState<string | null>(null); // Navigation state

  // 权限缓存状态
  const [operationPermissionsCache, setOperationPermissionsCache] = useState<
    Record<string, boolean>
  >({});
  const [menuPermissionsCache, setMenuPermissionsCache] = useState<
    Record<string, boolean>
  >({});
  const [dataPermissionsCache, setDataPermissionsCache] = useState<
    Record<string, boolean>
  >({});
  const [permissionsLoading, setPermissionsLoading] = useState<
    Record<string, boolean>
  >({});

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
  const loadOperationPermission = useCallback(
    async (operationId: string): Promise<boolean> => {
      if (!user || !client) return false;

      // 管理员拥有所有权限
      if (user.github_id === "--admin--") {
        setOperationPermissionsCache((prev) => ({
          ...prev,
          [operationId]: true,
        }));
        return true;
      }

      try {
        setPermissionsLoading((prev) => ({ ...prev, [operationId]: true }));
        const result = await menuService.hasOperation(
          client,
          operationId,
          selectedCaseId,
        );
        setOperationPermissionsCache((prev) => ({
          ...prev,
          [operationId]: result,
        }));
        return result;
      } catch (error) {
        console.error("Error checking operation permission:", error);
        setOperationPermissionsCache((prev) => ({
          ...prev,
          [operationId]: false,
        }));
        return false;
      } finally {
        setPermissionsLoading((prev) => ({ ...prev, [operationId]: false }));
      }
    },
    [user, client, selectedCaseId],
  );

  const loadOperationPermissions = useCallback(
    async (operationIds: string[]): Promise<Record<string, boolean>> => {
      if (!user || !client) {
        const result: Record<string, boolean> = {};
        operationIds.forEach((id) => {
          result[id] = false;
        });
        return result;
      }

      // 管理员拥有所有权限
      if (user.github_id === "--admin--") {
        const result: Record<string, boolean> = {};
        operationIds.forEach((id) => {
          result[id] = true;
        });
        setOperationPermissionsCache((prev) => ({ ...prev, ...result }));
        return result;
      }

      try {
        operationIds.forEach((id) => {
          setPermissionsLoading((prev) => ({ ...prev, [id]: true }));
        });
        const result = await menuService.hasOperations(
          client,
          operationIds,
          selectedCaseId,
        );
        setOperationPermissionsCache((prev) => ({ ...prev, ...result }));
        return result;
      } catch (error) {
        console.error("Error checking operation permissions:", error);
        const result: Record<string, boolean> = {};
        operationIds.forEach((id) => {
          result[id] = false;
        });
        setOperationPermissionsCache((prev) => ({ ...prev, ...result }));
        return result;
      } finally {
        operationIds.forEach((id) => {
          setPermissionsLoading((prev) => ({ ...prev, [id]: false }));
        });
      }
    },
    [user, client, selectedCaseId],
  );

  // 权限 hooks 实现 - 修复无限循环问题
  const useOperationPermission = useCallback(
    (operationId: string): PermissionCheckResult => {
      if (!user || !client) {
        return { hasPermission: false, isLoading: false, error: null };
      }

      // 管理员拥有所有权限
      if (user.github_id === "--admin--") {
        return { hasPermission: true, isLoading: false, error: null };
      }

      const hasPermission =
        operationPermissionsCache[operationId] !== undefined
          ? operationPermissionsCache[operationId]
          : false;
      const isLoading = permissionsLoading[operationId] || false;

      return {
        hasPermission,
        isLoading,
        error: null,
      };
    },
    [operationPermissionsCache, permissionsLoading, user, client],
  );

  // 添加权限预加载方法
  const preloadOperationPermission = useCallback(
    async (operationId: string): Promise<void> => {
      if (!user || !client || user.github_id === "--admin--") {
        return;
      }

      // 如果权限已在缓存中或正在加载，不需要重复加载
      if (
        operationPermissionsCache[operationId] !== undefined ||
        permissionsLoading[operationId]
      ) {
        return;
      }

      try {
        await loadOperationPermission(operationId);
      } catch (error) {
        console.error("Error preloading operation permission:", error);
      }
    },
    [
      user,
      client,
      operationPermissionsCache,
      permissionsLoading,
      loadOperationPermission,
    ],
  );

  const useOperationPermissions = useCallback(
    (operationIds: string[]) => {
      if (!user || !client) {
        const permissions: Record<string, boolean> = {};
        operationIds.forEach((id) => {
          permissions[id] = false;
        });
        return { permissions, isLoading: false, error: null };
      }

      // 管理员拥有所有权限
      if (user.github_id === "--admin--") {
        const permissions: Record<string, boolean> = {};
        operationIds.forEach((id) => {
          permissions[id] = true;
        });
        return { permissions, isLoading: false, error: null };
      }

      const permissions: Record<string, boolean> = {};
      let isLoading = false;

      operationIds.forEach((id) => {
        permissions[id] =
          operationPermissionsCache[id] !== undefined
            ? operationPermissionsCache[id]
            : false;
        if (permissionsLoading[id]) {
          isLoading = true;
        }
      });

      return {
        permissions,
        isLoading,
        error: null,
      };
    },
    [operationPermissionsCache, permissionsLoading, user, client],
  );

  // 添加批量权限预加载方法
  const preloadOperationPermissions = useCallback(
    async (operationIds: string[]): Promise<void> => {
      if (!user || !client || user.github_id === "--admin--") {
        return;
      }

      // 检查是否有未缓存的权限需要加载
      const uncachedIds = operationIds.filter(
        (id) =>
          operationPermissionsCache[id] === undefined &&
          !permissionsLoading[id],
      );

      if (uncachedIds.length > 0) {
        try {
          await loadOperationPermissions(uncachedIds);
        } catch (error) {
          console.error("Error preloading operation permissions:", error);
        }
      }
    },
    [
      user,
      client,
      operationPermissionsCache,
      permissionsLoading,
      loadOperationPermissions,
    ],
  );

  const useMenuPermission = useCallback(
    (menuId: string): PermissionCheckResult => {
      // 先检查当前已加载的菜单项中是否包含该菜单
      if (navMenuItems) {
        const hasMenu = navMenuItems.some((menu) => menu.id === menuId);
        if (hasMenu) {
          return { hasPermission: true, isLoading: false, error: null };
        }
      }

      const hasPermission = menuPermissionsCache[menuId] || false;
      const isLoading = permissionsLoading[menuId] || false;

      return {
        hasPermission,
        isLoading,
        error: null,
      };
    },
    [navMenuItems, menuPermissionsCache, permissionsLoading],
  );

  const useDataPermission = useCallback(
    (
      tableName: string,
      crudType: "create" | "read" | "update" | "delete",
    ): PermissionCheckResult => {
      const cacheKey = `${tableName}:${crudType}`;
      const hasPermission = dataPermissionsCache[cacheKey] || false;
      const isLoading = permissionsLoading[cacheKey] || false;

      return {
        hasPermission,
        isLoading,
        error: null,
      };
    },
    [dataPermissionsCache, permissionsLoading],
  );

  const useUserRoles = useCallback(() => {
    const roles = currentUserCaseRoles.map((role) => role.name);
    return {
      roles,
      isLoading: false,
      error: null,
    };
  }, [currentUserCaseRoles]);

  const useClearPermissionCache = useCallback(() => {
    const clearUserPermissions = async (caseId?: string) => {
      console.log("清除用户权限缓存:", { userId: user?.id, caseId });
      clearPermissionCache();
    };

    const clearAllPermissions = async () => {
      console.log("清除所有权限缓存");
      clearPermissionCache();
    };

    return { clearUserPermissions, clearAllPermissions };
  }, [clearPermissionCache]);

  const useSyncPermissions = useCallback(() => {
    const syncPermissions = async (userData: unknown) => {
      console.log("同步权限数据:", userData);
      // 在新架构中，权限数据会自动通过查询同步
    };

    return { syncPermissions };
  }, []);

  // 当用户或案件改变时清除权限缓存
  useEffect(() => {
    clearPermissionCache();
  }, [user, selectedCaseId, clearPermissionCache]);

  const loadUserCasesAndRoles = useCallback(
    async (currentAppUser: AppUser | null) => {
      if (!currentAppUser || !currentAppUser.id) {
        setUserCases([]);
        setCurrentUserCaseRoles([]);
        setSelectedCaseId(null);
        localStorage.removeItem("cuckoox-selectedCaseId");
        setNavMenuItems([]);
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
        const previouslySelectedCaseId = strToId(localStorage.getItem("cuckoox-selectedCaseId") || "null");

        let caseToSelect: RecordId | null = null;

        // 优先使用localStorage中的选择
        if (
          previouslySelectedCaseId &&
          fetchedCases?.some(
            (c) => String(c.id) === String(previouslySelectedCaseId),
          )
        ) {
          caseToSelect = previouslySelectedCaseId;
        }
        // 其次使用用户上次登录的案件
        else if (
          lastCaseId &&
          fetchedCases?.some((c) => String(c.id) === String(lastCaseId))
        ) {
          caseToSelect = lastCaseId;
        }
        // 最后选择第一个可用案件
        else if (
          fetchedCases &&
          fetchedCases.length > 0 &&
          fetchedCases[0].id
        ) {
          caseToSelect = fetchedCases[0].id;
        }

        if (caseToSelect) {
          setSelectedCaseId(caseToSelect);
          localStorage.setItem(
            "cuckoox-selectedCaseId",
            caseToSelect.toString(),
          );
          // 清空当前案件角色，后续通过权限系统查询
          setCurrentUserCaseRoles([]);
        } else {
          setCurrentUserCaseRoles([]);
          setSelectedCaseId(null);
          localStorage.removeItem("cuckoox-selectedCaseId");
          setNavMenuItems([]);
        }
      } catch (error) {
        console.error("Error loading user cases and roles:", error);
        setUserCases([]);
        setCurrentUserCaseRoles([]);
        setSelectedCaseId(null);
        localStorage.removeItem("cuckoox-selectedCaseId");
        setNavMenuItems([]);
      } finally {
        setIsCaseLoading(false);
      }
    },
    [client],
  );

  const clearAuthState = useCallback(
    async (shouldInvalidate: boolean = true) => {
      const currentUser = user;

      // 如果已经是清空状态，避免重复清除
      if (!currentUser && !isLoggedIn) {
        console.log(
          "AuthContext: Already in cleared state, skipping clearAuthState",
        );
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

      localStorage.removeItem("cuckoox-selectedCaseId");
      localStorage.removeItem("cuckoox-last-user");
      localStorage.removeItem("tenant_code");
    },
    [user, isLoggedIn],
  );
  // 统一的用户状态初始化函数
  const initializeUserSession = useCallback(
    async (appUser: AppUser, oidcUserInstance?: OidcUser | null) => {
      setUser(appUser);
      setOidcUser(oidcUserInstance || null);
      setIsLoggedIn(true);

      // 缓存用户数据
      localStorage.setItem("cuckoox-last-user", JSON.stringify(appUser));

      await loadUserCasesAndRoles(appUser);
    },
    [loadUserCasesAndRoles],
  );

  // 统一的认证状态检查函数
  const checkAuthStatus = useCallback(async (): Promise<boolean> => {
    try {
      // 优先从缓存加载用户数据，避免闪烁
      const cachedUserData = localStorage.getItem("cuckoox-last-user");
      if (cachedUserData && !user) {
        try {
          const userData = JSON.parse(cachedUserData);
          setUser(userData);
          setIsLoggedIn(true);
          console.log("AuthContext: 从缓存恢复用户状态");
        } catch (cacheError) {
          console.warn("AuthContext: 缓存用户数据解析失败:", cacheError);
          localStorage.removeItem("cuckoox-last-user");
        }
      }

      // 查询真实认证状态
      const result = await client.query<AppUser[]>("select * from user where id=$auth;");

      if (result && result.length > 0) {
        const currentUser = result[0];
        // 如果真实状态与缓存状态不一致，更新状态
        if (!user || JSON.stringify(user) !== JSON.stringify(currentUser)) {
          await initializeUserSession(currentUser, null);
        }
        return true;
      } else {
        // 如果查询结果为空，说明用户未认证，清除状态
        if (user || isLoggedIn) {
          await clearAuthState(false);
        }
        return false;
      }
    } catch (error) {
      console.warn("AuthContext: 认证状态检查失败:", error);
      // 查询失败时，如果有缓存用户数据，继续使用缓存
      if (user) {
        console.log("AuthContext: 使用缓存用户数据继续运行");
        return true;
      }
      return false;
    }
  }, [client, user, isLoggedIn, initializeUserSession, clearAuthState]);

  // 初始化认证状态
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      if (!isMounted || isInitialized) return;

      console.log("AuthContext: 开始初始化认证状态");
      setIsLoading(true);

      try {
        await checkAuthStatus();
      } catch (error) {
        console.error("AuthContext: 认证状态初始化失败:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          setIsInitialized(true);
          console.log("AuthContext: 认证状态初始化完成");
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, [checkAuthStatus, isInitialized]);

  // 监听认证状态变化事件
  useEffect(() => {
    const handleAuthStateChange = (event: CustomEvent) => {
      const { isAuthenticated } = event.detail;
      console.log("AuthContext: 收到认证状态变化事件:", { isAuthenticated });

      if (!isAuthenticated) {
        console.log("AuthContext: 用户认证失效，清除状态并重定向");
        clearAuthState(true);
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }
    };

    window.addEventListener(
      "auth-state-changed",
      handleAuthStateChange as EventListener,
    );

    return () => {
      window.removeEventListener(
        "auth-state-changed",
        handleAuthStateChange as EventListener,
      );
    };
  }, [clearAuthState]);

  const setAuthState = (
    appUser: AppUser,
    oidcUserInstance?: OidcUser | null,
  ) => {
    initializeUserSession(appUser, oidcUserInstance);
  };

  // 更新菜单状态
  const fetchAndUpdateMenuPermissions = useCallback(async () => {
    console.log("fetchAndUpdateMenuPermissions called");

    if (!user) {
      console.log("No user, clearing menu items");
      setNavMenuItems([]);
      return;
    }

    if (!client) {
      console.log("No client available, skipping menu load");
      return;
    }

    console.log("Loading menus for user:", user.id, "case:", selectedCaseId);
    setIsMenuLoading(true);

    try {
      // 直接使用图查询函数加载用户可访问的菜单
      console.log("Loading menus using fn::get_user_menus...");
      const dbMenuItems = await menuService.loadUserMenus(
        client,
        selectedCaseId || null,
      );
      console.log("Database menu items:", dbMenuItems);

      // 只有当菜单项确实发生变化时才更新状态
      setNavMenuItems((prevMenuItems) => {
        // 比较新旧菜单项是否相同
        if (JSON.stringify(prevMenuItems) === JSON.stringify(dbMenuItems)) {
          return prevMenuItems; // 返回旧状态，避免不必要的重新渲染
        }
        return dbMenuItems;
      });

      console.log("Menu items loaded:", {
        userId: user.id.toString(),
        caseId: selectedCaseId?.toString() || null,
        menuCount: dbMenuItems.length,
      });
    } catch (error) {
      console.error("Error updating menu permissions:", error);
      // 出错时设置为空菜单
      setNavMenuItems([]);
    } finally {
      setIsMenuLoading(false);
    }
  }, [user, selectedCaseId, client]); // 修复依赖

  const selectCase = async (caseIdToSelect: RecordId | string) => {
    if (!user || !user.id) {
      console.error("User not available for selecting case.");
      setIsCaseLoading(false);
      return;
    }

    // 将字符串转换为RecordId对象
    let recordId: RecordId;
    if (typeof caseIdToSelect === "string") {
      if (caseIdToSelect.includes(":")) {
        const parts = caseIdToSelect.split(":");
        recordId = new RecordId(parts[0], parts[1]);
      } else {
        recordId = new RecordId("case", caseIdToSelect);
      }
    } else {
      recordId = caseIdToSelect;
    }

    setIsCaseLoading(true);
    try {
      // 检查案件是否在用户可访问的案件列表中
      const caseExistsForUser = userCases.some(
        (c) => c.id.toString() === recordId.toString(),
      );
      if (!caseExistsForUser) {
        console.warn(
          "selectCase called with a caseId not in the current userCases list.",
        );
        return;
      }

      // 直接设置选中的案件ID
      setSelectedCaseId(recordId);
      localStorage.setItem(
        "cuckoox-selectedCaseId",
        recordId.toString(),
      );

      // 清空当前案件角色，后续通过权限系统查询
      setCurrentUserCaseRoles([]);

      // 更新数据库中的用户last_login_case_id
      try {
        await client.merge(user.id, { last_login_case_id: recordId });
        // 更新本地用户对象
        setUser((prevUser) =>
          prevUser ? { ...prevUser, last_login_case_id: recordId } : null,
        );
      } catch (error) {
        console.warn("Failed to update last_login_case_id:", error);
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
      await clearAuthState();
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const isAdmin = user.github_id === "--admin--";
    const isRootAdmin = user.github_id.startsWith("root_admin_");
    const isPasswordUser = user.github_id.startsWith("local_") || isRootAdmin;

    try {
      // 统一先清理本地存储和状态
      await clearAuthState();

      // 根据用户类型执行不同的登出操作
      if (isAdmin) {
        await authService.signout();
        console.log("Admin user signed out from SurrealDB.");
      } else if (isPasswordUser) {
        // 密码登录用户，只清理令牌，不走 OIDC 流程
        await authService.signout();
        console.log("Password user signed out from SurrealDB.");
        // 直接重定向到登录页面
        window.location.href = "/login";
      } else {
        // OIDC 登录用户，走 OIDC 退出流程
        await authService.logoutRedirect();
      }
    } catch (error) {
      // 统一错误处理
      console.error("Error during logout process:", error);
      // 确保即使出错也能重定向到登录页面
      window.location.href = "/login";
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && client) {
      console.log("用户已登录，加载菜单权限...");
      fetchAndUpdateMenuPermissions();
    } else if (!user) {
      setNavMenuItems([]);
    }
  }, [user, selectedCaseId, fetchAndUpdateMenuPermissions, client]);

  // Effect for automatic navigation to creditor management
  useEffect(() => {
    if (
      isLoggedIn &&
      selectedCaseId &&
      userCases.length > 0 &&
      navMenuItems &&
      !isCaseLoading &&
      !isMenuLoading
    ) {
      const selectedCase = userCases.find((c) => c.id === selectedCaseId);
      if (selectedCase && selectedCase.status === "立案") {
        const canNavigateToCreditors = navMenuItems.some(
          (item) => item.path === CREDITOR_MANAGEMENT_PATH,
        );
        if (canNavigateToCreditors) {
          // Check if already on the creditors page to prevent navigation loop
          // This requires access to current location, which is not ideal in context.
          // The consuming component (App.tsx) will handle preventing re-navigation if already there.
          setNavigateTo(CREDITOR_MANAGEMENT_PATH);
        }
      }
    }
  }, [
    isLoggedIn,
    selectedCaseId,
    userCases,
    navMenuItems,
    isCaseLoading,
    isMenuLoading,
  ]);

  const hasRole = (roleName: string): boolean => {
    // 如果没有用户登录,直接返回false
    if (!user) {
      return false;
    }

    // 检查是否为管理员
    if (user.github_id === "--admin--") {
      return true; // 管理员拥有所有权限
    }

    // 对于普通用户,需要检查具体角色权限
    if (roleName === "admin") {
      return false; // 非管理员用户没有admin权限
    }

    // 其他角色权限判断
    // 如果没有选择案件或没有角色,返回false
    if (!selectedCaseId || currentUserCaseRoles.length === 0) {
      return false;
    }

    // 检查用户在当前案件中是否拥有指定角色
    return currentUserCaseRoles.some((role) => role.name === roleName);
  };

  // Test-only methods
  const __TEST_setCurrentUserCaseRoles =
    process.env.NODE_ENV === "test" ? setCurrentUserCaseRoles : undefined;
  const __TEST_setSelectedCaseId =
    process.env.NODE_ENV === "test" ? setSelectedCaseId : undefined;
  const __TEST_setUserCases =
    process.env.NODE_ENV === "test" ? setUserCases : undefined;

  return (
    <AuthContext.Provider
      value={{
        isLoggedIn,
        user,
        oidcUser,
        setAuthState,
        logout,
        isLoading,
        isInitialized,
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
        // Permission preloading methods to avoid render loop issues
        preloadOperationPermission,
        preloadOperationPermissions,
        __TEST_setCurrentUserCaseRoles,
        __TEST_setSelectedCaseId,
        __TEST_setUserCases, // Expose test-only methods
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
