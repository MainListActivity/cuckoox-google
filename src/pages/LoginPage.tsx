import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService'; // For OIDC login
import { db } from '../lib/surreal'; // IMPORT DB
// AppUser might need to be imported from AuthContext if not already, or defined locally if structure varies
import { AppUser } from '../contexts/AuthContext'; // Assuming AppUser is exported or define structure here
import { useTranslation } from 'react-i18next'; // <-- IMPORT I18N

const LoginPage: React.FC = () => {
  const { t } = useTranslation(); // <-- INITIALIZE T
  const { isLoggedIn, isLoading: isAuthContextLoading, setAuthState } = useAuth(); // Get setAuthState
  const navigate = useNavigate();
  const location = useLocation();
  const [isProcessingAdminLogin, setIsProcessingAdminLogin] = useState<boolean>(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const isAdminLoginAttempt = searchParams.get('admin') === 'true';

  useEffect(() => {
    // OIDC redirect logic (unchanged by admin feature, but applies if not admin attempt)
    if (!isAdminLoginAttempt && isLoggedIn && !isAuthContextLoading) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isLoggedIn, isAuthContextLoading, navigate, location.state, isAdminLoginAttempt]);

  useEffect(() => {
    // Admin direct login attempt
    if (isAdminLoginAttempt && !isLoggedIn && !isProcessingAdminLogin) { // Added !isProcessingAdminLogin to avoid re-triggering
      const attemptDirectAdminLogin = async () => {
        setIsProcessingAdminLogin(true);
        setAdminLoginError(null);
        try {
          const adminUser = import.meta.env.VITE_SURREALDB_ADMIN_USER;
          const adminPass = import.meta.env.VITE_SURREALDB_ADMIN_PASS;
          // Use general NS/DB from surreal.ts if admin specific ones are not set
          const adminNS = import.meta.env.VITE_SURREALDB_ADMIN_NS || import.meta.env.VITE_SURREALDB_NAMESPACE;
          const adminDB = import.meta.env.VITE_SURREALDB_ADMIN_DB || import.meta.env.VITE_SURREALDB_DATABASE;
          const adminSC = import.meta.env.VITE_SURREALDB_ADMIN_SC || 'account'; // Default scope if not specified

          if (!adminUser || !adminPass) {
            throw new Error('Admin credentials not configured in environment variables.');
          }
          
          // Ensure db connection is established before signin
          // Note: connectSurrealDB itself handles reconnection logic and might throw if it fails.
          // If connectSurrealDB was already called in index.tsx, it might be connected.
          // However, signin might require its own fresh connection state or specific auth.
          // For simplicity here, we assume connectSurrealDB in index.tsx has run.
          // If admin login requires a *different* connection or auth scope *within the same db instance*,
          // db.signin is appropriate. If it's a completely separate DB/user for admin tasks,
          // a separate Surreal instance might be better, but that's a larger refactor.

          await db.signin({ 
            user: adminUser, 
            pass: adminPass, 
            NS: adminNS, 
            DB: adminDB,
            SC: adminSC 
          });
          
          console.log('Admin successfully signed into SurrealDB.');

          const adminAppUser: AppUser = {
            id: `user:admin_${adminUser}`, 
            github_id: '--admin--', 
            name: t('administrator_name', 'Administrator'), // Default to 'Administrator' if key missing
            email: import.meta.env.VITE_SURREALDB_ADMIN_EMAIL || 'admin@example.com',
            // last_login_case_id: null, // Admins might not have cases or select them differently
          };
          
          setAuthState(adminAppUser, null); // Pass null for OidcUser

          navigate('/admin', { replace: true });

        } catch (error: any) {
          console.error("Admin direct login failed:", error);
          setAdminLoginError(t('error_admin_login_failed', { message: error.message || t('check_credentials_and_connection') }));
          navigate('/login', { replace: true }); 
        } finally {
          setIsProcessingAdminLogin(false);
        }
      };
      attemptDirectAdminLogin();
    }
  }, [isAdminLoginAttempt, isLoggedIn, navigate, setAuthState, isProcessingAdminLogin]); // Added isProcessingAdminLogin


  const handleOidcLogin = async () => {
    setAdminLoginError(null); // Clear admin errors before OIDC attempt
    try {
      await authService.loginRedirect();
    } catch (error) {
      console.error("Error initiating OIDC login redirect:", error);
      setAdminLoginError(t('error_oidc_init_failed'));
    }
  };
  
  const pageIsLoading = isAuthContextLoading || isProcessingAdminLogin;

  if (pageIsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div>{isAdminLoginAttempt ? t('admin_login_attempt_loading', '正在尝试管理员登录...') : t('loading_session')}</div>
      </div>
    );
  }

  if (isLoggedIn && !isAuthContextLoading) { 
     const from = isAdminLoginAttempt ? '/admin' : (location.state?.from?.pathname || '/dashboard');
     // This navigation should ideally not happen if admin login was successful,
     // as the admin login effect already navigates.
     // This is more of a fallback or for OIDC restored sessions.
     if(location.pathname !== from) { // Avoid loop if already at destination
        navigate(from, { replace: true });
     }
     return (
       <div className="min-h-screen flex items-center justify-center bg-gray-100">
         <div>{t('redirecting')}</div>
       </div>
     );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-blue-600 mb-6">{t('login_page_title', 'CuckooX')}</h1>
        
        {(adminLoginError || location.state?.error) && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">
            {adminLoginError || (location.state?.error && t(location.state.error as string))}
          </div>
        )}

        {(!isAdminLoginAttempt || adminLoginError) && ( 
          <>
            <p className="text-gray-700 mb-8">
              {t('login_github_prompt')}
            </p>
            <button
              onClick={handleOidcLogin}
              className="w-full flex items-center justify-center py-3 px-6 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.026 2.747-1.026.546 1.379.201 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.001 10.001 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              {t('login_github_button')}
            </button>
            <p className="mt-6 text-xs text-gray-500">
              {t('login_github_redirect_info')}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;