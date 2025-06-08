import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  TextField,
  Typography,
  Stack,
  Paper,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from "@mui/material";
import { get, post } from "../../utils/api_helper/api_helper";
import { motion } from "framer-motion";
import SettingsIcon from "@mui/icons-material/Settings";
import CancelIcon from "@mui/icons-material/Cancel";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";

const validateGeminiApiKey = async (apiKey: string) => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      return { valid: true };
    } else {
      const error = await response.json();
      console.warn("❌ Invalid API Key:", error);
      return { valid: false, error };
    }
  } catch (err) {
    console.error("Validation error:", err);
    return { valid: false, error: err };
  }
};

const ServerConfiguration: React.FC = () => {
  const [apiKey, setApiKey] = useState("");
  const [displayButtons, setDisplayButtons] = useState(false);
  const [loading, setLoading] = useState(false);
  const [screenshotHotkey, setScreenshotHotkey] = useState("F10");
  const [screenshotLocation, setScreenshotLocation] = useState("~/Pictures/screenshots");
  const navigate = useNavigate();

  const availableHotkeys = ['F10', 'F11', 'F12', 'Ctrl+Shift+S', 'Ctrl+Alt+S'];

  // Load Linux Helper settings
  useEffect(() => {
    loadLinuxHelperSettings();
  }, []);

  const loadLinuxHelperSettings = async () => {
    try {
      const result = await (window as any).api.getSettings();
      if (result.success && result.settings) {
        setScreenshotHotkey(result.settings.hotkey || 'F10');
        setScreenshotLocation(result.settings.screenshotLocation || '~/Pictures/screenshots');
      }
    } catch (error) {
      console.error('Failed to load Linux Helper settings:', error);
    }
  };

  const saveLinuxHelperSettings = async () => {
    try {
      const currentResult = await (window as any).api.getSettings();
      const currentSettings = currentResult.success ? currentResult.settings : {};
      
      const updatedSettings = {
        ...currentSettings,
        hotkey: screenshotHotkey,
        screenshotLocation: screenshotLocation,
      };
      
      await (window as any).api.saveSettings(updatedSettings);
    } catch (error) {
      console.error('Failed to save Linux Helper settings:', error);
    }
  };

  async function checkServerConfig() {
    try {
      const serverConfig = await get("/api/server-config");
      if (serverConfig?.GEMINI_API_KEY) {
        setDisplayButtons(true);
      }
    } catch (e) {
      setDisplayButtons(false);
      console.log(e);
    }
  }

  useEffect(() => {
    checkServerConfig();
  }, []);

  const handleSave = async () => {
    setLoading(true);

    const validation = await validateGeminiApiKey(apiKey);
    if (!validation.valid) {
      alert("❌ Invalid Gemini API Key. Please check and try again.");
      setLoading(false);
      return;
    }

    try {
      await post("/api/server-config", { GEMINI_API_KEY: apiKey });
      await saveLinuxHelperSettings();
      navigate("/");
    } catch (error) {
      console.error("Failed to save configuration:", error);
      alert("❌ Failed to save configuration. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      sx={{
        height: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "background.default",
        p: 2,
      }}
    >
      <Paper elevation={4} sx={{ p: 4, width: 400, borderRadius: 4 }}>
        <Stack spacing={4} alignItems="center">
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            🚀 Server Configuration
          </Typography>

          <TextField
            fullWidth
            label="🔑 Gemini API Key"
            placeholder="Enter your Gemini API Key"
            value={apiKey}
            type="password"
            onChange={(e) => setApiKey(e.target.value)}
            variant="outlined"
          />

          <Divider sx={{ width: "100%" }}>
            <Chip label="🐧 Linux Helper Settings" size="small" />
          </Divider>

          <Stack spacing={2} sx={{ width: "100%" }}>
            <FormControl fullWidth>
              <InputLabel>Screenshot Hotkey</InputLabel>
              <Select
                value={screenshotHotkey}
                label="Screenshot Hotkey"
                onChange={(e) => setScreenshotHotkey(e.target.value)}
              >
                {availableHotkeys.map((key) => (
                  <MenuItem key={key} value={key}>
                    {key}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="📁 Screenshot Location"
              placeholder="~/Pictures/screenshots"
              value={screenshotLocation}
              onChange={(e) => setScreenshotLocation(e.target.value)}
              variant="outlined"
              helperText="F10 → Screenshot → Analysis → F10 again → Paste command to cursor"
            />
          </Stack>

          <Stack direction="row" spacing={2} sx={{ width: "100%" }}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleSave}
              startIcon={
                loading ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <RocketLaunchIcon />
                )
              }
              disabled={!apiKey || loading}
            >
              {loading
                ? "Validating..."
                : displayButtons
                ? "Save"
                : "Save & Launch"}
            </Button>
          </Stack>

          {displayButtons && (
            <Stack direction="row" spacing={2} sx={{ width: "100%" }}>
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                onClick={() => navigate("/mcp-settings")}
                startIcon={<SettingsIcon />}
              >
                MCP Settings
              </Button>
              <Button
                fullWidth
                variant="text"
                color="error"
                onClick={() => navigate("/")}
                startIcon={<CancelIcon />}
              >
                Cancel
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};

export default ServerConfiguration;
