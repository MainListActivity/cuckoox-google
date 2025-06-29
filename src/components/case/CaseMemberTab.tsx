import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar,
  IconButton,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Paper,
  Tooltip,
  Menu, // Added for action menu
  MenuItem, // Added for action menu
  ListItemIcon, // Added for menu item icons
  Chip, // Added for role display
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  MoreVert as MoreVertIcon, // Added for action menu
  SupervisorAccount as MakeOwnerIcon, // Added for make owner action
} from '@mui/icons-material';
import { CaseMember } from '@/src/types/caseMember';
import { fetchCaseMembers, removeCaseMember, changeCaseOwner } from '@/src/services/caseMemberService'; // Added changeCaseOwner
import AddCaseMemberDialog from './AddCaseMemberDialog';
import { useAuth } from '@/src/contexts/AuthContext';
import { useState as ReactUseState } from 'react'; // ReactUseState to avoid conflict with component's useState
import { useTranslation } from 'react-i18next'; // For i18n
import { useSnackbar } from '@/src/contexts/SnackbarContext'; // For notifications
import { useSurrealClient } from '@/src/contexts/SurrealProvider';
import { useOperationPermissions } from '@/src/hooks/useOperationPermission';

interface CaseMemberTabProps {
  caseId: string;
  // Props currentUserIsOwner and currentUserId are removed
}

const CaseMemberTab: React.FC<CaseMemberTabProps> = ({ caseId }) => {
  const { user } = useAuth(); // Get user from AuthContext
  const currentUserId = user?.id?.toString(); // Get current user's ID as string

  const [members, setMembers] = useState<CaseMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);

  // State for Remove Member Dialog
  const [removeConfirmDialogOpen, setRemoveConfirmDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<CaseMember | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  // State for Change Owner Menu & Dialog
  const [anchorEl, setAnchorEl] = ReactUseState<null | HTMLElement>(null);
  const [selectedMemberForMenu, setSelectedMemberForMenu] = ReactUseState<CaseMember | null>(null);
  const [changeOwnerConfirmDialogOpen, setChangeOwnerConfirmDialogOpen] = ReactUseState(false);
  const [isChangingOwner, setIsChangingOwner] = ReactUseState(false);

  const { t } = useTranslation(); // For i18n
  const { showSuccess, showError } = useSnackbar(); // For notifications

  const client = useSurrealClient();

  // Check operation permissions
  const { permissions, isLoading: isPermissionsLoading } = useOperationPermissions([
    'case_member_add',
    'case_member_remove',
    'case_member_change_owner'
  ]);


  const loadMembers = useCallback(async () => {
    if (!caseId) return; // Do not load if caseId is not available
    setIsLoading(true);
    setError(null);
    try {
      const fetchedMembers = await fetchCaseMembers(client,caseId);
      setMembers(fetchedMembers);
    } catch (err) {
      console.error('Failed to fetch case members:', err);
      setError((err as Error).message || t('case_members_error_load_failed', 'Failed to load members.'));
      showError(t('case_members_error_load_failed', 'Failed to load members.'));
    } finally {
      setIsLoading(false);
    }
  }, [caseId, t, showError]);

  useEffect(() => {
    if (caseId) {
      loadMembers();
    }
  }, [caseId, loadMembers]);

  // Add Member Dialog Handlers
  const handleOpenAddMemberDialog = () => setAddMemberDialogOpen(true);
  const handleCloseAddMemberDialog = () => setAddMemberDialogOpen(false);
  const handleMemberAdded = (newMember: CaseMember) => {
    loadMembers();
    setAddMemberDialogOpen(false);
    showSuccess(t('case_members_success_added', `${newMember.userName} has been added.`));
  };

  // Remove Member Dialog Handlers
  const handleOpenRemoveConfirmDialog = (member: CaseMember) => {
    setMemberToRemove(member);
    setRemoveConfirmDialogOpen(true);
  };
  const handleCloseRemoveConfirmDialog = () => {
    setMemberToRemove(null);
    setRemoveConfirmDialogOpen(false);
  };
  const handleRemoveMember = async () => {
    if (!memberToRemove) return;
    setIsRemovingMember(true);
    setError(null);
    try {
      await removeCaseMember(client, caseId, memberToRemove.id);
      loadMembers();
      showSuccess(t('case_members_success_removed', `${memberToRemove.userName} has been removed.`));
    } catch (err) {
      console.error('Failed to remove member:', err);
      const errorMsg = (err as Error).message || t('case_members_error_remove_failed', 'Failed to remove member.');
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setIsRemovingMember(false);
      handleCloseRemoveConfirmDialog();
    }
  };

  // Change Owner Menu & Dialog Handlers
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, member: CaseMember) => {
    setAnchorEl(event.currentTarget);
    setSelectedMemberForMenu(member);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMemberForMenu(null);
  };
  const handleOpenChangeOwnerConfirmDialog = () => {
    if (!selectedMemberForMenu) return;
    setChangeOwnerConfirmDialogOpen(true);
    handleMenuClose(); // Close the menu
  };
  const handleCloseChangeOwnerConfirmDialog = () => {
    setChangeOwnerConfirmDialogOpen(false);
    setSelectedMemberForMenu(null); // Clear selection
  };

  const handleChangeOwner = async () => {
    if (!selectedMemberForMenu || !currentUserId) return;
    setIsChangingOwner(true);
    setError(null);
    try {
      // Find current owner
      const currentOwner = members.find(m => m.roleInCase === 'owner');
      const currentOwnerUserId = currentOwner?.id || currentUserId;
      
      await changeCaseOwner(client, caseId, selectedMemberForMenu.id, currentOwnerUserId);
      loadMembers();
      showSuccess(t('case_members_success_owner_changed', `Ownership transferred to ${selectedMemberForMenu.userName}.`));
    } catch (err) {
      console.error('Failed to change owner:', err);
      const errorMsg = (err as Error).message || t('case_members_error_owner_change_failed', 'Failed to change owner.');
      setError(errorMsg);
      showError(errorMsg);
    } finally {
      setIsChangingOwner(false);
      handleCloseChangeOwnerConfirmDialog();
    }
  };

  if (isLoading || isPermissionsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <CircularProgress />
      </Box>
    );
  }

  // Error display should be after loading check
  if (error) {
    return <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>;
  }

  if (!caseId) { // If caseId is not yet available (e.g. router still loading)
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
        <Typography>Loading case information...</Typography>
      </Box>
    );
  }

  return (
    <Paper elevation={0} sx={{ p: 2 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" component="div">
          {t('case_members_title', 'Case Members')} ({members.length})
        </Typography>
        {permissions['case_member_add'] && ( // Use derived isOwner state and permission check
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddMemberDialog}
          >
            {t('add_member_button', 'Add Member')}
          </Button>
        )}
      </Box>
      <Divider sx={{ mb: 2 }} />

      {members.length === 0 ? (
        <Typography variant="body1" color="textSecondary" align="center" sx={{p: 3}}>
          {t('no_members_added', 'No members have been added to this case yet.')}
        </Typography>
      ) : (
        <List>
          {members.map((member) => (
            <ListItem
              key={member.id}
              disablePadding
              sx={{ '&:hover': { backgroundColor: 'action.hover' }, borderRadius: 1, mb: 1 }}
            >
              <ListItemAvatar sx={{pl:1.5}}>
                <Avatar src={member.avatarUrl}>
                    {member.roleInCase === 'owner' ? <AdminIcon /> : <PersonIcon />}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box component="span" display="flex" alignItems="center">
                    {member.userName}
                    {member.roleInCase === 'owner' && (
                      <Chip icon={<AdminIcon />} label={t('role_owner', 'Owner')} size="small" color="primary" sx={{ ml: 1 }} variant="outlined"/>
                    )}
                     {member.roleInCase === 'member' && (
                      <Chip icon={<PersonIcon />} label={t('role_member', 'Member')} size="small" sx={{ ml: 1 }} variant="outlined"/>
                    )}
                  </Box>
                }
                secondary={
                  <>
                    {member.userEmail || t('no_email_provided', 'No email provided')}
                  </>
                }
              />
              {currentUserId && (permissions['case_member_remove'] || permissions['case_member_change_owner']) && (
                // Admin can modify anyone, regular owner can't modify themselves
                (user?.github_id === '--admin--' || member.id !== currentUserId) && (
                  <Box>
                    <Tooltip title={t('actions_tooltip', "Actions")}>
                      <IconButton edge="end" aria-label="actions" onClick={(e) => handleMenuOpen(e, member)}>
                        <MoreVertIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )
              )}
            </ListItem>
          ))}
        </List>
      )}

      {/* Action Menu for each member */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
            elevation: 1,
            sx: {
              overflow: 'visible',
              filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
              mt: 1.5,
              '& .MuiAvatar-root': {
                width: 32,
                height: 32,
                ml: -0.5,
                mr: 1,
              },
              '&:before': {
                content: '""',
                display: 'block',
                position: 'absolute',
                top: 0,
                right: 14,
                width: 10,
                height: 10,
                bgcolor: 'background.paper',
                transform: 'translateY(-50%) rotate(45deg)',
                zIndex: 0,
              },
            },
          }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {selectedMemberForMenu?.roleInCase === 'member' && permissions['case_member_change_owner'] && (
           <MenuItem onClick={handleOpenChangeOwnerConfirmDialog}>
            <ListItemIcon>
              <MakeOwnerIcon fontSize="small" />
            </ListItemIcon>
            {t('make_owner_action', 'Make Case Owner')}
          </MenuItem>
        )}
        {permissions['case_member_remove'] && (
          <MenuItem onClick={() => {
            if (selectedMemberForMenu) handleOpenRemoveConfirmDialog(selectedMemberForMenu);
            handleMenuClose();
          }}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error"/>
            </ListItemIcon>
            <Typography color="error">{t('remove_member_action', 'Remove Member')}</Typography>
          </MenuItem>
        )}
      </Menu>


      {caseId && <AddCaseMemberDialog
        open={addMemberDialogOpen}
        onClose={handleCloseAddMemberDialog}
        caseId={caseId}
        onMemberAdded={handleMemberAdded}
      />}

      {/* Remove Member Confirmation Dialog */}
      {memberToRemove && (
        <Dialog
          open={removeConfirmDialogOpen}
          onClose={handleCloseRemoveConfirmDialog}
          aria-labelledby="remove-confirm-dialog-title"
          aria-describedby="remove-confirm-dialog-description"
        >
          <DialogTitle id="remove-confirm-dialog-title">{t('confirm_removal_title', 'Confirm Removal')}</DialogTitle>
          <DialogContent>
            <DialogContentText id="remove-confirm-dialog-description">
              {t('confirm_removal_text', `Are you sure you want to remove ${memberToRemove.userName} from this case?`)}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseRemoveConfirmDialog} disabled={isRemovingMember}>
              {t('cancel_button', 'Cancel')}
            </Button>
            <Button onClick={handleRemoveMember} color="error" autoFocus disabled={isRemovingMember}>
              {isRemovingMember ? <CircularProgress size={24} /> : t('remove_button', 'Remove')}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {/* Change Owner Confirmation Dialog */}
      {selectedMemberForMenu && (
        <Dialog
          open={changeOwnerConfirmDialogOpen}
          onClose={handleCloseChangeOwnerConfirmDialog}
          aria-labelledby="change-owner-confirm-dialog-title"
          aria-describedby="change-owner-confirm-dialog-description"
        >
          <DialogTitle id="change-owner-confirm-dialog-title">{t('confirm_change_owner_title', 'Confirm Ownership Change')}</DialogTitle>
          <DialogContent>
            <DialogContentText id="change-owner-confirm-dialog-description">
              {t('confirm_change_owner_text', `Are you sure you want to make ${selectedMemberForMenu.userName} the new case owner? You will become a regular member.`)}
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseChangeOwnerConfirmDialog} disabled={isChangingOwner}>
             {t('cancel_button', 'Cancel')}
            </Button>
            <Button onClick={handleChangeOwner} color="primary" autoFocus disabled={isChangingOwner}>
              {isChangingOwner ? <CircularProgress size={24} /> : t('confirm_change_button', 'Confirm Change')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Paper>
  );
};

export default CaseMemberTab;
