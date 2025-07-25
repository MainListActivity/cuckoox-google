import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth,AppUser } from '@/src/contexts/AuthContext';
import { useServiceWorkerComm } from '@/src/contexts/SurrealProvider';
// import authService from '@/src/services/authService'; // GitHub OIDC login - 暂时屏蔽
import authService from '@/src/services/authService';
import { RecordId } from 'surrealdb';
import { useTranslation } from 'react-i18next';
import GlobalLoader from '@/src/components/GlobalLoader';
import Turnstile from '@/src/components/Turnstile';
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
  useTheme,
  useMediaQuery,
  IconButton,
  InputAdornment,
  Dialog,
  DialogContent,
  DialogTitle,
  Autocomplete,
} from '@mui/material';
import { mdiEye, mdiEyeOff } from '@mdi/js';
import Logo from '../components/Logo';
import TenantHistoryManager, { TenantHistoryItem } from '@/src/utils/tenantHistory';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  // 移除直接使用SurrealProvider的认证方法
  const auth = useAuth(); // Store the full context
  const { isLoggedIn, isLoading: isAuthContextLoading, setAuthState, user } = auth; // Destructure user here
  const serviceWorkerComm = useServiceWorkerComm();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [tenantCode, setTenantCode] = useState<string>('');
  const [isProcessingAdminLogin, setIsProcessingAdminLogin] = useState<boolean>(false);
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [showTurnstile, setShowTurnstile] = useState<boolean>(false);
  const [justClearedAuth, setJustClearedAuth] = useState<boolean>(false);
  const [tenantHistory, setTenantHistory] = useState<TenantHistoryItem[]>([]);
  const [realAuthStatus, setRealAuthStatus] = useState<boolean | null>(null);

  const searchParams = new URLSearchParams(location.search);
  // 默认使用租户登录，除非明确指定root模式
  const isRootAdminMode = searchParams.get('root') === 'true';
  const isAdminLoginAttempt = !isRootAdminMode; // 默认为租户登录
  const justRegistered = searchParams.get('registered') === 'true';
  // 从URL获取租户代码
  const tenantFromUrl = searchParams.get('tenant') || '';

  // Unsplash image URL with random parameter for variety
  const unsplashImageUrl = `https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2074&q=80`;

  // Helper to check if current logged-in user is the special admin
  const userIsAdmin = useCallback(() => {
    // Use the 'user' destructured from useAuth() context directly
    return user?.github_id === '--admin--';
  }, [user]);

  // 从URL参数或历史记录填充租户代码
  useEffect(() => {
    if (!isRootAdminMode) {
      // 加载租户历史记录
      const history = TenantHistoryManager.getTenantHistory();
      setTenantHistory(history);
      
      if (tenantFromUrl) {
        setTenantCode(tenantFromUrl.toUpperCase());
      } else {
        // 使用最近使用的租户作为默认值
        const lastUsedTenant = TenantHistoryManager.getLastUsedTenant();
        if (lastUsedTenant) {
          setTenantCode(lastUsedTenant);
        }
      }
    }
  }, [tenantFromUrl, isRootAdminMode]);

  // 直接查询Service Worker的认证状态，确保获取最新的真实状态
  useEffect(() => {
    const checkRealAuthStatus = async () => {
      try {
        if (serviceWorkerComm) {
          const response = await serviceWorkerComm.sendMessage('get_connection_state', {});
          setRealAuthStatus(response?.isAuthenticated || false);
          console.log('LoginPage: Real auth status from Service Worker:', response?.isAuthenticated);
        }
      } catch (error) {
        console.error('LoginPage: Error checking real auth status:', error);
        setRealAuthStatus(false);
      }
    };

    checkRealAuthStatus();
    
    // 每隔500ms检查一次认证状态，确保及时捕获变化
    const interval = setInterval(checkRealAuthStatus, 500);
    
    return () => clearInterval(interval);
  }, [serviceWorkerComm]);

  // 监听认证状态变化，防止在清除状态过程中的错误重定向
  useEffect(() => {
    // 如果用户对象突然消失，可能是刚刚清除了认证状态
    if (!user && isLoggedIn) {
      setJustClearedAuth(true);
      // 500ms后重置标志，给状态更新足够时间
      const timer = setTimeout(() => {
        setJustClearedAuth(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [user, isLoggedIn]);

  useEffect(() => {
    // 添加短暂延迟，确保认证状态完全稳定后再重定向
    // 避免在状态清除过程中的不一致导致错误重定向
    const timer = setTimeout(() => {
      // 如果刚刚清除了认证状态，不进行重定向
      if (justClearedAuth) {
        console.log('LoginPage: Just cleared auth, skipping redirect');
        return;
      }
      
      // 检查Service Worker的真实认证状态，如果为false则不重定向
      if (realAuthStatus === false) {
        console.log('LoginPage: Service Worker reports not authenticated, skipping redirect');
        return;
      }
      
      // 只有在用户确实存在且认证状态正常时才进行重定向
      // 避免因为本地状态不同步导致的错误重定向
      // 额外检查用户对象是否有有效的ID，确保认证状态完全正常
      // 同时确保Service Worker也确认用户已认证
      if (!isAdminLoginAttempt && isLoggedIn && user && user.id && !isAuthContextLoading && realAuthStatus === true) {
        const from = location.state?.from?.pathname || '/dashboard';
        if (location.pathname !== from) {
          console.log('LoginPage: Redirecting authenticated user to:', from);
          navigate(from, { replace: true });
        }
      }
      if (isAdminLoginAttempt && isLoggedIn && user && user.id && userIsAdmin() && !isAuthContextLoading && realAuthStatus === true) {
        if (location.pathname !== '/admin') {
          console.log('LoginPage: Redirecting authenticated admin to /admin');
          navigate('/admin', { replace: true });
        }
      }
    }, 100); // 100ms 延迟，确保状态稳定

    return () => clearTimeout(timer);
  }, [isLoggedIn, user, isAuthContextLoading, navigate, location.state, location.pathname, isAdminLoginAttempt, userIsAdmin, justClearedAuth, realAuthStatus]); // Added userIsAdmin, justClearedAuth and realAuthStatus to dependencies

  const handleTurnstileSuccess = (token: string) => {
    console.log('Turnstile验证成功');
    setTurnstileError(null);
    // 验证成功后自动提交表单
    handleAdminLoginWithToken(token);
  };

  const handleTurnstileError = (error: string) => {
    console.error('Turnstile验证失败:', error);
    setTurnstileError(t('error_turnstile_failed', '人机验证失败，请重试'));
    setShowTurnstile(false);
    setIsProcessingAdminLogin(false);
  };

  const handleTurnstileExpire = () => {
    console.log('Turnstile token已过期');
    setTurnstileError(t('error_turnstile_expired', '验证已过期，请重新验证'));
    setShowTurnstile(false);
    setIsProcessingAdminLogin(false);
  };

  const handleAdminLoginWithToken = async (token: string) => {
    try {
      // 统一使用后端认证API获取JWT token
      let apiUrl: string;
      let requestBody: any;
      
      if (isRootAdminMode) {
        // Root管理员登录
        apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8082'}/api/root-admins/login`;
        requestBody = {
          username: adminUsername,
          password: adminPassword,
        };
      } else {
        // 租户管理员或普通用户登录
        apiUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:8082'}/auth/login`;
        requestBody = {
          username: adminUsername,
          password: adminPassword,
          tenant_code: tenantCode,
          turnstile_token: token,
        };
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || t('error_invalid_credentials_or_server'));
      }

      const data = await response.json();
      
      // 统一的登录处理逻辑，token存储完全委托给service worker
      if (isRootAdminMode) {
        // Root管理员登录成功
        console.log('Root admin successfully logged in.');
        
        // 对于rootAdmin，使用特殊的租户代码 'root'
        const rootTenantCode = 'root_system';
        
        // 使用返回的JWT token进行SurrealDB认证
        const jwtToken = data.access_token || data.token;
        if (!jwtToken) {
          throw new Error('No JWT token returned from root admin login');
        }
        
        // 直接通过Service Worker进行认证和token管理
        await authService.setTenantCode(rootTenantCode);
        await authService.setAuthTokens(jwtToken, data.refresh_token, data.expires_in);
        
        // 创建Root管理员用户对象
        const rootAdminUser: AppUser = {
          id: new RecordId('root_admin', data.admin?.username || adminUsername),
          github_id: `root_admin_${data.admin?.username || adminUsername}`,
          name: data.admin?.full_name || data.admin?.name || adminUsername,
          email: data.admin?.email || '',
        };

        setAuthState(rootAdminUser, null);
        navigate('/root-admin', { replace: true });
      } else {
        // 租户用户登录成功
        console.log('Tenant user successfully logged in.');
        
        // 设置租户代码并进行SurrealDB认证
        if (tenantCode) {
          // 登录成功后，将租户添加到历史记录
          TenantHistoryManager.addTenantToHistory(tenantCode);
          
          // 设置租户代码并直接通过Service Worker进行认证和token管理
          await authService.setTenantCode(tenantCode);
          await authService.setAuthTokens(data.access_token, data.refresh_token, data.expires_in);
        }

        // 创建用户对象
        const userAppUser: AppUser = {
          id: new RecordId('user', data.user.id.split(':')[1]), // 从 "user:xxx" 格式提取ID
          github_id: `local_${data.user.username}`,
          name: data.user.name,
          email: data.user.email,
        };

        setAuthState(userAppUser, null);
        
        // 根据用户角色决定跳转页面
        if (data.user.roles.includes('admin')) {
          navigate('/admin', { replace: true });
        } else {
          navigate('/dashboard', { replace: true });
        }
      }

    } catch (error: unknown) {
      console.error("Admin form login failed:", error);
      const errorMessage = error instanceof Error ? error.message : t('error_invalid_credentials_or_server');
      setAdminLoginError(t('error_admin_login_failed', { message: errorMessage }));
      // 重置状态
      setShowTurnstile(false);
    } finally {
      setIsProcessingAdminLogin(false);
    }
  };

  const handleAdminFormLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAdminLoginError(null);

    try {
      if (!adminUsername || !adminPassword) {
        throw new Error(t('error_admin_credentials_required', 'Username and password are required.'));
      }

      // 如果不是Root管理员模式，需要验证租户编码
      if (!isRootAdminMode && !tenantCode) {
        throw new Error(t('error_tenant_code_required', 'Tenant code is required.'));
      }

      // 显示 Turnstile 验证（Root管理员不需要）
      setIsProcessingAdminLogin(true);
      if (isRootAdminMode) {
        // Root管理员直接登录，不需要Turnstile验证
        await handleAdminLoginWithToken('');
      } else {
        setShowTurnstile(true);
      }
      
    } catch (error: unknown) {
      console.error("Admin form validation failed:", error);
      const errorMessage = error instanceof Error ? error.message : t('error_invalid_credentials_or_server');
      setAdminLoginError(errorMessage);
      setIsProcessingAdminLogin(false);
    }
  };

  // GitHub OIDC 登录功能已屏蔽
  // const handleOidcLogin = async () => {
  //   setAdminLoginError(null);
  //   if (isProcessingAdminLogin) return;
  //   try {
  //     await authService.loginRedirect();
  //   } catch (error) {
  //     console.error("Error initiating OIDC login redirect:", error);
  //     setAdminLoginError(t('error_oidc_init_failed', 'OIDC login initiation failed. Please try again.'));
  //   }
  // };

  if (isAuthContextLoading && !isProcessingAdminLogin) {
    return <GlobalLoader message={t('loading_session', 'Loading session...')} />;
  }

  if (isProcessingAdminLogin && !showTurnstile) {
    return <GlobalLoader message={t('admin_login_attempt_loading', 'Attempting admin login...')} />;
  }
  
  if (isLoggedIn && user && user.id && !isAuthContextLoading && !isAdminLoginAttempt && !justClearedAuth && realAuthStatus === true) {
     return <GlobalLoader message={t('redirecting', 'Redirecting...')} />;
  }
   if (isLoggedIn && user && user.id && userIsAdmin() && isAdminLoginAttempt && !isAuthContextLoading && !justClearedAuth && realAuthStatus === true) {
     return <GlobalLoader message={t('redirecting_admin', 'Redirecting to admin dashboard...')} />;
  }

  return (
    <>
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
                height: '100vh',
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
                  {isRootAdminMode
                    ? t('root_admin_login_subtitle', 'Root Administrator Login')
                    : isAdminLoginAttempt 
                      ? t('tenant_login_subtitle', 'Tenant Login')
                      : t('login_subtitle', 'Sign in to your account')
                  }
                </Typography>
              </Box>

              {/* Success/Error Alerts */}
              {justRegistered && (
                <Alert severity="success" sx={{ mb: 3 }}>
                  {t('registration_success', 'Registration successful! Please login with your credentials.')}
                </Alert>
              )}
              {isAdminLoginAttempt && adminLoginError && (
                <Alert severity="error" sx={{ mb: 3 }}>{adminLoginError}</Alert>
              )}
              {turnstileError && (
                <Alert severity="error" sx={{ mb: 3 }}>{turnstileError}</Alert>
              )}
              {!isAdminLoginAttempt && location.state?.error && (
                <Alert severity="error" sx={{ mb: 3 }}>{t(location.state.error as string, "An OIDC error occurred.")}</Alert>
              )}
              {!isAdminLoginAttempt && adminLoginError && (
                <Alert severity="error" sx={{ mb: 3 }}>{adminLoginError}</Alert>
              )}

              {/* Always show login form - either tenant or root admin */}
              {/* Tenant/Root Admin Login Form */}
                <form onSubmit={handleAdminFormLogin}>
                  {!isRootAdminMode && (
                    <Autocomplete
                      id="tenantCode"
                      options={tenantHistory}
                      getOptionLabel={(option) => typeof option === 'string' ? option : option.code}
                      value={tenantCode}
                      onChange={(_, newValue) => {
                        const code = typeof newValue === 'string' ? newValue : newValue?.code || '';
                        setTenantCode(code.toUpperCase());
                        // Clear error when user selects
                        if (adminLoginError) setAdminLoginError(null);
                      }}
                      inputValue={tenantCode}
                      onInputChange={(_, newInputValue) => {
                        setTenantCode(newInputValue.toUpperCase());
                        // Clear error when user starts typing
                        if (adminLoginError) setAdminLoginError(null);
                      }}
                      freeSolo
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={t('tenant_code_label', 'Tenant Code')}
                          required
                          fullWidth
                          variant="outlined"
                          margin="normal"
                          placeholder={t('tenant_code_placeholder', 'Enter tenant code')}
                          sx={{
                            '& .MuiOutlinedInput-root': {
                              borderRadius: 2,
                            },
                          }}
                        />
                      )}
                      renderOption={(props, option) => (
                        <Box
                          component="li"
                          {...props}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            py: 1,
                          }}
                        >
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {option.code}
                            </Typography>
                            {option.name && (
                              <Typography variant="caption" color="text.secondary">
                                {option.name}
                              </Typography>
                            )}
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(option.lastUsed).toLocaleDateString()}
                          </Typography>
                        </Box>
                      )}
                      sx={{
                        '& .MuiAutocomplete-inputRoot': {
                          borderRadius: 2,
                        },
                      }}
                    />
                  )}
                  <TextField
                    id="adminUsername"
                    label={t('admin_username_label', 'Username')}
                    type="text"
                    value={adminUsername}
                    onChange={(e) => {
                      setAdminUsername(e.target.value);
                      // Clear error when user starts typing
                      if (adminLoginError) setAdminLoginError(null);
                    }}
                    required
                    fullWidth
                    variant="outlined"
                    margin="normal"
                    placeholder={isRootAdminMode 
                      ? t('root_admin_username_placeholder', 'Enter root admin username')
                      : t('admin_username_placeholder', 'Enter username')
                    }
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
                    onChange={(e) => {
                      setAdminPassword(e.target.value);
                      // Clear error when user starts typing
                      if (adminLoginError) setAdminLoginError(null);
                    }}
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
                    {isProcessingAdminLogin ? t('verifying_button', 'Verifying...') : t('login_button', 'Login')}
                  </Button>

                  <Divider sx={{ my: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('or', 'OR')}
                    </Typography>
                  </Divider>

                  <Button 
                    component="button" 
                    type="button" 
                    onClick={() => navigate(isRootAdminMode ? '/login' : '/login?root=true')} 
                    variant="outlined" 
                    fullWidth
                    sx={{ 
                      borderRadius: 2,
                      textTransform: 'none',
                      py: 1,
                    }}
                  >
                    {isRootAdminMode 
                      ? t('back_to_tenant_login_link', 'Back to Tenant Login')
                      : t('switch_to_root_admin_link', 'Switch to Root Administrator')
                    }
                  </Button>

                  {/* 暂时屏蔽注册功能
                  <Box sx={{ textAlign: 'center', mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      {t('no_account_yet', "Don't have an account?")}{' '}
                      <Link
                        component="button"
                        type="button"
                        onClick={() => navigate('/register')}
                        variant="body2"
                        sx={{
                          color: theme.palette.primary.main,
                          fontWeight: 500,
                          textDecoration: 'none',
                          '&:hover': {
                            textDecoration: 'underline',
                          },
                        }}
                      >
                        {t('register_link', 'Register')}
                      </Link>
                    </Typography>
                  </Box>
                  */}
                </form>

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

      {/* Turnstile Dialog */}
      <Dialog
        open={showTurnstile}
        onClose={() => {
          setShowTurnstile(false);
          setIsProcessingAdminLogin(false);
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{t('human_verification', '人机验证')}</DialogTitle>
        <DialogContent>
          <Box sx={{ py: 2 }}>
            <Turnstile
              siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'} // 测试用的 site key
              onSuccess={handleTurnstileSuccess}
              onError={handleTurnstileError}
              onExpire={handleTurnstileExpire}
              theme={theme.palette.mode}
              size="normal"
              action="login"
              language="zh-CN"
            />
          </Box>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default LoginPage;
