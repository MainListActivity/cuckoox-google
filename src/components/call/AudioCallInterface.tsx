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
  DialogContentText,
  useMediaQuery,
  alpha
} from '@mui/material';
import {
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
  MoreVert as MoreVertIcon,
  Fullscreen as FullscreenIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import callManager, { CallSession, CallState, MediaState } from '@/src/services/callManager';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import { useWebRTCPermissions } from '@/src/hooks/useWebRTCPermissions';

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
  const { isMobile } = useResponsiveLayout();
  const isLandscape = useMediaQuery('(orientation: landscape)');
  const isPortrait = useMediaQuery('(orientation: portrait)');
  
  // 针对不同屏幕尺寸的断点
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));
  
  // WebRTC权限检查
  const { permissions, preloadPermissionGroup } = useWebRTCPermissions();
  
  // 获取具体权限状态
  const canToggleMicrophone = permissions.canToggleMicrophone();
  const canToggleSpeaker = permissions.canToggleSpeaker();
  const canToggleCamera = permissions.canToggleCamera();
  const canShareScreen = permissions.canShareScreen();
  const canEndCall = permissions.canEndCall();
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
  // 媒体流状态（暂时保留用于未来功能）
  // const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  // const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'fair' | 'poor' | 'unknown'>('unknown');
  
  // 移动端状态
  const [isFullScreen, setIsFullScreen] = useState<boolean>(false);
  const [showMobileActions, setShowMobileActions] = useState<boolean>(false);

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
  const handleCallStateChanged = useCallback((sessionCallId: string, state: CallState, previousState: CallState) => {
    if (sessionCallId !== callId) return;

    const session = callManager.getCallSession(sessionCallId);
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
  const handleParticipantMediaChanged = useCallback((sessionCallId: string, userId: string, newMediaState: MediaState) => {
    if (sessionCallId !== callId) return;

    const session = callManager.getCallSession(sessionCallId);
    if (session && userId === session.localParticipant.userId) {
      setMediaState({ ...newMediaState });
    }
  }, [callId]);

  /**
   * 处理本地流准备就绪
   */
  const handleLocalStreamReady = useCallback((sessionCallId: string, stream: MediaStream) => {
    if (sessionCallId !== callId) return;

    // setLocalStream(stream);
    
    // 设置本地音频播放
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = stream;
      localAudioRef.current.muted = true; // 本地音频静音以避免回音
    }
  }, [callId]);

  /**
   * 处理远程流接收
   */
  const handleRemoteStreamReceived = useCallback((sessionCallId: string, userId: string, stream: MediaStream) => {
    if (sessionCallId !== callId) return;

    // setRemoteStream(stream);
    
    // 设置远程音频播放
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = stream;
      remoteAudioRef.current.muted = false;
    }
  }, [callId]);

  /**
   * 处理通话结束
   */
  const handleCallEnded = useCallback((sessionCallId: string) => {
    if (sessionCallId !== callId) return;

    stopDurationTimer();
    setCallSession(null);
    // setLocalStream(null);
    // setRemoteStream(null);
    
    onCallEnd?.();
  }, [callId, stopDurationTimer, onCallEnd]);

  /**
   * 处理通话失败
   */
  const handleCallFailed = useCallback((sessionCallId: string, error: Error) => {
    if (sessionCallId !== callId) return;

    onError?.(error);
  }, [callId, onError]);

  /**
   * 初始化组件
   */
  useEffect(() => {
    // 预加载WebRTC权限
    const loadPermissions = async () => {
      try {
        await Promise.all([
          preloadPermissionGroup('BASIC_CALLING'),
          preloadPermissionGroup('MEDIA_CONTROLS')
        ]);
      } catch (error) {
        console.error('权限预加载失败:', error);
      }
    };

    loadPermissions();

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
  }, [callId, startDurationTimer, stopDurationTimer, handleCallStateChanged, handleParticipantMediaChanged, handleLocalStreamReady, handleRemoteStreamReceived, handleCallEnded, handleCallFailed, preloadPermissionGroup]);

  /**
   * 切换静音状态
   */
  const handleToggleMute = useCallback(async () => {
    if (!callSession) return;

    // 检查麦克风控制权限
    const canToggleMicrophone = permissions.canToggleMicrophone();
    if (!canToggleMicrophone.hasPermission) {
      onError?.(new Error('没有麦克风控制权限'));
      return;
    }

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
  }, [callSession, callId, onError, permissions]);

  /**
   * 切换扬声器状态
   */
  const handleToggleSpeaker = useCallback(async () => {
    if (!callSession) return;

    // 检查扬声器控制权限
    const canToggleSpeaker = permissions.canToggleSpeaker();
    if (!canToggleSpeaker.hasPermission) {
      onError?.(new Error('没有扬声器控制权限'));
      return;
    }

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
  }, [callSession, callId, onError, permissions]);

  /**
   * 切换摄像头状态
   */
  const handleToggleCamera = useCallback(async () => {
    if (!callSession || callSession.callType === 'audio') return;

    // 检查摄像头控制权限
    const canToggleCamera = permissions.canToggleCamera();
    if (!canToggleCamera.hasPermission) {
      onError?.(new Error('没有摄像头控制权限'));
      return;
    }

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
  }, [callSession, callId, onError, permissions]);

  /**
   * 切换屏幕共享
   */
  const handleToggleScreenShare = useCallback(async () => {
    if (!callSession) return;

    // 检查屏幕共享权限
    const canShareScreen = permissions.canShareScreen();
    if (!canShareScreen.hasPermission) {
      onError?.(new Error('没有屏幕共享权限'));
      return;
    }

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
  }, [callSession, callId, mediaState.screenSharing, onError, permissions]);

  /**
   * 结束通话
   */
  const handleEndCall = useCallback(async () => {
    if (!callSession) return;

    // 检查结束通话权限
    const canEndCall = permissions.canEndCall();
    if (!canEndCall.hasPermission) {
      onError?.(new Error('没有结束通话权限'));
      return;
    }

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
  }, [callSession, callId, onError, permissions]);

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
  
  /**
   * 切换全屏模式(移动端)
   */
  const handleToggleFullScreen = useCallback(() => {
    if (!isMobile) return;
    
    if (!isFullScreen) {
      // 进入全屏
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
      setIsFullScreen(true);
    } else {
      // 退出全屏
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
      setIsFullScreen(false);
    }
  }, [isMobile, isFullScreen]);
  
  /**
   * 处理屏幕方向变化
   */
  const handleOrientationChange = useCallback(() => {
    // 屏幕方向变化时的逻辑
    if (isMobile) {
      // 隐藏移动端操作栏，然后在短暂延迟后显示
      setShowMobileActions(false);
      setTimeout(() => {
        setShowMobileActions(true);
      }, 300);
    }
  }, [isMobile]);
  
  // 监听屏幕方向变化
  useEffect(() => {
    if (isMobile) {
      window.addEventListener('orientationchange', handleOrientationChange);
      
      // 初始化显示移动端操作栏
      setShowMobileActions(true);
      
      return () => {
        window.removeEventListener('orientationchange', handleOrientationChange);
      };
    }
  }, [isMobile, handleOrientationChange]);

  // 获取移动端适配的尺寸参数
  const getMobileStyles = useCallback(() => {
    if (!isMobile) return {};
    
    const baseStyles = {
      height: isLandscape ? '100vh' : '100dvh', // 使用动态视口高度
      minHeight: isLandscape ? '100vh' : '100dvh',
      borderRadius: isFullScreen ? 0 : 3,
      padding: isLandscape ? theme.spacing(1) : theme.spacing(2)
    };
    
    // 横屏模式下的特殊调整
    if (isLandscape) {
      return {
        ...baseStyles,
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center'
      };
    }
    
    return baseStyles;
  }, [isMobile, isLandscape, isFullScreen, theme]);
  
  // 获取触摸友好的按钮尺寸
  const getButtonSize = useCallback(() => {
    if (isMobile) {
      return isSmallScreen ? 56 : 64; // 遵循Touch Target指导原则(44px+)
    }
    return 48;
  }, [isMobile, isSmallScreen]);
  
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
          height: isMobile ? '100dvh' : 400,
          ...style
        }}
      >
        <Typography 
          variant={isMobile ? "h5" : "h6"} 
          color="text.secondary"
          sx={{ px: 2, textAlign: 'center' }}
        >
          正在加载通话信息...
        </Typography>
      </Box>
    );
  }

  const mainParticipant = getMainParticipant();

  return (
    <Box 
      className={className} 
      style={style}
      sx={isMobile ? getMobileStyles() : {}}
    >
      {/* 隐藏的音频元素 */}
      <audio ref={localAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      
      <Paper
        elevation={8}
        sx={{
          p: isMobile ? (isLandscape ? 1 : 2) : 3,
          borderRadius: isMobile && isFullScreen ? 0 : 3,
          background: theme.palette.mode === 'dark' 
            ? 'linear-gradient(135deg, #1e1e1e 0%, #2d2d2d 100%)'
            : 'linear-gradient(135deg, #f5f5f5 0%, #ffffff 100%)',
          minHeight: isMobile ? (isLandscape ? '100vh' : '100dvh') : 400,
          display: 'flex',
          flexDirection: isMobile && isLandscape ? 'row' : 'column',
          position: 'relative',
          overflow: 'hidden',
          // 移动端全屏样式
          ...(isMobile && isFullScreen && {
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 9999,
            borderRadius: 0
          })
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
            mb: isMobile && isLandscape ? 1 : 2,
            // 移动端横屏时调整为垂直布局
            ...(isMobile && isLandscape && {
              flexDirection: 'column',
              alignItems: 'flex-start',
              width: '30%',
              pr: 2
            })
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Chip
              label={CallStateLabels[callSession.state]}
              color={CallStateColors[callSession.state]}
              size={isMobile ? 'small' : 'small'}
              sx={{ 
                mb: isMobile ? 0.5 : 1,
                fontSize: isMobile ? '0.7rem' : undefined
              }}
            />
            {callSession.state === 'connected' && (
              <Typography 
                variant={isMobile ? 'caption' : 'body2'} 
                color="text.secondary"
                sx={{ fontWeight: 'medium' }}
              >
                {formatDuration(callDuration)}
              </Typography>
            )}
          </Box>
          
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {/* 移动端全屏按钮 */}
            {isMobile && (
              <Tooltip title={isFullScreen ? '退出全屏' : '进入全屏'}>
                <IconButton 
                  size="small" 
                  onClick={handleToggleFullScreen}
                  sx={{ color: theme.palette.text.secondary }}
                >
                  <FullscreenIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            
            <Tooltip title="更多选项">
              <IconButton size="small">
                <MoreVertIcon fontSize="small" />
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
            py: isMobile ? (isLandscape ? 1 : 2) : 2,
            // 移动端横屏时调整布局
            ...(isMobile && isLandscape && {
              width: '70%',
              justifyContent: 'flex-start',
              pt: 2
            })
          }}
        >
          <Fade in={true} timeout={1000}>
            <Box sx={{ width: '100%' }}>
              {/* 头像 */}
              <Avatar
                sx={{
                  width: isMobile ? (isLandscape ? 80 : 100) : 120,
                  height: isMobile ? (isLandscape ? 80 : 100) : 120,
                  mb: isMobile ? 1.5 : 2,
                  bgcolor: theme.palette.primary.main,
                  fontSize: isMobile ? (isLandscape ? '2rem' : '2.5rem') : '3rem',
                  mx: 'auto'
                }}
              >
                {mainParticipant ? (
                  mainParticipant.userName.charAt(0).toUpperCase()
                ) : (
                  <PersonIcon fontSize={isMobile ? 'medium' : 'large'} />
                )}
              </Avatar>

              {/* 参与者姓名 */}
              <Typography 
                variant={isMobile ? (isLandscape ? 'h6' : 'h5') : 'h5'} 
                gutterBottom
                sx={{ 
                  fontWeight: 'medium',
                  lineHeight: 1.2
                }}
              >
                {mainParticipant?.userName || '未知用户'}
              </Typography>

              {/* 连接状态 */}
              {mainParticipant && (
                <Typography 
                  variant={isMobile ? 'caption' : 'body2'} 
                  color="text.secondary" 
                  sx={{ mb: isMobile ? 1 : 1 }}
                >
                  {mainParticipant.connectionState === 'connected' ? '已连接' : '连接中...'}
                </Typography>
              )}

              {/* 媒体状态指示器 */}
              <Stack 
                direction={isMobile && isLandscape ? 'column' : 'row'} 
                spacing={isMobile && isLandscape ? 0.5 : 1} 
                justifyContent="center" 
                alignItems="center"
                sx={{ 
                  mb: isMobile ? 1 : 2,
                  flexWrap: 'wrap'
                }}
              >
                {mediaState.screenSharing && (
                  <Chip
                    icon={<ScreenShareIcon fontSize="small" />}
                    label="屏幕共享中"
                    color="primary"
                    variant="outlined"
                    size="small"
                    sx={{ fontSize: isMobile ? '0.65rem' : undefined }}
                  />
                )}
                {mediaState.micMuted && (
                  <Chip
                    icon={<MicOffIcon fontSize="small" />}
                    label="已静音"
                    color="warning"
                    variant="outlined"
                    size="small"
                    sx={{ fontSize: isMobile ? '0.65rem' : undefined }}
                  />
                )}
                {!mediaState.cameraOff && callSession.callType === 'video' && (
                  <Chip
                    icon={<VideocamIcon fontSize="small" />}
                    label="摄像头开启"
                    color="success"
                    variant="outlined"
                    size="small"
                    sx={{ fontSize: isMobile ? '0.65rem' : undefined }}
                  />
                )}
              </Stack>
            </Box>
          </Fade>
        </Box>

        {/* 底部控制按钮区域 */}
        {isMobile ? (
          /* 移动端操作栏 */
          <Fade in={showMobileActions} timeout={300}>
            <Box
              sx={{
                position: isFullScreen ? 'fixed' : 'absolute',
                bottom: isFullScreen ? 20 : 16,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                gap: isLandscape ? 1 : 1.5,
                p: 1.5,
                borderRadius: '20px',
                bgcolor: alpha(theme.palette.background.paper, 0.9),
                backdropFilter: 'blur(10px)',
                boxShadow: theme.shadows[8],
                zIndex: 1000
              }}
            >
              {/* 静音按钮 */}
              {canToggleMicrophone.hasPermission && (
                <Tooltip title={
                  canToggleMicrophone.hasPermission 
                    ? (mediaState.micMuted ? '取消静音' : '静音')
                    : '没有麦克风控制权限'
                }>
                  <IconButton
                    onClick={handleToggleMute}
                    disabled={isLoading || !canToggleMicrophone.hasPermission}
                    size="large"
                    sx={{
                      width: getButtonSize(),
                      height: getButtonSize(),
                      bgcolor: mediaState.micMuted ? theme.palette.warning.main : theme.palette.action.hover,
                      color: mediaState.micMuted ? theme.palette.warning.contrastText : theme.palette.text.primary,
                      opacity: canToggleMicrophone.hasPermission ? 1 : 0.5,
                      '&:hover': {
                        bgcolor: mediaState.micMuted ? theme.palette.warning.dark : theme.palette.action.selected
                      }
                    }}
                  >
                    {mediaState.micMuted ? <MicOffIcon /> : <MicIcon />}
                  </IconButton>
                </Tooltip>
              )}

              {/* 扬声器按钮 */}
              {canToggleSpeaker.hasPermission && (
                <Tooltip title={
                  canToggleSpeaker.hasPermission
                    ? (mediaState.speakerEnabled ? '关闭扬声器' : '开启扬声器')
                    : '没有扬声器控制权限'
                }>
                  <IconButton
                    onClick={handleToggleSpeaker}
                    disabled={isLoading || !canToggleSpeaker.hasPermission}
                    size="large"
                    sx={{
                      width: getButtonSize(),
                      height: getButtonSize(),
                      bgcolor: mediaState.speakerEnabled ? theme.palette.success.main : theme.palette.action.hover,
                      color: mediaState.speakerEnabled ? theme.palette.success.contrastText : theme.palette.text.primary,
                      opacity: canToggleSpeaker.hasPermission ? 1 : 0.5,
                      '&:hover': {
                        bgcolor: mediaState.speakerEnabled ? theme.palette.success.dark : theme.palette.action.selected
                      }
                    }}
                  >
                    {mediaState.speakerEnabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
                  </IconButton>
                </Tooltip>
              )}

              {/* 摄像头按钮（仅视频通话显示） */}
              {callSession.callType === 'video' && canToggleCamera.hasPermission && (
                <Tooltip title={
                  canToggleCamera.hasPermission
                    ? (mediaState.cameraOff ? '开启摄像头' : '关闭摄像头')
                    : '没有摄像头控制权限'
                }>
                  <IconButton
                    onClick={handleToggleCamera}
                    disabled={isLoading || !canToggleCamera.hasPermission}
                    size="large"
                    sx={{
                      width: getButtonSize(),
                      height: getButtonSize(),
                      bgcolor: mediaState.cameraOff ? theme.palette.error.main : theme.palette.success.main,
                      color: mediaState.cameraOff ? theme.palette.error.contrastText : theme.palette.success.contrastText,
                      opacity: canToggleCamera.hasPermission ? 1 : 0.5,
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
              {canShareScreen.hasPermission && (
                <Tooltip title={
                  canShareScreen.hasPermission
                    ? (mediaState.screenSharing ? '停止屏幕共享' : '开始屏幕共享')
                    : '没有屏幕共享权限'
                }>
                  <IconButton
                    onClick={handleToggleScreenShare}
                    disabled={isLoading || !canShareScreen.hasPermission}
                    size="large"
                    sx={{
                      width: getButtonSize(),
                      height: getButtonSize(),
                      bgcolor: mediaState.screenSharing ? theme.palette.primary.main : theme.palette.action.hover,
                      color: mediaState.screenSharing ? theme.palette.primary.contrastText : theme.palette.text.primary,
                      opacity: canShareScreen.hasPermission ? 1 : 0.5,
                      '&:hover': {
                        bgcolor: mediaState.screenSharing ? theme.palette.primary.dark : theme.palette.action.selected
                      }
                    }}
                  >
                    {mediaState.screenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                  </IconButton>
                </Tooltip>
              )}

              {/* 结束通话按钮 */}
              {canEndCall.hasPermission && (
                <Tooltip title={
                  canEndCall.hasPermission ? '结束通话' : '没有结束通话权限'
                }>
                  <IconButton
                    onClick={handleConfirmEndCall}
                    disabled={isLoading || !canEndCall.hasPermission}
                    size="large"
                    sx={{
                      width: getButtonSize(),
                      height: getButtonSize(),
                      bgcolor: theme.palette.error.main,
                      color: theme.palette.error.contrastText,
                      opacity: canEndCall.hasPermission ? 1 : 0.5,
                      '&:hover': {
                        bgcolor: theme.palette.error.dark
                      }
                    }}
                  >
                    <CallEndIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Fade>
        ) : (
          /* 桌面端控制按钮 */
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
            {canToggleMicrophone.hasPermission && (
              <Tooltip title={
                canToggleMicrophone.hasPermission 
                  ? (mediaState.micMuted ? '取消静音' : '静音')
                  : '没有麦克风控制权限'
              }>
                <IconButton
                  onClick={handleToggleMute}
                  disabled={isLoading || !canToggleMicrophone.hasPermission}
                  sx={{
                    bgcolor: mediaState.micMuted ? theme.palette.warning.main : theme.palette.action.hover,
                    color: mediaState.micMuted ? theme.palette.warning.contrastText : theme.palette.text.primary,
                    opacity: canToggleMicrophone.hasPermission ? 1 : 0.5,
                    '&:hover': {
                      bgcolor: mediaState.micMuted ? theme.palette.warning.dark : theme.palette.action.selected
                    }
                  }}
                >
                  {mediaState.micMuted ? <MicOffIcon /> : <MicIcon />}
                </IconButton>
              </Tooltip>
            )}

            {/* 扬声器按钮 */}
            {canToggleSpeaker.hasPermission && (
              <Tooltip title={
                canToggleSpeaker.hasPermission
                  ? (mediaState.speakerEnabled ? '关闭扬声器' : '开启扬声器')
                  : '没有扬声器控制权限'
              }>
                <IconButton
                  onClick={handleToggleSpeaker}
                  disabled={isLoading || !canToggleSpeaker.hasPermission}
                  sx={{
                    bgcolor: mediaState.speakerEnabled ? theme.palette.success.main : theme.palette.action.hover,
                    color: mediaState.speakerEnabled ? theme.palette.success.contrastText : theme.palette.text.primary,
                    opacity: canToggleSpeaker.hasPermission ? 1 : 0.5,
                    '&:hover': {
                      bgcolor: mediaState.speakerEnabled ? theme.palette.success.dark : theme.palette.action.selected
                    }
                  }}
                >
                  {mediaState.speakerEnabled ? <VolumeUpIcon /> : <VolumeOffIcon />}
                </IconButton>
              </Tooltip>
            )}

            {/* 摄像头按钮（仅视频通话显示） */}
            {callSession.callType === 'video' && canToggleCamera.hasPermission && (
              <Tooltip title={
                canToggleCamera.hasPermission
                  ? (mediaState.cameraOff ? '开启摄像头' : '关闭摄像头')
                  : '没有摄像头控制权限'
              }>
                <IconButton
                  onClick={handleToggleCamera}
                  disabled={isLoading || !canToggleCamera.hasPermission}
                  sx={{
                    bgcolor: mediaState.cameraOff ? theme.palette.error.main : theme.palette.success.main,
                    color: mediaState.cameraOff ? theme.palette.error.contrastText : theme.palette.success.contrastText,
                    opacity: canToggleCamera.hasPermission ? 1 : 0.5,
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
            {canShareScreen.hasPermission && (
              <Tooltip title={
                canShareScreen.hasPermission
                  ? (mediaState.screenSharing ? '停止屏幕共享' : '开始屏幕共享')
                  : '没有屏幕共享权限'
              }>
                <IconButton
                  onClick={handleToggleScreenShare}
                  disabled={isLoading || !canShareScreen.hasPermission}
                  sx={{
                    bgcolor: mediaState.screenSharing ? theme.palette.primary.main : theme.palette.action.hover,
                    color: mediaState.screenSharing ? theme.palette.primary.contrastText : theme.palette.text.primary,
                    opacity: canShareScreen.hasPermission ? 1 : 0.5,
                    '&:hover': {
                      bgcolor: mediaState.screenSharing ? theme.palette.primary.dark : theme.palette.action.selected
                    }
                  }}
                >
                  {mediaState.screenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                </IconButton>
              </Tooltip>
            )}

            {/* 结束通话按钮 */}
            {canEndCall.hasPermission && (
              <Tooltip title={
                canEndCall.hasPermission ? '结束通话' : '没有结束通话权限'
              }>
                <IconButton
                  onClick={handleConfirmEndCall}
                  disabled={isLoading || !canEndCall.hasPermission}
                  sx={{
                    bgcolor: theme.palette.error.main,
                    color: theme.palette.error.contrastText,
                    opacity: canEndCall.hasPermission ? 1 : 0.5,
                    '&:hover': {
                      bgcolor: theme.palette.error.dark
                    },
                    ml: 2
                  }}
                >
                  <CallEndIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        )}

        {/* 额外的通话信息（仅桌面端显示或移动端竖屏显示） */}
        {(!isMobile || (isMobile && isPortrait)) && (
          <Box
            sx={{
              mt: isMobile ? 1 : 2,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              px: 1
            }}
          >
            <Typography 
              variant="caption" 
              color="text.secondary"
              sx={{ 
                textAlign: 'center',
                fontSize: isMobile ? '0.65rem' : undefined,
                lineHeight: 1.2
              }}
            >
              {callSession.isGroup ? `群组通话 · ${callSession.participants.size} 人` : '一对一通话'}
              {callSession.callType === 'video' && ' · 视频通话'}
              {callSession.callType === 'audio' && ' · 语音通话'}
            </Typography>
          </Box>
        )}
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