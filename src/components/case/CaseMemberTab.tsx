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
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, AdminPanelSettings as AdminIcon, Person as PersonIcon } from '@mui/icons-material';
import { CaseMember } from '@/src/types/caseMember';
import { fetchCaseMembers, removeCaseMember } from '@/src/services/caseMemberService';
import AddCaseMemberDialog from './AddCaseMemberDialog';
import { useAuth } from '@/src/contexts/AuthContext'; // Import useAuth
import { useMemo } from 'react'; // Import useMemo

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
  const [removeConfirmDialogOpen, setRemoveConfirmDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<CaseMember | null>(null);
  const [isRemovingMember, setIsRemovingMember] = useState(false);

  // Determine if the current user is an owner of this case
  const isOwner = useMemo(() => {
    if (!currentUserId || !members || members.length === 0) return false;
    return members.some(member => member.id === currentUserId && member.roleInCase === 'owner');
  }, [currentUserId, members]);

  const loadMembers = useCallback(async () => {
    if (!caseId) return; // Do not load if caseId is not available
    setIsLoading(true);
    setError(null);
    try {
      const fetchedMembers = await fetchCaseMembers(caseId);
      setMembers(fetchedMembers);
    } catch (err) {
      console.error('Failed to fetch case members:', err);
      setError((err as Error).message || 'Failed to load members.');
    } finally {
      setIsLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    if (caseId) {
      loadMembers();
    }
  }, [caseId, loadMembers]);

  const handleOpenAddMemberDialog = () => {
    setAddMemberDialogOpen(true);
  };

  const handleCloseAddMemberDialog = () => {
    setAddMemberDialogOpen(false);
  };

  const handleMemberAdded = (newMember: CaseMember) => {
    // Optimistically update UI or re-fetch
    // setMembers(prev => [...prev, newMember]);
    loadMembers(); // Re-fetch for simplicity in mock environment
    setAddMemberDialogOpen(false);
  };

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
      await removeCaseMember(caseId, memberToRemove.id);
      // Optimistically update UI or re-fetch
      // setMembers(prev => prev.filter(m => m.id !== memberToRemove.id));
      loadMembers(); // Re-fetch
    } catch (err) {
      console.error('Failed to remove member:', err);
      setError((err as Error).message || 'Failed to remove member.');
    } finally {
      setIsRemovingMember(false);
      handleCloseRemoveConfirmDialog();
    }
  };

  if (isLoading) {
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
          Case Members ({members.length})
        </Typography>
        {isOwner && ( // Use derived isOwner state
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenAddMemberDialog}
          >
            Add Member
          </Button>
        )}
      </Box>
      <Divider sx={{ mb: 2 }} />

      {members.length === 0 ? (
        <Typography variant="body1" color="textSecondary" align="center" sx={{p: 3}}>
          No members have been added to this case yet.
        </Typography>
      ) : (
        <List>
          {members.map((member) => (
            <ListItem
              key={member.id}
              secondaryAction={
                isOwner && currentUserId && member.id !== currentUserId ? (
                  // Owner can remove other members.
                  // Backend will prevent removing last owner.
                  <Tooltip title="Remove member">
                    <IconButton edge="end" aria-label="delete" onClick={() => handleOpenRemoveConfirmDialog(member)}>
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                ) : null
              }
              sx={{ '&:hover': { backgroundColor: 'action.hover' }, borderRadius: 1, mb: 1 }}
            >
              <ListItemAvatar>
                <Avatar src={member.avatarUrl}>
                    {/* Display AdminIcon if owner, PersonIcon otherwise */}
                    {member.roleInCase === 'owner' ? <AdminIcon /> : <PersonIcon />}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={member.userName}
                secondary={
                  <>
                    <Typography component="span" variant="body2" color="text.primary">
                      {member.roleInCase === 'owner' ? 'Case Owner' : 'Case Member'}
                    </Typography>
                    {member.userEmail && ` - ${member.userEmail}`}
                  </>
                }
              />
            </ListItem>
          ))}
        </List>
      )}

      {caseId && <AddCaseMemberDialog // Ensure caseId is available before rendering dialog
        open={addMemberDialogOpen}
        onClose={handleCloseAddMemberDialog}
        caseId={caseId}
        onMemberAdded={handleMemberAdded}
      />}

      {memberToRemove && (
        <Dialog
          open={removeConfirmDialogOpen}
          onClose={handleCloseRemoveConfirmDialog}
          aria-labelledby="alert-dialog-title"
          aria-describedby="alert-dialog-description"
        >
          <DialogTitle id="alert-dialog-title">Confirm Removal</DialogTitle>
          <DialogContent>
            <DialogContentText id="alert-dialog-description">
              Are you sure you want to remove <strong>{memberToRemove.userName}</strong> from this case?
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseRemoveConfirmDialog} disabled={isRemovingMember}>
              Cancel
            </Button>
            <Button onClick={handleRemoveMember} color="error" autoFocus disabled={isRemovingMember}>
              {isRemovingMember ? <CircularProgress size={24} /> : 'Remove'}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Paper>
  );
};

export default CaseMemberTab;
