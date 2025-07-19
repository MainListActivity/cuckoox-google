import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { AuthProvider, useAuth, Case, Role, AppUser } from '@/src/contexts/AuthContext';
import authService from '@/src/services/authService';
import { menuService } from '@/src/services/menuService';
import { User as OidcUser } from 'oidc-client-ts';
import { RecordId } from 'surrealdb';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value.toString(); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] || null,
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock authService
vi.mock('../../../src/services/authService', () => ({
  default: {
    getUser: vi.fn(),
    loginRedirect: vi.fn(),
    logoutRedirect: vi.fn(),
    handleLoginRedirect: vi.fn(),
    setSurrealClient: vi.fn(),
  }
}));

// Mock menuService
vi.mock('../../../src/services/menuService', () => ({
  default: {
    loadUserMenus: vi.fn(),
    getUserMenus: vi.fn(),
    hasOperationPermission: vi.fn(),
    hasMenuPermission: vi.fn(),
    setClient: vi.fn(),
  },
  menuService: {
    loadUserMenus: vi.fn(),
    getUserMenus: vi.fn(),
    hasOperationPermission: vi.fn(),
    hasMenuPermission: vi.fn(),
    setClient: vi.fn(),
    setDataService: vi.fn(),
  },
}));

// Create a global mock dataService that tests can configure
const mockDataService = {
  setClient: vi.fn(),
  query: vi.fn(),
  select: vi.fn(),
  merge: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  getCase: vi.fn(),
  getCases: vi.fn(),
  updateCase: vi.fn(),
  createCase: vi.fn(),
  deleteCase: vi.fn(),
};

// Mock SurrealProvider
const mockSurrealClient = {
  select: vi.fn(),
  query: vi.fn(),
  merge: vi.fn(),
  signout: vi.fn(),
  signin: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
};

const mockGetAuthStatus = vi.fn();

vi.mock('@/src/contexts/SurrealProvider', () => ({
  useSurreal: () => ({
    surreal: mockSurrealClient,
    isConnected: true,
    isLoading: false,
    error: null,
    dbInfo: null,
    connect: vi.fn(),
    signout: mockSurrealClient.signout,
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
    getStoredAccessToken: vi.fn(),
    getAuthStatus: mockGetAuthStatus, // 添加getAuthStatus mock
  }),
  useDataService: () => mockDataService,
  useServiceWorkerComm: () => ({
    sendMessage: vi.fn(),
    isAvailable: vi.fn().mockReturnValue(true),
    waitForReady: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock console.error and console.warn to spy on them
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

// Test data
const mockAdminUser: AppUser = {
  id: new RecordId('user', 'admin'),
  github_id: '--admin--',
  name: 'Admin User',
};

const mockOidcUser: AppUser = {
  id: new RecordId('user', 'oidc123'),
  github_id: 'oidc123',
  name: 'OIDC User',
  email: 'oidc@example.com',
};

const mockOidcClientUser = {
  profile: { sub: 'oidc123', name: 'OIDC User', email: 'oidc@example.com' },
  expired: false,
} as OidcUser;

const mockCase1: Case = {
  id: new RecordId('case', '123'),
  name: '测试案件1',
  case_number: 'TEST001',
  status: '立案',
};

const mockCase2: Case = {
  id: new RecordId('case', '456'),
  name: '测试案件2',
  case_number: 'TEST002',
  status: '审理中',
};

const mockCaseManagerRole: Role = {
  id: new RecordId('role', 'cm'),
  name: 'case_manager',
  description: '案件管理员',
};

const mockCreditorRole: Role = {
  id: new RecordId('role', 'cr'),
  name: 'creditor_representative',
  description: '债权人代表',
};

// Test Consumer Component
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let capturedAuthContext: any = {};

const TestConsumerComponent = () => {
  const auth = useAuth();
  capturedAuthContext = auth;
  return (
    <div>
      <div data-testid="isLoggedIn">{auth.isLoggedIn.toString()}</div>
      <div data-testid="userId">{auth.user?.id?.toString()}</div>
      <div data-testid="githubId">{auth.user?.github_id}</div>
      <div data-testid="selectedCaseId">{auth.selectedCaseId?.toString()}</div>
      <div data-testid="userCasesCount">{auth.userCases.length}</div>
      <div data-testid="currentRolesCount">{auth.currentUserCaseRoles.length}</div>
      <div data-testid="navMenuItemsCount">{auth.navMenuItems?.length || 0}</div>
      <div data-testid="isLoading">{auth.isLoading.toString()}</div>
      <div data-testid="isCaseLoading">{auth.isCaseLoading.toString()}</div>
      <div data-testid="isMenuLoading">{auth.isMenuLoading.toString()}</div>
      <div data-testid="navigateTo">{auth.navigateTo || 'null'}</div>
      <button onClick={async () => await auth.logout()}>Logout</button>
      <button onClick={() => auth.hasRole('admin')}>HasAdminRole</button>
      <button onClick={() => auth.hasRole('case_manager')}>HasCaseManagerRole</button>
      <button onClick={() => auth.clearNavigateTo()}>ClearNavigateTo</button>
      <button onClick={async () => await auth.selectCase('case:123')}>SelectCase</button>
      <button onClick={async () => await auth.refreshUserCasesAndRoles()}>RefreshCasesAndRoles</button>
    </div>
  );
};

// Helper to render the provider with the consumer
const renderWithAuthProvider = (initialUser: AppUser | null = null, initialOidcUser: OidcUser | null = null) => {
  capturedAuthContext = {};

  // Setup mocks based on initial user
  if (initialUser && initialUser.github_id !== '--admin--' && initialOidcUser) {
    (authService.getUser as Mock).mockResolvedValue(initialOidcUser);
    mockDataService.select.mockImplementation((recordId: string) => {
      if (recordId === initialUser.id.toString()) {
        return Promise.resolve(initialUser);
      }
      return Promise.resolve(null);
    });
    mockGetAuthStatus.mockResolvedValue(true);
  } else if (initialUser && initialUser.github_id === '--admin--') {
    (authService.getUser as Mock).mockResolvedValue(null);
    // For admin users, mock query to return admin user during authentication check
    mockDataService.query.mockResolvedValue([initialUser]);
    mockGetAuthStatus.mockResolvedValue(true);
  } else {
    (authService.getUser as Mock).mockResolvedValue(null);
    mockDataService.select.mockResolvedValue(null);
    mockDataService.query.mockResolvedValue([[]]);
    mockGetAuthStatus.mockResolvedValue(false);
  }

  const renderResult = render(
    <AuthProvider>
      <TestConsumerComponent />
    </AuthProvider>
  );
  
  return renderResult;
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleLogSpy.mockClear();

    // Default mocks
    (authService.getUser as Mock).mockResolvedValue(null);
    (mockSurrealClient.select as Mock).mockResolvedValue([]);
    (mockSurrealClient.query as Mock).mockResolvedValue([[]]);
    (mockSurrealClient.signout as Mock).mockResolvedValue(undefined);
    (mockSurrealClient.merge as Mock).mockResolvedValue(undefined);
    (authService.logoutRedirect as Mock).mockResolvedValue(undefined);
    
    // Reset dataService mocks
    mockDataService.setClient.mockClear();
    mockDataService.query.mockResolvedValue([[]]);
    mockDataService.select.mockResolvedValue(null);
    mockDataService.merge.mockResolvedValue(undefined);
    
    // Reset getAuthStatus mock
    mockGetAuthStatus.mockResolvedValue(false);
    
    // Mock menuService default behavior
    (menuService.loadUserMenus as Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('初始化和基本状态', () => {
    it('应该正确初始化默认状态', async () => {
      renderWithAuthProvider();
      
      await waitFor(() => {
        expect(capturedAuthContext.isLoggedIn).toBe(false);
        expect(capturedAuthContext.user).toBeNull();
        expect(capturedAuthContext.oidcUser).toBeNull();
        expect(capturedAuthContext.selectedCaseId).toBeNull();
        expect(capturedAuthContext.userCases).toEqual([]);
        expect(capturedAuthContext.currentUserCaseRoles).toEqual([]);
        expect(capturedAuthContext.navMenuItems).toEqual([]);
        expect(capturedAuthContext.isLoading).toBe(false);
        expect(capturedAuthContext.isCaseLoading).toBe(false);
        expect(capturedAuthContext.isMenuLoading).toBe(false);
        expect(capturedAuthContext.navigateTo).toBeNull();
      });
    });

    it('应该通过SurrealDB认证状态检查管理员用户会话', async () => {
      // 模拟SurrealDB返回管理员用户认证状态
      (mockSurrealClient.query as Mock).mockResolvedValue([[mockAdminUser]]);
      
      renderWithAuthProvider(mockAdminUser);
      
      await waitFor(() => {
        expect(capturedAuthContext.isLoggedIn).toBe(true);
        expect(capturedAuthContext.user?.github_id).toBe('--admin--');
      });
    });

    it('应该通过SurrealDB认证状态检查普通用户会话', async () => {
      // 模拟SurrealDB返回普通用户认证状态
      (authService.getUser as Mock).mockResolvedValue(mockOidcClientUser);
      (mockSurrealClient.select as Mock).mockResolvedValue([mockOidcUser]);
      
      renderWithAuthProvider(mockOidcUser, mockOidcClientUser);
      
      await waitFor(() => {
        expect(capturedAuthContext.isLoggedIn).toBe(true);
        expect(capturedAuthContext.user?.github_id).toBe('oidc123');
      });
    });
  });

  describe('setAuthState', () => {
    it('应该正确设置用户认证状态', async () => {
      renderWithAuthProvider();
      
      await waitFor(() => expect(capturedAuthContext.isLoggedIn).toBe(false));
      
      act(() => {
        capturedAuthContext.setAuthState(mockOidcUser, mockOidcClientUser);
      });
      
      await waitFor(() => {
        expect(capturedAuthContext.isLoggedIn).toBe(true);
        expect(capturedAuthContext.user?.id.toString()).toBe(mockOidcUser.id.toString());
        expect(capturedAuthContext.oidcUser).toBe(mockOidcClientUser);
      });
    });

    it('应该在设置认证状态时更新SurrealDB认证状态', async () => {
      renderWithAuthProvider();
      
      act(() => {
        capturedAuthContext.setAuthState(mockOidcUser, mockOidcClientUser);
      });
      
      await waitFor(() => {
        // 登录状态现在通过SurrealDB的getAuthStatus获取，验证状态已更新
        expect(capturedAuthContext.isLoggedIn).toBe(true);
        expect(capturedAuthContext.user?.github_id).toBe('oidc123');
        expect(capturedAuthContext.oidcUser).toBe(mockOidcClientUser);
      });
    });
  });

  describe('hasRole', () => {
    describe('管理员用户', () => {
      beforeEach(async () => {
        // 模拟SurrealDB返回管理员用户认证状态
        (mockSurrealClient.query as Mock).mockResolvedValue([[mockAdminUser]]);
        renderWithAuthProvider(mockAdminUser);
        await waitFor(() => expect(capturedAuthContext.isLoggedIn).toBe(true));
      });

      it('应该对任何角色都返回true', () => {
        expect(capturedAuthContext.hasRole('admin')).toBe(true);
        expect(capturedAuthContext.hasRole('case_manager')).toBe(true);
        expect(capturedAuthContext.hasRole('creditor_representative')).toBe(true);
        expect(capturedAuthContext.hasRole('any_role')).toBe(true);
      });
    });

    describe('普通OIDC用户', () => {
      async function setupOidcUserAndRoles(roles: Role[], selectedCase: string | null = 'case:123') {
        (authService.getUser as Mock).mockResolvedValue(mockOidcClientUser);
        (mockSurrealClient.select as Mock).mockImplementation((recordId: string) => {
          if (recordId === mockOidcUser.id.toString()) {
            return Promise.resolve([mockOidcUser]);
          }
          return Promise.resolve([]);
        });
        
        (mockSurrealClient.query as Mock).mockImplementation(async (query: string) => {
          if (query.includes('SELECT') && query.includes('user_case_role')) {
            return [roles.map(r => ({ 
              case_details: mockCase1, 
              role_details: r 
            }))];
          }
          return [[]];
        });

        renderWithAuthProvider(mockOidcUser, mockOidcClientUser);
        
        await waitFor(() => expect(capturedAuthContext.isLoggedIn).toBe(true));
        await waitFor(() => expect(capturedAuthContext.user?.id.toString()).toBe(mockOidcUser.id.toString()));

                 if (roles.length > 0 && selectedCase) {
           act(() => {
             capturedAuthContext.__TEST_setCurrentUserCaseRoles?.(roles);
             capturedAuthContext.__TEST_setSelectedCaseId?.(selectedCase);
           });
           await waitFor(() => expect(capturedAuthContext.selectedCaseId).toBe(selectedCase));
         }
      }

      it('应该在有对应角色时返回true', async () => {
        await setupOidcUserAndRoles([mockCaseManagerRole], 'case:123');
        expect(capturedAuthContext.hasRole('case_manager')).toBe(true);
      });

      it('应该在没有对应角色时返回false', async () => {
        await setupOidcUserAndRoles([mockCreditorRole], 'case:123');
        expect(capturedAuthContext.hasRole('case_manager')).toBe(false);
      });

      it('应该在没有选择案件时返回false', async () => {
        await setupOidcUserAndRoles([mockCaseManagerRole], null);
        expect(capturedAuthContext.hasRole('case_manager')).toBe(false);
      });

      it('应该对admin角色返回false', async () => {
        await setupOidcUserAndRoles([mockCaseManagerRole], 'case:123');
        expect(capturedAuthContext.hasRole('admin')).toBe(false);
      });
    });

    describe('未登录用户', () => {
      beforeEach(async () => {
        (authService.getUser as Mock).mockResolvedValue(null);
        (mockSurrealClient.select as Mock).mockResolvedValue([]);
        renderWithAuthProvider(null);
        await waitFor(() => expect(capturedAuthContext.isLoggedIn).toBe(false));
      });

      it('应该对所有角色都返回false', () => {
        expect(capturedAuthContext.hasRole('admin')).toBe(false);
        expect(capturedAuthContext.hasRole('case_manager')).toBe(false);
        expect(capturedAuthContext.hasRole('creditor_representative')).toBe(false);
      });
    });
  });

  describe('selectCase', () => {
    beforeEach(async () => {
      // 模拟SurrealDB返回普通用户认证状态和案件角色数据
      (authService.getUser as Mock).mockResolvedValue(mockOidcClientUser);
      (mockSurrealClient.select as Mock).mockResolvedValue([mockOidcUser]);
      (mockSurrealClient.query as Mock).mockResolvedValue([[{
        case_details: mockCase1,
        role_details: mockCaseManagerRole,
      }]]);
      
      renderWithAuthProvider(mockOidcUser, mockOidcClientUser);
      await waitFor(() => expect(capturedAuthContext.isLoggedIn).toBe(true));
    });

    it('应该正确选择案件并设置角色', async () => {
      await act(async () => {
        await capturedAuthContext.selectCase('case:123');
      });
      
      await waitFor(() => {
        expect(capturedAuthContext.selectedCaseId?.toString()).toBe('case:⟨123⟩');
        // localStorage 现在存储序列化的 RecordId，所以检查是否包含正确的值
        const storedCaseId = localStorageMock.getItem('cuckoox-selectedCaseId');
        expect(storedCaseId).toBeTruthy();
        expect(JSON.parse(storedCaseId || '{}')).toBe('case:⟨123⟩');
      });
    });

         it('应该在选择案件时更新数据库中的last_login_case_id', async () => {
       await act(async () => {
         await capturedAuthContext.selectCase('case:123');
       });
       
       expect(mockSurrealClient.merge).toHaveBeenCalledWith(
         expect.any(Object), // User ID as RecordId object
         expect.objectContaining({
           last_login_case_id: expect.any(Object) // RecordId object
         })
       );
     });
  });

  describe('logout', () => {
    describe('管理员登出', () => {
      beforeEach(async () => {
        // 模拟SurrealDB返回管理员用户认证状态
        (mockSurrealClient.query as Mock).mockResolvedValue([[mockAdminUser]]);
        renderWithAuthProvider(mockAdminUser);
        await waitFor(() => expect(capturedAuthContext.isLoggedIn).toBe(true));
        (mockSurrealClient.signout as Mock).mockResolvedValue(undefined);
      });

      it('应该调用surreal.signout并清理客户端状态', async () => {
        await act(async () => {
          await capturedAuthContext.logout();
        });

        expect(mockSurrealClient.signout).toHaveBeenCalledTimes(1);
        expect(authService.logoutRedirect).not.toHaveBeenCalled();
        
        expect(capturedAuthContext.user).toBeNull();
        expect(capturedAuthContext.isLoggedIn).toBe(false);
        // 验证案件选择状态也被清除
        expect(localStorageMock.getItem('cuckoox-selectedCaseId')).toBeNull();
      });

      it('应该在surreal.signout失败时仍然清理客户端状态', async () => {
        const signOutError = new Error('SurrealDB signout failed');
        (mockSurrealClient.signout as Mock).mockRejectedValueOnce(signOutError);

        await act(async () => {
          await capturedAuthContext.logout();
        });
        
        expect(mockSurrealClient.signout).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error during logout process:', signOutError);
        
        expect(capturedAuthContext.user).toBeNull();
        expect(capturedAuthContext.isLoggedIn).toBe(false);
      });
    });

    describe('OIDC用户登出', () => {
      beforeEach(async () => {
        (authService.getUser as Mock).mockResolvedValue(mockOidcClientUser);
        (mockSurrealClient.select as Mock).mockImplementation((recordId: string) =>
          recordId === mockOidcUser.id.toString() ? Promise.resolve([mockOidcUser]) : Promise.resolve([])
        );
  
        renderWithAuthProvider(mockOidcUser, mockOidcClientUser);
        await waitFor(() => expect(capturedAuthContext.isLoggedIn).toBe(true));
        (authService.logoutRedirect as Mock).mockResolvedValue(undefined);
      });

      it('应该调用authService.logoutRedirect并清理客户端状态', async () => {
        await act(async () => {
          await capturedAuthContext.logout();
        });

        expect(authService.logoutRedirect).toHaveBeenCalledTimes(1);
        expect(mockSurrealClient.signout).not.toHaveBeenCalled();

        expect(capturedAuthContext.user).toBeNull();
        expect(capturedAuthContext.isLoggedIn).toBe(false);
      });

      it('应该在authService.logoutRedirect失败时仍然清理客户端状态', async () => {
        const logoutRedirectError = new Error('OIDC logout redirect failed');
        (authService.logoutRedirect as Mock).mockRejectedValueOnce(logoutRedirectError);
        
        await act(async () => {
          await capturedAuthContext.logout();
        });

        expect(authService.logoutRedirect).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith("Error during logout process:", logoutRedirectError);
        
        expect(capturedAuthContext.user).toBeNull();
        expect(capturedAuthContext.isLoggedIn).toBe(false);
      });
    });

    describe('无活跃用户时登出', () => {
      beforeEach(async () => {
        (authService.getUser as Mock).mockResolvedValue(null);
        (mockSurrealClient.select as Mock).mockResolvedValue([]);
        renderWithAuthProvider(null);
        await waitFor(() => expect(capturedAuthContext.isLoggedIn).toBe(false));
      });

      it('应该不调用任何登出方法但清理客户端状态', async () => {
        await act(async () => {
          await capturedAuthContext.logout();
        });

        expect(mockSurrealClient.signout).not.toHaveBeenCalled();
        expect(authService.logoutRedirect).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledWith("Logout called without a user session.");

        expect(capturedAuthContext.user).toBeNull();
        expect(capturedAuthContext.isLoggedIn).toBe(false);
      });
    });
  });

  describe('菜单权限管理', () => {
    it('管理员应该看到所有菜单项', async () => {
      // 设置管理员菜单项
      const adminMenus = [
        { id: 'dashboard', path: '/dashboard', labelKey: 'nav_dashboard', iconName: 'mdiViewDashboard' },
        { id: 'cases', path: '/cases', labelKey: 'nav_case_management', iconName: 'mdiBriefcase' },
        { id: 'admin_home', path: '/admin', labelKey: 'nav_system_management', iconName: 'mdiCog' },
      ];
      (menuService.loadUserMenus as Mock).mockResolvedValue(adminMenus);
      
      // 模拟SurrealDB返回管理员用户认证状态
      (mockSurrealClient.query as Mock).mockResolvedValue([[mockAdminUser]]);
      
      renderWithAuthProvider(mockAdminUser);
      
      await waitFor(() => {
        expect(capturedAuthContext.isLoggedIn).toBe(true);
        expect(capturedAuthContext.navMenuItems?.length).toBeGreaterThan(0);
      });
    });

    it('普通用户应该根据角色看到相应菜单项', async () => {
      // 设置case_manager用户菜单项
      const caseManagerMenus = [
        { id: 'dashboard', path: '/dashboard', labelKey: 'nav_dashboard', iconName: 'mdiViewDashboard' },
        { id: 'cases', path: '/cases', labelKey: 'nav_case_management', iconName: 'mdiBriefcase' },
        { id: 'creditors', path: '/creditors', labelKey: 'nav_creditor_management', iconName: 'mdiAccountCash' },
      ];
      (menuService.loadUserMenus as Mock).mockResolvedValue(caseManagerMenus);
      
      (mockSurrealClient.query as Mock).mockResolvedValue([[{
        case_details: mockCase1,
        role_details: mockCaseManagerRole,
      }]]);
      
      renderWithAuthProvider(mockOidcUser, mockOidcClientUser);
      
      await waitFor(() => {
        expect(capturedAuthContext.isLoggedIn).toBe(true);
             });
       
       act(() => {
         capturedAuthContext.__TEST_setCurrentUserCaseRoles?.([mockCaseManagerRole]);
         capturedAuthContext.__TEST_setSelectedCaseId?.(new RecordId('case', '123'));
       });
       
       await waitFor(() => {
         expect(capturedAuthContext.navMenuItems?.length).toBeGreaterThan(0);
       });
    });
  });

  describe('自动导航功能', () => {
              it('应该在案件状态为立案时自动导航到债权人管理', async () => {
       const caseWithStatus = { ...mockCase1, status: '立案' };
       
       // 设置包含债权人管理菜单的菜单项
       const menusWithCreditors = [
         { id: 'dashboard', path: '/dashboard', labelKey: 'nav_dashboard', iconName: 'mdiViewDashboard' },
         { id: 'cases', path: '/cases', labelKey: 'nav_case_management', iconName: 'mdiBriefcase' },
         { id: 'creditors', path: '/creditors', labelKey: 'nav_creditor_management', iconName: 'mdiAccountCash' },
       ];
       (menuService.loadUserMenus as Mock).mockResolvedValue(menusWithCreditors);
       
       (mockSurrealClient.query as Mock).mockResolvedValue([[{
         case_details: caseWithStatus,
         role_details: mockCaseManagerRole,
       }]]);
       
       renderWithAuthProvider(mockOidcUser, mockOidcClientUser);
       
       await waitFor(() => {
         expect(capturedAuthContext.isLoggedIn).toBe(true);
       });
       
       // 设置用户案件、角色和选中的案件ID
       // 注意：RecordId.toString() 返回 'case:⟨123⟩' 格式，所以需要使用这个格式作为 selectedCaseId
       const caseIdString = caseWithStatus.id.toString(); // 'case:⟨123⟩'
       
       act(() => {
         // 先设置userCases，这样自动导航逻辑才能找到案件
         capturedAuthContext.__TEST_setUserCases?.([caseWithStatus]);
         capturedAuthContext.__TEST_setCurrentUserCaseRoles?.([mockCaseManagerRole]);
         capturedAuthContext.__TEST_setSelectedCaseId?.(caseWithStatus.id);
       });
       
       // 等待状态更新
       await waitFor(() => {
         expect(capturedAuthContext.selectedCaseId?.toString()).toBe(caseIdString);
         expect(capturedAuthContext.userCases.length).toBe(1);
         expect(capturedAuthContext.currentUserCaseRoles.length).toBe(1);
         expect(capturedAuthContext.navMenuItems?.length).toBeGreaterThan(0);
       });
       
       // 检查是否有债权人管理菜单项
       const hasCreditorMenu = capturedAuthContext.navMenuItems?.some(
         (item: { path: string }) => item.path === '/creditors'
       );
       expect(hasCreditorMenu).toBe(true);
       
       // 检查案件状态 - 验证userCases中的案件
       expect(capturedAuthContext.userCases.length).toBe(1);
       const userCase = capturedAuthContext.userCases[0];
       expect(userCase.id.toString()).toBe(caseIdString); // RecordId格式
       expect(userCase.status).toBe('立案');
       
       const selectedCase = capturedAuthContext.userCases.find((c: Case) => c.id.toString() === capturedAuthContext.selectedCaseId?.toString());
       expect(selectedCase).toBeDefined();
       expect(selectedCase?.status).toBe('立案');
       
       // 等待自动导航触发
       await waitFor(() => {
         expect(capturedAuthContext.navigateTo).toBe('/creditors');
       }, { timeout: 3000 });
     });

    it('clearNavigateTo应该清除导航状态', async () => {
      renderWithAuthProvider();
      
      act(() => {
        capturedAuthContext.clearNavigateTo();
      });
      
      expect(capturedAuthContext.navigateTo).toBeNull();
    });
  });

  describe('refreshUserCasesAndRoles', () => {
    it('应该重新加载用户案件和角色', async () => {
      renderWithAuthProvider(mockOidcUser, mockOidcClientUser);
      
      await waitFor(() => expect(capturedAuthContext.isLoggedIn).toBe(true));
      
      (mockSurrealClient.query as Mock).mockResolvedValue([[{
        case_details: mockCase2,
        role_details: mockCreditorRole,
      }]]);
      
      await act(async () => {
        await capturedAuthContext.refreshUserCasesAndRoles();
      });
      
      // 验证查询被调用
      expect(mockSurrealClient.query).toHaveBeenCalled();
    });
  });

     describe('错误处理', () => {
     it('应该处理初始化时的错误', async () => {
       // 清除mock状态以确保没有缓存数据
       localStorageMock.clear();
       
       // 确保没有预设的mock
       vi.clearAllMocks();
       consoleErrorSpy.mockClear();
       
       // 在调用renderWithAuthProvider之前设置错误mock
       // 这样可以确保mock不会被renderWithAuthProvider覆盖
       (authService.getUser as Mock).mockRejectedValue(new Error('Auth service error'));
       (mockSurrealClient.select as Mock).mockResolvedValue([]);
       (mockSurrealClient.query as Mock).mockResolvedValue([[]]);
       
       // 直接渲染，不通过renderWithAuthProvider，避免mock被覆盖
       capturedAuthContext = {};
       render(
         <AuthProvider>
           <TestConsumerComponent />
         </AuthProvider>
       );
       
       // 等待AuthProvider的useEffect完成
       await waitFor(() => {
         expect(capturedAuthContext.isLoggedIn).toBe(false);
         expect(capturedAuthContext.isLoading).toBe(false);
       });
       
       // 验证错误被记录 - authService.getUser的错误会在主catch块中被捕获
       await waitFor(() => {
         // 验证authService.getUser确实被调用了
         expect(authService.getUser).toHaveBeenCalled();
         
         // 检查是否有错误被记录
         const hasMainErrorLog = consoleErrorSpy.mock.calls.some(call => 
           call[0] && call[0].includes('Error checking current user session')
         );
         
         expect(hasMainErrorLog).toBe(true);
         
         // 验证错误对象也被传递了
         const errorCall = consoleErrorSpy.mock.calls.find(call => 
           call[0] && call[0].includes('Error checking current user session')
         );
         expect(errorCall).toBeDefined();
         expect(errorCall?.[1]).toBeInstanceOf(Error);
         expect(errorCall?.[1].message).toBe('Auth service error');
       }, { timeout: 2000 });
     });

     it('应该处理案件选择时的错误', async () => {
       // 先设置用户登录状态
       (authService.getUser as Mock).mockResolvedValue(mockOidcClientUser);
       (mockSurrealClient.select as Mock).mockResolvedValue([mockOidcUser]);
        
       renderWithAuthProvider(mockOidcUser);
       
       await waitFor(() => expect(capturedAuthContext.isLoggedIn).toBe(true));
       
       // 模拟数据库查询错误
       (mockSurrealClient.query as Mock).mockRejectedValue(new Error('Database error'));
       
       await act(async () => {
         await capturedAuthContext.selectCase('case:123');
       });
       
               expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Error selecting case case:⟨123⟩:',
          expect.any(Error)
        );
     });
   });
});
