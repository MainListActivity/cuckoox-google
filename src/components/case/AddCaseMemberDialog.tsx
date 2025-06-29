import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  CircularProgress,
  Box,
  Alert,
} from '@mui/material';
import { CaseMember } from '@/src/types/caseMember';
import { addCaseMember, searchSystemUsers, SystemUser } from '@/src/services/caseMemberService';
import { useTranslation } from 'react-i18next';
import { useSurrealClient } from '@/src/contexts/SurrealProvider';

interface AddCaseMemberDialogProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  onMemberAdded: (newMember: CaseMember) => void;
}

const AddCaseMemberDialog: React.FC<AddCaseMemberDialogProps> = ({
  open,
  onClose,
  caseId,
  onMemberAdded,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SystemUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const client = useSurrealClient();
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    if (!open) {
      // Reset state when dialog is closed
      setSearchQuery('');
      setSearchResults([]);
      setSelectedUser(null);
      setError(null);
      setIsLoadingSearch(false);
      setIsAddingMember(false);
    }
  }, [open]);

  useEffect(() => {
    const performSearch = async () => {
      if (searchQuery.trim().length < 2 && searchResults.length > 0 && !searchQuery.trim().length) {
        // Clear results if search query is cleared after having results
        setSearchResults([]);
        setSelectedUser(null);
        return;
      }
      if (searchQuery.trim().length < 2) { // Minimum 2 characters to search
        setSearchResults([]); // Clear previous results if query is too short
        setSelectedUser(null);
        return;
      }

      setIsLoadingSearch(true);
      setError(null);
      try {
        const users = await searchSystemUsers(client, searchQuery);
        setSearchResults(users);
      } catch (err) {
        console.error('Failed to search users:', err);
        setError(t('search_users_error', 'Failed to search users. Please try again.'));
        setSearchResults([]);
      } finally {
        setIsLoadingSearch(false);
      }
    };

    // Debounce search
    const debounceTimer = setTimeout(() => {
      if (open) { // Only search if dialog is open
          performSearch();
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
  }, [searchQuery, open]);

  const handleUserSelect = (user: SystemUser) => {
    setSelectedUser(user);
  };

  const handleAddMember = async () => {
    if (!selectedUser) {
      setError(t('please_select_user', 'Please select a user to add.'));
      return;
    }
    setIsAddingMember(true);
    setError(null);
    try {
      const newMember = await addCaseMember(
        client,
        caseId,
        selectedUser.id,
        selectedUser.name,
        selectedUser.email,
        selectedUser.avatarUrl,
        'member' // Default role for adding members
      );
      onMemberAdded(newMember);
      onClose(); // Close dialog on success
    } catch (err) {
      console.error('Failed to add member:', err);
      setError((err as Error).message || t('add_member_error', 'Failed to add member. Please try again.'));
    } finally {
      setIsAddingMember(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>{t('add_member_dialog_title', 'Add New Member to Case')}</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField
          autoFocus
          margin="dense"
          label={t('search_users_label', 'Search users (by name or email)')}
          type="text"
          fullWidth
          variant="outlined"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          sx={{ mb: 2 }}
          helperText={t('search_users_helper_text', 'Enter at least 2 characters to search.')}
        />
        {isLoadingSearch && (
          <Box display="flex" justifyContent="center" my={2}>
            <CircularProgress />
          </Box>
        )}
        {!isLoadingSearch && searchResults.length === 0 && searchQuery.trim().length >=2 && (
          <Typography variant="body2" color="textSecondary" align="center">
            {t('no_users_found', 'No users found matching your search.')}
          </Typography>
        )}
        {!isLoadingSearch && searchResults.length > 0 && (
          <List>
            {searchResults.map((user) => (
              <ListItem key={user.id} disablePadding>
                <ListItemButton
                  onClick={() => handleUserSelect(user)}
                  selected={selectedUser?.id === user.id}
                >
                  <ListItemAvatar>
                    <Avatar src={user.avatarUrl}>{user.name.charAt(0)}</Avatar>
                  </ListItemAvatar>
                  <ListItemText primary={user.name} secondary={user.email || 'No email'} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isAddingMember}>{t('cancel_button', 'Cancel')}</Button>
        <Button
          onClick={handleAddMember}
          variant="contained"
          disabled={isAddingMember}
        >
          {isAddingMember ? <CircularProgress size={24} /> : t('add_selected_user', 'Add Selected User')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddCaseMemberDialog;
