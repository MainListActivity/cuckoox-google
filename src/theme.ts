import { createTheme, PaletteOptions } from '@mui/material/styles';
import { teal, grey } from '@mui/material/colors';

// Define the light palette
const lightPalette: PaletteOptions = {
  primary: {
    main: teal[500],
  },
  secondary: {
    main: teal[700],
  },
  background: {
    default: '#f6f6f6',
    paper: '#ffffff',
  },
  text: {
    primary: grey[900],
    secondary: grey[700],
  },
};

// Define the dark palette
const darkPalette: PaletteOptions = {
  primary: {
    main: teal[500], // Keeping teal consistent, consider teal[300] or teal[400] if more contrast is needed
  },
  secondary: {
    main: teal[700], // Keeping teal consistent
  },
  background: {
    default: grey[900], // Dark grey for background
    paper: grey[800],   // Slightly lighter dark grey for paper elements
  },
  text: {
    primary: grey[50],   // Light grey/white for primary text
    secondary: grey[300], // Medium grey for secondary text
  },
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
      fontFamily: 'Roboto, sans-serif',
    },
  });
};

// Export a default theme (e.g., light theme) for convenience or initial load
const defaultTheme = getAppTheme('light');
export default defaultTheme;
