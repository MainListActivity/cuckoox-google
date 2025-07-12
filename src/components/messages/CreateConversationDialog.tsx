import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  Box,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemButton,
  Checkbox,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import { Person, Group } from '@mui/icons-material';
import { useAuth } from '@/src/contexts/AuthContext';
import { surrealClient } from '@/src/lib/surrealClient';
import { messageService } from '@/src/services/messageService';
import { RecordId } from 'surrealdb';

interface CreateConversationDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (conversationId: RecordId | string) => void;
}

interface UserOption {
  id: RecordId | string;
  name: string;
  email?: string;
  avatar_url?: string;
}

const CreateConversationDialog: React.FC<CreateConversationDialogProps> = (props) => {
  const { open, onClose, onCreated } = props;
  const { user, selectedCaseId } = useAuth();
  
  const [conversationType, setConversationType] = useState<'DIRECT' | 'GROUP'>('DIRECT');
  const [conversationName, setConversationName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<(RecordId | string)[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Load available users when dialog opens
  useEffect(() => {
    if (open && selectedCaseId) {
      loadAvailableUsers();
    }
  }, [open, selectedCaseId]);
  
  const loadAvailableUsers = async () => {
    if (!selectedCaseId || !user?.id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Get case members (excluding current user)
      const query = `
        SELECT out.* AS user FROM has_member 
        WHERE in = $case_id 
        AND out != $current_user
      `;
      
      const client = await surrealClient();
      const queryVars: Record<string, unknown> = { current_user: user.id };
      if (selectedCaseId) queryVars.case_id = selectedCaseId;

      const queryResult: unknown = await client.query(query, queryVars);
      const firstSet: any[] = Array.isArray(queryResult) ? queryResult : [];
      if (firstSet.length > 0) {
        const users = firstSet.map((item: any) => ({
          id: item.user.id,
          name: item.user.name || 'Unknown User',
          email: item.user.email,
          avatar_url: item.user.avatar_url
        }));
        setAvailableUsers(users);
      } else {
        setAvailableUsers([]);
      }
    } catch (err: unknown) {
      console.error('Error loading users:', err);
      setError('加载用户列表失败');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setConversationType(event.target.value as 'DIRECT' | 'GROUP');
    setSelectedUsers([]);
    setConversationName('');
    setDescription('');
  };
  
  const handleUserSelect = (userId: RecordId | string) => {
    if (conversationType === 'DIRECT') {
      setSelectedUsers([userId]);
    } else {
      setSelectedUsers((prev: (RecordId | string)[]) => {
        const index = prev.findIndex((id: RecordId | string) => String(id) === String(userId));
        if (index >= 0) {
          return prev.filter((_: RecordId | string, i: number) => i !== index);
        } else {
          return [...prev, userId];
        }
      });
    }
  };
  
  const handleCreate = async () => {
    if (!user?.id) return;
    
    // Validation
    if (selectedUsers.length === 0) {
      setError('请至少选择一个参与者');
      return;
    }
    
    if (conversationType === 'GROUP' && !conversationName.trim()) {
      setError('群组会话需要输入名称');
      return;
    }
    
    setIsCreating(true);
    setError(null);
    
    try {
      // Include current user in participants
      const participants = [...selectedUsers, user.id];
      
      const conversation = await messageService.createConversation({
        type: conversationType,
        name: conversationName.trim() || undefined,
        description: description.trim() || undefined,
        case_id: selectedCaseId,
        participants: participants
      });
      
      onCreated(conversation.id);
      handleClose();
    } catch (error) {
      console.error('Error creating conversation:', error);
      setError('创建会话失败，请重试');
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleClose = () => {
    setConversationType('DIRECT');
    setConversationName('');
    setDescription('');
    setSelectedUsers([]);
    setError(null);
    onClose();
  };
  
  const getSelectedUserNames = () => {
    return selectedUsers
      .map(userId => {
        const user = availableUsers.find(u => String(u.id) === String(userId));
        return user?.name || 'Unknown';
      })
      .join(', ');
  };
  
  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        创建新会话
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {/* Conversation Type Selection */}
        <FormControl component="fieldset" sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant={conversationType === 'DIRECT' ? 'contained' : 'outlined'}
              startIcon={<Person />}
              onClick={() => handleTypeChange({ target: { value: 'DIRECT' } } as any)}
            >
              私聊
            </Button>
            <Button
              variant={conversationType === 'GROUP' ? 'contained' : 'outlined'}
              startIcon={<Group />}
              onClick={() => handleTypeChange({ target: { value: 'GROUP' } } as any)}
            >
              群聊
            </Button>
          </Box>
        </FormControl>
        
        {/* Group Name (for group chats) */}
        {conversationType === 'GROUP' && (
          <>
            <TextField
              fullWidth
              label="群组名称"
              value={conversationName}
              onChange={(e) => setConversationName(e.target.value)}
              required
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="群组描述"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              multiline
              rows={2}
              sx={{ mb: 2 }}
            />
          </>
        )}
        
        {/* User Selection */}
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          选择参与者 {conversationType === 'DIRECT' ? '（单选）' : '（多选）'}
        </Typography>
        
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : availableUsers.length === 0 ? (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            暂无可选用户
          </Typography>
        ) : (
          <List sx={{ maxHeight: 300, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1 }}>
            {availableUsers.map((user) => {
              const isSelected = selectedUsers.some(id => String(id) === String(user.id));
              
              return (
                <ListItem key={String(user.id)} disablePadding>
                  <ListItemButton
                    onClick={() => handleUserSelect(user.id)}
                    selected={isSelected}
                  >
                    <ListItemAvatar>
                      <Avatar src={user.avatar_url}>{user.name.charAt(0)}</Avatar>
                    </ListItemAvatar>
                    <ListItemText primary={user.name} secondary={user.email} />
                    {conversationType === 'GROUP' && (
                      <Checkbox edge="end" checked={isSelected} tabIndex={-1} disableRipple />
                    )}
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
        
        {/* Selected Users Display */}
        {selectedUsers.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              已选择: {getSelectedUserNames()}
            </Typography>
          </Box>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={handleClose} disabled={isCreating}>
          取消
        </Button>
        <Button
          onClick={handleCreate}
          variant="contained"
          disabled={isCreating || selectedUsers.length === 0 || (conversationType === 'GROUP' && !conversationName.trim())}
        >
          {isCreating ? '创建中...' : '创建'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateConversationDialog;