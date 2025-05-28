import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { ThemeProvider as MuiThemeProvider, Theme as MuiTheme } from '@mui/material/styles';
import { getAppTheme } from '../theme'; // Corrected path
import { grey } from '@mui/material/colors';

// 1. Define Context Types
interface ThemeContextType {
  themeMode: 'light' | 'dark';
  toggleThemeMode: () => void;
  muiTheme: MuiTheme; // Provide the current MUI theme object
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 2. Helper function to update CSS variables for Tailwind
const updateCssVariables = (theme: MuiTheme) => {
  const root = document.documentElement;
  const mode = theme.palette.mode;

  // Core palette colors
  root.style.setProperty('--color-primary', theme.palette.primary.main);
  root.style.setProperty('--color-secondary', theme.palette.secondary.main);
  root.style.setProperty('--color-error', theme.palette.error.main);
  root.style.setProperty('--color-warning', theme.palette.warning.main);
  root.style.setProperty('--color-info', theme.palette.info.main);
  root.style.setProperty('--color-success', theme.palette.success.main);
  
  // Background and surface
  root.style.setProperty('--color-background', theme.palette.background.default);
  root.style.setProperty('--color-surface', theme.palette.background.paper);

  // Text colors
  root.style.setProperty('--color-text-primary', theme.palette.text.primary);
  root.style.setProperty('--color-text-secondary', theme.palette.text.secondary);
  root.style.setProperty('--color-text-disabled', theme.palette.text.disabled);
  
  // Contrast text colors (for text on colored backgrounds)
  root.style.setProperty('--color-text-on-primary', theme.palette.primary.contrastText);
  root.style.setProperty('--color-text-on-secondary', theme.palette.secondary.contrastText);
  // Assuming error, warning, info, success also need contrast text.
  // MUI typically ensures contrastText is available for these palette colors.
  root.style.setProperty('--color-text-on-error', theme.palette.error.contrastText);


  // Accent color - using secondary for now, could be customized
  root.style.setProperty('--color-accent', theme.palette.secondary.main);

  // Specific variables for Quill editor theme
  root.style.setProperty('--color-primary-dark', theme.palette.primary.dark);
  root.style.setProperty('--color-action-hover', theme.palette.action.hover);
  root.style.setProperty('--color-action-selected', theme.palette.action.selected);
  root.style.setProperty('--color-background-disabled', theme.palette.action.disabledBackground);

  // Border colors - these are often context-dependent or shades of grey
  if (mode === 'light') {
    root.style.setProperty('--color-border-light', grey[300]); // Lighter border for light mode
    root.style.setProperty('--color-border-dark', grey[400]);  // Darker border for light mode (e.g., for dividers)
    root.style.setProperty('--color-text-hint', grey[500]); // Specific hint text for Quill (like #aaa)
    root.style.setProperty('--color-background-disabled-light', grey[100]); // Lighter than disabledBackground
    root.style.setProperty('--color-border-disabled', grey[400]); 
    root.style.setProperty('--color-text-disabled-hint', grey[400]); // Lighter than text.disabled
  } else {
    root.style.setProperty('--color-border-light', grey[700]); // Lighter border for dark mode
    root.style.setProperty('--color-border-dark', grey[600]);  // Darker border for dark mode
    root.style.setProperty('--color-text-hint', grey[600]); // Specific hint text for Quill
    root.style.setProperty('--color-background-disabled-light', grey[800]); // Lighter than disabledBackground
    root.style.setProperty('--color-border-disabled', grey[700]);
    root.style.setProperty('--color-text-disabled-hint', grey[700]); // Lighter than text.disabled
  }
  
  // Ensure all Tailwind variables are covered. From tailwind.config.js:
  // primary, secondary, accent, background, surface, error, warning, info, success,
  // text-primary, text-secondary, on-primary, on-secondary, disabled, hint,
  // border-light, border-dark.
  // 'on-warning', 'on-info', 'on-success' might be needed if not covered by a generic 'on-color' variable.
  // For now, we assume specific 'on-error' is defined, others might fall back to general text or need specific definition.
  // If specific on-warning, on-info, on-success text colors are needed, they can be added here.
  // e.g. root.style.setProperty('--color-text-on-warning', theme.palette.warning.contrastText);
};

// 3. Implement ThemeProvider Component
interface CustomThemeProviderProps {
  children: ReactNode;
}

export const CustomThemeProvider: React.FC<CustomThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<'light' | 'dark'>(() => {
    const persistedMode = localStorage.getItem('themeMode');
    return (persistedMode === 'light' || persistedMode === 'dark') ? persistedMode : 'dark'; // Default to dark
  });

  // Memoize the MUI theme object to prevent unnecessary re-renders
  const muiTheme = useMemo(() => getAppTheme(themeMode), [themeMode]);

  useEffect(() => {
    // Apply CSS variables whenever the MUI theme changes (due to themeMode change)
    updateCssVariables(muiTheme);
    // Persist themeMode to localStorage
    localStorage.setItem('themeMode', themeMode);
  }, [muiTheme]); // muiTheme dependency ensures this runs when themeMode changes

  const toggleThemeMode = () => {
    setThemeMode((prevMode) => (prevMode === 'light' ? 'dark' : 'light'));
  };

  const contextValue = useMemo(() => ({
    themeMode,
    toggleThemeMode,
    muiTheme, // Provide the muiTheme object itself
  }), [themeMode, muiTheme]);


  return (
    <ThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={muiTheme}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

// 4. Export useTheme hook
export const useCustomTheme = () => { // Renamed to avoid conflict if there's another useTheme
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useCustomTheme must be used within a CustomThemeProvider');
  }
  return context;
};

// Export ThemeContext directly if needed for advanced use cases, though useCustomTheme is preferred.
export { ThemeContext as CustomThemeContext }; // Renamed for clarity
