import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  CardActions,
  Box,
  Typography,
  IconButton,
  Button,
  Avatar,
  LinearProgress,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
  Tooltip,
  CircularProgress,
  Paper,
  Slider
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Download as DownloadIcon,
  Fullscreen as FullscreenIcon,
  VolumeUp as VolumeUpIcon,
  VolumeOff as VolumeMutedIcon,
  Call as CallIcon,
  VideoCall as VideoCallIcon,
  CallEnd as CallEndIcon,
  Reply as ReplyIcon,
  Forward as ForwardIcon,
  MoreVert as MoreVertIcon,
  Close as CloseIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  RotateRight as RotateIcon,
  FileDownload as FileDownloadIcon,
  AudioFile as AudioFileIcon,
  VideoFile as VideoFileIcon,
  InsertDriveFile as FileIcon,
  Image as ImageIcon,
  PictureInPicture as PipIcon
} from '@mui/icons-material';
import { RecordId } from 'surrealdb';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import mediaFileHandler, { FileMetadata } from '@/src/services/mediaFileHandler';
import callManager, { CallType } from '@/src/services/callManager';
import type { IMMessage, ConferenceInviteMessage } from '@/src/types/message';

// 媒体消息类型
export type MediaMessageType = 'image' | 'video' | 'audio' | 'file' | 'call' | 'conference_invite';

// 通话消息数据
export interface CallMessageData {
  callId: string;
  callType: CallType;
  duration?: number;
  status: 'completed' | 'missed' | 'declined' | 'failed' | 'ongoing';
  participants: {
    id: RecordId | string;
    name: string;
    avatar_url?: string;
  }[];
  startTime: string;
  endTime?: string;
}

// 媒体消息卡片属性
export interface MediaMessageCardProps {
  message: IMMessage | ConferenceInviteMessage;
  type: MediaMessageType;
  // 文件附件数据
  attachment?: FileMetadata;
  // 通话消息数据
  callData?: CallMessageData;
  // 是否显示发送者信息
  showSender?: boolean;
  // 是否紧凑模式
  compact?: boolean;
  // 最大宽度
  maxWidth?: number;
  // 回调函数
  onReply?: (messageId: RecordId | string) => void;
  onForward?: (messageId: RecordId | string) => void;
  onCall?: (type: CallType, targetUserId?: RecordId | string) => void;
  onDownload?: (attachment: FileMetadata) => void;
  // 会议邀请响应
  onConferenceResponse?: (messageId: RecordId | string, response: 'accepted' | 'declined') => void;
}

const MediaMessageCard: React.FC<MediaMessageCardProps> = ({
  message,
  type,
  attachment,
  callData,
  showSender = true,
  compact = false,
  maxWidth = 400,
  onReply,
  onForward,
  onCall,
  onDownload,
  onConferenceResponse
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  const { showSuccess, showError } = useSnackbar();

  // 媒体播放状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // 图片查看器状态
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [imageRotation, setImageRotation] = useState(0);

  // 下载状态
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // 引用
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 格式化时间
  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // 格式化文件大小
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // 音频控制
  const handlePlayPause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleStop = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setIsPlaying(false);
    setCurrentTime(0);
  }, []);

  const handleVolumeChange = useCallback((value: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    setVolume(value);
    audio.volume = value;
    setIsMuted(value === 0);
  }, []);

  const handleMuteToggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume > 0 ? volume : 0.5;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  }, [isMuted, volume]);

  // 视频控制
  const handleVideoPlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleVideoFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.requestFullscreen) {
      video.requestFullscreen();
    }
  }, []);

  const handleVideoPictureInPicture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !document.pictureInPictureEnabled) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (error) {
      showError('画中画模式不可用');
    }
  }, [showError]);

  // 文件下载
  const handleDownload = useCallback(async () => {
    if (!attachment || !onDownload) return;

    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      // 监听下载进度
      mediaFileHandler.setEventListeners({
        onTransferProgress: (progress) => {
          if (progress.transferId === attachment.transferId) {
            setDownloadProgress(progress.percentage);
          }
        },
        onTransferComplete: (transferId) => {
          if (transferId === attachment.transferId) {
            setIsDownloading(false);
            setDownloadProgress(0);
            showSuccess('文件下载完成');
          }
        },
        onTransferError: (error) => {
          if (error.transferId === attachment.transferId) {
            setIsDownloading(false);
            setDownloadProgress(0);
            showError(`下载失败: ${error.errorMessage}`);
          }
        }
      });

      await onDownload(attachment);
    } catch (error) {
      setIsDownloading(false);
      setDownloadProgress(0);
      showError(`下载失败: ${(error as Error).message}`);
    }
  }, [attachment, onDownload, showSuccess, showError]);

  // 通话回拨
  const handleCallBack = useCallback((callType: CallType) => {
    if (!callData || !onCall) return;

    // 获取对方用户ID（排除当前用户）
    const targetUser = callData.participants.find(p => String(p.id) !== String(user?.id));
    if (targetUser) {
      onCall(callType, targetUser.id);
    }
  }, [callData, onCall, user?.id]);

  // 图片查看器控制
  const handleImageZoomIn = useCallback(() => {
    setImageZoom(prev => Math.min(prev + 0.25, 3));
  }, []);

  const handleImageZoomOut = useCallback(() => {
    setImageZoom(prev => Math.max(prev - 0.25, 0.25));
  }, []);

  const handleImageRotate = useCallback(() => {
    setImageRotation(prev => (prev + 90) % 360);
  }, []);

  const handleImageReset = useCallback(() => {
    setImageZoom(1);
    setImageRotation(0);
  }, []);

  // 音频元数据加载
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // 渲染发送者信息
  const renderSender = () => {
    if (!showSender || compact) return null;

    return (
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <Avatar 
          src={'sender_avatar' in message ? message.sender_avatar : undefined}
          sx={{ width: 24, height: 24 }}
        >
          {message.sender_name?.charAt(0)}
        </Avatar>
        <Typography variant="caption" color="text.secondary">
          {message.sender_name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {new Date(message.created_at).toLocaleTimeString()}
        </Typography>
      </Box>
    );
  };

  // 渲染图片消息
  const renderImageMessage = () => {
    if (!attachment || !attachment.thumbnailData) return null;

    return (
      <Card sx={{ maxWidth, mb: 1 }}>
        {renderSender()}
        <CardMedia
          component="img"
          image={attachment.thumbnailData}
          alt={attachment.fileName}
          sx={{
            height: 200,
            objectFit: 'cover',
            cursor: 'pointer'
          }}
          onClick={() => setImageViewerOpen(true)}
        />
        <CardContent sx={{ p: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {attachment.fileName} • {formatFileSize(attachment.fileSize)}
          </Typography>
        </CardContent>
        <CardActions sx={{ p: 1, pt: 0 }}>
          <Button
            size="small"
            startIcon={<ZoomInIcon />}
            onClick={() => setImageViewerOpen(true)}
          >
            查看
          </Button>
          <Button
            size="small"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? '下载中...' : '下载'}
          </Button>
          {onReply && (
            <IconButton size="small" onClick={() => onReply(message.id)}>
              <ReplyIcon fontSize="small" />
            </IconButton>
          )}
          {onForward && (
            <IconButton size="small" onClick={() => onForward(message.id)}>
              <ForwardIcon fontSize="small" />
            </IconButton>
          )}
        </CardActions>
        {isDownloading && (
          <LinearProgress
            variant="determinate"
            value={downloadProgress}
            sx={{ mx: 1, mb: 1 }}
          />
        )}
      </Card>
    );
  };

  // 渲染视频消息
  const renderVideoMessage = () => {
    if (!attachment) return null;

    return (
      <Card sx={{ maxWidth, mb: 1 }}>
        {renderSender()}
        <Box sx={{ position: 'relative' }}>
          <video
            ref={videoRef}
            width="100%"
            height="200"
            controls={false}
            style={{ objectFit: 'cover' }}
            poster={attachment.thumbnailData}
          >
            <source src={mediaFileHandler.createPreviewUrl(new File([], attachment.fileName))} type={attachment.mimeType} />
          </video>
          
          {/* 视频控制覆盖层 */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              bgcolor: 'rgba(0,0,0,0.7)',
              color: 'white',
              p: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <IconButton
              size="small"
              onClick={handleVideoPlayPause}
              sx={{ color: 'white' }}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
            
            <Typography variant="caption" sx={{ minWidth: 'fit-content' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </Typography>
            
            <Box flex={1} mx={1}>
              <Slider
                size="small"
                value={currentTime}
                max={duration}
                onChange={(_, value) => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = value as number;
                  }
                }}
                sx={{ color: 'white' }}
              />
            </Box>
            
            <IconButton
              size="small"
              onClick={handleVideoFullscreen}
              sx={{ color: 'white' }}
            >
              <FullscreenIcon />
            </IconButton>
            
            {document.pictureInPictureEnabled && (
              <IconButton
                size="small"
                onClick={handleVideoPictureInPicture}
                sx={{ color: 'white' }}
              >
                <PipIcon />
              </IconButton>
            )}
          </Box>
        </Box>
        
        <CardContent sx={{ p: 1 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="caption" color="text.secondary">
              {attachment.fileName} • {formatFileSize(attachment.fileSize)}
            </Typography>
            {attachment.duration && (
              <Chip
                size="small"
                label={formatTime(attachment.duration)}
                variant="outlined"
              />
            )}
          </Box>
        </CardContent>
        
        <CardActions sx={{ p: 1, pt: 0 }}>
          <Button
            size="small"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? '下载中...' : '下载'}
          </Button>
          {onReply && (
            <IconButton size="small" onClick={() => onReply(message.id)}>
              <ReplyIcon fontSize="small" />
            </IconButton>
          )}
          {onForward && (
            <IconButton size="small" onClick={() => onForward(message.id)}>
              <ForwardIcon fontSize="small" />
            </IconButton>
          )}
        </CardActions>
        
        {isDownloading && (
          <LinearProgress
            variant="determinate"
            value={downloadProgress}
            sx={{ mx: 1, mb: 1 }}
          />
        )}
      </Card>
    );
  };

  // 渲染音频消息
  const renderAudioMessage = () => {
    if (!attachment) return null;

    return (
      <Card sx={{ maxWidth, mb: 1 }}>
        {renderSender()}
        <CardContent>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <AudioFileIcon />
            </Avatar>
            <Box flex={1}>
              <Typography variant="body2" fontWeight={600}>
                {attachment.fileName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatFileSize(attachment.fileSize)}
                {attachment.duration && ` • ${formatTime(attachment.duration)}`}
              </Typography>
            </Box>
          </Box>

          {/* 音频控制 */}
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <IconButton onClick={handlePlayPause} color="primary">
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </IconButton>
            
            <IconButton onClick={handleStop} size="small">
              <StopIcon />
            </IconButton>
            
            <Box flex={1} mx={1}>
              <Slider
                size="small"
                value={currentTime}
                max={duration}
                onChange={(_, value) => {
                  if (audioRef.current) {
                    audioRef.current.currentTime = value as number;
                  }
                }}
              />
            </Box>
            
            <Typography variant="caption" sx={{ minWidth: 'fit-content' }}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </Typography>
          </Box>

          {/* 音量控制 */}
          <Box display="flex" alignItems="center" gap={1}>
            <IconButton size="small" onClick={handleMuteToggle}>
              {isMuted ? <VolumeMutedIcon /> : <VolumeUpIcon />}
            </IconButton>
            <Box width={80}>
              <Slider
                size="small"
                value={isMuted ? 0 : volume}
                max={1}
                step={0.1}
                onChange={(_, value) => handleVolumeChange(value as number)}
              />
            </Box>
          </Box>

          {/* 隐藏的音频元素 */}
          <audio
            ref={audioRef}
            src={mediaFileHandler.createPreviewUrl(new File([], attachment.fileName))}
            preload="metadata"
          />
        </CardContent>
        
        <CardActions sx={{ p: 1, pt: 0 }}>
          <Button
            size="small"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? '下载中...' : '下载'}
          </Button>
          {onReply && (
            <IconButton size="small" onClick={() => onReply(message.id)}>
              <ReplyIcon fontSize="small" />
            </IconButton>
          )}
          {onForward && (
            <IconButton size="small" onClick={() => onForward(message.id)}>
              <ForwardIcon fontSize="small" />
            </IconButton>
          )}
        </CardActions>
        
        {isDownloading && (
          <LinearProgress
            variant="determinate"
            value={downloadProgress}
            sx={{ mx: 1, mb: 1 }}
          />
        )}
      </Card>
    );
  };

  // 渲染文件消息
  const renderFileMessage = () => {
    if (!attachment) return null;

    const getFileIcon = () => {
      if (attachment.mimeType.startsWith('image/')) return <ImageIcon />;
      if (attachment.mimeType.startsWith('video/')) return <VideoFileIcon />;
      if (attachment.mimeType.startsWith('audio/')) return <AudioFileIcon />;
      return <FileIcon />;
    };

    return (
      <Card sx={{ maxWidth, mb: 1 }}>
        {renderSender()}
        <CardContent>
          <Box display="flex" alignItems="center" gap={2}>
            <Avatar sx={{ bgcolor: 'secondary.main' }}>
              {getFileIcon()}
            </Avatar>
            <Box flex={1}>
              <Typography variant="body2" fontWeight={600}>
                {attachment.fileName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {formatFileSize(attachment.fileSize)} • {attachment.fileType.toUpperCase()}
              </Typography>
            </Box>
            <IconButton
              onClick={handleDownload}
              disabled={isDownloading}
              color="primary"
            >
              {isDownloading ? <CircularProgress size={20} /> : <FileDownloadIcon />}
            </IconButton>
          </Box>
        </CardContent>
        
        <CardActions sx={{ p: 1, pt: 0 }}>
          <Button
            size="small"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            disabled={isDownloading}
          >
            {isDownloading ? '下载中...' : '下载'}
          </Button>
          {onReply && (
            <IconButton size="small" onClick={() => onReply(message.id)}>
              <ReplyIcon fontSize="small" />
            </IconButton>
          )}
          {onForward && (
            <IconButton size="small" onClick={() => onForward(message.id)}>
              <ForwardIcon fontSize="small" />
            </IconButton>
          )}
        </CardActions>
        
        {isDownloading && (
          <LinearProgress
            variant="determinate"
            value={downloadProgress}
            sx={{ mx: 1, mb: 1 }}
          />
        )}
      </Card>
    );
  };

  // 渲染通话消息
  const renderCallMessage = () => {
    if (!callData) return null;

    const getCallStatusColor = () => {
      switch (callData.status) {
        case 'completed': return 'success';
        case 'missed': return 'error';
        case 'declined': return 'warning';
        case 'failed': return 'error';
        case 'ongoing': return 'info';
        default: return 'default';
      }
    };

    const getCallStatusText = () => {
      switch (callData.status) {
        case 'completed': return '通话结束';
        case 'missed': return '未接通话';
        case 'declined': return '已拒绝';
        case 'failed': return '通话失败';
        case 'ongoing': return '通话中';
        default: return '未知状态';
      }
    };

    return (
      <Card sx={{ maxWidth, mb: 1 }}>
        {renderSender()}
        <CardContent>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Avatar sx={{ bgcolor: `${getCallStatusColor()}.main` }}>
              {callData.callType === 'video' ? <VideoCallIcon /> : <CallIcon />}
            </Avatar>
            <Box flex={1}>
              <Typography variant="body2" fontWeight={600}>
                {callData.callType === 'video' ? '视频通话' : '语音通话'}
              </Typography>
              <Box display="flex" alignItems="center" gap={1}>
                <Chip
                  size="small"
                  label={getCallStatusText()}
                  color={getCallStatusColor() as any}
                  variant="outlined"
                />
                {callData.duration && (
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(callData.duration)}
                  </Typography>
                )}
              </Box>
            </Box>
          </Box>

          <Typography variant="caption" color="text.secondary" display="block" mb={1}>
            {new Date(callData.startTime).toLocaleString()}
            {callData.endTime && ` - ${new Date(callData.endTime).toLocaleString()}`}
          </Typography>

          {/* 参与者 */}
          {callData.participants.length > 1 && (
            <Box display="flex" alignItems="center" gap={1} mt={1}>
              <Typography variant="caption" color="text.secondary">
                参与者:
              </Typography>
              {callData.participants.slice(0, 3).map((participant, index) => (
                <Avatar
                  key={participant.id}
                  src={participant.avatar_url}
                  sx={{ width: 20, height: 20 }}
                >
                  {participant.name.charAt(0)}
                </Avatar>
              ))}
              {callData.participants.length > 3 && (
                <Typography variant="caption" color="text.secondary">
                  +{callData.participants.length - 3} 人
                </Typography>
              )}
            </Box>
          )}
        </CardContent>
        
        <CardActions sx={{ p: 1, pt: 0 }}>
          {callData.status !== 'ongoing' && onCall && (
            <>
              <Button
                size="small"
                startIcon={<CallIcon />}
                onClick={() => handleCallBack('audio')}
              >
                语音回拨
              </Button>
              <Button
                size="small"
                startIcon={<VideoCallIcon />}
                onClick={() => handleCallBack('video')}
              >
                视频回拨
              </Button>
            </>
          )}
          {callData.status === 'ongoing' && onCall && (
            <Button
              size="small"
              startIcon={<CallEndIcon />}
              color="error"
              onClick={() => {
                // 结束当前通话的逻辑
                callManager.endCall(callData.callId, '主动结束');
              }}
            >
              结束通话
            </Button>
          )}
          {onReply && (
            <IconButton size="small" onClick={() => onReply(message.id)}>
              <ReplyIcon fontSize="small" />
            </IconButton>
          )}
        </CardActions>
      </Card>
    );
  };

  // 渲染会议邀请消息
  const renderConferenceInviteMessage = () => {
    if (message.type !== 'CONFERENCE_INVITE') return null;

    const conferenceMessage = message as ConferenceInviteMessage;
    const isExpired = conferenceMessage.expires_at && new Date(conferenceMessage.expires_at) < new Date();
    const canRespond = conferenceMessage.invitation_status === 'pending' && !isExpired;

    return (
      <Card sx={{ maxWidth, mb: 1 }}>
        {renderSender()}
        <CardContent>
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Avatar sx={{ bgcolor: 'info.main' }}>
              {conferenceMessage.call_type === 'video' ? <VideoCallIcon /> : <CallIcon />}
            </Avatar>
            <Box flex={1}>
              <Typography variant="body2" fontWeight={600}>
                {conferenceMessage.conference_title || `${conferenceMessage.call_type === 'video' ? '视频' : '语音'}会议邀请`}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                来自 {conferenceMessage.sender_name}
              </Typography>
            </Box>
          </Box>

          {conferenceMessage.conference_description && (
            <Typography variant="body2" sx={{ mb: 2 }}>
              {conferenceMessage.conference_description}
            </Typography>
          )}

          <Box display="flex" flex-direction="column" gap={1}>
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption" color="text.secondary">
                类型:
              </Typography>
              <Chip
                size="small"
                label={conferenceMessage.call_type === 'video' ? '视频会议' : '语音会议'}
                variant="outlined"
              />
            </Box>

            {conferenceMessage.scheduled_start_time && (
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="caption" color="text.secondary">
                  开始时间:
                </Typography>
                <Typography variant="caption">
                  {new Date(conferenceMessage.scheduled_start_time).toLocaleString()}
                </Typography>
              </Box>
            )}

            {conferenceMessage.scheduled_duration && (
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="caption" color="text.secondary">
                  预计时长:
                </Typography>
                <Typography variant="caption">
                  {conferenceMessage.scheduled_duration} 分钟
                </Typography>
              </Box>
            )}

            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="caption" color="text.secondary">
                状态:
              </Typography>
              <Chip
                size="small"
                label={
                  isExpired ? '已过期' :
                  conferenceMessage.invitation_status === 'accepted' ? '已接受' :
                  conferenceMessage.invitation_status === 'declined' ? '已拒绝' :
                  conferenceMessage.invitation_status === 'cancelled' ? '已取消' :
                  '等待响应'
                }
                color={
                  isExpired ? 'error' :
                  conferenceMessage.invitation_status === 'accepted' ? 'success' :
                  conferenceMessage.invitation_status === 'declined' ? 'warning' :
                  conferenceMessage.invitation_status === 'cancelled' ? 'error' :
                  'info'
                }
                variant="outlined"
              />
            </Box>
          </Box>
        </CardContent>
        
        <CardActions sx={{ p: 1, pt: 0 }}>
          {canRespond && onConferenceResponse && (
            <>
              <Button
                size="small"
                variant="contained"
                color="success"
                onClick={() => onConferenceResponse(message.id, 'accepted')}
              >
                接受
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={() => onConferenceResponse(message.id, 'declined')}
              >
                拒绝
              </Button>
            </>
          )}
          {onReply && (
            <IconButton size="small" onClick={() => onReply(message.id)}>
              <ReplyIcon fontSize="small" />
            </IconButton>
          )}
        </CardActions>
      </Card>
    );
  };

  // 渲染图片查看器
  const renderImageViewer = () => (
    <Dialog
      open={imageViewerOpen}
      onClose={() => setImageViewerOpen(false)}
      maxWidth={false}
      fullScreen={isMobile}
      sx={{
        '& .MuiDialog-paper': {
          bgcolor: 'black',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }
      }}
    >
      <DialogTitle sx={{ color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography>{attachment?.fileName}</Typography>
        <IconButton onClick={() => setImageViewerOpen(false)} sx={{ color: 'white' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      
      <DialogContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', p: 0 }}>
        {attachment?.thumbnailData && (
          <img
            src={attachment.thumbnailData}
            alt={attachment.fileName}
            style={{
              maxWidth: '100%',
              maxHeight: '80vh',
              transform: `scale(${imageZoom}) rotate(${imageRotation}deg)`,
              transition: 'transform 0.3s ease'
            }}
          />
        )}
      </DialogContent>
      
      <DialogActions sx={{ color: 'white', justifyContent: 'center', gap: 1 }}>
        <IconButton onClick={handleImageZoomOut} sx={{ color: 'white' }}>
          <ZoomOutIcon />
        </IconButton>
        <IconButton onClick={handleImageZoomIn} sx={{ color: 'white' }}>
          <ZoomInIcon />
        </IconButton>
        <IconButton onClick={handleImageRotate} sx={{ color: 'white' }}>
          <RotateIcon />
        </IconButton>
        <Button onClick={handleImageReset} sx={{ color: 'white' }}>
          重置
        </Button>
        <Button onClick={handleDownload} sx={{ color: 'white' }} startIcon={<DownloadIcon />}>
          下载
        </Button>
      </DialogActions>
    </Dialog>
  );

  // 根据类型渲染相应的消息卡片
  const renderMessageCard = () => {
    switch (type) {
      case 'image':
        return renderImageMessage();
      case 'video':
        return renderVideoMessage();
      case 'audio':
        return renderAudioMessage();
      case 'file':
        return renderFileMessage();
      case 'call':
        return renderCallMessage();
      case 'conference_invite':
        return renderConferenceInviteMessage();
      default:
        return null;
    }
  };

  return (
    <>
      {renderMessageCard()}
      {type === 'image' && renderImageViewer()}
    </>
  );
};

export default MediaMessageCard;