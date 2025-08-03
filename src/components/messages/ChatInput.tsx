import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  TextField,
  IconButton,
  useTheme,
  Paper,
  Menu,
  MenuItem,
  Box,
  Typography,
  Avatar,
  ListItemAvatar,
  ListItemText,
  Tooltip,
  CircularProgress,
  useMediaQuery,
  Popover,
  Grid,
  LinearProgress
} from '@mui/material';
import {
  Send as SendIcon,
  AttachFile as AttachFileIcon,
  VideoFile as VideoFileIcon,
  AudioFile as AudioFileIcon,
  InsertDriveFile as FileIcon,
  Call as CallIcon,
  VideoCall as VideoCallIcon,
  EmojiEmotions as EmojiIcon,
  Mic as MicIcon,
  Stop as StopIcon,
  Camera as CameraIcon,
  Photo as PhotoIcon,
  FolderOpen as FolderIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { RecordId } from 'surrealdb';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import mediaFileHandler, { FileMetadata } from '@/src/services/mediaFileHandler';
import { CallType } from '@/src/services/callManager';
import { useWebRTCPermissions } from '@/src/hooks/useWebRTCPermissions';

// 聊天模式类型
export type ChatMode = 'private' | 'group';

// 文件类型枚举
export type FileType = 'image' | 'video' | 'audio' | 'document';

// @提及用户接口
export interface MentionUser {
  id: RecordId | string;
  name: string;
  avatar_url?: string;
  role?: string;
}

// 表情符号数据
const EMOJI_DATA = {
  '😀': 'grinning',
  '😃': 'smiley',
  '😄': 'smile',
  '😁': 'grin',
  '😊': 'blush',
  '😉': 'wink',
  '😍': 'heart_eyes',
  '🥰': 'smiling_face_with_hearts',
  '😘': 'kissing_heart',
  '😗': 'kissing',
  '😙': 'kissing_smiling_eyes',
  '😚': 'kissing_closed_eyes',
  '🙂': 'slightly_smiling_face',
  '🤗': 'hugs',
  '🤔': 'thinking',
  '😐': 'neutral_face',
  '😑': 'expressionless',
  '🙄': 'eye_roll',
  '😏': 'smirk',
  '😣': 'persevere',
  '😥': 'disappointed_relieved',
  '😮': 'open_mouth',
  '🤐': 'zipper_mouth',
  '😯': 'hushed',
  '😪': 'sleepy',
  '😫': 'tired_face',
  '🥱': 'yawning_face',
  '😴': 'sleeping',
  '😌': 'relieved',
  '😛': 'stuck_out_tongue',
  '😜': 'stuck_out_tongue_winking_eye',
  '🤪': 'zany_face',
  '😝': 'stuck_out_tongue_closed_eyes',
  '🤤': 'drooling_face',
  '😒': 'unamused',
  '😓': 'sweat',
  '😔': 'pensive',
  '😕': 'confused',
  '🙃': 'upside_down',
  '🤑': 'money_mouth',
  '😲': 'astonished',
  '☹️': 'frowning',
  '🙁': 'slightly_frowning_face',
  '😖': 'confounded',
  '😞': 'disappointed',
  '😟': 'worried',
  '😤': 'triumph',
  '😢': 'cry',
  '😭': 'sob',
  '😦': 'frowning_open_mouth',
  '😧': 'anguished',
  '😨': 'fearful',
  '😩': 'weary',
  '🤯': 'exploding_head',
  '😬': 'grimacing',
  '😰': 'cold_sweat',
  '😱': 'scream',
  '🥵': 'hot_face',
  '🥶': 'cold_face',
  '😳': 'flushed',
  '🤪': 'zany_face',
  '😵': 'dizzy_face',
  '🥴': 'woozy_face',
  '😠': 'angry',
  '😡': 'rage',
  '🤬': 'face_with_symbols_over_mouth',
  '👍': 'thumbs_up',
  '👎': 'thumbs_down',
  '👌': 'ok_hand',
  '✌️': 'victory',
  '👋': 'wave',
  '🤝': 'handshake',
  '🙏': 'pray',
  '❤️': 'heart',
  '💙': 'blue_heart',
  '💚': 'green_heart',
  '💛': 'yellow_heart',
  '🧡': 'orange_heart',
  '💜': 'purple_heart',
  '🖤': 'black_heart',
  '🤍': 'white_heart',
  '💔': 'broken_heart',
  '💕': 'two_hearts',
  '💖': 'sparkling_heart',
  '💗': 'growing_heart',
  '💘': 'cupid',
  '💝': 'gift_heart',
  '💞': 'revolving_hearts',
  '💟': 'heart_decoration',
  '🔥': 'fire',
  '💯': 'hundred',
  '⭐': 'star',
  '🌟': 'star2',
  '✨': 'sparkles',
  '🎉': 'tada',
  '🎊': 'confetti_ball'
};

// 语音录制状态
type VoiceRecordingState = 'idle' | 'recording' | 'paused' | 'processing';

export interface ChatInputProps {
  mode: ChatMode; // 聊天模式：私聊或群组
  conversationId: RecordId | string; // 会话ID（私聊）或群组ID
  onSendMessage: (data: {
    content: string;
    mentions?: MentionUser[];
    attachments?: FileMetadata[];
    replyTo?: RecordId | string;
  }) => void;
  onStartCall?: (type: CallType) => void;
  disabled?: boolean;
  // 群组成员列表（用于@提及）
  groupMembers?: MentionUser[];
  // 是否支持通话功能
  callEnabled?: boolean;
  // 是否支持文件上传
  fileUploadEnabled?: boolean;
  // 最大文件大小 (bytes)
  maxFileSize?: number;
  // 占位符文本
  placeholder?: string;
  // 草稿保存回调
  onDraftSave?: (draft: string) => void;
  // 初始草稿内容
  initialDraft?: string;
}

const ChatInput: React.FC<ChatInputProps> = ({
  mode,
  conversationId: _conversationId,
  onSendMessage,
  onStartCall,
  disabled = false,
  groupMembers = [],
  callEnabled = true,
  fileUploadEnabled = true,
  maxFileSize = 50 * 1024 * 1024, // 50MB
  placeholder,
  onDraftSave,
  initialDraft = ''
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { showSuccess, showError } = useSnackbar();
  
  // WebRTC权限检查
  const { permissions, preloadPermissionGroup } = useWebRTCPermissions();
  
  // 获取具体通话权限状态
  const canInitiateVoiceCall = permissions.canInitiateVoiceCall();
  const canInitiateVideoCall = permissions.canInitiateVideoCall();

  // 输入状态
  const [inputText, setInputText] = useState(initialDraft);
  const [mentions, setMentions] = useState<MentionUser[]>([]);
  const [attachments, setAttachments] = useState<FileMetadata[]>([]);
  const [replyToMessage, setReplyToMessage] = useState<RecordId | string | null>(null);

  // UI状态
  const [fileMenuAnchor, setFileMenuAnchor] = useState<HTMLElement | null>(null);
  const [emojiAnchor, setEmojiAnchor] = useState<HTMLElement | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ start: 0, end: 0 });

  // 语音录制状态
  const [voiceState, setVoiceState] = useState<VoiceRecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);

  // 文件处理状态
  const [uploadProgress, setUploadProgress] = useState<Map<string, number>>(new Map());
  const [isUploading, setIsUploading] = useState(false);

  // 引用
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 获取占位符文本
  const getPlaceholder = useCallback(() => {
    if (placeholder) return placeholder;
    if (mode === 'group') return '发送群组消息...';
    return '发送消息...';
  }, [mode, placeholder]);

  // 过滤可@的成员
  const filteredMembers = useMemo(() => {
    if (mode !== 'group' || !groupMembers.length || !mentionQuery) {
      return groupMembers;
    }
    return groupMembers.filter(member =>
      member.name.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  }, [mode, groupMembers, mentionQuery]);

  // 处理输入变化
  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputText(value);

    // 草稿保存
    onDraftSave?.(value);

    // 检测@提及（仅在群组模式下）
    if (mode === 'group' && value.includes('@')) {
      const cursorPosition = event.target.selectionStart || 0;
      const beforeCursor = value.substring(0, cursorPosition);
      const lastAtIndex = beforeCursor.lastIndexOf('@');

      if (lastAtIndex !== -1) {
        const afterAt = beforeCursor.substring(lastAtIndex + 1);
        if (!afterAt.includes(' ') && afterAt.length >= 0) {
          setMentionQuery(afterAt);
          setMentionPosition({ start: lastAtIndex, end: cursorPosition });
          setShowMentions(true);
          return;
        }
      }
    }

    setShowMentions(false);
  }, [mode, onDraftSave]);

  // 处理@选择
  const handleMentionSelect = useCallback((member: MentionUser) => {
    const newText = 
      inputText.substring(0, mentionPosition.start) +
      `@${member.name} ` +
      inputText.substring(mentionPosition.end);
    
    setInputText(newText);
    setMentions(prev => {
      const existing = prev.find(m => m.id === member.id);
      return existing ? prev : [...prev, member];
    });
    setShowMentions(false);
    setMentionQuery('');
    
    // 聚焦输入框
    inputRef.current?.focus();
  }, [inputText, mentionPosition]);

  // 处理发送
  const handleSend = useCallback(async () => {
    const content = inputText.trim();
    if (!content && attachments.length === 0) return;

    try {
      await onSendMessage({
        content,
        mentions: mentions.length > 0 ? mentions : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
        replyTo: replyToMessage || undefined
      });

      // 清空输入
      setInputText('');
      setMentions([]);
      setAttachments([]);
      setReplyToMessage(null);
      onDraftSave?.('');
    } catch (error) {
      showError(`发送失败: ${(error as Error).message}`);
    }
  }, [inputText, mentions, attachments, replyToMessage, onSendMessage, onDraftSave, showError]);

  // 处理键盘事件
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    } else if (event.key === 'Escape') {
      setShowMentions(false);
      setReplyToMessage(null);
    }
  }, [handleSend]);

  // 处理文件选择
  const handleFileSelect = useCallback(async (files: FileList | null, _fileType?: FileType) => {
    if (!files || !fileUploadEnabled) return;

    setIsUploading(true);
    const newAttachments: FileMetadata[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // 验证文件大小
        if (file.size > maxFileSize) {
          showError(`文件 ${file.name} 超过大小限制 (${Math.round(maxFileSize / 1024 / 1024)}MB)`);
          continue;
        }

        // 验证文件类型
        if (!mediaFileHandler.validateFileType(file)) {
          showError(`不支持的文件类型: ${file.name}`);
          continue;
        }

        // 分片并准备上传
        const { metadata } = await mediaFileHandler.splitFileToChunks(file);
        newAttachments.push(metadata);

        // 设置上传进度监听
        mediaFileHandler.setEventListeners({
          onTransferProgress: (progress) => {
            setUploadProgress(prev => new Map(prev.set(progress.transferId, progress.percentage)));
          },
          onTransferComplete: (transferId) => {
            setUploadProgress(prev => {
              const newMap = new Map(prev);
              newMap.delete(transferId);
              return newMap;
            });
          },
          onTransferError: (error) => {
            showError(`文件上传失败: ${error.errorMessage}`);
            setUploadProgress(prev => {
              const newMap = new Map(prev);
              newMap.delete(error.transferId);
              return newMap;
            });
          }
        });
      }

      setAttachments(prev => [...prev, ...newAttachments]);
      if (newAttachments.length > 0) {
        showSuccess(`已添加 ${newAttachments.length} 个文件`);
      }
    } catch (error) {
      showError(`文件处理失败: ${(error as Error).message}`);
    } finally {
      setIsUploading(false);
    }
  }, [fileUploadEnabled, maxFileSize, showError, showSuccess]);

  // 移除附件
  const removeAttachment = useCallback((transferId: string) => {
    setAttachments(prev => prev.filter(a => a.transferId !== transferId));
    setUploadProgress(prev => {
      const newMap = new Map(prev);
      newMap.delete(transferId);
      return newMap;
    });
  }, []);

  // 处理表情符号选择
  const handleEmojiSelect = useCallback((emoji: string) => {
    const cursorPosition = inputRef.current?.selectionStart || inputText.length;
    const newText = 
      inputText.substring(0, cursorPosition) +
      emoji +
      inputText.substring(cursorPosition);
    
    setInputText(newText);
    setEmojiAnchor(null);
    
    // 聚焦并设置光标位置
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(
        cursorPosition + emoji.length,
        cursorPosition + emoji.length
      );
    }, 0);
  }, [inputText]);

  // 语音录制功能
  const startVoiceRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], `voice-${Date.now()}.webm`, {
          type: 'audio/webm'
        });

        try {
          setVoiceState('processing');
          const { metadata } = await mediaFileHandler.splitFileToChunks(audioFile);
          setAttachments(prev => [...prev, metadata]);
          showSuccess('语音消息已录制');
        } catch (error) {
          showError(`语音处理失败: ${(error as Error).message}`);
        } finally {
          setVoiceState('idle');
          setRecordingTime(0);
        }

        // 停止音频流
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setVoiceState('recording');
      setRecordingTime(0);

      // 开始计时
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch {
      showError('无法访问麦克风');
    }
  }, [showSuccess, showError]);

  const stopVoiceRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  }, []);

  // 处理语音通话
  const handleVoiceCall = useCallback(() => {
    // 检查语音通话权限
    if (!canInitiateVoiceCall.hasPermission) {
      showError('没有发起语音通话权限');
      return;
    }

    try {
      onStartCall?.('audio');
    } catch (error) {
      showError(`发起语音通话失败: ${(error as Error).message}`);
    }
  }, [canInitiateVoiceCall, onStartCall, showError]);

  // 处理视频通话
  const handleVideoCall = useCallback(() => {
    // 检查视频通话权限
    if (!canInitiateVideoCall.hasPermission) {
      showError('没有发起视频通话权限');
      return;
    }

    try {
      onStartCall?.('video');
    } catch (error) {
      showError(`发起视频通话失败: ${(error as Error).message}`);
    }
  }, [canInitiateVideoCall, onStartCall, showError]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // 预加载WebRTC权限
  useEffect(() => {
    const loadPermissions = async () => {
      try {
        await preloadPermissionGroup('BASIC_CALLING');
      } catch (error) {
        console.error('权限预加载失败:', error);
      }
    };

    loadPermissions();
  }, [preloadPermissionGroup]);

  // 渲染附件预览
  const renderAttachments = () => {
    if (attachments.length === 0) return null;

    return (
      <Box sx={{ p: 1, borderTop: `1px solid ${theme.palette.divider}` }}>
        <Grid container spacing={1}>
          {attachments.map((attachment) => {
            const progress = uploadProgress.get(attachment.transferId) || 0;
            const isImage = attachment.mimeType.startsWith('image/');
            
            return (
              <Grid key={attachment.transferId} size={isImage ? 3 : 6}>
                <Paper
                  elevation={1}
                  sx={{
                    p: 1,
                    position: 'relative',
                    borderRadius: 1,
                    overflow: 'hidden'
                  }}
                >
                  {/* 预览内容 */}
                  <Box display="flex" alignItems="center" gap={1}>
                    {isImage && attachment.thumbnailData ? (
                      <Avatar
                        src={attachment.thumbnailData}
                        variant="rounded"
                        sx={{ width: 40, height: 40 }}
                      />
                    ) : (
                      <Avatar variant="rounded" sx={{ width: 40, height: 40 }}>
                        {attachment.mimeType.startsWith('video/') ? <VideoFileIcon /> :
                         attachment.mimeType.startsWith('audio/') ? <AudioFileIcon /> :
                         <FileIcon />}
                      </Avatar>
                    )}
                    
                    <Box flex={1} minWidth={0}>
                      <Typography variant="caption" noWrap>
                        {attachment.fileName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {(attachment.fileSize / 1024 / 1024).toFixed(1)} MB
                      </Typography>
                    </Box>
                    
                    <IconButton
                      size="small"
                      onClick={() => removeAttachment(attachment.transferId)}
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </Box>
                  
                  {/* 上传进度 */}
                  {progress > 0 && progress < 100 && (
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 2
                      }}
                    />
                  )}
                </Paper>
              </Grid>
            );
          })}
        </Grid>
      </Box>
    );
  };

  // 渲染@提及菜单
  const renderMentionMenu = () => {
    if (!showMentions || mode !== 'group') return null;

    return (
      <Paper
        elevation={8}
        sx={{
          position: 'absolute',
          bottom: '100%',
          left: 0,
          right: 0,
          maxHeight: 200,
          overflowY: 'auto',
          zIndex: 1000
        }}
      >
        {filteredMembers.length > 0 ? (
          filteredMembers.map((member) => (
            <MenuItem
              key={member.id}
              onClick={() => handleMentionSelect(member)}
              sx={{ py: 1 }}
            >
              <ListItemAvatar>
                <Avatar src={member.avatar_url} sx={{ width: 32, height: 32 }}>
                  {member.name.charAt(0)}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={member.name}
                secondary={member.role}
              />
            </MenuItem>
          ))
        ) : (
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              未找到匹配的成员
            </Typography>
          </MenuItem>
        )}
      </Paper>
    );
  };

  return (
    <Box sx={{ position: 'relative' }}>
      {/* 附件预览 */}
      {renderAttachments()}
      
      {/* @提及菜单 */}
      {renderMentionMenu()}
      
      {/* 语音录制状态 */}
      {voiceState === 'recording' && (
        <Paper
          elevation={3}
          sx={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            p: 2,
            bgcolor: 'error.main',
            color: 'error.contrastText',
            display: 'flex',
            alignItems: 'center',
            gap: 2
          }}
        >
          <MicIcon />
          <Box flex={1}>
            <Typography variant="body2">
              正在录制语音消息... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
            </Typography>
          </Box>
          <IconButton
            size="small"
            onClick={stopVoiceRecording}
            sx={{ color: 'inherit' }}
          >
            <StopIcon />
          </IconButton>
        </Paper>
      )}

      {/* 主输入区域 */}
      <Paper
        elevation={2}
        sx={{
          p: 1,
          display: 'flex',
          alignItems: 'flex-end',
          backgroundColor: theme.palette.background.default,
          borderTop: `1px solid ${theme.palette.divider}`,
          gap: 0.5
        }}
      >
        {/* 文件上传按钮 */}
        {fileUploadEnabled && (
          <Tooltip title="添加文件">
            <IconButton
              size="small"
              onClick={(e) => setFileMenuAnchor(e.currentTarget)}
              disabled={disabled || isUploading}
            >
              {isUploading ? <CircularProgress size={20} /> : <AttachFileIcon />}
            </IconButton>
          </Tooltip>
        )}

        {/* 表情符号按钮 */}
        <Tooltip title="表情符号">
          <IconButton
            size="small"
            onClick={(e) => setEmojiAnchor(e.currentTarget)}
            disabled={disabled}
          >
            <EmojiIcon />
          </IconButton>
        </Tooltip>

        {/* 文本输入框 */}
        <TextField
          ref={inputRef}
          fullWidth
          variant="outlined"
          size="small"
          placeholder={getPlaceholder()}
          value={inputText}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
          multiline
          maxRows={isMobile ? 3 : 4}
          disabled={disabled}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '20px',
              backgroundColor: theme.palette.background.paper,
              minHeight: 40
            }
          }}
        />

        {/* 语音录制按钮 */}
        {voiceState === 'idle' && inputText.trim() === '' && (
          <Tooltip title="录制语音消息">
            <IconButton
              size="small"
              onClick={startVoiceRecording}
              disabled={disabled}
              color="primary"
            >
              <MicIcon />
            </IconButton>
          </Tooltip>
        )}

        {/* 通话按钮 */}
        {callEnabled && !isMobile && (
          <>
            {/* 语音通话按钮 */}
            {canInitiateVoiceCall.hasPermission && (
              <Tooltip title={
                canInitiateVoiceCall.hasPermission 
                  ? "语音通话" 
                  : "没有发起语音通话权限"
              }>
                <IconButton
                  size="small"
                  onClick={handleVoiceCall}
                  disabled={disabled || !canInitiateVoiceCall.hasPermission}
                  sx={{
                    opacity: canInitiateVoiceCall.hasPermission ? 1 : 0.5
                  }}
                >
                  <CallIcon />
                </IconButton>
              </Tooltip>
            )}
            
            {/* 视频通话按钮 */}
            {canInitiateVideoCall.hasPermission && (
              <Tooltip title={
                canInitiateVideoCall.hasPermission 
                  ? "视频通话" 
                  : "没有发起视频通话权限"
              }>
                <IconButton
                  size="small"
                  onClick={handleVideoCall}
                  disabled={disabled || !canInitiateVideoCall.hasPermission}
                  sx={{
                    opacity: canInitiateVideoCall.hasPermission ? 1 : 0.5
                  }}
                >
                  <VideoCallIcon />
                </IconButton>
              </Tooltip>
            )}
          </>
        )}

        {/* 发送按钮 */}
        <Tooltip title="发送消息">
          <IconButton
            color="primary"
            onClick={handleSend}
            disabled={disabled || (inputText.trim() === '' && attachments.length === 0)}
            aria-label="send message"
          >
            <SendIcon />
          </IconButton>
        </Tooltip>
      </Paper>

      {/* 文件选择菜单 */}
      <Menu
        anchorEl={fileMenuAnchor}
        open={Boolean(fileMenuAnchor)}
        onClose={() => setFileMenuAnchor(null)}
      >
        <MenuItem onClick={() => {
          fileInputRef.current?.click();
          setFileMenuAnchor(null);
        }}>
          <PhotoIcon sx={{ mr: 1 }} />
          图片和视频
        </MenuItem>
        <MenuItem onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'audio/*';
          input.onchange = (e) => handleFileSelect((e.target as HTMLInputElement).files);
          input.click();
          setFileMenuAnchor(null);
        }}>
          <AudioFileIcon sx={{ mr: 1 }} />
          音频文件
        </MenuItem>
        <MenuItem onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.onchange = (e) => handleFileSelect((e.target as HTMLInputElement).files);
          input.click();
          setFileMenuAnchor(null);
        }}>
          <FolderIcon sx={{ mr: 1 }} />
          其他文件
        </MenuItem>
        {/* 移动端相机选项 */}
        {isMobile && (
          <MenuItem onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.capture = 'environment';
            input.onchange = (e) => handleFileSelect((e.target as HTMLInputElement).files);
            input.click();
            setFileMenuAnchor(null);
          }}>
            <CameraIcon sx={{ mr: 1 }} />
            拍照
          </MenuItem>
        )}
      </Menu>

      {/* 表情符号面板 */}
      <Popover
        open={Boolean(emojiAnchor)}
        anchorEl={emojiAnchor}
        onClose={() => setEmojiAnchor(null)}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
      >
        <Box sx={{ p: 2, maxWidth: 280 }}>
          <Grid container spacing={0.5}>
            {Object.keys(EMOJI_DATA).map((emoji) => (
              <Grid key={emoji} size={2}>
                <IconButton
                  size="small"
                  onClick={() => handleEmojiSelect(emoji)}
                  sx={{ fontSize: '1.2rem' }}
                >
                  {emoji}
                </IconButton>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Popover>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleFileSelect(e.target.files)}
      />
    </Box>
  );
};

export default ChatInput;
