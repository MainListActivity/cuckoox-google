import React, { createContext, useContext, useState, ReactNode } from 'react';
import Snackbar from '@mui/material/Snackbar';
import Alert, { AlertProps, AlertColor } from '@mui/material/Alert'; // Import AlertColor
// import { useTheme } from './ThemeContext'; // To access current theme for styling if needed

export interface SnackbarContextType {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

interface SnackbarProviderProps {
  children: ReactNode;
}

export const SnackbarProvider: React.FC<SnackbarProviderProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<AlertColor>('success'); // Add severity state
  // const { currentTheme } = useTheme(); // Get current theme

  const showSuccess = React.useCallback((newMessage: string) => {
    setMessage(newMessage);
    setSeverity('success');
    setOpen(true);
  }, []);

  const showError = React.useCallback((newMessage: string) => {
    setMessage(newMessage);
    setSeverity('error');
    setOpen(true);
  }, []);

  const showWarning = React.useCallback((newMessage: string) => {
    setMessage(newMessage);
    setSeverity('warning');
    setOpen(true);
  }, []);

  const showInfo = React.useCallback((newMessage: string) => {
    setMessage(newMessage);
    setSeverity('info');
    setOpen(true);
  }, []);

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
    <SnackbarContext.Provider value={{ showSuccess, showError, showWarning, showInfo }}>
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
            severity={severity} // Use the state variable here
            sx={{ 
                width: '100%',
                // Ensuring the alert uses our theme's colors for corresponding severity
                // Example: backgroundColor might be currentTheme.colors[severity] if structured that way
                // Or rely on MUI's theme integration to handle palette colors for success, error, warning, info
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
