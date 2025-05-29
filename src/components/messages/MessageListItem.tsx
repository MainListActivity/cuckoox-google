import React from 'react';
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
  IconButton, // Added
  Tooltip,    
  ListItemSecondaryAction, 
} from '@mui/material';
// Import DisplayListItem and related types from where MessageCenterPage imports them
// Assuming DisplayListItem is now part of types/message.ts or passed correctly
import { DisplayListItem, ConversationSummary, Message, IMMessage, CaseRobotReminderMessage, BusinessNotificationMessage } from '../../types/message'; 
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'; 
import GroupIcon from '@mui/icons-material/Group'; 
import PersonIcon from '@mui/icons-material/Person'; 
import { mdiEmailOpenOutline } from '@mdi/js'; // Icon for Mark as Unread

// Define the props for the component
export interface MessageListItemProps {
  itemData: DisplayListItem; 
  onSelectItem: (item: DisplayListItem) => void; 
  onDeleteItem: (itemId: string | import('surrealdb.js').RecordId) => void; 
  onMarkAsUnread: (item: DisplayListItem) => void; // New prop
  selected: boolean;
}

const MessageListItem: React.FC<MessageListItemProps> = ({ itemData, onSelectItem, onDeleteItem, onMarkAsUnread, selected }) => {
  const theme = useTheme();

  const { itemType } = itemData;
  const data = itemData; // data is the itemData itself after discriminating itemType

  let primaryText: string;
  let secondaryText: string;
  let timestamp: string;
  let isUnread: boolean;
  let icon: JSX.Element;
  let chipLabel: string | null = null;
  let chipColor: 'success' | 'warning' | 'info' | 'default' | 'primary' | 'secondary' | undefined = 'default';

  if (itemType === 'conversation') {
    const conversation = data as ConversationSummary & { itemType: 'conversation' };
    // Primary Text: Participant names or conversation title
    if (conversation.participants.length > 2 || conversation.is_group_chat) {
      primaryText = conversation.participants.map(p => p.name).join(', ') || 'Group Chat';
      icon = <GroupIcon />;
    } else if (conversation.participants.length === 2) {
      // Attempt to find the other participant's name (assuming current user is one of them)
      // This requires knowledge of current user's ID, which is not available here.
      // Simplification: join names, or use a generic title if names are not distinct enough.
      primaryText = conversation.participants.map(p => p.name).join(' & ') || 'Conversation';
      icon = <PersonIcon />;
    } else if (conversation.participants.length === 1) {
      primaryText = conversation.participants[0]?.name || 'Self Chat'; // Should not happen often
      icon = <PersonIcon />;
    } else {
      primaryText = 'Empty Conversation'; // Should ideally not happen
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
    primaryText = notification.sender_name || (notification as IMMessage).sender_name || '系统通知'; // Fallback for sender_name
    secondaryText = notification.content;
    timestamp = new Date(notification.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
    isUnread = !notification.is_read;

    if (notification.type === 'CASE_ROBOT_REMINDER') {
      icon = <SmartToyIcon />;
      chipLabel = '案件机器人';
      chipColor = 'info';
    } else if (notification.type === 'BUSINESS_NOTIFICATION') {
      icon = <NotificationsActiveIcon />;
      chipLabel = '系统通知';
      chipColor = 'warning';
      // Potentially use notification.severity for chipColor if available and mapped
      const bnMsg = notification as BusinessNotificationMessage;
      if(bnMsg.severity === 'error') chipColor = 'error';
      else if(bnMsg.severity === 'success') chipColor = 'success';
      // info and warning are already handled or default
    } else { // Fallback for other Message types if any, or old IMs if they were passed
      icon = <ChatBubbleOutlineIcon />;
      chipLabel = notification.type; // Display the raw type
      chipColor = 'default';
    }
  }

  const contentSnippet = secondaryText.length > 50 
    ? `${secondaryText.substring(0, 50)}...` 
    : secondaryText;

  const handleDeleteClick = (event: React.MouseEvent) => {
    event.stopPropagation(); 
    onDeleteItem(data.id);
  };

  const handleMarkUnreadClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onMarkAsUnread(data);
  };

  return (
    <ListItem
      button
      onClick={() => onSelectItem(data)} 
      selected={selected}
      alignItems="flex-start"
      secondaryAction={ 
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          {!isUnread && itemType === 'notification' && ( // Show "Mark as Unread" only for read notifications
            <Tooltip title="标记为未读">
              <IconButton
                edge="end"
                aria-label="mark as unread"
                onClick={handleMarkUnreadClick}
                size="small"
                sx={{ 
                  mr: 0.5, // Add some margin if delete icon is also present
                  color: theme.palette.text.secondary,
                  '&:hover': {
                    color: theme.palette.info.main, 
                    backgroundColor: alpha(theme.palette.info.main, 0.08)
                  }
                }}
              >
                <SvgIcon fontSize="small"><path d={mdiEmailOpenOutline} /></SvgIcon>
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="删除">
            <IconButton
              edge="end"
              aria-label="delete"
              onClick={handleDeleteClick}
            size="small"
            sx={{ 
              // Show on hover or focus, or always if preferred
              // opacity: 0.7, 
              // '&:hover, &:focus': { opacity: 1 },
              color: theme.palette.text.secondary, // Default color
              '&:hover': {
                color: theme.palette.error.main, // Error color on hover
                backgroundColor: alpha(theme.palette.error.main, 0.08)
              }
            }}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      }
      sx={{
        pt: 1.5,
        pb: 1.5,
        // Consistent paddingRight to accommodate the secondary action icon.
        // Assuming the icon button takes roughly 40px (theme.spacing(5)).
        pr: theme.spacing(5), 
        pl:1.5,
        // Styling for selected state
        ...(selected && {
          backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity + 0.05), 
          '&:hover': {
            backgroundColor: alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity + 0.1),
          },
        }),
        // Styling for unread state (subtle background, works with selected state)
        ...(!selected && isUnread && {
          backgroundColor: alpha(theme.palette.action.hover, 0.03), 
        }),
        '&:hover': {
          backgroundColor: selected 
            ? alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity + 0.1) 
            : alpha(theme.palette.action.hover, 0.06),
        },
        borderBottom: `1px solid ${theme.palette.divider}`,
        '&:last-child': {
          borderBottom: 'none', 
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: 'auto', mr: 1.5, mt: 0.5, color: isUnread ? theme.palette.primary.main : theme.palette.text.secondary }}>
        {isUnread && !selected ? (
          <Badge
            variant="dot"
            color="primary"
            anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
            sx={{ '& .MuiBadge-dot': { transform: 'scale(0.8) translate(-2px, 2px)'} }} 
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
                color: selected ? theme.palette.primary.contrastText : (isUnread ? theme.palette.text.primary : theme.palette.text.primary),
                maxWidth: 'calc(100% - 70px)', 
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {primaryText} {/* Use derived primaryText */}
            </Typography>
            <Typography
              variant="caption"
              component="span"
              sx={{
                color: selected ? theme.palette.primary.contrastText : theme.palette.text.secondary,
                fontWeight: isUnread ? 'medium' : 'normal',
                whiteSpace: 'nowrap',
                ml: 1,
              }}
            >
              {timestamp} {/* Use derived timestamp */}
            </Typography>
          </Box>
        }
        secondary={
          <Box>
            <Typography
              variant="body2"
              component="span"
              sx={{
                color: selected ? alpha(theme.palette.primary.contrastText, 0.85) : theme.palette.text.secondary,
                fontWeight: isUnread && !selected ? 'medium' : 'normal', 
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                mb: chipLabel ? 0.5 : 0, // Use chipLabel to determine margin
              }}
            >
              {contentSnippet}
            </Typography>
            {chipLabel && (
              <Chip
                icon={itemType === 'notification' && (data as Message).type === 'CASE_ROBOT_REMINDER' ? <SmartToyIcon fontSize="small" /> : undefined}
                label={chipLabel}
                size="small"
                color={chipColor} // This prop directly influences bg and text color when variant="filled"
                variant={isUnread || selected ? "filled" : "outlined"}
                sx={{
                  mt: 0.5,
                  height: 'auto',
                  fontSize: '0.7rem',
                  p: '0 4px',
                  // The explicit backgroundColor and color sx props for filled state
                  // are largely handled by the Chip's `color` and `variant="filled"` props.
                  // However, to ensure precise theme mapping for 'success', 'warning', 'info'
                  // when they are 'filled', we might need to retain some sx styling if the
                  // default Chip color mapping isn't perfect or if specific shades are desired.
                  // For standard 'primary' and 'secondary', MUI handles this well.
                  // Let's test without explicit sx backgroundColor/color first for filled state.
                  // If 'success', 'warning', 'info' filled states don't use their main color,
                  // we can add them back.
                  // For 'outlined' variant, the text color is typically the chip's 'color' prop.
                }}
              />
            )}
          </Box>
        }
        sx={{ my: 0 }} 
      />
    </ListItem>
  );
};

export default MessageListItem;
