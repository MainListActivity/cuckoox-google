import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth,AppUser } from '@/src/contexts/AuthContext';
import authService from '@/src/services/authService'; // For OIDC login
import { useSurrealClient } from '@/src/contexts/SurrealProvider';
import { RecordId } from 'surrealdb';
import { useTranslation } from 'react-i18next';
import GlobalLoader from '@/src/components/GlobalLoader';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  SvgIcon,
  Container,
  Divider,
  Link,
  useTheme,
  useMediaQuery,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { mdiGithub, mdiEye, mdiEyeOff } from '@mdi/js';
import Logo from '../components/Logo';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const client = useSurrealClient();
  const auth = useAuth(); // Store the full context
  const { isLoggedIn, isLoading: isAuthContextLoading, setAuthState, user } = auth; // Destructure user here
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [isProcessingAdminLogin, setIsProcessingAdminLogin] = useState<boolean>(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);

  const searchParams = new URLSearchParams(location.search);
  const isAdminLoginAttempt = searchParams.get('admin') === 'true';

  // Unsplash image URL with random parameter for variety
  const unsplashImageUrl = `https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2074&q=80`;

  // Helper to check if current logged-in user is the special admin
  const userIsAdmin = useCallback(() => {
    // Use the 'user' destructured from useAuth() context directly
    return user?.github_id === '--admin--';
  }, [user]);

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
        id: new RecordId('user', `admin_${adminUsername}`), // Keep RecordId
        github_id: '--admin--',
        name: t('administrator_name_generic', {username: adminUsername})
      };

      setAuthState(adminAppUser, null);
      navigate('/admin', { replace: true });

    } catch (error: unknown) {
      console.error("Admin form login failed:", error);
      const errorMessage = error instanceof Error ? error.message : t('error_invalid_credentials_or_server');
      setAdminLoginError(t('error_admin_login_failed', { message: errorMessage }));
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

  if (isProcessingAdminLogin) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Typography>{t('admin_login_attempt_loading', 'Attempting admin login...')}</Typography>
    </Box>;
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
        minHeight: '100vh',
        backgroundColor: theme.palette.background.default,
      }}
    >
      {/* Left side - Image */}
      {!isMobile && (
        <Box
          sx={{
            flex: 1,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              zIndex: 1,
            },
          }}
        >
          <Box
            component="img"
            src={unsplashImageUrl}
            alt="Login background"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              bottom: 40,
              left: 40,
              right: 40,
              zIndex: 2,
              color: 'white',
            }}
          >
            <Typography variant="h3" sx={{ fontWeight: 700, mb: 2 }}>
              {t('welcome_to_cuckoox', 'Welcome to CuckooX')}
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9 }}>
              {t('login_hero_subtitle', 'Streamline your case management with our powerful platform')}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Right side - Login form */}
      <Box
        sx={{
          flex: { xs: 1, md: '0 0 480px' },
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          backgroundColor: theme.palette.background.paper,
          boxShadow: isMobile ? 'none' : '0 0 40px rgba(0,0,0,0.1)',
        }}
      >
        <Container maxWidth="sm">
          <Box sx={{ px: { xs: 2, sm: 4, md: 6 }, py: 4 }}>
            {/* Logo and Title */}
            <Box sx={{ mb: 4, textAlign: 'center' }}>
              <Logo size="large" variant="full" color="primary" />
              <Typography variant="body1" color="text.secondary">
                {isAdminLoginAttempt 
                  ? t('admin_login_subtitle', 'Administrator Access')
                  : t('login_subtitle', 'Sign in to your account')
                }
              </Typography>
            </Box>

            {/* Error Alerts */}
            {isAdminLoginAttempt && adminLoginError && (
              <Alert severity="error" sx={{ mb: 3 }}>{adminLoginError}</Alert>
            )}
            {!isAdminLoginAttempt && location.state?.error && (
              <Alert severity="error" sx={{ mb: 3 }}>{t(location.state.error as string, "An OIDC error occurred.")}</Alert>
            )}
            {!isAdminLoginAttempt && adminLoginError && (
              <Alert severity="error" sx={{ mb: 3 }}>{adminLoginError}</Alert>
            )}

            {isAdminLoginAttempt ? (
              /* Admin Login Form */
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
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />
                <TextField
                  id="adminPassword"
                  label={t('admin_password_label', 'Password')}
                  type={showPassword ? 'text' : 'password'}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  fullWidth
                  variant="outlined"
                  margin="normal"
                  placeholder={t('admin_password_placeholder', 'Enter admin password')}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                          aria-label="toggle password visibility"
                        >
                          <SvgIcon fontSize="small">
                            <path d={showPassword ? mdiEyeOff : mdiEye} />
                          </SvgIcon>
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 2,
                    },
                  }}
                />
                
                <Button
                  type="submit"
                  disabled={isProcessingAdminLogin}
                  fullWidth
                  variant="contained"
                  color="primary"
                  size="large"
                  sx={{ 
                    mt: 3, 
                    mb: 2,
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: '1rem',
                    fontWeight: 600,
                    boxShadow: theme.shadows[4],
                    '&:hover': {
                      boxShadow: theme.shadows[8],
                    },
                  }}
                  startIcon={isProcessingAdminLogin ? <CircularProgress size={20} color="inherit" /> : null}
                >
                  {isProcessingAdminLogin ? t('admin_logging_in_button', 'Logging in...') : t('admin_login_button', 'Admin Login')}
                </Button>

                <Divider sx={{ my: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('or', 'OR')}
                  </Typography>
                </Divider>

                <Button 
                  component="button" 
                  type="button" 
                  onClick={() => navigate('/login')} 
                  variant="outlined" 
                  fullWidth
                  sx={{ 
                    borderRadius: 2,
                    textTransform: 'none',
                    py: 1,
                  }}
                >
                  {t('back_to_oidc_login_link', 'Back to regular login')}
                </Button>
              </form>
            ) : (
              /* GitHub Login */
              <>
                <Button
                  onClick={handleOidcLogin}
                  disabled={isAuthContextLoading}
                  fullWidth
                  variant="contained"
                  size="large"
                  sx={{ 
                    py: 1.5,
                    borderRadius: 2,
                    textTransform: 'none',
                    fontSize: '1rem',
                    fontWeight: 600,
                    backgroundColor: '#24292e',
                    color: 'white',
                    boxShadow: theme.shadows[4],
                    '&:hover': {
                      backgroundColor: '#1a1e22',
                      boxShadow: theme.shadows[8],
                    },
                    '&:disabled': {
                      backgroundColor: '#586069',
                      color: '#959da5',
                    },
                  }}
                  startIcon={<SvgIcon><path d={mdiGithub} /></SvgIcon>}
                >
                  {t('login_github_button', 'Sign in with GitHub')}
                </Button>
                
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ mt: 2, mb: 3, textAlign: 'center' }}
                >
                  {t('login_github_redirect_info', 'You will be redirected to GitHub for authentication.')}
                </Typography>

                <Divider sx={{ my: 3 }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('or', 'OR')}
                  </Typography>
                </Divider>

                <Box sx={{ textAlign: 'center' }}>
                  <Link
                    component="button"
                    type="button"
                    onClick={() => navigate('/login?admin=true')}
                    variant="body2"
                    sx={{
                      textDecoration: 'none',
                      color: theme.palette.primary.main,
                      fontWeight: 500,
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    {t('admin_login_link', 'Switch to Admin Login')}
                  </Link>
                </Box>
              </>
            )}

            {/* Footer */}
            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                {t('login_footer_text', '© 2024 CuckooX. All rights reserved.')}
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default LoginPage;
