import React, { useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  Chip,
  Avatar,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  VideoCall as VideoCallIcon,
  Call as CallIcon,
  AccessTime as AccessTimeIcon,
  People as PeopleIcon,
  Person as PersonIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Schedule as ScheduleIcon,
  EventNote as EventNoteIcon,
  Settings as SettingsIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import type { ConferenceInviteMessage } from '@/src/types/message';
import { messageService } from '@/src/services/messageService';
import callManager from '@/src/services/callManager';

// 组件属性接口
export interface ConferenceInviteCardProps {
  message: ConferenceInviteMessage;
  onResponse?: (response: 'accepted' | 'declined', responseMessage?: string) => void;
  onJoinMeeting?: (conferenceId: string) => void;
  onError?: (error: Error) => void;
  isCurrentUser?: boolean; // 是否是当前用户发送的邀请
  showActions?: boolean; // 是否显示操作按钮
  compact?: boolean; // 紧凑模式
}

/**
 * ConferenceInviteCard - 会议邀请卡片组件
 * 显示会议邀请信息并提供接受/拒绝操作
 */
const ConferenceInviteCard: React.FC<ConferenceInviteCardProps> = ({
  message,
  onResponse,
  onJoinMeeting,
  onError,
  isCurrentUser = false,
  showActions = true,
  compact = false
}) => {
  const theme = useTheme();
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showResponseDialog, setShowResponseDialog] = useState<boolean>(false);
  const [responseType, setResponseType] = useState<'accepted' | 'declined'>('accepted');
  const [responseMessage, setResponseMessage] = useState<string>('');
  const [showDetails, setShowDetails] = useState<boolean>(false);

  /**
   * 格式化时间显示
   */
  const formatDateTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (Math.abs(diffHours) < 1) {
      const diffMinutes = Math.round((date.getTime() - now.getTime()) / (1000 * 60));
      if (diffMinutes > 0) {
        return `${diffMinutes}分钟后开始`;
      } else {
        return `${Math.abs(diffMinutes)}分钟前开始`;
      }
    } else if (Math.abs(diffHours) < 24) {
      return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit'
      });
    } else {
      return date.toLocaleString('zh-CN', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  }, []);

  /**
   * 获取邀请状态显示
   */
  const getStatusDisplay = useCallback(() => {
    const status = message.invitation_status;
    const colors = {
      pending: 'warning',
      accepted: 'success',
      declined: 'error',
      expired: 'default',
      cancelled: 'default'
    } as const;

    const labels = {
      pending: '待回复',
      accepted: '已接受',
      declined: '已拒绝',
      expired: '已过期',
      cancelled: '已取消'
    };

    return {
      color: colors[status] || 'default',
      label: labels[status] || status
    };
  }, [message.invitation_status]);

  /**
   * 检查邀请是否已过期
   */
  const isExpired = useCallback(() => {
    if (!message.expires_at) return false;
    return new Date(message.expires_at) < new Date();
  }, [message.expires_at]);

  /**
   * 检查是否可以加入会议
   */
  const canJoinMeeting = useCallback(() => {
    if (message.invitation_status !== 'accepted') return false;
    if (isExpired()) return false;
    
    // 如果是立即会议，总是可以加入
    if (message.is_immediate) return true;
    
    // 如果是预定会议，检查时间
    if (message.scheduled_start_time) {
      const startTime = new Date(message.scheduled_start_time);
      const now = new Date();
      const diffMinutes = (startTime.getTime() - now.getTime()) / (1000 * 60);
      
      // 允许提前5分钟加入
      return diffMinutes <= 5 && diffMinutes > -60; // 会议开始后1小时内仍可加入
    }
    
    return false;
  }, [message, isExpired]);

  /**
   * 处理响应操作
   */
  const handleResponse = useCallback(async (response: 'accepted' | 'declined') => {
    if (isLoading || isCurrentUser) return;

    try {
      setIsLoading(true);
      
      await messageService.respondToConferenceInvite({
        message_id: message.id,
        response,
        response_message: responseMessage.trim() || undefined
      });

      onResponse?.(response, responseMessage.trim() || undefined);
      setShowResponseDialog(false);
      setResponseMessage('');

      // 如果接受了立即会议邀请，尝试加入
      if (response === 'accepted' && message.is_immediate) {
        setTimeout(() => {
          onJoinMeeting?.(message.conference_id);
        }, 1000);
      }

    } catch (error) {
      console.error('响应会议邀请失败:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, isCurrentUser, responseMessage, message, onResponse, onJoinMeeting, onError]);

  /**
   * 处理加入会议
   */
  const handleJoinMeeting = useCallback(async () => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      
      // 创建会议并加入
      const callId = await callManager.createConference(
        message.conference_id,
        message.call_type,
        {
          title: message.conference_title,
          description: message.conference_description,
          case_id: message.case_id,
          group_id: message.group_id
        }
      );
      
      onJoinMeeting?.(message.conference_id);
      
    } catch (error) {
      console.error('加入会议失败:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, message, onJoinMeeting, onError]);

  /**
   * 显示响应对话框
   */
  const showResponseConfirm = useCallback((type: 'accepted' | 'declined') => {
    setResponseType(type);
    setShowResponseDialog(true);
  }, []);

  const statusDisplay = getStatusDisplay();
  const expired = isExpired();
  const canJoin = canJoinMeeting();

  return (
    <>
      <Card
        elevation={2}
        sx={{
          maxWidth: compact ? 300 : 400,
          border: `1px solid ${theme.palette.divider}`,
          borderLeft: `4px solid ${
            message.call_type === 'video' ? theme.palette.primary.main : theme.palette.success.main
          }`
        }}
      >
        <CardContent sx={{ pb: showActions ? 1 : 2 }}>
          {/* 头部信息 */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 32, height: 32 }}>
                {message.call_type === 'video' ? <VideoCallIcon /> : <CallIcon />}
              </Avatar>
              <Box>
                <Typography variant="subtitle2" fontWeight="bold">
                  会议邀请
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  来自 {message.sender_name}
                </Typography>
              </Box>
            </Stack>
            
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                label={statusDisplay.label}
                color={statusDisplay.color}
                size="small"
                variant="outlined"
              />
              {!compact && (
                <Tooltip title="详细信息">
                  <IconButton
                    size="small"
                    onClick={() => setShowDetails(!showDetails)}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Stack>

          {/* 会议标题 */}
          <Typography variant="h6" sx={{ mb: 1, fontSize: compact ? '1rem' : '1.25rem' }}>
            {message.conference_title}
          </Typography>

          {/* 会议描述 */}
          {message.conference_description && !compact && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {message.conference_description}
            </Typography>
          )}

          {/* 会议信息 */}
          <Stack spacing={1} sx={{ mb: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              {message.call_type === 'video' ? (
                <VideoCallIcon fontSize="small" color="primary" />
              ) : (
                <CallIcon fontSize="small" color="success" />
              )}
              <Typography variant="body2">
                {message.call_type === 'video' ? '视频会议' : '语音会议'}
              </Typography>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              {message.is_immediate ? (
                <AccessTimeIcon fontSize="small" color="warning" />
              ) : (
                <ScheduleIcon fontSize="small" color="info" />
              )}
              <Typography variant="body2">
                {message.is_immediate ? '立即开始' : formatDateTime(message.scheduled_start_time!)}
              </Typography>
            </Stack>

            {message.scheduled_duration && !compact && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <EventNoteIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  预计时长 {message.scheduled_duration} 分钟
                </Typography>
              </Stack>
            )}

            {message.metadata?.max_participants && !compact && (
              <Stack direction="row" alignItems="center" spacing={1}>
                <PeopleIcon fontSize="small" color="action" />
                <Typography variant="body2">
                  最多 {message.metadata.max_participants} 人参与
                </Typography>
              </Stack>
            )}
          </Stack>

          {/* 详细信息 */}
          {showDetails && !compact && (
            <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                会议详情
              </Typography>
              
              <Stack spacing={1}>
                <Typography variant="caption">
                  会议ID：{message.conference_id}
                </Typography>
                
                {message.expires_at && (
                  <Typography variant="caption" color={expired ? 'error' : 'text.secondary'}>
                    邀请有效期至：{new Date(message.expires_at).toLocaleString()}
                  </Typography>
                )}
                
                {message.metadata && Object.keys(message.metadata).length > 0 && (
                  <Box>
                    <Typography variant="caption" fontWeight="bold">设置：</Typography>
                    {message.metadata.require_audio && (
                      <Chip label="需要音频" size="small" variant="outlined" sx={{ ml: 0.5, mb: 0.5 }} />
                    )}
                    {message.metadata.require_video && (
                      <Chip label="需要视频" size="small" variant="outlined" sx={{ ml: 0.5, mb: 0.5 }} />
                    )}
                    {message.metadata.allow_screen_share && (
                      <Chip label="允许屏幕共享" size="small" variant="outlined" sx={{ ml: 0.5, mb: 0.5 }} />
                    )}
                    {message.metadata.record_meeting && (
                      <Chip label="录制会议" size="small" variant="outlined" sx={{ ml: 0.5, mb: 0.5 }} />
                    )}
                  </Box>
                )}
              </Stack>
            </Box>
          )}

          {/* 过期提醒 */}
          {expired && message.invitation_status === 'pending' && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              此邀请已过期
            </Alert>
          )}
        </CardContent>

        {/* 操作按钮 */}
        {showActions && !isCurrentUser && (
          <CardActions sx={{ px: 2, pb: 2 }}>
            {message.invitation_status === 'pending' && !expired ? (
              <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckIcon />}
                  onClick={() => showResponseConfirm('accepted')}
                  disabled={isLoading}
                  fullWidth
                >
                  接受
                </Button>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<CloseIcon />}
                  onClick={() => showResponseConfirm('declined')}
                  disabled={isLoading}
                  fullWidth
                >
                  拒绝
                </Button>
              </Stack>
            ) : message.invitation_status === 'accepted' && canJoin ? (
              <Button
                variant="contained"
                color="primary"
                startIcon={message.call_type === 'video' ? <VideoCallIcon /> : <CallIcon />}
                onClick={handleJoinMeeting}
                disabled={isLoading}
                fullWidth
              >
                {isLoading ? (
                  <CircularProgress size={20} />
                ) : (
                  '加入会议'
                )}
              </Button>
            ) : null}
          </CardActions>
        )}

        {/* 当前用户发送的邀请状态 */}
        {isCurrentUser && (
          <CardActions sx={{ px: 2, pb: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>
              您发送的会议邀请
            </Typography>
            {message.invitation_status === 'pending' && (
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  // 这里可以实现取消邀请功能
                  console.log('取消邀请');
                }}
              >
                取消邀请
              </Button>
            )}
          </CardActions>
        )}
      </Card>

      {/* 响应确认对话框 */}
      <Dialog
        open={showResponseDialog}
        onClose={() => setShowResponseDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {responseType === 'accepted' ? '接受会议邀请' : '拒绝会议邀请'}
        </DialogTitle>
        
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            会议：{message.conference_title}
          </Typography>
          
          <TextField
            label={responseType === 'accepted' ? '回复消息（可选）' : '拒绝原因（可选）'}
            placeholder={
              responseType === 'accepted' 
                ? '添加一些回复...' 
                : '请告诉主持人拒绝的原因...'
            }
            multiline
            rows={3}
            fullWidth
            value={responseMessage}
            onChange={(e) => setResponseMessage(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        
        <DialogActions>
          <Button 
            onClick={() => setShowResponseDialog(false)}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button
            variant="contained"
            color={responseType === 'accepted' ? 'success' : 'error'}
            onClick={() => handleResponse(responseType)}
            disabled={isLoading}
          >
            {isLoading ? (
              <CircularProgress size={20} />
            ) : (
              responseType === 'accepted' ? '确认接受' : '确认拒绝'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ConferenceInviteCard;