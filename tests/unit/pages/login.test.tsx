import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from '@/src/pages/login'; // Adjust path as needed
import { AppUser } from '@/src/contexts/AuthContext'; // Assuming AppUser is exported

// Mock dependencies
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: vi.fn(),
  };
});

const mockSetAuthState = vi.fn();
const mockUseAuth = vi.fn();
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: mockUseAuth,
  // Assuming AppUser might be re-exported or used by LoginPage.test.tsx directly
}));

const mockLoginRedirect = vi.fn();
vi.mock('../../../src/services/authService', () => ({
  default: {
    loginRedirect: mockLoginRedirect,
  },
}));

const mockDbSignin = vi.fn();
vi.mock('../../../src/lib/surreal', () => ({
  db: {
    signin: mockDbSignin,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
        if (options && typeof options === 'object' && 'message' in options) {
            return `${key} ${options.message}`;
        }
        if (options && typeof options === 'object' && 'username' in options) {
            return `${key} ${options.username}`;
        }
        return key;
    },
  }),
}));

// Helper to set up useLocation mock
const setupMockLocation = (isAdmin: boolean, state: any = null) => {
  const search = isAdmin ? '?admin=true' : '';
  (vi.mocked(require('react-router-dom').useLocation) as any).mockReturnValue({
    search: search,
    pathname: '/login',
    state: state,
  });
};

// Helper to set up useAuth mock
const setupMockAuth = (isLoggedIn: boolean, isLoading: boolean, user: AppUser | null) => {
  mockUseAuth.mockReturnValue({
    isLoggedIn,
    isLoading,
    setAuthState: mockSetAuthState,
    user,
    // Provide other functions/values if LoginPage uses them, e.g. capturedAuthContext for userIsAdmin
    // This is a simplified version, LoginPage's userIsAdmin helper needs access to user.
    // For the test, we can make userIsAdmin part of the mock if it's simple enough
    // or ensure the LoginPage internal `userIsAdmin` can access the mocked user.
    // For simplicity in this test, the redirection checks will rely on the `user` object directly.
  });
   // This is a bit of a hack to make the internal userIsAdmin() in LoginPage work with the mock.
   // It assumes LoginPage might be trying to read 'user' from the return of useAuth()
   // in a way that's not directly captured by the simple mock above in all scenarios.
   // The actual LoginPage uses `const { user } = useAuth()` in its `userIsAdmin` helper through `capturedAuthContext`.
   // In a test, `capturedAuthContext` would not exist. So, we ensure `user` is on the top level.
   if(LoginPage.prototype) { // Check if LoginPage is a class component, unlikely for FC
     LoginPage.prototype.capturedAuthContext = { user };
   }
};


describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default Auth State: not logged in, not loading
    setupMockAuth(false, false, null);
  });

  describe('OIDC Login View (Default)', () => {
    beforeEach(() => {
      setupMockLocation(false);
      render(<LoginPage />);
    });

    it('should display the GitHub login button and not the admin form', () => {
      expect(screen.getByText('login_github_button')).toBeInTheDocument();
      expect(screen.queryByLabelText('admin_username_label')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('admin_password_label')).not.toBeInTheDocument();
      expect(screen.queryByText('admin_login_button')).not.toBeInTheDocument();
    });

    it('should call authService.loginRedirect when GitHub button is clicked', () => {
      fireEvent.click(screen.getByText('login_github_button'));
      expect(mockLoginRedirect).toHaveBeenCalledTimes(1);
    });
  });

  describe('Admin Login View', () => {
    beforeEach(() => {
      setupMockLocation(true);
      render(<LoginPage />);
    });

    it('should display the admin login form and not the GitHub button as primary', () => {
      expect(screen.getByLabelText('admin_username_label')).toBeInTheDocument();
      expect(screen.getByLabelText('admin_password_label')).toBeInTheDocument();
      expect(screen.getByText('admin_login_button')).toBeInTheDocument();
      // GitHub button might be part of a link to switch views, so check it's not the main call to action
      expect(screen.queryByText('login_github_button')).not.toBeInTheDocument(); 
      expect(screen.getByText('back_to_oidc_login_link')).toBeInTheDocument();
    });
  });

  describe('Admin Login Form - Successful Submission', () => {
    beforeEach(()_ => {
        setupMockLocation(true);
        mockDbSignin.mockResolvedValue(undefined); // Simulate successful signin
        render(<LoginPage />);

        fireEvent.change(screen.getByLabelText('admin_username_label'), { target: { value: 'testadmin' } });
        fireEvent.change(screen.getByLabelText('admin_password_label'), { target: { value: 'password123' } });
        fireEvent.click(screen.getByText('admin_login_button'));
    });

    it('should call db.signin with correct credentials and params', async () => {
      await waitFor(() => {
        expect(mockDbSignin).toHaveBeenCalledWith({
          user: 'testadmin',
          pass: 'password123',
          NS: import.meta.env.VITE_SURREALDB_NAMESPACE, // Or admin specific if set
          DB: import.meta.env.VITE_SURREALDB_DATABASE, // Or admin specific if set
          SC: 'account', // Default scope
        });
      });
    });
    
    it('should call setAuthState with correct admin user object', async () => {
        await waitFor(() => {
            expect(mockSetAuthState).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'user:admin_testadmin',
                    github_id: '--admin--',
                    name: 'administrator_name_generic testadmin', // Due to mock t function
                }),
                null
            );
        });
    });

    it('should navigate to /admin', async () => {
        await waitFor(() => {
            expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });
        });
    });
  });

  describe('Admin Login Form - Failed Submission', () => {
    const errorMessage = 'Invalid credentials';
    beforeEach(async () => {
      setupMockLocation(true);
      mockDbSignin.mockRejectedValue(new Error(errorMessage));
      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText('admin_username_label'), { target: { value: 'wrongadmin' } });
      fireEvent.change(screen.getByLabelText('admin_password_label'), { target: { value: 'wrongpass' } });
      fireEvent.click(screen.getByText('admin_login_button'));
      
      // Wait for error message to appear
      await screen.findByText(`error_admin_login_failed ${errorMessage}`);
    });
    
    it('should display an error message', () => {
      expect(screen.getByText(`error_admin_login_failed ${errorMessage}`)).toBeInTheDocument();
    });

    it('should not call setAuthState', () => {
      expect(mockSetAuthState).not.toHaveBeenCalled();
    });

    it('should not navigate to /admin', () => {
      expect(mockNavigate).not.toHaveBeenCalledWith('/admin', { replace: true });
    });
  });
  
  describe('Loading State - Admin Login Processing', () => {
    it('should show loading message during admin login attempt', async () => {
      setupMockLocation(true);
      // Create a promise that we can resolve manually
      let resolveSignin:any;
      mockDbSignin.mockImplementation(() => new Promise(resolve => { resolveSignin = resolve; }));
      
      render(<LoginPage />);

      fireEvent.change(screen.getByLabelText('admin_username_label'), { target: { value: 'testadmin' } });
      fireEvent.change(screen.getByLabelText('admin_password_label'), { target: { value: 'password123' } });
      fireEvent.click(screen.getByText('admin_login_button'));

      // Check for loading message immediately after click (or use waitFor)
      expect(screen.getByText('admin_login_attempt_loading')).toBeInTheDocument();
      expect(screen.getByText('admin_logging_in_button')).toBeDisabled();

      // Resolve the promise to allow the component to finish processing
      await act(async () => {
        resolveSignin(undefined); // Simulate successful signin
      });
      
      // Loading message should disappear after processing
      await waitFor(() => {
        expect(screen.queryByText('admin_login_attempt_loading')).not.toBeInTheDocument();
      });
    });
  });

  describe('Redirection - Already Logged-In OIDC User', () => {
    it('should navigate to /dashboard if OIDC user is already logged in', async () => {
      const oidcUser: AppUser = { id: 'user:123', github_id: '123', name: 'Test User' };
      setupMockAuth(true, false, oidcUser);
      setupMockLocation(false);
      
      render(<LoginPage />);
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });

    it('should navigate to "from" location if specified and OIDC user logged in', async () => {
      const oidcUser: AppUser = { id: 'user:123', github_id: '123', name: 'Test User' };
      setupMockAuth(true, false, oidcUser);
      setupMockLocation(false, { from: { pathname: '/some/protected/route' } });

      render(<LoginPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/some/protected/route', { replace: true });
      });
    });
  });

  describe('Redirection - Already Logged-In Admin User', () => {
    it('should navigate to /admin if admin user is already logged in and accesses admin login page', async () => {
      const adminUser: AppUser = { id: 'user:admin_super', github_id: '--admin--', name: 'Super Admin' };
      setupMockAuth(true, false, adminUser);
      setupMockLocation(true); // Attempting to access ?admin=true

      render(<LoginPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });
      });
    });
  });
});
