import { createTheme, ThemeOptions } from '@mui/material/styles';
import { teal, grey } from '@mui/material/colors';

// 创建深色主题
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: teal[500],
      light: teal[300],
      dark: teal[700],
    },
    secondary: {
      main: teal[200],
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
    text: {
      primary: '#ffffff',
      secondary: 'rgba(255, 255, 255, 0.7)',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: teal[900],
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'transparent',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
        },
      },
    },
  },
});

// 创建亮色主题
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: teal[500],
      light: teal[300],
      dark: teal[700],
    },
    secondary: {
      main: teal[700],
    },
    background: {
      default: '#f6f6f6',
      paper: '#ffffff',
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
  },
  components: {
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: teal[700],
          color: '#ffffff',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#f6f6f6',
          color: 'rgba(0, 0, 0, 0.87)',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
        },
      },
    },
  },
});
