import React, { useState, useEffect } from 'react';
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
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Security as SecurityIcon,
  Menu as MenuIcon,
  TouchApp as TouchAppIcon,
  Storage as StorageIcon,
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
      id={`permission-tabpanel-${index}`}
      aria-labelledby={`permission-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

// 定义数据类型
interface MenuMetadata {
  menu_id: string;
  path: string;
  label_key: string;
  icon_name: string;
  parent_menu_id?: string;
  display_order: number;
  is_active: boolean;
}

interface OperationMetadata {
  operation_id: string;
  menu_id: string;
  operation_name: string;
  operation_type: string;
  description?: string;
  is_active: boolean;
}

interface DataPermissionRule {
  id?: RecordId;
  rule_id: string;
  role_id: RecordId;
  table_name: string;
  crud_type: string;
  rule_expression: string;
  description?: string;
  priority: number;
  is_active: boolean;
}

interface Role {
  id: RecordId;
  name: string;
  description?: string;
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

  // 数据权限相关状态
  const [dataRules, setDataRules] = useState<DataPermissionRule[]>([]);
  const [selectedDataRule, setSelectedDataRule] = useState<DataPermissionRule | null>(null);
  const [dataRuleDialogOpen, setDataRuleDialogOpen] = useState(false);

  // 角色列表
  const [roles, setRoles] = useState<Role[]>([]);

  // 加载角色列表
  const loadRoles = async () => {
    try {
      const result = await client.query<Role[][]>('SELECT * FROM role');
      if (result && result[0]) {
        setRoles(result[0]);
      }
    } catch (error) {
      console.error('Error loading roles:', error);
      showError('加载角色列表失败');
    }
  };

  // 加载菜单元数据
  const loadMenus = async () => {
    setLoading(true);
    try {
      const result = await client.query<MenuMetadata[][]>('SELECT * FROM menu_metadata ORDER BY display_order');
      if (result && result[0]) {
        setMenus(result[0]);
      }
    } catch (error) {
      console.error('Error loading menus:', error);
      showError('加载菜单数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载操作元数据
  const loadOperations = async () => {
    setLoading(true);
    try {
      const result = await client.query<OperationMetadata[][]>('SELECT * FROM operation_metadata ORDER BY menu_id, operation_id');
      if (result && result[0]) {
        setOperations(result[0]);
      }
    } catch (error) {
      console.error('Error loading operations:', error);
      showError('加载操作数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 加载数据权限规则
  const loadDataRules = async () => {
    setLoading(true);
    try {
      const result = await client.query<DataPermissionRule[][]>('SELECT * FROM data_permission_rule ORDER BY role_id, table_name, crud_type');
      if (result && result[0]) {
        setDataRules(result[0]);
      }
    } catch (error) {
      console.error('Error loading data rules:', error);
      showError('加载数据权限规则失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoles();
    if (tabValue === 0) loadMenus();
    else if (tabValue === 1) loadOperations();
    else if (tabValue === 2) loadDataRules();
  }, [tabValue]);

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
          menu
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
          operation
        );
        showSuccess('操作更新成功');
      } else {
        // 创建
        await client.query(
          'INSERT INTO operation_metadata (operation_id, menu_id, operation_name, operation_type, description, is_active) VALUES ($operation_id, $menu_id, $operation_name, $operation_type, $description, $is_active)',
          operation
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

  // 数据权限管理
  const handleDataRuleEdit = (rule: DataPermissionRule) => {
    setSelectedDataRule(rule);
    setDataRuleDialogOpen(true);
  };

  const handleDataRuleSave = async (rule: DataPermissionRule) => {
    try {
      if (selectedDataRule?.id) {
        // 更新
        await client.query(
          'UPDATE data_permission_rule SET role_id = $role_id, table_name = $table_name, crud_type = $crud_type, rule_expression = $rule_expression, description = $description, priority = $priority, is_active = $is_active WHERE rule_id = $rule_id',
          rule
        );
        showSuccess('数据权限规则更新成功');
      } else {
        // 创建
        await client.query(
          'INSERT INTO data_permission_rule (rule_id, role_id, table_name, crud_type, rule_expression, description, priority, is_active) VALUES ($rule_id, $role_id, $table_name, $crud_type, $rule_expression, $description, $priority, $is_active)',
          rule
        );
        showSuccess('数据权限规则创建成功');
      }
      setDataRuleDialogOpen(false);
      loadDataRules();
    } catch (error) {
      console.error('Error saving data rule:', error);
      showError('保存数据权限规则失败');
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
          <Tab icon={<StorageIcon />} label="数据权限" />
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

      {/* 数据权限管理 */}
      <TabPanel value={tabValue} index={2}>
        <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">数据权限规则管理</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setSelectedDataRule(null);
              setDataRuleDialogOpen(true);
            }}
          >
            添加规则
          </Button>
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          数据权限规则用于控制角色对特定数据表的访问权限。规则表达式使用 SurrealDB 的查询语法。
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
                  <TableCell>规则ID</TableCell>
                  <TableCell>角色</TableCell>
                  <TableCell>数据表</TableCell>
                  <TableCell>操作类型</TableCell>
                  <TableCell>规则表达式</TableCell>
                  <TableCell>优先级</TableCell>
                  <TableCell>状态</TableCell>
                  <TableCell>操作</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {dataRules.map((rule) => (
                  <TableRow key={rule.rule_id}>
                    <TableCell>{rule.rule_id}</TableCell>
                    <TableCell>
                      {roles.find((r) => r.id.toString() === rule.role_id.toString())?.name || rule.role_id.toString()}
                    </TableCell>
                    <TableCell>{rule.table_name}</TableCell>
                    <TableCell>
                      <Chip
                        label={rule.crud_type}
                        color={
                          rule.crud_type === 'create'
                            ? 'success'
                            : rule.crud_type === 'read'
                            ? 'info'
                            : rule.crud_type === 'update'
                            ? 'warning'
                            : rule.crud_type === 'delete'
                            ? 'error'
                            : 'default'
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title={rule.rule_expression}>
                        <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {rule.rule_expression}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>{rule.priority}</TableCell>
                    <TableCell>
                      <Chip
                        label={rule.is_active ? '启用' : '禁用'}
                        color={rule.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" onClick={() => handleDataRuleEdit(rule)}>
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

      {/* 数据权限规则编辑对话框 */}
      <Dialog open={dataRuleDialogOpen} onClose={() => setDataRuleDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{selectedDataRule ? '编辑数据权限规则' : '添加数据权限规则'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            <TextField
              label="规则ID"
              value={selectedDataRule?.rule_id || ''}
              disabled={!!selectedDataRule?.id}
              onChange={(e) => setSelectedDataRule({ ...selectedDataRule!, rule_id: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>角色</InputLabel>
              <Select
                value={selectedDataRule?.role_id?.toString() || ''}
                onChange={(e) => {
                  const role = roles.find((r) => r.id.toString() === e.target.value);
                  if (role) {
                    setSelectedDataRule({ ...selectedDataRule!, role_id: role.id });
                  }
                }}
                label="角色"
              >
                {roles.map((role) => (
                  <MenuItem key={role.id.toString()} value={role.id.toString()}>
                    {role.name} - {role.description}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="数据表名称"
              value={selectedDataRule?.table_name || ''}
              onChange={(e) => setSelectedDataRule({ ...selectedDataRule!, table_name: e.target.value })}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>操作类型</InputLabel>
              <Select
                value={selectedDataRule?.crud_type || ''}
                onChange={(e) => setSelectedDataRule({ ...selectedDataRule!, crud_type: e.target.value })}
                label="操作类型"
              >
                <MenuItem value="create">创建</MenuItem>
                <MenuItem value="read">读取</MenuItem>
                <MenuItem value="update">更新</MenuItem>
                <MenuItem value="delete">删除</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="规则表达式"
              value={selectedDataRule?.rule_expression || ''}
              onChange={(e) => setSelectedDataRule({ ...selectedDataRule!, rule_expression: e.target.value })}
              fullWidth
              multiline
              rows={3}
              helperText="使用 SurrealDB 查询语法，例如: created_by = $auth.id"
            />
            <TextField
              label="描述"
              value={selectedDataRule?.description || ''}
              onChange={(e) => setSelectedDataRule({ ...selectedDataRule!, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label="优先级"
              type="number"
              value={selectedDataRule?.priority || 0}
              onChange={(e) => setSelectedDataRule({ ...selectedDataRule!, priority: parseInt(e.target.value) })}
              fullWidth
              helperText="数字越大优先级越高"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={selectedDataRule?.is_active ?? true}
                  onChange={(e) => setSelectedDataRule({ ...selectedDataRule!, is_active: e.target.checked })}
                />
              }
              label="启用"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDataRuleDialogOpen(false)}>取消</Button>
          <Button onClick={() => selectedDataRule && handleDataRuleSave(selectedDataRule)} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PermissionManagementPage; 