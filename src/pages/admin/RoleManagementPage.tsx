import React, { useState, useCallback, useEffect, Fragment } from 'react';
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
  Chip,
  Autocomplete,
  TextField,
  Checkbox,
  alpha as muiAlpha,
  CircularProgress, // For loading
  Alert, // For errors
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import CheckBoxIcon from '@mui/icons-material/CheckBox';

import CreateEditRoleDialog, { RoleData as DialogRoleData } from '../../components/admin/roles/CreateEditRoleDialog';
import ConfirmDeleteDialog from '../../components/common/ConfirmDeleteDialog';

import {
  Role,
  SystemUser,
  SystemMenu,
  MenuPermissionInput,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getSystemUsers,
  getSystemMenus,
  assignUsersToRole,
} from '../../services/adminRoleService';

const RoleManagementPage: React.FC = () => {
  const theme = useTheme();
  const [roles, setRoles] = useState<Role[]>([]);
  const [allSystemUsers, setAllSystemUsers] = useState<SystemUser[]>([]);
  const [systemMenus, setSystemMenus] = useState<SystemMenu[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<DialogRoleData | null>(null);

  const [expandedRoleId, setExpandedRoleId] = useState<string | null>(null);
  const [currentUserSelection, setCurrentUserSelection] = useState<SystemUser[]>([]);

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingRoleId, setDeletingRoleId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Initial data fetching
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedRoles, fetchedUsers, fetchedMenus] = await Promise.all([
        getRoles(),
        getSystemUsers(),
        getSystemMenus(),
      ]);
      setRoles(fetchedRoles);
      setAllSystemUsers(fetchedUsers);
      setSystemMenus(fetchedMenus);
    } catch (err) {
      console.error("Failed to fetch initial data:", err);
      setError("Failed to load data. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  const handleOpenCreateDialog = () => {
    setEditingRole(null);
    setIsDialogOpen(true);
  };

  const handleOpenEditDialog = (roleId: string) => {
    const roleToEdit = roles.find(role => role.id === roleId);
    if (roleToEdit) {
      // Map Role to DialogRoleData (which includes MenuPermission with name)
      setEditingRole({ 
        id: roleToEdit.id,
        name: roleToEdit.name,
        description: roleToEdit.description,
        permissions: roleToEdit.permissions, // Assuming Role.permissions is already MenuPermission[]
      });
      setIsDialogOpen(true);
    }
  };

  const handleCloseDialog = useCallback(() => {
    setIsDialogOpen(false);
    setEditingRole(null);
  }, []);

  const handleSaveRole = useCallback(async (dialogRoleData: DialogRoleData) => {
    setIsLoading(true);
    setError(null);
    // Transform MenuPermission[] from dialog to MenuPermissionInput[] for service
    const permissionsInput: MenuPermissionInput[] = dialogRoleData.permissions.map(p => ({
      id: p.id,
      canRead: p.canRead,
      canCreate: p.canCreate,
      canUpdate: p.canUpdate,
      canDelete: p.canDelete,
    }));

    const rolePayload = {
      name: dialogRoleData.name,
      description: dialogRoleData.description,
      permissions: permissionsInput,
    };

    try {
      if (dialogRoleData.id) { // Editing existing role
        const updated = await updateRole(dialogRoleData.id, rolePayload);
        setRoles(prevRoles => prevRoles.map(r => r.id === updated.id ? updated : r));
      } else { // Creating new role
        const newRole = await createRole(rolePayload);
        setRoles(prevRoles => [...prevRoles, newRole]);
      }
      handleCloseDialog();
    } catch (err) {
      console.error("Failed to save role:", err);
      setError(`Failed to save role: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  }, [handleCloseDialog]);

  const handleOpenDeleteConfirm = (roleId: string) => {
    setDeletingRoleId(roleId);
    setIsDeleteConfirmOpen(true);
  };

  const handleCloseDeleteConfirm = useCallback(() => {
    setIsDeleteConfirmOpen(false);
    setDeletingRoleId(null);
  }, []);

  const handleConfirmDeleteRole = useCallback(async () => {
    if (!deletingRoleId) return;
    setIsLoading(true);
    setError(null);
    try {
      await deleteRole(deletingRoleId);
      setRoles(prevRoles => prevRoles.filter(role => role.id !== deletingRoleId));
      if (expandedRoleId === deletingRoleId) setExpandedRoleId(null);
      if (editingRole?.id === deletingRoleId) handleCloseDialog();
      handleCloseDeleteConfirm();
    } catch (err) {
      console.error("Failed to delete role:", err);
      setError(`Failed to delete role: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
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

  const handleSaveUserAssignments = async (roleId: string) => {
    setIsLoading(true);
    setError(null);
    const userIdsToAssign = currentUserSelection.map(user => user.id);
    try {
      await assignUsersToRole(roleId, userIdsToAssign);
      setRoles(prevRoles =>
        prevRoles.map(role =>
          role.id === roleId ? { ...role, assignedUserIds: userIdsToAssign } : role
        )
      );
      // Optionally, provide success feedback e.g. using a snackbar
      console.log(`User assignments saved for role ID: ${roleId}`, userIdsToAssign);
    } catch (err) {
      console.error("Failed to assign users:", err);
      setError(`Failed to assign users: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const roleToDelete = roles.find(r => r.id === deletingRoleId);

  if (isLoading && roles.length === 0 && systemMenus.length === 0) { // Initial full page load
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
        <Typography sx={{ml: 2}}>Loading roles and settings...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 } }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 2 }}>
        身份管理
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper elevation={1} sx={{ backgroundColor: theme.palette.background.paper }}>
        <Toolbar sx={{ p: { xs: 1.5, sm: 2 }, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<GroupAddIcon />}
            onClick={handleOpenCreateDialog}
            disabled={isLoading || systemMenus.length === 0} // Disable if menus not loaded
          >
            创建角色
          </Button>
          {isLoading && <CircularProgress size={24} sx={{ml:2}}/>}
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
                  <TableRow sx={{ '& > *': { borderBottom: 'unset' }, '&:hover': { backgroundColor: theme.palette.action.hover } }}>
                    <TableCell>
                      <IconButton aria-label="expand row" size="small" onClick={() => handleExpandClick(role.id)}>
                        {expandedRoleId === role.id ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell component="th" scope="row" sx={{ color: theme.palette.text.primary }}>
                      {role.name}
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {role.description}
                    </TableCell>
                    <TableCell sx={{ color: theme.palette.text.secondary }}>
                      {role.assignedUserIds.map(userId => {
                        const user = allSystemUsers.find(u => u.id === userId);
                        return user ? <Chip key={userId} label={user.name} size="small" sx={{ mr: 0.5, mb: 0.5 }} /> : '';
                      })}
                      {role.assignedUserIds.length === 0 && <Typography variant="caption">暂无用户</Typography>}
                    </TableCell>
                    <TableCell align="center">
                      <Tooltip title="编辑角色权限">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEditDialog(role.id)}
                          disabled={isLoading}
                          sx={{ mr: 0.5, color: theme.palette.info.main, '&:hover': { backgroundColor: theme.palette.action.focus } }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="删除角色">
                        <IconButton
                          size="small"
                          onClick={() => handleOpenDeleteConfirm(role.id)}
                          disabled={isLoading}
                          sx={{ color: theme.palette.error.main, '&:hover': { backgroundColor: theme.palette.action.focus } }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={5}>
                      <Collapse in={expandedRoleId === role.id} timeout="auto" unmountOnExit>
                        <Box sx={{ margin: 1.5, p: 2, border: `1px solid ${theme.palette.divider}`, borderRadius: 1, backgroundColor: muiAlpha(theme.palette.text.primary, 0.025) }}>
                          <Typography variant="h6" gutterBottom component="div" sx={{ mb: 1.5 }}>
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
                            sx={{ mb: 2 }}
                            disabled={isLoading}
                          />
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            onClick={() => handleSaveUserAssignments(role.id)}
                            disabled={isLoading}
                          >
                            保存用户分配
                          </Button>
                           {isLoading && expandedRoleId === role.id && <CircularProgress size={20} sx={{ml:1}}/>}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {!isLoading && roles.length === 0 && !error && (
          <Typography align="center" color="text.secondary" sx={{ p: 3 }}>
            暂无角色信息。
          </Typography>
        )}
      </Paper>

      {isDialogOpen && ( // Conditionally render dialog to ensure systemMenus is ready
        <CreateEditRoleDialog
          open={isDialogOpen}
          onClose={handleCloseDialog}
          onSave={handleSaveRole}
          initialData={editingRole}
          systemMenus={systemMenus} // Pass fetched systemMenus
        />
      )}

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
