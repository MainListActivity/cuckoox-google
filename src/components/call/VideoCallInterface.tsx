import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Avatar,
  Stack,
  LinearProgress,
  Chip,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Menu,
  MenuItem,
  Fab,
  Zoom,
  useMediaQuery
} from '@mui/material';
import {
  CallEnd as CallEndIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
  ScreenShare as ScreenShareIcon,
  StopScreenShare as StopScreenShareIcon,
  CameraAlt as CameraAltIcon,
  Flip as FlipIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  FullscreenIcon,
  NetworkWifi as NetworkWifiIcon,
  SignalWifi0Bar as SignalWifi0BarIcon,
  SignalWifi1Bar as SignalWifi1BarIcon,
  SignalWifi2Bar as SignalWifi2BarIcon,
  SignalWifi3Bar as SignalWifi3BarIcon,
  SignalWifi4Bar as SignalWifi4BarIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import callManager, { CallSession, CallState, MediaState } from '@/src/services/callManager';
import type { CameraInfo } from '@/src/services/webrtcManager';
import { useWebRTCPermissions } from '@/src/hooks/useWebRTCPermissions';

// 组件属性接口
export interface VideoCallInterfaceProps {
  callId: string;
  onCallEnd?: () => void;
  onError?: (error: Error) => void;
  className?: string;
  style?: React.CSSProperties;
}

// 视频显示模式
type VideoDisplayMode = 'normal' | 'fullscreen' | 'pip' | 'grid';

// 视频质量设置
type VideoQuality = 'low' | 'medium' | 'high' | 'ultra' | 'auto';

// 网络质量图标映射
const NetworkQualityIcons = {
  excellent: SignalWifi4BarIcon,
  good: SignalWifi3BarIcon,
  fair: SignalWifi2BarIcon,
  poor: SignalWifi1BarIcon,
  unknown: SignalWifi0BarIcon
};

// 网络质量颜色映射
const NetworkQualityColors = {
  excellent: 'success',
  good: 'info',
  fair: 'warning',
  poor: 'error',
  unknown: 'default'
} as const;

/**
 * VideoCallInterface - 视频通话界面组件
 * 提供完整的视频通话控制界面，包括本地和远程视频显示、画中画模式、媒体控制等功能
 */
const VideoCallInterface: React.FC<VideoCallInterfaceProps> = ({
  callId,
  onCallEnd,
  onError,
  className,
  style
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  // WebRTC权限检查
  const { permissions, preloadPermissionGroup } = useWebRTCPermissions();
  
  // 获取具体权限状态
  const canToggleMicrophone = permissions.canToggleMicrophone();
  const canToggleCamera = permissions.canToggleCamera();
  const canShareScreen = permissions.canShareScreen();
  const canEndCall = permissions.canEndCall();
  
  const [callSession, setCallSession] = useState<CallSession | null>(null);
  const [callDuration, setCallDuration] = useState<number>(0);
  const [mediaState, setMediaState] = useState<MediaState>({
    audioEnabled: true,
    videoEnabled: true,
    speakerEnabled: false,
    micMuted: false,
    cameraOff: false,
    screenSharing: false
  });
  
  const [displayMode, setDisplayMode] = useState<VideoDisplayMode>('normal');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showEndCallConfirm, setShowEndCallConfirm] = useState<boolean>(false);
  const [showCameraMenu, setShowCameraMenu] = useState<boolean>(false);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [currentVideoQuality, setCurrentVideoQuality] = useState<VideoQuality>('auto');
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [availableCameras, setAvailableCameras] = useState<CameraInfo[]>([]);
  const [networkQuality, setNetworkQuality] = useState<'excellent' | 'good' | 'fair' | 'poor' | 'unknown'>('unknown');

  // 视频元素引用
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 菜单锚点引用
  const cameraMenuAnchorRef = useRef<HTMLButtonElement>(null);
  const qualityMenuAnchorRef = useRef<HTMLButtonElement>(null);
  
  // 定时器引用
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const networkQualityTimerRef = useRef<NodeJS.Timeout | null>(null);

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
   * 更新网络质量
   */
  const updateNetworkQuality = useCallback(async () => {
    if (callSession && callSession.state === 'connected') {
      try {
        const qualities = await callManager.getNetworkQuality(callId);
        const mainParticipant = getMainParticipant();
        if (mainParticipant && qualities[mainParticipant.userId]) {
          setNetworkQuality(qualities[mainParticipant.userId]);
        }
      } catch (error) {
        console.warn('获取网络质量失败:', error);
      }
    }
  }, [callSession, callId, getMainParticipant]);

  /**
   * 启动定时器
   */
  const startTimers = useCallback(() => {
    // 启动时长计时器
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
    }
    durationTimerRef.current = setInterval(updateDuration, 1000);

    // 启动网络质量检测器
    if (networkQualityTimerRef.current) {
      clearInterval(networkQualityTimerRef.current);
    }
    networkQualityTimerRef.current = setInterval(updateNetworkQuality, 5000);
  }, [updateDuration, updateNetworkQuality]);

  /**
   * 停止定时器
   */
  const stopTimers = useCallback(() => {
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    if (networkQualityTimerRef.current) {
      clearInterval(networkQualityTimerRef.current);
      networkQualityTimerRef.current = null;
    }
  }, []);

  /**
   * 设置本地视频流
   */
  const setupLocalVideo = useCallback((stream: MediaStream) => {
    setLocalStream(stream);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }
  }, []);

  /**
   * 设置远程视频流
   */
  const setupRemoteVideo = useCallback((stream: MediaStream) => {
    setRemoteStream(stream);
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
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
        startTimers();
      } else if (state === 'ended' || state === 'failed' || state === 'rejected') {
        stopTimers();
      }
    }
  }, [callId, startTimers, stopTimers]);

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
    setupLocalVideo(stream);
  }, [callId, setupLocalVideo]);

  /**
   * 处理远程流接收
   */
  const handleRemoteStreamReceived = useCallback((callId: string, userId: string, stream: MediaStream) => {
    if (callId !== callId) return;
    setupRemoteVideo(stream);
  }, [callId, setupRemoteVideo]);

  /**
   * 处理通话结束
   */
  const handleCallEnded = useCallback((callId: string, _duration: number, _reason?: string) => {
    if (callId !== callId) return;

    stopTimers();
    setCallSession(null);
    setLocalStream(null);
    setRemoteStream(null);
    
    onCallEnd?.();
  }, [callId, stopTimers, onCallEnd]);

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
        startTimers();
      }
    }

    // 获取可用摄像头
    callManager.getAvailableCameras().then(cameras => {
      setAvailableCameras(cameras);
    });

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
      stopTimers();
    };
  }, [callId, startTimers, stopTimers, handleCallStateChanged, handleParticipantMediaChanged, handleLocalStreamReady, handleRemoteStreamReceived, handleCallEnded, handleCallFailed, preloadPermissionGroup]);

  /**
   * 切换静音状态
   */
  const handleToggleMute = useCallback(async () => {
    if (!callSession) return;

    // 检查麦克风控制权限
    if (!canToggleMicrophone.hasPermission) {
      onError?.(new Error('没有麦克风控制权限'));
      return;
    }

    try {
      setIsLoading(true);
      callManager.toggleMute(callId);
    } catch (error) {
      console.error('切换静音失败:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [callSession, callId, onError, canToggleMicrophone]);

  /**
   * 切换摄像头状态
   */
  const handleToggleCamera = useCallback(async () => {
    if (!callSession) return;

    // 检查摄像头控制权限
    if (!canToggleCamera.hasPermission) {
      onError?.(new Error('没有摄像头控制权限'));
      return;
    }

    try {
      setIsLoading(true);
      callManager.toggleCamera(callId);
    } catch (error) {
      console.error('切换摄像头失败:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [callSession, callId, onError, canToggleCamera]);


  /**
   * 切换屏幕共享
   */
  const handleToggleScreenShare = useCallback(async () => {
    if (!callSession) return;

    // 检查屏幕共享权限
    if (!canShareScreen.hasPermission) {
      onError?.(new Error('没有屏幕共享权限'));
      return;
    }

    try {
      setIsLoading(true);
      if (mediaState.screenSharing) {
        await callManager.stopScreenShare(callId);
      } else {
        await callManager.startScreenShare(callId);
      }
    } catch (error) {
      console.error('切换屏幕共享失败:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [callSession, callId, mediaState.screenSharing, onError, canShareScreen]);

  /**
   * 切换摄像头
   */
  const handleSwitchCamera = useCallback(async (cameraId?: string) => {
    if (!callSession) return;

    // 检查摄像头控制权限
    if (!canToggleCamera.hasPermission) {
      onError?.(new Error('没有摄像头控制权限'));
      return;
    }

    try {
      setIsLoading(true);
      await callManager.switchCamera(callId, cameraId);
      setShowCameraMenu(false);
    } catch (error) {
      console.error('切换摄像头失败:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [callSession, callId, onError, canToggleCamera]);

  /**
   * 调整视频质量
   */
  const handleAdjustQuality = useCallback(async (quality: VideoQuality) => {
    if (!callSession) return;

    try {
      setIsLoading(true);
      if (quality === 'auto') {
        await callManager.autoAdjustVideoQuality(callId);
      } else {
        await callManager.adjustVideoQuality(callId, quality);
      }
      setCurrentVideoQuality(quality);
      setShowQualityMenu(false);
    } catch (error) {
      console.error('调整视频质量失败:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [callSession, callId, onError]);

  /**
   * 切换显示模式
   */
  const handleToggleDisplayMode = useCallback(async (mode: VideoDisplayMode) => {
    setDisplayMode(mode);
    
    if (mode === 'fullscreen' && containerRef.current) {
      try {
        await containerRef.current.requestFullscreen();
      } catch (error) {
        console.warn('进入全屏失败:', error);
      }
    } else if (mode === 'pip' && remoteVideoRef.current) {
      try {
        await remoteVideoRef.current.requestPictureInPicture();
      } catch (error) {
        console.warn('进入画中画失败:', error);
      }
    }
  }, []);

  /**
   * 结束通话
   */
  const handleEndCall = useCallback(async () => {
    if (!callSession) return;

    // 检查结束通话权限
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
  }, [callSession, callId, onError, canEndCall]);

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
          height: 600,
          ...style
        }}
      >
        <Typography variant="h6" color="text.secondary">
          正在加载视频通话...
        </Typography>
      </Box>
    );
  }

  const mainParticipant = getMainParticipant();
  const NetworkQualityIcon = NetworkQualityIcons[networkQuality];

  return (
    <Box 
      ref={containerRef}
      className={className} 
      style={style}
      sx={{
        position: 'relative',
        width: '100%',
        height: displayMode === 'fullscreen' ? '100vh' : 600,
        ...style
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
            zIndex: 10
          }}
        />
      )}

      {/* 主视频容器 */}
      <Paper
        elevation={8}
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: displayMode === 'fullscreen' ? 0 : 3,
          overflow: 'hidden',
          background: '#000'
        }}
      >
        {/* 远程视频 */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                color: 'white'
              }}
            >
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
              <Typography variant="h5" gutterBottom>
                {mainParticipant?.userName || '未知用户'}
              </Typography>
              <Typography variant="body2" color="rgba(255,255,255,0.7)">
                {callSession.state === 'connecting' ? '连接中...' : '等待视频...'}
              </Typography>
            </Box>
          )}
        </Box>

        {/* 本地视频（画中画） */}
        <Zoom in={localStream !== null}>
          <Paper
            elevation={4}
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
              width: isMobile ? 120 : 200,
              height: isMobile ? 90 : 150,
              borderRadius: 2,
              overflow: 'hidden',
              background: '#000',
              zIndex: 5
            }}
          >
            {localStream && (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)' // 镜像效果
                }}
              />
            )}
          </Paper>
        </Zoom>

        {/* 顶部状态栏 */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
            p: 2,
            zIndex: 6
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Chip
                  label={callSession.state === 'connected' ? '通话中' : '连接中'}
                  color={callSession.state === 'connected' ? 'success' : 'warning'}
                  size="small"
                />
                {callSession.state === 'connected' && (
                  <Chip
                    icon={<NetworkQualityIcon />}
                    label={networkQuality}
                    color={NetworkQualityColors[networkQuality]}
                    size="small"
                    variant="outlined"
                  />
                )}
              </Stack>
              {callSession.state === 'connected' && (
                <Typography variant="body2" color="white" sx={{ opacity: 0.9 }}>
                  {formatDuration(callDuration)}
                </Typography>
              )}
            </Box>
            
            <Stack direction="row" spacing={1}>
              {mediaState.screenSharing && (
                <Chip
                  icon={<ScreenShareIcon />}
                  label="屏幕共享"
                  color="primary"
                  size="small"
                />
              )}
              {displayMode !== 'fullscreen' && (
                <Tooltip title="全屏">
                  <IconButton
                    size="small"
                    onClick={() => handleToggleDisplayMode('fullscreen')}
                    sx={{ color: 'white' }}
                  >
                    <FullscreenIcon />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          </Stack>
        </Box>

        {/* 底部控制栏 */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
            p: 2,
            zIndex: 6
          }}
        >
          <Stack direction="row" justifyContent="center" spacing={2}>
            {/* 静音按钮 */}
            {canToggleMicrophone.hasPermission && (
              <Tooltip title={
                canToggleMicrophone.hasPermission 
                  ? (mediaState.micMuted ? '取消静音' : '静音')
                  : '没有麦克风控制权限'
              }>
                <Fab
                  size={isMobile ? 'medium' : 'large'}
                  onClick={handleToggleMute}
                  disabled={isLoading || !canToggleMicrophone.hasPermission}
                  sx={{
                    bgcolor: mediaState.micMuted ? theme.palette.error.main : 'rgba(255,255,255,0.1)',
                    color: mediaState.micMuted ? 'white' : theme.palette.common.white,
                    opacity: canToggleMicrophone.hasPermission ? 1 : 0.5,
                    '&:hover': {
                      bgcolor: mediaState.micMuted ? theme.palette.error.dark : 'rgba(255,255,255,0.2)'
                    }
                  }}
                >
                  {mediaState.micMuted ? <MicOffIcon /> : <MicIcon />}
                </Fab>
              </Tooltip>
            )}

            {/* 摄像头按钮 */}
            {canToggleCamera.hasPermission && (
              <Tooltip title={
                canToggleCamera.hasPermission
                  ? (mediaState.cameraOff ? '开启摄像头' : '关闭摄像头')
                  : '没有摄像头控制权限'
              }>
                <Fab
                  size={isMobile ? 'medium' : 'large'}
                  onClick={handleToggleCamera}
                  disabled={isLoading || !canToggleCamera.hasPermission}
                  sx={{
                    bgcolor: mediaState.cameraOff ? theme.palette.error.main : 'rgba(255,255,255,0.1)',
                    color: mediaState.cameraOff ? 'white' : theme.palette.common.white,
                    opacity: canToggleCamera.hasPermission ? 1 : 0.5,
                    '&:hover': {
                      bgcolor: mediaState.cameraOff ? theme.palette.error.dark : 'rgba(255,255,255,0.2)'
                    }
                  }}
                >
                  {mediaState.cameraOff ? <VideocamOffIcon /> : <VideocamIcon />}
                </Fab>
              </Tooltip>
            )}

            {/* 切换摄像头按钮 */}
            {availableCameras.length > 1 && !mediaState.cameraOff && canToggleCamera.hasPermission && (
              <Tooltip title="切换摄像头">
                <Fab
                  ref={cameraMenuAnchorRef}
                  size={isMobile ? 'medium' : 'large'}
                  onClick={() => setShowCameraMenu(true)}
                  disabled={isLoading}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.1)',
                    color: theme.palette.common.white,
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.2)'
                    }
                  }}
                >
                  <FlipIcon />
                </Fab>
              </Tooltip>
            )}

            {/* 屏幕共享按钮 */}
            {canShareScreen.hasPermission && (
              <Tooltip title={
                canShareScreen.hasPermission
                  ? (mediaState.screenSharing ? '停止屏幕共享' : '开始屏幕共享')
                  : '没有屏幕共享权限'
              }>
                <Fab
                  size={isMobile ? 'medium' : 'large'}
                  onClick={handleToggleScreenShare}
                  disabled={isLoading || !canShareScreen.hasPermission}
                  sx={{
                    bgcolor: mediaState.screenSharing ? theme.palette.primary.main : 'rgba(255,255,255,0.1)',
                    color: 'white',
                    opacity: canShareScreen.hasPermission ? 1 : 0.5,
                    '&:hover': {
                      bgcolor: mediaState.screenSharing ? theme.palette.primary.dark : 'rgba(255,255,255,0.2)'
                    }
                  }}
                >
                  {mediaState.screenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                </Fab>
              </Tooltip>
            )}

            {/* 视频质量按钮 */}
            <Tooltip title="视频质量">
              <Fab
                ref={qualityMenuAnchorRef}
                size={isMobile ? 'medium' : 'large'}
                onClick={() => setShowQualityMenu(true)}
                disabled={isLoading}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.1)',
                  color: theme.palette.common.white,
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.2)'
                  }
                }}
              >
                <SettingsIcon />
              </Fab>
            </Tooltip>

            {/* 结束通话按钮 */}
            {canEndCall.hasPermission && (
              <Tooltip title={
                canEndCall.hasPermission ? '结束通话' : '没有结束通话权限'
              }>
                <Fab
                  size={isMobile ? 'medium' : 'large'}
                  onClick={() => setShowEndCallConfirm(true)}
                  disabled={isLoading || !canEndCall.hasPermission}
                  sx={{
                    bgcolor: theme.palette.error.main,
                    color: 'white',
                    opacity: canEndCall.hasPermission ? 1 : 0.5,
                    '&:hover': {
                      bgcolor: theme.palette.error.dark
                    }
                  }}
                >
                  <CallEndIcon />
                </Fab>
              </Tooltip>
            )}
          </Stack>
        </Box>
      </Paper>

      {/* 摄像头选择菜单 */}
      <Menu
        anchorEl={cameraMenuAnchorRef.current}
        open={showCameraMenu}
        onClose={() => setShowCameraMenu(false)}
        transformOrigin={{ horizontal: 'center', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
      >
        {availableCameras.map((camera) => (
          <MenuItem
            key={camera.deviceId}
            onClick={() => handleSwitchCamera(camera.deviceId)}
          >
            <CameraAltIcon sx={{ mr: 1 }} />
            {camera.label}
            {camera.facingMode && (
              <Chip
                label={camera.facingMode === 'user' ? '前置' : '后置'}
                size="small"
                variant="outlined"
                sx={{ ml: 1 }}
              />
            )}
          </MenuItem>
        ))}
        <MenuItem onClick={() => handleSwitchCamera()}>
          <FlipIcon sx={{ mr: 1 }} />
          自动切换
        </MenuItem>
      </Menu>

      {/* 视频质量选择菜单 */}
      <Menu
        anchorEl={qualityMenuAnchorRef.current}
        open={showQualityMenu}
        onClose={() => setShowQualityMenu(false)}
        transformOrigin={{ horizontal: 'center', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'center', vertical: 'bottom' }}
      >
        {['ultra', 'high', 'medium', 'low', 'auto'].map((quality) => (
          <MenuItem
            key={quality}
            onClick={() => handleAdjustQuality(quality as VideoQuality)}
            selected={currentVideoQuality === quality}
          >
            <NetworkWifiIcon sx={{ mr: 1 }} />
            {quality === 'ultra' ? '超清' : 
             quality === 'high' ? '高清' :
             quality === 'medium' ? '标清' :
             quality === 'low' ? '流畅' : '自动'}
            {quality !== 'auto' && (
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                {quality === 'ultra' ? '1080p' :
                 quality === 'high' ? '720p' :
                 quality === 'medium' ? '480p' : '240p'}
              </Typography>
            )}
          </MenuItem>
        ))}
      </Menu>

      {/* 结束通话确认对话框 */}
      <Dialog
        open={showEndCallConfirm}
        onClose={() => setShowEndCallConfirm(false)}
        aria-labelledby="end-call-dialog-title"
        aria-describedby="end-call-dialog-description"
      >
        <DialogTitle id="end-call-dialog-title">
          结束视频通话
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="end-call-dialog-description">
            确定要结束当前视频通话吗？
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowEndCallConfirm(false)} color="primary">
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

export default VideoCallInterface;