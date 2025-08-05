import React from 'react';
import { waitFor, act } from '@testing-library/react';
import { render } from '../utils/testUtils';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest';
import { queryWithAuth } from '@/src/utils/surrealAuth';
import { menuService } from '@/src/services/menuService';

// Mock authService
vi.mock('@/src/services/authService', () => ({
  default: {
    getUser: vi.fn().mockResolvedValue(null), // No OIDC user
    logoutRedirect: vi.fn(),
    setSurrealClient: vi.fn(),
    loginRedirect: vi.fn(),
    handleLoginRedirect: vi.fn(),
  },
}));

// Mock SurrealDB client and provider
const mockSurrealClient = {
  query: vi.fn(),
  select: vi.fn(),
  merge: vi.fn(),
  signout: vi.fn(),
  connect: vi.fn().mockResolvedValue(true),
  use: vi.fn().mockResolvedValue(true),
  close: vi.fn(),
  signin: vi.fn().mockResolvedValue(true),
};

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

const mockGetAuthStatus = vi.fn();

// Mock SurrealProvider components and hooks
vi.mock('@/src/contexts/SurrealProvider', () => ({
  SurrealProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-surreal-provider">{children}</div>
  ),
  useSurreal: () => ({
    client: mockSurrealClient,
    isConnected: true,
    isLoading: false,
    error: null,
    dbInfo: null,
    connect: vi.fn(),
    signout: mockSurrealClient.signout,
    setTokens: vi.fn(),
    clearTokens: vi.fn(),
    getStoredAccessToken: vi.fn(),
    getAuthStatus: mockGetAuthStatus,
  }),
  useSurrealClient: () => mockSurrealClient,
  useDataService: () => mockDataService,
  useServiceWorkerComm: () => ({
    sendMessage: vi.fn(),
    isAvailable: vi.fn().mockReturnValue(true),
    waitForReady: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock menuService
vi.mock('@/src/services/menuService', () => ({
  menuService: {
    loadUserMenus: vi.fn(),
    getUserMenus: vi.fn(),
    hasOperationPermission: vi.fn(),
    hasMenuPermission: vi.fn(),
    setClient: vi.fn(),
    setDataService: vi.fn(),
  },
}));

// Mock surrealAuth utility
vi.mock('@/src/utils/surrealAuth', () => ({
  queryWithAuth: vi.fn(),
  mutateWithAuth: vi.fn(),
}));

// Test component to access auth context
const TestComponent = ({ onMount }: { onMount?: (auth: any) => void }) => {
  const auth = useAuth();
  
  React.useEffect(() => {
    if (onMount) {
      onMount(auth);
    }
  }, [auth, onMount]);
  
  return (
    <div>
      <div data-testid="user-id">{auth.user?.github_id || 'no-user'}</div>
      <div data-testid="menu-loading">{auth.isMenuLoading ? 'loading' : 'loaded'}</div>
      <div data-testid="menu-count">{auth.navMenuItems?.length || 0}</div>
      {auth.navMenuItems?.map(item => (
        <div key={item.id} data-testid={`menu-${item.id}`}>
          {item.labelKey}
        </div>
      ))}
    </div>
  );
};

describe('Admin Menu Permissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    
    // Setup default mock implementations
    (queryWithAuth as any).mockImplementation(async (client: any, sql: string) => {
      if (sql.includes('select * from menu_metadata')) {
        return []; // Default empty menu
      }
      if (sql.includes('SELECT * FROM user_case_role')) {
        return []; // Default empty roles
      }
      return null;
    });
    
    (menuService.loadUserMenus as any).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should load all menu items for admin user without role filtering', async () => {
    // Setup admin user
    const adminUser = {
      id: 'user:--admin--',
      github_id: '--admin--',
      name: 'Admin User',
      email: 'admin@example.com',
    };

    // Mock menu items for admin
    const adminMenuItems = [
      { id: 'dashboard', path: '/dashboard', labelKey: 'nav_dashboard', iconName: 'mdiViewDashboard' },
      { id: 'cases', path: '/cases', labelKey: 'nav_case_management', iconName: 'mdiBriefcase' },
      { id: 'case_members', path: '/case-members', labelKey: 'nav_case_members', iconName: 'mdiAccountMultiple' },
      { id: 'creditors', path: '/creditors', labelKey: 'nav_creditor_management', iconName: 'mdiAccountCash' },
      { id: 'claims_list', path: '/claims-list', labelKey: 'nav_claims_list', iconName: 'mdiClipboardList' },
      { id: 'my_claims', path: '/my-claims', labelKey: 'nav_my_claims', iconName: 'mdiClipboardAccount' },
      { id: 'claims_submit', path: '/claims-submit', labelKey: 'nav_claims_submit', iconName: 'mdiClipboardPlus' },
      { id: 'online_meetings', path: '/online-meetings', labelKey: 'nav_online_meetings', iconName: 'mdiVideo' },
      { id: 'messages', path: '/messages', labelKey: 'nav_messages', iconName: 'mdiMessage' },
      { id: 'admin_home', path: '/admin', labelKey: 'nav_system_management', iconName: 'mdiCog' },
    ];

    // Mock menuService.loadUserMenus to return admin menu items
    (menuService.loadUserMenus as any).mockResolvedValue(adminMenuItems);

    // Mock SurrealDB responses
    mockSurrealClient.select.mockResolvedValue([adminUser]);
    mockSurrealClient.query.mockResolvedValue([[]]); // Empty user_case_role for admin
    mockGetAuthStatus.mockResolvedValue(true);

    let authContext: any;

    const { getByTestId } = render(
      <AuthProvider>
        <TestComponent onMount={(auth) => { authContext = auth; }} />
      </AuthProvider>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(authContext).toBeDefined();
    });

    // Manually set auth state
    await act(async () => {
      authContext.setAuthState(adminUser);
    });

    // Wait for user to be set
    await waitFor(() => {
      expect(getByTestId('user-id')).toHaveTextContent('--admin--');
    });

    // Wait for menu to load
    await waitFor(() => {
      expect(getByTestId('menu-loading')).toHaveTextContent('loaded');
    }, { timeout: 3000 });

    // Check that all menu items are loaded (10 items in the mock)
    expect(getByTestId('menu-count')).toHaveTextContent('10');

    // Verify all menu items are present
    const expectedMenuItems = [
      'dashboard',
      'cases',
      'case_members',
      'creditors',
      'claims_list',
      'my_claims',
      'claims_submit',
      'online_meetings',
      'messages',
      'admin_home',
    ];

    for (const menuId of expectedMenuItems) {
      expect(getByTestId(`menu-${menuId}`)).toBeInTheDocument();
    }
  });

  it('should filter menu items for non-admin user based on roles', async () => {
    // Setup regular user
    const regularUser = {
      id: 'user:12345',
      github_id: '12345',
      name: 'Regular User',
      email: 'user@example.com',
    };

    // Mock user with only creditor_representative role and corresponding menu items
    const creditorMenuItems = [
      { id: 'dashboard', path: '/dashboard', labelKey: 'nav_dashboard', iconName: 'mdiViewDashboard' },
      { id: 'my_claims', path: '/my-claims', labelKey: 'nav_my_claims', iconName: 'mdiClipboardAccount' },
      { id: 'claims_submit', path: '/claims-submit', labelKey: 'nav_claims_submit', iconName: 'mdiClipboardPlus' },
      { id: 'online_meetings', path: '/online-meetings', labelKey: 'nav_online_meetings', iconName: 'mdiVideo' },
      { id: 'messages', path: '/messages', labelKey: 'nav_messages', iconName: 'mdiMessage' },
    ];

    const userCaseRoleData = [{
      id: 'user_case_role:123',
      user_id: 'user:12345',
      case_details: {
        id: 'case:test123',
        name: 'Test Case',
        case_number: 'TC001',
      },
      role_details: {
        id: 'role:creditor_rep',
        name: 'creditor_representative',
        description: 'Creditor Representative',
      },
    }];

    // Mock menuService.loadUserMenus to return filtered menu items
    (menuService.loadUserMenus as any).mockResolvedValue(creditorMenuItems);

    mockSurrealClient.select.mockResolvedValue([regularUser]);
    mockSurrealClient.query.mockResolvedValue([userCaseRoleData]);
    mockGetAuthStatus.mockResolvedValue(true);

    let authContext: any;

    const { getByTestId, queryByTestId } = render(
      <AuthProvider>
        <TestComponent onMount={(auth) => { authContext = auth; }} />
      </AuthProvider>
    );

    // Wait for initial render
    await waitFor(() => {
      expect(authContext).toBeDefined();
    });

    // Manually set auth state
    await act(async () => {
      authContext.setAuthState(regularUser);
    });

    // Wait for user to be set
    await waitFor(() => {
      expect(getByTestId('user-id')).toHaveTextContent('12345');
    });

    // Wait for menu to load
    await waitFor(() => {
      expect(getByTestId('menu-loading')).toHaveTextContent('loaded');
    }, { timeout: 3000 });

    // Check that only creditor_representative menu items are loaded
    expect(getByTestId('menu-count')).toHaveTextContent('5'); // Should have 5 items

    // Verify only creditor_representative accessible items are present
    expect(getByTestId('menu-dashboard')).toBeInTheDocument();
    expect(getByTestId('menu-my_claims')).toBeInTheDocument();
    expect(getByTestId('menu-claims_submit')).toBeInTheDocument();
    expect(getByTestId('menu-online_meetings')).toBeInTheDocument();
    expect(getByTestId('menu-messages')).toBeInTheDocument();

    // Verify admin-only items are not present
    expect(queryByTestId('menu-cases')).not.toBeInTheDocument();
    expect(queryByTestId('menu-creditors')).not.toBeInTheDocument();
    expect(queryByTestId('menu-claims_list')).not.toBeInTheDocument();
    expect(queryByTestId('menu-admin_home')).not.toBeInTheDocument();
  });
});
