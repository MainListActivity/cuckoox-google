import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useSurrealClient } from './SurrealProvider';
import { Case } from './AuthContext'; // Assuming Case type is exported from AuthContext

// 1. Define Theme Structures and Predefined Themes

export interface ThemeColors {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  error: string;
  textOnPrimary: string;
  textOnSecondary: string;
  textOnBackground: string;
  textOnSurface: string;
  textOnError: string;
  // Add more as needed, e.g., accent, success, warning, info
  accent?: string;
  success?: string;
  warning?: string;
  info?: string;
}

export interface Theme {
  name: string;
  colors: ThemeColors;
  type: 'dark' | 'light';
}

// Illustrative Hex Codes (aim for Material Design consistency)
export const CUCKOO_BLUE_THEME: Theme = {
  name: "Cuckoo Blue",
  type: 'light',
  colors: {
    primary: '#1976D2', // Blue 700
    secondary: '#FFC107', // Amber 500
    background: '#F5F5F5', // Grey 100
    surface: '#FFFFFF', // White
    error: '#D32F2F', // Red 700
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#000000',
    textOnBackground: '#000000',
    textOnSurface: '#000000',
    textOnError: '#FFFFFF',
    accent: '#03A9F4', // Light Blue 500
    success: '#4CAF50', // Green 500
    warning: '#FF9800', // Orange 500
    info: '#2196F3', // Blue 500
  }
};

export const FOREST_GREEN_THEME: Theme = {
  name: "Forest Green",
  type: 'light',
  colors: {
    primary: '#388E3C', // Green 700
    secondary: '#FF9800', // Orange 500
    background: '#E8F5E9', // Green 50
    surface: '#FFFFFF',
    error: '#D32F2F',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#000000',
    textOnBackground: '#000000',
    textOnSurface: '#000000',
    textOnError: '#FFFFFF',
    accent: '#8BC34A', // Light Green 500
    success: '#4CAF50',
    warning: '#FFC107', // Amber
    info: '#00BCD4', // Cyan
  }
};

export const INDIGO_NIGHT_THEME: Theme = {
  name: "Indigo Night",
  type: 'dark',
  colors: {
    primary: '#303F9F', // Indigo 700
    secondary: '#FF4081', // Pink A200
    background: '#263238', // Blue Grey 900
    surface: '#37474F', // Blue Grey 800
    error: '#C62828', // Red 800
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#FFFFFF',
    textOnBackground: '#FFFFFF',
    textOnSurface: '#FFFFFF',
    textOnError: '#FFFFFF',
    accent: '#7C4DFF', // Deep Purple A200
    success: '#00C853', // Green A700
    warning: '#FFAB00', // Amber A700
    info: '#2979FF', // Blue A700
  }
};

export const AVAILABLE_THEMES: Theme[] = [CUCKOO_BLUE_THEME, FOREST_GREEN_THEME, INDIGO_NIGHT_THEME];
export const DEFAULT_THEME_NAME = INDIGO_NIGHT_THEME.name; // Changed default to Indigo Night

// 2. Create ThemeContext
interface ThemeContextType {
  currentTheme: Theme;
  availableThemes: Theme[];
  setCurrentThemeByName: (themeName: string) => void;
  isLoadingTheme: boolean;
  mode: 'dark' | 'light';
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 3. Implement ThemeProvider Component
interface ThemeProviderProps {
  children: ReactNode;
}

// Helper to type Case with selected_theme_name
interface CaseWithTheme extends Case {
    selected_theme_name?: string;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [currentThemeName, setCurrentThemeName] = useState<string>(DEFAULT_THEME_NAME);
  const [isLoadingTheme, setIsLoadingTheme] = useState<boolean>(true);
  const [mode, setMode] = useState<'dark' | 'light'>('dark'); // Added mode state
  const { selectedCaseId, userCases, isLoggedIn } = useAuth();
  const client = useSurrealClient();

  const applyTheme = (theme: Theme) => {
    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      if (value) { // Ensure value is not undefined
        // Convert camelCase to kebab-case for CSS variables
        // e.g., textOnPrimary -> --color-text-on-primary
        const cssVarName = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        root.style.setProperty(cssVarName, value);
      }
    });
  };

  useEffect(() => {
    let isMounted = true;
    const loadAndApplyTheme = async () => {
      setIsLoadingTheme(true);
      let themeNameToApply = DEFAULT_THEME_NAME; // Default to Indigo Night
      let initialMode = 'dark'; // Default mode

      // Check localStorage for persisted mode preference
      const persistedMode = localStorage.getItem('themeMode') as 'dark' | 'light' | null;

      if (isLoggedIn && selectedCaseId && client) {
        try {
          // Attempt to get theme from AuthContext's userCases first
          const currentCaseFromAuthContext = userCases.find(c => c.id === selectedCaseId) as CaseWithTheme | undefined;

          if (currentCaseFromAuthContext?.selected_theme_name) {
            themeNameToApply = currentCaseFromAuthContext.selected_theme_name;
          } else {
            // If not found or case in AuthContext is lean, fetch full case details
            const fullCaseData = await client.select<CaseWithTheme>(selectedCaseId);
            if (fullCaseData && fullCaseData.selected_theme_name) {
              themeNameToApply = fullCaseData.selected_theme_name;
            } else {
              // If no theme on case, default to INDIGO_NIGHT_THEME
              themeNameToApply = INDIGO_NIGHT_THEME.name;
            }
          }
        } catch (error) {
          console.error("Error fetching case theme:", error);
          themeNameToApply = INDIGO_NIGHT_THEME.name; // Fallback to Indigo Night
        }
      } else if (persistedMode && !selectedCaseId) { // Prioritize localStorage if no case selected
        themeNameToApply = persistedMode === 'dark' ? INDIGO_NIGHT_THEME.name : CUCKOO_BLUE_THEME.name;
        initialMode = persistedMode;
      } else {
        // For not logged in or no specific case, default to Indigo Night
        themeNameToApply = INDIGO_NIGHT_THEME.name;
        initialMode = INDIGO_NIGHT_THEME.type; // Set mode based on Indigo Night's type
      }
      
      const themeToSet = AVAILABLE_THEMES.find(t => t.name === themeNameToApply) ||
                         INDIGO_NIGHT_THEME; // Ensure Indigo Night is a fallback

      if (isMounted) {
        setCurrentThemeName(themeToSet.name);
        applyTheme(themeToSet);
        setMode(themeToSet.type); // Set mode based on the theme's type
        if (persistedMode && themeToSet.type !== persistedMode && !selectedCaseId) {
          // If there was a persisted mode but the loaded theme (e.g. default) doesn't match, update localStorage
           localStorage.setItem('themeMode', themeToSet.type);
        } else if (!persistedMode) {
            localStorage.setItem('themeMode', themeToSet.type); // Persist initial mode
        }
        setIsLoadingTheme(false);
      }
    };

    loadAndApplyTheme();
    return () => { isMounted = false; };
  }, [selectedCaseId, userCases, client, isLoggedIn]);

  const handleSetCurrentThemeByName = (themeName: string) => {
    const themeToSet = AVAILABLE_THEMES.find(t => t.name === themeName);
    if (themeToSet) {
      setCurrentThemeName(themeToSet.name);
      applyTheme(themeToSet);
      setMode(themeToSet.type); // Also update mode when theme is set by name
      // Note: Saving to DB is handled by Admin UI/Case settings page.
    } else {
      console.warn(`Theme "${themeName}" not found. Applying default theme.`);
      const defaultTheme = INDIGO_NIGHT_THEME; // Fallback to Indigo Night
      setCurrentThemeName(defaultTheme.name);
      applyTheme(defaultTheme);
      setMode(defaultTheme.type);
    }
  };

  const toggleMode = () => {
    const newMode = mode === 'light' ? 'dark' : 'light';
    const themeToApply = newMode === 'dark' ? INDIGO_NIGHT_THEME : CUCKOO_BLUE_THEME;
    // We call handleSetCurrentThemeByName because it already applies the theme and sets the mode.
    handleSetCurrentThemeByName(themeToApply.name); 
    localStorage.setItem('themeMode', newMode);
  };

  const currentTheme = AVAILABLE_THEMES.find(t => t.name === currentThemeName) ||
                       INDIGO_NIGHT_THEME; // Absolute fallback to Indigo Night

  return (
    <ThemeContext.Provider value={{ currentTheme, availableThemes: AVAILABLE_THEMES, setCurrentThemeByName: handleSetCurrentThemeByName, isLoadingTheme, mode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

// 4. Export useTheme hook
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Export ThemeContext directly if needed for advanced use cases, though useTheme is preferred.
export { ThemeContext };
