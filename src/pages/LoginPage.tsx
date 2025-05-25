import React, { useEffect } from 'react'; // Removed useState
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService'; // IMPORT

const LoginPage: React.FC = () => {
  // const { login } = useAuth(); // 'login' from AuthContext is no longer used for initiating OIDC flow
  const { isLoggedIn, isLoading } = useAuth(); // Use isLoading to prevent quick redirects before auth check
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get potential error message from navigation state (passed by OidcCallbackPage on failure)
  const errorMessage = location.state?.error as string | undefined;


  // Redirect if user is already logged in and auth is not loading
  // This prevents flashing the login page if a session is active
  useEffect(() => {
    if (isLoggedIn && !isLoading) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isLoggedIn, isLoading, navigate, location.state]);

  const handleLogin = async () => {
    // setError(''); // Clear previous errors if any
    try {
      await authService.loginRedirect();
      // The browser will be redirected to the OIDC provider.
      // No further action is needed here until the callback.
    } catch (error) {
      console.error("Error initiating login redirect:", error);
      // setError('Login initiation failed. Please try again.'); // Update UI with error
    }
  };

  // If auth state is still loading, show a loading message or minimal UI
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div>正在加载会话...</div>
      </div>
    );
  }

  // If already logged in (and not loading), this component should have redirected.
  // But as a fallback, or if redirect hasn't happened yet:
  if (isLoggedIn) {
     return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div>已登录，正在跳转...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-blue-600 mb-6">CuckooX</h1>
        <p className="text-gray-700 mb-8">
          请使用您的 GitHub 帐号登录以继续。
        </p>
        
        {errorMessage && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">
            {errorMessage}
          </div>
        )}

        <button
          onClick={handleLogin}
          className="w-full flex items-center justify-center py-3 px-6 border border-transparent rounded-md shadow-sm text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
        >
          {/* Optionally, add a GitHub icon here */}
          <svg className="w-6 h-6 mr-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.026 2.747-1.026.546 1.379.201 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.001 10.001 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
          </svg>
          使用 GitHub 登录
        </button>
        <p className="mt-6 text-xs text-gray-500">
          您将被重定向到 GitHub进行身份验证。
        </p>
      </div>
    </div>
  );
};

export default LoginPage;