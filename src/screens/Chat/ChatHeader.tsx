import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Tooltip,
  Box,
  MenuItem,
  Button,
  Menu, // Import Menu
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SmartToyIcon from '@mui/icons-material/SmartToy'; // Example Gemini-like icon
import MenuIcon from '@mui/icons-material/Menu';
import { useNavigate } from 'react-router-dom';
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import { useState, MouseEvent } from 'react'; // Import MouseEvent

interface ChatHeaderProps {
  onMenuClick?: () => void;
  setSelectedModel: (value: string) => void; // Make event optional
  selectedModel: string;
}

export default function ChatHeader({
  onMenuClick,
  selectedModel,
  setSelectedModel,
}: ChatHeaderProps) {
  const navigate = useNavigate();
  // State for Menu anchor element
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl); // Menu is open if anchorEl is set

  // Models for selection
  const models = [
    "gemini-2.5-pro-preview-05-06",
    "gemini-2.5-flash-preview-04-17",
    "gemini-2.5-pro-exp-03-25",
    "gemini-2.5-pro-preview-03-25",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-1.5-flash",
  ];

  const handleModelButtonClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget); // Set the button as the anchor
  };

  const handleModelMenuClose = () => {
    setAnchorEl(null); // Close the menu
  };

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    setAnchorEl(null); // Close the menu after selection
  };

  // Linux Helper trigger function
  const handleLinuxHelperClick = async () => {
    try {
      console.log('🐧 Linux Helper button clicked');
      // For now, just simulate the hotkey press
      if ((window as any).ipcRenderer) {
        (window as any).ipcRenderer.send('manual-linux-helper-trigger');
      }
    } catch (error) {
      console.error('Failed to trigger Linux Helper:', error);
    }
  };

  return (
    <AppBar position="static" elevation={0} sx={{ backgroundColor: 'transparent', color: 'text.primary' /* Or your theme's header color */ }}>
      <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {onMenuClick && (
            <Tooltip title="History Bar">
              <IconButton edge="start" color="inherit" onClick={onMenuClick} sx={{ mr: 1 }}>
                <MenuIcon />
              </IconButton>
            </Tooltip>
          )}
          <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
            <SmartToyIcon fontSize="small" />
          </Avatar>
          <Typography variant="h6" component="div" sx={{ fontWeight: 'medium' }}>
            Gemini Chat
          </Typography>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Button
            id="model-selector-button" // ID for aria-controls
            variant="outlined"
            onClick={handleModelButtonClick}
            aria-controls={open ? 'model-select-menu' : undefined}
            aria-haspopup="true"
            aria-expanded={open ? 'true' : undefined}
            sx={{
              borderRadius: "20px",
              display: "flex",
              alignItems: "center",
              padding: "6px 12px",
              textTransform: 'none', // Keep model name casing
              minWidth: '220px', // Adjust as needed for your longest typical model name
              justifyContent: 'space-between',
              mr: 1.5, // Margin to separate from settings icon
              borderColor: 'grey.400',
              color: 'text.primary',
              '&:hover': {
                borderColor: 'primary.main',
              }
            }}
            endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />} // Use endIcon prop for cleaner icon placement
          >
            {selectedModel}
          </Button>
          <Menu
            id="model-select-menu"
            anchorEl={anchorEl}
            open={open}
            onClose={handleModelMenuClose} // Handles clicking outside the menu
            MenuListProps={{
              'aria-labelledby': 'model-selector-button',
              sx: {
                // Attempt to set width based on anchor, but provide max width
                // The menu will try to fit itself without going off-screen
                minWidth: anchorEl ? anchorEl.offsetWidth : '220px', // Ensure menu is at least as wide as button
                maxWidth: '350px', // Max width to prevent very wide menus with long names
                maxHeight: '300px', // For scrollability if many models
                boxShadow: 3,
                borderRadius: '8px',
              }
            }}
            // These origins help position the menu correctly, especially near screen edges
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right', // Anchors menu's right to button's right
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right', // Menu transforms (opens) from its top-right corner
            }}
          >
            {models.map((model) => (
              <MenuItem
                key={model}
                selected={model === selectedModel}
                onClick={() => handleModelSelect(model)}
                sx={{
                  fontSize: '0.875rem',
                  '&.Mui-selected': {
                    backgroundColor: 'primary.light', // Example selection color
                    color: 'primary.contrastText',
                    '&:hover': {
                        backgroundColor: 'primary.main',
                    }
                  },
                  '&:hover': {
                    backgroundColor: 'action.hover',
                  }
                }}
              >
                {model}
              </MenuItem>
            ))}
          </Menu>

          <Tooltip title="Linux Helper (F10)">
            <IconButton 
              color="inherit" 
              onClick={handleLinuxHelperClick}
              sx={{ mr: 1 }}
            >
              <CameraAltIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
            <IconButton color="inherit" onClick={() => navigate('/server-config')}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}