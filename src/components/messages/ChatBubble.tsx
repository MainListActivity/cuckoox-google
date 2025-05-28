import React from 'react';
import { Box, Paper, Typography, useTheme, alpha as muiAlpha } from '@mui/material';

export interface ChatBubbleProps {
  messageText: string;
  timestamp: string;
  // senderName?: string; // Optional: for group chats or if needed
  isSender: boolean;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ messageText, timestamp, isSender }) => {
  const theme = useTheme();

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: isSender ? 'flex-end' : 'flex-start',
        mb: 1.5, // Margin bottom for spacing between bubbles
      }}
    >
      <Paper
        elevation={1}
        sx={{
          p: 1.5, // Padding inside the bubble
          maxWidth: '75%', // Max width of the bubble
          minWidth: '100px', // Min width to avoid very narrow bubbles
          backgroundColor: isSender 
            ? theme.palette.primary.main 
            : (theme.palette.mode === 'light' ? theme.palette.grey[200] : theme.palette.grey[700]),
          color: isSender 
            ? theme.palette.primary.contrastText 
            : theme.palette.text.primary,
          borderRadius: isSender 
            ? '16px 16px 4px 16px' // Custom border radius for sender
            : '16px 16px 16px 4px', // Custom border radius for receiver
          wordWrap: 'break-word', // Ensure long words break
        }}
        className={`chat-bubble ${isSender ? 'sender' : 'receiver'}`} // For potential global styling or testing
      >
        {/* Optional: Display senderName if provided and it's not the current user (for group chats) */}
        {/* {!isSender && senderName && (
          <Typography variant="caption" sx={{ display: 'block', color: theme.palette.text.secondary, mb: 0.5 }}>
            {senderName}
          </Typography>
        )} */}
        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>{messageText}</Typography>
        <Typography
          variant="caption"
          sx={{
            display: 'block',
            textAlign: 'right',
            mt: 0.5, // Margin top for timestamp
            fontSize: '0.7rem',
            color: isSender 
              ? muiAlpha(theme.palette.primary.contrastText, 0.7)
              : theme.palette.text.secondary,
          }}
        >
          {timestamp}
        </Typography>
      </Paper>
    </Box>
  );
};

export default ChatBubble;
