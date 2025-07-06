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
import Logo from '@/src/components/Logo';
import { apiClient } from '@/src/utils/apiClient';

const RootAdminLoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if already authenticated
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      // Verify token is for root admin by checking if it contains root database
      // For now, just navigate to root admin dashboard
      navigate('/root-admin');
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await apiClient.rootAdminLogin({
        username,
        password,
      });

      // Store tokens
      if (response.access_token) {
        localStorage.setItem('access_token', response.access_token);
        
        if (response.refresh_token) {
          localStorage.setItem('refresh_token', response.refresh_token);
        }
        
        if (response.expires_in) {
          const expiresAt = Date.now() + (response.expires_in * 1000);
          localStorage.setItem('token_expires_at', expiresAt.toString());
        }

        // Navigate to root admin dashboard
        navigate('/root-admin');
      } else {
        setError('Login response missing access token');
      }
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