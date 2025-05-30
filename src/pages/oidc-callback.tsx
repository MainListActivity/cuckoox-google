import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '@/src/services/authService';
import { useAuth, AppUser } from '@/src/contexts/AuthContext'; // Import AppUser
import { useSurrealClient } from '@/src/contexts/SurrealProvider'; // ADDED
import { useTranslation } from 'react-i18next';
import GlobalLoader from '@/src/components/GlobalLoader'; // ADDED

const OidcCallbackPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setAuthState } = useAuth(); // Get setAuthState directly
  const client = useSurrealClient(); // ADDED

  useEffect(() => {
    const processCallback = async () => {
      try {
        const oidcUser = await authService.loginRedirectCallback(client); // MODIFIED: pass client
        
        if (oidcUser && oidcUser.profile) {
            // Construct AppUser from OIDC profile.
            // authService.loginRedirectCallback should have already created/updated the user in DB.
            // Here, we just prepare the AppUser object for AuthContext.
            // The record ID in SurrealDB is `user:${githubId}`
            const githubId = oidcUser.profile.sub;
            if (!githubId) {
                throw new Error('GitHub ID (sub) not found in OIDC user profile after callback.');
            }
            const appUserForContext: AppUser = {
                id: `user:${githubId}`, // This should match the ID used in SurrealDB
                github_id: githubId,
                name: oidcUser.profile.name || oidcUser.profile.preferred_username || 'Unknown User',
                email: oidcUser.profile.email,
                // last_login_case_id will be populated by AuthContext's loadUserCasesAndRoles
            };
            
            // Set the auth state in AuthContext
            setAuthState(appUserForContext, oidcUser);
            
            // Redirect to the intended page (stored by oidc-client-ts) or dashboard
            const returnUrl = oidcUser.state?.path || '/dashboard';
            navigate(returnUrl, { replace: true });
        } else {
            throw new Error("OIDC user or profile not available after callback.");
        }
      } catch (error) {
        console.error('Error processing OIDC callback:', error);
        navigate('/login', { replace: true, state: { error: t('error_login_failed', 'Login failed. Please try again.') } });
      }
    };

    processCallback();
  }, [navigate, setAuthState, client, t]); // Added client and t to dependency array

  return (
    <GlobalLoader message={t('oidc_callback_loading_session', 'Processing login...')} />
  );
};

export default OidcCallbackPage;
