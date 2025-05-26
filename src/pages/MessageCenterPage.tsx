import React from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

// Mock data, replace with API call (potentially WebSocket for real-time)
const mockMessages = [
  { id: 'msg001', type: 'IM', sender: '案件机器人 (BK-2023-001)', content: '距离最迟公告时间仅有3天。', timestamp: '2023-04-20 10:00', is_read: false, case_id: 'case001' },
  { id: 'msg002', type: 'SystemAlert', sender: '系统管理员', content: '服务器将于今晚2点进行维护。', timestamp: '2023-04-19 15:30', is_read: true },
  { id: 'msg003', type: 'IM', sender: '张三 (债权人)', content: '关于我的债权申报，有几个问题想咨询一下...', timestamp: '2023-04-18 09:15', is_read: false, case_id: 'case001' },
];

const MessageCenterPage: React.FC = () => {
  // TODO: Fetch messages from API (IM, system alerts, notifications)
  // TODO: Implement real-time updates via WebSocket/SurrealDB live queries
  // TODO: Implement message sending, conversation views
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>消息中心</Typography>
      
      <Paper elevation={2}>
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="h6">所有消息</Typography>
        </Box>
        <List disablePadding>
          {mockMessages.map((message) => (
            <ListItem
              alignItems="flex-start"
              divider
              button // For hover effect
              selected={!message.is_read} // For visual distinction of unread messages
              sx={{
                backgroundColor: !message.is_read ? (theme) => alpha(theme.palette.primary.light, 0.08) : 'inherit',
                '&.Mui-selected': { // More specific styling for selected (unread)
                   backgroundColor: (theme) => alpha(theme.palette.primary.light, 0.12),
                },
                '&.Mui-selected:hover': {
                   backgroundColor: (theme) => alpha(theme.palette.primary.light, 0.15),
                }
              }}
              key={message.id}
            >
              <ListItemText
                primary={
                  <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Typography
                      component="span"
                      variant="body1"
                      sx={{
                        fontWeight: !message.is_read ? 'bold' : 'normal',
                        color: !message.is_read ? 'primary.main' : 'text.primary',
                      }}
                    >
                      {message.sender}
                      {message.type === 'IM' && <Chip label="IM" size="small" color="success" variant="outlined" sx={{ ml: 1, height: 'auto', fontSize: '0.7rem', p: '0 4px' }} />}
                      {message.type === 'SystemAlert' && <Chip label="提醒" size="small" color="warning" variant="outlined" sx={{ ml: 1, height: 'auto', fontSize: '0.7rem', p: '0 4px' }} />}
                    </Typography>
                    <Typography
                      component="span"
                      variant="caption"
                      sx={{ color: !message.is_read ? 'primary.dark' : 'text.secondary', whiteSpace: 'nowrap', ml:1 }}
                    >
                      {message.timestamp}
                    </Typography>
                  </Box>
                }
                secondary={
                  <React.Fragment>
                    <Typography
                      component="p"
                      variant="body2"
                      color={!message.is_read ? 'text.primary' : 'text.secondary'}
                      sx={{ mt: 0.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                    >
                      {message.content}
                    </Typography>
                    {message.case_id && (
                      <Typography variant="caption" display="block" color="text.disabled" sx={{ mt: 0.5 }}>
                        相关案件: {message.case_id}
                      </Typography>
                    )}
                  </React.Fragment>
                }
              />
            </ListItem>
          ))}
          {mockMessages.length === 0 && (
            <ListItem>
              <ListItemText primary={
                <Typography align="center" color="text.secondary" sx={{ p: 2 }}>
                  暂无消息
                </Typography>
              }/>
            </ListItem>
          )}
        </List>
      </Paper>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
        消息中心。展示IM聊天消息和系统提醒。
        案件机器人将根据案件状态和预设条件在此发送提醒卡片。
      </Typography>
    </Box>
  );
};

export default MessageCenterPage;