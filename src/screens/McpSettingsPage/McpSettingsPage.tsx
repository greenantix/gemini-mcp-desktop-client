// @ts-nocheck
import {
  Box,
  Typography,
  Button,
  Paper,
  Fade,
  Stack,
  Modal,
  TextField,
  IconButton,
  Tooltip,
  CircularProgress, // Import CircularProgress for loading state
} from "@mui/material";
import Grid from "@mui/material/Grid";
import { useNavigate } from "react-router-dom";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { useEffect, useState, useCallback } from "react"; // Import useCallback
import { get, post } from "../../utils/api_helper/api_helper";
import {
  Gamepad as UnityIcon,
  // ... (Keep all your existing icon imports)
  Cloud as CloudIcon,
  Storage as StorageIcon,
  GitHub as GitHubIcon,
  Folder as FolderIcon,
  Google as GoogleIcon,
  Map as MapIcon,
  Memory as MemoryIcon,
  Chat as ChatIcon,
  Code as CodeIcon,
  Search as SearchIcon,
  IntegrationInstructions as IntegrationInstructionsIcon,
  WarningAmber as WarningAmberIcon,
  AutoFixHigh as AutoFixHighIcon,
  AccountTree as AccountTreeIcon,
  Mediation as MediationIcon,
  Dns as DnsIcon,
  HdrAuto as HdrAutoIcon,
  AccountBalance as AccountBalanceIcon,
  EmojiNature as EmojiNatureIcon,
  BlurCircular as BlurCircularIcon,
  FilterDrama as FilterDramaIcon,
  QueryStats as QueryStatsIcon,
  NearMe as NearMeIcon,
  AutoStories as AutoStoriesIcon,
  ScreenSearchDesktop as ScreenSearchDesktopIcon,
  DeveloperBoard as DeveloperBoardIcon,
  Whatshot as WhatshotIcon,
  BugReport as BugReportIcon,
  ImageSearch as ImageSearchIcon,
  Timeline as TimelineIcon,
  ManageAccounts as ManageAccountsIcon,
  TravelExplore as TravelExploreIcon,
  Psychology as PsychologyIcon,
  Translate as TranslateIcon,
  Assistant as AssistantIcon,
  BuildCircle as BuildCircleIcon,
  Cached as CachedIcon,
  JoinLeft as JoinLeftIcon,
  DataObject as DataObjectIcon,
  DataArray as DataArrayIcon,
  Kayaking as KayakingIcon,
  AccountBalanceWallet as AccountBalanceWalletIcon,
  Details as DetailsIcon,
  Quickreply as QuickreplyIcon,
  NextWeek as NextWeekIcon,
} from "@mui/icons-material";
// Import the function
import { getDefaultServiceConfigs } from "../../utils/serviceConfigs";
import { toast } from "react-toastify";

// --- labelKeyMap remains the same ---
const labelKeyMap: Record<string, string> = {
  "AWS KB Retrieval": "aws-kb-retrieval",
  "Brave Search": "brave-search",
  EverArt: "everart",
  Unity: "mcp-unity",
  Everything: "everything",
  Filesystem: "filesystem",
  GitHub: "github",
  "Google Drive": "gdrive",
  "Google Maps": "google-maps",
  PostgreSQL: "postgres",
  Puppeteer: "puppeteer",
  Redis: "redis",
  "Sequential Thinking": "sequential-thinking",
  Slack: "slack",
  Memory: "memory",
  GitLab: "gitlab",
  Fetch: "fetch",
  Blender: "blender",
  "21st-dev/magic": "21st-dev/magic",
  AgentQL: "agentql",
  AgentRCP: "agentrpc",
  "Actors Mcp Server": "actors-mcp-server",
  "Astra Db Mcp": "astra-db-mcp",
  "Azure MCP Server": "Azure MCP Server",
  bankless: "bankless",
  ChargeBee: "chargebee",
  "CircleCI Mcp Server": "circleci-mcp-server",
  CloudFlare: "cloudflare",
  Convex: "convex",
  Dart: "dart",
  "E2B Server": "e2b-server",
  Edubase: "edubase",
  ElasticSearch: "elasticsearch-mcp-server",
  Exa: "exa",
  "Fibery Mcp Server": "fibery-mcp-server",
  "Firecrawl Mcp": "firecrawl-mcp",
  Gitee: "gitee",
  "Gyazo Mcp Server": "gyazo-mcp-server",
  Graphlit: "graphlit",
  Heroku: "heroku",
  HyperBrowser: "hyperbrowser",
  "Integration App Hubspot": "integration-app-hubspot",
  Jetbrains: "jetbrains",
  "Lara Translate": "lara-translate",
  Make: "make",
  Supabase: "supabase",
  Momento: "momento",
  Neon: "Neon",
  NotionApi: "notionApi",
  "Oxylabs Mcp": "oxylabs-mcp",
  Paddle: "paddle",
  paypal: "paypal",
  "perplexity Ask": "perplexity-ask",
  Pinecone: "pinecone",
  Raygun: "raygun",
  Rember: "rember",
  Search1API: "search1api",
  "Tavily Mcp": "tavily-mcp",
  Vectorize: "vectorize",
  Xero: "xero",
};

// --- iconMap remains the same ---
const iconMap: Record<string, JSX.Element> = {
  "AWS KB Retrieval": <CloudIcon />,
  "Brave Search": <SearchIcon />,
  Unity: <UnityIcon />,
  EverArt: <IntegrationInstructionsIcon />,
  Blender: <IntegrationInstructionsIcon />,
  Everything: <SearchIcon />,
  Fetch: <SearchIcon />,
  Filesystem: <FolderIcon />,
  Git: <CodeIcon />,
  GitHub: <GitHubIcon />,
  GitLab: <CodeIcon />,
  "Google Drive": <GoogleIcon />,
  "Google Maps": <MapIcon />,
  Memory: <MemoryIcon />,
  PostgreSQL: <StorageIcon />,
  Puppeteer: <IntegrationInstructionsIcon />,
  Redis: <StorageIcon />,
  "Sequential Thinking": <ChatIcon />,
  Slack: <ChatIcon />,
  "21st-dev/magic": <AutoFixHighIcon />,
  AgentQL: <AccountTreeIcon />,
  AgentRCP: <MediationIcon />,
  "Actors Mcp Server": <StorageIcon />,
  "Astra Db Mcp": <DnsIcon />,
  "Azure MCP Server": <HdrAutoIcon />,
  bankless: <AccountBalanceIcon />,
  ChargeBee: <EmojiNatureIcon />,
  "CircleCI Mcp Server": <BlurCircularIcon />,
  CloudFlare: <FilterDramaIcon />,
  Codacy: <CodeIcon />,
  Convex: <QueryStatsIcon />,
  Dart: <NearMeIcon />,
  "E2B Server": <CodeIcon />,
  Edubase: <AutoStoriesIcon />,
  ElasticSearch: <SearchIcon />,
  Exa: <ScreenSearchDesktopIcon />,
  "Fibery Mcp Server": <DeveloperBoardIcon />,
  "Firecrawl Mcp": <WhatshotIcon />,
  Gitee: <BugReportIcon />,
  "Gyazo Mcp Server": <ImageSearchIcon />,
  Graphlit: <TimelineIcon />,
  Heroku: <ManageAccountsIcon />,
  HyperBrowser: <TravelExploreIcon />,
  "Integration App Hubspot": <IntegrationInstructionsIcon />,
  Jetbrains: <PsychologyIcon />,
  "Lara Translate": <TranslateIcon />,
  Make: <AssistantIcon />,
  Supabase: <BuildCircleIcon />,
  Momento: <CachedIcon />,
  Neon: <JoinLeftIcon />,
  NotionApi: <DataObjectIcon />,
  "Oxylabs Mcp": <DataArrayIcon />,
  Paddle: <KayakingIcon />,
  paypal: <AccountBalanceWalletIcon />,
  "perplexity Ask": <TravelExploreIcon />,
  Prisma: <DetailsIcon />,
  Pinecone: <SearchIcon />,
  Raygun: <ScreenSearchDesktopIcon />,
  Rember: <QuickreplyIcon />,
  Search1API: <SearchIcon />,
  "Tavily Mcp": <TravelExploreIcon />,
  Vectorize: <NearMeIcon />,
  Xero: <NextWeekIcon />,
};

// --- ServiceItem type remains the same ---
type ServiceItem = {
  label: string;
  key: string;
  config: any;
};

// No longer define defaultRightList here, as it's fetched asynchronously
// const defaultRightList: ServiceItem[] = ...;

const initialLeftList: ServiceItem[] = [];

// --- EnvWarningButtonWithModal remains the same ---
function EnvWarningButtonWithModal({
  item,
  onSave,
}: {
  item: ServiceItem;
  onSave: (updated: ServiceItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (item.config?.env) {
      // Added optional chaining for safety
      const emptyFields: any = {};
      // Iterate over the env keys defined in the config
      for (const key in item.config.env) {
        // Check if the *value* for this key in the config is empty
        // or if the key exists but has no assigned value yet in the item's *current* state
        if (
          item.config.env[key] === "" ||
          item.config.env[key] === undefined ||
          item.config.env[key] === null
        ) {
          emptyFields[key] = ""; // Initialize field if it's empty in the config template
        }
      }
      setFields(emptyFields);
    }
  }, [item]);

  const handleSave = () => {
    const updatedItem = {
      ...item,
      config: {
        ...item.config,
        // Ensure env exists before spreading
        env: { ...(item.config?.env ?? {}), ...fields },
      },
    };
    onSave(updatedItem);
    setOpen(false);
    // Consider providing more specific feedback or handling potential save errors
    alert("Config updated successfully.");
  };

  const handleFieldChange = (key: string, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  // Check if there are any fields that require configuration
  if (!item.config?.env || Object.keys(item.config.env).length === 0) {
    return null; // No environment variables defined for this service
  }

  // Determine if any required fields are actually empty in the *current* item state
  const hasEmpty = Object.keys(item.config.env).some((key) => {
    // A field is considered empty if its value is empty string, null, or undefined
    const value = item.config.env[key];
    return value === "" || value === null || value === undefined;
  });

  // Only show the warning if there are indeed empty required fields
  if (!hasEmpty) return null;

  return (
    <>
      <Tooltip title="Configuration Required">
        <IconButton
          onClick={() => {
            // Pre-populate modal fields based on current empty values
            const emptyFieldsForModal: any = {};
            for (const key in item.config.env) {
              const value = item.config.env[key];
              if (value === "" || value === null || value === undefined) {
                emptyFieldsForModal[key] = ""; // Keep it empty for user input
              }
            }
            setFields(emptyFieldsForModal); // Set state for the modal
            setOpen(true); // Open the modal
          }}
          sx={{ animation: "pulse 1.2s infinite", ml: 1 }}
        >
          <WarningAmberIcon color="warning" />
        </IconButton>
      </Tooltip>
      <Modal open={open} onClose={() => setOpen(false)}>
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 400,
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 4,
          }}
        >
          <Typography variant="h6" gutterBottom>
            Complete Config for {item.label}
          </Typography>
          {/* Only render fields that were initially empty */}
          {Object.keys(fields).map((key) => (
            <TextField
              key={key}
              label={key}
              fullWidth
              margin="normal"
              value={fields[key]} // Bind to the 'fields' state for the modal
              onChange={(e) => handleFieldChange(key, e.target.value)}
            />
          ))}
          <Stack mt={2} direction="row" justifyContent="flex-end">
            <Button variant="contained" onClick={handleSave}>
              Save
            </Button>
          </Stack>
        </Box>
      </Modal>
    </>
  );
}

// --- SettingsPage component ---
export default function SettingsPage() {
  const navigate = useNavigate();
  // Initialize lists as empty, add loading state
  const [leftList, setLeftList] = useState<ServiceItem[]>(initialLeftList);
  const [rightList, setRightList] = useState<ServiceItem[]>([]); // Start empty
  const [isLoading, setIsLoading] = useState<boolean>(true); // Loading indicator
  const [error, setError] = useState<string | null>(null); // Error state

  // --- getHomeRoute remains the same ---
  // (Although it's now called within getSettings fallback)
  async function getHomeRoute() {
    try {
      if (typeof window === "undefined") return null; // Return null if no window
      // Assuming the API returns the path directly or within a known property
      const response = await get("/api/services/home-route");
      // Adjust based on actual API response structure
      return response?.path || response || null; // Example: return path property or the response itself
    } catch (e) {
      console.error("Error fetching home route:", e);
      return null; // Return null on error
    }
  }

  // --- Function to create ServiceItem array from config object ---
  // Moved logic here to be reusable
  const createServiceListFromConfigs = (
    configs: Record<string, any>
  ): ServiceItem[] => {
    if (!configs || typeof configs !== "object") return []; // Handle invalid input

    return Object.keys(iconMap) // Iterate based on known icons/labels
      .map((label) => {
        const key = labelKeyMap[label];
        if (!key) return null; // Skip if label doesn't map to a key
        return {
          label,
          key,
          config: configs[key] ?? {}, // Get config from the fetched object
        };
      })
      .filter((item): item is ServiceItem => item !== null); // Filter out nulls and type guard
  };

  // --- Updated getSettings function ---
  const getSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const settings = await get("/api/services/get");
      if (
        settings &&
        !settings.error &&
        settings.leftList &&
        settings.rightList
      ) {
        // Ensure fetched lists are arrays before setting state
        setLeftList(Array.isArray(settings.leftList) ? settings.leftList : []);
        setRightList(
          Array.isArray(settings.rightList) ? settings.rightList : []
        );
      } else {
        // Handle case where API returns success but data is invalid/missing
        console.warn(
          "Received settings data but format is invalid or incomplete:",
          settings
        );
        throw new Error(settings?.error || "Invalid settings data received."); // Trigger catch block
      }
    } catch (e) {
      console.error(
        "Failed to get saved settings, attempting to load defaults:",
        e
      );
      setError("Could not load saved settings. Loading defaults..."); // Set preliminary error

      try {
        const path = await getHomeRoute(); // Fetch the path first
        if (path === null) {
          console.error(
            "Failed to get home route path. Cannot load default configs."
          );
          setError(
            "Failed to load default configurations: Missing required path."
          );
          setLeftList([]); // Set lists to empty on fatal error
          setRightList([]);
          return; // Exit if path is missing
        }

        console.log(`Using path "${path}" to fetch default service configs.`);
        const defaultConfigsObject = await getDefaultServiceConfigs(path); // Pass path

        if (!defaultConfigsObject || typeof defaultConfigsObject !== "object") {
          console.error(
            "getDefaultServiceConfigs did not return a valid object."
          );
          setError(
            "Failed to load default configurations: Invalid data format."
          );
          setLeftList([]);
          setRightList([]);
          return;
        }

        const defaultItems = createServiceListFromConfigs(defaultConfigsObject);

        setRightList(defaultItems); // Populate right list with defaults
        setLeftList([]); // Reset left list to empty
        setError(null); // Clear error message if defaults loaded successfully
        console.log("Loaded default configurations successfully.");
      } catch (defaultError) {
        console.error(
          "Failed to fetch or process default configurations:",
          defaultError
        );
        setError(
          "Failed to load default configurations. Please try again later."
        );
        setLeftList([]); // Ensure lists are empty on error
        setRightList([]);
      }
    } finally {
      setIsLoading(false); // Stop loading indicator regardless of outcome
    }
  }, []); // useCallback dependencies are empty as it doesn't rely on props/state outside its scope

  // --- saveSettings remains largely the same ---
  // (Ensure it handles the potentially empty initial state correctly)
  async function saveSettings() {
    const hasIncompleteConfig = leftList.some(
      (item) =>
        item.config?.env &&
        Object.values(item.config.env).some(
          (v) => v === "" || v === null || v === undefined
        )
    );

    if (hasIncompleteConfig) {
      alert(
        "Please complete the configuration for all enabled MCP servers (marked with ⚠️) before saving."
      );
      return;
    }

    setIsLoading(true); // Indicate saving activity
    setError(null);

    try {
      const settingsToBeSaved = { leftList, rightList };
      const response = await post("/api/services/save", settingsToBeSaved);

      if (response && !response.error) {
        // Optionally update state from response if backend modifies lists
        // if (response.leftList && response.rightList) {
        //    setLeftList(Array.isArray(response.leftList) ? response.leftList : leftList);
        //    setRightList(Array.isArray(response.rightList) ? response.rightList : rightList);
        // }
        toast.success("Settings saved successfully!"); // Use toast for success
      } else {
        throw new Error(response?.error || "Unknown error saving settings.");
      }
    } catch (e: any) {
      console.error("Error saving settings:", e);
      setError(`Failed to save settings: ${e.message || "Please try again."}`);
      alert(`Failed to save settings: ${e.message || "Please try again."}`); // Provide error feedback
    } finally {
      setIsLoading(false);
    }
  }

  // --- useEffect to call getSettings on mount ---
  useEffect(() => {
    getSettings();
  }, [getSettings]); // Include getSettings in dependency array

  // --- onDragEnd remains the same ---
  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    // 1. Dropped outside any list
    if (!destination) return;

    // 2. Dropped in the same place
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

    // Identify source and destination lists and their setters
    if (source.droppableId === "left") {
      sourceList = [...leftList];
      setSourceList = setLeftList;
    } else {
      sourceList = [...rightList];
      setSourceList = setRightList;
    }

    if (destination.droppableId === "left") {
      destList = source.droppableId === "left" ? sourceList : [...leftList]; // Use sourceList if same droppable
      setDestList = setLeftList;
    } else {
      destList = source.droppableId === "right" ? sourceList : [...rightList]; // Use sourceList if same droppable
      setDestList = setRightList;
    }

    // 3. Moving within the same list
    if (source.droppableId === destination.droppableId) {
      const [movedItem] = sourceList.splice(source.index, 1);
      sourceList.splice(destination.index, 0, movedItem);
      setSourceList(sourceList); // Update the single list
    }
    // 4. Moving between lists
    else {
      const [movedItem] = sourceList.splice(source.index, 1);
      destList.splice(destination.index, 0, movedItem);
      setSourceList(sourceList); // Update source list (item removed)
      setDestList(destList); // Update destination list (item added)
    }
  };

  // --- updateLeftItem remains the same ---
  const updateLeftItem = (updatedItem: ServiceItem) => {
    setLeftList((prev) =>
      prev.map((item) => (item.key === updatedItem.key ? updatedItem : item))
    );
  };

  // --- renderList remains the same ---
  const renderList = (
    items: ServiceItem[],
    droppableId: string,
    color: string
  ) => {
    const isRightList = droppableId === "right";

    return (
      <Droppable droppableId={droppableId}>
        {(
          provided,
          snapshot // Added snapshot parameter
        ) => (
          <Paper
            ref={provided.innerRef}
            {...provided.droppableProps}
            sx={{
              minHeight: 400,
              p: 2,
              backgroundColor: snapshot.isDraggingOver ? "#e0f7fa" : color, // Change background on drag over
              transition: "background-color 0.3s ease", // Smoother transition
              borderRadius: 2,
              boxShadow: 3,
              display: isRightList ? "grid" : "flex",
              flexDirection: isRightList ? undefined : "column",
              gap: isRightList ? 2 : 1.5,
              ...(isRightList && {
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", // Responsive grid
                "@media (min-width: 600px)": {
                  // Adjust breakpoint as needed
                  gridTemplateColumns: "1fr 1fr", // Keep 2 columns on larger screens if desired
                },
              }),
              overflowY: "auto", // Allow scrolling if content exceeds height
              maxHeight: "70vh", // Limit max height
              position: "relative", // Needed for absolute positioning of loader/error
            }}
          >
            {/* Conditionally render loader inside the list area */}
            {isLoading && items.length === 0 && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(255, 255, 255, 0.7)",
                }}
              >
                <CircularProgress />
              </Box>
            )}
            {/* Conditionally render error inside the list area */}
            {!isLoading && error && items.length === 0 && (
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                }}
              >
                <Typography color="error">{error}</Typography>
              </Box>
            )}
            {!isLoading &&
              !error &&
              items.length === 0 &&
              !snapshot.isDraggingOver && ( // Show placeholder only if not loading, no error, and empty
                <Typography
                  sx={{ textAlign: "center", color: "text.secondary", mt: 2 }}
                >
                  {droppableId === "left"
                    ? "Drag servers here to enable"
                    : "No available servers"}
                </Typography>
              )}
            {items.map((item, index) => (
              <Draggable
                key={item.key} // Use item.key for a more stable key
                draggableId={item.key} // Use item.key for draggableId
                index={index}
              >
                {(
                  provided,
                  snapshot // Added snapshot parameter
                ) => (
                  // Removed Fade, direct Box rendering is usually fine
                  <Box
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    sx={{
                      p: 1.5,
                      backgroundColor: snapshot.isDragging
                        ? "#f5f5f5"
                        : "#ffffff", // Change background when dragging item
                      borderRadius: 2,
                      boxShadow: snapshot.isDragging ? 6 : 2, // Increase shadow when dragging
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      transition:
                        "transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease", // Smoother transitions
                      ":hover": {
                        boxShadow: 4,
                        transform: "scale(1.02)",
                      },
                      cursor: "grab", // Indicate draggable
                      opacity: snapshot.isDragging ? 0.9 : 1, // Slightly transparent when dragging
                    }}
                  >
                    {/* Use item.label safely */}
                    {iconMap[item.label] ?? <IntegrationInstructionsIcon />}
                    <Typography
                      variant="body1"
                      fontWeight={500}
                      sx={{ flexGrow: 1 }}
                    >
                      {" "}
                      {/* Allow text to grow */}
                      {item.label}
                    </Typography>
                    {droppableId === "left" && (
                      <EnvWarningButtonWithModal
                        item={item}
                        onSave={updateLeftItem}
                      />
                    )}
                  </Box>
                )}
              </Draggable>
            ))}
            {provided.placeholder} {/* This is important for dnd */}
          </Paper>
        )}
      </Droppable>
    );
  };

  // --- Return JSX ---
  return (
    <Box p={{ xs: 2, md: 4 }}>
      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Manage MCP Servers
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Drag servers between the lists. Enabled servers require configuration
        (⚠️) before saving.
      </Typography>

      {/* Show a general loading indicator or error message above the lists */}
      {isLoading && (
        <Box sx={{ display: "flex", justifyContent: "center", my: 3 }}>
          <CircularProgress />
        </Box>
      )}
      {/* Show general error only if not loading */}
      {!isLoading && error && (
        <Typography color="error" sx={{ my: 2, textAlign: "center" }}>
          {error}
        </Typography>
      )}

      {/* Only render the drag-and-drop context if not in initial loading state without data */}
      {(!isLoading || leftList.length > 0 || rightList.length > 0) &&
        !error && (
          <DragDropContext onDragEnd={onDragEnd}>
            <Grid container spacing={{ xs: 2, md: 4 }} mt={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom fontWeight="medium">
                  Enabled MCP Servers (used by LLM)
                </Typography>
                {renderList(leftList, "left", "#e3f2fd")}
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom fontWeight="medium">
                  Available MCP Servers
                </Typography>
                {renderList(rightList, "right", "#fff8e1")}
              </Grid>
            </Grid>
          </DragDropContext>
        )}

      <Stack
        mt={4}
        direction={{ xs: "column", sm: "row" }} // Stack vertically on small screens
        spacing={2}
        justifyContent="flex-start" // Align buttons to the start
      >
        <Button
          variant="contained"
          color="primary"
          onClick={saveSettings}
          // Disable save if loading, error state, or incomplete configs
          disabled={
            isLoading ||
            !!error ||
            leftList.some(
              (item) =>
                item.config?.env &&
                Object.values(item.config.env).some(
                  (v) => v === "" || v === null || v === undefined
                )
            )
          }
        >
          {isLoading && !error ? "Saving..." : "Save Changes"}{" "}
          {/* Indicate saving state */}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            try {
              console.log("reached here!!");
              navigate("/");
            } catch (e) {
              console.error("Error navigating to home:", e);
              toast.error("Failed to navigate to home.");
            }
          }}
          type="button"
          disabled={isLoading}
        >
          Back to Home
        </Button>

        {/* Optional: Add back Configure New Server button if needed */}
        <Button
          variant="contained"
          color="secondary"
          onClick={() => navigate("/server-config")}
          disabled={isLoading}
        >
          Configure Server
        </Button>
      </Stack>
    </Box>
  );
}
