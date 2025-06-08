import { useState, useEffect, useCallback } from 'react';
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
  Tabs,
  Tab,
  Divider,
  Chip,
  CircularProgress,
  Stack,
} from '@mui/material';
import {
  ArrowBack,
  Folder,
  Keyboard,
  Palette,
  Save,
  SettingsBackupRestore,
  Security,
  Extension,
  Computer,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { get, post } from '../../utils/api_helper/api_helper';
import { toast } from 'react-toastify';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';
import { getDefaultServiceConfigs } from '../../utils/serviceConfigs';

interface SettingsConfig {
  screenshotLocation: string;
  hotkey: string;
  theme: 'dark' | 'light';
  autoSaveScreenshots: boolean;
  showSystemContext: boolean;
  linuxDistro: string;
  geminiApiKey?: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

function a11yProps(index: number) {
  return {
    id: `settings-tab-${index}`,
    'aria-controls': `settings-tabpanel-${index}`,
  };
}

// MCP Service types
type ServiceItem = {
  label: string;
  key: string;
  config: any;
};

const defaultSettings: SettingsConfig = {
  screenshotLocation: '~/Pictures/screenshots',
  hotkey: 'ForwardButton',
  theme: 'dark',
  autoSaveScreenshots: true,
  showSystemContext: true,
  linuxDistro: 'pop-os',
};

const availableHotkeys = [
  { value: 'ForwardButton', label: 'Forward Mouse Button (Recommended)' },
  { value: 'MiddleClick', label: 'Middle Mouse Button' },
  { value: 'BackButton', label: 'Back Mouse Button' },
  { value: 'F10', label: 'F10 Key' },
  { value: 'F11', label: 'F11 Key' },
  { value: 'F12', label: 'F12 Key' },
  { value: 'Ctrl+Shift+S', label: 'Ctrl+Shift+S' },
  { value: 'Ctrl+Alt+S', label: 'Ctrl+Alt+S' },
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
  const [tabValue, setTabValue] = useState(0);
  
  // MCP Service states
  const [leftList, setLeftList] = useState<ServiceItem[]>([]);
  const [rightList, setRightList] = useState<ServiceItem[]>([]);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpError, setMcpError] = useState<string | null>(null);
  
  // API Key validation
  const [apiKeyValidating, setApiKeyValidating] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);

  useEffect(() => {
    loadSettings();
    loadMcpSettings();
  }, []);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const loadSettings = async () => {
    try {
      const result = await (window as any).api.getSettings();
      if (result.success && result.settings) {
        setSettings({ ...defaultSettings, ...result.settings });
      }
      
      // Load server configuration for API key
      try {
        const serverConfig = await get('/api/server-config');
        if (serverConfig?.GEMINI_API_KEY) {
          setSettings(prev => ({ ...prev, geminiApiKey: serverConfig.GEMINI_API_KEY }));
          setApiKeyValid(true);
        }
      } catch (error) {
        console.log('No server config found or error loading:', error);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMcpSettings = useCallback(async () => {
    setMcpLoading(true);
    setMcpError(null);
    try {
      const mcpSettings = await get('/api/services/get');
      if (
        mcpSettings &&
        !mcpSettings.error &&
        mcpSettings.leftList &&
        mcpSettings.rightList
      ) {
        setLeftList(Array.isArray(mcpSettings.leftList) ? mcpSettings.leftList : []);
        setRightList(Array.isArray(mcpSettings.rightList) ? mcpSettings.rightList : []);
      } else {
        // Load defaults if no saved settings
        try {
          const path = await getHomeRoute();
          if (path) {
            const defaultConfigsObject = await getDefaultServiceConfigs(path);
            const defaultItems = createServiceListFromConfigs(defaultConfigsObject);
            setRightList(defaultItems);
            setLeftList([]);
          }
        } catch (defaultError) {
          console.error('Failed to load default MCP configs:', defaultError);
          setMcpError('Failed to load MCP service configurations');
        }
      }
    } catch (error) {
      console.error('Failed to load MCP settings:', error);
      setMcpError('Failed to load MCP settings');
    } finally {
      setMcpLoading(false);
    }
  }, []);

  const validateGeminiApiKey = async (apiKey: string) => {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.ok) {
        return { valid: true };
      } else {
        const error = await response.json();
        return { valid: false, error };
      }
    } catch (err) {
      console.error('Validation error:', err);
      return { valid: false, error: err };
    }
  };

  const handleApiKeyChange = async (newApiKey: string) => {
    setSettings(prev => ({ ...prev, geminiApiKey: newApiKey }));
    
    if (newApiKey.trim()) {
      setApiKeyValidating(true);
      const validation = await validateGeminiApiKey(newApiKey);
      setApiKeyValid(validation.valid);
      setApiKeyValidating(false);
    } else {
      setApiKeyValid(null);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      // Save general settings
      const { geminiApiKey, ...electronSettings } = settings;
      await (window as any).api.saveSettings(electronSettings);
      
      // Save API key if provided
      if (geminiApiKey && apiKeyValid) {
        await post('/api/server-config', { GEMINI_API_KEY: geminiApiKey });
      }
      
      // Save MCP settings
      const hasIncompleteConfig = leftList.some(
        (item) =>
          item.config?.env &&
          Object.values(item.config.env).some(
            (v) => v === '' || v === null || v === undefined
          )
      );

      if (hasIncompleteConfig) {
        setSavedMessage('Please complete MCP server configurations before saving');
        setTimeout(() => setSavedMessage(''), 5000);
        return;
      }

      const mcpSettings = { leftList, rightList };
      await post('/api/services/save', mcpSettings);
      
      setSavedMessage('All settings saved successfully!');
      setTimeout(() => setSavedMessage(''), 3000);
      toast.success('Settings saved successfully!');
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSavedMessage('Failed to save settings');
      toast.error('Failed to save settings');
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

  // MCP helper functions
  async function getHomeRoute() {
    try {
      const response = await get('/api/services/home-route');
      return response?.path || response || null;
    } catch (e) {
      console.error('Error fetching home route:', e);
      return null;
    }
  }

  const createServiceListFromConfigs = (configs: Record<string, any>): ServiceItem[] => {
    if (!configs || typeof configs !== 'object') return [];
    
    // Basic labelKeyMap for common services
    const labelKeyMap: Record<string, string> = {
      'Filesystem': 'filesystem',
      'GitHub': 'github',
      'PostgreSQL': 'postgres',
      'Memory': 'memory',
      'Brave Search': 'brave-search',
      'Everything': 'everything',
      'Google Drive': 'gdrive',
      'Slack': 'slack',
    };
    
    return Object.keys(labelKeyMap)
      .map((label) => {
        const key = labelKeyMap[label];
        if (!key) return null;
        return {
          label,
          key,
          config: configs[key] ?? {},
        };
      })
      .filter((item): item is ServiceItem => item !== null);
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (!destination) return;

    if (
      source.droppableId === destination.droppableId &&
      source.index === destination.index
    ) {
      return;
    }

    let sourceList: ServiceItem[];
    let destList: ServiceItem[];
    let setSourceList: React.Dispatch<React.SetStateAction<ServiceItem[]>>;
    let setDestList: React.Dispatch<React.SetStateAction<ServiceItem[]>>;

    if (source.droppableId === 'left') {
      sourceList = [...leftList];
      setSourceList = setLeftList;
    } else {
      sourceList = [...rightList];
      setSourceList = setRightList;
    }

    if (destination.droppableId === 'left') {
      destList = source.droppableId === 'left' ? sourceList : [...leftList];
      setDestList = setLeftList;
    } else {
      destList = source.droppableId === 'right' ? sourceList : [...rightList];
      setDestList = setRightList;
    }

    if (source.droppableId === destination.droppableId) {
      const [movedItem] = sourceList.splice(source.index, 1);
      sourceList.splice(destination.index, 0, movedItem);
      setSourceList(sourceList);
    } else {
      const [movedItem] = sourceList.splice(source.index, 1);
      destList.splice(destination.index, 0, movedItem);
      setSourceList(sourceList);
      setDestList(destList);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading settings...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: 3 }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <IconButton onClick={() => navigate('/')} sx={{ mr: 2 }}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" sx={{ color: 'primary.main', fontWeight: 'bold' }}>
            Settings
          </Typography>
        </Box>

        {savedMessage && (
          <Alert severity={savedMessage.includes('Failed') ? 'error' : 'success'} sx={{ mb: 3 }}>
            {savedMessage}
          </Alert>
        )}

        {/* Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="settings tabs">
            <Tab label="Linux Helper" icon={<Computer />} {...a11yProps(0)} />
            <Tab label="API Configuration" icon={<Security />} {...a11yProps(1)} />
            <Tab label="MCP Services" icon={<Extension />} {...a11yProps(2)} />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <TabPanel value={tabValue} index={0}>
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
                  <InputLabel>AI Helper Hotkey</InputLabel>
                  <Select
                    value={settings.hotkey}
                    label="AI Helper Hotkey"
                    onChange={(e) => setSettings(prev => ({ ...prev, hotkey: e.target.value }))}
                  >
                    {availableHotkeys.map((hotkey) => (
                      <MenuItem key={hotkey.value} value={hotkey.value}>
                        {hotkey.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Press your selected hotkey to capture screen and get AI analysis
                </Typography>
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
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Security sx={{ mr: 1, color: 'primary.main' }} />
                  <Typography variant="h6">Gemini API Configuration</Typography>
                </Box>
                
                <TextField
                  fullWidth
                  label="Gemini API Key"
                  type="password"
                  value={settings.geminiApiKey || ''}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder="Enter your Gemini API Key"
                  helperText="Required for AI analysis functionality"
                  InputProps={{
                    endAdornment: apiKeyValidating ? (
                      <CircularProgress size={20} />
                    ) : apiKeyValid === true ? (
                      <Chip label="Valid" color="success" size="small" />
                    ) : apiKeyValid === false ? (
                      <Chip label="Invalid" color="error" size="small" />
                    ) : null,
                  }}
                />
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={tabValue} index={2}>
          <Typography variant="h6" gutterBottom>
            MCP Service Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Drag services between lists. Enabled services require configuration before saving.
          </Typography>
          
          {mcpLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
              <CircularProgress />
            </Box>
          )}
          
          {mcpError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {mcpError}
            </Alert>
          )}
          
          {!mcpLoading && !mcpError && (
            <DragDropContext onDragEnd={onDragEnd}>
              <Grid container spacing={3} sx={{ mt: 1 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                    Enabled MCP Services
                  </Typography>
                  <Droppable droppableId="left">
                    {(provided) => (
                      <Paper
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        sx={{
                          minHeight: 300,
                          p: 2,
                          backgroundColor: 'rgba(255, 167, 38, 0.05)',
                        }}
                      >
                        {leftList.length === 0 && (
                          <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                            Drag services here to enable
                          </Typography>
                        )}
                        {leftList.map((item, index) => (
                          <Draggable key={item.key} draggableId={item.key} index={index}>
                            {(provided) => (
                              <Box
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                sx={{
                                  p: 1.5,
                                  mb: 1,
                                  backgroundColor: 'background.paper',
                                  borderRadius: 1,
                                  boxShadow: 1,
                                }}
                              >
                                <Typography>{item.label}</Typography>
                              </Box>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </Paper>
                    )}
                  </Droppable>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle1" gutterBottom fontWeight="medium">
                    Available MCP Services
                  </Typography>
                  <Droppable droppableId="right">
                    {(provided) => (
                      <Paper
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        sx={{
                          minHeight: 300,
                          p: 2,
                          backgroundColor: 'rgba(72, 185, 199, 0.05)',
                        }}
                      >
                        {rightList.length === 0 && (
                          <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 2 }}>
                            No available services
                          </Typography>
                        )}
                        {rightList.map((item, index) => (
                          <Draggable key={item.key} draggableId={item.key} index={index}>
                            {(provided) => (
                              <Box
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                sx={{
                                  p: 1.5,
                                  mb: 1,
                                  backgroundColor: 'background.paper',
                                  borderRadius: 1,
                                  boxShadow: 1,
                                }}
                              >
                                <Typography>{item.label}</Typography>
                              </Box>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </Paper>
                    )}
                  </Droppable>
                </Grid>
              </Grid>
            </DragDropContext>
          )}
        </TabPanel>

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