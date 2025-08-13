import { UserManager, WebStorageStateStore, User as OidcUser, UserManagerSettings } from 'oidc-client-ts';
import Surreal, { RecordId } from 'surrealdb';
import { useSurrealClient } from '@/src/contexts/SurrealProvider';

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
  [x: string]: any;
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
  redirect_uri: import.meta.env.VITE_OIDC_REDIRECT_URI || (typeof window !== 'undefined' ? window.location.origin + '/oidc-callback' : 'http://localhost:3000/oidc-callback'),
  post_logout_redirect_uri: import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI || (typeof window !== 'undefined' ? window.location.origin + '/login' : 'http://localhost:3000/login'),
  response_type: 'code',
  scope: import.meta.env.VITE_OIDC_SCOPE || 'openid profile email',
  userStore: new WebStorageStateStore({ store: typeof window !== 'undefined' ? window.localStorage : {} as any }),
  automaticSilentRenew: true,
};

const userManager = new UserManager(oidcSettings);

// Enhanced Auth Service with dependency injection support
class AuthService {
  private currentUser: any = null;
  private isAuthenticated = false;
  private surreal:Surreal | null = null;

  public setSurrealClient(client: Surreal) {
    this.surreal = client;
  }

  /**
   * Get the current Surreal client
   */
  private async getSurrealClient(): Promise<Surreal> {
    return this.surreal!;
  }

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

    // Root admin token management
    await this.setAuthTokens(data.access_token, data.refresh_token, data.expires_in);

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
    // 新的Service Worker架构中，认证由SurrealProvider统一管理
    // authService只需要存储token到localStorage，让Service Worker处理认证
    // localStorage.setItem('access_token', accessToken);
    // if (refreshToken) {
    //   localStorage.setItem('refresh_token', refreshToken);
    // }
    // if (expiresIn) {
    //   localStorage.setItem('token_expires_in', expiresIn.toString());
    // }
    const client = await this.getSurrealClient();
    client.authenticate(accessToken);
    this.isAuthenticated = true;
    console.log('Auth tokens stored, Service Worker will handle authentication');
  }

  async clearAuthTokens(): Promise<void> {
    try {
      const client = await this.getSurrealClient();
      await client.invalidate();

      // Service Worker handles token clearing, only need to clear tenant code for reconnection
      localStorage.removeItem('tenant_code');

      this.isAuthenticated = false;
      this.currentUser = null;
    } catch (error) {
      console.error('Error clearing auth tokens:', error);
      // Even if invalidate fails, clear local state
      localStorage.removeItem('tenant_code');
      this.isAuthenticated = false;
      this.currentUser = null;
      // Don't throw error to ensure logout flow can continue
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
    
      const client = await this.getSurrealClient();
      await client.use({namespace: 'ck_go', database: tenantCode});
    // 新的Service Worker架构不需要在authService中处理连接
    // SurrealProvider会通过switchTenant方法处理租户切换
    console.log('Tenant code set:', tenantCode);
  }

  // 从SurrealDB获取登录状态
  async getAuthStatusFromSurreal(): Promise<boolean> {
    try {
      // 检查客户端是否可用

      const client = await this.getSurrealClient();
      if (!client) {
        return false;
      }

      // 使用SurrealQL的 $auth 变量检查认证状态
      const result = await client.query<any>('RETURN $auth;');
      
      // 如果 $auth 存在且不为null/undefined，则表示已认证
      return result && Array.isArray(result) && result[0] && result[0]!== null && result[0] !== undefined;
    } catch (error) {
      // 如果错误信息包含 "not ready"，说明客户端尚未准备好，这是正常情况
      if (error instanceof Error && error.message.includes('not ready')) {
        console.log('SurrealDB client not ready yet, skipping auth status check');
        return false;
      }
      console.error('检查Surreal认证状态失败:', error);
      return false;
    }
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

      // Sync user to SurrealDB
      await this.syncOidcUser(oidcUser);

      return oidcUser;
    } catch (error) {
      console.error('Error during OIDC login callback:', error);
      throw error;
    }
  }

  async logoutOidc(): Promise<void> {
    try {
      // Clear local state first
      await this.clearAuthTokens();

      // Clear OIDC user state
      await userManager.removeUser();
      await userManager.clearStaleState();

      // Simple redirect to login page, avoiding OIDC endpoint access
      const postLogoutUri = import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI || (typeof window !== 'undefined' ? window.location.origin + '/login' : 'http://localhost:3000/login');
      if (typeof window !== 'undefined') {
        window.location.href = postLogoutUri;
      }
    } catch (error) {
      console.error('Error during OIDC logout:', error);
      // Ensure state is cleared even if errors occur and redirect
      await this.clearAuthTokens();
      const postLogoutUri = import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI || (typeof window !== 'undefined' ? window.location.origin + '/login' : 'http://localhost:3000/login');
      if (typeof window !== 'undefined') {
        window.location.href = postLogoutUri;
      }
    }
  }

  // User Management
  async syncOidcUser(oidcUser: OidcUser): Promise<AppUser> {
    const client = await this.getSurrealClient();

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
      appUser = await client.create<AppUser,AppUser>(recordId, {
        id: recordId,
        github_id: githubId,
        name: name,
        email: email,
        created_at: new Date(),
        updated_at: new Date(),
      });
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