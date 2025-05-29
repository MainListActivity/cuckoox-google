import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import authService from '../services/authService'; // For OIDC login
import { useSurrealClient } from '../contexts/SurrealProvider';
import { AppUser } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import GlobalLoader from '../components/GlobalLoader';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  SvgIcon,
} from '@mui/material';
import { mdiGithub } from '@mdi/js';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const client = useSurrealClient();
  const auth = useAuth(); // Store the full context
  const { isLoggedIn, isLoading: isAuthContextLoading, setAuthState, user } = auth; // Destructure user here
  const navigate = useNavigate();
  const location = useLocation();

  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [isProcessingAdminLogin, setIsProcessingAdminLogin] = useState<boolean>(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const isAdminLoginAttempt = searchParams.get('admin') === 'true';

  // Helper to check if current logged-in user is the special admin
  const userIsAdmin = () => {
    // Use the 'user' destructured from useAuth() context directly
    return user?.github_id === '--admin--';
  };

  useEffect(() => {
    if (!isAdminLoginAttempt && isLoggedIn && !isAuthContextLoading) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
    if (isAdminLoginAttempt && isLoggedIn && userIsAdmin() && !isAuthContextLoading) {
      navigate('/admin', { replace: true });
    }
  }, [isLoggedIn, isAuthContextLoading, navigate, location.state, isAdminLoginAttempt, userIsAdmin]); // Added userIsAdmin to dependencies

  const handleAdminFormLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsProcessingAdminLogin(true);
    setAdminLoginError(null);

    try {
      if (!adminUsername || !adminPassword) {
        throw new Error(t('error_admin_credentials_required', 'Username and password are required.'));
      }
      
      await client.signin({
        username: adminUsername,
        password: adminPassword,
      });

      console.log('Admin successfully signed into SurrealDB via form.');

      const adminAppUser: AppUser = {
        id: `user:admin_${adminUsername}`,
        github_id: '--admin--',
        name: t('administrator_name_generic', {username: adminUsername}),
        email: `admin-${adminUsername}@example.com`,
      };

      setAuthState(adminAppUser, null);
      navigate('/admin', { replace: true });

    } catch (error: any) {
      console.error("Admin form login failed:", error);
      setAdminLoginError(t('error_admin_login_failed', { message: error.message || t('error_invalid_credentials_or_server') }));
    } finally {
      setIsProcessingAdminLogin(false);
    }
  };

  const handleOidcLogin = async () => {
    setAdminLoginError(null);
    if (isProcessingAdminLogin) return;

    try {
      await authService.loginRedirect();
    } catch (error) {
      console.error("Error initiating OIDC login redirect:", error);
      setAdminLoginError(t('error_oidc_init_failed', 'OIDC login initiation failed. Please try again.'));
    }
  };

  if (isAuthContextLoading && !isProcessingAdminLogin) {
    return <GlobalLoader message={t('loading_session', 'Loading session...')} />;
  }
  
  if (isLoggedIn && !isAuthContextLoading && !isAdminLoginAttempt) {
     const from = location.state?.from?.pathname || '/dashboard';
     if(location.pathname !== from) {
        navigate(from, { replace: true });
     }
     return <GlobalLoader message={t('redirecting', 'Redirecting...')} />;
  }
   if (isLoggedIn && userIsAdmin() && isAdminLoginAttempt) {
    if(location.pathname !== '/admin') {
      navigate('/admin', {replace: true});
    }
     return <GlobalLoader message={t('redirecting_admin', 'Redirecting to admin dashboard...')} />;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: (theme) => theme.palette.mode === 'dark' ? theme.palette.background.default : theme.palette.grey[100],
        p: 2,
      }}
    >
      <Paper elevation={6} sx={{ p: { xs: 2, sm: 3, md: 4 }, width: '100%', maxWidth: 420, textAlign: 'center' }}>
        <Typography variant="h4" component="h1" color="primary" sx={{ mb: 3 }}>
          {t('login_page_title', 'CuckooX')}
        </Typography>

        {isAdminLoginAttempt && adminLoginError && (
          <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>{adminLoginError}</Alert>
        )}
        {!isAdminLoginAttempt && location.state?.error && (
            <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>{t(location.state.error as string, "An OIDC error occurred.")}</Alert>
        )}
         {!isAdminLoginAttempt && adminLoginError && (
            <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>{adminLoginError}</Alert>
        )}

        {isAdminLoginAttempt ? (
          <form onSubmit={handleAdminFormLogin}>
            <TextField
              id="adminUsername"
              label={t('admin_username_label', 'Username')}
              type="text"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              required
              fullWidth
              variant="outlined"
              margin="normal"
              placeholder={t('admin_username_placeholder', 'Enter admin username')}
            />
            <TextField
              id="adminPassword"
              label={t('admin_password_label', 'Password')}
              type="password"
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              required
              fullWidth
              variant="outlined"
              margin="normal"
              placeholder={t('admin_password_placeholder', 'Enter admin password')}
            />
            {isProcessingAdminLogin && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'text.secondary', my: 1 }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography variant="body2">{t('admin_login_attempt_loading', 'Attempting admin login...')}</Typography>
              </Box>
            )}
            <Button
              type="submit"
              disabled={isProcessingAdminLogin}
              fullWidth
              variant="contained"
              color="primary"
              size="large"
              sx={{ mt: 2, mb: 1 }}
              startIcon={isProcessingAdminLogin ? <CircularProgress size={20} color="inherit" /> : null}
            >
              {isProcessingAdminLogin ? t('admin_logging_in_button', 'Logging in...') : t('admin_login_button', 'Admin Login')}
            </Button>
            <Button component="button" type="button" onClick={() => navigate('/login')} variant="text" size="small" sx={{ mt: 1 }}>
              {t('back_to_oidc_login_link', 'Back to regular login')}
            </Button>
          </form>
        ) : (
          <>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {t('login_github_prompt', 'Sign in with your GitHub account to continue.')}
            </Typography>
            <Button
              onClick={handleOidcLogin}
              disabled={isAuthContextLoading}
              fullWidth
              variant="contained"
              color="primary" 
              size="large"
              startIcon={<SvgIcon><path d={mdiGithub} /></SvgIcon>}
            >
              {t('login_github_button', 'Sign in with GitHub')}
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              {t('login_github_redirect_info', 'You will be redirected to GitHub for authentication.')}
            </Typography>
            <Button component="button" type="button" onClick={() => navigate('/login?admin=true')} variant="text" size="small" sx={{ mt: 2 }}>
              {t('admin_login_link', 'Switch to Admin Login')}
            </Button>
          </>
        )}
      </Paper>
    </Box>
  );
};

export default LoginPage;