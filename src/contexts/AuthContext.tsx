import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import authService from '../services/authService';
// import { db } from '../lib/surreal'; // REMOVED
import {useSurreal} from './SurrealProvider'; // ADDED
import { User as OidcUser } from 'oidc-client-ts';
import { RecordId } from 'surrealdb'; // Import for typing record IDs

// Matches AppUser in authService and user table in SurrealDB
interface AppUser {
  id: string; // SurrealDB record ID, e.g., user:xxxx
  github_id: string;
  name: string;
  email?: string;
  created_at?: string;
  updated_at?: string;
  last_login_case_id?: string | null; // Store as string "case:xxxx"
}

// Define Case and Role interfaces based on SurrealDB schema

// START NavItemType definition
export interface NavItemType {
  id: string; // Unique identifier for the menu item
  path: string;
  labelKey: string; // Key for i18n translation
  iconName: string; // String key to map to an MDI icon (e.g., 'mdiViewDashboard')
  requiredRoles?: string[]; // Optional: roles that can see this specific item (for client-side mock filtering)
  children?: NavItemType[]; // For future sub-menus
}
// END NavItemType definition

export interface Case {
  id: RecordId; // e.g., case:xxxx
  name: string;
  case_number?: string;
  // Add other case properties as needed
}

export interface Role {
  id: RecordId; // e.g., role:xxxx
  name: string;
  description?: string;
  // Add other role properties
}

// From user_case_role table, joining with case and role details
interface UserCaseRoleDetails {
  id: RecordId; // ID of the user_case_role record itself
  user_id: RecordId;
  case_details: Case; // Populated by SurrealDB FETCH
  role_details: Role;  // Populated by SurrealDB FETCH
}

interface AuthContextType {
  isLoggedIn: boolean;
  user: AppUser | null;
  oidcUser: OidcUser | null;
  setAuthState: (appUser: AppUser, oidcUserInstance?: OidcUser | null) => void; // MODIFIED
  logout: () => Promise<void>;
  isLoading: boolean; // For main auth state

  // Case and Role specific state and functions
  selectedCaseId: string | null; // Store as string (e.g. "case:xxxx")
  userCases: Case[];
  currentUserCaseRoles: Role[];
  isCaseLoading: boolean; // For loading cases and case-specific roles
  selectCase: (caseId: string) => Promise<void>;
  hasRole: (roleName: string) => boolean;
  refreshUserCasesAndRoles: () => Promise<void>; // Exposed function to manually refresh

  // Menu specific state and functions
  navMenuItems: NavItemType[] | null;
  isMenuLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {surreal:client,signout} = useSurreal(); // ADDED
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [user, setUser] = useState<AppUser | null>(null);
  const [oidcUser, setOidcUser] = useState<OidcUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(localStorage.getItem('cuckoox-selectedCaseId'));
  const [userCases, setUserCases] = useState<Case[]>([]);
  const [currentUserCaseRoles, setCurrentUserCaseRoles] = useState<Role[]>([]);
  const [isCaseLoading, setIsCaseLoading] = useState<boolean>(false);
  const [navMenuItems, setNavMenuItems] = useState<NavItemType[] | null>(null);
  const [isMenuLoading, setIsMenuLoading] = useState<boolean>(false);

  useEffect(() => {
    const checkCurrentUser = async () => {
      setIsLoading(true);
      try {
        const currentOidcUser = await authService.getUser();
        if (currentOidcUser && !currentOidcUser.expired) {
          const githubId = currentOidcUser.profile.sub;
          if (!githubId) {
            throw new Error("No github_id (sub) found in OIDC user profile during session check.");
          }
          const userRecordId = `user:${githubId}`;
          const result: AppUser[] = await client.select(userRecordId); // MODIFIED db.select to client.select

          if (result.length > 0) {
            const appUserFromDb = result[0];
            await initializeUserSession(appUserFromDb, currentOidcUser); // Modified
          } else {
            console.warn(`User ${githubId} found in OIDC but not in DB. Logging out.`);
            setUser(null);
            setOidcUser(null);
            setIsLoggedIn(false);
            localStorage.removeItem('cuckoox-isLoggedIn');
            localStorage.removeItem('cuckoox-user');
            localStorage.removeItem('cuckoox-selectedCaseId');
          }
        } else {
          const storedUser = localStorage.getItem('cuckoox-user');
          if(storedUser) {
            localStorage.removeItem('cuckoox-isLoggedIn');
            localStorage.removeItem('cuckoox-user');
            localStorage.removeItem('cuckoox-selectedCaseId');
          }
        }
      } catch (error) {
        console.error("Error checking current user session:", error);
        setIsLoggedIn(false);
        setUser(null);
        setOidcUser(null);
        localStorage.removeItem('cuckoox-user');
        localStorage.removeItem('cuckoox-isLoggedIn');
        localStorage.removeItem('cuckoox-selectedCaseId');
      } finally {
        setIsLoading(false);
      }
    };
    checkCurrentUser();
  }, []);

  const initializeUserSession = async (appUser: AppUser, oidcUserInstance?: OidcUser | null) => { // MODIFIED
    setUser(appUser);
    setOidcUser(oidcUserInstance || null); // MODIFIED to handle undefined
    setIsLoggedIn(true);
    localStorage.setItem('cuckoox-isLoggedIn', 'true');
    localStorage.setItem('cuckoox-user', JSON.stringify(appUser));
    await loadUserCasesAndRoles(appUser);
  };
  
  const setAuthState = (appUser: AppUser, oidcUserInstance?: OidcUser | null) => { // MODIFIED
    initializeUserSession(appUser, oidcUserInstance);
  };

  const loadUserCasesAndRoles = async (currentAppUser: AppUser | null) => {
    if (!currentAppUser || !currentAppUser.id) {
      setUserCases([]);
      setCurrentUserCaseRoles([]);
      setSelectedCaseId(null);
      localStorage.removeItem('cuckoox-selectedCaseId');
      setNavMenuItems([]); // Clear menu if no user
      return;
    }
    setIsCaseLoading(true);
    try {
      const query = `
        SELECT 
            id, 
            user_id, 
            case_id.* AS case_details, 
            role_id.* AS role_details 
        FROM user_case_role 
        WHERE user_id = $userId
        FETCH case_id, role_id;
      `;
      const results: UserCaseRoleDetails[][] = await client.query(query, { userId: currentAppUser.id }); // MODIFIED db.query to client.query
      
      const casesMap = new Map<string, Case>();
      let actualResults: UserCaseRoleDetails[] = [];

      if (results && results.length > 0 && Array.isArray(results[0])) {
         actualResults = results[0]; // Assuming the first element of the outer array is the array of records
         actualResults.forEach(ucr => {
            if (ucr.case_details && ucr.case_details.id) {
                 casesMap.set(ucr.case_details.id.toString(), ucr.case_details);
            }
         });
      }

      const fetchedCases = Array.from(casesMap.values());
      setUserCases(fetchedCases);

      const lastCaseId = currentAppUser.last_login_case_id;
      const previouslySelectedCaseId = localStorage.getItem('cuckoox-selectedCaseId');
      
      let caseToSelect: string | null = null;

      if (previouslySelectedCaseId && casesMap.has(previouslySelectedCaseId)) {
        caseToSelect = previouslySelectedCaseId;
      } else if (lastCaseId && casesMap.has(lastCaseId)) {
        caseToSelect = lastCaseId;
      } else if (fetchedCases.length === 1 && fetchedCases[0].id) {
        caseToSelect = fetchedCases[0].id.toString();
      }

      if (caseToSelect) {
        // Call selectCaseInternal - note: it's not async, so no await needed here
        selectCaseInternal(caseToSelect, actualResults);
      } else {
        setCurrentUserCaseRoles([]);
        setSelectedCaseId(null);
        localStorage.removeItem('cuckoox-selectedCaseId');
        setNavMenuItems([]); // Clear menu if no case is selected after loading
      }

    } catch (error) {
      console.error("Error loading user cases and roles:", error);
      setUserCases([]);
      setCurrentUserCaseRoles([]);
      setSelectedCaseId(null);
      localStorage.removeItem('cuckoox-selectedCaseId');
      setNavMenuItems([]); // Clear menu on error
    } finally {
      setIsCaseLoading(false);
    }
  };

  const fetchAndUpdateMenuPermissions = async (currentRoles: Role[]) => {
    if (!currentRoles || currentRoles.length === 0) {
      setNavMenuItems([]); // No roles, no menu items
      return;
    }
    setIsMenuLoading(true);
    console.log("Fetching menu permissions for roles:", currentRoles.map(r => r.name));

    // ** MOCK IMPLEMENTATION - Replace with actual API call later **
    const mockAllNavItems: NavItemType[] = [
      { id: 'dashboard', path: '/dashboard', labelKey: 'nav_dashboard', iconName: 'mdiViewDashboard', requiredRoles: ['case_manager', 'admin', 'creditor_representative'] },
      { id: 'cases', path: '/cases', labelKey: 'nav_case_management', iconName: 'mdiBriefcase', requiredRoles: ['case_manager', 'admin'] },
      { id: 'creditors', path: '/creditors', labelKey: 'nav_creditor_management', iconName: 'mdiAccountGroup', requiredRoles: ['case_manager', 'admin'] },
      { id: 'claims_list', path: '/claims', labelKey: 'nav_claim_management', iconName: 'mdiFileDocumentOutline', requiredRoles: ['case_manager', 'admin'] },
      { id: 'my_claims', path: '/my-claims', labelKey: 'nav_my_claims', iconName: 'mdiFileDocumentSearchOutline', requiredRoles: ['creditor_representative'] },
      { id: 'claims_submit', path: '/claims/submit', labelKey: 'nav_claim_submission', iconName: 'mdiFileUploadOutline', requiredRoles: ['creditor_representative'] },
      { id: 'claim_dashboard', path: '/claim-dashboard', labelKey: 'nav_claim_dashboard', iconName: 'mdiChartBar', requiredRoles: ['case_manager', 'admin'] },
      { id: 'online_meetings', path: '/online-meetings', labelKey: 'nav_online_meetings', iconName: 'mdiVideo', requiredRoles: ['case_manager', 'admin', 'creditor_representative'] },
      { id: 'messages', path: '/messages', labelKey: 'nav_message_center', iconName: 'mdiMessageTextOutline', requiredRoles: ['case_manager', 'admin', 'creditor_representative'] },
      { id: 'admin_home', path: '/admin', labelKey: 'nav_system_management', iconName: 'mdiCog', requiredRoles: ['admin'] },
    ];

    const userRoleNames = currentRoles.map(role => role.name);
    const filteredNavItems = mockAllNavItems.filter(item => {
      if (!item.requiredRoles || item.requiredRoles.length === 0) return true; // No specific roles required
      return item.requiredRoles.some(requiredRole => userRoleNames.includes(requiredRole));
    });
    // End of Mock Implementation
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    setNavMenuItems(filteredNavItems);
    setIsMenuLoading(false);
    console.log("Updated navMenuItems:", filteredNavItems);
  };
  
  // Internal helper to set roles based on a selected case ID and pre-fetched UserCaseRoleDetails
  const selectCaseInternal = (caseIdToSelect: string, allUserCaseRolesDetails: UserCaseRoleDetails[]) => {
    setSelectedCaseId(caseIdToSelect);
    localStorage.setItem('cuckoox-selectedCaseId', caseIdToSelect);

    const rolesForSelectedCase: Role[] = [];
    if (allUserCaseRolesDetails && Array.isArray(allUserCaseRolesDetails)) {
        allUserCaseRolesDetails.forEach(ucr => {
            if (ucr.case_details && ucr.case_details.id.toString() === caseIdToSelect && ucr.role_details) {
                rolesForSelectedCase.push(ucr.role_details);
            }
        });
    }
    setCurrentUserCaseRoles(rolesForSelectedCase);
    fetchAndUpdateMenuPermissions(rolesForSelectedCase); // Call menu update
  };

  const selectCase = async (caseIdToSelect: string) => {
    if (!user || !user.id) {
      console.error("User not available for selecting case.");
      setIsCaseLoading(false); // Ensure loading state is reset
      return;
    }
    setIsCaseLoading(true);
    try {
      // Fetch all user_case_role entries for the user to correctly populate roles for the selected case
      const query = `
        SELECT id, user_id, case_id.* AS case_details, role_id.* AS role_details 
        FROM user_case_role WHERE user_id = $userId FETCH case_id, role_id;`;
      const results: UserCaseRoleDetails[][] = await client.query(query, { userId: user.id }); // MODIFIED db.query to client.query

      let userCaseRolesDetails: UserCaseRoleDetails[] = [];
      if (results && results.length > 0 && Array.isArray(results[0])) {
        userCaseRolesDetails = results[0];
      }
      
      // Check if the caseIdToSelect is one of the user's cases
      const caseExistsForUser = userCases.some(c => c.id.toString() === caseIdToSelect);
      if (!caseExistsForUser && userCaseRolesDetails.some(ucrd => ucrd.case_details.id.toString() === caseIdToSelect)) {
          // This implies userCases might be stale if selectCase is called with a new valid case not yet in userCases
          // This could happen if roles/cases are modified externally and refreshUserCasesAndRoles wasn't called yet
          // For simplicity, we'll rely on userCases being up-to-date from loadUserCasesAndRoles or refreshUserCasesAndRoles
          // Or, ensure loadUserCasesAndRoles is called if caseIdToSelect is not in userCases
          console.warn("selectCase called with a caseId not in the current userCases list. Roles might be based on a fresh fetch.");
      }


      selectCaseInternal(caseIdToSelect, userCaseRolesDetails);

      await client.merge(user.id, { last_login_case_id: caseIdToSelect }); // MODIFIED db.merge to client.merge
      
      // Update user object in context with the new last_login_case_id
      setUser(prevUser => prevUser ? { ...prevUser, last_login_case_id: caseIdToSelect } : null);
      // Also update localStorage for the user object
      if (user) {
          const updatedUser = { ...user, last_login_case_id: caseIdToSelect };
          localStorage.setItem('cuckoox-user', JSON.stringify(updatedUser));
      }


    } catch (error) {
      console.error(`Error selecting case ${caseIdToSelect}:`, error);
    } finally {
      setIsCaseLoading(false);
    }
  };
  
  const refreshUserCasesAndRoles = async () => {
    if (user) {
      await loadUserCasesAndRoles(user);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    const isAdmin = user && user.github_id === '--admin--';

    try {
      if (isAdmin) {
        try {
          await signout(); // MODIFIED db.signout to client.signout
          console.log('Admin user signed out from SurrealDB.');
        } catch (e) {
          console.error('Error during SurrealDB signout:', e);
          // Continue with client-side logout even if server signout fails
        }
        // For admin, client-side cleanup is handled in finally block
      } else if (user) { // Regular OIDC user
        await authService.logoutRedirect(); // This will redirect
        // Post-redirect, OIDC library and app's initial load logic handle state.
        // The finally block here ensures immediate client state cleanup
        // in case the redirect is slow or has issues, or for non-redirect scenarios.
      } else {
        console.warn("Logout called without a user session.");
      }
    } catch (error) {
      // This catches errors primarily from authService.logoutRedirect() or db.signout()
      console.error("Error during logout process:", error);
    } finally {
      // Clear all client-side state for any logout type or if logout was called without user
      setUser(null);
      setOidcUser(null);
      setIsLoggedIn(false);
      setSelectedCaseId(null);
      setUserCases([]);
      setCurrentUserCaseRoles([]);
      setNavMenuItems([]); // Clear menu on logout
      localStorage.removeItem('cuckoox-isLoggedIn');
      localStorage.removeItem('cuckoox-user');
      localStorage.removeItem('cuckoox-selectedCaseId');
      // Any other app-specific cleanup related to user session can go here
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCaseId && currentUserCaseRoles && currentUserCaseRoles.length > 0) {
      fetchAndUpdateMenuPermissions(currentUserCaseRoles);
    } else if (!selectedCaseId) {
      setNavMenuItems([]); // Clear menu if no case is selected
    }
  }, [selectedCaseId, currentUserCaseRoles]); // Dependency: currentUserCaseRoles might need to be stringified or use its length if it's an array that changes reference. For simplicity, direct dependency is fine for now.

  const hasRole = (roleName: string): boolean => {
    if (roleName === 'admin') {
      return user ? user.github_id === '--admin--' : false;
    }
    // Existing logic for case-specific roles
    if (!selectedCaseId || currentUserCaseRoles.length === 0) {
      return false;
    }
    return currentUserCaseRoles.some(role => role.name === roleName);
  };

  return (
    <AuthContext.Provider value={{ 
      isLoggedIn, user, oidcUser, setAuthState, logout, isLoading,
      selectedCaseId, userCases, currentUserCaseRoles, isCaseLoading, selectCase, hasRole, refreshUserCasesAndRoles,
      navMenuItems, isMenuLoading // Expose new menu state
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};