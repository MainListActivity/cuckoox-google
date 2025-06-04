import { createTheme, PaletteOptions, alpha } from '@mui/material/styles';
import { teal, grey, blue, green, yellow, purple, orange, red, cyan } from '@mui/material/colors';

// Module augmentation for custom palette keys
declare module '@mui/material/styles' {
  interface Palette {
    statBlue: Palette['primary'];
    statGreen: Palette['primary'];
    statYellow: Palette['primary'];
    statPurple: Palette['primary'];
    statRed: Palette['primary'];
    chartBlue: Palette['primary'];
    chartGreen: Palette['primary'];
    chartYellow: Palette['primary'];
    chartOrange: Palette['primary'];
    chartPurple: Palette['primary'];
    chartRed: Palette['primary'];
  }
  interface PaletteOptions {
    statBlue?: PaletteOptions['primary'];
    statGreen?: PaletteOptions['primary'];
    statYellow?: PaletteOptions['primary'];
    statPurple?: PaletteOptions['primary'];
    statRed?: PaletteOptions['primary'];
    chartBlue?: PaletteOptions['primary'];
    chartGreen?: PaletteOptions['primary'];
    chartYellow?: PaletteOptions['primary'];
    chartOrange?: PaletteOptions['primary'];
    chartPurple?: PaletteOptions['primary'];
    chartRed?: PaletteOptions['primary'];
  }
  interface TypographyVariants {
    digitalMetric: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    digitalMetric?: React.CSSProperties;
  }
}

// Define the light palette
const lightPalette: PaletteOptions = {
  primary: {
    main: teal[500], // Teal family as per 规范.md
    light: teal[300],
    dark: teal[700],
  },
  secondary: {
    main: teal[700], // Teal family
    light: teal[500],
    dark: teal[900],
  },
  background: {
    default: '#f6f6f6', // As per 规范.md
    paper: '#ffffff',
  },
  text: {
    primary: grey[900],
    secondary: grey[700],
    disabled: grey[500],
  },
  warning: { // Standard warning colors
    main: yellow[700], 
    light: yellow[500],
    dark: yellow[800],
  },
  info: { // Standard info colors
    main: blue[700],
    light: blue[500],
    dark: blue[900],
  },
  statBlue: { main: blue[700], light: blue[500], dark: blue[900] },
  statGreen: { main: green[700], light: green[500], dark: green[900] },
  statYellow: { main: yellow[700], light: yellow[500], dark: yellow[800] },
  statPurple: { main: purple[700], light: purple[500], dark: purple[900] },
  statRed: { main: red[700], light: red[500], dark: red[900] },
  chartBlue: { main: blue[600], light: blue[400], dark: blue[800] },
  chartGreen: { main: green[600], light: green[400], dark: green[800] },
  chartYellow: { main: yellow[600], light: yellow[400], dark: yellow[800] },
  chartOrange: { main: orange[600], light: orange[400], dark: orange[800] },
  chartPurple: { main: purple[600], light: purple[400], dark: purple[800] },
  chartRed: { main: red[600], light: red[400], dark: red[800] },
};

// Define the dark palette
const darkPalette: PaletteOptions = {
  primary: {
    main: teal[500], // 更新为与设计稿一致的 teal[500]
    light: teal[300],
    dark: teal[700],
  },
  secondary: {
    main: teal[200], // 更新为与设计稿一致的 teal[200]
    light: teal[100],
    dark: teal[300],
  },
  background: {
    default: '#121212', // 与设计稿一致的暗色背景
    paper: '#1e1e1e',   // 与设计稿一致的暗色纸张背景
  },
  text: {
    primary: '#ffffff',        // 白色文本用于暗色模式
    secondary: 'rgba(255, 255, 255, 0.7)', // 与设计稿一致的次要文本颜色
    disabled: grey[600],
  },
  warning: { // 保持一致的警告颜色
    main: yellow[700],
    light: yellow[500],
    dark: yellow[800],
  },
  info: { // 保持一致的信息颜色
    main: blue[300], 
    light: blue[200],
    dark: blue[400],
  },
  statBlue: { main: cyan[400], light: cyan[300], dark: cyan[500] },
  statGreen: { main: green[400], light: green[300], dark: green[500] },
  statYellow: { main: yellow[400], light: yellow[300], dark: yellow[500] },
  statPurple: { main: purple[300], light: purple[200], dark: purple[400] },
  statRed: { main: red[400], light: red[300], dark: red[500] },
  chartBlue: { main: blue[400], light: blue[300], dark: blue[500] },
  chartGreen: { main: green[500], light: green[400], dark: green[600] },
  chartYellow: { main: yellow[500], light: yellow[400], dark: yellow[600] },
  chartOrange: { main: orange[400], light: orange[300], dark: orange[500] },
  chartPurple: { main: purple[400], light: purple[300], dark: purple[500] },
  chartRed: { main: red[500], light: red[400], dark: red[600] },
};

// Function to create a theme based on the mode ('light' or 'dark')
export const getAppTheme = (mode: 'light' | 'dark') => {
  const selectedPalette = mode === 'dark' ? darkPalette : lightPalette;
  return createTheme({
    palette: {
      mode, // Pass the mode to MUI
      ...selectedPalette,
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
      h1: { 
        fontWeight: 700, 
        letterSpacing: '0.05em', 
        color: selectedPalette.primary?.main, // Use palette's primary color
        fontSize: '2.5rem' 
      },
      h2: { // For metric card titles from localDarkTheme
        fontWeight: 500, 
        color: selectedPalette.text?.secondary, 
        fontSize: '0.9rem', 
        letterSpacing: '0.05em', 
        textTransform: 'uppercase', 
        opacity: 0.9 
      }, 
      h3: { 
        fontWeight: 700, 
        color: selectedPalette.secondary?.main, // Use palette's secondary color
        fontSize: '2rem' 
      },
      digitalMetric: { // For the large numbers in metric cards from localDarkTheme
        fontFamily: '"Roboto Mono", monospace',
        fontWeight: 700,
        fontSize: '2.75rem',
        lineHeight: 1.1,
        letterSpacing: '0.03em',
      },
      subtitle1: { color: selectedPalette.text?.secondary, fontSize: '0.9rem' },
      body2: { fontSize: '0.8rem' },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({ // Default card style from localDarkTheme
            border: `1px solid ${alpha(theme.palette.primary.main, 0.3)}`,
            transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
            '&:hover': {
              transform: 'scale(1.03)',
              boxShadow: `0px 8px 20px ${alpha(theme.palette.primary.main, 0.25)}`,
            },
          }),
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: ({ theme }) => ({
            backgroundColor: mode === 'dark' ? teal[900] : teal[700],
            color: '#ffffff',
          }),
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: ({ theme }) => ({
            backgroundColor: mode === 'dark' ? 'transparent' : '#f6f6f6',
            color: mode === 'dark' ? '#ffffff' : 'rgba(0, 0, 0, 0.87)',
            boxShadow: 'none',
            borderBottom: mode === 'dark' 
              ? '1px solid rgba(255, 255, 255, 0.12)' 
              : '1px solid rgba(0, 0, 0, 0.12)',
          }),
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            borderRadius: 1,
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
            },
            '&.Mui-selected': {
              backgroundColor: alpha(theme.palette.primary.main, 0.16),
              '&:hover': {
                backgroundColor: alpha(theme.palette.primary.main, 0.24),
              },
            },
          }),
        },
      },
    },
  });
};

// 导出深色主题和亮色主题
export const darkTheme = getAppTheme('dark');
export const lightTheme = getAppTheme('light');

// Export a default theme (e.g., light theme) for convenience or initial load
const defaultTheme = getAppTheme('dark'); // 默认使用深色模式
export default defaultTheme;
