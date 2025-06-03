import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  useTheme,
  useMediaQuery,
  Container,
} from '@mui/material';
import { GitHub, AdminPanelSettings } from '@mui/icons-material';
import { useNavigate, useSearchParams } from 'react-router-dom';

export const Login: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  
  const isAdminMode = searchParams.get('admin') === 'true';
  const caseId = searchParams.get('case');
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // 如果URL中有案件ID，存储到localStorage供后续使用
    if (caseId) {
      localStorage.setItem('pendingCaseId', caseId);
    }
  }, [caseId]);

  const handleGitHubLogin = () => {
    setLoading(true);
    // TODO: 实现GitHub OIDC登录
    // 这里应该重定向到后端的OIDC认证端点
    window.location.href = `/api/auth/github?case=${caseId || ''}`;
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // TODO: 实现SurrealDB直接登录
      navigate('/cases');
        localStorage.setItem('token', "data.token");
        localStorage.setItem('userRole', 'admin');
      // 这里应该调用后端API进行认证
      // const response = await fetch('/api/auth/admin', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ username, password }),
      // });

      // if (response.ok) {
      //   const data = await response.json();
      //   localStorage.setItem('token', data.token);
      //   localStorage.setItem('userRole', 'admin');
      //   navigate('/cases');
      // } else {
      //   setError('用户名或密码错误');
      // }
    } catch (err) {
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.palette.background.default,
        backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
      }}
    >
      <Container maxWidth="sm">
        <Card
          sx={{
            boxShadow: theme.shadows[20],
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Box
            sx={{
              backgroundColor: theme.palette.primary.main,
              color: 'white',
              py: 3,
              px: 4,
              textAlign: 'center',
            }}
          >
            <Typography variant="h4" component="h1" gutterBottom>
              破产案件管理系统
            </Typography>
            <Typography variant="subtitle1">
              {isAdminMode ? '管理员登录' : '用户登录'}
            </Typography>
          </Box>
          
          <CardContent sx={{ p: 4 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            {!isAdminMode ? (
              <>
                <Typography variant="body1" color="text.secondary" align="center" sx={{ mb: 3 }}>
                  请使用您的GitHub账号登录系统
                </Typography>
                
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<GitHub />}
                  onClick={handleGitHubLogin}
                  disabled={loading}
                  sx={{
                    py: 1.5,
                    backgroundColor: '#24292e',
                    '&:hover': {
                      backgroundColor: '#1a1e22',
                    },
                  }}
                >
                  {loading ? <CircularProgress size={24} /> : '使用 GitHub 登录'}
                </Button>

                <Divider sx={{ my: 3 }}>或</Divider>

                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<AdminPanelSettings />}
                  onClick={() => navigate('/signin?admin=true')}
                  sx={{ py: 1 }}
                >
                  管理员登录
                </Button>
              </>
            ) : (
              <form onSubmit={handleAdminLogin}>
                <TextField
                  fullWidth
                  label="用户名"
                  variant="outlined"
                  margin="normal"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  required
                  autoFocus
                />
                
                <TextField
                  fullWidth
                  label="密码"
                  type="password"
                  variant="outlined"
                  margin="normal"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                
                <Button
                  fullWidth
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading || !username || !password}
                  sx={{ mt: 3, py: 1.5 }}
                >
                  {loading ? <CircularProgress size={24} /> : '登录'}
                </Button>

                <Button
                  fullWidth
                  variant="text"
                  onClick={() => navigate('/signin')}
                  sx={{ mt: 2 }}
                >
                  返回用户登录
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
        
        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ mt: 3 }}
        >
          © 2024 破产案件管理系统. All rights reserved.
        </Typography>
      </Container>
    </Box>
  );
};
