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
    main: teal[300], // Teal family - Lighter shade for dark mode
    light: teal[200],
    dark: teal[400],
  },
  secondary: {
    main: cyan[400], // From localDarkTheme, can adjust if needed
    light: cyan[300],
    dark: cyan[500],
  },
  background: {
    default: '#121212', // Dark mode background from localDarkTheme
    paper: '#1e1e1e',   // Dark mode paper from localDarkTheme
  },
  text: {
    primary: '#ffffff',        // White text for dark mode
    secondary: grey[400],    // Lighter grey for secondary text
    disabled: grey[600],
  },
  warning: { // Consistent with localDarkTheme
    main: yellow[700],
    light: yellow[500],
    dark: yellow[800],
  },
  info: { // Consistent with localDarkTheme's blue usage for info
    main: blue[300], 
    light: blue[200],
    dark: blue[400],
  },
  statBlue: { main: cyan[400], light: cyan[300], dark: cyan[500] }, // Using cyan as in localDarkTheme for consistency
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
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
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
    },
  });
};

// Export a default theme (e.g., light theme) for convenience or initial load
const defaultTheme = getAppTheme('light');
export default defaultTheme;
