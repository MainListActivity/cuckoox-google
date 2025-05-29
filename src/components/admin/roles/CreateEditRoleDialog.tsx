import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Typography,
  Box,
  Grid,
  Stack,
  useTheme,
  Divider,
} from '@mui/material';

// 1. Define RoleData and MenuPermission types
export interface MenuPermission {
  id: string; // Corresponds to systemMenu.id
  name: string; // Corresponds to systemMenu.name, stored for convenience
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface RoleData {
  id?: string; // Present if editing
  name: string;
  description: string;
  permissions: MenuPermission[];
}

// Props for the Dialog component
interface CreateEditRoleDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (roleData: RoleData) => void;
  initialData?: RoleData | null;
}

// Mock system menu structure
// In a real app, this would likely come from a config or API
const systemMenus = [
  { id: 'menu_case_management', name: '案件管理', parentId: null },
  { id: 'menu_creditor_management', name: '债权人管理', parentId: null },
  { id: 'menu_claim_submission', name: '债权申报(债权人)', parentId: null },
  { id: 'menu_claim_review', name: '债权审核(管理人)', parentId: null },
  { id: 'menu_dashboard', name: '数据大屏', parentId: null },
  { id: 'menu_meetings', name: '在线会议', parentId: null },
  { id: 'menu_message_center', name: '消息中心', parentId: null },
  { id: 'menu_message_center_chat', name: '聊天功能', parentId: 'menu_message_center' }, // Example child
  { id: 'menu_message_center_settings', name: '消息设置', parentId: 'menu_message_center' }, // Example child
  { id: 'menu_admin_role_management', name: '身份管理(后台)', parentId: null },
  { id: 'menu_admin_status_management', name: '审核状态管理(后台)', parentId: null },
];

const CreateEditRoleDialog: React.FC<CreateEditRoleDialogProps> = ({
  open,
  onClose,
  onSave,
  initialData,
}) => {
  const theme = useTheme();
  const [roleName, setRoleName] = useState('');
  const [description, setDescription] = useState('');
  const [permissions, setPermissions] = useState<MenuPermission[]>([]);
  const [nameError, setNameError] = useState('');

  // Initialize permissions state based on systemMenus
  const initializePermissions = () => {
    return systemMenus.map(menu => ({
      id: menu.id,
      name: menu.name,
      canRead: false,
      canCreate: false,
      canUpdate: false,
      canDelete: false,
    }));
  };
  
  useEffect(() => {
    if (open) { // Reset form when dialog opens
      if (initialData) {
        setRoleName(initialData.name);
        setDescription(initialData.description);
        // Merge initialData.permissions with a full list from systemMenus
        // to ensure all system menus are represented and defaults are applied
        const initialPermsMap = new Map(initialData.permissions.map(p => [p.id, p]));
        setPermissions(systemMenus.map(menu => ({
          id: menu.id,
          name: menu.name,
          ...(initialPermsMap.get(menu.id) || { canRead: false, canCreate: false, canUpdate: false, canDelete: false })
        })));
      } else {
        setRoleName('');
        setDescription('');
        setPermissions(initializePermissions());
      }
      setNameError(''); // Clear previous errors
    }
  }, [open, initialData]);


  const handlePermissionChange = (menuId: string, permissionType: keyof Omit<MenuPermission, 'id' | 'name'>, checked: boolean) => {
    setPermissions(prevPermissions =>
      prevPermissions.map(perm =>
        perm.id === menuId ? { ...perm, [permissionType]: checked } : perm
      )
    );
  };

  // Convenience handler for the "master" read checkbox for a menu item
  const handleMenuAccessChange = (menuId: string, checked: boolean) => {
    setPermissions(prevPermissions =>
      prevPermissions.map(perm =>
        perm.id === menuId 
        ? { 
            ...perm, 
            canRead: checked, 
            // Optionally, cascade to other permissions or handle separately
            // For now, only 'canRead' is directly tied to this master checkbox
            // If 'checked' is false, we might want to disable/uncheck C/U/D,
            // but current logic allows them to be independent if canRead is re-enabled.
          } 
        : perm
      )
    );
  };


  const handleSave = () => {
    if (!roleName.trim()) {
      setNameError('角色名称不能为空');
      return;
    }
    setNameError('');

    const roleDataToSave: RoleData = {
      id: initialData?.id,
      name: roleName.trim(),
      description: description.trim(),
      permissions: permissions.filter(p => p.canRead || p.canCreate || p.canUpdate || p.canDelete), // Only save permissions that have at least one true value
    };
    onSave(roleDataToSave);
  };

  const isEditing = initialData != null;

  const renderMenuNode = (menu: typeof systemMenus[0], level: number = 0) => {
    const currentPermission = permissions.find(p => p.id === menu.id) || { 
        id: menu.id, name: menu.name, canRead: false, canCreate: false, canUpdate: false, canDelete: false 
    };

    return (
      <Box key={menu.id} sx={{ mb: 1.5, pl: level * 2.5 }}>
        <Grid container alignItems="center" spacing={1}>
          <Grid item xs={12} sm={4} md={3} sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={currentPermission.canRead}
                  onChange={(e) => handleMenuAccessChange(menu.id, e.target.checked)}
                  size="small"
                />
              }
              label={<Typography variant="body2" sx={{ fontWeight: 500, color: theme.palette.text.primary }}>{menu.name}</Typography>}
              sx={{minWidth: '150px'}}
            />
          </Grid>
          <Grid item xs={12} sm={8} md={9}>
            <FormGroup row sx={{ flexWrap: 'wrap' }}>
              <FormControlLabel
                control={<Checkbox size="small" checked={currentPermission.canRead} onChange={(e) => handlePermissionChange(menu.id, 'canRead', e.target.checked)} />}
                label={<Typography variant="caption">读取(R)</Typography>} sx={{mr:1}}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={currentPermission.canCreate} onChange={(e) => handlePermissionChange(menu.id, 'canCreate', e.target.checked)} />}
                label={<Typography variant="caption">创建(C)</Typography>} sx={{mr:1}}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={currentPermission.canUpdate} onChange={(e) => handlePermissionChange(menu.id, 'canUpdate', e.target.checked)} />}
                label={<Typography variant="caption">更新(U)</Typography>} sx={{mr:1}}
              />
              <FormControlLabel
                control={<Checkbox size="small" checked={currentPermission.canDelete} onChange={(e) => handlePermissionChange(menu.id, 'canDelete', e.target.checked)} />}
                label={<Typography variant="caption">删除(D)</Typography>}
              />
            </FormGroup>
          </Grid>
        </Grid>
        {/* Render children */}
        {systemMenus.filter(child => child.parentId === menu.id).map(childMenu => renderMenuNode(childMenu, level + 1))}
      </Box>
    );
  };


  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
        {isEditing ? '编辑角色' : '创建新角色'}
      </DialogTitle>
      <DialogContent sx={{ py: 2.5 }}>
        <Stack spacing={2.5}>
          <TextField
            autoFocus
            margin="dense"
            id="roleName"
            label="角色名称"
            type="text"
            fullWidth
            variant="outlined"
            value={roleName}
            onChange={(e) => {
              setRoleName(e.target.value);
              if (nameError && e.target.value.trim()) setNameError('');
            }}
            required
            error={!!nameError}
            helperText={nameError}
          />
          <TextField
            margin="dense"
            id="description"
            label="描述"
            type="text"
            fullWidth
            variant="outlined"
            multiline
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Divider sx={{my:1}}/>
          <Typography variant="h6" component="div" sx={{ fontWeight: 'medium', mt:1 }}>
            菜单权限
          </Typography>
          <Box sx={{ maxHeight: '300px', overflowY: 'auto', pr:1 /* For scrollbar */, mt:0.5 }}>
            {systemMenus.filter(menu => !menu.parentId).map(menu => renderMenuNode(menu, 0))}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ borderTop: `1px solid ${theme.palette.divider}`, px:3, py:2 }}>
        <Button onClick={onClose} variant="outlined" color="secondary">取消</Button>
        <Button onClick={handleSave} variant="contained" color="primary">保存</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateEditRoleDialog;
