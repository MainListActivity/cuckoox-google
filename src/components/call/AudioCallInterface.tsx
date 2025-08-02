import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Avatar,
  Stack,
  Fade,
  LinearProgress,
  Chip,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText
} from '@mui/material';
import {
  Call as CallIcon,
  CallEnd as CallEndIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  ScreenShare as ScreenShareIcon,
  StopScreenShare as StopScreenShareIcon,
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import callManager, { CallSession, CallState, MediaState } from '@/src/services/callManager';

// 组件属性接口
export interface AudioCallInterfaceProps {
  callId: string;
  onCallEnd?: () => void;
  onError?: (error: Error) => void;
  className?: string;
  style?: React.CSSProperties;
}

// 通话状态标签映射
const CallStateLabels: Record<CallState, string> = {
  idle: '空闲',
  initiating: '呼叫中',
  ringing: '响铃中',
  connecting: '连接中',
  connected: '通话中',
  ended: '通话结束',
  failed: '通话失败',
  rejected: '通话被拒绝'
};

// 通话状态颜色映射
const CallStateColors: Record<CallState, 'default' | 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success'> = {
  idle: 'default',
  initiating: 'info',
  ringing: 'warning',
  connecting: 'info',
  connected: 'success',
  ended: 'default',
  failed: 'error',
  rejected: 'error'
};

/**
 * AudioCallInterface - 语音通话界面组件
 * 提供完整的通话控制界面，包括通话时长、静音、扬声器、视频切换等功能
 */
const AudioCallInterface: React.FC<AudioCallInterfaceProps> = ({
  callId,
  onCallEnd,
  onError,
  className,
  style
}) => {
  const theme = useTheme();
  const [callSession, setCallSession] = useState<CallSession | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [mediaState, setMediaState] = useState<MediaState>({
    audioEnabled: true,
    videoEnabled: false,
    speakerEnabled: false,
    micMuted: false,
    cameraOff: true,
    screenSharing: false
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showEndCallConfirm, setShowEndCallConfirm] = useState<boolean>(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'fair' | 'poor' | 'unknown'>('unknown');

  // 音频元素引用
  const localAudioRef = useRef<HTMLAudioElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  
  // 定时器引用
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 格式化通话时长
   */
  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  /**
   * 获取主要参与者信息
   */
  const getMainParticipant = useCallback(() => {
    if (!callSession) return null;
    
    const remoteParticipants = Array.from(callSession.participants.values())
      .filter(p => !p.isLocal);
    
    return remoteParticipants[0] || null;
  }, [callSession]);

  /**
   * 更新通话时长
   */
  const updateDuration = useCallback(() => {
    if (callSession && callSession.state === 'connected') {
      const elapsed = Math.floor((Date.now() - callSession.startTime) / 1000);
      setCallDuration(elapsed);
    }
  }, [callSession]);

  /**
   * 启动时长计时器
   */
  const startDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
    }
    
    durationTimerRef.current = setInterval(updateDuration, 1000);
  }, [updateDuration]);

  /**
   * 停止时长计时器
   */
  const stopDurationTimer = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
  }, []);

  /**
   * 处理通话状态变化
   */
  const handleCallStateChanged = useCallback((callId: string, state: CallState, previousState: CallState) => {
    if (callId !== callId) return;

    const session = callManager.getCallSession(callId);
    if (session) {
      setCallSession({ ...session });
      
      if (state === 'connected' && previousState !== 'connected') {
        startDurationTimer();
      } else if (state === 'ended' || state === 'failed' || state === 'rejected') {
        stopDurationTimer();
      }
    }
  }, [callId, startDurationTimer, stopDurationTimer]);

  /**
   * 处理参与者媒体状态变化
   */
  const handleParticipantMediaChanged = useCallback((callId: string, userId: string, newMediaState: MediaState) => {
    if (callId !== callId) return;

    const session = callManager.getCallSession(callId);
    if (session && userId === session.localParticipant.userId) {
      setMediaState({ ...newMediaState });
    }
  }, [callId]);

  /**
   * 处理本地流准备就绪
   */
  const handleLocalStreamReady = useCallback((callId: string, stream: MediaStream) => {
    if (callId !== callId) return;

    setLocalStream(stream);
    
    // 设置本地音频播放
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = stream;
      localAudioRef.current.muted = true; // 本地音频静音以避免回音
    }
  }, [callId]);

  /**
   * 处理远程流接收
   */
  const handleRemoteStreamReceived = useCallback((callId: string, userId: string, stream: MediaStream) => {
    if (callId !== callId) return;

    setRemoteStream(stream);
    
    // 设置远程音频播放
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.muted = false;
    }
  }, [callId]);

  /**
   * 处理通话结束
   */
  const handleCallEnded = useCallback((callId: string, duration: number, reason?: string) => {
    if (callId !== callId) return;

    stopDurationTimer();
    setCallSession(null);
    setLocalStream(null);
    setRemoteStream(null);
    
    onCallEnd?.();
  }, [callId, stopDurationTimer, onCallEnd]);

  /**
   * 处理通话失败
   */
  const handleCallFailed = useCallback((callId: string, error: Error) => {
    if (callId !== callId) return;

    onError?.(error);
  }, [callId, onError]);

  /**
   * 初始化组件
   */
  useEffect(() => {
    // 获取当前通话会话
    const session = callManager.getCallSession(callId);
    if (session) {
      setCallSession({ ...session });
      setMediaState({ ...session.localParticipant.mediaState });
      
      if (session.state === 'connected') {
        startDurationTimer();
      }
    }

    // 设置事件监听器
    callManager.setEventListeners({
      onCallStateChanged: handleCallStateChanged,
      onParticipantMediaChanged: handleParticipantMediaChanged,
      onLocalStreamReady: handleLocalStreamReady,
      onRemoteStreamReceived: handleRemoteStreamReceived,
      onCallEnded: handleCallEnded,
      onCallFailed: handleCallFailed
    });

    return () => {
      stopDurationTimer();
    };
  }, [callId, startDurationTimer, stopDurationTimer, handleCallStateChanged, handleParticipantMediaChanged, handleLocalStreamReady, handleRemoteStreamReceived, handleCallEnded, handleCallFailed]);

  /**
   * 切换静音状态
   */
  const handleToggleMute = useCallback(async () => {
    if (!callSession) return;

    try {
      setIsLoading(true);
      const newMutedState = callManager.toggleMute(callId);
      console.log(`静音状态: ${newMutedState ? '已静音' : '已取消静音'}`);
    } catch (error) {
      console.error('切换静音失败:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [callSession, callId, onError]);

  /**
   * 切换扬声器状态
   */
  const handleToggleSpeaker = useCallback(async () => {
    if (!callSession) return;

    try {
      setIsLoading(true);
      const newSpeakerState = callManager.toggleSpeaker(callId);
      console.log(`扬声器状态: ${newSpeakerState ? '已开启' : '已关闭'}`);
    } catch (error) {
      console.error('切换扬声器失败:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [callSession, callId, onError]);

  /**
   * 切换摄像头状态
   */
  const handleToggleCamera = useCallback(async () => {
    if (!callSession || callSession.callType === 'audio') return;

    try {
      setIsLoading(true);
      const newCameraState = callManager.toggleCamera(callId);
      console.log(`摄像头状态: ${newCameraState ? '已关闭' : '已开启'}`);
    } catch (error) {
      console.error('切换摄像头失败:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [callSession, callId, onError]);

  /**
   * 切换屏幕共享
   */
  const handleToggleScreenShare = useCallback(async () => {
    if (!callSession) return;

    try {
      setIsLoading(true);
      if (mediaState.screenSharing) {
        await callManager.stopScreenShare(callId);
        console.log('已停止屏幕共享');
      } else {
        await callManager.startScreenShare(callId);
        console.log('已开始屏幕共享');
      }
    } catch (error) {
      console.error('切换屏幕共享失败:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [callSession, callId, mediaState.screenSharing, onError]);

  /**
   * 结束通话
   */
  const handleEndCall = useCallback(async () => {
    if (!callSession) return;

    try {
      setIsLoading(true);
      await callManager.endCall(callId, '用户主动结束');
      setShowEndCallConfirm(false);
    } catch (error) {
      console.error('结束通话失败:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [callSession, callId, onError]);

  /**
   * 确认结束通话
   */
  const handleConfirmEndCall = useCallback(() => {
    setShowEndCallConfirm(true);
  }, []);

  /**
   * 取消结束通话
   */
  const handleCancelEndCall = useCallback(() => {
    setShowEndCallConfirm(false);
  }, []);

  // 如果没有通话会话，显示加载状态
  if (!callSession) {
    return (
      <Box
        className={className}
        style={style}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: 400,
          ...style
        }}
      >
        <Typography variant="h6" color="text.secondary">
          正在加载通话信息...
        </Typography>
      </Box>
    );
  }

  const mainParticipant = getMainParticipant();

  return (
    <Box className={className} style={style}>
      {/* 隐藏的音频元素 */}
      <audio ref={localAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      
      <Paper
        elevation={8}
        sx={{
          p: 3,
          borderRadius: 3,
          background: theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%)'
            : 'linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)',
          minHeight: 400,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* 加载进度条 */}
        {isLoading && (
          <LinearProgress
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1
            }}
          />
        )}

        {/* 顶部状态栏 */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            mb: 2
          }}
        >
          <Box>
            <Chip
              label={CallStateLabels[callSession.state]}
              color={CallStateColors[callSession.state]}
              size="small"
              sx={{ mb: 1 }}
            />
            {callSession.state === 'connected' && (
              <Typography variant="body2" color="text.secondary">
                {formatDuration(callDuration)}
              </Typography>
            )}
          </Box>
          
          <Box>
            <Tooltip title="更多选项">
              <IconButton size="small">
                <MoreVertIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* 中间参与者信息区域 */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            py: 2
          }}
        >
          <Fade in={true} timeout={1000}>
            <Box>
              {/* 头像 */}
              <Avatar
                sx={{
                  width: 120,
                  height: 120,
                  mb: 2,
                  bgcolor: theme.palette.primary.main,
                  fontSize: '3rem'
                }}
              >
                {mainParticipant ? (
                  mainParticipant.userName.charAt(0).toUpperCase()
                ) : (
                  <PersonIcon fontSize="large" />
                )}
              </Avatar>

              {/* 参与者姓名 */}
              <Typography variant="h5" gutterBottom>
                {mainParticipant?.userName || '未知用户'}
              </Typography>

              {/* 连接状态 */}
              {mainParticipant && (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  {mainParticipant.connectionState === 'connected' ? '已连接' : '连接中...'}
                </Typography>
              )}

              {/* 媒体状态指示器 */}
              <Stack direction="row" spacing={1} justifyContent="center" sx={{ mb: 2 }}>
                {mediaState.screenSharing && (
                  <Chip
                    icon={<ScreenShareIcon />}
                    label="屏幕共享中"
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                )}
                {mediaState.micMuted && (
                  <Chip
                    icon={<MicOffIcon />}
                    label="已静音"
                    color="warning"
                    variant="outlined"
                    size="small"
                  />
                )}
                {!mediaState.cameraOff && callSession.callType === 'video' && (
                  <Chip
                    icon={<VideocamIcon />}
                    label="摄像头开启"
                    color="success"
                    variant="outlined"
                    size="small"
                  />
                )}
              </Stack>
            </Box>
          </Fade>
        </Box>

        {/* 底部控制按钮区域 */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 2,
            pt: 2,
            borderTop: `1px solid ${theme.palette.divider}`
          }}
        >
          {/* 静音按钮 */}
          <Tooltip title={mediaState.micMuted ? '取消静音' : '静音'}>
            <IconButton
              onClick={handleToggleMute}
              disabled={isLoading}
              sx={{
                bgcolor: mediaState.micMuted ? theme.palette.warning.main : theme.palette.action.hover,
                color: mediaState.micMuted ? theme.palette.warning.contrastText : theme.palette.text.primary,
                '&:hover': {
                  bgcolor: mediaState.micMuted ? theme.palette.warning.dark : theme.palette.action.selected
                }
              }}
            >
              {mediaState.micMuted ? <MicOffIcon /> : <MicIcon />}
            </IconButton>
          </Tooltip>

          {/* 扬声器按钮 */}
          <Tooltip title={mediaState.speakerEnabled ? '关闭扬声器' : '开启扬声器'}>
            <IconButton
              onClick={handleToggleSpeaker}
              disabled={isLoading}
              sx={{
                bgcolor: mediaState.speakerEnabled ? theme.palette.success.main : theme.palette.action.hover,
                color: mediaState.speakerEnabled ? theme.palette.success.contrastText : theme.palette.text.primary,
                '&:hover': {
                  bgcolor: mediaState.speakerEnabled ? theme.palette.success.dark : theme.palette.action.selected
                }
              }}
            >
              {mediaState.speakerEnabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
            </IconButton>
          </Tooltip>

          {/* 摄像头按钮（仅视频通话显示） */}
          {callSession.callType === 'video' && (
            <Tooltip title={mediaState.cameraOff ? '开启摄像头' : '关闭摄像头'}>
              <IconButton
                onClick={handleToggleCamera}
                disabled={isLoading}
                sx={{
                  bgcolor: mediaState.cameraOff ? theme.palette.error.main : theme.palette.success.main,
                  color: mediaState.cameraOff ? theme.palette.error.contrastText : theme.palette.success.contrastText,
                  '&:hover': {
                    bgcolor: mediaState.cameraOff ? theme.palette.error.dark : theme.palette.success.dark
                  }
                }}
              >
                {mediaState.cameraOff ? <VideocamOffIcon /> : <VideocamIcon />}
              </IconButton>
            </Tooltip>
          )}

          {/* 屏幕共享按钮 */}
          <Tooltip title={mediaState.screenSharing ? '停止屏幕共享' : '开始屏幕共享'}>
            <IconButton
              onClick={handleToggleScreenShare}
              disabled={isLoading}
              sx={{
                bgcolor: mediaState.screenSharing ? theme.palette.primary.main : theme.palette.action.hover,
                color: mediaState.screenSharing ? theme.palette.primary.contrastText : theme.palette.text.primary,
                '&:hover': {
                  bgcolor: mediaState.screenSharing ? theme.palette.primary.dark : theme.palette.action.selected
                }
              }}
            >
              {mediaState.screenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
            </IconButton>
          </Tooltip>

          {/* 结束通话按钮 */}
          <Tooltip title="结束通话">
            <IconButton
              onClick={handleConfirmEndCall}
              disabled={isLoading}
              sx={{
                bgcolor: theme.palette.error.main,
                color: theme.palette.error.contrastText,
                '&:hover': {
                  bgcolor: theme.palette.error.dark
                },
                ml: 2
              }}
            >
              <CallEndIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* 额外的通话信息 */}
        <Box
          sx={{
            mt: 2,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {callSession.isGroup ? `群组通话 · ${callSession.participants.size} 人` : '一对一通话'}
            {callSession.callType === 'video' && ' · 视频通话'}
            {callSession.callType === 'audio' && ' · 语音通话'}
          </Typography>
        </Box>
      </Paper>

      {/* 结束通话确认对话框 */}
      <Dialog
        open={showEndCallConfirm}
        onClose={handleCancelEndCall}
        aria-labelledby="end-call-dialog-title"
        aria-describedby="end-call-dialog-description"
      >
        <DialogTitle id="end-call-dialog-title">
          结束通话
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="end-call-dialog-description">
            确定要结束当前通话吗？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCancelEndCall} color="primary">
            取消
          </Button>
          <Button
            onClick={handleEndCall}
            color="error"
            variant="contained"
            disabled={isLoading}
          >
            结束通话
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AudioCallInterface;