import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/src/contexts/AuthContext';
import Logo from '@/src/components/Logo';
import authService from '@/src/services/authService';

const RootAdminLoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isLoggedIn, user } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already authenticated as root admin
  useEffect(() => {
    if (isLoggedIn && user?.github_id?.startsWith('root_admin_')) {
      navigate('/root-admin');
    }
  }, [isLoggedIn, user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // Use authService for root admin login
      const response = await authService.loginRootAdminWithJWT({
        username,
        password,
      });

      // AuthService handles token management via Service Worker
      console.log('Root admin login successful:', response);
      
      // Navigate to root admin dashboard
      navigate('/root-admin');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 8 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Logo and Title */}
        <Box sx={{ mb: 4, textAlign: 'center' }}>
          <Logo size="large" variant="full" color="primary" />
          <Typography variant="h4" component="h1" sx={{ mt: 2, mb: 1 }}>
            {t('root_admin_login', 'Root Administrator Login')}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {t('root_admin_login_description', 'Sign in to access the root administration dashboard')}
          </Typography>
        </Box>

        {/* Login Form */}
        <Card sx={{ width: '100%', maxWidth: 400 }}>
          <CardContent sx={{ p: 4 }}>
            <form onSubmit={handleLogin}>
              {error && (
                <Alert severity="error" sx={{ mb: 3 }}>
                  {error}
                </Alert>
              )}
              
              <TextField
                fullWidth
                label={t('username', 'Username')}
                variant="outlined"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                disabled={isLoading}
                sx={{ mb: 3 }}
              />
              
              <TextField
                fullWidth
                label={t('password', 'Password')}
                type="password"
                variant="outlined"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                sx={{ mb: 4 }}
              />
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading || !username || !password}
                sx={{ mb: 2 }}
              >
                {isLoading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  t('login', 'Login')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Back to Regular Login */}
        <Box sx={{ mt: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('not_root_admin', 'Not a root administrator?')}
          </Typography>
          <Button
            variant="text"
            onClick={() => navigate('/login')}
            disabled={isLoading}
          >
            {t('back_to_regular_login', 'Back to Regular Login')}
          </Button>
        </Box>
      </Box>
    </Container>
  );
};

export default RootAdminLoginPage;