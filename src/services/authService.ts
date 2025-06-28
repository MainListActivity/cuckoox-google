import { UserManager, WebStorageStateStore, User as OidcUser, UserManagerSettings } from 'oidc-client-ts';
// import { db } from '../lib/surreal'; // REMOVED
import Surreal, { RecordId } from 'surrealdb'; // IMPORT Surreal class for type from the library

// --- JWT Token Management ---
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

// --- JWT Authentication Functions ---
const jwtAuth = {
  login: async (credentials: JwtLoginRequest): Promise<JwtLoginResponse> => {
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

    return response.json();
  },

  refresh: async (request: JwtRefreshRequest): Promise<JwtRefreshResponse> => {
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

    return response.json();
  },

  register: async (userData: {
    username: string;
    password: string;
    name: string;
    email?: string;
  }): Promise<any> => {
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
  },
};

// --- OIDC Configuration ---
// These settings need to be configured based on your Quarkus OIDC provider.
// Use Vite environment variables (import.meta.env.VITE_...)
const oidcSettings: UserManagerSettings = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY || 'http://localhost:8080/realms/your-realm', // e.g., Quarkus Keycloak realm URL
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID || 'your-client-id', // Client ID configured in Quarkus/Keycloak
  redirect_uri: import.meta.env.VITE_OIDC_REDIRECT_URI || window.location.origin + '/oidc-callback', // Callback URL registered with OIDC provider
  post_logout_redirect_uri: import.meta.env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI || window.location.origin + '/login',
  response_type: 'code', // or 'id_token token' or 'code id_token token' depending on provider
  scope: import.meta.env.VITE_OIDC_SCOPE || 'openid profile email', // Standard OIDC scopes
  userStore: new WebStorageStateStore({ store: window.localStorage }), // Persist OIDC state in localStorage
  automaticSilentRenew: true, // Enable automatic token renewal
  // silent_redirect_uri: window.location.origin + '/silent-renew.html', // Optional: For silent token renewal
  // loadUserInfo: true, // Optional: If user info endpoint is separate and needed
};

const userManager = new UserManager(oidcSettings);

// --- User Profile in SurrealDB ---
// This matches the 'user' table schema defined in surreal_schemas.surql
interface AppUser extends Record<string, any> {
  id: RecordId; // SurrealDB record ID, e.g., user:xxxx
  github_id: string;
  name: string;
  email?: string;
  created_at?: Date;
  updated_at?: Date;
  last_login_case_id?: string | null;
}

// --- Authentication Service Logic ---
const authService = {
  // JWT Authentication methods
  jwt: jwtAuth,

  // OIDC Authentication methods
  getUser: async (): Promise<OidcUser | null> => {
    return userManager.getUser();
  },

  loginRedirect: async (): Promise<void> => {
    await userManager.signinRedirect();
  },

  loginRedirectCallback: async (client: Surreal): Promise<OidcUser> => { // ADDED client parameter
    try {
      const oidcUser = await userManager.signinRedirectCallback();
      if (!oidcUser || oidcUser.expired) {
        throw new Error('OIDC login failed or user is expired.');
      }

      // OIDC user profile usually has 'sub' as unique ID, 'name', 'email' etc.
      // Adapt this mapping based on your GitHub OIDC provider's claims
      const githubId = oidcUser.profile.sub; // 'sub' is typically the unique subject identifier
      const name = oidcUser.profile.name || oidcUser.profile.preferred_username || 'Unknown User';
      const email = oidcUser.profile.email || '';

      if (!githubId) {
        throw new Error('GitHub ID (sub claim) not found in OIDC user profile.');
      }

      // Check if user exists in SurrealDB, otherwise create them
      let appUser: AppUser | null = null;
      // SurrealDB expects the Record ID without the angle brackets in the variable part.
      // So, user:⟨${githubId}⟩ becomes `user:${githubId}` when using template literals for ID.
      const recordId = new RecordId('user', githubId);

      const existingUsers: AppUser = await client.select<AppUser>(recordId); // MODIFIED db.select to client.select

      if (existingUsers) {
        // Update returns an array of the updated records.
        const updatedResult: AppUser = await client.update<AppUser, AppUser>(recordId, { // MODIFIED db.update to client.update
          id: recordId,
          github_id: githubId,
          name: name,
          email: email,
          updated_at: new Date(),
        });
        if (updatedResult.length > 0) {
          appUser = updatedResult[0];
        }
      } else {
        // Note: SurrealDB v1.x.x returns an array from create.
        const createdResult: AppUser = await client.create<AppUser>(recordId, { // MODIFIED db.create to client.create
          id: recordId,
          github_id: githubId,
          name: name,
          email: email,
          created_at: new Date(),
          updated_at: new Date(),
        });
        if (createdResult.length > 0) {
          appUser = createdResult[0];
        }
      }

      if (!appUser) {
        throw new Error('Failed to create or update user in SurrealDB.');
      }

      // Store appUser or relevant parts in AuthContext or return for AuthContext to handle
      // For now, we just return the OIDC user, AuthContext will handle appUser sync
      return oidcUser;

    } catch (error) {
      console.error('Error during OIDC login callback:', error);
      //userManager.removeUser(); // Clean up stale OIDC user data if login failed
      throw error; // Rethrow to be handled by the calling component/context
    }
  },

  logoutRedirect: async (): Promise<void> => {
    // const user = await userManager.getUser();
    // const idToken = user?.id_token;
    // await userManager.signoutRedirect({ id_token_hint: idToken });
    await userManager.signoutRedirect(); // Simpler version, relying on OIDC provider session
    await userManager.clearStaleState(); // Clear any stale state
  },

  // Optional: For handling silent renew callback if you set up silent_redirect_uri
  // signinSilentCallback: async (): Promise<OidcUser | undefined> => {
  //   return userManager.signinSilentCallback();
  // },
};

// --- Event Handlers (Optional but Recommended) ---
userManager.events.addUserLoaded((user) => {
  console.log('OIDC User loaded:', user);
  // Potentially update AuthContext state here or trigger a custom event
});

userManager.events.addUserUnloaded(() => {
  console.log('OIDC User unloaded (session ended)');
  // Potentially update AuthContext state here or trigger a custom event
});

userManager.events.addAccessTokenExpired(() => {
  console.log('OIDC Access token expired. Attempting silent renew...');
  userManager.signinSilent().catch(err => {
    console.error("Silent renew failed:", err);
    // May need to trigger a full redirect login if silent renew fails
    // authService.loginRedirect(); 
  });
});

userManager.events.addUserSignedOut(() => {
  console.log('OIDC User signed out');
  // Ensure local application state is cleaned up
});

export default authService;
export { userManager }; // Export userManager if direct access is needed elsewhere (e.g. for silent renew page)
