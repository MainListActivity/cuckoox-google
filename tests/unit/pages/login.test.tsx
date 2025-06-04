import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from '@/src/pages/login';
import { AppUser } from '@/src/contexts/AuthContext';
import { RecordId } from 'surrealdb';
import { Context as SurrealContext } from '@/src/contexts/SurrealProvider';
import Surreal from 'surrealdb';

// Mock dependencies
const mockNavigate = vi.fn();
const mockUseLocation = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
}));

const mockSetAuthState = vi.fn();
const mockUseAuthFn = vi.fn();
vi.mock('../../../src/contexts/AuthContext', () => ({
  useAuth: () => mockUseAuthFn(),
}));

const mockLoginRedirect = vi.fn();
vi.mock('../../../src/services/authService', () => ({
  default: {
    loginRedirect: (...args: any[]) => mockLoginRedirect(...args),
  },
}));

const mockDbSignin = vi.fn();
const mockConnect = vi.fn().mockResolvedValue(true);
const mockDisconnect = vi.fn().mockResolvedValue(undefined);
const mockSignout = vi.fn().mockResolvedValue(undefined);

const mockSurreal = {
  signin: mockDbSignin,
  connect: mockConnect,
} as unknown as Surreal;

vi.mock('../../../src/lib/surreal', () => ({
  db: mockSurreal,
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
  mockUseLocation.mockReturnValue({
    search,
    pathname: '/login',
    state,
  });
};

// Helper to set up useAuth mock
const setupMockAuth = (isLoggedIn: boolean, isLoading: boolean, user: AppUser | null) => {
  mockUseAuthFn.mockReturnValue({
    isLoggedIn,
    isLoading,
    setAuthState: mockSetAuthState,
    user,
  });
  if(LoginPage.prototype) {
    LoginPage.prototype.capturedAuthContext = { user };
  }
};

// Helper function to wrap component with necessary providers
const renderWithProviders = (children: React.ReactNode) => {
  return render(
    <SurrealContext.Provider
      value={{
        surreal: mockSurreal,
        isConnecting: false,
        isSuccess: true,
        isError: false,
        error: null,
        connect: () => Promise.resolve(true),
        disconnect: () => Promise.resolve(),
        signin: mockDbSignin,
        signout: () => Promise.resolve(),
      }}
    >
      {children}
    </SurrealContext.Provider>
  );
};


describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockAuth(false, false, null);
  });

  describe('OIDC Login View (Default)', () => {
    beforeEach(() => {
      setupMockLocation(false);
      renderWithProviders(<LoginPage />);
    });

    it('should display the GitHub login button and not the admin form', () => {
      expect(screen.getByText('login_github_button')).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: 'admin_username_label' })).not.toBeInTheDocument();
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
      renderWithProviders(<LoginPage />);
    });

    it('should display the admin login form and not the GitHub button as primary', () => {
      expect(screen.getByRole('textbox', { name: /admin_username_label/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/admin_password_label/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /admin_login_button/i })).toBeInTheDocument();
      expect(screen.queryByText('login_github_button')).not.toBeInTheDocument();
      expect(screen.getByText('back_to_oidc_login_link')).toBeInTheDocument();
    });
  });

  describe('Admin Login Form - Successful Submission', () => {
    beforeEach(async () => {
      setupMockLocation(true);
      mockDbSignin.mockResolvedValue(undefined);
      renderWithProviders(<LoginPage />);

      await act(async () => {
        fireEvent.change(screen.getByRole('textbox', { name: /admin_username_label/i }), { 
          target: { value: 'testadmin' } 
        });
        fireEvent.change(screen.getByLabelText(/admin_password_label/i), { 
          target: { value: 'password123' } 
        });
        fireEvent.click(screen.getByRole('button', { name: /admin_login_button/i }));
      });
    });

    it('should call db.signin with correct credentials and params', async () => {
      await waitFor(() => {
        expect(mockDbSignin).toHaveBeenCalledWith({
          user: 'testadmin',
          pass: 'password123',
          NS: import.meta.env.VITE_SURREALDB_NAMESPACE,
          DB: import.meta.env.VITE_SURREALDB_DATABASE,
          SC: 'account',
        });
      });
    });
    
    it('should call setAuthState with correct admin user object', async () => {
      await waitFor(() => {
        const [[actualCall]] = mockSetAuthState.mock.calls;
        expect(actualCall).toEqual(expect.objectContaining({
          github_id: '--admin--',
          name: 'administrator_name_generic testadmin',
        }));
        expect(actualCall.id).toBeInstanceOf(RecordId);
        expect(actualCall.id.tb).toBe('user');
        expect(actualCall.id.id).toBe('admin_testadmin');
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
      renderWithProviders(<LoginPage />);

      await act(async () => {
        fireEvent.change(screen.getByRole('textbox', { name: /admin_username_label/i }), { 
          target: { value: 'wrongadmin' } 
        });
        fireEvent.change(screen.getByLabelText(/admin_password_label/i), { 
          target: { value: 'wrongpass' } 
        });
        fireEvent.click(screen.getByRole('button', { name: /admin_login_button/i }));
      });
      
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
      let resolveSignin:any;
      mockDbSignin.mockImplementation(() => new Promise(resolve => { resolveSignin = resolve; }));
      
      renderWithProviders(<LoginPage />);

      fireEvent.change(screen.getByRole('textbox', { name: /admin_username_label/i }), { 
        target: { value: 'testadmin' } 
      });
      fireEvent.change(screen.getByLabelText(/admin_password_label/i), { 
        target: { value: 'password123' } 
      });
      fireEvent.click(screen.getByRole('button', { name: /admin_login_button/i }));

      expect(screen.getByText('admin_login_attempt_loading')).toBeInTheDocument();
      // During loading state, the button might be hidden or removed
      expect(screen.queryByRole('button')).not.toBeInTheDocument();

      await act(async () => {
        resolveSignin(undefined);
      });
      
      await waitFor(() => {
        expect(screen.queryByText('admin_login_attempt_loading')).not.toBeInTheDocument();
      });
    });
  });

  describe('Redirection - Already Logged-In OIDC User', () => {
    it('should navigate to /dashboard if OIDC user is already logged in', async () => {
      const oidcUser: AppUser = { id: new RecordId('user','123'), github_id: '123', name: 'Test User' };
      setupMockAuth(true, false, oidcUser);
      setupMockLocation(false);
      
      renderWithProviders(<LoginPage />);
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });

    it('should navigate to "from" location if specified and OIDC user logged in', async () => {
      const oidcUser: AppUser = { id: new RecordId('user','123'), github_id: '123', name: 'Test User' };
      setupMockAuth(true, false, oidcUser);
      setupMockLocation(false, { from: { pathname: '/some/protected/route' } });

      renderWithProviders(<LoginPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/some/protected/route', { replace: true });
      });
    });
  });

  describe('Redirection - Already Logged-In Admin User', () => {
    it('should navigate to /admin if admin user is already logged in and accesses admin login page', async () => {
      const adminUser: AppUser = { id: new RecordId('user','admin_super'), github_id: '--admin--', name: 'Super Admin' };
      setupMockAuth(true, false, adminUser);
      setupMockLocation(true); // Attempting to access ?admin=true

      renderWithProviders(<LoginPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });
      });
    });
  });
});
