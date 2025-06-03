import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
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
  Error,
} from '@mui/icons-material';

// 消息类型
const messageTypes = {
  system: { label: '系统通知', icon: <Notifications />, color: 'info' },
  robot: { label: '案件提醒', icon: <SmartToy />, color: 'warning' },
  user: { label: '用户消息', icon: <Person />, color: 'primary' },
  group: { label: '群组消息', icon: <Group />, color: 'secondary' },
};

// 模拟消息数据
const mockMessages = [
  {
    id: '1',
    type: 'robot',
    sender: '案件机器人 - (2024)粤03破1号',
    avatar: <SmartToy />,
    title: '债权申报即将截止',
    content: '距离债权申报截止还有 3 天，请及时处理未审核的债权申报。',
    time: '10分钟前',
    unread: true,
    priority: 'high',
  },
  {
    id: '2',
    type: 'system',
    sender: '系统通知',
    avatar: <Notifications />,
    title: '新的债权申报',
    content: '深圳市建筑材料有限公司提交了新的债权申报，请及时审核。',
    time: '1小时前',
    unread: true,
    priority: 'normal',
  },
  {
    id: '3',
    type: 'user',
    sender: '王律师',
    avatar: 'W',
    title: '关于第一次债权人会议',
    content: '会议材料已经准备完毕，请查看附件。',
    time: '2小时前',
    unread: false,
    priority: 'normal',
    hasAttachment: true,
  },
  {
    id: '4',
    type: 'robot',
    sender: '案件机器人 - (2024)粤03破2号',
    avatar: <SmartToy />,
    title: '距离最迟公告时间仅有 5 天',
    content: '请尽快发布破产申请受理公告，避免超过法定期限。',
    time: '昨天',
    unread: false,
    priority: 'high',
  },
  {
    id: '5',
    type: 'group',
    sender: '管理人团队',
    avatar: <Group />,
    title: '李律师：明天的会议安排',
    content: '明天上午10点在会议室开会讨论债权审核进度。',
    time: '昨天',
    unread: false,
    priority: 'normal',
  },
];

// 聊天消息
const mockChatMessages = [
  {
    id: '1',
    sender: '王律师',
    content: '债权审核的进度如何了？',
    time: '14:30',
    isMe: false,
  },
  {
    id: '2',
    sender: '我',
    content: '已经完成了80%，预计明天可以全部完成。',
    time: '14:32',
    isMe: true,
  },
  {
    id: '3',
    sender: '王律师',
    content: '好的，辛苦了。有问题随时沟通。',
    time: '14:33',
    isMe: false,
  },
];

export const MessageCenter: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeTab, setActiveTab] = useState(0);
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string>('');
  const [chatInput, setChatInput] = useState('');

  // 统计未读消息
  const unreadCount = mockMessages.filter(m => m.unread).length;
  const systemMessages = mockMessages.filter(m => ['system', 'robot'].includes(m.type));
  const chatMessages = mockMessages.filter(m => ['user', 'group'].includes(m.type));

  // 处理菜单
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, messageId: string) => {
    setAnchorEl(event.currentTarget);
    setSelectedMessageId(messageId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMessageId('');
  };

  // 处理消息操作
  const handleMarkAsRead = () => {
    console.log('标记为已读', selectedMessageId);
    handleMenuClose();
  };

  const handleDelete = () => {
    console.log('删除消息', selectedMessageId);
    handleMenuClose();
  };

  const handleArchive = () => {
    console.log('归档消息', selectedMessageId);
    handleMenuClose();
  };

  // 发送消息
  const handleSendMessage = () => {
    if (chatInput.trim()) {
      console.log('发送消息', chatInput);
      setChatInput('');
    }
  };

  // 获取优先级颜色
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'error';
      case 'normal':
        return 'default';
      default:
        return 'default';
    }
  };

  // 渲染消息列表项
  const renderMessageItem = (message: any) => (
    <React.Fragment key={message.id}>
      <ListItem
        onClick={() => setSelectedMessage(message)}
        sx={{
          cursor: 'pointer',
          backgroundColor: message.unread ? 'action.hover' : 'transparent',
          '&:hover': {
            backgroundColor: 'action.hover',
          },
          '&.Mui-selected': {
            backgroundColor: 'action.selected',
          },
        }}
      >
        <ListItemAvatar>
          <Badge
            color="error"
            variant="dot"
            invisible={!message.unread}
          >
            <Avatar sx={{ bgcolor: theme.palette[messageTypes[message.type as keyof typeof messageTypes].color as 'info' | 'warning' | 'primary' | 'secondary'].main }}>
              {typeof message.avatar === 'string' ? message.avatar : message.avatar}
            </Avatar>
          </Badge>
        </ListItemAvatar>
        <ListItemText
          primary={
            <Box display="flex" alignItems="center" gap={1}>
              <Typography variant="subtitle2" fontWeight={message.unread ? 'bold' : 'normal'}>
                {message.title}
              </Typography>
              {message.priority === 'high' && (
                <Chip
                  label="重要"
                  size="small"
                  color="error"
                  sx={{ height: 20 }}
                />
              )}
              {message.hasAttachment && (
                <AttachFile fontSize="small" color="action" />
              )}
            </Box>
          }
          secondary={
            <>
              <Typography variant="body2" color="textSecondary" noWrap>
                {message.sender}
              </Typography>
              <Typography variant="body2" color="textSecondary" noWrap>
                {message.content}
              </Typography>
            </>
          }
        />
        <ListItemSecondaryAction>
          <Box textAlign="right">
            <Typography variant="caption" color="textSecondary">
              {message.time}
            </Typography>
            <IconButton
              edge="end"
              size="small"
              onClick={(e) => handleMenuOpen(e, message.id)}
            >
              <MoreVert />
            </IconButton>
          </Box>
        </ListItemSecondaryAction>
      </ListItem>
      <Divider />
    </React.Fragment>
  );

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 100px)' }}>
      {/* 左侧消息列表 */}
      <Paper
        sx={{
          width: isMobile ? '100%' : 350,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 0,
        }}
      >
        {/* 搜索栏 */}
        <Box p={2}>
          <TextField
            fullWidth
            size="small"
            placeholder="搜索消息..."
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        {/* 标签页 */}
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          variant="fullWidth"
        >
          <Tab
            label={
              <Badge badgeContent={unreadCount} color="error">
                全部
              </Badge>
            }
          />
          <Tab label="系统通知" />
          <Tab label="聊天消息" />
        </Tabs>

        {/* 消息列表 */}
        <List sx={{ flex: 1, overflow: 'auto' }}>
          {activeTab === 0 && mockMessages.map(renderMessageItem)}
          {activeTab === 1 && systemMessages.map(renderMessageItem)}
          {activeTab === 2 && chatMessages.map(renderMessageItem)}
        </List>
      </Paper>

      {/* 右侧消息详情/聊天界面 */}
      {!isMobile && (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {selectedMessage ? (
            selectedMessage.type === 'user' || selectedMessage.type === 'group' ? (
              // 聊天界面
              <>
                {/* 聊天头部 */}
                <Paper sx={{ p: 2, borderRadius: 0 }}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <Avatar>{selectedMessage.avatar}</Avatar>
                    <Box flex={1}>
                      <Typography variant="h6">{selectedMessage.sender}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        在线
                      </Typography>
                    </Box>
                  </Box>
                </Paper>

                {/* 聊天内容 */}
                <Box sx={{ flex: 1, p: 2, overflow: 'auto', bgcolor: 'grey.50' }}>
                  {mockChatMessages.map((msg) => (
                    <Box
                      key={msg.id}
                      sx={{
                        display: 'flex',
                        justifyContent: msg.isMe ? 'flex-end' : 'flex-start',
                        mb: 2,
                      }}
                    >
                      <Paper
                        sx={{
                          p: 1.5,
                          maxWidth: '70%',
                          bgcolor: msg.isMe ? 'primary.main' : 'background.paper',
                          color: msg.isMe ? 'primary.contrastText' : 'text.primary',
                        }}
                      >
                        <Typography variant="body2">{msg.content}</Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            display: 'block',
                            mt: 0.5,
                            opacity: 0.7,
                          }}
                        >
                          {msg.time}
                        </Typography>
                      </Paper>
                    </Box>
                  ))}
                </Box>

                {/* 输入框 */}
                <Paper sx={{ p: 2, borderRadius: 0 }}>
                  <Box display="flex" gap={1}>
                    <IconButton>
                      <AttachFile />
                    </IconButton>
                    <IconButton>
                      <ImageIcon />
                    </IconButton>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="输入消息..."
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                    />
                    <IconButton color="primary" onClick={handleSendMessage}>
                      <Send />
                    </IconButton>
                  </Box>
                </Paper>
              </>
            ) : (
              // 通知详情
              <Paper sx={{ flex: 1, p: 3 }}>
                <Box display="flex" alignItems="flex-start" gap={2} mb={3}>
                  <Avatar sx={{ bgcolor: theme.palette[messageTypes[selectedMessage.type as keyof typeof messageTypes].color as 'info' | 'warning' | 'primary' | 'secondary'].main, width: 56, height: 56 }}>
                    {selectedMessage.avatar}
                  </Avatar>
                  <Box flex={1}>
                    <Typography variant="h5" gutterBottom>
                      {selectedMessage.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {selectedMessage.sender} · {selectedMessage.time}
                    </Typography>
                  </Box>
                  {selectedMessage.priority === 'high' && (
                    <Chip label="重要" color="error" />
                  )}
                </Box>

                <Divider sx={{ mb: 3 }} />

                <Typography variant="body1" paragraph>
                  {selectedMessage.content}
                </Typography>

                {selectedMessage.type === 'robot' && (
                  <Alert severity="warning" sx={{ mt: 3 }}>
                    这是系统根据案件进程自动发送的提醒，请及时处理相关事项。
                  </Alert>
                )}

                {selectedMessage.hasAttachment && (
                  <Card variant="outlined" sx={{ mt: 3 }}>
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        附件
                      </Typography>
                      <Box display="flex" alignItems="center" gap={1}>
                        <AttachFile />
                        <Typography variant="body2">
                          会议材料.pdf
                        </Typography>
                      </Box>
                    </CardContent>
                    <CardActions>
                      <Button size="small">下载</Button>
                      <Button size="small">预览</Button>
                    </CardActions>
                  </Card>
                )}

                <Box mt={4} display="flex" gap={2}>
                  {selectedMessage.unread && (
                    <Button
                      variant="outlined"
                      startIcon={<MarkEmailRead />}
                      onClick={handleMarkAsRead}
                    >
                      标记为已读
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    startIcon={<Archive />}
                    onClick={handleArchive}
                  >
                    归档
                  </Button>
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<Delete />}
                    onClick={handleDelete}
                  >
                    删除
                  </Button>
                </Box>
              </Paper>
            )
          ) : (
            // 未选择消息
            <Box
              sx={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'grey.50',
              }}
            >
              <Box textAlign="center">
                <Message sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
                <Typography variant="h6" color="textSecondary">
                  选择一条消息查看详情
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      )}

      {/* 操作菜单 */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={handleMarkAsRead}>
          <MarkEmailRead fontSize="small" sx={{ mr: 1 }} />
          标记为已读
        </MenuItem>
        <MenuItem onClick={handleArchive}>
          <Archive fontSize="small" sx={{ mr: 1 }} />
          归档
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleDelete} sx={{ color: 'error.main' }}>
          <Delete fontSize="small" sx={{ mr: 1 }} />
          删除
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default MessageCenter;
