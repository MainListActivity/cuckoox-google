import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Avatar,
  IconButton,
  Button,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Card,
  CardContent,
  Grid,
  Skeleton,
  useTheme,
  useMediaQuery,
  Tooltip,
  Menu,
  MenuItem
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
  Settings as SettingsIcon,
  PersonAdd as PersonAddIcon,
  ExitToApp as ExitToAppIcon,
  Block as BlockIcon,
  AdminPanelSettings as AdminIcon,
  Person as PersonIcon,
  Visibility as VisibilityIcon,
  MoreVert as MoreVertIcon,
  Call as CallIcon,
  VideoCall as VideoCallIcon,
  Message as MessageIcon,
  Share as ShareIcon,
  ContentCopy as CopyIcon,
  QrCode as QrCodeIcon,
  Group as GroupIcon,
  AccessTime as AccessTimeIcon,
  Security as SecurityIcon,
  Public as PublicIcon,
  Lock as LockIcon
} from '@mui/icons-material';
import { RecordId } from 'surrealdb';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { useGroupDetails, useGroupOperations, useGroupPermissions } from '@/src/hooks/useGroupData';
import type { ExtendedGroup, ExtendedGroupMember, GroupMemberRole } from '@/src/types/group';

interface GroupInfoPanelProps {
  groupId: RecordId | string;
  onBack?: () => void;
  onEditGroup?: () => void;
  onShowSettings?: () => void;
  onShowMemberList?: () => void;
  onInviteMembers?: () => void;
  onLeaveGroup?: () => void;
  onStartCall?: (type: 'audio' | 'video') => void;
  onStartDirectMessage?: (userId: RecordId | string) => void;
}

export default function GroupInfoPanel({
  groupId,
  onBack,
  onEditGroup,
  onShowSettings,
  onShowMemberList,
  onInviteMembers,
  onLeaveGroup,
  onStartCall,
  onStartDirectMessage
}: GroupInfoPanelProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  
  // 群组数据
  const { group, members, settings, isLoading, error, refetch } = useGroupDetails(groupId);
  const { updateGroup, removeMember, updateMemberRole, transferOwnership, leaveGroup } = useGroupOperations();
  const permissions = useGroupPermissions(groupId, user?.id);
  
  // 本地状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [memberMenuAnchor, setMemberMenuAnchor] = useState<{ element: HTMLElement; member: ExtendedGroupMember } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [qrCodeDialogOpen, setQrCodeDialogOpen] = useState(false);
  
  // 计算当前用户信息
  const currentMember = useMemo(() => {
    if (!members || !user?.id) return null;
    return members.find(m => String(m.user_id) === String(user.id));
  }, [members, user?.id]);
  
  // 按角色分组成员
  const membersByRole = useMemo(() => {
    if (!members) return { owners: [], admins: [], members: [] };
    
    return {
      owners: members.filter(m => m.role === 'owner'),
      admins: members.filter(m => m.role === 'admin'),
      members: members.filter(m => m.role === 'member')
    };
  }, [members]);
  
  // 群组统计信息
  const groupStats = useMemo(() => {
    if (!group || !members) return null;
    
    const memberCount = members.length;
    const onlineCount = members.filter(m => m.is_online).length;
    const createdDate = new Date(group.created_at);
    
    return {
      memberCount,
      onlineCount,
      createdDate: createdDate.toLocaleDateString(),
      groupType: group.type
    };
  }, [group, members]);
  
  // 处理编辑群组
  const handleEditGroup = useCallback(async () => {
    if (!group) return;
    
    try {
      setActionLoading('editing');
      await updateGroup(groupId, {
        name: editedName.trim(),
        description: editedDescription.trim()
      });
      
      setEditDialogOpen(false);
      showSuccess('群组信息更新成功');
      refetch();
    } catch (error) {
      showError(`更新失败: ${(error as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  }, [group, groupId, editedName, editedDescription, updateGroup, showSuccess, showError, refetch]);
  
  // 处理成员操作
  const handleMemberAction = useCallback(async (action: string, member: ExtendedGroupMember) => {
    try {
      setActionLoading(action);
      
      switch (action) {
        case 'remove':
          if (!window.confirm(`确定要移除 ${member.user_name} 吗？`)) return;
          await removeMember(groupId, member.user_id);
          showSuccess('成员已移除');
          break;
          
        case 'makeAdmin':
          await updateMemberRole(groupId, member.user_id, 'admin');
          showSuccess('已设为管理员');
          break;
          
        case 'removeMakeAdmin':
          await updateMemberRole(groupId, member.user_id, 'member');
          showSuccess('已取消管理员');
          break;
          
        case 'transferOwner':
          if (!window.confirm(`确定要将群主转让给 ${member.user_name} 吗？此操作不可撤销。`)) return;
          await transferOwnership(groupId, member.user_id);
          showSuccess('群主转让成功');
          break;
      }
      
      refetch();
    } catch (error) {
      showError(`操作失败: ${(error as Error).message}`);
    } finally {
      setActionLoading(null);
      setMemberMenuAnchor(null);
    }
  }, [groupId, removeMember, updateMemberRole, transferOwnership, showSuccess, showError, refetch]);
  
  // 处理退出群组
  const handleLeaveGroup = useCallback(async () => {
    if (!window.confirm('确定要退出此群组吗？')) return;
    
    try {
      setActionLoading('leaving');
      await leaveGroup(groupId);
      showSuccess('已退出群组');
      onLeaveGroup?.();
    } catch (error) {
      showError(`退出失败: ${(error as Error).message}`);
    } finally {
      setActionLoading(null);
    }
  }, [groupId, leaveGroup, showSuccess, showError, onLeaveGroup]);
  
  // 复制群组链接
  const handleCopyGroupLink = useCallback(async () => {
    try {
      const groupLink = `${window.location.origin}/groups/${groupId}`;
      await navigator.clipboard.writeText(groupLink);
      showSuccess('群组链接已复制');
    } catch (error) {
      showError('复制失败');
    }
  }, [groupId, showSuccess, showError]);
  
  // 获取角色显示文本
  const getRoleText = (role: GroupMemberRole) => {
    switch (role) {
      case 'owner': return '群主';
      case 'admin': return '管理员';
      case 'member': return '成员';
      default: return '成员';
    }
  };
  
  // 获取角色图标
  const getRoleIcon = (role: GroupMemberRole) => {
    switch (role) {
      case 'owner': return <AdminIcon color="warning" fontSize="small" />;
      case 'admin': return <SecurityIcon color="info" fontSize="small" />;
      default: return <PersonIcon color="action" fontSize="small" />;
    }
  };
  
  // 获取群组类型显示
  const getGroupTypeInfo = () => {
    if (!group) return null;
    
    switch (group.type) {
      case 'case_related':
        return {
          label: '案件群组',
          icon: <SecurityIcon />,
          color: 'warning' as const,
          description: '与案件相关的讨论群组'
        };
      case 'department':
        return {
          label: '部门群组',
          icon: <GroupIcon />,
          color: 'info' as const,
          description: '部门内部交流群组'
        };
      default:
        return {
          label: '普通群组',
          icon: <GroupIcon />,
          color: 'default' as const,
          description: '普通交流群组'
        };
    }
  };
  
  // 渲染成员列表项
  const renderMemberItem = (member: ExtendedGroupMember) => {
    const canManageMember = permissions.isOwner || 
      (permissions.isAdmin && member.role === 'member');
    
    return (
      <ListItem key={member.id}>
        <ListItemAvatar>
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  bgcolor: member.is_online ? 'success.main' : 'grey.400',
                  border: '2px solid',
                  borderColor: 'background.paper'
                }}
              />
            }
          >
            <Avatar
              src={member.user_avatar}
              sx={{ width: 40, height: 40 }}
            >
              {member.user_name?.charAt(0)?.toUpperCase()}
            </Avatar>
          </Badge>
        </ListItemAvatar>
        
        <ListItemText
          primary={
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="body1">
                {member.user_name}
              </Typography>
              {getRoleIcon(member.role)}
              <Chip
                size="small"
                label={getRoleText(member.role)}
                variant="outlined"
                color={
                  member.role === 'owner' ? 'warning' :
                  member.role === 'admin' ? 'info' : 'default'
                }
              />
            </Box>
          }
          secondary={
            <Box>
              {member.nickname && (
                <Typography variant="caption" color="text.secondary">
                  群昵称: {member.nickname}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" display="block">
                加入时间: {new Date(member.joined_at).toLocaleDateString()}
              </Typography>
            </Box>
          }
        />
        
        <ListItemSecondaryAction>
          <Box display="flex" alignItems="center" gap={1}>
            {/* 私聊按钮 */}
            {String(member.user_id) !== String(user?.id) && (
              <Tooltip title="发起私聊">
                <IconButton
                  size="small"
                  onClick={() => onStartDirectMessage?.(member.user_id)}
                >
                  <MessageIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            
            {/* 管理菜单 */}
            {canManageMember && String(member.user_id) !== String(user?.id) && (
              <IconButton
                size="small"
                onClick={(e) => setMemberMenuAnchor({ element: e.currentTarget, member })}
                disabled={actionLoading !== null}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            )}
          </Box>
        </ListItemSecondaryAction>
      </ListItem>
    );
  };
  
  // 渲染编辑对话框
  const renderEditDialog = () => (
    <Dialog
      open={editDialogOpen}
      onClose={() => setEditDialogOpen(false)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>编辑群组信息</DialogTitle>
      <DialogContent>
        <TextField
          fullWidth
          label="群组名称"
          value={editedName}
          onChange={(e) => setEditedName(e.target.value)}
          margin="normal"
          disabled={actionLoading !== null}
        />
        <TextField
          fullWidth
          label="群组描述"
          value={editedDescription}
          onChange={(e) => setEditedDescription(e.target.value)}
          margin="normal"
          multiline
          rows={3}
          disabled={actionLoading !== null}
        />
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={() => setEditDialogOpen(false)}
          disabled={actionLoading !== null}
        >
          取消
        </Button>
        <Button
          onClick={handleEditGroup}
          variant="contained"
          disabled={!editedName.trim() || actionLoading !== null}
        >
          保存
        </Button>
      </DialogActions>
    </Dialog>
  );
  
  // 渲染成员管理菜单
  const renderMemberMenu = () => (
    <Menu
      anchorEl={memberMenuAnchor?.element}
      open={Boolean(memberMenuAnchor)}
      onClose={() => setMemberMenuAnchor(null)}
    >
      {memberMenuAnchor?.member.role === 'member' && permissions.canRemoveMember && (
        <MenuItem
          onClick={() => handleMemberAction('makeAdmin', memberMenuAnchor.member)}
        >
          设为管理员
        </MenuItem>
      )}
      
      {memberMenuAnchor?.member.role === 'admin' && permissions.isOwner && (
        <MenuItem
          onClick={() => handleMemberAction('removeMakeAdmin', memberMenuAnchor.member)}
        >
          取消管理员
        </MenuItem>
      )}
      
      {permissions.isOwner && memberMenuAnchor?.member.role !== 'owner' && (
        <MenuItem
          onClick={() => handleMemberAction('transferOwner', memberMenuAnchor.member)}
        >
          转让群主
        </MenuItem>
      )}
      
      <Divider />
      
      {permissions.canRemoveMember && (
        <MenuItem
          onClick={() => handleMemberAction('remove', memberMenuAnchor.member)}
          sx={{ color: 'error.main' }}
        >
          移除成员
        </MenuItem>
      )}
    </Menu>
  );
  
  if (isLoading) {
    return (
      <Box p={3}>
        <Skeleton variant="rectangular" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="text" height={40} sx={{ mb: 1 }} />
        <Skeleton variant="text" height={30} sx={{ mb: 2 }} />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} variant="rectangular" height={60} sx={{ mb: 1 }} />
        ))}
      </Box>
    );
  }
  
  if (error || !group) {
    return (
      <Box p={3} textAlign="center">
        <Typography color="error" gutterBottom>
          {error?.message || '群组信息加载失败'}
        </Typography>
        <Button onClick={refetch}>重试</Button>
      </Box>
    );
  }
  
  const groupTypeInfo = getGroupTypeInfo();
  
  return (
    <Box>
      {/* 头部 */}
      <Paper elevation={1} sx={{ p: 2, mb: 2 }}>
        <Box display="flex" alignItems="center" gap={2} mb={2}>
          {isMobile && onBack && (
            <IconButton onClick={onBack}>
              <ArrowBackIcon />
            </IconButton>
          )}
          <Typography variant="h6" flex={1}>
            群组信息
          </Typography>
          
          {permissions.canEditInfo && (
            <IconButton
              onClick={() => {
                setEditedName(group.name);
                setEditedDescription(group.description || '');
                setEditDialogOpen(true);
              }}
              disabled={actionLoading !== null}
            >
              <EditIcon />
            </IconButton>
          )}
        </Box>
      </Paper>
      
      {/* 群组基本信息 */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Box display="flex" alignItems="center" gap={3} mb={3}>
            <Avatar
              src={group.avatar_url}
              sx={{ 
                width: 80, 
                height: 80,
                fontSize: '2rem',
                bgcolor: 'primary.main'
              }}
            >
              {group.name?.charAt(0)?.toUpperCase()}
            </Avatar>
            
            <Box flex={1}>
              <Typography variant="h5" gutterBottom>
                {group.name}
              </Typography>
              
              {group.description && (
                <Typography variant="body2" color="text.secondary" paragraph>
                  {group.description}
                </Typography>
              )}
              
              {groupTypeInfo && (
                <Chip
                  icon={groupTypeInfo.icon}
                  label={groupTypeInfo.label}
                  color={groupTypeInfo.color}
                  variant="outlined"
                  size="small"
                />
              )}
            </Box>
          </Box>
          
          {/* 群组操作按钮 */}
          <Grid container spacing={1}>
            <Grid size={6}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<CallIcon />}
                onClick={() => onStartCall?.('audio')}
                disabled={!permissions.canSendMessage}
              >
                语音通话
              </Button>
            </Grid>
            <Grid size={6}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<VideoCallIcon />}
                onClick={() => onStartCall?.('video')}
                disabled={!permissions.canSendMessage}
              >
                视频通话
              </Button>
            </Grid>
            <Grid size={6}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<ShareIcon />}
                onClick={handleCopyGroupLink}
              >
                分享群组
              </Button>
            </Grid>
            <Grid size={6}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<QrCodeIcon />}
                onClick={() => setQrCodeDialogOpen(true)}
              >
                群组二维码
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
      
      {/* 群组统计 */}
      {groupStats && (
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              群组统计
            </Typography>
            
            <Grid container spacing={2}>
              <Grid size={6}>
                <Box textAlign="center">
                  <Typography variant="h4" color="primary">
                    {groupStats.memberCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    总成员
                  </Typography>
                </Box>
              </Grid>
              <Grid size={6}>
                <Box textAlign="center">
                  <Typography variant="h4" color="success.main">
                    {groupStats.onlineCount}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    在线成员
                  </Typography>
                </Box>
              </Grid>
            </Grid>
            
            <Divider sx={{ my: 2 }} />
            
            <Box display="flex" alignItems="center" gap={2} mb={1}>
              <AccessTimeIcon color="action" fontSize="small" />
              <Typography variant="body2" color="text.secondary">
                创建时间: {groupStats.createdDate}
              </Typography>
            </Box>
            
            {group.is_public !== undefined && (
              <Box display="flex" alignItems="center" gap={2}>
                {group.is_public ? <PublicIcon color="action" fontSize="small" /> : <LockIcon color="action" fontSize="small" />}
                <Typography variant="body2" color="text.secondary">
                  {group.is_public ? '公开群组' : '私密群组'}
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* 成员列表 */}
      <Card>
        <CardContent>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
            <Typography variant="h6">
              成员列表 ({members?.length || 0})
            </Typography>
            
            {permissions.canAddMember && (
              <Button
                startIcon={<PersonAddIcon />}
                onClick={onInviteMembers}
                disabled={actionLoading !== null}
              >
                邀请成员
              </Button>
            )}
          </Box>
          
          <List disablePadding>
            {/* 群主 */}
            {membersByRole.owners.map(renderMemberItem)}
            
            {/* 管理员 */}
            {membersByRole.admins.length > 0 && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ px: 2, py: 1 }}>
                  管理员 ({membersByRole.admins.length})
                </Typography>
                {membersByRole.admins.map(renderMemberItem)}
              </>
            )}
            
            {/* 普通成员 */}
            {membersByRole.members.length > 0 && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography variant="subtitle2" color="text.secondary" sx={{ px: 2, py: 1 }}>
                  成员 ({membersByRole.members.length})
                </Typography>
                {membersByRole.members.map(renderMemberItem)}
              </>
            )}
            
            {/* 查看全部成员 */}
            {members && members.length > 10 && (
              <ListItem button onClick={onShowMemberList}>
                <ListItemText
                  primary="查看全部成员"
                  sx={{ textAlign: 'center', color: 'primary.main' }}
                />
              </ListItem>
            )}
          </List>
        </CardContent>
      </Card>
      
      {/* 底部操作 */}
      <Box mt={3} mb={2}>
        <Grid container spacing={2}>
          {permissions.canManageSettings && (
            <Grid size={12}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={<SettingsIcon />}
                onClick={onShowSettings}
                disabled={actionLoading !== null}
              >
                群组设置
              </Button>
            </Grid>
          )}
          
          <Grid size={12}>
            <Button
              fullWidth
              variant="outlined"
              color="error"
              startIcon={<ExitToAppIcon />}
              onClick={handleLeaveGroup}
              disabled={actionLoading !== null}
            >
              退出群组
            </Button>
          </Grid>
        </Grid>
      </Box>
      
      {/* 对话框 */}
      {renderEditDialog()}
      {renderMemberMenu()}
    </Box>
  );
}