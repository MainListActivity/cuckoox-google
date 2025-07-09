import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Checkbox,
  FormGroup,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Security as SecurityIcon,
  Menu as MenuIcon,
  TouchApp as TouchAppIcon,
  People as PeopleIcon,
} from '@mui/icons-material';
import { useSurreal } from '@/src/contexts/SurrealProvider';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { RecordId } from 'surrealdb';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// 定义数据类型
interface MenuMetadata {
  id: string;
  menu_id: string;
  path: string;
  label_key: string;
  icon_name: string;
  parent_menu_id?: string;
  display_order: number;
  is_active: boolean;
}

interface OperationMetadata {
  id: string;
  operation_id: string;
  menu_id: string;
  operation_name: string;
  operation_type: string;
  description?: string;
  is_active: boolean;
}

interface Role {
  id: RecordId;
  name: string;
  description?: string;
}

interface RolePermission {
  role_id: RecordId;
  role_name: string;
  menu_permissions: string[];
  operation_permissions: string[];
}

const PermissionManagementPage: React.FC = () => {
  const { surreal: client } = useSurreal();
  const { showSuccess, showError } = useSnackbar();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);

  // 菜单权限相关状态
  const [menus, setMenus] = useState<MenuMetadata[]>([]);
  const [selectedMenu, setSelectedMenu] = useState<MenuMetadata | null>(null);
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);

  // 操作权限相关状态
  const [operations, setOperations] = useState<OperationMetadata[]>([]);
  const [selectedOperation, setSelectedOperation] = useState<OperationMetadata | null>(null);
  const [operationDialogOpen, setOperationDialogOpen] = useState(false);

  // 角色权限相关状态
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [selectedRolePermission, setSelectedRolePermission] = useState<RolePermission | null>(null);
  const [rolePermissionDialogOpen, setRolePermissionDialogOpen] = useState(false);

  // 加载角色列表
  const loadRoles = useCallback(async () => {
    try {
      const result = await client.query<Role[]>('SELECT * FROM role');
      if (result && result.length > 0) {
        // 角色数据现在直接用于查询，不需要存储在状态中
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      showError('加载角色列表失败');
    }
  }, [client, showError]);

  // 加载菜单元数据
  const loadMenus = useCallback(async () => {
    setLoading(true);
    try {
      const result = await client.query<MenuMetadata[]>('SELECT * FROM menu_metadata ORDER BY display_order');
      if (result && result.length > 0) {
        setMenus(result);
      }
    } catch (error) {
      console.error('Error loading menus:', error);
      showError('加载菜单数据失败');
    } finally {
      setLoading(false);
    }
  }, [client, showError]);

  // 加载操作元数据
  const loadOperations = useCallback(async () => {
    setLoading(true);
    try {
      const result = await client.query<OperationMetadata[]>('SELECT * FROM operation_metadata ORDER BY menu_id, operation_id');
      if (result && result.length > 0) {
        setOperations(result);
      }
    } catch (error) {
      console.error('Error loading operations:', error);
      showError('加载操作数据失败');
    } finally {
      setLoading(false);
    }
  }, [client, showError]);

  // 加载角色权限关系
  const loadRolePermissions = useCallback(async () => {
    setLoading(true);
    try {
      // 获取所有角色及其权限关系
      const result = await client.query<unknown[]>(`
        SELECT 
          id as role_id,
          name as role_name,
          ->can_access_menu->out.menu_id as menu_permissions,
          ->can_execute_operation->out.operation_id as operation_permissions
        FROM role
      `);
      
      if (result && result.length > 0) {
        const formattedRolePermissions = (result as unknown[]).map((item: unknown) => {
          const roleItem = item as {
            role_id: RecordId;
            role_name: string;
            menu_permissions?: string[];
            operation_permissions?: string[];
          };
          return {
            role_id: roleItem.role_id,
            role_name: roleItem.role_name,
            menu_permissions: roleItem.menu_permissions || [],
            operation_permissions: roleItem.operation_permissions || [],
          };
        });
        setRolePermissions(formattedRolePermissions);
      }
    } catch (error) {
      console.error('Error loading role permissions:', error);
      showError('加载角色权限失败');
    } finally {
      setLoading(false);
    }
  }, [client, showError]);

  useEffect(() => {
    loadRoles();
    if (tabValue === 0) loadMenus();
    else if (tabValue === 1) loadOperations();
    else if (tabValue === 2) loadRolePermissions();
  }, [tabValue, loadRoles, loadMenus, loadOperations, loadRolePermissions]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // 菜单权限管理
  const handleMenuEdit = (menu: MenuMetadata) => {
    setSelectedMenu(menu);
    setMenuDialogOpen(true);
  };

  const handleMenuSave = async (menu: MenuMetadata) => {
    try {
      if (selectedMenu) {
        // 更新
        await client.query(
          'UPDATE menu_metadata SET path = $path, label_key = $label_key, icon_name = $icon_name, display_order = $display_order, is_active = $is_active WHERE menu_id = $menu_id',
          {
            menu_id: menu.menu_id,
            path: menu.path,
            label_key: menu.label_key,
            icon_name: menu.icon_name,
            display_order: menu.display_order,
            is_active: menu.is_active,
          }
        );
        showSuccess('菜单更新成功');
      } else {
        // 创建
        await client.query(
          'INSERT INTO menu_metadata (menu_id, path, label_key, icon_name, display_order, is_active) VALUES ($menu_id, $path, $label_key, $icon_name, $display_order, $is_active)',
          {
            menu_id: menu.menu_id,
            path: menu.path,
            label_key: menu.label_key,
            icon_name: menu.icon_name,
            display_order: menu.display_order,
            is_active: menu.is_active,
          }
        );
        showSuccess('菜单创建成功');
      }
      setMenuDialogOpen(false);
      loadMenus();
    } catch (error) {
      console.error('Error saving menu:', error);
      showError('保存菜单失败');
    }
  };

  // 操作权限管理
  const handleOperationEdit = (operation: OperationMetadata) => {
    setSelectedOperation(operation);
    setOperationDialogOpen(true);
  };

  const handleOperationSave = async (operation: OperationMetadata) => {
    try {
      if (selectedOperation) {
        // 更新
        await client.query(
          'UPDATE operation_metadata SET menu_id = $menu_id, operation_name = $operation_name, operation_type = $operation_type, description = $description, is_active = $is_active WHERE operation_id = $operation_id',
          {
            operation_id: operation.operation_id,
            menu_id: operation.menu_id,
            operation_name: operation.operation_name,
            operation_type: operation.operation_type,
            description: operation.description,
            is_active: operation.is_active,
          }
        );
        showSuccess('操作更新成功');
      } else {
        // 创建
        await client.query(
          'INSERT INTO operation_metadata (operation_id, menu_id, operation_name, operation_type, description, is_active) VALUES ($operation_id, $menu_id, $operation_name, $operation_type, $description, $is_active)',
          {
            operation_id: operation.operation_id,
            menu_id: operation.menu_id,
            operation_name: operation.operation_name,
            operation_type: operation.operation_type,
            description: operation.description,
            is_active: operation.is_active,
          }
        );
        showSuccess('操作创建成功');
      }
      setOperationDialogOpen(false);
      loadOperations();
    } catch (error) {
      console.error('Error saving operation:', error);
      showError('保存操作失败');
    }
  };

  // 角色权限管理
  const handleRolePermissionEdit = (rolePermission: RolePermission) => {
    setSelectedRolePermission(rolePermission);
    setRolePermissionDialogOpen(true);
  };

  const handleRolePermissionSave = async (rolePermission: RolePermission) => {
    try {
      const roleId = rolePermission.role_id;
      
      // 删除现有的权限关系
      await client.query(
        'DELETE $role_id->can_access_menu',
        { role_id: roleId }
      );
      await client.query(
        'DELETE $role_id->can_execute_operation',
        { role_id: roleId }
      );

      // 添加新的菜单权限关系
      for (const menuId of rolePermission.menu_permissions) {
        const menuRecord = menus.find(m => m.menu_id === menuId);
        if (menuRecord) {
          await client.query(
            'RELATE $role_id->can_access_menu->$menu_record_id SET can_access = true, assigned_at = time::now()',
            { role_id: roleId, menu_record_id: menuRecord.id }
          );
        }
      }

      // 添加新的操作权限关系
      for (const operationId of rolePermission.operation_permissions) {
        const operationRecord = operations.find(o => o.operation_id === operationId);
        if (operationRecord) {
          await client.query(
            'RELATE $role_id->can_execute_operation->$operation_record_id SET can_execute = true, assigned_at = time::now()',
            { role_id: roleId, operation_record_id: operationRecord.id }
          );
        }
      }

      showSuccess('角色权限更新成功');
      setRolePermissionDialogOpen(false);
      loadRolePermissions();
    } catch (error) {
      console.error('Error saving role permission:', error);
      showError('保存角色权限失败');
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SecurityIcon />
        权限管理
      </Typography>

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="权限管理标签">
          <Tab icon={<MenuIcon />} label="菜单权限" />
          <Tab icon={<TouchAppIcon />} label="操作权限" />
          <Tab icon={<PeopleIcon />} label="角色权限" />
        </Tabs>
      </Paper>

      {/* 菜单权限管理 */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">菜单元数据管理</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedMenu(null);
              setMenuDialogOpen(true);
            }}
          >
            添加菜单
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>菜单ID</TableCell>
                  <TableCell>路径</TableCell>
                  <TableCell>标签键</TableCell>
                  <TableCell>图标</TableCell>
                  <TableCell>排序</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {menus.map((menu) => (
                  <TableRow key={menu.menu_id}>
                    <TableCell>{menu.menu_id}</TableCell>
                    <TableCell>{menu.path}</TableCell>
                    <TableCell>{menu.label_key}</TableCell>
                    <TableCell>{menu.icon_name}</TableCell>
                    <TableCell>{menu.display_order}</TableCell>
                    <TableCell>
                      <Chip
                        label={menu.is_active ? '启用' : '禁用'}
                        color={menu.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleMenuEdit(menu)}>
                        <EditIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* 操作权限管理 */}
      <TabPanel value={tabValue} index={1}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">操作元数据管理</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedOperation(null);
              setOperationDialogOpen(true);
            }}
          >
            添加操作
          </Button>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>操作ID</TableCell>
                  <TableCell>所属菜单</TableCell>
                  <TableCell>操作名称</TableCell>
                  <TableCell>操作类型</TableCell>
                  <TableCell>描述</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {operations.map((operation) => (
                  <TableRow key={operation.operation_id}>
                    <TableCell>{operation.operation_id}</TableCell>
                    <TableCell>{operation.menu_id}</TableCell>
                    <TableCell>{operation.operation_name}</TableCell>
                    <TableCell>
                      <Chip
                        label={operation.operation_type}
                        color={
                          operation.operation_type === 'create'
                            ? 'success'
                            : operation.operation_type === 'read'
                            ? 'info'
                            : operation.operation_type === 'update'
                            ? 'warning'
                            : operation.operation_type === 'delete'
                            ? 'error'
                            : 'default'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{operation.description || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={operation.is_active ? '启用' : '禁用'}
                        color={operation.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleOperationEdit(operation)}>
                        <EditIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* 角色权限管理 */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">角色权限管理</Typography>
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          管理角色对菜单和操作的访问权限。这些权限通过图关系存储在数据库中。
        </Alert>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>角色名称</TableCell>
                  <TableCell>菜单权限数量</TableCell>
                  <TableCell>操作权限数量</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rolePermissions.map((rolePermission) => (
                  <TableRow key={rolePermission.role_id.toString()}>
                    <TableCell>{rolePermission.role_name}</TableCell>
                    <TableCell>{rolePermission.menu_permissions.length}</TableCell>
                    <TableCell>{rolePermission.operation_permissions.length}</TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleRolePermissionEdit(rolePermission)}>
                        <EditIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </TabPanel>

      {/* 菜单编辑对话框 */}
      <Dialog open={menuDialogOpen} onClose={() => setMenuDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedMenu ? '编辑菜单' : '添加菜单'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="菜单ID"
              value={selectedMenu?.menu_id || ''}
              disabled={!!selectedMenu}
              onChange={(e) => setSelectedMenu({ ...selectedMenu!, menu_id: e.target.value })}
              fullWidth
            />
            <TextField
              label="路径"
              value={selectedMenu?.path || ''}
              onChange={(e) => setSelectedMenu({ ...selectedMenu!, path: e.target.value })}
              fullWidth
            />
            <TextField
              label="标签键"
              value={selectedMenu?.label_key || ''}
              onChange={(e) => setSelectedMenu({ ...selectedMenu!, label_key: e.target.value })}
              fullWidth
            />
            <TextField
              label="图标名称"
              value={selectedMenu?.icon_name || ''}
              onChange={(e) => setSelectedMenu({ ...selectedMenu!, icon_name: e.target.value })}
              fullWidth
            />
            <TextField
              label="排序"
              type="number"
              value={selectedMenu?.display_order || 0}
              onChange={(e) => setSelectedMenu({ ...selectedMenu!, display_order: parseInt(e.target.value) })}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={selectedMenu?.is_active ?? true}
                  onChange={(e) => setSelectedMenu({ ...selectedMenu!, is_active: e.target.checked })}
                />
              }
              label="启用"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMenuDialogOpen(false)}>取消</Button>
          <Button onClick={() => selectedMenu && handleMenuSave(selectedMenu)} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 操作编辑对话框 */}
      <Dialog open={operationDialogOpen} onClose={() => setOperationDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{selectedOperation ? '编辑操作' : '添加操作'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="操作ID"
              value={selectedOperation?.operation_id || ''}
              disabled={!!selectedOperation}
              onChange={(e) => setSelectedOperation({ ...selectedOperation!, operation_id: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>所属菜单</InputLabel>
              <Select
                value={selectedOperation?.menu_id || ''}
                onChange={(e) => setSelectedOperation({ ...selectedOperation!, menu_id: e.target.value })}
                label="所属菜单"
              >
                {menus.map((menu) => (
                  <MenuItem key={menu.menu_id} value={menu.menu_id}>
                    {menu.menu_id} - {menu.label_key}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="操作名称"
              value={selectedOperation?.operation_name || ''}
              onChange={(e) => setSelectedOperation({ ...selectedOperation!, operation_name: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>操作类型</InputLabel>
              <Select
                value={selectedOperation?.operation_type || ''}
                onChange={(e) => setSelectedOperation({ ...selectedOperation!, operation_type: e.target.value })}
                label="操作类型"
              >
                <MenuItem value="create">创建</MenuItem>
                <MenuItem value="read">读取</MenuItem>
                <MenuItem value="update">更新</MenuItem>
                <MenuItem value="delete">删除</MenuItem>
                <MenuItem value="custom">自定义</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="描述"
              value={selectedOperation?.description || ''}
              onChange={(e) => setSelectedOperation({ ...selectedOperation!, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={selectedOperation?.is_active ?? true}
                  onChange={(e) => setSelectedOperation({ ...selectedOperation!, is_active: e.target.checked })}
                />
              }
              label="启用"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOperationDialogOpen(false)}>取消</Button>
          <Button onClick={() => selectedOperation && handleOperationSave(selectedOperation)} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 角色权限编辑对话框 */}
      <Dialog open={rolePermissionDialogOpen} onClose={() => setRolePermissionDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>编辑角色权限 - {selectedRolePermission?.role_name}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={3}>
              <Grid size={6}>
                <Typography variant="h6" gutterBottom>
                  菜单权限
                </Typography>
                <FormGroup>
                  {menus.map((menu) => (
                    <FormControlLabel
                      key={menu.menu_id}
                      control={
                        <Checkbox
                          checked={selectedRolePermission?.menu_permissions.includes(menu.menu_id) || false}
                          onChange={(e) => {
                            if (!selectedRolePermission) return;
                            const newMenuPermissions = e.target.checked
                              ? [...selectedRolePermission.menu_permissions, menu.menu_id]
                              : selectedRolePermission.menu_permissions.filter(id => id !== menu.menu_id);
                            setSelectedRolePermission({
                              ...selectedRolePermission,
                              menu_permissions: newMenuPermissions
                            });
                          }}
                        />
                      }
                      label={`${menu.menu_id} - ${menu.label_key}`}
                    />
                  ))}
                </FormGroup>
              </Grid>
              <Grid size={6}>
                <Typography variant="h6" gutterBottom>
                  操作权限
                </Typography>
                <FormGroup>
                  {operations.map((operation) => (
                    <FormControlLabel
                      key={operation.operation_id}
                      control={
                        <Checkbox
                          checked={selectedRolePermission?.operation_permissions.includes(operation.operation_id) || false}
                          onChange={(e) => {
                            if (!selectedRolePermission) return;
                            const newOperationPermissions = e.target.checked
                              ? [...selectedRolePermission.operation_permissions, operation.operation_id]
                              : selectedRolePermission.operation_permissions.filter(id => id !== operation.operation_id);
                            setSelectedRolePermission({
                              ...selectedRolePermission,
                              operation_permissions: newOperationPermissions
                            });
                          }}
                        />
                      }
                      label={`${operation.operation_id} - ${operation.operation_name}`}
                    />
                  ))}
                </FormGroup>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRolePermissionDialogOpen(false)}>取消</Button>
          <Button 
            onClick={() => selectedRolePermission && handleRolePermissionSave(selectedRolePermission)} 
            variant="contained"
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PermissionManagementPage; 