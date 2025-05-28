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
  Tooltip,    // Added
  ListItemSecondaryAction, // Added
} from '@mui/material';
import { Message } from '../../pages/MessageCenterPage'; 
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'; // Added

// Define the props for the component
export interface MessageListItemProps {
  message: Message;
  onSelectMessage: (messageId: string) => void;
  onDeleteMessage: (messageId: string) => void; // Added
  selected: boolean;
}

const MessageListItem: React.FC<MessageListItemProps> = ({ message, onSelectMessage, onDeleteMessage, selected }) => {
  const theme = useTheme();

  const isUnread = !message.is_read;

  // Determine icon based on message type or sender
  let icon = <ChatBubbleOutlineIcon />;
  if (message.type === 'SystemAlert') {
    icon = <NotificationsActiveIcon />;
  } else if (message.sender.includes('案件机器人')) {
    icon = <SmartToyIcon />;
  } else if (message.type === 'Notification') {
    icon = <NotificationsActiveIcon /> // Or another appropriate icon
  }


  // Chip label and color
  let chipLabel = message.type;
  let chipColor: 'success' | 'warning' | 'info' | 'default' | 'primary' | 'secondary' = 'default';

  if (message.type === 'IM') {
    chipLabel = 'IM';
    chipColor = 'success';
  } else if (message.type === 'SystemAlert') {
    chipLabel = '提醒';
    chipColor = 'warning';
  } else if (message.type === 'Notification') { 
    chipLabel = '通知';
    chipColor = 'info';
  }


  const contentSnippet = message.content.length > 50 
    ? `${message.content.substring(0, 50)}...` 
    : message.content;

  const handleDeleteClick = (event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent onSelectMessage from firing
    onDeleteMessage(message.id);
  };

  return (
    <ListItem
      button
      onClick={() => onSelectMessage(message.id)}
      selected={selected}
      alignItems="flex-start"
      secondaryAction={ // Use secondaryAction for the delete button
        <Tooltip title="删除消息">
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
              {message.sender}
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
              {message.timestamp} 
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
                mb: message.type ? 0.5 : 0, 
              }}
            >
              {contentSnippet}
            </Typography>
            {chipLabel && (
              <Chip
                icon={message.sender.includes('案件机器人') && message.type === 'IM' ? <SmartToyIcon fontSize="small" /> : undefined}
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
