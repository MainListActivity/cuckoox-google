import React, { useState, useCallback, Fragment } from 'react';
import {
  Box,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Toolbar,
  Tooltip,
  useTheme,
  Collapse,
  Stack,
  Chip,
  Autocomplete,
  TextField,
  Checkbox,
  alpha as muiAlpha, // Import alpha
} from '@mui/material';
// import AddIcon from '@mui/icons-material/Add'; // Not used directly
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

// Import Dialog and its types
import CreateEditRoleDialog, { RoleData, MenuPermission } from '../../components/admin/roles/CreateEditRoleDialog';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog'; // Import ConfirmDeleteDialog

// Mock User Data
interface SystemUser {
  id: string;
  name: string;
}
const allSystemUsers: SystemUser[] = [
  { id: 'user1', name: '管理员张三' },
  { id: 'user2', name: '律师李四' },
  { id: 'user3', name: '法官王五' },
  { id: 'user4', name: '书记员赵六' },
  { id: 'user5', name: '普通用户孙七' },
  { id: 'user6', name: '访客用户周八'},
];

// Updated Role interface to include permissions and assignedUserIds
interface Role extends RoleData { 
  assignedUserIds: string[];
}

const initialMockRoles: Role[] = [
  { id: '1', name: '案件负责人', description: '负责整个案件的生命周期管理...', permissions: [/*...*/], assignedUserIds: ['user1', 'user2'] },
  { id: '2', name: '协办律师', description: '协助案件负责人处理法律事务...', permissions: [/*...*/], assignedUserIds: ['user2'] },
  { id: '3', name: '债权审核员', description: '负责审核债权申报材料...', permissions: [/*...*/], assignedUserIds: ['user1', 'user4'] },
  { id: '4', name: '普通债权人', description: '案件的债权申报人...', permissions: [/*...*/], assignedUserIds: ['user5'] },
  { id: '5', name: '系统管理员', description: '管理系统用户、角色、权限...', permissions: [/*...*/], assignedUserIds: ['user1'] },
];
// Fill in some permissions for brevity for the mock data
initialMockRoles.forEach(role => {
    if (role.permissions.length === 0) {
        role.permissions.push({ id: 'menu_case_management', name: '案件管理', canRead: true, canCreate: false, canUpdate: false, canDelete: false });
    }
});


const RoleManagementPage: React.FC = () => {
  const theme = useTheme();
  const [roles, setRoles] = useState<Role[]>(initialMockRoles);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleData | null>(null);

  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const [currentUserSelection, setCurrentUserSelection] = useState<SystemUser[]>([]);

  // State for delete confirmation
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);


  const handleOpenCreateDialog = () => {
    setEditingRole(null); 
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (roleId: string) => {
    const roleToEdit = roles.find(role => role.id === roleId);
    if (roleToEdit) {
      setEditingRole({ ...roleToEdit }); 
      setIsDialogOpen(true);
    }
  };

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    setEditingRole(null);
  }, []);

  const handleSaveRole = useCallback((roleData: RoleData) => {
    setRoles(prevRoles => {
      if (roleData.id) { 
        return prevRoles.map(role => role.id === roleData.id ? { ...role, ...roleData, assignedUserIds: role.assignedUserIds || [] } : role);
      } else { 
        const newRole: Role = {
          ...roleData,
          id: Date.now().toString(), 
          assignedUserIds: [], 
        };
        return [...prevRoles, newRole];
      }
    });
    handleCloseDialog();
  }, [handleCloseDialog]);

  // Delete Role Handlers
  const handleOpenDeleteConfirm = (roleId: string) => {
    setDeletingRoleId(roleId);
    setIsDeleteConfirmOpen(true);
  };

  const handleCloseDeleteConfirm = useCallback(() => {
    setIsDeleteConfirmOpen(false);
    setDeletingRoleId(null);
  }, []);

  const handleConfirmDeleteRole = useCallback(() => {
    if (deletingRoleId) {
      setRoles(prevRoles => prevRoles.filter(role => role.id !== deletingRoleId));
      if (expandedRoleId === deletingRoleId) {
          setExpandedRoleId(null); // Close expansion if the deleted role was expanded
      }
      if (editingRole?.id === deletingRoleId) { // If the role being edited is deleted
        handleCloseDialog(); // Close the edit dialog
      }
    }
    handleCloseDeleteConfirm();
  }, [deletingRoleId, expandedRoleId, editingRole?.id, handleCloseDialog, handleCloseDeleteConfirm]);


  const handleExpandClick = (roleId: string) => {
    const newExpandedRoleId = expandedRoleId === roleId ? null : roleId;
    setExpandedRoleId(newExpandedRoleId);
    if (newExpandedRoleId) {
      const role = roles.find(r => r.id === newExpandedRoleId);
      if (role) {
        setCurrentUserSelection(allSystemUsers.filter(user => role.assignedUserIds.includes(user.id)));
      }
    } else {
      setCurrentUserSelection([]);
    }
  };

  const handleSaveUserAssignments = (roleId: string) => {
    setRoles(prevRoles => 
      prevRoles.map(role => 
        role.id === roleId 
        ? { ...role, assignedUserIds: currentUserSelection.map(user => user.id) } 
        : role
      )
    );
    console.log(`User assignments saved for role ID: ${roleId}`, currentUserSelection.map(user => user.id));
  };

  const roleToDelete = roles.find(r => r.id === deletingRoleId);

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 2 }}>
        身份管理
      </Typography>

      <Paper 
        elevation={1} 
        sx={{ 
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Toolbar sx={{ 
          p: { xs: 1.5, sm: 2 },
          borderBottom: `1px solid ${theme.palette.divider}`,
        }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<GroupAddIcon />}
            onClick={handleOpenCreateDialog} 
          >
            创建角色
          </Button>
        </Toolbar>

        <TableContainer>
          <Table sx={{ minWidth: 750 }} aria-label="roles table">
            <TableHead>
              <TableRow>
                <TableCell sx={{ width: '5%' }} /> 
                <TableCell sx={{ fontWeight: 'bold', color: theme.palette.text.primary }}>角色名称</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: theme.palette.text.primary }}>描述</TableCell>
                <TableCell sx={{ fontWeight: 'bold', color: theme.palette.text.primary, width: '20%' }}>已分配用户</TableCell>
                <TableCell align="center" sx={{ fontWeight: 'bold', color: theme.palette.text.primary, width: '15%' }}>操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.map((role) => (
                <Fragment key={role.id}>
                  <TableRow
                    sx={{ 
                      '& > *': { borderBottom: 'unset' }, 
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover,
                      }
                    }}
                  >
                    <TableCell>
                      <IconButton
                        aria-label="expand row"
                        size="small"
                        onClick={() => handleExpandClick(role.id!)}
                      >
                        {expandedRoleId === role.id ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell component="th" scope="row" sx={{color: theme.palette.text.primary}}>
                      {role.name}
                    </TableCell>
                    <TableCell sx={{color: theme.palette.text.secondary, whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>
                      {role.description}
                    </TableCell>
                    <TableCell sx={{color: theme.palette.text.secondary}}>
                        {role.assignedUserIds.map(userId => {
                            const user = allSystemUsers.find(u => u.id === userId);
                            return user ? <Chip key={userId} label={user.name} size="small" sx={{mr:0.5, mb:0.5}}/> : '';
                        })}
                        {role.assignedUserIds.length === 0 && <Typography variant="caption">暂无用户</Typography>}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="编辑角色权限">
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenEditDialog(role.id!)} 
                          sx={{ mr: 0.5, color: theme.palette.info.main, '&:hover': {backgroundColor: theme.palette.action.focus} }}
                        >
                          <EditIcon fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除角色">
                        <IconButton 
                          size="small" 
                          onClick={() => handleOpenDeleteConfirm(role.id!)} // Updated onClick
                          sx={{ color: theme.palette.error.main, '&:hover': {backgroundColor: theme.palette.action.focus} }}
                        >
                          <DeleteOutlineIcon fontSize="small"/>
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}> 
                      <Collapse in={expandedRoleId === role.id} timeout="auto" unmountOnExit>
                        <Box sx={{ 
                            margin: 1.5, 
                            p: 2, 
                            border: `1px solid ${theme.palette.divider}`, 
                            borderRadius: 1, 
                            backgroundColor: muiAlpha(theme.palette.text.primary, 0.025) // Subtle tint
                          }}>
                          <Typography variant="h6" gutterBottom component="div" sx={{mb:1.5}}>
                            为角色 "{role.name}" 分配用户
                          </Typography>
                          <Autocomplete
                            multiple
                            id={`assign-users-autocomplete-${role.id}`}
                            options={allSystemUsers}
                            disableCloseOnSelect
                            getOptionLabel={(option) => option.name}
                            value={currentUserSelection}
                            onChange={(event, newValue) => {
                              setCurrentUserSelection(newValue);
                            }}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                            renderOption={(props, option, { selected }) => (
                              <li {...props}>
                                <Checkbox
                                  icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                                  checkedIcon={<CheckBoxIcon fontSize="small" />}
                                  style={{ marginRight: 8 }}
                                  checked={selected}
                                />
                                {option.name}
                              </li>
                            )}
                            renderInput={(params) => (
                              <TextField {...params} label="选择用户" placeholder="搜索或选择用户..." />
                            )}
                            sx={{mb:2}}
                          />
                          <Button 
                            variant="contained" 
                            color="primary" 
                            size="small"
                            onClick={() => handleSaveUserAssignments(role.id!)}
                          >
                            保存用户分配
                          </Button>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {roles.length === 0 && (
            <Typography align="center" color="text.secondary" sx={{ p: 3 }}>
                暂无角色信息。
            </Typography>
        )}
      </Paper>
      
      <CreateEditRoleDialog
        open={isDialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveRole}
        initialData={editingRole}
      />

      <ConfirmDeleteDialog
        open={isDeleteConfirmOpen}
        onClose={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDeleteRole}
        title="确认删除角色"
        contentText={
          deletingRoleId && roleToDelete 
          ? `您确定要删除角色 "${roleToDelete.name}" 吗？此操作无法撤销。`
          : "您确定要删除此角色吗？此操作无法撤销。"
        }
      />
    </Box>
  );
};

export default RoleManagementPage;
