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
import MessageListItem from '../components/messages/MessageListItem';
import ChatBubble, { ChatBubbleProps } from '../components/messages/ChatBubble';
import ChatInput from '../components/messages/ChatInput';
import NotificationCard from '../components/messages/NotificationCard';

// Define and export the Message type
export interface Message {
  id: string;
  type: 'IM' | 'SystemAlert' | 'Notification' | string; 
  sender: string;
  content: string;
  timestamp: string; 
  is_read: boolean;
  case_id?: string;
}

// Mock data
const initialMockMessages: Message[] = [
  { id: 'msg001', type: 'IM', sender: '案件机器人 (BK-2023-001)', content: '距离最迟公告时间仅有3天。请尽快处理相关公告事宜，以免耽误案件进程。这是系统自动发送的提醒。', timestamp: '10:00 AM', is_read: false, case_id: 'case001' },
  { id: 'msg002', type: 'SystemAlert', sender: '系统管理员', content: '服务器将于今晚2点进行维护，预计持续30分钟。期间部分服务可能不可用。', timestamp: 'Yesterday', is_read: true },
  { id: 'msg003', type: 'IM', sender: '张三 (债权人代表)', content: '关于我的债权申报材料，有几个问题想咨询一下，麻烦看到回复。主要是关于证明文件的要求。', timestamp: '09:15 AM', is_read: false, case_id: 'case001' },
  { id: 'msg004', type: 'Notification', sender: '系统通知', content: '您有一个新的案件分配: 破产清算-XYZ公司。请及时查看。', timestamp: '11:00 AM', is_read: false, case_id: 'case003' },
  { id: 'msg005', type: 'IM', sender: '李四 (法官助理)', content: '下次庭前会议时间已确定，请查收会议纪要。', timestamp: '2:00 PM', is_read: true, case_id: 'case002' },
  { id: 'msg006', type: 'SystemAlert', sender: '系统安全中心', content: '检测到您的账户在异地登录尝试，请确认是否为本人操作。', timestamp: '8:00 AM', is_read: false },
  { id: 'msg007', type: 'IM', sender: '案件机器人 (BK-2023-004)', content: '新的证据材料已上传，请查阅。相关案件：BK-2023-004。', timestamp: '3:30 PM', is_read: false, case_id: 'case004'}
];

interface ChatMessageDisplay extends ChatBubbleProps {
  id: string; 
}


const MessageCenterPage: React.FC = () => {
  const theme = useTheme();
  const [messages, setMessages] = useState<Message[]>(initialMockMessages);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [currentFilter, setCurrentFilter] = useState<'all' | 'im' | 'reminders'>('all');

  const [currentConversation, setCurrentConversation] = useState<ChatMessageDisplay[]>([]);
  const chatHistoryEndRef = useRef<HTMLDivElement>(null); 

  const selectedMessage = useMemo(() => {
    return messages.find(msg => msg.id === selectedMessageId) || null;
  }, [selectedMessageId, messages]);

  useEffect(() => {
    if (selectedMessage && selectedMessage.type === 'IM') {
      const simulatedConvo: ChatMessageDisplay[] = [
        { id: 'sim1', messageText: selectedMessage.content, timestamp: selectedMessage.timestamp, isSender: false, senderName: selectedMessage.sender },
        { id: 'sim2', messageText: '好的，我明白了。我会尽快处理。', timestamp: '10:01 AM', isSender: true, senderName: 'You' },
        { id: 'sim3', messageText: '如果您有任何疑问，请随时提出。', timestamp: '10:02 AM', isSender: false, senderName: selectedMessage.sender },
      ];
      if (selectedMessage.sender.includes("张三")) {
        simulatedConvo.push({ id: 'sim4', messageText: '具体是关于哪个文件的要求不清楚呢？', timestamp: '10:03 AM', isSender: true, senderName: 'You' });
      }
      setCurrentConversation(simulatedConvo);
    } else {
      setCurrentConversation([]); 
    }
  }, [selectedMessage]);

  useEffect(() => {
    chatHistoryEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation]);


  const handleSelectMessage = useCallback((messageId: string) => {
    setSelectedMessageId(messageId);
    // Mark message as read - this is an immutable update
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg.id === messageId && !msg.is_read ? { ...msg, is_read: true } : msg
      )
    );
  }, []);

  const handleDeleteMessage = useCallback((messageIdToDelete: string) => {
    setMessages(prevMessages => prevMessages.filter(msg => msg.id !== messageIdToDelete));
    if (selectedMessageId === messageIdToDelete) {
      setSelectedMessageId(null); // Clear selection if the selected message is deleted
    }
    // Optionally, you could select the next or previous message here.
  }, [selectedMessageId]);


  const handleFilterChange = (
    event: React.MouseEvent<HTMLElement>,
    newFilter: 'all' | 'im' | 'reminders' | null,
  ) => {
    if (newFilter !== null) {
      setCurrentFilter(newFilter);
    }
  };

  const filteredMessages = useMemo(() => {
    if (currentFilter === 'im') {
      return messages.filter(msg => msg.type === 'IM');
    }
    if (currentFilter === 'reminders') {
      return messages.filter(msg => 
        msg.type === 'SystemAlert' || 
        msg.type === 'Notification' || 
        (msg.sender.includes('案件机器人') && msg.type !== 'IM') 
      );
    }
    return messages; // 'all'
  }, [messages, currentFilter]);

  const handleSendMessage = (text: string) => {
    if (!selectedMessage || selectedMessage.type !== 'IM') return;

    const newMessage: ChatMessageDisplay = {
      id: `msg-${Date.now()}`, 
      messageText: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isSender: true,
      senderName: 'You', 
    };
    setCurrentConversation(prevConvo => [...prevConvo, newMessage]);
    console.log("Message sent:", text, "to:", selectedMessage.sender);
  };

  return (
    <Box sx={{ p: { xs: 1, sm: 2, md: 3 }, height: 'calc(100vh - 64px - 48px)', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ textAlign: 'left', mb: 2, ml:1 }}>
        消息中心
      </Typography>
      
      <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {/* Left Column: Message List Area */}
        <Grid item xs={12} md={4} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
              {filteredMessages.length === 0 ? (
                <Typography align="center" color="text.secondary" sx={{ p: 3 }}>暂无消息</Typography>
              ) : (
                <List disablePadding>
                  {filteredMessages.map((message) => (
                    <MessageListItem
                      key={message.id} 
                      message={message}
                      onSelectMessage={handleSelectMessage} 
                      onDeleteMessage={handleDeleteMessage} // Pass the delete handler
                      selected={message.id === selectedMessageId}
                    />
                  ))}
                </List>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Right Column: Message Content / IM Chat View / Notification Card View */}
        <Grid item xs={12} md={8} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
            {!selectedMessage ? (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Typography color="text.secondary" align="center" sx={{pt:5}}>
                  请在左侧选择一条消息查看详情
                </Typography>
              </Box>
            ) : selectedMessage.type === 'IM' ? (
              <>
                <Box sx={{ p: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="h6">
                    Chat with: {selectedMessage.sender}
                  </Typography>
                  {selectedMessage.case_id && (
                     <Typography variant="caption" color="text.secondary">
                        Related Case: {selectedMessage.case_id}
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
                      senderName={chatMsg.senderName}
                    />
                  ))}
                  <div ref={chatHistoryEndRef} />
                </Box>
                <ChatInput onSendMessage={handleSendMessage} />
              </>
            ) : (
              <Box sx={{p: {xs: 1, sm: 2, md: 2}, height:'100%'}}>
                 <NotificationCard message={selectedMessage} />
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MessageCenterPage;