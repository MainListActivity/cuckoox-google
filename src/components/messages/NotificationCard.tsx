import React from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Typography,
  Chip,
  Button,
  Avatar,
  IconButton, // For potential icon in header
  Divider,
  Box,
  useTheme,
  alpha as muiAlpha,
} from '@mui/material';
import { Message } from '../../pages/MessageCenterPage'; // Adjust path as necessary
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CampaignIcon from '@mui/icons-material/Campaign';
import InfoIcon from '@mui/icons-material/Info';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

export interface NotificationCardProps {
  message: Message;
}

const NotificationCard: React.FC<NotificationCardProps> = ({ message }) => {
  const theme = useTheme();
  const isCaseBotReminder = message.sender.includes('案件机器人');

  let avatarIcon = <CampaignIcon />;
  let chipLabel = message.type;
  let chipColor: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';

  if (isCaseBotReminder) {
    avatarIcon = <SmartToyIcon />;
    chipLabel = '案件提醒'; // More specific label for case bot
    chipColor = 'info';
  } else if (message.type === 'SystemAlert') {
    avatarIcon = <InfoIcon />; // Or CampaignIcon
    chipLabel = '系统提醒';
    chipColor = 'warning';
  } else if (message.type === 'Notification') {
    avatarIcon = <CampaignIcon />; // Or InfoIcon if preferred for general notifications
    chipLabel = '通知';
    chipColor = 'info'; // Consistent with MessageListItem
  }


  return (
    <Card 
      elevation={2} 
      sx={{ 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        border: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
      }}
    >
      <CardHeader
        avatar={
          <Avatar sx={{ bgcolor: isCaseBotReminder ? theme.palette.info.main : theme.palette.secondary.main, color: theme.palette.getContrastText(isCaseBotReminder ? theme.palette.info.main : theme.palette.secondary.main) }}>
            {avatarIcon}
          </Avatar>
        }
        title={
          <Typography variant="h6" component="div">
            {message.sender}
          </Typography>
        }
        subheader={
          <Typography variant="caption" color="text.secondary">
            {message.timestamp}
          </Typography>
        }
        action={
           <Chip label={chipLabel} color={chipColor} size="small" sx={{ mt: 0.5, mr:1 }} />
        }
        sx={{ borderBottom: `1px solid ${theme.palette.divider}`, pb: 1.5, pt:1.5, alignItems: 'flex-start' }}
      />
      <CardContent sx={{ flexGrow: 1, overflowY: 'auto', p: {xs: 1.5, sm:2} }}>
        <Typography variant="body1" component="p" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', mb: 2 }}>
          {message.content}
        </Typography>
        {message.case_id && (
          <>
            <Divider sx={{ my: 1.5 }} />
            <Box sx={{mt:1.5}}>
              <Typography variant="subtitle2" gutterBottom component="div" color="text.secondary">
                相关案件信息:
              </Typography>
              <Typography variant="body2" color="text.primary">
                案件ID: {message.case_id}
              </Typography>
              {/* Add more case details here if available and needed */}
            </Box>
          </>
        )}
      </CardContent>
      {isCaseBotReminder && (
        <>
          <Divider />
          <CardActions sx={{ p: 1.5, justifyContent: 'flex-end', backgroundColor: muiAlpha(theme.palette.divider, 0.04) }}>
            <Button 
              variant="outlined" 
              size="small" 
              startIcon={<CheckCircleOutlineIcon />}
              sx={{ mr: 1 }}
              // onClick={() => console.log('Acknowledge:', message.id)}
            >
              我知道了
            </Button>
            <Button 
              variant="contained" 
              size="small" 
              color="primary"
              startIcon={<VisibilityIcon />}
              // onClick={() => console.log('View Case Details:', message.case_id)}
            >
              查看案件详情
            </Button>
          </CardActions>
        </>
      )}
    </Card>
  );
};

export default NotificationCard;
