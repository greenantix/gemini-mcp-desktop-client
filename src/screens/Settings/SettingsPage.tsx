import { useState, useEffect } from 'react';
import { useTheme as useAppTheme } from '../../contexts/ThemeContext';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  IconButton,
  Grid,
} from '@mui/material';
import {
  ArrowBack,
  Folder,
  Keyboard,
  Palette,
  Save,
  SettingsBackupRestore,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

interface SettingsConfig {
  screenshotLocation: string;
  hotkey: string;
  theme: 'dark' | 'light';
  autoSaveScreenshots: boolean;
  showSystemContext: boolean;
  linuxDistro: string;
}

const defaultSettings: SettingsConfig = {
  screenshotLocation: '~/Pictures/screenshots',
  hotkey: 'ForwardButton',
  theme: 'dark',
  autoSaveScreenshots: true,
  showSystemContext: true,
  linuxDistro: 'pop-os',
};

const availableHotkeys = [
  'ForwardButton', 'F10', 'F11', 'F12',
  'Ctrl+Shift+S', 'Ctrl+Alt+S',
  'Alt+S', 'Alt+Print'
];

const linuxDistros = [
  { value: 'pop-os', label: 'Pop!_OS' },
  { value: 'ubuntu', label: 'Ubuntu' },
  { value: 'debian', label: 'Debian' },
  { value: 'fedora', label: 'Fedora' },
  { value: 'arch', label: 'Arch Linux' },
  { value: 'mint', label: 'Linux Mint' },
  { value: 'generic', label: 'Generic Linux' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { setThemeMode } = useAppTheme();
  const [settings, setSettings] = useState<SettingsConfig>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const result = await (window as any).api.getSettings();
      if (result.success && result.settings) {
        setSettings({ ...defaultSettings, ...result.settings });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await (window as any).api.saveSettings(settings);
      setSavedMessage('Settings saved successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSavedMessage('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setSettings(defaultSettings);
  };

  const selectScreenshotFolder = async () => {
    try {
      const result = await (window as any).api.selectFolder();
      if (result) {
        setSettings(prev => ({ ...prev, screenshotLocation: result }));
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Typography>Loading settings...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3 }}>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
            Linux Helper Settings
          </Typography>
        </Box>

        {savedMessage && (
          <Alert severity={savedMessage.includes('Failed') ? 'error' : 'success'} sx={{ mb: 3 }}>
            {savedMessage}
          </Alert>
        )}

        <Grid container spacing={3}>
          {/* Screenshot Settings */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Folder sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Screenshot Settings</Typography>
              </Box>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                  Screenshot Save Location
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    value={settings.screenshotLocation}
                    onChange={(e) => setSettings(prev => ({ ...prev, screenshotLocation: e.target.value }))}
                    placeholder="~/Pictures/screenshots"
                  />
                  <Button variant="outlined" onClick={selectScreenshotFolder}>
                    Browse
                  </Button>
                </Box>
              </Box>

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.autoSaveScreenshots}
                    onChange={(e) => setSettings(prev => ({ ...prev, autoSaveScreenshots: e.target.checked }))}
                  />
                }
                label="Auto-save screenshots locally"
              />
            </Paper>
          </Grid>

          {/* Hotkey Settings */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Keyboard sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Hotkey Settings</Typography>
              </Box>
              
              <FormControl fullWidth>
                <InputLabel>Screenshot Hotkey</InputLabel>
                <Select
                  value={settings.hotkey}
                  label="Screenshot Hotkey"
                  onChange={(e) => setSettings(prev => ({ ...prev, hotkey: e.target.value }))}
                >
                  {availableHotkeys.map((key) => (
                    <MenuItem key={key} value={key}>
                      {key}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Paper>
          </Grid>

          {/* Linux Settings */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Linux Distribution</Typography>
              
              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Distribution</InputLabel>
                <Select
                  value={settings.linuxDistro}
                  label="Distribution"
                  onChange={(e) => setSettings(prev => ({ ...prev, linuxDistro: e.target.value }))}
                >
                  {linuxDistros.map((distro) => (
                    <MenuItem key={distro.value} value={distro.value}>
                      {distro.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={settings.showSystemContext}
                    onChange={(e) => setSettings(prev => ({ ...prev, showSystemContext: e.target.checked }))}
                  />
                }
                label="Include system context in analysis"
              />
            </Paper>
          </Grid>

          {/* Theme Settings */}
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Palette sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">Theme Settings</Typography>
              </Box>
              
              <FormControl fullWidth>
                <InputLabel>Theme</InputLabel>
                <Select
                  value={settings.theme}
                  label="Theme"
                  onChange={(e) => {
                    const newTheme = e.target.value as 'dark' | 'light';
                    setSettings(prev => ({ ...prev, theme: newTheme }));
                    setThemeMode(newTheme);
                  }}
                >
                  <MenuItem value="dark">Dark (Pop!_OS)</MenuItem>
                  <MenuItem value="light">Light</MenuItem>
                </Select>
              </FormControl>
            </Paper>
          </Grid>
        </Grid>

        {/* Action Buttons */}
        <Box sx={{ display: 'flex', gap: 2, mt: 4, justifyContent: 'center' }}>
          <Button
            variant="outlined"
            startIcon={<SettingsBackupRestore />}
            onClick={resetToDefaults}
          >
            Reset to Defaults
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            onClick={saveSettings}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}