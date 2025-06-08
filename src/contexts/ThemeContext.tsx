import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createTheme, Theme } from '@mui/material/styles';

interface ThemeContextType {
  theme: Theme;
  themeMode: 'dark' | 'light';
  toggleTheme: () => void;
  setThemeMode: (mode: 'dark' | 'light') => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

const createAppTheme = (mode: 'dark' | 'light'): Theme => {
  const primaryColor = '#ffa726'; // Pop!_OS orange accent
  const secondaryColor = '#48b9c7'; // Pop!_OS teal

  return createTheme({
    palette: {
      mode,
      primary: {
        main: primaryColor,
        light: mode === 'dark' ? '#ffb74d' : '#ffcc02',
        dark: '#f57c00',
        contrastText: mode === 'dark' ? '#000000' : '#ffffff',
      },
      secondary: {
        main: secondaryColor,
        light: '#81c9d7',
        dark: '#2e7d87',
        contrastText: '#ffffff',
      },
      background: {
        default: mode === 'dark' ? '#1a1a1a' : '#f5f5f5',
        paper: mode === 'dark' ? '#2d2d2d' : '#ffffff',
      },
      text: {
        primary: mode === 'dark' ? '#ffffff' : '#333333',
        secondary: mode === 'dark' ? '#b0b0b0' : '#666666',
      },
      action: {
        hover: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
        selected: mode === 'dark' ? 'rgba(255, 167, 38, 0.15)' : 'rgba(255, 167, 38, 0.1)',
      },
      divider: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: {
        fontWeight: 600,
      },
      h6: {
        fontWeight: 500,
      },
    },
    shape: {
      borderRadius: 8,
    },
    components: {
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 8,
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 8,
            },
          },
        },
      },
    },
  });
};

export const AppThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [theme, setTheme] = useState<Theme>(createAppTheme('dark'));

  useEffect(() => {
    loadThemeFromSettings();
  }, []);

  useEffect(() => {
    setTheme(createAppTheme(themeMode));
  }, [themeMode]);

  const loadThemeFromSettings = async () => {
    try {
      const result = await window.api.getSettings();
      if (result.success && result.settings?.theme) { // Added optional chaining for settings
        setThemeMode(result.settings.theme);
      }
    } catch (error) {
      console.error('Failed to load theme from settings:', error);
    }
  };

  const toggleTheme = () => {
    const newMode = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(newMode);
    saveThemeToSettings(newMode);
  };

  const handleSetThemeMode = (mode: 'dark' | 'light') => {
    setThemeMode(mode);
    saveThemeToSettings(mode);
  };

  const saveThemeToSettings = async (mode: 'dark' | 'light') => {
    try {
      const currentSettingsResult = await window.api.getSettings();
      if (currentSettingsResult.success && currentSettingsResult.settings) { // Ensure settings exist
        const updatedSettings = {
          ...currentSettingsResult.settings,
          theme: mode,
        };
        await window.api.saveSettings(updatedSettings);
      }
    } catch (error) {
      console.error('Failed to save theme to settings:', error);
    }
  };

  return (
    <ThemeContext.Provider 
      value={{ 
        theme, 
        themeMode, 
        toggleTheme, 
        setThemeMode: handleSetThemeMode 
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};