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
  Grid,
  Card,
  CardContent,
  Menu,
  MenuItem,
  Fab,
  Zoom,
  useMediaQuery,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Drawer,
  Divider,
  Badge,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Call as CallIcon,
  CallEnd as CallEndIcon,
  Mic as MicIcon,
  MicOff as MicOffIcon,
  Videocam as VideocamIcon,
  VideocamOff as VideocamOffIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeOffIcon,
  ScreenShare as ScreenShareIcon,
  StopScreenShare as StopScreenShareIcon,
  CameraAlt as CameraAltIcon,
  Flip as FlipIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  MoreVert as MoreVertIcon,
  FullscreenIcon,
  FullscreenExitIcon,
  PictureInPictureIcon,
  AspectRatio as AspectRatioIcon,
  NetworkWifi as NetworkWifiIcon,
  SignalWifi0Bar as SignalWifi0BarIcon,
  SignalWifi1Bar as SignalWifi1BarIcon,
  SignalWifi2Bar as SignalWifi2BarIcon,
  SignalWifi3Bar as SignalWifi3BarIcon,
  SignalWifi4Bar as SignalWifi4BarIcon,
  People as PeopleIcon,
  Chat as ChatIcon,
  Close as CloseIcon,
  PersonAdd as PersonAddIcon,
  AdminPanelSettings as AdminPanelSettingsIcon,
  Block as BlockIcon,
  VolumeOff as MuteIcon,
  VolumeUp as UnmuteIcon,
  Crown as CrownIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon
} from '@mui/icons-material';
import { useTheme } from '@mui/material/styles';
import callManager, { CallSession, CallState, MediaState, CallParticipant, ConferenceRole } from '@/src/services/callManager';
import type { CameraInfo } from '@/src/services/webrtcManager';

// 组件属性接口
export interface ConferenceInterfaceProps {
  callId: string;
  onCallEnd?: () => void;
  onError?: (error: Error) => void;
  onInviteParticipants?: (callId: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

// 视频显示模式
type VideoDisplayMode = 'grid' | 'speaker' | 'fullscreen';

// 视频质量设置
type VideoQuality = 'low' | 'medium' | 'high' | 'ultra' | 'auto';

// 侧边栏类型
type SidebarType = 'participants' | 'chat' | null;

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

// 角色图标映射
const RoleIcons = {
  host: AdminPanelSettingsIcon,
  moderator: CrownIcon,
  participant: PersonIcon,
  observer: VisibilityIcon
};

// 角色标签映射
const RoleLabels = {
  host: '主持人',
  moderator: '管理员',
  participant: '参与者',
  observer: '观察者'
};

/**
 * ConferenceInterface - 多人会议界面组件
 * 提供完整的多人视频会议界面，包括网格显示、参与者管理、会议控制等功能
 */
const ConferenceInterface: React.FC<ConferenceInterfaceProps> = ({
  callId,
  onCallEnd,
  onError,
  onInviteParticipants,
  className,
  style
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
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
  
  const [displayMode, setDisplayMode] = useState<VideoDisplayMode>('grid');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [showEndCallConfirm, setShowEndCallConfirm] = useState<boolean>(false);
  const [showCameraMenu, setShowCameraMenu] = useState<boolean>(false);
  const [showQualityMenu, setShowQualityMenu] = useState<boolean>(false);
  const [showParticipantMenu, setShowParticipantMenu] = useState<string | null>(null);
  const [currentVideoQuality, setCurrentVideoQuality] = useState<VideoQuality>('auto');
  const [sidebarType, setSidebarType] = useState<SidebarType>(null);
  const [speakingParticipants, setSpeakingParticipants] = useState<Set<string>>(new Set());
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participantStreams, setParticipantStreams] = useState<Map<string, MediaStream>>(new Map());
  const [availableCameras, setAvailableCameras] = useState<CameraInfo[]>([]);
  const [networkQualities, setNetworkQualities] = useState<Record<string, 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'>>({});
  
  // 引用
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const cameraMenuAnchorRef = useRef<HTMLButtonElement>(null);
  const qualityMenuAnchorRef = useRef<HTMLButtonElement>(null);
  const participantMenuAnchorRef = useRef<HTMLButtonElement>(null);
  
  // 定时器引用
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const networkQualityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const speakingDetectionRef = useRef<NodeJS.Timeout | null>(null);

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
   * 获取主讲者参与者
   */
  const getSpeakerParticipant = useCallback(() => {
    if (!callSession) return null;
    
    // 优先显示正在演示的参与者
    const presentingParticipant = Array.from(callSession.participants.values())
      .find(p => p.isPresenting);
    
    if (presentingParticipant) {
      return presentingParticipant;
    }
    
    // 其次显示正在说话的参与者
    const speakingParticipant = Array.from(callSession.participants.values())
      .find(p => speakingParticipants.has(p.userId));
    
    if (speakingParticipant) {
      return speakingParticipant;
    }
    
    // 最后显示主持人
    return Array.from(callSession.participants.values())
      .find(p => p.role === 'host') || null;
  }, [callSession, speakingParticipants]);

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
        setNetworkQualities(qualities);
      } catch (error) {
        console.warn('获取网络质量失败:', error);
      }
    }
  }, [callSession, callId]);

  /**
   * 检测说话状态
   */
  const detectSpeaking = useCallback(() => {
    // 这里可以实现音频级别检测来识别正在说话的参与者
    // 简化实现：模拟检测
    if (callSession) {
      const speaking = new Set<string>();
      // 实际实现中应该通过音频分析来检测
      setSpeakingParticipants(speaking);
    }
  }, [callSession]);

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

    // 启动说话检测器
    if (speakingDetectionRef.current) {
      clearInterval(speakingDetectionRef.current);
    }
    speakingDetectionRef.current = setInterval(detectSpeaking, 500);
  }, [updateDuration, updateNetworkQuality, detectSpeaking]);

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
    if (speakingDetectionRef.current) {
      clearInterval(speakingDetectionRef.current);
      speakingDetectionRef.current = null;
    }
  }, []);

  /**
   * 设置参与者视频流
   */
  const setupParticipantVideo = useCallback((userId: string, stream: MediaStream) => {
    const videoRef = videoRefs.current.get(userId);
    if (videoRef) {
      videoRef.srcObject = stream;
    }
    
    setParticipantStreams(prev => {
      const newMap = new Map(prev);
      newMap.set(userId, stream);
      return newMap;
    });
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
    setLocalStream(stream);
    
    const session = callManager.getCallSession(callId);
    if (session) {
      setupParticipantVideo(session.localParticipant.userId, stream);
    }
  }, [callId, setupParticipantVideo]);

  /**
   * 处理远程流接收
   */
  const handleRemoteStreamReceived = useCallback((callId: string, userId: string, stream: MediaStream) => {
    if (callId !== callId) return;
    setupParticipantVideo(userId, stream);
  }, [callId, setupParticipantVideo]);

  /**
   * 处理参与者加入
   */
  const handleParticipantJoined = useCallback((callId: string, participant: CallParticipant) => {
    if (callId !== callId) return;
    
    const session = callManager.getCallSession(callId);
    if (session) {
      setCallSession({ ...session });
    }
  }, [callId]);

  /**
   * 处理参与者离开
   */
  const handleParticipantLeft = useCallback((callId: string, userId: string, reason?: string) => {
    if (callId !== callId) return;
    
    // 清理视频流
    setParticipantStreams(prev => {
      const newMap = new Map(prev);
      newMap.delete(userId);
      return newMap;
    });
    
    // 清理视频引用
    videoRefs.current.delete(userId);
    
    const session = callManager.getCallSession(callId);
    if (session) {
      setCallSession({ ...session });
    }
  }, [callId]);

  /**
   * 处理通话结束
   */
  const handleCallEnded = useCallback((callId: string, duration: number, reason?: string) => {
    if (callId !== callId) return;

    stopTimers();
    setCallSession(null);
    setLocalStream(null);
    setParticipantStreams(new Map());
    videoRefs.current.clear();
    
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
      onParticipantJoined: handleParticipantJoined,
      onParticipantLeft: handleParticipantLeft,
      onCallEnded: handleCallEnded,
      onCallFailed: handleCallFailed
    });

    return () => {
      stopTimers();
    };
  }, [callId, startTimers, stopTimers, handleCallStateChanged, handleParticipantMediaChanged, handleLocalStreamReady, handleRemoteStreamReceived, handleParticipantJoined, handleParticipantLeft, handleCallEnded, handleCallFailed]);

  /**
   * 切换静音状态
   */
  const handleToggleMute = useCallback(async () => {
    if (!callSession) return;

    try {
      setIsLoading(true);
      callManager.toggleMute(callId);
    } catch (error) {
      console.error('切换静音失败:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [callSession, callId, onError]);

  /**
   * 切换摄像头状态
   */
  const handleToggleCamera = useCallback(async () => {
    if (!callSession) return;

    try {
      setIsLoading(true);
      callManager.toggleCamera(callId);
    } catch (error) {
      console.error('切换摄像头失败:', error);
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
      callManager.toggleSpeaker(callId);
    } catch (error) {
      console.error('切换扬声器失败:', error);
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
      } else {
        await callManager.startScreenShare(callId);
      }
    } catch (error) {
      console.error('切换屏幕共享失败:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [callSession, callId, mediaState.screenSharing, onError]);

  /**
   * 切换摄像头
   */
  const handleSwitchCamera = useCallback(async (cameraId?: string) => {
    if (!callSession) return;

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
  }, [callSession, callId, onError]);

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
   * 邀请参与者
   */
  const handleInviteParticipants = useCallback(() => {
    onInviteParticipants?.(callId);
  }, [callId, onInviteParticipants]);

  /**
   * 管理参与者（静音/踢出等）
   */
  const handleManageParticipant = useCallback(async (userId: string, action: 'mute' | 'unmute' | 'kick' | 'promote' | 'demote') => {
    if (!callSession) return;

    try {
      setIsLoading(true);
      
      switch (action) {
        case 'mute':
          await callManager.muteParticipant(callId, userId, true);
          break;
        case 'unmute':
          await callManager.muteParticipant(callId, userId, false);
          break;
        case 'kick':
          // 这里需要实现踢出功能
          console.log('踢出参与者:', userId);
          break;
        case 'promote':
          await callManager.setParticipantRole(callId, userId, 'moderator');
          break;
        case 'demote':
          await callManager.setParticipantRole(callId, userId, 'participant');
          break;
      }
      
      setShowParticipantMenu(null);
    } catch (error) {
      console.error('管理参与者失败:', error);
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
    }
  }, []);

  /**
   * 结束会议
   */
  const handleEndCall = useCallback(async () => {
    if (!callSession) return;

    try {
      setIsLoading(true);
      
      // 如果是主持人，结束整个会议
      if (callSession.localParticipant.role === 'host') {
        await callManager.endCall(callId, '主持人结束会议');
      } else {
        // 其他参与者离开会议
        await callManager.leaveConference(callId, '主动离开会议');
      }
      
      setShowEndCallConfirm(false);
    } catch (error) {
      console.error('结束会议失败:', error);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [callSession, callId, onError]);

  /**
   * 渲染参与者视频
   */
  const renderParticipantVideo = useCallback((participant: CallParticipant, isMainSpeaker: boolean = false) => {
    const stream = participantStreams.get(participant.userId);
    const NetworkQualityIcon = NetworkQualityIcons[networkQualities[participant.userId] || 'unknown'];
    const RoleIcon = RoleIcons[participant.role || 'participant'];
    const isSpeaking = speakingParticipants.has(participant.userId);

    return (
      <Card
        key={participant.userId}
        sx={{
          position: 'relative',
          width: '100%',
          height: isMainSpeaker ? 400 : 200,
          borderRadius: 2,
          overflow: 'hidden',
          border: isSpeaking ? `2px solid ${theme.palette.primary.main}` : 'none',
          boxShadow: isSpeaking ? `0 0 20px ${theme.palette.primary.main}40` : undefined
        }}
      >
        {stream && !participant.mediaState.cameraOff ? (
          <video
            ref={(ref) => {
              if (ref) {
                videoRefs.current.set(participant.userId, ref);
                ref.srcObject = stream;
              }
            }}
            autoPlay
            playsInline
            muted={participant.isLocal}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: participant.isLocal ? 'scaleX(-1)' : 'none'
            }}
          />
        ) : (
          <Box
            sx={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              background: theme.palette.grey[900],
              color: 'white'
            }}
          >
            <Avatar
              sx={{
                width: isMainSpeaker ? 120 : 80,
                height: isMainSpeaker ? 120 : 80,
                mb: 2,
                bgcolor: theme.palette.primary.main,
                fontSize: isMainSpeaker ? '3rem' : '2rem'
              }}
            >
              {participant.userName.charAt(0).toUpperCase()}
            </Avatar>
            <Typography variant={isMainSpeaker ? 'h6' : 'body2'}>
              {participant.userName}
            </Typography>
          </Box>
        )}

        {/* 参与者信息覆盖层 */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
            p: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="white" fontWeight="bold">
              {participant.userName}
              {participant.isLocal && ' (您)'}
            </Typography>
            
            <Chip
              icon={<RoleIcon />}
              label={RoleLabels[participant.role || 'participant']}
              size="small"
              color={participant.role === 'host' ? 'error' : participant.role === 'moderator' ? 'warning' : 'default'}
              variant="outlined"
              sx={{ color: 'white', borderColor: 'white' }}
            />
          </Stack>

          <Stack direction="row" spacing={0.5} alignItems="center">
            {participant.mediaState.micMuted && (
              <MicOffIcon sx={{ color: 'error.main', fontSize: 16 }} />
            )}
            {participant.mediaState.cameraOff && (
              <VideocamOffIcon sx={{ color: 'error.main', fontSize: 16 }} />
            )}
            {participant.isPresenting && (
              <ScreenShareIcon sx={{ color: 'primary.main', fontSize: 16 }} />
            )}
            {participant.isMutedByHost && (
              <BlockIcon sx={{ color: 'warning.main', fontSize: 16 }} />
            )}
            
            <NetworkQualityIcon sx={{ color: 'white', fontSize: 16 }} />
          </Stack>
        </Box>

        {/* 参与者管理菜单（仅主持人/管理员可见） */}
        {!participant.isLocal && callSession?.localParticipant.role && ['host', 'moderator'].includes(callSession.localParticipant.role) && (
          <IconButton
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(0,0,0,0.5)',
              color: 'white',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
            }}
            size="small"
            onClick={() => setShowParticipantMenu(participant.userId)}
          >
            <MoreVertIcon />
          </IconButton>
        )}
      </Card>
    );
  }, [participantStreams, networkQualities, speakingParticipants, callSession, theme]);

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
          正在加载会议...
        </Typography>
      </Box>
    );
  }

  const participants = Array.from(callSession.participants.values());
  const speakerParticipant = getSpeakerParticipant();
  const conferenceInfo = callManager.getConferenceInfo(callId);
  const isHost = callSession.localParticipant.role === 'host';
  const isModerator = callSession.localParticipant.role === 'moderator';

  return (
    <Box 
      ref={containerRef}
      className={className} 
      style={style}
      sx={{
        position: 'relative',
        width: '100%',
        height: displayMode === 'fullscreen' ? '100vh' : 600,
        display: 'flex',
        flexDirection: 'column',
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

      {/* 主视频区域 */}
      <Paper
        elevation={8}
        sx={{
          position: 'relative',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: displayMode === 'fullscreen' ? 0 : 3,
          overflow: 'hidden',
          background: '#000'
        }}
      >
        {/* 顶部状态栏 */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: sidebarType ? (isMobile ? 0 : 320) : 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
            p: 2,
            zIndex: 6
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <Chip
                  label={`会议中 • ${participants.length}人`}
                  color={callSession.state === 'connected' ? 'success' : 'warning'}
                  size="small"
                />
                {conferenceInfo && (
                  <Chip
                    label={`会议ID: ${conferenceInfo.conferenceId}`}
                    variant="outlined"
                    size="small"
                    sx={{ color: 'white', borderColor: 'white' }}
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
              {/* 显示模式切换 */}
              <Tooltip title="网格视图">
                <IconButton
                  size="small"
                  onClick={() => handleToggleDisplayMode('grid')}
                  sx={{ 
                    color: 'white',
                    bgcolor: displayMode === 'grid' ? 'rgba(255,255,255,0.2)' : undefined
                  }}
                >
                  <AspectRatioIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="主讲者视图">
                <IconButton
                  size="small"
                  onClick={() => handleToggleDisplayMode('speaker')}
                  sx={{ 
                    color: 'white',
                    bgcolor: displayMode === 'speaker' ? 'rgba(255,255,255,0.2)' : undefined
                  }}
                >
                  <PersonIcon />
                </IconButton>
              </Tooltip>

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

        {/* 视频内容区域 */}
        <Box
          sx={{
            flex: 1,
            p: 2,
            pt: 8,
            pb: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 2
          }}
        >
          {displayMode === 'grid' ? (
            /* 网格模式 */
            <Grid container spacing={2} sx={{ flex: 1 }}>
              {participants.map((participant) => (
                <Grid 
                  key={participant.userId}
                  size={participants.length <= 2 ? 6 : participants.length <= 4 ? 6 : 4}
                >
                  {renderParticipantVideo(participant)}
                </Grid>
              ))}
            </Grid>
          ) : (
            /* 主讲者模式 */
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* 主讲者视频 */}
              {speakerParticipant && (
                <Box sx={{ flex: 1, minHeight: 300 }}>
                  {renderParticipantVideo(speakerParticipant, true)}
                </Box>
              )}
              
              {/* 其他参与者缩略图 */}
              {participants.length > 1 && (
                <Stack 
                  direction="row" 
                  spacing={1} 
                  sx={{ 
                    height: 120,
                    overflowX: 'auto',
                    '&::-webkit-scrollbar': { height: 4 },
                    '&::-webkit-scrollbar-thumb': { 
                      backgroundColor: 'rgba(255,255,255,0.3)',
                      borderRadius: 2
                    }
                  }}
                >
                  {participants
                    .filter(p => p.userId !== speakerParticipant?.userId)
                    .map((participant) => (
                      <Box key={participant.userId} sx={{ minWidth: 160 }}>
                        {renderParticipantVideo(participant)}
                      </Box>
                    ))}
                </Stack>
              )}
            </Box>
          )}
        </Box>

        {/* 底部控制栏 */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: sidebarType ? (isMobile ? 0 : 320) : 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
            p: 2,
            zIndex: 6
          }}
        >
          <Stack direction="row" justifyContent="center" spacing={2} flexWrap="wrap">
            {/* 静音按钮 */}
            <Tooltip title={mediaState.micMuted ? '取消静音' : '静音'}>
              <Fab
                size={isMobile ? 'medium' : 'large'}
                onClick={handleToggleMute}
                disabled={isLoading}
                sx={{
                  bgcolor: mediaState.micMuted ? theme.palette.error.main : 'rgba(255,255,255,0.1)',
                  color: mediaState.micMuted ? 'white' : theme.palette.common.white,
                  '&:hover': {
                    bgcolor: mediaState.micMuted ? theme.palette.error.dark : 'rgba(255,255,255,0.2)'
                  }
                }}
              >
                {mediaState.micMuted ? <MicOffIcon /> : <MicIcon />}
              </Fab>
            </Tooltip>

            {/* 摄像头按钮 */}
            <Tooltip title={mediaState.cameraOff ? '开启摄像头' : '关闭摄像头'}>
              <Fab
                size={isMobile ? 'medium' : 'large'}
                onClick={handleToggleCamera}
                disabled={isLoading}
                sx={{
                  bgcolor: mediaState.cameraOff ? theme.palette.error.main : 'rgba(255,255,255,0.1)',
                  color: mediaState.cameraOff ? 'white' : theme.palette.common.white,
                  '&:hover': {
                    bgcolor: mediaState.cameraOff ? theme.palette.error.dark : 'rgba(255,255,255,0.2)'
                  }
                }}
              >
                {mediaState.cameraOff ? <VideocamOffIcon /> : <VideocamIcon />}
              </Fab>
            </Tooltip>

            {/* 屏幕共享按钮 */}
            <Tooltip title={mediaState.screenSharing ? '停止屏幕共享' : '开始屏幕共享'}>
              <Fab
                size={isMobile ? 'medium' : 'large'}
                onClick={handleToggleScreenShare}
                disabled={isLoading}
                sx={{
                  bgcolor: mediaState.screenSharing ? theme.palette.primary.main : 'rgba(255,255,255,0.1)',
                  color: 'white',
                  '&:hover': {
                    bgcolor: mediaState.screenSharing ? theme.palette.primary.dark : 'rgba(255,255,255,0.2)'
                  }
                }}
              >
                {mediaState.screenSharing ? <StopScreenShareIcon /> : <ScreenShareIcon />}
              </Fab>
            </Tooltip>

            {/* 参与者列表按钮 */}
            <Tooltip title="参与者">
              <Fab
                size={isMobile ? 'medium' : 'large'}
                onClick={() => setSidebarType(sidebarType === 'participants' ? null : 'participants')}
                sx={{
                  bgcolor: sidebarType === 'participants' ? theme.palette.primary.main : 'rgba(255,255,255,0.1)',
                  color: 'white',
                  '&:hover': {
                    bgcolor: sidebarType === 'participants' ? theme.palette.primary.dark : 'rgba(255,255,255,0.2)'
                  }
                }}
              >
                <Badge badgeContent={participants.length} color="error">
                  <PeopleIcon />
                </Badge>
              </Fab>
            </Tooltip>

            {/* 邀请按钮（主持人/管理员） */}
            {(isHost || isModerator) && (
              <Tooltip title="邀请参与者">
                <Fab
                  size={isMobile ? 'medium' : 'large'}
                  onClick={handleInviteParticipants}
                  disabled={isLoading}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.1)',
                    color: theme.palette.common.white,
                    '&:hover': {
                      bgcolor: 'rgba(255,255,255,0.2)'
                    }
                  }}
                >
                  <PersonAddIcon />
                </Fab>
              </Tooltip>
            )}

            {/* 设置按钮 */}
            <Tooltip title="设置">
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

            {/* 结束会议按钮 */}
            <Tooltip title={isHost ? "结束会议" : "离开会议"}>
              <Fab
                size={isMobile ? 'medium' : 'large'}
                onClick={() => setShowEndCallConfirm(true)}
                disabled={isLoading}
                sx={{
                  bgcolor: theme.palette.error.main,
                  color: 'white',
                  '&:hover': {
                    bgcolor: theme.palette.error.dark
                  }
                }}
              >
                <CallEndIcon />
              </Fab>
            </Tooltip>
          </Stack>
        </Box>
      </Paper>

      {/* 侧边栏 */}
      {sidebarType && (
        <Drawer
          anchor="right"
          variant={isMobile ? 'temporary' : 'persistent'}
          open={Boolean(sidebarType)}
          onClose={() => setSidebarType(null)}
          sx={{
            '& .MuiDrawer-paper': {
              width: 320,
              position: 'relative',
              height: '100%'
            }
          }}
        >
          {sidebarType === 'participants' && (
            <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">
                  参与者 ({participants.length})
                </Typography>
                <IconButton onClick={() => setSidebarType(null)}>
                  <CloseIcon />
                </IconButton>
              </Stack>

              <List sx={{ flex: 1, overflow: 'auto' }}>
                {participants.map((participant) => {
                  const RoleIcon = RoleIcons[participant.role || 'participant'];
                  const NetworkQualityIcon = NetworkQualityIcons[networkQualities[participant.userId] || 'unknown'];
                  
                  return (
                    <ListItem key={participant.userId}>
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
                                bgcolor: participant.connectionState === 'connected' ? 'success.main' : 'error.main',
                                border: '2px solid white'
                              }}
                            />
                          }
                        >
                          <Avatar>
                            {participant.userName.charAt(0).toUpperCase()}
                          </Avatar>
                        </Badge>
                      </ListItemAvatar>
                      
                      <ListItemText
                        primary={
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <Typography variant="body1">
                              {participant.userName}
                              {participant.isLocal && ' (您)'}
                            </Typography>
                            <RoleIcon fontSize="small" color={participant.role === 'host' ? 'error' : 'action'} />
                          </Stack>
                        }
                        secondary={
                          <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                            {participant.mediaState.micMuted && (
                              <MicOffIcon sx={{ fontSize: 14, color: 'error.main' }} />
                            )}
                            {participant.mediaState.cameraOff && (
                              <VideocamOffIcon sx={{ fontSize: 14, color: 'error.main' }} />
                            )}
                            {participant.isPresenting && (
                              <ScreenShareIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                            )}
                            <NetworkQualityIcon sx={{ fontSize: 14 }} />
                            <Typography variant="caption" color="text.secondary">
                              {RoleLabels[participant.role || 'participant']}
                            </Typography>
                          </Stack>
                        }
                      />
                      
                      {!participant.isLocal && (isHost || isModerator) && (
                        <ListItemSecondaryAction>
                          <IconButton
                            edge="end"
                            onClick={() => setShowParticipantMenu(participant.userId)}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </ListItemSecondaryAction>
                      )}
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          )}
        </Drawer>
      )}

      {/* 参与者管理菜单 */}
      <Menu
        anchorEl={participantMenuAnchorRef.current}
        open={Boolean(showParticipantMenu)}
        onClose={() => setShowParticipantMenu(null)}
      >
        {showParticipantMenu && (
          <>
            <MenuItem onClick={() => handleManageParticipant(showParticipantMenu, 'mute')}>
              <MuteIcon sx={{ mr: 1 }} />
              静音
            </MenuItem>
            <MenuItem onClick={() => handleManageParticipant(showParticipantMenu, 'unmute')}>
              <UnmuteIcon sx={{ mr: 1 }} />
              取消静音
            </MenuItem>
            {isHost && (
              <>
                <Divider />
                <MenuItem onClick={() => handleManageParticipant(showParticipantMenu, 'promote')}>
                  <CrownIcon sx={{ mr: 1 }} />
                  设为管理员
                </MenuItem>
                <MenuItem onClick={() => handleManageParticipant(showParticipantMenu, 'demote')}>
                  <PersonIcon sx={{ mr: 1 }} />
                  设为参与者
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => handleManageParticipant(showParticipantMenu, 'kick')}>
                  <BlockIcon sx={{ mr: 1 }} />
                  移出会议
                </MenuItem>
              </>
            )}
          </>
        )}
      </Menu>

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

      {/* 结束会议确认对话框 */}
      <Dialog
        open={showEndCallConfirm}
        onClose={() => setShowEndCallConfirm(false)}
        aria-labelledby="end-call-dialog-title"
        aria-describedby="end-call-dialog-description"
      >
        <DialogTitle id="end-call-dialog-title">
          {isHost ? '结束会议' : '离开会议'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="end-call-dialog-description">
            {isHost 
              ? '确定要结束整个会议吗？所有参与者都将被断开连接。'
              : '确定要离开会议吗？'
            }
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
            {isHost ? '结束会议' : '离开会议'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConferenceInterface;