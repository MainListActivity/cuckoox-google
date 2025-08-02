/// <reference types="react" />
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Avatar,
  IconButton,
  Badge,
  Chip,
  Divider,
  TextField,
  InputAdornment,
  Button,
  Card,
  CardContent,
  CardActions,
  Tabs,
  Tab,
  Alert,
  useTheme,
  useMediaQuery,
  Tooltip,
  Menu,
  MenuItem,
  CircularProgress,
  Skeleton,
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
} from '@mui/material';
import {
  Message,
  Notifications,
  Search,
  MoreVert,
  Send,
  AttachFile,
  Image as ImageIcon,
  Delete,
  Archive,
  MarkEmailRead,
  MarkEmailUnread,
  SmartToy,
  Person,
  Group,
  Warning,
  Info,
  CheckCircle,
  Add,
  Chat,
  ArrowBack,
} from '@mui/icons-material';
import MessageListItem from '@/src/components/messages/MessageListItem';
import ChatBubble, { ChatBubbleProps } from '@/src/components/messages/ChatBubble';
import ChatInput from '@/src/components/messages/ChatInput';
import NotificationCard from '@/src/components/messages/NotificationCard';
import ConferenceInviteCard from '@/src/components/messages/ConferenceInviteCard';
import CreateConversationDialog from '@/src/components/messages/CreateConversationDialog';
import {
  Message as MessageType,
  IMMessage,
  CaseRobotReminderMessage,
  BusinessNotificationMessage,
  ConferenceInviteMessage,
  ConversationSummary
} from '@/src/types/message';
import {
  useConversationsList,
  useSystemNotifications
} from '@/src/hooks/useMessageCenterData';
import { useAuth } from '@/src/contexts/AuthContext';
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { useSurrealClient } from '@/src/contexts/SurrealProvider';
import { messageService } from '@/src/services/messageService';
import { useResponsiveLayout } from '@/src/hooks/useResponsiveLayout';
import MobileOptimizedLayout from '@/src/components/mobile/MobileOptimizedLayout';
import { RecordId } from 'surrealdb';
import { idToStr } from '@/src/utils/id';

// 消息类型 (与后端 `type` 字段保持一致，便于类型收窄)
const messageTypes = {
  BUSINESS_NOTIFICATION: { label: '系统通知', icon: <Notifications />, color: 'info' },
  CASE_ROBOT_REMINDER: { label: '案件提醒', icon: <SmartToy />, color: 'warning' },
  CONFERENCE_INVITE: { label: '会议邀请', icon: <Notifications />, color: 'primary' },
  IM: { label: '用户消息', icon: <Person />, color: 'primary' },
  GROUP_IM: { label: '群组消息', icon: <Group />, color: 'secondary' },
} as const;
type MessageTypeKey = keyof typeof messageTypes;

// Define a union type for items in the left panel list
type DisplayListItem = (ConversationSummary & { itemType: 'conversation' }) | (MessageType & { itemType: 'notification' });

interface ChatMessageDisplay extends ChatBubbleProps {
  id: string;
  senderName?: string;
}

const MessageCenterPage: React.FC = () => {
  const theme = useTheme();
  const { isMobile } = useResponsiveLayout();
  const { user, selectedCaseId } = useAuth(); // Get current user and selected case
  const { showSuccess, showError, showWarning, showInfo } = useSnackbar();
  const client = useSurrealClient();

  // Fetch data using hooks
  const {
    conversations,
    isLoading: isLoadingConversations,
    error: conversationsError,
    setConversations, // Destructure setter for optimistic updates
  } = useConversationsList(user?.id || null);

  const {
    notifications,
    isLoading: isLoadingNotifications,
    error: notificationsError,
    setNotifications, // Destructure setter for optimistic updates
  } = useSystemNotifications(user?.id || null, selectedCaseId);

  // State for UI
  const [activeTab, setActiveTab] = useState(0);
  const [selectedItem, setSelectedItem] = useState<DisplayListItem | null>(null);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'im' | 'reminders'>('all');
  const [currentConversation, setCurrentConversation] = useState<ChatMessageDisplay[]>([]);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string>('');
  const [chatInput, setChatInput] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [createConversationOpen, setCreateConversationOpen] = useState(false);

  const chatHistoryEndRef = useRef<HTMLDivElement>(null);

  // Handle errors from hooks
  useEffect(() => {
    if (conversationsError) {
      const errMsg = (conversationsError as Error)?.message ?? '未知错误';
      showError(`加载会话列表失败: ${errMsg}`);
    }
    if (notificationsError) {
      const errMsg = (notificationsError as Error)?.message ?? '未知错误';
      showError(`加载通知列表失败: ${errMsg}`);
    }
  }, [conversationsError, notificationsError, showError]);

  // 统计未读消息
  const unreadCount = useMemo(() => {
    const notificationUnread = notifications.filter((n: any) => !n.is_read).length;
    const conversationUnread = conversations.reduce((count: number, conv: any) => count + (conv.unread_count || 0), 0);
    return notificationUnread + conversationUnread;
  }, [notifications, conversations]);

  // 系统/提醒消息 (目前未直接使用，但保留示例)
  const systemMessages = useMemo(
    () =>
      notifications.filter(
        (n): n is CaseRobotReminderMessage | BusinessNotificationMessage | ConferenceInviteMessage =>
          n.type === 'BUSINESS_NOTIFICATION' || n.type === 'CASE_ROBOT_REMINDER' || n.type === 'CONFERENCE_INVITE'
      ),
    [notifications]
  );

  const chatMessages = useMemo(() =>
    conversations.filter((c: any) => c.type === 'IM'),
    [conversations]
  );

  // Combine conversations and notifications into a single list for display, sorted by timestamp
  const combinedList = useMemo((): DisplayListItem[] => {
    const convItems: DisplayListItem[] = conversations.map((c: ConversationSummary) => ({
      ...c,
      itemType: 'conversation' as const,
      created_at: c.last_message_timestamp,
      updated_at: c.last_message_timestamp,
      is_read: c.unread_count === 0
    }));

    const notifItems: DisplayListItem[] = notifications.map((n: CaseRobotReminderMessage | BusinessNotificationMessage | ConferenceInviteMessage) => ({
      ...n,
      itemType: 'notification' as const
    }));

    const allItems = [...convItems, ...notifItems];

    // Sort by updated_at or created_at (last_message_timestamp for conversations)
    allItems.sort((a, b) => {
      const dateA = new Date((a as any).updated_at || (a as any).created_at || (a as any).last_message_timestamp).getTime();
      const dateB = new Date((b as any).updated_at || (b as any).created_at || (b as any).last_message_timestamp).getTime();
      return dateB - dateA; // Descending order
    });

    return allItems;
  }, [conversations, notifications]);

  // Update simulated conversation when a conversation summary is selected
  useEffect(() => {
    if (selectedItem && selectedItem.itemType === 'conversation') {
      // For now, use existing simulation logic, but use conversation details
      const convSummary = selectedItem as ConversationSummary;
      // Determine the "other" participant for display name in chat header
      const otherParticipantName = convSummary.participants.find((p: any) => p.id !== user?.id)?.name || convSummary.last_message_sender_name || '对方';

      const simulatedConvo: ChatMessageDisplay[] = [
        { id: 'sim1', messageText: convSummary.last_message_snippet, timestamp: new Date(convSummary.last_message_timestamp).toLocaleTimeString(), isSender: false, senderName: convSummary.last_message_sender_name || otherParticipantName },
        { id: 'sim2', messageText: '好的，我明白了。我会尽快处理。', timestamp: new Date(Date.parse(convSummary.last_message_timestamp) + 60000).toLocaleTimeString(), isSender: true, senderName: 'You' },
      ];
      setCurrentConversation(simulatedConvo);
    } else {
      setCurrentConversation([]);
    }
  }, [selectedItem, user?.id]);

  useEffect(() => {
    chatHistoryEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation]);

  // 处理菜单
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, messageId: RecordId | string) => {
    setAnchorEl(event.currentTarget);
    setSelectedMessageId(idToStr(messageId));
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMessageId('');
  };

  const handleSelectItem = useCallback(async (item: DisplayListItem): Promise<void> => {
    setSelectedItem(item);

    if (item.itemType === 'notification' && !item.is_read && client) {
      try {
        // Optimistic UI update
        setNotifications((prev: (CaseRobotReminderMessage | BusinessNotificationMessage | ConferenceInviteMessage)[]) =>
          prev.map((n: CaseRobotReminderMessage | BusinessNotificationMessage | ConferenceInviteMessage) =>
            n.id === item.id ? { ...n, is_read: true, updated_at: new Date().toISOString() } : n
          )
        );
        await client.merge(String(item.id), {
          is_read: true,
          updated_at: new Date().toISOString()
        });
        showSuccess('通知已标记为已读');
      } catch (error) {
        console.error("Error marking notification as read:", error);
        showError('标记通知为已读失败');
        // Revert optimistic update on error
        setNotifications((prev: (CaseRobotReminderMessage | BusinessNotificationMessage | ConferenceInviteMessage)[]) =>
          prev.map((n: CaseRobotReminderMessage | BusinessNotificationMessage | ConferenceInviteMessage) =>
            n.id === item.id ? { ...n, is_read: false, updated_at: (item as BusinessNotificationMessage | CaseRobotReminderMessage | ConferenceInviteMessage).updated_at } : n
          )
        );
      }
    }
  }, [client, showSuccess, showError, setNotifications]);

  const handleMarkAsRead = useCallback(async () => {
    if (!selectedMessageId || !client) return;

    try {
      // Find the item in our lists
      const item = [...notifications, ...conversations].find((item) => idToStr(item.id) === selectedMessageId);
      if (!item) return;

      // Optimistic UI update
      if ('is_read' in item) {
        setNotifications((prev: (CaseRobotReminderMessage | BusinessNotificationMessage | ConferenceInviteMessage)[]) =>
          prev.map((n: CaseRobotReminderMessage | BusinessNotificationMessage | ConferenceInviteMessage) =>
            n.id === selectedMessageId ? { ...n, is_read: true, updated_at: new Date().toISOString() } : n
          )
        );
      }

      await client.merge(String(selectedMessageId), {
        is_read: true,
        updated_at: new Date().toISOString()
      });

      showSuccess('消息已标记为已读');
      handleMenuClose();
    } catch (error) {
      console.error("Error marking as read:", error);
      showError('操作失败');
    }
  }, [selectedMessageId, client, notifications, conversations, setNotifications, showSuccess, showError]);

  const handleMarkAsUnread = useCallback(async () => {
    if (!selectedMessageId || !client) return;

    try {
      // Find the item in our lists
      const item = [...notifications, ...conversations].find((item) => idToStr(item.id) === selectedMessageId);
      if (!item) return;

      // Optimistic UI update
      if ('is_read' in item) {
        setNotifications((prev: (CaseRobotReminderMessage | BusinessNotificationMessage | ConferenceInviteMessage)[]) =>
          prev.map((n: CaseRobotReminderMessage | BusinessNotificationMessage | ConferenceInviteMessage) =>
            n.id === selectedMessageId ? { ...n, is_read: false, updated_at: new Date().toISOString() } : n
          )
        );
      }

      await client.merge(String(selectedMessageId), {
        is_read: false,
        updated_at: new Date().toISOString()
      });

      showSuccess('消息已标记为未读');
      handleMenuClose();
    } catch (error) {
      console.error("Error marking as unread:", error);
      showError('操作失败');
    }
  }, [selectedMessageId, client, notifications, conversations, setNotifications, showSuccess, showError]);

  const handleDelete = useCallback(async () => {
    if (!selectedMessageId || !client) return;

    try {
      // Find the item in our lists
      const item = [...notifications, ...conversations].find((item) => idToStr(item.id) === selectedMessageId);
      if (!item) return;

      // Optimistic UI update
      if ('type' in item && (item.type === 'BUSINESS_NOTIFICATION' || item.type === 'CASE_ROBOT_REMINDER' || item.type === 'CONFERENCE_INVITE')) {
        setNotifications((prev: (CaseRobotReminderMessage | BusinessNotificationMessage | ConferenceInviteMessage)[]) => prev.filter((n: CaseRobotReminderMessage | BusinessNotificationMessage | ConferenceInviteMessage) => n.id !== selectedMessageId));
      } else {
        setConversations((prev: ConversationSummary[]) => prev.filter((c: ConversationSummary) => c.id !== selectedMessageId));
      }

      await client.delete(String(selectedMessageId));

      showSuccess('消息已删除');
      handleMenuClose();

      // If the deleted item was selected, clear selection
      if (selectedItem && selectedItem.id === selectedMessageId) {
        setSelectedItem(null);
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      showError('删除失败');
    }
  }, [selectedMessageId, client, notifications, conversations, selectedItem, setNotifications, setConversations, showSuccess, showError]);

  const handleArchive = useCallback(async (): Promise<void> => {
    if (!selectedMessageId || !client) return;

    try {
      await client.merge(String(selectedMessageId), {
        archived: true,
        updated_at: new Date().toISOString()
      });

      // Optimistic UI update
      const updatedList: DisplayListItem[] = combinedList.filter((item: DisplayListItem) => idToStr(item.id) !== selectedMessageId);
      if (selectedItem && selectedItem.id === selectedMessageId) {
        setSelectedItem(null);
      }

      showSuccess('消息已归档');
      handleMenuClose();
    } catch (error) {
      console.error("Error archiving item:", error);
      showError('归档失败');
    }
  }, [selectedMessageId, client, combinedList, selectedItem, showSuccess, showError]);

  const handleSendMessage = useCallback(async () => {
    if (!chatInput.trim() || !selectedItem || selectedItem.itemType !== 'conversation' || !user?.id) {
      if (!selectedItem || selectedItem.itemType !== 'conversation') {
        showWarning('请先选择一个会话以发送消息。');
      }
      return;
    }

    const convSummary = selectedItem as ConversationSummary;

    // Optimistic UI update for the new message in conversation
    const newMessage: ChatMessageDisplay = {
      id: `temp-${Date.now()}`,
      messageText: chatInput,
      timestamp: new Date().toLocaleTimeString(),
      isSender: true,
      senderName: user.name || '我',
    };
    setCurrentConversation((prev: ChatMessageDisplay[]) => [...prev, newMessage]);
    setChatInput('');

    try {
      // Send message using messageService
      const message = await messageService.sendMessage({
        conversation_id: convSummary.id,
        content: chatInput
      });
      console.log('Message sent:', message);

      // Update conversation list with new message info
      setConversations((prev: ConversationSummary[]) =>
        prev.map(c =>
          c.id === convSummary.id
            ? {
              ...c,
              last_message_snippet: chatInput,
              last_message_timestamp: new Date().toISOString(),
              last_message_sender_name: user.name || '我',
              updated_at: new Date().toISOString()
            }
            : c
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);
      showError('发送消息失败');
      // Revert optimistic update on error
      setCurrentConversation((prev: ChatMessageDisplay[]) => prev.filter((msg: ChatMessageDisplay) => msg.id !== newMessage.id));
      setChatInput(chatInput);
    }
      }, [chatInput, selectedItem, user, setConversations, showWarning, showError]);

  const handleConversationCreated = useCallback((_conversationId: RecordId | string) => {
    // 临时刷新页面，后续可改为局部数据刷新
    window.location.reload();
    setCreateConversationOpen(false);
    showSuccess('会话创建成功');
  }, [showSuccess]);

  const filteredDisplayList = useMemo((): DisplayListItem[] => {
    if (currentFilter === 'im') {
      return combinedList.filter((item: DisplayListItem) => item.itemType === 'conversation');
    }
    if (currentFilter === 'reminders') {
      return combinedList.filter((item: DisplayListItem) => item.itemType === 'notification');
    }
    return combinedList; // 'all'
  }, [combinedList, currentFilter]);

  // 渲染消息列表项
  const renderMessageItem = (message: DisplayListItem) => {
    const isNotif = message.itemType === 'notification';
    const notifMsg = isNotif ? (message as BusinessNotificationMessage | CaseRobotReminderMessage | ConferenceInviteMessage) : undefined;
    const primaryText = isNotif ? (notifMsg?.title ?? '通知') : (message as ConversationSummary).last_message_sender_name ?? '会话';
    const hasHighPriority = isNotif && notifMsg?.priority === 'high';
    const avatarColorKey: MessageTypeKey = isNotif ? (notifMsg!.type as MessageTypeKey) : 'IM';

    return (
      <React.Fragment key={message.id}>
        <ListItem
          onClick={() => handleSelectItem(message)}
          sx={{
            cursor: 'pointer',
            backgroundColor: (message as any).unread ? 'action.hover' : 'transparent',
            '&:hover': { backgroundColor: 'action.hover' },
            '&.Mui-selected': { backgroundColor: 'action.selected' },
          }}
        >
          <ListItemAvatar>
            <Badge color="error" variant="dot" invisible={!((message as any).unread)}>
              <Avatar sx={{ bgcolor: theme.palette[messageTypes[avatarColorKey].color as 'info' | 'warning' | 'primary' | 'secondary'].main }}>
                {typeof (message as any).avatar === 'string' ? (message as any).avatar : messageTypes[avatarColorKey].icon}
              </Avatar>
            </Badge>
          </ListItemAvatar>
          <ListItemText
            primary={<Box display="flex" alignItems="center" gap={1}><Typography variant="subtitle2" fontWeight={(message as any).unread ? 'bold' : 'normal'}>{primaryText}</Typography>{hasHighPriority && (<Chip label="重要" size="small" color="error" sx={{ height: 20 }} />)}{(message as any).hasAttachment && (<AttachFile fontSize="small" color="action" />)}</Box>}
            secondary={<Typography variant="body2" color="text.secondary" noWrap>{isNotif ? notifMsg?.content : (message as ConversationSummary).last_message_snippet}</Typography>}
          />
          <ListItemSecondaryAction>
            <Box display="flex" flexDirection="column" alignItems="flex-end">
              <Typography variant="caption" color="text.secondary">{(message as any).time || new Date(((message as any).updated_at || (message as any).created_at || (message as any).last_message_timestamp)).toLocaleTimeString()}</Typography>
              <IconButton edge="end" size="small" onClick={(e: React.MouseEvent<HTMLButtonElement>) => { e.stopPropagation(); handleMenuOpen(e, message.id); }}>
                <MoreVert fontSize="small" />
              </IconButton>
            </Box>
          </ListItemSecondaryAction>
        </ListItem>
        <Divider variant="inset" component="li" />
      </React.Fragment>
    );
  };

  // Mobile rendering
  if (isMobile) {
    // Mobile conversation view
    if (selectedItem) {
      return (
        <MobileOptimizedLayout
          title={selectedItem.itemType === 'conversation'
            ? (selectedItem.participants?.find((p: any) => p.id !== user?.id)?.name || '对话')
            : (selectedItem.title || '系统通知')}
          showBackButton={true}
          onBackClick={() => setSelectedItem(null)}
        >
          <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {selectedItem.itemType === 'conversation' ? (
              // Mobile chat interface
              <>
                {/* Mobile chat messages */}
                <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                  {currentConversation.map((msg: ChatMessageDisplay) => (
                    <Box
                      key={msg.id}
                      sx={{
                        display: 'flex',
                        flexDirection: msg.isSender ? 'row-reverse' : 'row',
                        mb: 2,
                        alignItems: 'flex-end',
                      }}
                    >
                      <Avatar
                        sx={{
                          bgcolor: msg.isSender ? 'primary.main' : 'secondary.main',
                          width: 32,
                          height: 32,
                          mr: msg.isSender ? 0 : 1,
                          ml: msg.isSender ? 1 : 0,
                          fontSize: '0.875rem'
                        }}
                      >
                        {msg.isSender ? '我' : (msg.senderName?.[0] || '对')}
                      </Avatar>
                      <Box
                        sx={{
                          maxWidth: '80%',
                          p: 2,
                          borderRadius: msg.isSender ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                          bgcolor: msg.isSender ? 'primary.main' : 'background.paper',
                          color: msg.isSender ? 'primary.contrastText' : 'text.primary',
                          boxShadow: 1,
                          mb: 0.5,
                        }}
                      >
                        <Typography variant="body2" sx={{ lineHeight: 1.4 }}>
                          {msg.messageText}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          color={msg.isSender ? 'inherit' : 'text.secondary'} 
                          sx={{ 
                            display: 'block', 
                            mt: 0.5, 
                            textAlign: 'right',
                            opacity: 0.8,
                            fontSize: '0.7rem'
                          }}
                        >
                          {msg.timestamp}
                        </Typography>
                      </Box>
                    </Box>
                  ))}
                  <div ref={chatHistoryEndRef} />
                </Box>

                {/* Mobile chat input */}
                <Box 
                  sx={{ 
                    p: 2, 
                    borderTop: 1, 
                    borderColor: 'divider',
                    backgroundColor: 'background.paper'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                    <TextField
                      fullWidth
                      placeholder="输入消息..."
                      value={chatInput}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChatInput(e.target.value)}
                      multiline
                      maxRows={4}
                      variant="outlined"
                      size="small"
                      inputProps={{ 
                        style: { fontSize: 16 } // Prevent zoom on iOS
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: '20px',
                          minHeight: '44px', // Touch-friendly minimum height
                        }
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <IconButton
                      sx={{
                        minWidth: '44px',
                        minHeight: '44px',
                        bgcolor: 'grey.100',
                        '&:hover': { bgcolor: 'grey.200' }
                      }}
                    >
                      <AttachFile />
                    </IconButton>
                    <IconButton
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim()}
                      sx={{
                        minWidth: '44px',
                        minHeight: '44px',
                        bgcolor: 'primary.main',
                        color: 'primary.contrastText',
                        '&:hover': { bgcolor: 'primary.dark' },
                        '&.Mui-disabled': { 
                          bgcolor: 'grey.300', 
                          color: 'grey.500' 
                        }
                      }}
                    >
                      <Send />
                    </IconButton>
                  </Box>
                </Box>
              </>
            ) : (
              // Mobile notification view
              <Box sx={{ p: 2, flexGrow: 1, overflow: 'auto' }}>
                {selectedItem.type === 'CONFERENCE_INVITE' ? (
                  // Mobile 会议邀请卡片
                  <ConferenceInviteCard
                    message={selectedItem as ConferenceInviteMessage}
                    onResponse={(response, responseMessage) => {
                      showSuccess(`会议邀请已${response === 'accepted' ? '接受' : '拒绝'}`);
                      // 这里可以添加刷新逻辑或更新状态
                    }}
                    onJoinMeeting={(conferenceId) => {
                      showInfo(`正在加入会议: ${conferenceId}`);
                      // 这里可以添加跳转到会议界面的逻辑
                    }}
                    onError={(error) => {
                      showError(`操作失败: ${error.message}`);
                    }}
                    isCurrentUser={selectedItem.sender_id === user?.id}
                    showActions={true}
                    compact={true} // Mobile 紧凑模式
                  />
                ) : (
                  // 其他 Mobile 通知
                  <>
                    <Card sx={{ mb: 3 }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Avatar
                            sx={{
                              bgcolor: theme.palette[messageTypes[selectedItem.type as MessageTypeKey]?.color as 'info' | 'warning' | 'primary' | 'secondary'].main,
                              mr: 2,
                            }}
                          >
                            {messageTypes[selectedItem.type as MessageTypeKey]?.icon}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="h6" fontWeight="600">
                              {selectedItem.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {new Date(selectedItem.created_at).toLocaleString()}
                            </Typography>
                          </Box>
                        </Box>
                        <Typography variant="body1" paragraph sx={{ lineHeight: 1.6 }}>
                          {selectedItem.content}
                        </Typography>
                        {selectedItem.priority === 'high' && (
                          <Alert severity="warning" sx={{ mt: 2 }}>
                            此消息为重要通知，请及时处理。
                          </Alert>
                        )}
                      </CardContent>
                    </Card>

                    {/* Mobile notification actions */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Button
                        variant="contained"
                        fullWidth
                        size="large"
                        startIcon={<MarkEmailRead />}
                        onClick={handleMarkAsRead}
                        disabled={selectedItem.is_read}
                        sx={{ minHeight: '48px' }}
                      >
                        标记为已读
                      </Button>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="outlined"
                          fullWidth
                          size="large"
                          startIcon={<Archive />}
                          onClick={handleArchive}
                          sx={{ minHeight: '48px' }}
                        >
                          归档
                        </Button>
                        <Button
                          variant="outlined"
                          fullWidth
                          size="large"
                          color="error"
                          startIcon={<Delete />}
                          onClick={handleDelete}
                          sx={{ minHeight: '48px' }}
                        >
                          删除
                        </Button>
                      </Box>
                    </Box>
                  </>
                )}
              </Box>
            )}
          </Box>
        </MobileOptimizedLayout>
      );
    }

    // Mobile message list view
    return (
      <MobileOptimizedLayout
        title="消息中心"
        showBackButton={false}
        fabConfig={{
          icon: <Add />,
          action: () => setCreateConversationOpen(true),
          ariaLabel: "新建对话",
        }}
      >
        <Box sx={{ p: 0 }}>
          {/* Mobile search and filters */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: 'background.paper' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight="600">
                消息中心
              </Typography>
              <Badge badgeContent={unreadCount} color="error">
                <Chip label="未读消息" color="primary" variant="outlined" size="small" />
              </Badge>
            </Box>
            <TextField
              fullWidth
              placeholder="搜索消息..."
              value={searchKeyword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchKeyword(e.target.value)}
              size="small"
              inputProps={{ 
                style: { fontSize: 16 } // Prevent zoom on iOS
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: '20px',
                  minHeight: '44px',
                }
              }}
            />
            <Tabs
              value={activeTab}
              onChange={(e: React.SyntheticEvent, newValue: number) => setActiveTab(newValue)}
              sx={{ mt: 2 }}
              variant="fullWidth"
              textColor="primary"
              indicatorColor="primary"
            >
              <Tab label="全部" />
              <Tab label="聊天" />
              <Tab label="通知" />
            </Tabs>
          </Box>

          {/* Mobile message list */}
          <Box sx={{ overflow: 'auto', height: 'calc(100vh - 200px)' }}>
            {isLoadingConversations || isLoadingNotifications ? (
              // Mobile loading state
              <Box sx={{ p: 2 }}>
                {Array.from(new Array(5)).map((_, index) => (
                  <Card key={index} sx={{ mb: 2 }}>
                    <CardContent sx={{ display: 'flex', alignItems: 'center' }}>
                      <Skeleton variant="circular" width={48} height={48} sx={{ mr: 2 }} />
                      <Box sx={{ flex: 1 }}>
                        <Skeleton width="80%" height={20} sx={{ mb: 1 }} />
                        <Skeleton width="60%" height={16} />
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            ) : filteredDisplayList.length > 0 ? (
              // Mobile message cards
              <Box sx={{ p: 2 }}>
                {filteredDisplayList.map((message) => {
                  const isNotif = message.itemType === 'notification';
                  const notifMsg = isNotif ? (message as BusinessNotificationMessage | CaseRobotReminderMessage | ConferenceInviteMessage) : undefined;
                  const primaryText = isNotif ? (notifMsg?.title ?? '通知') : (message as ConversationSummary).last_message_sender_name ?? '会话';
                  const hasHighPriority = isNotif && notifMsg?.priority === 'high';
                  const avatarColorKey: MessageTypeKey = isNotif ? (notifMsg!.type as MessageTypeKey) : 'IM';
                  
                  return (
                    <Card 
                      key={message.id} 
                      sx={{ 
                        mb: 2, 
                        cursor: 'pointer',
                        backgroundColor: (message as any).unread ? 'action.hover' : 'transparent',
                        '&:hover': { backgroundColor: 'action.hover' },
                        '&:active': { backgroundColor: 'action.selected' },
                        minHeight: '80px'
                      }}
                      onClick={() => handleSelectItem(message)}
                    >
                      <CardContent sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
                        <Badge color="error" variant="dot" invisible={!((message as any).unread)}>
                          <Avatar 
                            sx={{ 
                              bgcolor: theme.palette[messageTypes[avatarColorKey].color as 'info' | 'warning' | 'primary' | 'secondary'].main,
                              width: 48,
                              height: 48,
                              mr: 2
                            }}
                          >
                            {typeof (message as any).avatar === 'string' ? (message as any).avatar : messageTypes[avatarColorKey].icon}
                          </Avatar>
                        </Badge>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography 
                              variant="subtitle2" 
                              fontWeight={(message as any).unread ? 'bold' : 'normal'}
                              sx={{ flex: 1 }}
                              noWrap
                            >
                              {primaryText}
                            </Typography>
                            {hasHighPriority && (
                              <Chip label="重要" size="small" color="error" sx={{ height: 20 }} />
                            )}
                            {(message as any).hasAttachment && (
                              <AttachFile fontSize="small" color="action" />
                            )}
                          </Box>
                          <Typography 
                            variant="body2" 
                            color="text.secondary" 
                            sx={{ 
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.4
                            }}
                          >
                            {isNotif ? notifMsg?.content : (message as ConversationSummary).last_message_snippet}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                            {(message as any).time || new Date(((message as any).updated_at || (message as any).created_at || (message as any).last_message_timestamp)).toLocaleString()}
                          </Typography>
                        </Box>
                        <IconButton 
                          edge="end" 
                          onClick={(e: React.MouseEvent<HTMLButtonElement>) => { 
                            e.stopPropagation(); 
                            handleMenuOpen(e, message.id); 
                          }}
                          sx={{
                            minWidth: '44px',
                            minHeight: '44px'
                          }}
                        >
                          <MoreVert />
                        </IconButton>
                      </CardContent>
                    </Card>
                  );
                })}
              </Box>
            ) : (
              // Mobile empty state
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '50vh',
                p: 3,
                textAlign: 'center'
              }}>
                <Message sx={{ fontSize: 80, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  暂无消息
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  开始新的对话或等待其他人联系您
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={() => setCreateConversationOpen(true)}
                  sx={{ minHeight: '48px', px: 3 }}
                >
                  新建对话
                </Button>
              </Box>
            )}
          </Box>
        </Box>

        {/* 创建会话对话框 */}
        <CreateConversationDialog
          open={createConversationOpen}
          onClose={() => setCreateConversationOpen(false)}
          onCreated={handleConversationCreated}
        />

        {/* 消息操作菜单 */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
        >
          <MenuItem onClick={handleMarkAsRead}>
            <MarkEmailRead fontSize="small" sx={{ mr: 1 }} />
            标记为已读
          </MenuItem>
          <MenuItem onClick={handleMarkAsUnread}>
            <MarkEmailUnread fontSize="small" sx={{ mr: 1 }} />
            标记为未读
          </MenuItem>
          <MenuItem onClick={handleArchive}>
            <Archive fontSize="small" sx={{ mr: 1 }} />
            归档
          </MenuItem>
          <MenuItem onClick={handleDelete}>
            <Delete fontSize="small" sx={{ mr: 1 }} />
            删除
          </MenuItem>
        </Menu>
      </MobileOptimizedLayout>
    );
  }

  // Desktop rendering
  return (
    <Box>
      {/* 页面标题 */}
      <Box mb={3} display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h4" fontWeight="bold">
          消息中心
        </Typography>
        <Badge badgeContent={unreadCount} color="error">
          <Chip label="未读消息" color="primary" variant="outlined" />
        </Badge>
      </Box>

      {/* 主内容区域 */}
      <Grid container spacing={2}>
        {/* 左侧消息列表 */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ height: '70vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
            {/* 搜索框和过滤器 */}
            <Box p={2} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <TextField
                fullWidth
                placeholder="搜索消息..."
                value={searchKeyword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchKeyword(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search />
                    </InputAdornment>
                  ),
                }}
                size="small"
              />
              <Tabs
                value={activeTab}
                onChange={(e: React.SyntheticEvent, newValue: number) => setActiveTab(newValue)}
                sx={{ mt: 1 }}
                variant="fullWidth"
              >
                <Tab label="全部" />
                <Tab label="聊天" />
                <Tab label="通知" />
              </Tabs>
            </Box>

            {/* 消息列表 */}
            <List sx={{ overflow: 'auto', flexGrow: 1 }}>
              {isLoadingConversations || isLoadingNotifications ? (
                // 加载状态
                Array.from(new Array(5)).map((_, index) => (
                  <React.Fragment key={index}>
                    <ListItem>
                      <ListItemAvatar>
                        <Skeleton variant="circular" width={40} height={40} />
                      </ListItemAvatar>
                      <ListItemText
                        primary={<Skeleton width="80%" />}
                        secondary={<Skeleton width="60%" />}
                      />
                    </ListItem>
                    <Divider variant="inset" component="li" />
                  </React.Fragment>
                ))
              ) : filteredDisplayList.length > 0 ? (
                // 有消息时显示列表
                filteredDisplayList.map(renderMessageItem)
              ) : (
                // 无消息时显示提示
                <Box p={3} textAlign="center">
                  <Typography color="text.secondary">暂无消息</Typography>
                </Box>
              )}
            </List>
            
            {/* 创建会话按钮 */}
            <Box
              sx={{
                position: 'absolute',
                bottom: 16,
                right: 16,
              }}
            >
              <IconButton
                color="primary"
                sx={{
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    bgcolor: 'primary.dark',
                  },
                  boxShadow: 3,
                }}
                onClick={() => setCreateConversationOpen(true)}
              >
                <Add />
              </IconButton>
            </Box>
          </Paper>
        </Grid>

        {/* 右侧消息详情 */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
            {selectedItem ? (
              <>
                {/* 消息详情头部 */}
                <Box p={2} sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
                  <Typography variant="h6" noWrap>
                    {selectedItem.itemType === 'conversation'
                      ? (selectedItem.participants?.find((p: any) => p.id !== user?.id)?.name || '对话')
                      : (selectedItem.title || '系统通知')}
                  </Typography>
                </Box>

                {/* 消息内容 */}
                {selectedItem.itemType === 'conversation' ? (
                  // 聊天消息
                  <>
                    <Box p={2} sx={{ flexGrow: 1, overflow: 'auto' }}>
                      {currentConversation.map((msg: ChatMessageDisplay) => (
                        <Box
                          key={msg.id}
                          sx={{
                            display: 'flex',
                            flexDirection: msg.isSender ? 'row-reverse' : 'row',
                            mb: 2,
                          }}
                        >
                          <Avatar
                            sx={{
                              bgcolor: msg.isSender ? 'primary.main' : 'secondary.main',
                              width: 36,
                              height: 36,
                              mr: msg.isSender ? 0 : 1,
                              ml: msg.isSender ? 1 : 0,
                            }}
                          >
                            {msg.isSender ? 'Me' : msg.senderName?.[0]}
                          </Avatar>
                          <Box
                            sx={{
                              maxWidth: '70%',
                              p: 1.5,
                              borderRadius: 2,
                              bgcolor: msg.isSender ? 'primary.light' : 'background.default',
                              color: msg.isSender ? 'primary.contrastText' : 'text.primary',
                            }}
                          >
                            <Typography variant="body2">{msg.messageText}</Typography>
                            <Typography variant="caption" color={msg.isSender ? 'inherit' : 'text.secondary'} sx={{ display: 'block', mt: 0.5, textAlign: 'right' }}>
                              {msg.timestamp}
                            </Typography>
                          </Box>
                        </Box>
                      ))}
                      <div ref={chatHistoryEndRef} />
                    </Box>
                    <Box p={2} sx={{ borderTop: 1, borderColor: 'divider' }}>
                      <TextField
                        fullWidth
                        placeholder="输入消息..."
                        value={chatInput}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setChatInput(e.target.value)}
                        multiline
                        rows={2}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton>
                                <AttachFile />
                              </IconButton>
                              <Button
                                variant="contained"
                                endIcon={<Send />}
                                onClick={handleSendMessage}
                                disabled={!chatInput.trim()}
                              >
                                发送
                              </Button>
                            </InputAdornment>
                          ),
                        }}
                      />
                    </Box>
                  </>
                ) : (
                  // 系统通知
                  <Box p={3} sx={{ flexGrow: 1, overflow: 'auto' }}>
                    {selectedItem.type === 'CONFERENCE_INVITE' ? (
                      // 会议邀请卡片
                      <ConferenceInviteCard
                        message={selectedItem as ConferenceInviteMessage}
                        onResponse={(response, responseMessage) => {
                          showSuccess(`会议邀请已${response === 'accepted' ? '接受' : '拒绝'}`);
                          // 这里可以添加刷新逻辑或更新状态
                        }}
                        onJoinMeeting={(conferenceId) => {
                          showInfo(`正在加入会议: ${conferenceId}`);
                          // 这里可以添加跳转到会议界面的逻辑
                        }}
                        onError={(error) => {
                          showError(`操作失败: ${error.message}`);
                        }}
                        isCurrentUser={selectedItem.sender_id === user?.id}
                        showActions={true}
                        compact={false}
                      />
                    ) : (
                      // 其他系统通知
                      <Card>
                        <CardContent>
                          <Box display="flex" alignItems="center" mb={2}>
                            <Avatar
                              sx={{
                                bgcolor: theme.palette[messageTypes[selectedItem.type as MessageTypeKey]?.color as 'info' | 'warning' | 'primary' | 'secondary'].main,
                                mr: 2,
                              }}
                            >
                              {messageTypes[selectedItem.type as MessageTypeKey]?.icon}
                            </Avatar>
                            <Box>
                              <Typography variant="h6">{selectedItem.title}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {new Date(selectedItem.created_at).toLocaleString()}
                              </Typography>
                            </Box>
                          </Box>
                          <Typography variant="body1" paragraph>
                            {selectedItem.content}
                          </Typography>
                          {selectedItem.priority === 'high' && (
                            <Alert severity="warning" sx={{ mt: 2 }}>
                              此消息为重要通知，请及时处理。
                            </Alert>
                          )}
                        </CardContent>
                        <CardActions>
                          <Button
                            startIcon={<MarkEmailRead />}
                            onClick={handleMarkAsRead}
                            disabled={selectedItem.is_read}
                          >
                            标记为已读
                          </Button>
                          <Button
                            startIcon={<Archive />}
                            onClick={handleArchive}
                          >
                            归档
                          </Button>
                          <Button
                            startIcon={<Delete />}
                            color="error"
                            onClick={handleDelete}
                          >
                            删除
                          </Button>
                        </CardActions>
                      </Card>
                    )}
                  </Box>
                )}
              </>
            ) : (
              // 未选择消息时显示提示
              <Box
                display="flex"
                flexDirection="column"
                justifyContent="center"
                alignItems="center"
                height="100%"
              >
                <Message sx={{ fontSize: 60, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  请选择一条消息查看详情
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* 消息操作菜单 */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMarkAsRead}>
          <MarkEmailRead fontSize="small" />
          标记为已读
        </MenuItem>
        <MenuItem onClick={handleMarkAsUnread}>
          <MarkEmailUnread fontSize="small" />
          标记为未读
        </MenuItem>
        <MenuItem onClick={handleArchive}>
          <Archive fontSize="small" />
          归档
        </MenuItem>
        <MenuItem onClick={handleDelete}>
          <Delete fontSize="small" />
          删除
        </MenuItem>
      </Menu>
      
      {/* 创建会话对话框 */}
      <CreateConversationDialog
        open={createConversationOpen}
        onClose={() => setCreateConversationOpen(false)}
        onCreated={handleConversationCreated}
      />
    </Box>
  );
};

export default MessageCenterPage;
