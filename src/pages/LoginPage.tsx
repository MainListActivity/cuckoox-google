import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService'; // For OIDC login
// import { db } from '../lib/surreal'; // REMOVED
import { useSurrealClient } from '../contexts/SurrealProvider'; // ADDED
import { AppUser } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const client = useSurrealClient(); // ADDED
  const { isLoggedIn, isLoading: isAuthContextLoading, setAuthState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [isProcessingAdminLogin, setIsProcessingAdminLogin] = useState<boolean>(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const isAdminLoginAttempt = searchParams.get('admin') === 'true';

  useEffect(() => {
    // OIDC redirect logic: if logged in and not an admin attempt, redirect from login page
    if (!isAdminLoginAttempt && isLoggedIn && !isAuthContextLoading) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
    // If already logged in as admin and trying to access /login?admin=true, redirect to /admin
    if (isAdminLoginAttempt && isLoggedIn && userIsAdmin() && !isAuthContextLoading) {
      navigate('/admin', { replace: true });
    }

  }, [isLoggedIn, isAuthContextLoading, navigate, location.state, isAdminLoginAttempt]);

  // Helper to check if current logged-in user is the special admin
  const userIsAdmin = () => {
    const { user } = capturedAuthContext || useAuth(); // Access user from context
    return user?.github_id === '--admin--';
  };


  // REMOVED: useEffect for automatic admin login based on env vars

  const handleAdminFormLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsProcessingAdminLogin(true);
    setAdminLoginError(null);

    try {
      const adminNS = import.meta.env.VITE_SURREALDB_ADMIN_NS || import.meta.env.VITE_SURREALDB_NAMESPACE;
      const adminDB = import.meta.env.VITE_SURREALDB_ADMIN_DB || import.meta.env.VITE_SURREALDB_DATABASE;
      const adminSC = import.meta.env.VITE_SURREALDB_ADMIN_SC || 'account'; // Default scope 'account'

      if (!adminUsername || !adminPassword) {
        throw new Error(t('error_admin_credentials_required', 'Username and password are required.'));
      }
      
      await client.signin({ // MODIFIED db.signin to client.signin
        user: adminUsername,
        pass: adminPassword,
        NS: adminNS,
        DB: adminDB,
        SC: adminSC,
      });

      console.log('Admin successfully signed into SurrealDB via form.');

      const adminAppUser: AppUser = {
        id: `user:admin_${adminUsername}`, // Use entered username
        github_id: '--admin--',
        name: t('administrator_name_generic', {username: adminUsername}), // Use username in name
        email: `admin-${adminUsername}@example.com`, // Placeholder email
      };

      setAuthState(adminAppUser, null); // null for OidcUser
      navigate('/admin', { replace: true });

    } catch (error: any) {
      console.error("Admin form login failed:", error);
      setAdminLoginError(t('error_admin_login_failed', { message: error.message || t('error_invalid_credentials_or_server') }));
      // Do not navigate away, allow user to see the error and retry on the form
    } finally {
      setIsProcessingAdminLogin(false);
    }
  };

  const handleOidcLogin = async () => {
    setAdminLoginError(null); // Clear admin errors before OIDC attempt
    if (isProcessingAdminLogin) return; // Prevent OIDC login if admin login is processing

    try {
      await authService.loginRedirect();
    } catch (error) {
      console.error("Error initiating OIDC login redirect:", error);
      // Display error in a way that doesn't conflict with admin form errors if both are somehow visible
      setAdminLoginError(t('error_oidc_init_failed', 'OIDC login initiation failed. Please try again.'));
    }
  };

  // Overall page loading state (primarily for AuthContext initial load)
  if (isAuthContextLoading && !isProcessingAdminLogin) { // Show general loading unless admin login is active
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div>{t('loading_session', 'Loading session...')}</div>
      </div>
    );
  }
  
  // If already logged in (e.g. session restored) and not an admin attempt, this effect handles navigation.
  // If it IS an admin attempt and user is already admin, effect handles it.
  // This specific block handles cases where navigation from useEffect might not have run yet or for non-redirected already logged in state
  if (isLoggedIn && !isAuthContextLoading && !isAdminLoginAttempt) {
     const from = location.state?.from?.pathname || '/dashboard';
     if(location.pathname !== from) {
        navigate(from, { replace: true });
     }
     return (
       <div className="min-h-screen flex items-center justify-center bg-gray-100">
         <div>{t('redirecting', 'Redirecting...')}</div>
       </div>
     );
  }
   if (isLoggedIn && userIsAdmin() && isAdminLoginAttempt) {
    if(location.pathname !== '/admin') {
      navigate('/admin', {replace: true});
    }
     return (
       <div className="min-h-screen flex items-center justify-center bg-gray-100">
         <div>{t('redirecting_admin', 'Redirecting to admin dashboard...')}</div>
       </div>
     );
  }


  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-blue-600 mb-6">{t('login_page_title', 'CuckooX')}</h1>

        {/* Admin Login Error Display (only for admin attempts) */}
        {isAdminLoginAttempt && adminLoginError && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">
            {adminLoginError}
          </div>
        )}

        {/* OIDC Login Error Display (only for non-admin attempts, if error occurred) */}
        {!isAdminLoginAttempt && location.state?.error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">
             {t(location.state.error as string, "An OIDC error occurred.")}
            </div>
        )}
         {!isAdminLoginAttempt && adminLoginError && ( // For OIDC init errors
            <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">
             {adminLoginError}
            </div>
        )}


        {isAdminLoginAttempt ? (
          // Admin Login Form
          <form onSubmit={handleAdminFormLogin} className="space-y-6">
            <div>
              <label htmlFor="adminUsername" className="block text-sm font-medium text-gray-700 text-left">
                {t('admin_username_label', 'Username')}
              </label>
              <input
                id="adminUsername"
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder={t('admin_username_placeholder', 'Enter admin username')}
              />
            </div>
            <div>
              <label htmlFor="adminPassword" className="block text-sm font-medium text-gray-700 text-left">
                {t('admin_password_label', 'Password')}
              </label>
              <input
                id="adminPassword"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                placeholder={t('admin_password_placeholder', 'Enter admin password')}
              />
            </div>
            {isProcessingAdminLogin && (
                 <div className="text-sm text-gray-600">{t('admin_login_attempt_loading', 'Attempting admin login...')}</div>
            )}
            <button
              type="submit"
              disabled={isProcessingAdminLogin}
              className="w-full flex justify-center py-3 px-6 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-50"
            >
              {isProcessingAdminLogin ? t('admin_logging_in_button', 'Logging in...') : t('admin_login_button', 'Admin Login')}
            </button>
             <p className="mt-4 text-sm">
                <button 
                    type="button" 
                    onClick={() => navigate('/login')} 
                    className="font-medium text-blue-600 hover:text-blue-500"
                >
                    {t('back_to_oidc_login_link', 'Back to regular login')}
                </button>
            </p>
          </form>
        ) : (
          // OIDC Login Section
          <>
            <p className="text-gray-700 mb-8">
              {t('login_github_prompt', 'Sign in with your GitHub account to continue.')}
            </p>
            <button
              onClick={handleOidcLogin}
              disabled={isAuthContextLoading}
              className="w-full flex items-center justify-center py-3 px-6 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.026 2.747-1.026.546 1.379.201 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.001 10.001 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              {t('login_github_button', 'Sign in with GitHub')}
            </button>
            <p className="mt-6 text-xs text-gray-500">
              {t('login_github_redirect_info', 'You will be redirected to GitHub for authentication.')}
            </p>
             <p className="mt-8 text-sm">
                <button 
                    type="button" 
                    onClick={() => navigate('/login?admin=true')} 
                    className="font-medium text-green-600 hover:text-green-500"
                >
                    {t('admin_login_link', 'Switch to Admin Login')}
                </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginPage;