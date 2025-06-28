import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Container,
  Link,
  useTheme,
  useMediaQuery,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { mdiEye, mdiEyeOff } from '@mdi/js';
import { SvgIcon } from '@mui/material';
import Logo from '../components/Logo';

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    confirmPassword: '',
    name: '',
    email: '',
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Unsplash image URL
  const unsplashImageUrl = `https://images.unsplash.com/photo-1557804506-669a67965ba0?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2074&q=80`;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsProcessing(true);
    setError(null);

    try {
      // 验证表单
      if (!formData.username || !formData.password || !formData.name) {
        throw new Error(t('error_required_fields', 'Please fill in all required fields.'));
      }

      if (formData.password !== formData.confirmPassword) {
        throw new Error(t('error_password_mismatch', 'Passwords do not match.'));
      }

      if (formData.password.length < 6) {
        throw new Error(t('error_password_too_short', 'Password must be at least 6 characters long.'));
      }

      // 调用注册API
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          name: formData.name,
          email: formData.email || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || t('error_registration_failed', 'Registration failed.'));
      }

      // 注册成功，跳转到登录页面
      navigate('/login?admin=true&registered=true');

    } catch (error: unknown) {
      console.error("Registration failed:", error);
      const errorMessage = error instanceof Error ? error.message : t('error_unknown');
      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

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
            alt="Register background"
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
              {t('join_cuckoox', 'Join CuckooX')}
            </Typography>
            <Typography variant="h6" sx={{ opacity: 0.9 }}>
              {t('register_hero_subtitle', 'Start managing your cases efficiently with our platform')}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Right side - Registration form */}
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
                {t('register_subtitle', 'Create your account')}
              </Typography>
            </Box>

            {/* Error Alert */}
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
            )}

            {/* Registration Form */}
            <form onSubmit={handleSubmit}>
              <TextField
                name="username"
                label={t('username_label', 'Username')}
                type="text"
                value={formData.username}
                onChange={handleInputChange}
                required
                fullWidth
                variant="outlined"
                margin="normal"
                placeholder={t('username_placeholder', 'Choose a username')}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />
              
              <TextField
                name="name"
                label={t('name_label', 'Full Name')}
                type="text"
                value={formData.name}
                onChange={handleInputChange}
                required
                fullWidth
                variant="outlined"
                margin="normal"
                placeholder={t('name_placeholder', 'Enter your full name')}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />

              <TextField
                name="email"
                label={t('email_label', 'Email')}
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                fullWidth
                variant="outlined"
                margin="normal"
                placeholder={t('email_placeholder', 'Enter your email (optional)')}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                  },
                }}
              />

              <TextField
                name="password"
                label={t('password_label', 'Password')}
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={handleInputChange}
                required
                fullWidth
                variant="outlined"
                margin="normal"
                placeholder={t('password_placeholder', 'Choose a strong password')}
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

              <TextField
                name="confirmPassword"
                label={t('confirm_password_label', 'Confirm Password')}
                type={showConfirmPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={handleInputChange}
                required
                fullWidth
                variant="outlined"
                margin="normal"
                placeholder={t('confirm_password_placeholder', 'Re-enter your password')}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        edge="end"
                        aria-label="toggle confirm password visibility"
                      >
                        <SvgIcon fontSize="small">
                          <path d={showConfirmPassword ? mdiEyeOff : mdiEye} />
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
                disabled={isProcessing}
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
                startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : null}
              >
                {isProcessing ? t('registering_button', 'Creating account...') : t('register_button', 'Create Account')}
              </Button>

              <Box sx={{ textAlign: 'center', mt: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {t('already_have_account', 'Already have an account?')}{' '}
                  <Link
                    component={RouterLink}
                    to="/login?admin=true"
                    sx={{
                      color: theme.palette.primary.main,
                      fontWeight: 500,
                      textDecoration: 'none',
                      '&:hover': {
                        textDecoration: 'underline',
                      },
                    }}
                  >
                    {t('login_link', 'Login')}
                  </Link>
                </Typography>
              </Box>
            </form>

            {/* Footer */}
            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                {t('register_footer_text', '© 2024 CuckooX. All rights reserved.')}
              </Typography>
            </Box>
          </Box>
        </Container>
      </Box>
    </Box>
  );
};

export default RegisterPage; 