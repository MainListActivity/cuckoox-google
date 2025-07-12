import React, { useState } from 'react';
import { TextField, IconButton, useTheme, Paper } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ImageIcon from '@mui/icons-material/Image';

export interface ChatInputProps {
  onSendMessage: (text: string) => void;
  disabled?: boolean; // Optional: to disable input
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, disabled = false }) => {
  const theme = useTheme();
  const [inputText, setInputText] = useState('');

  const handleSend = () => {
    if (inputText.trim()) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent new line on Enter (if not multiline or Shift is not pressed)
      handleSend();
    }
  };

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 1, 
        display: 'flex', 
        alignItems: 'center', 
        backgroundColor: theme.palette.background.default, // Use default background for slight contrast from paper
        borderTop: `1px solid ${theme.palette.divider}`,
        mt: 'auto', // Push to bottom if in a flex column
      }}
    >
      {/* Placeholder Icons - No functionality */}
      <IconButton size="small" sx={{ mr: 0.5 }} disabled={disabled}>
        <AttachFileIcon />
      </IconButton>
      <IconButton size="small" sx={{ mr: 1 }} disabled={disabled}>
        <ImageIcon />
      </IconButton>

      <TextField
        fullWidth
        variant="outlined" // Or "standard" for a cleaner look, depends on preference
        size="small"
        placeholder="Type a message..."
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyPress={handleKeyPress}
        multiline
        maxRows={4} // Allow multiline up to 4 rows
        disabled={disabled}
        sx={{
          mr: 1,
          '& .MuiOutlinedInput-root': {
            borderRadius: '20px', // More rounded input field
            backgroundColor: theme.palette.background.paper, // Input field itself uses paper color
          },
        }}
      />
      <IconButton 
        color="primary" 
        onClick={handleSend} 
        disabled={disabled || inputText.trim() === ''}
        aria-label="send message"
      >
        <SendIcon />
      </IconButton>
    </Paper>
  );
};

export default ChatInput;
