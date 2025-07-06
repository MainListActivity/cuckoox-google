import { UserManager, WebStorageStateStore, User as OidcUser, UserManagerSettings } from 'oidc-client-ts';
import { RecordId } from 'surrealdb';

// Internal service worker client access - only for connection management
let internalClientInstance: any = null;

// Service Worker client connection management
const getInternalClient = async () => {
  if (!internalClientInstance) {
    // Dynamic import to get service worker client instance
    const { surrealClient } = await import('@/src/lib/surrealClient');
    internalClientInstance = await surrealClient();
  }
  return internalClientInstance;
};

// Connection management
let isConnected = false;
const connectToSurreal = async () => {
  if (isConnected) return;
  
  const client = await getInternalClient();
  // Note: Service Worker handles connection internally
  // Connection is established when client is obtained
  
  isConnected = true;
};

// JWT Token Management
interface JwtLoginRequest {
  username: string;
  password: string;
}

interface JwtLoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  user: {
    id: string;
    username: string;
    name: string;
    email?: string;
    roles: string[];
  };
}

interface JwtRefreshRequest {
  refresh_token: string;
}

interface JwtRefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

// User profile interface
interface AppUser extends Record<string, any> {
  id: RecordId;
  github_id: string;
  name: string;
  email?: string;
  created_at?: Date;
  updated_at?: Date;
  last_login_case_id?: string | null;
}

// OIDC Configuration
const oidcSettings: UserManagerSettings = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY || 'http://localhost:8082/realms/your-realm',
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID || 'your-client-id',
  redirect_uri: import.meta.env.VITE_OIDC_REDIRECT_URI || window.location.origin + '/oidc-callback',
  post_logout_redirect_uri: import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI || window.location.origin + '/login',
  response_type: 'code',
  scope: import.meta.env.VITE_OIDC_SCOPE || 'openid profile email',
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  automaticSilentRenew: true,
};

const userManager = new UserManager(oidcSettings);

// Enhanced Auth Service
class AuthService {
  private currentUser: any = null;
  private isAuthenticated = false;

  // JWT Authentication
  async loginWithJWT(credentials: JwtLoginRequest): Promise<JwtLoginResponse> {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Login failed');
    }

    const data = await response.json();
    
    // Store tokens and authenticate with SurrealDB
    await this.setAuthTokens(data.access_token, data.refresh_token, data.expires_in);
    
    return data;
  }

  // Root Admin JWT Authentication
  async loginRootAdminWithJWT(credentials: JwtLoginRequest): Promise<JwtLoginResponse> {
    const response = await fetch('/api/root-admins/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Root admin login failed');
    }

    const data = await response.json();
    
    // Store tokens but don't authenticate with SurrealDB for root admin
    // Root admin uses a different database and doesn't need SurrealDB connection
    localStorage.setItem('access_token', data.access_token);
    if (data.refresh_token) {
      localStorage.setItem('refresh_token', data.refresh_token);
    }
    if (data.expires_in) {
      const expiresAt = Date.now() + (data.expires_in * 1000);
      localStorage.setItem('token_expires_at', expiresAt.toString());
    }
    
    this.isAuthenticated = true;
    this.currentUser = data.user;
    
    return data;
  }

  async refreshToken(request: JwtRefreshRequest): Promise<JwtRefreshResponse> {
    const response = await fetch('/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Token refresh failed');
    }

    const data = await response.json();
    
    // Update tokens
    await this.setAuthTokens(data.access_token, data.refresh_token, data.expires_in);
    
    return data;
  }

  async register(userData: {
    username: string;
    password: string;
    name: string;
    email?: string;
  }): Promise<any> {
    const response = await fetch('/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Registration failed');
    }

    return response.json();
  }

  // Token Management
  async setAuthTokens(accessToken: string, refreshToken?: string, expiresIn?: number): Promise<void> {
    // Store tokens in localStorage for service worker access
    localStorage.setItem('access_token', accessToken);
    if (refreshToken) {
      localStorage.setItem('refresh_token', refreshToken);
    }
    if (expiresIn) {
      const expiresAt = Date.now() + (expiresIn * 1000);
      localStorage.setItem('token_expires_at', expiresAt.toString());
    }
    
    await connectToSurreal();
    const client = await getInternalClient();
    
    // Service Worker client handles token storage internally
    const tenantCode = localStorage.getItem('tenant_code');
    await client.authenticate(accessToken, refreshToken, expiresIn, tenantCode || undefined);
    
    this.isAuthenticated = true;
  }

  async clearAuthTokens(): Promise<void> {
    try {
      const client = await getInternalClient();
      await client.invalidate();
      
      // 清理localStorage中的token
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('token_expires_at');
      
      this.isAuthenticated = false;
      this.currentUser = null;
    } catch (error) {
      console.error('Error clearing auth tokens:', error);
      // 即使invalidate失败也要清理本地状态
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('token_expires_at');
      this.isAuthenticated = false;
      this.currentUser = null;
    }
  }

  async getStoredAccessToken(): Promise<string | null> {
    // Service Worker handles token storage internally
    // We check authentication status instead
    return this.isAuthenticated ? 'authenticated' : null;
  }

  // Tenant Management
  async setTenantCode(tenantCode: string): Promise<void> {
    // Store tenant code in localStorage for service worker access
    localStorage.setItem('tenant_code', tenantCode);
    
    // Reconnect to service worker with new tenant database
    const client = await getInternalClient();
    await client.connect({
      endpoint: import.meta.env.VITE_SURREALDB_WS_URL || 'ws://localhost:8000/rpc',
      namespace: import.meta.env.VITE_SURREALDB_NS || 'ck_go',
      database: tenantCode,
      sync_tokens: {
        access_token: localStorage.getItem('access_token'),
        refresh_token: localStorage.getItem('refresh_token'),
        token_expires_at: localStorage.getItem('token_expires_at'),
        tenant_code: tenantCode
      }
    });
    
    console.log('Tenant code set and connection updated:', tenantCode);
  }

  async getTenantCode(): Promise<string | null> {
    // Service Worker handles database selection internally
    return null;
  }

  // OIDC Authentication
  async getOidcUser(): Promise<OidcUser | null> {
    return userManager.getUser();
  }

  async loginWithOidcRedirect(): Promise<void> {
    await userManager.signinRedirect();
  }

  async handleOidcCallback(): Promise<OidcUser> {
    try {
      const oidcUser = await userManager.signinRedirectCallback();
      if (!oidcUser || oidcUser.expired) {
        throw new Error('OIDC login failed or user is expired.');
      }

      // Ensure connection and sync user to SurrealDB
      await connectToSurreal();
      await this.syncOidcUser(oidcUser);
      
      return oidcUser;
    } catch (error) {
      console.error('Error during OIDC login callback:', error);
      throw error;
    }
  }

  async logoutOidc(): Promise<void> {
    await userManager.signoutRedirect();
    await userManager.clearStaleState();
    await this.clearAuthTokens();
  }

  // User Management
  async syncOidcUser(oidcUser: OidcUser): Promise<AppUser> {
    const client = await getInternalClient();
    
    const githubId = oidcUser.profile.sub;
    const name = oidcUser.profile.name || oidcUser.profile.preferred_username || 'Unknown User';
    const email = oidcUser.profile.email || '';

    if (!githubId) {
      throw new Error('GitHub ID (sub claim) not found in OIDC user profile.');
    }

    const recordId = new RecordId('user', githubId);
    const existingUser = await client.select(recordId);

    let appUser: AppUser;
    if (existingUser) {
      appUser = await client.update(recordId, {
        id: recordId,
        github_id: githubId,
        name: name,
        email: email,
        updated_at: new Date(),
      }) as AppUser;
    } else {
      appUser = await client.create(recordId, {
        id: recordId,
        github_id: githubId,
        name: name,
        email: email,
        created_at: new Date(),
        updated_at: new Date(),
      }) as AppUser;
    }

    if (!appUser) {
      throw new Error('Failed to create or update user in SurrealDB.');
    }

    this.currentUser = appUser;
    this.isAuthenticated = true;
    
    return appUser;
  }

  async getCurrentUser(): Promise<any> {
    // Service Worker doesn't store current user state
    // Return the locally cached user
    return this.currentUser;
  }

  async setCurrentUser(user: any): Promise<void> {
    // Store user locally since Service Worker handles database operations
    this.currentUser = user;
  }

  // Authentication State
  async checkAuthenticationState(): Promise<boolean> {
    try {
      // Service Worker handles token validation internally
      // Return current authentication state
      return this.isAuthenticated;
    } catch {
      this.isAuthenticated = false;
      return false;
    }
  }

  getAuthenticationStatus(): boolean {
    return this.isAuthenticated;
  }

  // Error Handling
  isSessionExpiredError(error: any): boolean {
    if (!(error instanceof Error)) return false;
    const msg = error.message.toLowerCase();
    return (
      msg.includes('session') && msg.includes('expired')) ||
      msg.includes('token expired') ||
      msg.includes('jwt') ||
      msg.includes('unauthorized') ||
      msg.includes('401');
  }

  async handleSessionError(error: any): Promise<boolean> {
    if (this.isSessionExpiredError(error)) {
      await this.clearAuthTokens();
      return true;
    }
    return false;
  }

  // Aliases for backward compatibility
  async getUser(): Promise<OidcUser | null> {
    return this.getOidcUser();
  }

  async signout(): Promise<void> {
    await this.clearAuthTokens();
  }

  async logoutRedirect(): Promise<void> {
    await this.logoutOidc();
  }

  async clearTokens(): Promise<void> {
    await this.clearAuthTokens();
  }
}

// Setup OIDC event handlers
userManager.events.addUserLoaded((user) => {
  console.log('OIDC User loaded:', user);
});

userManager.events.addUserUnloaded(() => {
  console.log('OIDC User unloaded (session ended)');
});

userManager.events.addAccessTokenExpired(() => {
  console.log('OIDC Access token expired. Attempting silent renew...');
  userManager.signinSilent().catch(err => {
    console.error("Silent renew failed:", err);
  });
});

userManager.events.addUserSignedOut(() => {
  console.log('OIDC User signed out');
});

// Export singleton instance
export const authService = new AuthService();
export { userManager };
export default authService;