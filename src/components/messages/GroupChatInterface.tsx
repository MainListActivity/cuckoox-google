import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Divider,
  Badge,
  Chip,
  Fab,
  Slide,
  useTheme,
  useMediaQuery,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  MoreVert as MoreVertIcon,
  Search as SearchIcon,
  Call as CallIcon,
  VideoCall as VideoCallIcon,
  Info as InfoIcon,
  PushPin as PushPinIcon,
  VolumeOff as VolumeOffIcon,
  VolumeUp as VolumeUpIcon,
  Settings as SettingsIcon,
  PersonAdd as PersonAddIcon,
  ExitToApp as ExitToAppIcon,
  ExpandLess as ExpandLessIcon,
  ExpandMore as ExpandMoreIcon,
  CallEnd as CallEndIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
  Phone as PhoneIcon,
  PhoneDisabled as PhoneDisabledIcon
} from '@mui/icons-material';
import { RecordId } from 'surrealdb';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { useGroupDetails, useGroupOperations, useGroupPermissions, useGroupWebRTCPermissions } from '@/src/hooks/useGroupData';
import { messageService } from '@/src/services/messageService';
import callManager, { CallType, CallSession, CallParticipant, CallState } from '@/src/services/callManager';

interface GroupChatInterfaceProps {
  groupId: RecordId | string;
  onBack?: () => void;
  onShowGroupInfo?: () => void;
  onShowMemberList?: () => void;
  onShowSettings?: () => void;
  onLeaveGroup?: () => void;
  onInviteMembers?: () => void;
  compact?: boolean; // 移动端紧凑模式
}

export default function GroupChatInterface({
  groupId,
  onBack,
  onShowGroupInfo,
  onShowMemberList,
  onShowSettings,
  onLeaveGroup,
  onInviteMembers,
  compact = false
}: GroupChatInterfaceProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const { showSuccess, showError } = useSnackbar();
  
  // 群组数据
  const { group, members, isLoading, error, refetch } = useGroupDetails(groupId);
  const { leaveGroup } = useGroupOperations();
  const permissions = useGroupPermissions(groupId, user?.id);
  
  // 群组WebRTC权限检查
  const {
    canInitiateVoiceCall,
    canAnswerVoiceCall,
    canInitiateVideoCall,
    canAnswerVideoCall,
    canCreateGroupCall,
    canJoinGroupCall,
    canControlMicrophone,
    canControlCamera,
    canEndCall,
    canRejectCall,
    refetch: refetchWebRTCPermissions
  } = useGroupWebRTCPermissions(groupId, user?.id);
  
  // 本地状态
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [showPinnedMessages, setShowPinnedMessages] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState<{ id: string; content: string; sender_name: string; created_at: string }[]>([]);
  const [isGroupMuted, setIsGroupMuted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [onlineMembers] = useState<string[]>([]);
  const [connectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connected');
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  
  // 群组通话状态
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [callParticipants, setCallParticipants] = useState<CallParticipant[]>([]);
  const [incomingGroupCall, setIncomingGroupCall] = useState<{
    callId: string;
    fromUser: string;
    callType: CallType;
  } | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // 计算在线成员数量
  const onlineMemberCount = useMemo(() => {
    return onlineMembers.length;
  }, [onlineMembers]);
  
  // 加载置顶消息
  const loadPinnedMessages = useCallback(async () => {
    try {
      const pinned = await messageService.getGroupPinnedMessages(groupId);
      setPinnedMessages(pinned);
    } catch (error) {
      console.error('Error loading pinned messages:', error);
    }
  }, [groupId]);
  
  // 加载未读数量
  const loadUnreadCount = useCallback(async () => {
    try {
      const count = await messageService.getGroupUnreadCount(groupId);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  }, [groupId]);
  
  // 检查用户是否被静音
  const checkMuteStatus = useCallback(() => {
    if (members && user?.id) {
      const currentMember = members.find(m => String(m.user_id) === String(user.id));
      setIsGroupMuted(currentMember?.is_muted || false);
    }
  }, [members, user?.id]);
  
  // 初始化CallManager事件监听器
  useEffect(() => {
    if (!user?.id) return;
    
    // 设置当前用户ID
    callManager.setCurrentUserId(String(user.id));
    
    // 设置事件监听器
    callManager.setEventListeners({
      onCallStateChanged: (callId: string, state: CallState) => {
        // 通话状态变化处理
        if (state === 'ended' || state === 'failed' || state === 'rejected') {
          setActiveCall(null);
          setCallParticipants([]);
          setIncomingGroupCall(null);
        }
      },
      
      onCallStarted: (callId: string, callSession: CallSession) => {
        if (callSession.isGroup && String(callSession.groupId) === String(groupId)) {
          setActiveCall(callSession);
          setCallParticipants(Array.from(callSession.participants.values()));
        }
      },
      
      onParticipantJoined: (callId: string, participant: CallParticipant) => {
        const currentCall = callManager.getCallSession(callId);
        if (currentCall?.isGroup && String(currentCall.groupId) === String(groupId)) {
          setCallParticipants(Array.from(currentCall.participants.values()));
          setAlertMessage(`${participant.userName} 加入了通话`);
        }
      },
      
      onParticipantLeft: (callId: string, userId: string, reason?: string) => {
        const currentCall = callManager.getCallSession(callId);
        if (currentCall?.isGroup && String(currentCall.groupId) === String(groupId)) {
          setCallParticipants(Array.from(currentCall.participants.values()));
          setAlertMessage(`用户离开了通话${reason ? `: ${reason}` : ''}`);
        }
      },
      
      onGroupCallInvite: (callId: string, inviteGroupId: string, fromUser: string, metadata?: { callType?: CallType }) => {
        if (String(inviteGroupId) === String(groupId)) {
          setIncomingGroupCall({
            callId,
            fromUser,
            callType: metadata?.callType || 'audio'
          });
        }
      },
      
      onCallEnded: (callId: string, duration: number, reason?: string) => {
        setActiveCall(null);
        setCallParticipants([]);
        setIncomingGroupCall(null);
        if (reason) {
          setAlertMessage(`通话已结束: ${reason}`);
        }
      },
      
      onCallFailed: (callId: string, error: Error) => {
        setActiveCall(null);
        setCallParticipants([]);
        setIncomingGroupCall(null);
        showError(`通话失败: ${error.message}`);
      }
    });
    
    return () => {
      // 清理时移除监听器
      callManager.setEventListeners({});
    };
  }, [user?.id, groupId, showError]);
  
  // 初始化
  useEffect(() => {
    if (group) {
      loadPinnedMessages();
      loadUnreadCount();
      checkMuteStatus();
    }
  }, [group, loadPinnedMessages, loadUnreadCount, checkMuteStatus]);

  // 初始化WebRTC权限
  useEffect(() => {
    refetchWebRTCPermissions();
  }, [refetchWebRTCPermissions]);
  
  // 处理菜单
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMenuAnchorEl(event.currentTarget);
  };
  
  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };
  
  // 处理群组操作
  const handleLeaveGroup = useCallback(async () => {
    if (!window.confirm('确定要退出此群组吗？')) return;
    
    try {
      setLoadingAction('leaving');
      await leaveGroup(groupId);
      showSuccess('已退出群组');
      onLeaveGroup?.();
    } catch (error) {
      showError(`退出群组失败: ${(error as Error).message}`);
    } finally {
      setLoadingAction(null);
    }
  }, [groupId, leaveGroup, showSuccess, showError, onLeaveGroup]);
  
  const handleToggleMute = useCallback(async () => {
    try {
      setLoadingAction('muting');
      // TODO: 实现静音/取消静音功能
      setIsGroupMuted(!isGroupMuted);
      showSuccess(isGroupMuted ? '已取消群组静音' : '已静音群组');
    } catch (error) {
      showError(`操作失败: ${(error as Error).message}`);
    } finally {
      setLoadingAction(null);
    }
  }, [isGroupMuted, showSuccess, showError]);
  
  const handleMarkAsRead = useCallback(async () => {
    try {
      await messageService.markGroupMessagesAsRead({
        group_id: groupId,
        read_up_to_time: new Date().toISOString()
      });
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [groupId]);
  
  // 群组通话处理函数
  const handleStartGroupCall = useCallback(async (callType: CallType) => {
    // 检查群组消息权限
    if (!permissions.canSendMessage) {
      showError('您没有权限发起群组通话');
      return;
    }

    // 检查WebRTC权限
    if (!canCreateGroupCall) {
      showError('没有创建群组通话权限');
      return;
    }

    if (callType === 'audio' && !canInitiateVoiceCall) {
      showError('没有发起语音通话权限');
      return;
    }

    if (callType === 'video' && !canInitiateVideoCall) {
      showError('没有发起视频通话权限');
      return;
    }
    
    if (activeCall) {
      showError('已有活跃通话正在进行');
      return;
    }
    
    try {
      setLoadingAction('starting-call');
      
      // 发起群组通话
      await callManager.initiateGroupCall(
        String(groupId),
        callType,
        {
          groupName: group?.name,
          initiatedBy: user?.name || user?.id
        }
      );
      
      showSuccess(`${callType === 'video' ? '视频' : '语音'}通话已发起`);
      setAlertMessage('等待其他成员加入通话...');
      
    } catch (error) {
      showError(`发起通话失败: ${(error as Error).message}`);
    } finally {
      setLoadingAction(null);
    }
  }, [groupId, activeCall, permissions.canSendMessage, group?.name, user, showSuccess, showError, canInitiateVoiceCall, canInitiateVideoCall, canCreateGroupCall]);
  
  const handleAcceptGroupCall = useCallback(async () => {
    if (!incomingGroupCall) return;

    // 检查WebRTC接听权限
    if (!canAnswerVoiceCall && !canAnswerVideoCall) {
      showError('没有接听通话权限');
      setIncomingGroupCall(null);
      return;
    }

    // 检查群组通话加入权限
    if (!canJoinGroupCall) {
      showError('没有加入群组通话权限');
      setIncomingGroupCall(null);
      return;
    }
    
    try {
      setLoadingAction('accepting-call');
      
      // 加入群组通话
      await callManager.joinConference(incomingGroupCall.callId, 'participant');
      
      setIncomingGroupCall(null);
      showSuccess('已加入群组通话');
      
    } catch (error) {
      showError(`加入通话失败: ${(error as Error).message}`);
      setIncomingGroupCall(null);
    } finally {
      setLoadingAction(null);
    }
  }, [incomingGroupCall, showSuccess, showError, canAnswerVoiceCall, canAnswerVideoCall, canJoinGroupCall]);
  
  const handleRejectGroupCall = useCallback(async () => {
    if (!incomingGroupCall) return;

    // 检查WebRTC拒绝权限
    if (!canRejectCall) {
      showError('没有拒绝通话权限');
      setIncomingGroupCall(null);
      return;
    }
    
    try {
      // 拒绝群组通话
      // 由于CallManager没有直接的拒绝群组通话方法，我们直接清除邀请状态
      setIncomingGroupCall(null);
      setAlertMessage('已拒绝群组通话邀请');
      
    } catch (error) {
      showError(`拒绝通话失败: ${(error as Error).message}`);
    }
  }, [incomingGroupCall, showError, canRejectCall]);
  
  const handleEndGroupCall = useCallback(async () => {
    if (!activeCall) return;

    // 检查WebRTC结束通话权限
    if (!canEndCall) {
      showError('没有结束通话权限');
      return;
    }
    
    try {
      setLoadingAction('ending-call');
      
      if (activeCall.isGroup) {
        // 离开会议
        await callManager.leaveConference(activeCall.callId, '主动离开');
      } else {
        // 结束通话
        await callManager.endCall(activeCall.callId, '主动结束');
      }
      
      showSuccess('已结束通话');
      
    } catch (error) {
      showError(`结束通话失败: ${(error as Error).message}`);
    } finally {
      setLoadingAction(null);
    }
  }, [activeCall, showSuccess, showError, canEndCall]);
  
  const handleToggleCallMute = useCallback(() => {
    if (!activeCall) return;

    // 检查麦克风控制权限
    if (!canControlMicrophone) {
      showError('没有麦克风控制权限');
      return;
    }
    
    try {
      const isMuted = callManager.toggleMute(activeCall.callId);
      setAlertMessage(isMuted ? '已静音' : '已取消静音');
    } catch (error) {
      showError(`切换静音失败: ${(error as Error).message}`);
    }
  }, [activeCall, showError, canControlMicrophone]);
  
  const handleToggleCallCamera = useCallback(() => {
    if (!activeCall || activeCall.callType === 'audio') return;

    // 检查摄像头控制权限
    if (!canControlCamera) {
      showError('没有摄像头控制权限');
      return;
    }
    
    try {
      const isCameraOff = callManager.toggleCamera(activeCall.callId);
      setAlertMessage(isCameraOff ? '摄像头已关闭' : '摄像头已开启');
    } catch (error) {
      showError(`切换摄像头失败: ${(error as Error).message}`);
    }
  }, [activeCall, showError, canControlCamera]);
  
  // 获取群组状态信息
  const getGroupStatusText = useCallback(() => {
    if (!group || !members) return '';
    
    const memberCount = members.length;
    const onlineCount = onlineMemberCount;
    
    if (onlineCount > 0) {
      return `${memberCount} 名成员，${onlineCount} 人在线`;
    }
    return `${memberCount} 名成员`;
  }, [group, members, onlineMemberCount]);
  
  
  // 渲染群组头部
  const renderGroupHeader = () => (
    <Paper
      elevation={1}
      sx={{
        p: 2,
        borderRadius: 0,
        borderBottom: `1px solid ${theme.palette.divider}`,
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        bgcolor: 'background.paper'
      }}
    >
      <Box display="flex" alignItems="center" gap={1}>
        {/* 返回按钮 (移动端) */}
        {(isMobile || compact) && onBack && (
          <IconButton onClick={onBack} size="small">
            <ArrowBackIcon />
          </IconButton>
        )}
        
        {/* 群组头像和信息 */}
        <Box 
          flex={1} 
          display="flex" 
          alignItems="center" 
          gap={2}
          sx={{ cursor: 'pointer' }}
          onClick={onShowGroupInfo}
        >
          <Box
            sx={{
              width: isMobile ? 40 : 48,
              height: isMobile ? 40 : 48,
              borderRadius: '12px',
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'primary.contrastText',
              fontSize: isMobile ? '1rem' : '1.2rem',
              fontWeight: 'bold',
              position: 'relative'
            }}
          >
            {group?.avatar_url ? (
              <img 
                src={group.avatar_url} 
                alt={group.name}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  borderRadius: '12px',
                  objectFit: 'cover'
                }}
              />
            ) : (
              group?.name?.charAt(0)?.toUpperCase() || 'G'
            )}
            
            {/* 群组类型指示器 */}
            {group?.type === 'case_related' && (
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  bgcolor: 'warning.main',
                  border: '2px solid',
                  borderColor: 'background.paper'
                }}
              />
            )}
          </Box>
          
          <Box flex={1} minWidth={0}>
            <Typography 
              variant={isMobile ? "subtitle1" : "h6"}
              fontWeight={600}
              sx={{ 
                mb: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}
            >
              {group?.name}
              {isGroupMuted && (
                <VolumeOffIcon 
                  fontSize="small" 
                  color="action"
                  sx={{ opacity: 0.6 }}
                />
              )}
              {unreadCount > 0 && (
                <Badge 
                  badgeContent={unreadCount} 
                  color="primary"
                  max={99}
                />
              )}
            </Typography>
            
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ 
                display: 'block',
                lineHeight: 1.2
              }}
            >
              {getGroupStatusText()}
            </Typography>
            
            {/* 连接状态指示器 */}
            {connectionStatus !== 'connected' && (
              <Chip
                size="small"
                label={connectionStatus === 'connecting' ? '连接中...' : '已断线'}
                color={connectionStatus === 'connecting' ? 'warning' : 'error'}
                variant="outlined"
                sx={{ mt: 0.5, fontSize: '0.7rem', height: 20 }}
              />
            )}
          </Box>
        </Box>
        
        {/* 操作按钮 */}
        <Box display="flex" alignItems="center">
          {/* 通话按钮 */}
          {permissions.canSendMessage && (
            <>
              {/* 语音通话按钮 */}
              {!isMobile && canInitiateVoiceCall && canCreateGroupCall && (
                <Tooltip title="语音通话">
                  <IconButton
                    onClick={() => handleStartGroupCall('audio')}
                    disabled={loadingAction !== null || Boolean(activeCall)}
                  >
                    <CallIcon />
                  </IconButton>
                </Tooltip>
              )}
              
              {/* 视频通话按钮 */}
              {canInitiateVideoCall && canCreateGroupCall && (
                <Tooltip title="视频通话">
                  <IconButton
                    onClick={() => handleStartGroupCall('video')}
                    disabled={loadingAction !== null || Boolean(activeCall)}
                  >
                    <VideoCallIcon />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
          
          {/* 搜索按钮 */}
          {!isMobile && (
            <Tooltip title="搜索消息">
              <IconButton>
                <SearchIcon />
              </IconButton>
            </Tooltip>
          )}
          
          {/* 更多菜单 */}
          <Tooltip title="更多选项">
            <IconButton
              onClick={handleMenuOpen}
              disabled={loadingAction !== null}
            >
              <MoreVertIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* 置顶消息区域 */}
      {pinnedMessages.length > 0 && (
        <Slide direction="down" in={showPinnedMessages}>
          <Box 
            sx={{ 
              mt: 2, 
              p: 1.5,
              bgcolor: 'action.hover',
              borderRadius: 1,
              border: `1px solid ${theme.palette.divider}`
            }}
          >
            <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
              <Typography variant="caption" color="primary" fontWeight={600}>
                📌 置顶消息 ({pinnedMessages.length})
              </Typography>
              <IconButton 
                size="small"
                onClick={() => setShowPinnedMessages(!showPinnedMessages)}
              >
                {showPinnedMessages ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>
            
            {showPinnedMessages && pinnedMessages.slice(0, 3).map((message, index) => (
              <Box key={message.id} sx={{ mb: index < 2 ? 1 : 0 }}>
                <Typography variant="body2" sx={{ 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical'
                }}>
                  {message.content}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {message.sender_name} · {new Date(message.created_at).toLocaleDateString()}
                </Typography>
              </Box>
            ))}
          </Box>
        </Slide>
      )}
    </Paper>
  );
  
  // 渲染更多菜单
  const renderMoreMenu = () => (
    <Menu
      anchorEl={menuAnchorEl}
      open={Boolean(menuAnchorEl)}
      onClose={handleMenuClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
      <MenuItem onClick={() => { onShowGroupInfo?.(); handleMenuClose(); }}>
        <ListItemIcon><InfoIcon fontSize="small" /></ListItemIcon>
        <ListItemText>群组信息</ListItemText>
      </MenuItem>
      
      <MenuItem onClick={() => { onShowMemberList?.(); handleMenuClose(); }}>
        <ListItemIcon><PersonAddIcon fontSize="small" /></ListItemIcon>
        <ListItemText>成员列表</ListItemText>
      </MenuItem>
      
      {permissions.canAddMember && (
        <MenuItem onClick={() => { onInviteMembers?.(); handleMenuClose(); }}>
          <ListItemIcon><PersonAddIcon fontSize="small" /></ListItemIcon>
          <ListItemText>邀请成员</ListItemText>
        </MenuItem>
      )}
      
      <Divider />
      
      <MenuItem onClick={() => { setShowPinnedMessages(!showPinnedMessages); handleMenuClose(); }}>
        <ListItemIcon><PushPinIcon fontSize="small" /></ListItemIcon>
        <ListItemText>
          {showPinnedMessages ? '隐藏置顶消息' : '显示置顶消息'}
        </ListItemText>
      </MenuItem>
      
      <MenuItem onClick={() => { handleToggleMute(); handleMenuClose(); }}>
        <ListItemIcon>
          {isGroupMuted ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
        </ListItemIcon>
        <ListItemText>
          {isGroupMuted ? '取消静音' : '静音群组'}
        </ListItemText>
      </MenuItem>
      
      {permissions.canManageSettings && (
        <>
          <Divider />
          <MenuItem onClick={() => { onShowSettings?.(); handleMenuClose(); }}>
            <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
            <ListItemText>群组设置</ListItemText>
          </MenuItem>
        </>
      )}
      
      <Divider />
      
      <MenuItem 
        onClick={() => { handleLeaveGroup(); handleMenuClose(); }}
        sx={{ color: 'error.main' }}
      >
        <ListItemIcon sx={{ color: 'inherit' }}>
          <ExitToAppIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>退出群组</ListItemText>
      </MenuItem>
    </Menu>
  );
  
  if (isLoading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        height="100%"
        minHeight="400px"
      >
        <Typography>加载中...</Typography>
      </Box>
    );
  }
  
  if (error || !group) {
    return (
      <Box 
        display="flex" 
        flex-direction="column"
        justifyContent="center" 
        alignItems="center" 
        height="100%"
        minHeight="400px"
        gap={2}
      >
        <Typography color="error">
          {error?.message || '群组不存在'}
        </Typography>
        <button onClick={refetch}>重试</button>
      </Box>
    );
  }
  
  return (
    <Box 
      display="flex" 
      flexDirection="column" 
      height="100%"
      sx={{ 
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* 群组头部 */}
      {renderGroupHeader()}
      
      {/* 消息区域 */}
      <Box 
        flex={1}
        sx={{
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* TODO: 这里会集成消息列表组件 */}
        <Box 
          flex={1}
          sx={{
            p: 2,
            overflowY: 'auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Typography color="text.secondary">
            消息列表组件将在下一个任务中集成
          </Typography>
        </Box>
        
        {/* 消息结束锚点 */}
        <div ref={messagesEndRef} />
      </Box>
      
      {/* 输入区域 */}
      <Box
        sx={{
          borderTop: `1px solid ${theme.palette.divider}`,
          bgcolor: 'background.paper'
        }}
      >
        {/* TODO: 这里会集成ChatInput组件 */}
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography color="text.secondary">
            聊天输入组件将在任务8.1中实现
          </Typography>
        </Box>
      </Box>
      
      {/* 更多菜单 */}
      {renderMoreMenu()}
      
      {/* 群组通话邀请对话框 */}
      {incomingGroupCall && (
        <Dialog
          open={Boolean(incomingGroupCall)}
          onClose={handleRejectGroupCall}
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" alignItems="center" gap={2}>
              {incomingGroupCall.callType === 'video' ? <VideoCallIcon /> : <CallIcon />}
              <Typography variant="h6">
                群组{incomingGroupCall.callType === 'video' ? '视频' : '语音'}通话邀请
              </Typography>
            </Box>
          </DialogTitle>
          <DialogContent>
            <Typography variant="body1" gutterBottom>
              {incomingGroupCall.fromUser} 邀请您加入群组{incomingGroupCall.callType === 'video' ? '视频' : '语音'}通话
            </Typography>
            <Typography variant="body2" color="text.secondary">
              群组: {group?.name}
            </Typography>
          </DialogContent>
          <DialogActions>
            {canRejectCall.hasPermission && (
              <Button
                onClick={handleRejectGroupCall}
                startIcon={<PhoneDisabledIcon />}
                disabled={loadingAction !== null || !canRejectCall.hasPermission}
                sx={{ opacity: canRejectCall.hasPermission ? 1 : 0.5 }}
              >
                拒绝
              </Button>
            )}
            {canAnswerCall.hasPermission && canJoinGroupCall.hasPermission && (
              <Button
                onClick={handleAcceptGroupCall}
                variant="contained"
                startIcon={<PhoneIcon />}
                disabled={loadingAction !== null || !canAnswerCall.hasPermission || !canJoinGroupCall.hasPermission}
                color="success"
                sx={{ opacity: (canAnswerCall.hasPermission && canJoinGroupCall.hasPermission) ? 1 : 0.5 }}
              >
                接听
              </Button>
            )}
          </DialogActions>
        </Dialog>
      )}
      
      {/* 活跃群组通话控制栏 */}
      {activeCall && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            top: isMobile ? 60 : 80,
            left: 8,
            right: 8,
            p: 2,
            zIndex: 1001,
            backgroundColor: 'success.main',
            color: 'success.contrastText',
            borderRadius: 2
          }}
        >
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center" gap={2}>
              {activeCall.callType === 'video' ? <VideocamIcon /> : <CallIcon />}
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  群组{activeCall.callType === 'video' ? '视频' : '语音'}通话进行中
                </Typography>
                <Typography variant="caption">
                  {callParticipants.length} 名参与者
                </Typography>
              </Box>
            </Box>
            
            <Box display="flex" alignItems="center" gap={1}>
              {/* 静音控制 */}
              {canControlMicrophone && (
                <Tooltip title={
                  canControlMicrophone
                    ? (activeCall.localParticipant.mediaState.micMuted ? '取消静音' : '静音')
                    : '没有麦克风控制权限'
                }>
                  <IconButton
                    size="small"
                    onClick={handleToggleCallMute}
                    disabled={!canControlMicrophone}
                    sx={{ 
                      color: 'inherit',
                      opacity: canControlMicrophone ? 1 : 0.5
                    }}
                  >
                    {activeCall.localParticipant.mediaState.micMuted ? <MicOffIcon /> : <MicIcon />}
                  </IconButton>
                </Tooltip>
              )}
              
              {/* 摄像头控制 */}
              {activeCall.callType === 'video' && canControlCamera && (
                <Tooltip title={
                  canControlCamera
                    ? (activeCall.localParticipant.mediaState.cameraOff ? '开启摄像头' : '关闭摄像头')
                    : '没有摄像头控制权限'
                }>
                  <IconButton
                    size="small"
                    onClick={handleToggleCallCamera}
                    disabled={!canControlCamera}
                    sx={{ 
                      color: 'inherit',
                      opacity: canControlCamera ? 1 : 0.5
                    }}
                  >
                    {activeCall.localParticipant.mediaState.cameraOff ? <VideocamOffIcon /> : <VideocamIcon />}
                  </IconButton>
                </Tooltip>
              )}
              
              {/* 结束通话 */}
              {canEndCall.hasPermission && (
                <Tooltip title={
                  canEndCall.hasPermission ? '结束通话' : '没有结束通话权限'
                }>
                  <IconButton
                    size="small"
                    onClick={handleEndGroupCall}
                    disabled={loadingAction === 'ending-call' || !canEndCall.hasPermission}
                    sx={{ 
                      color: 'error.main',
                      bgcolor: 'background.paper',
                      opacity: canEndCall.hasPermission ? 1 : 0.5,
                      '&:hover': { bgcolor: 'error.light' }
                    }}
                  >
                    <CallEndIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>
        </Paper>
      )}
      
      {/* 提示消息 */}
      <Snackbar
        open={Boolean(alertMessage)}
        autoHideDuration={3000}
        onClose={() => setAlertMessage(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="info" onClose={() => setAlertMessage(null)}>
          {alertMessage}
        </Alert>
      </Snackbar>
      
      {/* 未读消息浮动按钮 */}
      {unreadCount > 0 && !activeCall && (
        <Fab
          size="small"
          color="primary"
          onClick={handleMarkAsRead}
          sx={{
            position: 'absolute',
            bottom: 80,
            right: 16,
            zIndex: 1000
          }}
        >
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <ExpandMoreIcon />
          </Badge>
        </Fab>
      )}
    </Box>
  );
}