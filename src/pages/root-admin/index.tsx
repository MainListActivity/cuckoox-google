import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Container,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Grid,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
} from '@mui/material';
import { mdiPlus, mdiDelete, mdiRefresh, mdiEye, mdiEyeOff } from '@mdi/js';
import { SvgIcon } from '@mui/material';
import { useAuth } from '@/src/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '@/src/components/Logo';
import { apiClient } from '@/src/utils/apiClient';

interface Tenant {
  tenant_code: string;
  tenant_name: string;
  database_name: string;
  admin_username: string;
  admin_password: string;
  status: 'active' | 'suspended' | 'deleted';
  created_at: string;
  updated_at: string;
}

interface RootAdmin {
  username: string;
  email: string;
  full_name: string;
  password: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const RootAdminPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  // 租户管理状态
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoadingTenants, setIsLoadingTenants] = useState(false);
  const [showCreateTenantDialog, setShowCreateTenantDialog] = useState(false);
  const [newTenantCode, setNewTenantCode] = useState('');
  const [newTenantName, setNewTenantName] = useState('');
  const [newTenantAdminUsername, setNewTenantAdminUsername] = useState('');
  const [createTenantError, setCreateTenantError] = useState<string | null>(null);

  // Root管理员管理状态
  const [rootAdmins, setRootAdmins] = useState<RootAdmin[]>([]);
  const [isLoadingRootAdmins, setIsLoadingRootAdmins] = useState(false);
  const [showCreateRootAdminDialog, setShowCreateRootAdminDialog] = useState(false);
  const [newRootAdminUsername, setNewRootAdminUsername] = useState('');
  const [newRootAdminEmail, setNewRootAdminEmail] = useState('');
  const [newRootAdminFullName, setNewRootAdminFullName] = useState('');
  const [createRootAdminError, setCreateRootAdminError] = useState<string | null>(null);

  // 密码显示状态
  const [visiblePasswords, setVisiblePasswords] = useState<{[key: string]: boolean}>({});

  // 验证租户编码格式
  const validateTenantCode = (code: string): string | null => {
    if (!code) {
      return t('tenant_code_required', 'Tenant code is required');
    }
    if (code.length < 4 || code.length > 20) {
      return t('tenant_code_length_error', 'Tenant code must be 4-20 characters long');
    }
    if (!/^[a-zA-Z0-9]+$/.test(code)) {
      return t('tenant_code_format_error', 'Tenant code must contain only letters and numbers');
    }
    return null;
  };

  // 检查用户权限
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      navigate('/root-admin/login');
      return;
    }
    // TODO: Add JWT token validation to ensure it's for root admin
  }, [navigate]);

  // 加载数据
  useEffect(() => {
    loadTenants();
    loadRootAdmins();
  }, []);

  const loadTenants = async () => {
    setIsLoadingTenants(true);
    try {
      const data = await apiClient.getTenants();
      setTenants(data);
    } catch (error) {
      console.error('Failed to load tenants:', error);
    } finally {
      setIsLoadingTenants(false);
    }
  };

  const loadRootAdmins = async () => {
    setIsLoadingRootAdmins(true);
    try {
      const data = await apiClient.getRootAdmins();
      setRootAdmins(data);
    } catch (error) {
      console.error('Failed to load root admins:', error);
    } finally {
      setIsLoadingRootAdmins(false);
    }
  };

  const handleCreateTenant = async () => {
    setCreateTenantError(null);
    
    // 验证租户编码
    const validationError = validateTenantCode(newTenantCode);
    if (validationError) {
      setCreateTenantError(validationError);
      return;
    }
    
    try {
      const newTenant = await apiClient.createTenant({
        tenant_code: newTenantCode,
        tenant_name: newTenantName,
        admin_username: newTenantAdminUsername,
      });
      
      setTenants([...tenants, newTenant]);
      setShowCreateTenantDialog(false);
      setNewTenantCode('');
      setNewTenantName('');
      setNewTenantAdminUsername('');
    } catch (error) {
      setCreateTenantError(error instanceof Error ? error.message : 'Failed to create tenant');
    }
  };

  const handleCreateRootAdmin = async () => {
    setCreateRootAdminError(null);
    
    try {
      const newRootAdmin = await apiClient.createRootAdmin({
        username: newRootAdminUsername,
        email: newRootAdminEmail,
        full_name: newRootAdminFullName,
      });
      
      setRootAdmins([...rootAdmins, newRootAdmin]);
      setShowCreateRootAdminDialog(false);
      setNewRootAdminUsername('');
      setNewRootAdminEmail('');
      setNewRootAdminFullName('');
    } catch (error) {
      setCreateRootAdminError(error instanceof Error ? error.message : 'Failed to create root admin');
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (!user) {
    return null;
  }

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Logo size="medium" variant="full" color="primary" />
          <Typography variant="h4" component="h1">
            {t('root_admin_dashboard', 'Root Administrator Dashboard')}
          </Typography>
        </Box>
        <Button
          variant="outlined"
          onClick={() => {
            // Clear authentication tokens
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            localStorage.removeItem('token_expires_at');
            navigate('/root-admin/login');
          }}
        >
          {t('logout', 'Logout')}
        </Button>
      </Box>

      {/* Welcome Card */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('welcome_root_admin', 'Welcome, Root Administrator')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('root_admin_description', 'Manage tenants and root administrators from this dashboard.')}
          </Typography>
        </CardContent>
      </Card>

      <Grid container spacing={4}>
        {/* 租户管理 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  {t('tenant_management', 'Tenant Management')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<SvgIcon><path d={mdiRefresh} /></SvgIcon>}
                    onClick={loadTenants}
                    disabled={isLoadingTenants}
                  >
                    {t('refresh', 'Refresh')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SvgIcon><path d={mdiPlus} /></SvgIcon>}
                    onClick={() => setShowCreateTenantDialog(true)}
                  >
                    {t('create_tenant', 'Create Tenant')}
                  </Button>
                </Box>
              </Box>

              {isLoadingTenants ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('tenant_code', 'Tenant Code')}</TableCell>
                        <TableCell>{t('tenant_name', 'Tenant Name')}</TableCell>
                        <TableCell>{t('admin_username', 'Admin Username')}</TableCell>
                        <TableCell>{t('admin_password', 'Admin Password')}</TableCell>
                        <TableCell>{t('status', 'Status')}</TableCell>
                        <TableCell>{t('created_at', 'Created')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {tenants.map((tenant) => (
                        <TableRow key={tenant.tenant_code}>
                          <TableCell>
                            <Typography variant="body2" fontFamily="monospace">
                              {tenant.tenant_code}
                            </Typography>
                          </TableCell>
                          <TableCell>{tenant.tenant_name}</TableCell>
                          <TableCell>{tenant.admin_username}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" fontFamily="monospace">
                                {visiblePasswords[tenant.tenant_code] ? tenant.admin_password : '********'}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => togglePasswordVisibility(tenant.tenant_code)}
                              >
                                <SvgIcon fontSize="small">
                                  <path d={visiblePasswords[tenant.tenant_code] ? mdiEyeOff : mdiEye} />
                                </SvgIcon>
                              </IconButton>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={tenant.status}
                              color={tenant.status === 'active' ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(tenant.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Root管理员管理 */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  {t('root_admin_management', 'Root Administrator Management')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    startIcon={<SvgIcon><path d={mdiRefresh} /></SvgIcon>}
                    onClick={loadRootAdmins}
                    disabled={isLoadingRootAdmins}
                  >
                    {t('refresh', 'Refresh')}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<SvgIcon><path d={mdiPlus} /></SvgIcon>}
                    onClick={() => setShowCreateRootAdminDialog(true)}
                  >
                    {t('create_root_admin', 'Create Root Admin')}
                  </Button>
                </Box>
              </Box>

              {isLoadingRootAdmins ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('username', 'Username')}</TableCell>
                        <TableCell>{t('full_name', 'Full Name')}</TableCell>
                        <TableCell>{t('email', 'Email')}</TableCell>
                        <TableCell>{t('password', 'Password')}</TableCell>
                        <TableCell>{t('status', 'Status')}</TableCell>
                        <TableCell>{t('created_at', 'Created')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rootAdmins.map((admin) => (
                        <TableRow key={admin.username}>
                          <TableCell>{admin.username}</TableCell>
                          <TableCell>{admin.full_name}</TableCell>
                          <TableCell>{admin.email}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" fontFamily="monospace">
                                {visiblePasswords[admin.username] ? admin.password : '********'}
                              </Typography>
                              <IconButton
                                size="small"
                                onClick={() => togglePasswordVisibility(admin.username)}
                              >
                                <SvgIcon fontSize="small">
                                  <path d={visiblePasswords[admin.username] ? mdiEyeOff : mdiEye} />
                                </SvgIcon>
                              </IconButton>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={admin.is_active ? 'Active' : 'Inactive'}
                              color={admin.is_active ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(admin.created_at).toLocaleDateString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 创建租户对话框 */}
      <Dialog
        open={showCreateTenantDialog}
        onClose={() => {
          setShowCreateTenantDialog(false);
          setNewTenantCode('');
          setNewTenantName('');
          setNewTenantAdminUsername('');
          setCreateTenantError(null);
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('create_new_tenant', 'Create New Tenant')}</DialogTitle>
        <DialogContent>
          {createTenantError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {createTenantError}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label={t('tenant_code', 'Tenant Code')}
            placeholder={t('tenant_code_placeholder', 'e.g., ACME or TEST123 (4-20 characters, letters and numbers only)')}
            fullWidth
            variant="outlined"
            value={newTenantCode}
            onChange={(e) => setNewTenantCode(e.target.value.toUpperCase())}
            helperText={t('tenant_code_help', 'Unique identifier for the tenant (4-20 characters, letters and numbers only, will be converted to uppercase)')}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label={t('tenant_name', 'Tenant Name')}
            fullWidth
            variant="outlined"
            value={newTenantName}
            onChange={(e) => setNewTenantName(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label={t('admin_username', 'Admin Username')}
            fullWidth
            variant="outlined"
            value={newTenantAdminUsername}
            onChange={(e) => setNewTenantAdminUsername(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setShowCreateTenantDialog(false);
            setNewTenantCode('');
            setNewTenantName('');
            setNewTenantAdminUsername('');
            setCreateTenantError(null);
          }}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleCreateTenant}
            variant="contained"
            disabled={!newTenantCode || !newTenantName || !newTenantAdminUsername}
          >
            {t('create', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* 创建Root管理员对话框 */}
      <Dialog
        open={showCreateRootAdminDialog}
        onClose={() => setShowCreateRootAdminDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{t('create_new_root_admin', 'Create New Root Administrator')}</DialogTitle>
        <DialogContent>
          {createRootAdminError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {createRootAdminError}
            </Alert>
          )}
          <TextField
            autoFocus
            margin="dense"
            label={t('username', 'Username')}
            fullWidth
            variant="outlined"
            value={newRootAdminUsername}
            onChange={(e) => setNewRootAdminUsername(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label={t('email', 'Email')}
            type="email"
            fullWidth
            variant="outlined"
            value={newRootAdminEmail}
            onChange={(e) => setNewRootAdminEmail(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label={t('full_name', 'Full Name')}
            fullWidth
            variant="outlined"
            value={newRootAdminFullName}
            onChange={(e) => setNewRootAdminFullName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateRootAdminDialog(false)}>
            {t('cancel', 'Cancel')}
          </Button>
          <Button
            onClick={handleCreateRootAdmin}
            variant="contained"
            disabled={!newRootAdminUsername || !newRootAdminEmail || !newRootAdminFullName}
          >
            {t('create', 'Create')}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default RootAdminPage;