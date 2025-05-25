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
}

// Illustrative Hex Codes (aim for Material Design consistency)
export const CUCKOO_BLUE_THEME: Theme = {
  name: "Cuckoo Blue",
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
export const DEFAULT_THEME_NAME = CUCKOO_BLUE_THEME.name;

// 2. Create ThemeContext
interface ThemeContextType {
  currentTheme: Theme;
  availableThemes: Theme[];
  setCurrentThemeByName: (themeName: string) => void;
  isLoadingTheme: boolean;
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
      let themeNameToApply = DEFAULT_THEME_NAME;

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
            }
          }
        } catch (error) {
          console.error("Error fetching case theme:", error);
          // Fallback to default if there's an error
          themeNameToApply = DEFAULT_THEME_NAME;
        }
      } else if (!isLoggedIn) {
        // If user is not logged in (e.g. on login page), use default theme
        themeNameToApply = DEFAULT_THEME_NAME;
      }
      // If selectedCaseId is null (e.g. case selection page before selection), default theme is already set

      const themeToSet = AVAILABLE_THEMES.find(t => t.name === themeNameToApply) || 
                         AVAILABLE_THEMES.find(t => t.name === DEFAULT_THEME_NAME) || 
                         CUCKOO_BLUE_THEME; // Absolute fallback

      if (isMounted) {
        setCurrentThemeName(themeToSet.name);
        applyTheme(themeToSet);
        setIsLoadingTheme(false);
      }
    };

    loadAndApplyTheme();
    return () => { isMounted = false; };
  }, [selectedCaseId, userCases, client, isLoggedIn]); // Add isLoggedIn

  const handleSetCurrentThemeByName = (themeName: string) => {
    const themeToSet = AVAILABLE_THEMES.find(t => t.name === themeName);
    if (themeToSet) {
      setCurrentThemeName(themeToSet.name);
      applyTheme(themeToSet);
      // Note: Saving to DB is handled by Admin UI/Case settings page.
      // This function only changes the theme for the current session locally.
    } else {
      console.warn(`Theme "${themeName}" not found. Applying default theme.`);
      const defaultTheme = AVAILABLE_THEMES.find(t => t.name === DEFAULT_THEME_NAME) || CUCKOO_BLUE_THEME;
      setCurrentThemeName(defaultTheme.name);
      applyTheme(defaultTheme);
    }
  };

  const currentTheme = AVAILABLE_THEMES.find(t => t.name === currentThemeName) || 
                       AVAILABLE_THEMES.find(t => t.name === DEFAULT_THEME_NAME) || 
                       CUCKOO_BLUE_THEME; // Absolute fallback

  return (
    <ThemeContext.Provider value={{ currentTheme, availableThemes: AVAILABLE_THEMES, setCurrentThemeByName: handleSetCurrentThemeByName, isLoadingTheme }}>
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
