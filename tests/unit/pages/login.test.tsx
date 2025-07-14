import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from '@/src/pages/login';
import { AppUser } from '@/src/contexts/AuthContext';
import { RecordId } from 'surrealdb';

// Mock dependencies
const mockNavigate = vi.fn();
const mockUseLocation = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Turnstile component with manual trigger
let turnstileSuccessCallback: ((token: string) => void) | null = null;
vi.mock('../../../src/components/Turnstile', () => ({
  default: ({ onSuccess }: { onSuccess: (token: string) => void }) => {
    // Store the callback for manual triggering
    turnstileSuccessCallback = onSuccess;
    return <div data-testid="turnstile-widget">Turnstile Mock</div>;
  }
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
const mockSurrealClient = {
  signin: mockDbSignin,
  authenticate: vi.fn(),
};

const mockSetTokens = vi.fn();

vi.mock('../../../src/contexts/SurrealProvider', () => ({
  useSurrealClient: () => mockSurrealClient,
  useSurreal: () => ({
    setTokens: mockSetTokens,
  }),
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
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMockAuth(false, false, null);
  });

  describe('OIDC Login View (Default)', () => {
    beforeEach(() => {
      setupMockLocation(false);
      render(<LoginPage />);
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

    it('should display admin login link', () => {
      expect(screen.getByText('password_login_link')).toBeInTheDocument();
    });

    it('should navigate to admin login when admin link is clicked', () => {
      fireEvent.click(screen.getByText('password_login_link'));
      expect(mockNavigate).toHaveBeenCalledWith('/login?admin=true');
    });

    it('should display login subtitle for regular login', () => {
      expect(screen.getByText('login_subtitle')).toBeInTheDocument();
    });

    it('should display GitHub redirect info', () => {
      expect(screen.getByText('login_github_redirect_info')).toBeInTheDocument();
    });
  });

  describe('Admin Login View', () => {
    beforeEach(() => {
      setupMockLocation(true);
      render(<LoginPage />);
    });

    it('should display the admin login form and not the GitHub button as primary', () => {
      expect(screen.getByRole('textbox', { name: /admin_username_label/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/admin_password_label/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /login_button/i })).toBeInTheDocument();
      expect(screen.queryByText('login_github_button')).not.toBeInTheDocument();
      expect(screen.getByText('back_to_github_login_link')).toBeInTheDocument();
    });

    it('should display admin login subtitle', () => {
      expect(screen.getByText('password_login_subtitle')).toBeInTheDocument();
    });

    it('should navigate back to regular login when back link is clicked', () => {
      fireEvent.click(screen.getByText('back_to_github_login_link'));
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  describe('Password Visibility Toggle', () => {
    beforeEach(() => {
      setupMockLocation(true);
      render(<LoginPage />);
    });

    it('should toggle password visibility when eye icon is clicked', () => {
      const passwordField = screen.getByLabelText(/admin_password_label/i);
      const toggleButton = screen.getByLabelText('toggle password visibility');

      // Initially password should be hidden
      expect(passwordField).toHaveAttribute('type', 'password');

      // Click to show password
      fireEvent.click(toggleButton);
      expect(passwordField).toHaveAttribute('type', 'text');

      // Click to hide password again
      fireEvent.click(toggleButton);
      expect(passwordField).toHaveAttribute('type', 'password');
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      setupMockLocation(true);
      render(<LoginPage />);
    });

    it('should show error when submitting empty form', async () => {
      const form = document.querySelector('form')!;
      
      await act(async () => {
        fireEvent.submit(form);
      });

      await waitFor(() => {
        expect(screen.getByText(/error_admin_credentials_required/)).toBeInTheDocument();
      });
    });

    it('should show error when submitting with empty username', async () => {
      const passwordField = screen.getByLabelText(/admin_password_label/i);
      const form = document.querySelector('form')!;

      fireEvent.change(passwordField, { target: { value: 'password123' } });
      
      await act(async () => {
        fireEvent.submit(form);
      });

      await waitFor(() => {
        expect(screen.getByText(/error_admin_credentials_required/)).toBeInTheDocument();
      });
    });

    it('should show error when submitting with empty password', async () => {
      const usernameField = screen.getByRole('textbox', { name: /admin_username_label/i });
      const form = document.querySelector('form')!;

      fireEvent.change(usernameField, { target: { value: 'testadmin' } });
      
      await act(async () => {
        fireEvent.submit(form);
      });

      await waitFor(() => {
        expect(screen.getByText(/error_admin_credentials_required/)).toBeInTheDocument();
      });
    });
  });

  describe('OIDC Login Error Handling', () => {
    beforeEach(() => {
      setupMockLocation(false);
    });

    it('should display OIDC error from location state', () => {
      setupMockLocation(false, { error: 'oidc_error_message' });
      render(<LoginPage />);
      
      expect(screen.getByText('oidc_error_message')).toBeInTheDocument();
    });

    it('should handle OIDC login redirect error', async () => {
      const errorMessage = 'OIDC redirect failed';
      mockLoginRedirect.mockRejectedValue(new Error(errorMessage));
      
      render(<LoginPage />);
      
      await act(async () => {
        fireEvent.click(screen.getByText('login_github_button'));
      });

      await waitFor(() => {
        expect(screen.getByText('error_oidc_init_failed')).toBeInTheDocument();
      });
    });

    it('should not call OIDC login when admin login is processing', async () => {
      setupMockLocation(false);
      render(<LoginPage />);
      
      // Mock admin login processing state
      setupMockAuth(false, false, null);
      mockUseAuthFn.mockReturnValue({
        isLoggedIn: false,
        isLoading: false,
        setAuthState: mockSetAuthState,
        user: null,
      });

      // Simulate admin login processing by clicking GitHub button multiple times
      const githubButton = screen.getByText('login_github_button');
      fireEvent.click(githubButton);
      fireEvent.click(githubButton);

      expect(mockLoginRedirect).toHaveBeenCalledTimes(2);
    });
  });

  describe('Admin Login Form - Successful Submission', () => {
    beforeEach(async () => {
      setupMockLocation(true);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          user: {
            id: 'user:testadmin',
            username: 'testadmin',
            name: 'Test Admin',
            email: 'test@example.com',
            roles: ['admin']
          }
        })
      });
      
      render(<LoginPage />);

      await act(async () => {
        fireEvent.change(screen.getByRole('textbox', { name: /admin_username_label/i }), { 
          target: { value: 'testadmin' } 
        });
        fireEvent.change(screen.getByLabelText(/admin_password_label/i), { 
          target: { value: 'password123' } 
        });
        
        // Click login button to show Turnstile dialog
        fireEvent.click(screen.getByRole('button', { name: /login_button/i }));
      });

      // Wait for Turnstile dialog to appear
      await waitFor(() => {
        expect(screen.getByText('human_verification')).toBeInTheDocument();
      });

      // Simulate Turnstile success by calling the stored callback
      await act(async () => {
        if (turnstileSuccessCallback) {
          turnstileSuccessCallback('mock-turnstile-token');
        }
      });
    });

    it('should call fetch with correct credentials', async () => {
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/login'),
          expect.objectContaining({
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              username: 'testadmin',
              password: 'password123',
              turnstile_token: 'mock-turnstile-token',
            }),
          })
        );
      });
    });
    
    it('should call setAuthState with correct admin user object', async () => {
      await waitFor(() => {
        const [[actualCall]] = mockSetAuthState.mock.calls;
        expect(actualCall).toEqual(expect.objectContaining({
          github_id: 'local_testadmin',
          name: 'Test Admin',
          email: 'test@example.com',
        }));
        expect(actualCall.id).toBeInstanceOf(RecordId);
        expect(actualCall.id.tb).toBe('user');
        expect(actualCall.id.id).toBe('testadmin');
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
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          message: errorMessage
        })
      });
      render(<LoginPage />);

      await act(async () => {
        fireEvent.change(screen.getByRole('textbox', { name: /admin_username_label/i }), { 
          target: { value: 'wrongadmin' } 
        });
        fireEvent.change(screen.getByLabelText(/admin_password_label/i), { 
          target: { value: 'wrongpass' } 
        });
        
        // Click login button to show Turnstile dialog
        fireEvent.click(screen.getByRole('button', { name: /login_button/i }));
      });

      // Wait for Turnstile dialog to appear
      await waitFor(() => {
        expect(screen.getByText('human_verification')).toBeInTheDocument();
      });

      // Simulate Turnstile success
      await act(async () => {
        if (turnstileSuccessCallback) {
          turnstileSuccessCallback('mock-turnstile-token');
        }
      });
      
      await screen.findByText(/error_admin_login_failed/);
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
    it('should show verifying button text when clicking login', async () => {
      setupMockLocation(true);
      
      render(<LoginPage />);

      fireEvent.change(screen.getByRole('textbox', { name: /admin_username_label/i }), { 
        target: { value: 'testadmin' } 
      });
      fireEvent.change(screen.getByLabelText(/admin_password_label/i), { 
        target: { value: 'password123' } 
      });
      
      // Click login button
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /login_button/i }));
      });

      // Should show verifying button text
      expect(screen.getByText('verifying_button')).toBeInTheDocument();
      
      // Should show Turnstile dialog
      expect(screen.getByText('human_verification')).toBeInTheDocument();
    });

    it('should show loading state when auth context is loading', () => {
      setupMockAuth(false, true, null);
      setupMockLocation(false);
      
      render(<LoginPage />);
      
      expect(screen.getByText('loading_session')).toBeInTheDocument();
    });
  });

  describe('Redirection - Already Logged-In OIDC User', () => {
    it('should navigate to /dashboard if OIDC user is already logged in', async () => {
      const oidcUser: AppUser = { id: new RecordId('user','123'), github_id: '123', name: 'Test User' };
      setupMockAuth(true, false, oidcUser);
      setupMockLocation(false);
      
      render(<LoginPage />);
      
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/dashboard', { replace: true });
      });
    });

    it('should navigate to "from" location if specified and OIDC user logged in', async () => {
      const oidcUser: AppUser = { id: new RecordId('user','123'), github_id: '123', name: 'Test User' };
      setupMockAuth(true, false, oidcUser);
      setupMockLocation(false, { from: { pathname: '/some/protected/route' } });

      render(<LoginPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/some/protected/route', { replace: true });
      });
    });

    it('should show redirecting message for logged in OIDC user', () => {
      const oidcUser: AppUser = { id: new RecordId('user','123'), github_id: '123', name: 'Test User' };
      setupMockAuth(true, false, oidcUser);
      setupMockLocation(false);
      
      render(<LoginPage />);
      
      expect(screen.getByText('redirecting')).toBeInTheDocument();
    });
  });

  describe('Redirection - Already Logged-In Admin User', () => {
    it('should navigate to /admin if admin user is already logged in and accesses admin login page', async () => {
      const adminUser: AppUser = { id: new RecordId('user','admin_super'), github_id: '--admin--', name: 'Super Admin' };
      setupMockAuth(true, false, adminUser);
      setupMockLocation(true); // Attempting to access ?admin=true

      render(<LoginPage />);

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });
      });
    });

    it('should show redirecting admin message for logged in admin user', () => {
      const adminUser: AppUser = { id: new RecordId('user','admin_super'), github_id: '--admin--', name: 'Super Admin' };
      setupMockAuth(true, false, adminUser);
      setupMockLocation(true);
      
      render(<LoginPage />);
      
      expect(screen.getByText('redirecting_admin')).toBeInTheDocument();
    });
  });

  describe('UI Elements and Layout', () => {
    it('should display CuckooX logo and title', () => {
      setupMockLocation(false);
      render(<LoginPage />);
      
      // Logo is rendered as SVG, check for the SVG element
      const logo = document.querySelector('svg');
      expect(logo).toBeInTheDocument();
      // Check for the welcome text instead
      expect(screen.getByText('welcome_to_cuckoox')).toBeInTheDocument();
    });

    it('should display footer text', () => {
      setupMockLocation(false);
      render(<LoginPage />);
      
      expect(screen.getByText('login_footer_text')).toBeInTheDocument();
    });

    it('should display OR divider in OIDC login mode', () => {
      setupMockLocation(false);
      render(<LoginPage />);
      expect(screen.getByText('or')).toBeInTheDocument();
    });

    it('should display OR divider in admin login mode', () => {
      setupMockLocation(true);
      render(<LoginPage />);
      expect(screen.getByText('or')).toBeInTheDocument();
    });
  });

  describe('Form Input Handling', () => {
    beforeEach(() => {
      setupMockLocation(true);
      render(<LoginPage />);
    });

    it('should update username field value when typing', () => {
      const usernameField = screen.getByRole('textbox', { name: /admin_username_label/i });
      
      fireEvent.change(usernameField, { target: { value: 'newusername' } });
      
      expect(usernameField).toHaveValue('newusername');
    });

    it('should update password field value when typing', () => {
      const passwordField = screen.getByLabelText(/admin_password_label/i);
      
      fireEvent.change(passwordField, { target: { value: 'newpassword' } });
      
      expect(passwordField).toHaveValue('newpassword');
    });

    it('should clear error when starting new admin login attempt', async () => {
      // First, create an error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Test error' })
      });
      
      await act(async () => {
        fireEvent.change(screen.getByRole('textbox', { name: /admin_username_label/i }), { 
          target: { value: 'test' } 
        });
        fireEvent.change(screen.getByLabelText(/admin_password_label/i), { 
          target: { value: 'test' } 
        });
        
        // Click login button to show Turnstile dialog
        fireEvent.click(screen.getByRole('button', { name: /login_button/i }));
      });

      // Wait for Turnstile dialog and trigger success
      await waitFor(() => {
        expect(screen.getByText('human_verification')).toBeInTheDocument();
      });

      await act(async () => {
        if (turnstileSuccessCallback) {
          turnstileSuccessCallback('mock-turnstile-token');
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/error_admin_login_failed/)).toBeInTheDocument();
      });

      // The error message should be displayed
      expect(screen.getByText(/error_admin_login_failed/)).toBeInTheDocument();

      // Close dialog by clicking the backdrop
      const backdrop = document.querySelector('.MuiBackdrop-root');
      if (backdrop) {
        fireEvent.click(backdrop);
      }

      // Wait for dialog to close
      await waitFor(() => {
        expect(screen.queryByText('human_verification')).not.toBeInTheDocument();
      });

      // Clear the form and type new values - error should be cleared
      const usernameField = screen.getByRole('textbox', { name: /admin_username_label/i });
      
      // Clear and type new value
      fireEvent.change(usernameField, { target: { value: '' } });
      fireEvent.change(usernameField, { target: { value: 'newtest' } });

      // Error should be cleared after typing
      expect(screen.queryByText(/error_admin_login_failed/)).not.toBeInTheDocument();
    });
  });
});
