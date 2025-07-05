import { UserManager, WebStorageStateStore, User as OidcUser, UserManagerSettings } from 'oidc-client-ts';
import { RecordId } from 'surrealdb';

// Internal worker access - only for connection management
let internalWorkerInstance: any = null;

// Worker connection management
const getInternalWorker = async () => {
  if (!internalWorkerInstance) {
    // Dynamic import to get internal worker instance
    const { internalWorker } = await import('@/src/workers/surrealWorker');
    internalWorkerInstance = internalWorker;
  }
  return internalWorkerInstance;
};

// Connection management
let isConnected = false;
const connectToSurreal = async () => {
  if (isConnected) return;
  
  const worker = await getInternalWorker();
  const tenantCode = await worker.getTenantCode();
  
  await worker.connect({
    endpoint: import.meta.env.VITE_SURREAL_ENDPOINT || 'ws://localhost:8000/rpc',
    namespace: import.meta.env.VITE_SURREAL_NAMESPACE || 'production',
    database: tenantCode || import.meta.env.VITE_SURREAL_DATABASE || 'prod',
  });
  
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
    await connectToSurreal();
    const worker = await getInternalWorker();
    
    await worker.setTokens(accessToken, refreshToken, expiresIn);
    await worker.authenticate(accessToken);
    
    this.isAuthenticated = true;
  }

  async clearAuthTokens(): Promise<void> {
    const worker = await getInternalWorker();
    await worker.clearTokens();
    await worker.invalidate();
    
    this.isAuthenticated = false;
    this.currentUser = null;
  }

  async getStoredAccessToken(): Promise<string | null> {
    const worker = await getInternalWorker();
    return worker.getStoredAccessToken();
  }

  // Tenant Management
  async setTenantCode(tenantCode: string): Promise<void> {
    const worker = await getInternalWorker();
    await worker.setTenantCode(tenantCode);
    
    // Reset connection to use new tenant database
    isConnected = false;
    await connectToSurreal();
  }

  async getTenantCode(): Promise<string | null> {
    const worker = await getInternalWorker();
    return worker.getTenantCode();
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
    const worker = await getInternalWorker();
    
    const githubId = oidcUser.profile.sub;
    const name = oidcUser.profile.name || oidcUser.profile.preferred_username || 'Unknown User';
    const email = oidcUser.profile.email || '';

    if (!githubId) {
      throw new Error('GitHub ID (sub claim) not found in OIDC user profile.');
    }

    const recordId = new RecordId('user', githubId);
    const existingUser = await worker.select<AppUser>(recordId);

    let appUser: AppUser;
    if (existingUser) {
      appUser = await worker.update<AppUser, AppUser>(recordId, {
        id: recordId,
        github_id: githubId,
        name: name,
        email: email,
        updated_at: new Date(),
      });
    } else {
      appUser = await worker.create<AppUser>(recordId, {
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
    if (!this.currentUser) {
      const worker = await getInternalWorker();
      this.currentUser = await worker.getCurrentUser();
    }
    return this.currentUser;
  }

  async setCurrentUser(user: any): Promise<void> {
    const worker = await getInternalWorker();
    await worker.setCurrentUser(user);
    this.currentUser = user;
  }

  // Authentication State
  async checkAuthenticationState(): Promise<boolean> {
    try {
      const worker = await getInternalWorker();
      const token = await worker.getStoredAccessToken();
      this.isAuthenticated = !!token;
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