import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Button,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Badge,
  TextField,
  InputAdornment,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Divider,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
  Select,
  Skeleton,
  Alert,
  Tooltip,
  useTheme,
  useMediaQuery
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Search as SearchIcon,
  PersonAdd as PersonAddIcon,
  MoreVert as MoreVertIcon,
  AdminPanelSettings as AdminIcon,
  Security as SecurityIcon,
  Person as PersonIcon,
  Visibility as VisibilityIcon,
  Message as MessageIcon,
  Call as CallIcon,
  VideoCall as VideoCallIcon,
  Block as BlockIcon,
  Remove as RemoveIcon,
  Crown as CrownIcon,
  FilterList as FilterListIcon,
  Sort as SortIcon,
  Online as OnlineIcon,
  Offline as OfflineIcon
} from '@mui/icons-material';
import { RecordId } from 'surrealdb';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { useGroupDetails, useGroupOperations, useGroupPermissions } from '@/src/hooks/useGroupData';
import type { ExtendedGroupMember, GroupMemberRole } from '@/src/types/group';

interface GroupMemberListProps {
  groupId: RecordId | string;
  onBack?: () => void;
  onInviteMembers?: () => void;
  onStartDirectMessage?: (userId: RecordId | string) => void;
  onStartCall?: (userId: RecordId | string, type: 'audio' | 'video') => void;
}

type MemberFilter = 'all' | 'online' | 'offline' | 'owners' | 'admins' | 'members';
type SortBy = 'name' | 'role' | 'joinDate' | 'lastActive';

export default function GroupMemberList({
  groupId,
  onBack,
  onInviteMembers,
  onStartDirectMessage,
  onStartCall
}: GroupMemberListProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  
  // 群组数据
  const { group, members, isLoading, error, refetch } = useGroupDetails(groupId);
  const { removeMember, updateMemberRole, transferOwnership } = useGroupOperations();
  const permissions = useGroupPermissions(groupId, user?.id);
  
  // 本地状态
  const [searchQuery, setSearchQuery] = useState('');
  const [memberFilter, setMemberFilter] = useState<MemberFilter>('all');
  const [sortBy, setSortBy] = useState<SortBy>('role');
  const [memberMenuAnchor, setMemberMenuAnchor] = useState<{ element: HTMLElement; member: ExtendedGroupMember } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    content: string;
    action: () => void;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  
  // 过滤和排序成员
  const filteredAndSortedMembers = useMemo(() => {
    if (!members) return [];
    
    let filtered = members;
    
    // 应用搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(member => 
        member.user_name?.toLowerCase().includes(query) ||
        member.user_email?.toLowerCase().includes(query) ||
        member.nickname?.toLowerCase().includes(query)
      );
    }
    
    // 应用角色/状态过滤
    switch (memberFilter) {
      case 'online':
        filtered = filtered.filter(member => member.is_online);
        break;
      case 'offline':
        filtered = filtered.filter(member => !member.is_online);
        break;
      case 'owners':
        filtered = filtered.filter(member => member.role === 'owner');
        break;
      case 'admins':
        filtered = filtered.filter(member => member.role === 'admin');
        break;
      case 'members':
        filtered = filtered.filter(member => member.role === 'member');
        break;
    }
    
    // 应用排序
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.user_name || '').localeCompare(b.user_name || '');
        case 'role':
          const roleOrder = { owner: 0, admin: 1, member: 2 };
          return roleOrder[a.role] - roleOrder[b.role];
        case 'joinDate':
          return new Date(b.joined_at).getTime() - new Date(a.joined_at).getTime();
        case 'lastActive':
          if (a.is_online && !b.is_online) return -1;
          if (!a.is_online && b.is_online) return 1;
          return 0;
        default:
          return 0;
      }
    });
    
    return filtered;
  }, [members, searchQuery, memberFilter, sortBy]);
  
  // 按角色分组统计
  const memberStats = useMemo(() => {
    if (!members) return { total: 0, online: 0, owners: 0, admins: 0, members: 0 };
    
    return {
      total: members.length,
      online: members.filter(m => m.is_online).length,
      owners: members.filter(m => m.role === 'owner').length,
      admins: members.filter(m => m.role === 'admin').length,
      members: members.filter(m => m.role === 'member').length
    };
  }, [members]);
  
  // 处理成员操作
  const handleMemberAction = useCallback(async (action: string, member: ExtendedGroupMember) => {
    const actions = {
      'makeAdmin': async () => {
        await updateMemberRole(groupId, member.user_id, 'admin');
        showSuccess(`${member.user_name} 已设为管理员`);
      },
      'removeAdmin': async () => {
        await updateMemberRole(groupId, member.user_id, 'member');
        showSuccess(`已取消 ${member.user_name} 的管理员权限`);
      },
      'transferOwner': async () => {
        await transferOwnership(groupId, member.user_id);
        showSuccess(`群主已转让给 ${member.user_name}`);
      },
      'removeMember': async () => {
        await removeMember(groupId, member.user_id);
        showSuccess(`${member.user_name} 已被移除`);
      }
    };
    
    if (!actions[action as keyof typeof actions]) return;
    
    try {
      setActionLoading(action);
      await actions[action as keyof typeof actions]();
      refetch();
    } catch (error) {
      showError(`操作失败: ${(error as Error).message}`);
    } finally {
      setActionLoading(null);
      setMemberMenuAnchor(null);
      setConfirmDialog(null);
    }
  }, [groupId, updateMemberRole, transferOwnership, removeMember, showSuccess, showError, refetch]);
  
  // 获取角色显示信息
  const getRoleInfo = (role: GroupMemberRole) => {
    switch (role) {
      case 'owner':
        return { 
          label: '群主', 
          icon: <CrownIcon fontSize="small" />, 
          color: 'warning' as const 
        };
      case 'admin':
        return { 
          label: '管理员', 
          icon: <SecurityIcon fontSize="small" />, 
          color: 'info' as const 
        };
      default:
        return { 
          label: '成员', 
          icon: <PersonIcon fontSize="small" />, 
          color: 'default' as const 
        };
    }
  };
  
  // 检查是否可以管理某个成员
  const canManageMember = useCallback((member: ExtendedGroupMember) => {
    if (String(member.user_id) === String(user?.id)) return false; // 不能管理自己
    
    if (permissions.isOwner) {
      return true; // 群主可以管理所有人
    }
    
    if (permissions.isAdmin && member.role === 'member') {
      return true; // 管理员可以管理普通成员
    }
    
    return false;
  }, [permissions, user?.id]);
  
  // 渲染成员项
  const renderMemberItem = (member: ExtendedGroupMember) => {
    const roleInfo = getRoleInfo(member.role);
    const isCurrentUser = String(member.user_id) === String(user?.id);
    const canManage = canManageMember(member);
    
    return (
      <ListItem key={member.id} divider>
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
              sx={{ width: 48, height: 48 }}
            >
              {member.user_name?.charAt(0)?.toUpperCase()}
            </Avatar>
          </Badge>
        </ListItemAvatar>
        
        <ListItemText
          primary={
            <Box display="flex" alignItems="center" gap={1} mb={0.5}>
              <Typography variant="body1" fontWeight={isCurrentUser ? 600 : 400}>
                {member.user_name}
                {isCurrentUser && ' (您)'}
              </Typography>
              {roleInfo.icon}
              <Chip
                size="small"
                label={roleInfo.label}
                color={roleInfo.color}
                variant="outlined"
              />
            </Box>
          }
          secondary={
            <Box>
              {member.nickname && (
                <Typography variant="caption" color="text.secondary" display="block">
                  群昵称: {member.nickname}
                </Typography>
              )}
              {member.user_email && (
                <Typography variant="caption" color="text.secondary" display="block">
                  {member.user_email}
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary" display="block">
                加入时间: {new Date(member.joined_at).toLocaleDateString()}
              </Typography>
              <Box display="flex" alignItems="center" gap={0.5} mt={0.5}>
                {member.is_online ? (
                  <>
                    <OnlineIcon fontSize="small" color="success" />
                    <Typography variant="caption" color="success.main">在线</Typography>
                  </>
                ) : (
                  <>
                    <OfflineIcon fontSize="small" color="action" />
                    <Typography variant="caption" color="text.secondary">离线</Typography>
                  </>
                )}
              </Box>
            </Box>
          }
        />
        
        <ListItemSecondaryAction>
          <Box display="flex" alignItems="center" gap={1}>
            {/* 操作按钮 */}
            {!isCurrentUser && (
              <>
                <Tooltip title="发起私聊">
                  <IconButton
                    size="small"
                    onClick={() => onStartDirectMessage?.(member.user_id)}
                  >
                    <MessageIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                
                {!isMobile && (
                  <>
                    <Tooltip title="语音通话">
                      <IconButton
                        size="small"
                        onClick={() => onStartCall?.(member.user_id, 'audio')}
                      >
                        <CallIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    
                    <Tooltip title="视频通话">
                      <IconButton
                        size="small"
                        onClick={() => onStartCall?.(member.user_id, 'video')}
                      >
                        <VideoCallIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </>
            )}
            
            {/* 管理菜单 */}
            {canManage && (
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
  
  // 渲染成员管理菜单
  const renderMemberMenu = () => {
    if (!memberMenuAnchor) return null;
    
    const { member } = memberMenuAnchor;
    
    return (
      <Menu
        anchorEl={memberMenuAnchor.element}
        open={Boolean(memberMenuAnchor)}
        onClose={() => setMemberMenuAnchor(null)}
      >
        {/* 设为管理员 */}
        {member.role === 'member' && permissions.canRemoveMember && (
          <MenuItem
            onClick={() => {
              setConfirmDialog({
                open: true,
                title: '设为管理员',
                content: `确定要将 ${member.user_name} 设为管理员吗？`,
                action: () => handleMemberAction('makeAdmin', member)
              });
            }}
          >
            <AdminIcon fontSize="small" sx={{ mr: 1 }} />
            设为管理员
          </MenuItem>
        )}
        
        {/* 取消管理员 */}
        {member.role === 'admin' && permissions.isOwner && (
          <MenuItem
            onClick={() => {
              setConfirmDialog({
                open: true,
                title: '取消管理员',
                content: `确定要取消 ${member.user_name} 的管理员权限吗？`,
                action: () => handleMemberAction('removeAdmin', member)
              });
            }}
          >
            <PersonIcon fontSize="small" sx={{ mr: 1 }} />
            取消管理员
          </MenuItem>
        )}
        
        {/* 转让群主 */}
        {permissions.isOwner && member.role !== 'owner' && (
          <MenuItem
            onClick={() => {
              setConfirmDialog({
                open: true,
                title: '转让群主',
                content: `确定要将群主转让给 ${member.user_name} 吗？此操作不可撤销。`,
                action: () => handleMemberAction('transferOwner', member)
              });
            }}
          >
            <CrownIcon fontSize="small" sx={{ mr: 1 }} />
            转让群主
          </MenuItem>
        )}
        
        <Divider />
        
        {/* 移除成员 */}
        {permissions.canRemoveMember && (
          <MenuItem
            onClick={() => {
              setConfirmDialog({
                open: true,
                title: '移除成员',
                content: `确定要将 ${member.user_name} 移除出群组吗？`,
                action: () => handleMemberAction('removeMember', member)
              });
            }}
            sx={{ color: 'error.main' }}
          >
            <RemoveIcon fontSize="small" sx={{ mr: 1 }} />
            移除成员
          </MenuItem>
        )}
      </Menu>
    );
  };
  
  // 渲染确认对话框
  const renderConfirmDialog = () => (
    <Dialog
      open={confirmDialog?.open || false}
      onClose={() => setConfirmDialog(null)}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{confirmDialog?.title}</DialogTitle>
      <DialogContent>
        <Typography>{confirmDialog?.content}</Typography>
      </DialogContent>
      <DialogActions>
        <Button 
          onClick={() => setConfirmDialog(null)}
          disabled={actionLoading !== null}
        >
          取消
        </Button>
        <Button
          onClick={confirmDialog?.action}
          variant="contained"
          color="primary"
          disabled={actionLoading !== null}
        >
          确定
        </Button>
      </DialogActions>
    </Dialog>
  );
  
  if (isLoading) {
    return (
      <Box p={3}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} variant="rectangular" height={80} sx={{ mb: 1 }} />
        ))}
      </Box>
    );
  }
  
  if (error || !group || !members) {
    return (
      <Box p={3} textAlign="center">
        <Typography color="error" gutterBottom>
          {error?.message || '成员列表加载失败'}
        </Typography>
        <Button onClick={refetch}>重试</Button>
      </Box>
    );
  }
  
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
          
          <Box flex={1}>
            <Typography variant="h6">
              {group.name} - 成员列表
            </Typography>
            <Typography variant="body2" color="text.secondary">
              共 {memberStats.total} 名成员，{memberStats.online} 人在线
            </Typography>
          </Box>
          
          {permissions.canAddMember && (
            <Button
              startIcon={<PersonAddIcon />}
              onClick={onInviteMembers}
              variant="contained"
            >
              邀请成员
            </Button>
          )}
        </Box>
        
        {/* 统计卡片 */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="h6" color="primary">
                  {memberStats.total}
                </Typography>
                <Typography variant="caption">总成员</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="h6" color="success.main">
                  {memberStats.online}
                </Typography>
                <Typography variant="caption">在线</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="h6" color="warning.main">
                  {memberStats.owners + memberStats.admins}
                </Typography>
                <Typography variant="caption">管理</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={3}>
            <Card variant="outlined">
              <CardContent sx={{ textAlign: 'center', py: 1 }}>
                <Typography variant="h6">
                  {memberStats.members}
                </Typography>
                <Typography variant="caption">成员</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
        
        {/* 搜索和过滤 */}
        <Box display="flex" gap={2} mb={2}>
          <TextField
            placeholder="搜索成员..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ flex: 1 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              )
            }}
          />
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>筛选</InputLabel>
            <Select
              value={memberFilter}
              label="筛选"
              onChange={(e) => setMemberFilter(e.target.value as MemberFilter)}
            >
              <MenuItem value="all">全部</MenuItem>
              <MenuItem value="online">在线</MenuItem>
              <MenuItem value="offline">离线</MenuItem>
              <MenuItem value="owners">群主</MenuItem>
              <MenuItem value="admins">管理员</MenuItem>
              <MenuItem value="members">成员</MenuItem>
            </Select>
          </FormControl>
          
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>排序</InputLabel>
            <Select
              value={sortBy}
              label="排序"
              onChange={(e) => setSortBy(e.target.value as SortBy)}
            >
              <MenuItem value="role">按角色</MenuItem>
              <MenuItem value="name">按姓名</MenuItem>
              <MenuItem value="joinDate">按加入时间</MenuItem>
              <MenuItem value="lastActive">按活跃状态</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>
      
      {/* 成员列表 */}
      <Paper elevation={1}>
        {filteredAndSortedMembers.length === 0 ? (
          <Box p={3} textAlign="center">
            <Typography color="text.secondary">
              {searchQuery ? '没有找到匹配的成员' : '暂无成员'}
            </Typography>
          </Box>
        ) : (
          <List disablePadding>
            {filteredAndSortedMembers.map(renderMemberItem)}
          </List>
        )}
      </Paper>
      
      {/* 菜单和对话框 */}
      {renderMemberMenu()}
      {renderConfirmDialog()}
    </Box>
  );
}