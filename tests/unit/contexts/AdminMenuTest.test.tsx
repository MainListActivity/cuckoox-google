import React from 'react';
import { render, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '@/src/contexts/AuthContext';
import { SurrealProvider } from '@/src/contexts/SurrealProvider';
import { vi, describe, beforeEach, it, expect, afterEach } from 'vitest';

// Mock authService
vi.mock('@/src/services/authService', () => ({
  default: {
    getUser: vi.fn().mockResolvedValue(null), // No OIDC user
    logoutRedirect: vi.fn(),
  },
}));

// Mock SurrealDB client
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
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
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

    // Mock SurrealDB responses
    mockSurrealClient.select.mockResolvedValue([adminUser]);
    mockSurrealClient.query.mockResolvedValue([[]]); // Empty user_case_role for admin

    let authContext: any;

    const { getByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <SurrealProvider 
          client={mockSurrealClient as any}
          endpoint="http://localhost:8000"
          namespace="test"
          database="test"
        >
          <AuthProvider>
            <TestComponent onMount={(auth) => { authContext = auth; }} />
          </AuthProvider>
        </SurrealProvider>
      </QueryClientProvider>
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

    // For admin user, we need to wait for the menu to be loaded
    // The fetchAndUpdateMenuPermissions should be called automatically for admin users
    // Let's add a small delay to ensure the effect runs
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 600)); // Wait for mock delay
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

    // Mock user with only creditor_representative role
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

    mockSurrealClient.select.mockResolvedValue([regularUser]);
    mockSurrealClient.query.mockResolvedValue([userCaseRoleData]);

    let authContext: any;

    const { getByTestId, queryByTestId } = render(
      <QueryClientProvider client={queryClient}>
        <SurrealProvider 
          client={mockSurrealClient as any}
          endpoint="http://localhost:8000"
          namespace="test"
          database="test"
        >
          <AuthProvider>
            <TestComponent onMount={(auth) => { authContext = auth; }} />
          </AuthProvider>
        </SurrealProvider>
      </QueryClientProvider>
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
