import React, { createContext, useContext, useState, ReactNode } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert, { AlertProps } from '@mui/material/Alert';
import { useTheme } from './ThemeContext'; // To access current theme for styling if needed

interface SnackbarContextType {
  showSuccess: (message: string) => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

interface SnackbarProviderProps {
  children: ReactNode;
}

export const SnackbarProvider: React.FC<SnackbarProviderProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const { currentTheme } = useTheme(); // Get current theme

  const showSuccess = (newMessage: string) => {
    setMessage(newMessage);
    setOpen(true);
  };

  const handleClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setOpen(false);
  };

  // ForwardRef for Alert component as required by MUI Snackbar when using custom components
  const AlertRef = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
    props,
    ref,
  ) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
  });
  
  // Renaming MUI Alert to avoid naming conflict in this scope
  const MuiAlert = Alert;


  return (
    <SnackbarContext.Provider value={{ showSuccess }}>
      {children}
      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {/* 
          The Alert component from MUI by default should adapt to theme.
          Its 'success' severity will use theme.palette.success.main for background
          and theme.palette.success.contrastText for text.
          Our ThemeContext provides theme.colors.success and theme.colors.textOnPrimary (or similar for contrast).
          If MUI Alert doesn't pick these up automatically via CSS variables,
          we might need to apply styles directly here.
          However, Material UI components are generally designed to work with the ThemeProvider.
          Let's assume standard behavior first.
        */}
        <AlertRef 
            onClose={handleClose} 
            severity="success" 
            sx={{ 
                width: '100%',
                // Ensuring the alert uses our theme's success colors
                // backgroundColor: currentTheme.colors.success, // Example if direct styling is needed
                // color: currentTheme.colors.textOnPrimary, // Example if direct styling is needed
            }}
        >
          {message}
        </AlertRef>
      </Snackbar>
    </SnackbarContext.Provider>
  );
};

export const useSnackbar = () => {
  const context = useContext(SnackbarContext);
  if (context === undefined) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
};
