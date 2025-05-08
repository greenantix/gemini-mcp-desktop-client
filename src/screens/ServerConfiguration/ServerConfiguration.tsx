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
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Divider,
} from "@mui/material";
import { get, post } from "../../utils/api_helper/api_helper"; // Assuming these are correctly set up
import { motion } from "framer-motion";

// Icons
import SettingsIcon from "@mui/icons-material/Settings";
import CancelIcon from "@mui/icons-material/Cancel";
import RocketLaunchIcon from "@mui/icons-material/RocketLaunch";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";

interface ApiKeyEntry {
  id: string;
  value: string;
  isValidating: boolean;
  isValid: boolean | null; // null: not validated, true: valid, false: invalid
  error: string | null;
}

// This is the same validation function you provided
const validateGeminiApiKey = async (apiKey: string) => {
  if (!apiKey.trim()) {
    return {
      valid: false,
      error: { error: { message: "API key cannot be empty." } },
    };
  }
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
      const errorData = await response.json();
      console.warn("❌ Invalid API Key:", errorData);
      return { valid: false, error: errorData }; // errorData usually has { error: { message: "..."}}
    }
  } catch (err) {
    console.error("Validation network error:", err);
    return {
      valid: false,
      error: { error: { message: "Network error during validation." } },
    };
  }
};

const maskApiKey = (key: string) => {
  if (!key || key.length < 8) return key;
  return `${key.substring(0, 6)}...${key.slice(-4)}`;
};

const ServerConfiguration: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKeyEntry[]>([]);
  const [newApiKeyInput, setNewApiKeyInput] = useState("");
  const [displayExtraButtons, setDisplayExtraButtons] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const navigate = useNavigate();

  const createApiKeyEntry = (value: string): ApiKeyEntry => ({
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    value,
    isValidating: false,
    isValid: null,
    error: null,
  });

  useEffect(() => {
    const fetchServerConfig = async () => {
      setIsLoadingConfig(true);
      try {
        const serverConfig = await get("/api/server-config");
        if (
          serverConfig?.GEMINI_API_KEYS &&
          Array.isArray(serverConfig.GEMINI_API_KEYS)
        ) {
          const loadedKeys = serverConfig.GEMINI_API_KEYS.map(
            (keyVal: string) => createApiKeyEntry(keyVal)
          );
          setApiKeys(loadedKeys);
          if (loadedKeys.length > 0) {
            setDisplayExtraButtons(true);
          }
        } else {
          setDisplayExtraButtons(false);
        }
      } catch (e) {
        console.log("No existing server config or error fetching:", e);
        setDisplayExtraButtons(false);
      } finally {
        setIsLoadingConfig(false);
      }
    };
    fetchServerConfig();
  }, []);

  const handleAddApiKey = () => {
    const trimmedKey = newApiKeyInput.trim();
    if (!trimmedKey) {
      alert("Please enter an API key.");
      return;
    }
    if (apiKeys.some((ak) => ak.value === trimmedKey)) {
      alert("This API key has already been added.");
      return;
    }
    setApiKeys((prev) => [...prev, createApiKeyEntry(trimmedKey)]);
    setNewApiKeyInput("");
  };

  const handleRemoveApiKey = (idToRemove: string) => {
    setApiKeys((prev) => prev.filter((key) => key.id !== idToRemove));
  };

  const handleSaveAndLaunch = async () => {
    if (apiKeys.length === 0) {
      alert("Please add at least one API key.");
      return;
    }

    setIsSaving(true);

    // Mark all keys as 'validating'
    setApiKeys((prev) =>
      prev.map((k) => ({
        ...k,
        isValidating: true,
        isValid: null,
        error: null,
      }))
    );

    const validationResults = await Promise.all(
      apiKeys.map(async (keyEntry) => {
        const result = await validateGeminiApiKey(keyEntry.value);
        return {
          id: keyEntry.id,
          value: keyEntry.value, // Keep original value
          isValid: result.valid,
          error: result.valid
            ? null
            : result.error?.error?.message ||
              "Invalid key or validation failed.",
        };
      })
    );

    // Update state with all validation results
    setApiKeys((currentKeys) =>
      currentKeys.map((currentKey) => {
        const validatedResult = validationResults.find(
          (vr) => vr.id === currentKey.id
        );
        if (validatedResult) {
          return {
            ...currentKey,
            value: validatedResult.value, // Ensure we use the value that was validated
            isValidating: false,
            isValid: validatedResult.isValid,
            error: validatedResult.error,
          };
        }
        return currentKey; // Should not happen if IDs match
      })
    );

    const validApiValues = validationResults
      .filter((result) => result.isValid)
      .map((result) => result.value);

    if (validApiValues.length === 0) {
      alert(
        "No valid API keys provided. Please check your keys. Only valid keys will be saved."
      );
      setIsSaving(false);
      return;
    }

    try {
      await post("/api/server-config", { GEMINI_API_KEYS: validApiValues });
      alert(`Successfully saved ${validApiValues.length} API key(s).`);
      navigate("/"); // Or to a success page/dashboard
    } catch (error) {
      console.error("Failed to save API keys:", error);
      alert("❌ Failed to save API keys to the server. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingConfig) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
        <Typography sx={{ ml: 2 }}>Loading configuration...</Typography>
      </Box>
    );
  }

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "grey.100",
        p: 2,
      }}
    >
      <Paper
        elevation={4}
        sx={{
          p: { xs: 2, sm: 4 },
          width: "100%",
          maxWidth: 600,
          borderRadius: 4,
        }}
      >
        <Stack spacing={3} alignItems="center">
          <Typography variant="h5" fontWeight="bold" gutterBottom>
            🚀 Gemini API Key Configuration
          </Typography>

          <Stack direction="row" spacing={1} sx={{ width: "100%" }}>
            <TextField
              fullWidth
              label="Add Gemini API Key"
              placeholder="Enter new API Key"
              value={newApiKeyInput}
              type="password"
              onChange={(e) => setNewApiKeyInput(e.target.value)}
              variant="outlined"
              size="small"
              onKeyPress={(e) => {
                if (e.key === "Enter") handleAddApiKey();
              }}
            />
            <Button
              variant="contained"
              onClick={handleAddApiKey}
              startIcon={<AddIcon />}
              disabled={!newApiKeyInput.trim()}
              sx={{ flexShrink: 0 }}
            >
              Add
            </Button>
          </Stack>

          {apiKeys.length > 0 && (
            <Box
              sx={{
                width: "100%",
                maxHeight: 200,
                overflowY: "auto",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 1,
              }}
            >
              <List dense disablePadding>
                {apiKeys.map((keyEntry, index) => (
                  <React.Fragment key={keyEntry.id}>
                    <ListItem
                      secondaryAction={
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleRemoveApiKey(keyEntry.id)}
                          disabled={isSaving}
                        >
                          <DeleteIcon />
                        </IconButton>
                      }
                    >
                      <ListItemIcon sx={{ minWidth: "auto", mr: 1 }}>
                        {keyEntry.isValidating ? (
                          <CircularProgress size={20} />
                        ) : keyEntry.isValid === true ? (
                          <Tooltip title="Valid API Key">
                            <CheckCircleOutlineIcon color="success" />
                          </Tooltip>
                        ) : keyEntry.isValid === false ? (
                          <Tooltip title={keyEntry.error || "Invalid API Key"}>
                            <ErrorOutlineIcon color="error" />
                          </Tooltip>
                        ) : (
                          <Tooltip title="Not validated yet">
                            <HelpOutlineIcon color="action" />
                          </Tooltip>
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={maskApiKey(keyEntry.value)}
                        secondary={
                          keyEntry.isValid === false ? keyEntry.error : null
                        }
                        primaryTypographyProps={{
                          sx: {
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          },
                        }}
                      />
                    </ListItem>
                    {index < apiKeys.length - 1 && <Divider component="li" />}
                  </React.Fragment>
                ))}
              </List>
            </Box>
          )}
          {apiKeys.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No API keys added yet.
            </Typography>
          )}

          <Stack direction="row" spacing={2} sx={{ width: "100%", mt: 2 }}>
            <Button
              fullWidth
              variant="contained"
              color="primary"
              onClick={handleSaveAndLaunch}
              startIcon={
                isSaving ? (
                  <CircularProgress size={20} color="inherit" />
                ) : (
                  <RocketLaunchIcon />
                )
              }
              disabled={apiKeys.length === 0 || isSaving}
            >
              {isSaving
                ? "Validating & Saving..."
                : displayExtraButtons
                ? "Save"
                : "Save & Launch"}
            </Button>
          </Stack>

          {displayExtraButtons && (
            <Stack direction="row" spacing={2} sx={{ width: "100%", mt: 1 }}>
              <Button
                fullWidth
                variant="outlined"
                color="secondary"
                onClick={() => navigate("/settings")} // Assuming this component IS NOT /settings
                startIcon={<SettingsIcon />}
                disabled={isSaving}
              >
                Other Settings
              </Button>
              <Button
                fullWidth
                variant="text"
                color="inherit"
                onClick={() => navigate("/")}
                startIcon={<CancelIcon />}
                disabled={isSaving}
              >
                Cancel & Go to App
              </Button>
            </Stack>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};

export default ServerConfiguration;
