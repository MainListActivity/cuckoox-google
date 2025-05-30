import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  Grid,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MessageListItem from '@/src/components/messages/MessageListItem';
import ChatBubble, { ChatBubbleProps } from '@/src/components/messages/ChatBubble';
import ChatInput from '@/src/components/messages/ChatInput';
import NotificationCard from '@/src/components/messages/NotificationCard';
import { 
  Message, 
  IMMessage, 
  CaseRobotReminderMessage, 
  BusinessNotificationMessage,
  ConversationSummary
} from '@/src/types/message'; 
import { 
  useConversationsList, 
  useSystemNotifications 
} from '@/src/hooks/useMessageCenterData'; 
import { useAuth } from '@/src/contexts/AuthContext'; 
import { useSnackbar } from '@/src/contexts/SnackbarContext';
import { useSurrealClient } from '@/src/contexts/SurrealProvider';
import { CircularProgress, Skeleton, ListItem, ListItemIcon, ListItemText } from '@mui/material'; // Added Skeleton components

// Define a union type for items in the left panel list
type DisplayListItem = (ConversationSummary & { itemType: 'conversation' }) | (Message & { itemType: 'notification' });

interface ChatMessageDisplay extends ChatBubbleProps {
  id: string; 
  senderName?: string;
}


const MessageCenterPage: React.FC = () => {
  const theme = useTheme();
  const { user, selectedCaseId } = useAuth(); // Get current user and selected case
  const { showSuccess, showError, showWarning, showInfo } = useSnackbar();
  const client = useSurrealClient();

  // Fetch data using new hooks
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

  // State for selected item (can be ConversationSummary or Message for notification)
  const [selectedItem, setSelectedItem] = useState<DisplayListItem | null>(null);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'im' | 'reminders'>('all');
  const [currentConversation, setCurrentConversation] = useState<ChatMessageDisplay[]>([]);
  const chatHistoryEndRef = useRef<HTMLDivElement>(null); 

  // Handle errors from hooks
  useEffect(() => {
    if (conversationsError) {
      showError(`加载会话列表失败: ${conversationsError.message || '未知错误'}`);
    }
    if (notificationsError) {
      showError(`加载通知列表失败: ${notificationsError.message || '未知错误'}`);
    }
  }, [conversationsError, notificationsError, showError]);


  // Combine conversations and notifications into a single list for display, sorted by timestamp
  // This combinedList will be used by MessageListItem
  const combinedList = useMemo((): DisplayListItem[] => {
    const convItems: DisplayListItem[] = conversations.map((c: any) => ({ ...c, itemType: 'conversation' as const, created_at: c.last_message_timestamp, updated_at: c.last_message_timestamp, is_read: c.unread_count === 0 }));
    const notifItems: DisplayListItem[] = notifications.map((n: any) => ({ ...n, itemType: 'notification' as const }));
    
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

  const handleSelectItem = useCallback(async (item: DisplayListItem) => {
    setSelectedItem(item);
    
    if (item.itemType === 'notification' && !item.is_read && client) {
      try {
        // Optimistic UI update
        setNotifications((prev: any) => // Use the destructured setter
          prev.map((n: any) => n.id === item.id ? { ...n, is_read: true, updated_at: new Date().toISOString() } : n)
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
        setNotifications((prev: any) => // Use the destructured setter
          prev.map((n: any) => n.id === item.id ? { ...n, is_read: false, updated_at: item.updated_at } : n) // Revert to original updated_at
        );
      }
    }
  }, [client, showSuccess, showError, setNotifications]);

  const handleMarkAsUnread = useCallback(async (itemToMarkUnread: DisplayListItem) => {
    if (itemToMarkUnread.itemType !== 'notification' || !client) {
      if (itemToMarkUnread.itemType === 'conversation') {
        showInfo('会话的未读状态由新消息自动管理。');
      }
      return;
    }
    const notification = itemToMarkUnread as Message; 

    try {
      // Optimistic UI update
      setNotifications((prev: any) => // Use the destructured setter
        prev.map((n: any) => n.id === notification.id ? { ...n, is_read: false, updated_at: new Date().toISOString() } : n)
      );
      await client.merge(String(notification.id), { 
        is_read: false, 
        updated_at: new Date().toISOString() 
      });
      showSuccess('通知已标记为未读');
    } catch (error) {
      console.error("Error marking notification as unread:", error);
      showError('标记通知为未读失败');
      // Revert optimistic update
      setNotifications((prev: any) => // Use the destructured setter
        prev.map((n: any) => n.id === notification.id ? { ...n, is_read: true, updated_at: notification.updated_at } : n)
      );
    }
  }, [client, showSuccess, showError, showInfo, setNotifications]);


  const handleDeleteItem = useCallback(async (itemToDelete: DisplayListItem) => {
    if (!client) {
      showError('数据库连接不可用');
      return;
    }
    const itemId = itemToDelete.id;
    const originalItem = { ...itemToDelete }; 

    // Optimistic UI update
    if (itemToDelete.itemType === 'conversation') {
      setConversations((prev: any) => prev.filter((c: any) => c.id !== itemId));
    } else if (itemToDelete.itemType === 'notification') {
      setNotifications((prev: any) => prev.filter((n: any) => n.id !== itemId));
    }
    if (selectedItem?.id === itemId) {
      setSelectedItem(null);
    }

    try {
      await client.delete(String(itemId));
      showSuccess('消息/通知已删除');
    } catch (error: any) {
      console.error("Error deleting item:", error);
      showError(`删除失败: ${error.message || '未知错误'}`);
      // Revert optimistic update
      if (originalItem.itemType === 'conversation') {
         setConversations((prev: any) => [...prev, originalItem as ConversationSummary].sort((a,b) => new Date(b.last_message_timestamp).getTime() - new Date(a.last_message_timestamp).getTime() ));
      } else if (originalItem.itemType === 'notification') {
         setNotifications((prev: any) => [...prev, originalItem as Message].sort((a,b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime() ));
      }
    }
  }, [client, selectedItem, showSuccess, showError, setConversations, setNotifications]);


  const handleFilterChange = (
    _event: React.MouseEvent<HTMLElement>, // event param is often unused, prefix with _
    newFilter: 'all' | 'im' | 'reminders' | null,
  ) => {
    if (newFilter !== null) {
      setCurrentFilter(newFilter);
    }
  };

  const filteredDisplayList = useMemo((): DisplayListItem[] => {
    if (currentFilter === 'im') {
      return combinedList.filter(item => item.itemType === 'conversation');
    }
    if (currentFilter === 'reminders') {
      return combinedList.filter(item => item.itemType === 'notification');
    }
    return combinedList; // 'all'
  }, [combinedList, currentFilter]);

  const handleSendMessage = async (text: string) => {
    if (!selectedItem || selectedItem.itemType !== 'conversation') {
      showWarning('请先选择一个会话以发送消息。');
      return;
    }
    if (!user?.id || !client) {
      showError('用户未登录或数据库连接不可用。');
      return;
    }

    const convSummary = selectedItem as ConversationSummary;

    const newMessageData: Omit<IMMessage, 'id' | 'updated_at'> = { // id and updated_at are usually handled by DB or hook
      type: 'IM',
      conversation_id: String(convSummary.id),
      sender_id: user.id,
      sender_name: user.name || '我', // Use user's name or a default
      content: text,
      created_at: new Date().toISOString(),
      is_read: false, // New messages are unread by others
      // attachments: undefined, // Handle attachments if/when that feature is added
      // case_id: convSummary.case_id // If conversations are case-specific and message needs this link
    };

    // Optimistically add to local simulated conversation for immediate feedback
    const optimisticMessage: ChatMessageDisplay = {
      id: `temp-${Date.now()}`, // Temporary ID
      messageText: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSender: true,
      senderName: 'You',
    };

    try {
      setCurrentConversation(prevConvo => [...prevConvo, optimisticMessage]);

      await client.create('message', newMessageData);
      showSuccess('消息已发送');
      // The live query in useConversationsList (if it listens to 'message' table) 
      // should update the conversation summary (last message, timestamp).
      // Full chat history would require a dedicated hook and state.
    } catch (error: any) {
      console.error("Error sending message:", error);
      showError(`发送消息失败: ${error.message || '未知错误'}`);
      // Optional: remove optimistic message if send failed
      setCurrentConversation(prevConvo => prevConvo.filter(msg => msg.id !== optimisticMessage.id));
    }
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 }, height: 'calc(100vh - 64px - 48px)', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ textAlign: 'left', mb: 2, ml:1 }}>
        消息中心
      </Typography>
      
      <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {/* Left Column: Message List Area */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Paper 
            elevation={1} 
            sx={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: theme.palette.background.paper }}
          >
            <Box sx={{ p: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <ToggleButtonGroup
                value={currentFilter} exclusive onChange={handleFilterChange} aria-label="Message filter"
                fullWidth size="small"
              >
                <ToggleButton value="all" aria-label="all messages">全部</ToggleButton>
                <ToggleButton value="im" aria-label="im messages">IM</ToggleButton>
                <ToggleButton value="reminders" aria-label="reminders">提醒</ToggleButton>
              </ToggleButtonGroup>
            </Box>
            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
              {isLoadingConversations || isLoadingNotifications ? (
                // Show Skeletons while loading initial list
                <List disablePadding>
                  {[...Array(5)].map((_, index) => (
                    <ListItem key={index} sx={{ pl:1.5, pr:1.5, pt:1.5, pb:1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <ListItemIcon sx={{minWidth: 'auto', mr: 1.5, mt:0.5}}>
                        <Skeleton variant="circular" width={40} height={40} />
                      </ListItemIcon>
                      <ListItemText
                        primary={<Skeleton variant="text" width="60%" />}
                        secondary={<Skeleton variant="text" width="90%" />}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (conversationsError || notificationsError) && combinedList.length === 0 ? (
                 // Show error message if loading failed and list is empty
                <Typography align="center" color="error" sx={{ p: 3 }}>
                  加载消息失败，请稍后重试。 <br/>
                  {conversationsError?.message || notificationsError?.message}
                </Typography>
              ) : filteredDisplayList.length === 0 ? (
                // Show "No messages" if loading is complete, no errors, and list is empty
                <Typography align="center" color="text.secondary" sx={{ p: 3 }}>
                  {currentFilter === 'all' ? '暂无任何消息' : 
                   currentFilter === 'im' ? '暂无会话消息' : 
                   '暂无提醒或通知'}
                </Typography>
              ) : (
                // Display the actual list
                <List disablePadding>
                  {filteredDisplayList.map((item) => (
                    <MessageListItem
                      key={String(item.id)} 
                      itemData={item} 
                      onSelectItem={handleSelectItem} 
                      onDeleteItem={() => handleDeleteItem(item)} 
                      onMarkAsUnread={() => handleMarkAsUnread(item)} 
                      selected={selectedItem?.id === item.id}
                    />
                  ))}
                </List>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Right Column: Message Content / IM Chat View / Notification Card View */}
        <Grid size={{ xs: 12, md: 8 }} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Paper 
            elevation={1} 
            sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              backgroundColor: theme.palette.background.paper,
              overflow: 'hidden', 
            }}
          >
            {!selectedItem ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography color="text.secondary" align="center" sx={{pt:5}}>
                  请在左侧选择一条消息或会话查看详情
                </Typography>
              </Box>
            ) : selectedItem.itemType === 'conversation' ? (
              <>
                <Box sx={{ p: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="h6">
                    会话: {
                      (selectedItem as ConversationSummary).participants && (selectedItem as ConversationSummary).participants.length > 0
                        ? (selectedItem as ConversationSummary).participants
                            .filter((p: any) => user ? p.id !== user.id : true) // Show other participants
                            .map((p: any) => p.name)
                            .join(', ') || ((selectedItem as ConversationSummary).participants[0]?.name || '未知会话') // Fallback if current user is only participant or names missing
                        : '未知会话'
                    }
                  </Typography>
                  {/* Display case_id if available on the conversation summary, or from selectedMessage if it's an IM */}
                  {/* For now, let's assume ConversationSummary might have a case_id if relevant */}
                  {/* Or if selectedItem is an IMMessage (though current logic selects ConversationSummary for IMs) */}
                  {(selectedItem as any).case_id && ( 
                     <Typography variant="caption" color="text.secondary">
                        相关案件: {String((selectedItem as any).case_id).replace(/^case:/, '')}
                     </Typography>
                  )}
                </Box>
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: {xs: 1, sm: 2} }}>
                  {currentConversation.map((chatMsg) => (
                    <ChatBubble
                      key={chatMsg.id}
                      messageText={chatMsg.messageText}
                      timestamp={chatMsg.timestamp}
                      isSender={chatMsg.isSender}
                    />
                  ))}
                  <div ref={chatHistoryEndRef} />
                </Box>
                <ChatInput onSendMessage={handleSendMessage} />
              </>
            ) : ( // itemType === 'notification'
              <Box sx={{p: {xs: 1, sm: 2, md: 2}, height:'100%'}}>
                 <NotificationCard message={selectedItem as CaseRobotReminderMessage | BusinessNotificationMessage} />
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MessageCenterPage;
