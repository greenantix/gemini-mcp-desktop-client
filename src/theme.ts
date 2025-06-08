import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import { deepPurple, grey, orange } from '@mui/material/colors';

// Official Pop!_OS Dark Theme Colors
const primaryColor = '#FAA41A'; // Official Pop!_OS orange (light theme variant)
const primaryDarkColor = '#CC7900'; // Official Pop!_OS orange (dark theme variant)
const secondaryColor = '#48B9C7'; // Official Pop!_OS teal
const secondaryDarkColor = '#0A97A5'; // Official Pop!_OS teal (dark theme variant)
const accentGreen = '#73C48F'; // Pop!_OS suggestion/success color
const destructionColor = '#F15D22'; // Pop!_OS destruction/error color

// Pop!_OS System Colors
const backgroundColor = '#333130'; // Pop!_OS dark charcoal background
const paperColor = '#3D3D3D'; // Slightly lighter for cards/papers
const surfaceColor = '#4A4A4A'; // For elevated surfaces
const borderColor = '#5A5A5A'; // For subtle borders
const textPrimary = '#F6F6F6'; // Off-white text
const textSecondary = '#C0C0C0'; // Secondary text

const userBubbleColor = primaryColor;
const modelBubbleColor = '#484848'; // Neutral dark grey for AI responses

let theme = createTheme({
  palette: {
    mode: 'dark', // Enable dark mode
    primary: {
      main: primaryColor, // Bright Pop!_OS orange
      dark: primaryDarkColor, // Darker orange for active states
      light: '#FFB13D', // Lighter orange for hover states
      contrastText: '#000000', // Black text on orange backgrounds
    },
    secondary: {
      main: secondaryColor, // Pop!_OS teal
      dark: secondaryDarkColor, // Darker teal for active states
      light: '#6BC5D0', // Lighter teal for hover states
      contrastText: '#000000', // Black text on teal backgrounds
    },
    success: {
      main: accentGreen, // Pop!_OS suggestion green
      contrastText: '#000000',
    },
    error: {
      main: destructionColor, // Pop!_OS destruction red
      contrastText: '#ffffff',
    },
    background: {
      default: backgroundColor, // Dark charcoal
      paper: paperColor, // Cards and surfaces
    },
    surface: {
      main: surfaceColor,
    },
    text: {
      primary: textPrimary, // Off-white
      secondary: textSecondary, // Light grey
    },
    // Custom colors for chat bubbles
    userBubble: {
      main: userBubbleColor,
      contrastText: '#000000', // Black text on orange
    },
    modelBubble: {
      main: modelBubbleColor,
      contrastText: textPrimary, // Off-white text on dark grey
    },
    // Define divider color for dark theme
    divider: borderColor,
    action: {
      hover: 'rgba(250, 164, 26, 0.08)', // Subtle orange hover
      selected: 'rgba(250, 164, 26, 0.12)', // Orange selection
      disabled: 'rgba(255, 255, 255, 0.26)',
      disabledBackground: 'rgba(255, 255, 255, 0.12)',
    },
  },
  typography: {
    fontFamily: '"Fira Sans", "Roboto", "Ubuntu", "Helvetica", "Arial", sans-serif', // Pop!_OS uses Fira Sans
    h1: {
      fontWeight: 700,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 700,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    h4: {
      fontWeight: 600,
    },
    h5: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 600,
    },
    button: {
      fontWeight: 500,
      letterSpacing: '0.02em',
    },
  },
  shape: {
    borderRadius: 6, // Pop!_OS style rounded corners
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          // Default paper styles if needed
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none', // Keep button text casing as is
          borderRadius: '6px', // Pop!_OS style borders
          padding: '8px 16px',
          fontWeight: 500,
        },
        containedPrimary: {
          backgroundColor: primaryColor,
          color: '#000000', // Black text on orange
          boxShadow: '0 2px 8px rgba(250, 164, 26, 0.3)', // Orange shadow
          '&:hover': {
            backgroundColor: primaryDarkColor,
            boxShadow: '0 4px 12px rgba(250, 164, 26, 0.4)',
          },
          '&:active': {
            backgroundColor: '#B8880E',
          },
        },
        outlined: {
          borderColor: primaryColor,
          color: primaryColor,
          '&:hover': {
            borderColor: primaryDarkColor,
            backgroundColor: 'rgba(250, 164, 26, 0.08)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: '6px', // Pop!_OS style borders
            backgroundColor: paperColor,
            '& fieldset': {
              borderColor: borderColor,
            },
            '&:hover fieldset': {
              borderColor: primaryColor,
            },
            '&.Mui-focused fieldset': {
              borderColor: primaryColor,
              borderWidth: '2px',
            },
          },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: paperColor,
          color: textPrimary,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
          borderBottom: `1px solid ${borderColor}`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundColor: paperColor,
          backgroundImage: 'none', // Remove MUI default gradient
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: paperColor,
          borderRadius: '8px',
          border: `1px solid ${borderColor}`,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          '&.Mui-selected': {
            color: primaryColor,
          },
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        indicator: {
          backgroundColor: primaryColor,
          height: '3px',
        },
      },
    },
  },
});

// Add responsive font sizes
theme = responsiveFontSizes(theme);

// Extend Theme type for custom colors (TypeScript specific)
declare module '@mui/material/styles' {
  interface Palette {
    userBubble: Palette['primary'];
    modelBubble: Palette['primary'];
    surface: Palette['primary'];
  }
  interface PaletteOptions {
    userBubble?: PaletteOptions['primary'];
    modelBubble?: PaletteOptions['primary'];
    surface?: PaletteOptions['primary'];
  }
}

// Export color constants for use in other components
export const popOSColors = {
  primaryOrange: primaryColor,
  primaryOrangeDark: primaryDarkColor,
  secondaryTeal: secondaryColor,
  secondaryTealDark: secondaryDarkColor,
  accentGreen,
  destructionRed: destructionColor,
  backgroundCharcoal: backgroundColor,
  paperGrey: paperColor,
  surfaceGrey: surfaceColor,
  borderGrey: borderColor,
  textPrimary,
  textSecondary,
};


export default theme;