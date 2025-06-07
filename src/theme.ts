import { createTheme, responsiveFontSizes } from '@mui/material/styles';
import { deepPurple, grey, orange } from '@mui/material/colors';

// Pop OS / Papirus Dark Theme Colors
const primaryColor = '#ffa726'; // Pop OS orange accent
const secondaryColor = '#48b9c7'; // Teal accent
const backgroundColor = '#2d2d2d'; // Dark background like Pop OS
const paperColor = '#3c3c3c'; // Slightly lighter for cards/papers
const surfaceColor = '#424242'; // For elevated surfaces
const userBubbleColor = primaryColor;
const modelBubbleColor = '#4a4a4a'; // Dark grey for AI responses

let theme = createTheme({
  palette: {
    mode: 'dark', // Enable dark mode
    primary: {
      main: primaryColor,
      contrastText: '#ffffff',
    },
    secondary: {
      main: secondaryColor,
      contrastText: '#ffffff',
    },
    background: {
      default: backgroundColor,
      paper: paperColor,
    },
    surface: {
      main: surfaceColor,
    },
    text: {
      primary: '#ffffff', // White text for dark theme
      secondary: '#b0b0b0', // Light grey for secondary text
    },
    // Custom colors for chat bubbles
    userBubble: {
      main: userBubbleColor,
      contrastText: '#000000', // Black text on orange
    },
    modelBubble: {
      main: modelBubbleColor,
      contrastText: '#ffffff', // White text on dark grey
    },
    // Define divider color for dark theme
    divider: '#555555',
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif', // Or choose another font
    h6: {
      fontWeight: 600,
    },
    // Add more customizations as needed
  },
  shape: {
    borderRadius: 8, // Slightly more rounded corners globally
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
                borderRadius: '18px', // Pill-shaped buttons
                padding: '8px 16px',
            },
            containedPrimary: {
                boxShadow: '0 4px 12px -4px rgba(102, 18, 247, 0.4)', // Subtle shadow for primary buttons
                '&:hover': {
                    boxShadow: '0 6px 16px -6px rgba(102, 18, 247, 0.6)',
                }
            }
        }
    },
    MuiTextField: {
        styleOverrides: {
            root: {
                '& .MuiOutlinedInput-root': {
                     borderRadius: '12px', // Rounded input fields
                    //  backgroundColor: paperColor, // Ensure background contrasts if needed
                     '& fieldset': {
                        // borderColor: grey[300], // Subtle border
                     },
                    '&:hover fieldset': {
                        // borderColor: primaryColor, // Border color on hover
                    },
                    '&.Mui-focused fieldset': {
                        // borderColor: primaryColor, // Border color when focused
                        // borderWidth: '1px',
                    },
                },
            },
        },
    },
     MuiAppBar: {
        styleOverrides: {
            root: {
                 backgroundColor: paperColor, // Dark paper color for AppBar
                 color: '#ffffff', // White text on dark AppBar
                 boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)', // Darker shadow for dark theme
                 borderBottom: `1px solid #555555`, // Subtle border
            }
        }
     }
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


export default theme;