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
import { CaseRobotReminderMessage, BusinessNotificationMessage, Message } from '../../types/message'; // Import refined types
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CampaignIcon from '@mui/icons-material/Campaign';
import InfoIcon from '@mui/icons-material/Info'; // Keep for default/fallback
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LinkIcon from '@mui/icons-material/Link'; // For generic action_link

export interface NotificationCardProps {
  // Accept either of the notification types
  message: CaseRobotReminderMessage | BusinessNotificationMessage | Message; // Message for fallback if old types slip through
}

const NotificationCard: React.FC<NotificationCardProps> = ({ message }) => {
  const theme = useTheme();
  
  const isCaseBotReminder = message.type === 'CASE_ROBOT_REMINDER';
  const isBusinessNotification = message.type === 'BUSINESS_NOTIFICATION';

  let avatarIcon = <CampaignIcon />; // Default
  let chipLabel = message.type; // Default to raw type
  let chipColor: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
  let title = message.sender_name || (message as any).sender || '通知'; // Use sender_name, fallback to sender for older types

  if (isCaseBotReminder) {
    const caseBotMsg = message as CaseRobotReminderMessage;
    avatarIcon = <SmartToyIcon />;
    chipLabel = '案件提醒';
    chipColor = 'info';
    title = caseBotMsg.sender_name;
  } else if (isBusinessNotification) {
    const bizMsg = message as BusinessNotificationMessage;
    avatarIcon = <CampaignIcon />; // Or determine by severity
    chipLabel = bizMsg.title || '系统通知'; // Use notification title for chip if available
    chipColor = bizMsg.severity || 'info'; // Map severity to chip color
    title = bizMsg.sender_name;
    if (bizMsg.severity === 'error') avatarIcon = <InfoIcon sx={{color: theme.palette.error.main}}/>;
    else if (bizMsg.severity === 'warning') avatarIcon = <InfoIcon sx={{color: theme.palette.warning.main}}/>;
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
            {title}
          </Typography>
        }
        subheader={
          <Typography variant="caption" color="text.secondary">
            {new Date(message.created_at).toLocaleString()}
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
                案件ID: {String(message.case_id).replace(/^case:/, '')}
              </Typography>
              {/* Add more case details here if available and needed */}
            </Box>
          </>
        )}
      </CardContent>
      <CardActions sx={{ p: 1.5, justifyContent: 'flex-end', backgroundColor: muiAlpha(theme.palette.divider, 0.04) }}>
        {isCaseBotReminder && (
          <>
            <Button 
              variant="outlined" 
              size="small" 
              startIcon={<CheckCircleOutlineIcon />}
              sx={{ mr: 1 }}
              // onClick={() => console.log('Acknowledge:', message.id)} // TODO: Implement acknowledge if needed
            >
              我知道了
            </Button>
            <Button 
              variant="contained" 
              size="small" 
              color="primary"
              startIcon={<VisibilityIcon />}
              // onClick={() => navigateToCase(message.case_id)} // TODO: Implement navigation
            >
              查看案件详情
            </Button>
          </>
        )}
        {isBusinessNotification && (message as BusinessNotificationMessage).action_link && (
          <Button 
            variant="contained" 
            size="small" 
            color="primary"
            startIcon={<LinkIcon />}
            href={(message as BusinessNotificationMessage).action_link}
            target="_blank" // Open in new tab if it's an external link
            rel="noopener noreferrer"
          >
            查看操作
          </Button>
        )}
      </CardActions>
    </Card>
  );
};

export default NotificationCard;
