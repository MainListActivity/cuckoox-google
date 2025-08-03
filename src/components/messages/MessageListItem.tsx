import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ListItem,
  ListItemText,
  ListItemIcon,
  Typography,
  Chip,
  Badge,
  Box,
  useTheme,
  alpha,
  IconButton,
  Tooltip,
  SvgIcon,
  Menu,
  MenuItem,
  Checkbox,
  Collapse,
  useMediaQuery,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  DisplayListItem,
  ConversationSummary,
  Message,
  IMMessage,
  BusinessNotificationMessage,
  ConferenceInviteMessage
} from '@/src/types/message';
import {
  ChatBubbleOutline as ChatBubbleOutlineIcon,
  NotificationsActive as NotificationsActiveIcon,
  SmartToy as SmartToyIcon,
  DeleteOutline as DeleteOutlineIcon,
  Group as GroupIcon,
  Person as PersonIcon,
  VideoCall as VideoCallIcon,
  Call as CallIcon,
  MoreVert as MoreVertIcon,
  Reply as ReplyIcon,
  Forward as ForwardIcon,
  Edit as EditIcon,
  Pin as PinIcon,
  Image as ImageIcon,
  VideoFile as VideoFileIcon,
  AudioFile as AudioFileIcon,
  AttachFile as FileIcon,
  Schedule as ScheduleIcon,
  CheckCircle as CheckCircleIcon,
  RadioButtonUnchecked as RadioButtonUncheckedIcon
} from '@mui/icons-material';
import { mdiEmailOpenOutline } from '@mdi/js';
import MediaMessageCard, { MediaMessageType } from './MediaMessageCard';
import { useAuth } from '@/src/contexts/AuthContext';
import { RecordId } from 'surrealdb';
import callManager, { CallType } from '@/src/services/callManager';
import { FileMetadata } from '@/src/services/mediaFileHandler';

// 消息类型检测函数
function getMessageMediaType(message: Message): MediaMessageType | null {
  // 检查消息类型
  if (message.type === 'CONFERENCE_INVITE') return 'conference_invite';
  
  // 检查消息内容中的附件或媒体类型指示
  const content = message.content.toLowerCase();
  
  // 通过消息内容判断（简化的实现，实际应该从附件或metadata中获取）
  if (content.includes('[图片]') || content.includes('[image]')) return 'image';
  if (content.includes('[视频]') || content.includes('[video]')) return 'video';
  if (content.includes('[音频]') || content.includes('[audio]')) return 'audio';
  if (content.includes('[文件]') || content.includes('[file]')) return 'file';
  if (content.includes('[通话]') || content.includes('[call]')) return 'call';
  
  return null;
}

// 从消息内容中提取通话数据（简化实现）
function extractCallDataFromMessage(message: Message): any {
  // 这里应该从消息的metadata或special_data中提取通话信息
  // 简化实现，返回基本通话数据
  return {
    callId: `call-${message.id}`,
    callType: 'audio' as CallType,
    duration: 120,
    status: 'completed' as const,
    participants: [
      {
        id: message.sender_id,
        name: message.sender_name || '未知用户',
        avatar_url: undefined
      }
    ],
    startTime: message.created_at,
    endTime: new Date(new Date(message.created_at).getTime() + 120000).toISOString()
  };
}

// 从消息内容中提取文件附件数据（简化实现）
function extractAttachmentFromMessage(message: Message): FileMetadata | undefined {
  // 这里应该从消息的附件数据中提取
  // 简化实现，返回模拟附件数据
  const content = message.content;
  if (content.includes('[') && content.includes(']')) {
    const fileName = content.match(/\[(.+?)\]/)?.[1] || 'unknown';
    return {
      fileName,
      fileSize: 1024 * 1024, // 1MB
      fileType: fileName.split('.').pop() || 'unknown',
      mimeType: 'application/octet-stream',
      fileHash: 'mock-hash',
      chunkSize: 64 * 1024,
      totalChunks: 16,
      transferStatus: 'completed',
      transferId: `transfer-${message.id}`,
      createdAt: Date.now()
    };
  }
  return undefined;
}

// 消息长按菜单选项
interface MessageAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}

// Define the props for the component
export interface MessageListItemProps {
  itemData: DisplayListItem;
  onSelectItem: (item: DisplayListItem) => void;
  onDeleteItem: (itemId: string | RecordId) => void;
  onMarkAsUnread: (item: DisplayListItem) => void;
  onReplyToMessage?: (messageId: RecordId | string) => void;
  onForwardMessage?: (messageId: RecordId | string) => void;
  onPinMessage?: (messageId: RecordId | string) => void;
  onEditMessage?: (messageId: RecordId | string) => void;
  onCall?: (type: CallType, targetUserId?: RecordId | string) => void;
  onConferenceResponse?: (messageId: RecordId | string, response: 'accepted' | 'declined') => void;
  selected: boolean;
  // 批量操作相关
  batchMode?: boolean;
  onBatchSelect?: (itemId: string | RecordId, selected: boolean) => void;
  batchSelected?: boolean;
  // 性能优化
  optimizeForPerformance?: boolean;
  // 可见性（用于虚拟化）
  isVisible?: boolean;
}

const MessageListItem: React.FC<MessageListItemProps> = ({
  itemData,
  onSelectItem,
  onDeleteItem,
  onMarkAsUnread,
  onReplyToMessage,
  onForwardMessage,
  onPinMessage,
  onEditMessage,
  onCall,
  onConferenceResponse,
  selected,
  batchMode = false,
  onBatchSelect,
  batchSelected = false,
  optimizeForPerformance = false,
  isVisible = true
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const { user } = useAuth();
  
  // 组件状态
  const [contextMenuAnchor, setContextMenuAnchor] = useState<HTMLElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const touchStartTime = useRef<number>(0);
  
  const { itemType } = itemData;
  const data = itemData;

  // 基础消息信息提取
  let primaryText: string;
  let secondaryText: string;
  let timestamp: string;
  let isUnread: boolean;
  let icon: React.ReactNode;
  let chipLabel: string | null = null;
  let chipColor: 'success' | 'warning' | 'info' | 'default' | 'primary' | 'secondary' | 'error' | undefined = 'default';
  let mediaType: MediaMessageType | null = null;
  let messageData: Message | null = null;
  let showMediaCard = false;

  if (itemType === 'conversation') {
    const conversation = data as ConversationSummary & { itemType: 'conversation' };
    // Primary Text: Participant names or conversation title
    if (conversation.participants.length > 2 || conversation.is_group_chat) {
      primaryText = conversation.participants.map(p => p.name).join(', ') || 'Group Chat';
      icon = <GroupIcon />;
    } else if (conversation.participants.length === 2) {
      primaryText = conversation.participants.map(p => p.name).join(' & ') || 'Conversation';
      icon = <PersonIcon />;
    } else if (conversation.participants.length === 1) {
      primaryText = conversation.participants[0]?.name || 'Self Chat';
      icon = <PersonIcon />;
    } else {
      primaryText = 'Empty Conversation';
      icon = <ChatBubbleOutlineIcon />;
    }
    if(conversation.last_message_sender_name) {
        primaryText = `${conversation.last_message_sender_name} (in ${primaryText})`;
    }

    secondaryText = conversation.last_message_snippet;
    timestamp = new Date(conversation.last_message_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    isUnread = conversation.unread_count > 0;
    chipLabel = 'IM 会话';
    chipColor = 'success';
  } else { // itemType === 'notification'
    const notification = data as Message & { itemType: 'notification' };
    messageData = notification;
    primaryText = notification.sender_name || (notification as IMMessage).sender_name || '系统通知';
    secondaryText = notification.content;
    timestamp = new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    isUnread = !notification.is_read;
    
    // 检测媒体类型
    mediaType = getMessageMediaType(notification);
    showMediaCard = mediaType !== null;

    if (notification.type === 'CASE_ROBOT_REMINDER') {
      icon = <SmartToyIcon />;
      chipLabel = '案件机器人';
      chipColor = 'info';
    } else if (notification.type === 'BUSINESS_NOTIFICATION') {
      icon = <NotificationsActiveIcon />;
      chipLabel = '系统通知';
      chipColor = 'warning';
      const bnMsg = notification as BusinessNotificationMessage;
      if(bnMsg.severity === 'error') chipColor = 'error';
      else if(bnMsg.severity === 'success') chipColor = 'success';
    } else if (notification.type === 'CONFERENCE_INVITE') {
      const confMsg = notification as ConferenceInviteMessage;
      icon = confMsg.call_type === 'video' ? <VideoCallIcon /> : <CallIcon />;
      chipLabel = '会议邀请';
      chipColor = confMsg.invitation_status === 'pending' ? 'primary' : 
                 confMsg.invitation_status === 'accepted' ? 'success' : 
                 confMsg.invitation_status === 'declined' ? 'error' : 'default';
      showMediaCard = true; // 会议邀请使用MediaCard渲染
    } else if (notification.type === 'TEXT') {
      icon = <ChatBubbleOutlineIcon />;
      chipLabel = '文本消息';
      chipColor = 'default';
    } else if (mediaType) {
      // 多媒体消息的图标
      switch (mediaType) {
        case 'image':
          icon = <ImageIcon />;
          chipLabel = '图片消息';
          chipColor = 'info';
          break;
        case 'video':
          icon = <VideoFileIcon />;
          chipLabel = '视频消息';
          chipColor = 'info';
          break;
        case 'audio':
          icon = <AudioFileIcon />;
          chipLabel = '语音消息';
          chipColor = 'info';
          break;
        case 'file':
          icon = <FileIcon />;
          chipLabel = '文件消息';
          chipColor = 'info';
          break;
        case 'call':
          icon = <CallIcon />;
          chipLabel = '通话记录';
          chipColor = 'success';
          break;
        default:
          icon = <ChatBubbleOutlineIcon />;
          chipLabel = notification.type;
          chipColor = 'default';
      }
    } else {
      icon = <ChatBubbleOutlineIcon />;
      chipLabel = notification.type;
      chipColor = 'default';
    }
  }

  const contentSnippet = showMediaCard ? 
    (mediaType === 'conference_invite' ? '会议邀请' : `[${chipLabel?.replace('消息', '') || '媒体'}]`) :
    (secondaryText.length > 50 ? `${secondaryText.substring(0, 50)}...` : secondaryText);

  // 事件处理函数
  const handleDeleteClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onDeleteItem(data.id);
  }, [data.id, onDeleteItem]);

  const handleMarkUnreadClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onMarkAsUnread(data);
  }, [data, onMarkAsUnread]);

  const handleBatchSelect = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    onBatchSelect?.(data.id, !batchSelected);
  }, [data.id, batchSelected, onBatchSelect]);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenuAnchor(event.currentTarget as HTMLElement);
  }, []);

  const handleMoreClick = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
    setContextMenuAnchor(event.currentTarget as HTMLElement);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setContextMenuAnchor(null);
  }, []);

  // 长按处理（移动端）
  const handleTouchStart = useCallback((event: React.TouchEvent) => {
    if (!isMobile) return;
    touchStartTime.current = Date.now();
    longPressTimer.current = setTimeout(() => {
      navigator.vibrate?.(50); // 触觉反馈
      handleContextMenu(event as any);
    }, 500);
  }, [isMobile, handleContextMenu]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // 媒体消息回调函数
  const handleReply = useCallback((messageId: RecordId | string) => {
    onReplyToMessage?.(messageId);
  }, [onReplyToMessage]);

  const handleForward = useCallback((messageId: RecordId | string) => {
    onForwardMessage?.(messageId);
  }, [onForwardMessage]);

  const handleCallAction = useCallback((type: CallType, targetUserId?: RecordId | string) => {
    onCall?.(type, targetUserId);
  }, [onCall]);

  const handleConferenceResponse = useCallback((messageId: RecordId | string, response: 'accepted' | 'declined') => {
    onConferenceResponse?.(messageId, response);
  }, [onConferenceResponse]);

  // 生成消息操作菜单
  const getMessageActions = useCallback((): MessageAction[] => {
    const actions: MessageAction[] = [];
    
    if (itemType === 'notification' && messageData) {
      if (onReplyToMessage) {
        actions.push({
          id: 'reply',
          label: '回复',
          icon: <ReplyIcon fontSize="small" />,
          onClick: () => {
            handleReply(messageData.id);
            handleCloseMenu();
          }
        });
      }
      
      if (onForwardMessage) {
        actions.push({
          id: 'forward',
          label: '转发',
          icon: <ForwardIcon fontSize="small" />,
          onClick: () => {
            handleForward(messageData.id);
            handleCloseMenu();
          }
        });
      }
      
      if (onEditMessage && messageData.sender_id === user?.id) {
        actions.push({
          id: 'edit',
          label: '编辑',
          icon: <EditIcon fontSize="small" />,
          onClick: () => {
            onEditMessage(messageData.id);
            handleCloseMenu();
          }
        });
      }
      
      if (onPinMessage) {
        actions.push({
          id: 'pin',
          label: '置顶',
          icon: <PinIcon fontSize="small" />,
          onClick: () => {
            onPinMessage(messageData.id);
            handleCloseMenu();
          }
        });
      }
    }
    
    // 通用操作
    if (!isUnread && itemType === 'notification') {
      actions.push({
        id: 'markUnread',
        label: '标记为未读',
        icon: <SvgIcon fontSize="small"><path d={mdiEmailOpenOutline} /></SvgIcon>,
        onClick: () => {
          handleMarkUnreadClick({} as React.MouseEvent);
          handleCloseMenu();
        }
      });
    }
    
    actions.push({
      id: 'delete',
      label: '删除',
      icon: <DeleteOutlineIcon fontSize="small" />,
      onClick: () => {
        handleDeleteClick({} as React.MouseEvent);
        handleCloseMenu();
      },
      destructive: true
    });
    
    return actions;
  }, [itemType, messageData, onReplyToMessage, onForwardMessage, onEditMessage, onPinMessage, isUnread, user?.id, handleReply, handleForward, handleMarkUnreadClick, handleDeleteClick, handleCloseMenu]);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // 性能优化：如果不可见且启用性能优化，返回简化版本
  if (optimizeForPerformance && !isVisible) {
    return (
      <ListItem
        sx={{ height: 80, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <CircularProgress size={20} />
      </ListItem>
    );
  }

  // 渲染批量选择复选框
  const renderBatchCheckbox = () => {
    if (!batchMode) return null;
    
    return (
      <Checkbox
        checked={batchSelected}
        onChange={handleBatchSelect}
        onClick={(e) => e.stopPropagation()}
        sx={{ 
          p: 1,
          '& .MuiSvgIcon-root': {
            fontSize: '1.2rem'
          }
        }}
        icon={<RadioButtonUncheckedIcon />}
        checkedIcon={<CheckCircleIcon />}
        color="primary"
      />
    );
  };

  // 渲染消息状态指示器
  const renderStatusIndicator = () => {
    if (itemType !== 'notification' || !messageData) return null;
    
    const indicators = [];
    
    // 已读状态
    if (!isUnread) {
      indicators.push(
        <Tooltip key="read" title="已读" arrow>
          <CheckCircleIcon 
            sx={{ 
              fontSize: '0.8rem', 
              color: theme.palette.success.main,
              opacity: 0.7
            }} 
          />
        </Tooltip>
      );
    }
    
    // 定时消息
    if (messageData.scheduled_time) {
      indicators.push(
        <Tooltip key="scheduled" title="定时消息" arrow>
          <ScheduleIcon 
            sx={{ 
              fontSize: '0.8rem', 
              color: theme.palette.info.main,
              opacity: 0.7
            }} 
          />
        </Tooltip>
      );
    }
    
    // 置顶消息  
    if ((messageData as any).is_pinned) {
      indicators.push(
        <Tooltip key="pinned" title="已置顶" arrow>
          <PinIcon 
            sx={{ 
              fontSize: '0.8rem', 
              color: theme.palette.warning.main,
              opacity: 0.7
            }} 
          />
        </Tooltip>
      );
    }
    
    if (indicators.length === 0) return null;
    
    return (
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', ml: 1 }}>
        {indicators}
      </Box>
    );
  };

  // 渲染媒体消息卡片
  const renderMediaCard = () => {
    if (!showMediaCard || !mediaType || !messageData) return null;
    
    const attachment = extractAttachmentFromMessage(messageData);
    const callData = mediaType === 'call' ? extractCallDataFromMessage(messageData) : undefined;
    
    return (
      <Box sx={{ mt: 1, maxWidth: isMobile ? '100%' : 300 }}>
        <MediaMessageCard
          message={messageData}
          type={mediaType}
          attachment={attachment}
          callData={callData}
          showSender={false}
          compact={true}
          maxWidth={isMobile ? window.innerWidth - 120 : 280}
          onReply={onReplyToMessage ? handleReply : undefined}
          onForward={onForwardMessage ? handleForward : undefined}
          onCall={onCall ? handleCallAction : undefined}
          onConferenceResponse={onConferenceResponse ? handleConferenceResponse : undefined}
        />
      </Box>
    );
  };

  // 渲染上下文菜单
  const renderContextMenu = () => {
    const actions = getMessageActions();
    
    return (
      <Menu
        anchorEl={contextMenuAnchor}
        open={Boolean(contextMenuAnchor)}
        onClose={handleCloseMenu}
        PaperProps={{
          sx: {
            maxHeight: 300,
            minWidth: 160
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {actions.map((action, index) => (
          <React.Fragment key={action.id}>
            {index > 0 && action.destructive && (
              <Divider sx={{ my: 0.5 }} />
            )}
            <MenuItem
              onClick={action.onClick}
              disabled={action.disabled}
              sx={{
                color: action.destructive ? theme.palette.error.main : undefined,
                '&:hover': {
                  backgroundColor: action.destructive 
                    ? alpha(theme.palette.error.main, 0.08)
                    : undefined
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {action.icon}
                <Typography variant="body2">{action.label}</Typography>
              </Box>
            </MenuItem>
          </React.Fragment>
        ))}
      </Menu>
    );
  };

  return (
    <React.Fragment>
      <ListItem
        button={!batchMode}
        onClick={batchMode ? handleBatchSelect : () => onSelectItem(data)}
        selected={selected && !batchMode}
        alignItems="flex-start"
        onContextMenu={handleContextMenu}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        secondaryAction={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {renderStatusIndicator()}
            
            {!batchMode && (
              <>
                {!isUnread && itemType === 'notification' && (
                  <Tooltip title="标记为未读">
                    <IconButton
                      edge="end"
                      onClick={handleMarkUnreadClick}
                      size="small"
                      sx={{
                        color: theme.palette.text.secondary,
                        '&:hover': {
                          color: theme.palette.info.main,
                          backgroundColor: alpha(theme.palette.info.main, 0.08)
                        }
                      }}
                    >
                      <SvgIcon fontSize="small">
                        <path d={mdiEmailOpenOutline} />
                      </SvgIcon>
                    </IconButton>
                  </Tooltip>
                )}
                
                <Tooltip title="更多操作">
                  <IconButton
                    edge="end"
                    onClick={handleMoreClick}
                    size="small"
                    sx={{
                      color: theme.palette.text.secondary,
                      '&:hover': {
                        color: theme.palette.primary.main,
                        backgroundColor: alpha(theme.palette.primary.main, 0.08)
                      }
                    }}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Box>
        }
        sx={{
          pt: 1.5,
          pb: showMediaCard ? 1 : 1.5,
          pr: theme.spacing(batchMode ? 2 : 7),
          pl: batchMode ? 0.5 : 1.5,
          // 批量模式样式
          ...(batchMode && batchSelected && {
            backgroundColor: alpha(theme.palette.primary.main, 0.12),
          }),
          // 选中状态样式
          ...(selected && !batchMode && {
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity + 0.05),
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity + 0.1),
            },
          }),
          // 未读状态样式
          ...(!selected && !batchSelected && isUnread && {
            backgroundColor: alpha(theme.palette.action.hover, 0.03),
            borderLeft: `4px solid ${theme.palette.primary.main}`,
          }),
          '&:hover': {
            backgroundColor: batchMode 
              ? alpha(theme.palette.action.hover, 0.04)
              : selected
                ? alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity + 0.1)
                : alpha(theme.palette.action.hover, 0.06),
          },
          borderBottom: `1px solid ${theme.palette.divider}`,
          '&:last-child': {
            borderBottom: 'none',
          },
          // 加载状态
          ...(isLoading && {
            opacity: 0.7,
            pointerEvents: 'none',
          }),
          // 无障碍访问
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: -2,
          },
        }}
      >
        {/* 批量选择复选框 */}
        {renderBatchCheckbox()}
        
        <ListItemIcon 
          sx={{ 
            minWidth: 'auto', 
            mr: 1.5, 
            mt: 0.5, 
            color: isUnread ? theme.palette.primary.main : theme.palette.text.secondary,
            transition: 'color 0.2s ease',
          }}
        >
          {isUnread && !selected && !batchMode ? (
            <Badge
              variant="dot"
              color="primary"
              anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
              sx={{ 
                '& .MuiBadge-dot': { 
                  transform: 'scale(0.8) translate(-2px, 2px)',
                  animation: 'pulse 2s infinite'
                } 
              }}
            >
              {icon}
            </Badge>
          ) : (
            icon
          )}
        </ListItemIcon>

        <ListItemText
          primary={
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              <Typography
                variant="subtitle1"
                component="span"
                sx={{
                  fontWeight: isUnread ? 'bold' : 'medium',
                  color: selected && !batchMode
                    ? theme.palette.primary.contrastText
                    : isUnread
                      ? theme.palette.text.primary
                      : theme.palette.text.primary,
                  maxWidth: 'calc(100% - 70px)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  transition: 'color 0.2s ease',
                }}
              >
                {primaryText}
              </Typography>
              <Typography
                variant="caption"
                component="span"
                sx={{
                  color: selected && !batchMode
                    ? theme.palette.primary.contrastText
                    : theme.palette.text.secondary,
                  fontWeight: isUnread ? 'medium' : 'normal',
                  whiteSpace: 'nowrap',
                  ml: 1,
                  transition: 'color 0.2s ease',
                }}
              >
                {timestamp}
              </Typography>
            </Box>
          }
          secondary={
            <Box>
              {!showMediaCard && (
                <Typography
                  variant="body2"
                  component="span"
                  sx={{
                    color: selected && !batchMode
                      ? alpha(theme.palette.primary.contrastText, 0.85)
                      : theme.palette.text.secondary,
                    fontWeight: isUnread && !selected && !batchMode ? 'medium' : 'normal',
                    display: '-webkit-box',
                    WebkitLineClamp: showMediaCard ? 1 : 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    mb: chipLabel ? 0.5 : 0,
                    transition: 'color 0.2s ease',
                  }}
                >
                  {contentSnippet}
                </Typography>
              )}
              
              {/* 渲染媒体消息卡片 */}
              {renderMediaCard()}
              
              {/* 消息类型标签 */}
              {chipLabel && (
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                  <Chip
                    icon={
                      itemType === 'notification' && (data as Message).type === 'CASE_ROBOT_REMINDER'
                        ? <SmartToyIcon fontSize="small" />
                        : undefined
                    }
                    label={chipLabel}
                    size="small"
                    color={chipColor as any}
                    variant={(isUnread || selected) && !batchMode ? 'filled' : 'outlined'}
                    sx={{
                      height: 'auto',
                      fontSize: '0.7rem',
                      fontWeight: 500,
                      transition: 'all 0.2s ease',
                      ...(showMediaCard && {
                        opacity: 0.8,
                        transform: 'scale(0.9)',
                      }),
                    }}
                  />
                  
                  {/* 展开/折叠按钮（对于长内容） */}
                  {showMediaCard && secondaryText.length > 100 && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpanded(!expanded);
                      }}
                      sx={{ ml: 1 }}
                    >
                      <Typography variant="caption" color="primary">
                        {expanded ? '收起' : '展开'}
                      </Typography>
                    </IconButton>
                  )}
                </Box>
              )}
              
              {/* 展开的完整内容 */}
              <Collapse in={expanded}>
                <Typography
                  variant="body2"
                  sx={{
                    mt: 1,
                    p: 1,
                    backgroundColor: alpha(theme.palette.background.paper, 0.5),
                    borderRadius: 1,
                    color: theme.palette.text.secondary,
                  }}
                >
                  {secondaryText}
                </Typography>
              </Collapse>
            </Box>
          }
          sx={{ my: 0 }}
        />
      </ListItem>
      
      {/* 上下文菜单 */}
      {renderContextMenu()}
    </React.Fragment>
  );
};

// 添加CSS动画
const styles = `
  @keyframes pulse {
    0% {
      transform: scale(0.8) translate(-2px, 2px);
      opacity: 1;
    }
    50% {
      transform: scale(1.2) translate(-2px, 2px);
      opacity: 0.7;
    }
    100% {
      transform: scale(0.8) translate(-2px, 2px);
      opacity: 1;
    }
  }
`;

// 添加样式到head
if (typeof document !== 'undefined' && !document.getElementById('message-list-item-styles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'message-list-item-styles';
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default React.memo(MessageListItem, (prevProps, nextProps) => {
  // 性能优化：只在关键属性变化时重新渲染
  if (prevProps.optimizeForPerformance && nextProps.optimizeForPerformance) {
    return (
      prevProps.itemData.id === nextProps.itemData.id &&
      prevProps.selected === nextProps.selected &&
      prevProps.batchSelected === nextProps.batchSelected &&
      prevProps.batchMode === nextProps.batchMode &&
      prevProps.isVisible === nextProps.isVisible
    );
  }
  return false;
});