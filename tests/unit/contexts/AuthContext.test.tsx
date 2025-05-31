import React, { ReactNode } from 'react';
import { render, act, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthProvider, useAuth, Case, Role } // Removed AppUser as it's defined locally for test
    from '@/src/contexts/AuthContext'; // Adjust path as needed
import authService from '@/src/services/authService';
// import { db } from '@/src/lib/surreal'; // No longer directly imported by AuthContext
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
    get length() { return Object.keys(store).length; }, // Added for completeness
    key: (index: number) => Object.keys(store)[index] || null, // Added for completeness
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
  }
}));

// Mock SurrealProvider instead of direct db import
const mockSurrealClient = {
  select: vi.fn(),
  query: vi.fn(),
  merge: vi.fn(),
  signout: vi.fn(),
  signin: vi.fn(),
  create: vi.fn(), // Add other methods used by AuthContext if any
  delete: vi.fn(),
  // Add any other client methods AuthContext might use
};
vi.mock('@/src/contexts/SurrealProvider', () => ({
  useSurreal: () => ({ // This is the hook AuthContext now uses
    surreal: mockSurrealClient,
    isConnected: true, // Mock connection status
    isLoading: false,
    error: null,
    dbInfo: null,
    connect: vi.fn(),
    signout: mockSurrealClient.signout, // Ensure signout from useSurreal is also mocked if used directly
  }),
  // Keep SurrealProvider export if it's used by TestWrapper, but it's not directly.
  // SurrealProvider: ({ children } : {children: ReactNode}) => children,
}));

// Mock console.error and console.warn to spy on them
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});


// Helper types
interface AppUser {
  id: string;
  github_id: string;
  name: string;
  email?: string;
  last_login_case_id?: string | null;
}

const mockAdminUser: AppUser = {
  id: 'user:admin',
  github_id: '--admin--',
  name: 'Admin User',
};

const mockOidcUser: AppUser = {
  id: 'user:oidc123',
  github_id: 'oidc123',
  name: 'OIDC User',
  email: 'oidc@example.com',
};

const mockOidcClientUser = {
  profile: { sub: 'oidc123', name: 'OIDC User', email: 'oidc@example.com' },
  expired: false,
} as OidcUser;


// Test Consumer Component
let capturedAuthContext: any = {}; // To capture context values

const TestConsumerComponent = () => {
  const auth = useAuth();
  capturedAuthContext = auth; // Capture the context
  return (
    <div>
      <div data-testid="isLoggedIn">{auth.isLoggedIn.toString()}</div>
      <div data-testid="userId">{auth.user?.id}</div>
      <div data-testid="githubId">{auth.user?.github_id}</div>
      <div data-testid="selectedCaseId">{auth.selectedCaseId}</div>
      <button onClick={async () => await auth.logout()}>Logout</button>
      <button onClick={() => auth.hasRole('admin')}>HasAdminRole</button>
      <button onClick={() => auth.hasRole('caseManager')}>HasCaseManagerRole</button>
    </div>
  );
};

// Helper to render the provider with the consumer
const renderWithAuthProvider = (initialUser: AppUser | null = null, initialOidcUser: OidcUser | null = null) => {
  // Reset captured context for each render
  capturedAuthContext = {};

  // Mock initial state of authService.getUser and db.select for initial load
  if (initialUser && initialUser.github_id !== '--admin--' && initialOidcUser) {
    (authService.getUser as vi.Mock).mockResolvedValue(initialOidcUser);
    (db.select as vi.Mock).mockImplementation((recordId: string) => {
      if (recordId === initialUser.id) {
        return Promise.resolve([initialUser]);
      }
      return Promise.resolve([]);
    });
  } else if (initialUser && initialUser.github_id === '--admin--') {
     // For admin, oidcUser is typically null, and they are not fetched via authService.getUser initially
     (authService.getUser as vi.Mock).mockResolvedValue(null); // No OIDC session for admin
     // Admin user might be set directly via setAuthState or a similar mechanism not tied to OIDC getUser
  } else {
    (authService.getUser as vi.Mock).mockResolvedValue(null);
    (db.select as vi.Mock).mockResolvedValue([]);
  }
  
  // Mock db.query for loadUserCasesAndRoles to prevent errors, return empty by default
  (mockSurrealClient.query as vi.Mock).mockResolvedValue([[]]); // Simulates no cases/roles

  const renderResult = render(
    <AuthProvider>
      <TestConsumerComponent />
    </AuthProvider>
  );
  
  // If an initial user is provided, we need to manually set the state
  // as if the login process (setAuthState) has already occurred.
  // This bypasses the useEffect in AuthProvider for initial load simulation for tests.
  if (initialUser) {
    act(() => {
        capturedAuthContext.setAuthState(initialUser, initialOidcUser);
    });
  }
  
  return renderResult;
};


describe('AuthContext', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks(); // Clears all mocks including spies
    // Re-mock console.error and console.warn if they were cleared by vi.clearAllMocks() and you need them per test
    consoleErrorSpy.mockClear();
    consoleWarnSpy.mockClear();

    // Default mocks for services to prevent unwanted errors in tests not focused on them
    (authService.getUser as vi.Mock).mockResolvedValue(null);
    (mockSurrealClient.select as vi.Mock).mockResolvedValue([]);
    (mockSurrealClient.query as vi.Mock).mockResolvedValue([[]]); // Default to no cases/roles
    (mockSurrealClient.signout as vi.Mock).mockResolvedValue(undefined);
    (authService.logoutRedirect as vi.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe('hasRole', () => {
    describe('Admin User', () => {
      beforeEach(() => {
        renderWithAuthProvider(mockAdminUser);
      });

      it('should return true for "admin" roleName when user is admin', () => {
        expect(capturedAuthContext.hasRole('admin')).toBe(true);
      });

      it('should return false for other roleNames when user is admin', () => {
        expect(capturedAuthContext.hasRole('caseManager')).toBe(false);
      });
    });

    describe('Regular OIDC User', () => {
      const caseManagerRole: Role = { id: 'role:cm', name: 'caseManager' };
      const otherRole: Role = { id: 'role:or', name: 'otherRole' };

      it('should return true if user has the role in the selected case', async () => {
        renderWithAuthProvider(mockOidcUser, mockOidcClientUser);
        
        // Simulate selecting a case and having roles
        await act(async () => {
          capturedAuthContext.setCurrentUserCaseRoles([caseManagerRole, otherRole]);
          capturedAuthContext.setSelectedCaseId('case:123');
        });
        expect(capturedAuthContext.hasRole('caseManager')).toBe(true);
      });

      it('should return false if user does not have the role in the selected case', async () => {
        renderWithAuthProvider(mockOidcUser, mockOidcClientUser);
        await act(async () => {
          capturedAuthContext.setCurrentUserCaseRoles([otherRole]);
           capturedAuthContext.setSelectedCaseId('case:123');
        });
        expect(capturedAuthContext.hasRole('caseManager')).toBe(false);
      });

      it('should return false if no case is selected, even if user has roles conceptually', async () => {
        renderWithAuthProvider(mockOidcUser, mockOidcClientUser);
        await act(async () => {
          capturedAuthContext.setCurrentUserCaseRoles([caseManagerRole]);
          capturedAuthContext.setSelectedCaseId(null); // No case selected
        });
        expect(capturedAuthContext.hasRole('caseManager')).toBe(false);
      });
       it('should return false for "admin" roleName when user is a regular user', () => {
        renderWithAuthProvider(mockOidcUser, mockOidcClientUser);
        expect(capturedAuthContext.hasRole('admin')).toBe(false);
      });
    });

    describe('No User', () => {
       beforeEach(() => {
        renderWithAuthProvider(null); // No user logged in
      });

      it('should return false for "admin" roleName when no user is logged in', () => {
        expect(capturedAuthContext.hasRole('admin')).toBe(false);
      });

      it('should return false for any other roleName when no user is logged in', () => {
        expect(capturedAuthContext.hasRole('caseManager')).toBe(false);
      });
    });
  });

  describe('logout', () => {
    describe('Admin Logout', () => {
      beforeEach(async () => {
        renderWithAuthProvider(mockAdminUser); // Sets up admin user
        await act(async () => { // Ensure initial state is set
          capturedAuthContext.setAuthState(mockAdminUser, null);
        });
        (mockSurrealClient.signout as vi.Mock).mockResolvedValue(undefined); // Reset mock for specific test
      });

      it('should call surreal.signout, not call authService.logoutRedirect, and clear client state', async () => {
        await act(async () => {
          await capturedAuthContext.logout();
        });

        expect(mockSurrealClient.signout).toHaveBeenCalledTimes(1); // Changed from db.signout
        expect(authService.logoutRedirect).not.toHaveBeenCalled();
        
        expect(capturedAuthContext.user).toBeNull();
        expect(capturedAuthContext.isLoggedIn).toBe(false);
        expect(localStorageMock.getItem('cuckoox-user')).toBeNull();
        expect(localStorageMock.getItem('cuckoox-isLoggedIn')).toBeNull();
        expect(localStorageMock.getItem('cuckoox-selectedCaseId')).toBeNull();
      });

      it('should clear client state even if surreal.signout fails', async () => {
        const signOutError = new Error('SurrealDB signout failed');
        (mockSurrealClient.signout as vi.Mock).mockRejectedValueOnce(signOutError); // Changed from db.signout

        await act(async () => {
          await capturedAuthContext.logout();
        });
        
        expect(mockSurrealClient.signout).toHaveBeenCalledTimes(1); // Changed from db.signout
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error during SurrealDB signout:', signOutError);
        
        expect(capturedAuthContext.user).toBeNull();
        expect(capturedAuthContext.isLoggedIn).toBe(false);
        expect(localStorageMock.getItem('cuckoox-user')).toBeNull();
      });
    });

    describe('OIDC User Logout', () => {
      beforeEach(async () => {
        renderWithAuthProvider(mockOidcUser, mockOidcClientUser);
         await act(async () => { // Ensure initial state is set
          capturedAuthContext.setAuthState(mockOidcUser, mockOidcClientUser);
        });
        (authService.logoutRedirect as vi.Mock).mockResolvedValue(undefined); // Reset mock
      });

      it('should call authService.logoutRedirect, not call surreal.signout, and clear client state', async () => {
        await act(async () => {
          await capturedAuthContext.logout();
        });

        expect(authService.logoutRedirect).toHaveBeenCalledTimes(1);
        expect(mockSurrealClient.signout).not.toHaveBeenCalled(); // Changed from db.signout

        expect(capturedAuthContext.user).toBeNull();
        expect(capturedAuthContext.isLoggedIn).toBe(false);
        expect(localStorageMock.getItem('cuckoox-user')).toBeNull();
      });
       it('should clear client state even if authService.logoutRedirect fails', async () => {
        const logoutRedirectError = new Error('OIDC logout redirect failed');
        (authService.logoutRedirect as vi.Mock).mockRejectedValueOnce(logoutRedirectError);
        
        await act(async () => {
          await capturedAuthContext.logout();
        });

        expect(authService.logoutRedirect).toHaveBeenCalledTimes(1);
        expect(consoleErrorSpy).toHaveBeenCalledWith("Error during logout process:", logoutRedirectError);
        
        expect(capturedAuthContext.user).toBeNull();
        expect(capturedAuthContext.isLoggedIn).toBe(false);
        expect(localStorageMock.getItem('cuckoox-user')).toBeNull();
      });
    });

    describe('Logout with no active user', () => {
      beforeEach(async () => {
        renderWithAuthProvider(null); // No user
         await act(async () => { // Ensure initial state is set
          capturedAuthContext.setAuthState(null, null);
        });
      });

      it('should not call db.signout or authService.logoutRedirect, and clear client state', async () => {
        await act(async () => {
          await capturedAuthContext.logout();
        });

        expect(mockSurrealClient.signout).not.toHaveBeenCalled(); // Changed from db.signout
        expect(authService.logoutRedirect).not.toHaveBeenCalled();
        // Check for console.warn based on AuthContext implementation
        expect(consoleWarnSpy).toHaveBeenCalledWith("Logout called without a user session.");

        expect(capturedAuthContext.user).toBeNull();
        expect(capturedAuthContext.isLoggedIn).toBe(false);
        expect(localStorageMock.getItem('cuckoox-user')).toBeNull();
      });
    });
  });
});
