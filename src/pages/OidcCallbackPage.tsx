import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import { useAuth } from '../contexts/AuthContext'; // We'll use this to set the user later

const OidcCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { login: contextLogin } = useAuth(); // Get the login function from AuthContext

  useEffect(() => {
    const processCallback = async () => {
      try {
        const oidcUser = await authService.loginRedirectCallback();
        // The authService.loginRedirectCallback now handles SurrealDB user creation/update.
        // Now, we need to update the AuthContext with the OIDC user and potentially app user details.
        // For now, the AuthContext's login function expects AppUser-like data.
        // We'll adapt this more in the AuthContext update step (Subtask 2.3).
        // Let's assume oidcUser has profile information.
        if (oidcUser && oidcUser.profile) {
            // The actual app user data (roles, etc.) will be fully synced in AuthContext
            // For now, signal login to AuthContext with basic OIDC profile info.
            // This will be refined in the next step when AuthContext is updated.
             contextLogin({ 
                id: oidcUser.profile.sub, // Use 'sub' as a temporary ID for context
                name: oidcUser.profile.name || oidcUser.profile.preferred_username || 'N/A',
                email: oidcUser.profile.email,
                role: 'user' // Default role, will be overridden by actual roles from DB in AuthContext
            });
            
            // Redirect to the intended page (stored by oidc-client-ts) or dashboard
            const returnUrl = oidcUser.state?.path || '/dashboard';
            navigate(returnUrl, { replace: true });
        } else {
            throw new Error("OIDC user profile not available after callback.");
        }
      } catch (error) {
        console.error('Error processing OIDC callback:', error);
        // Redirect to login page or an error page on failure
        navigate('/login', { replace: true, state: { error: '登录失败，请重试。' } });
      }
    };

    processCallback();
  }, [navigate, contextLogin]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div>正在加载用户会话...</div>
    </div>
  );
};

export default OidcCallbackPage;
