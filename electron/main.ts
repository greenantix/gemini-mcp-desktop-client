import {
  app,
  BrowserWindow,
  MessageBoxReturnValue,
  ipcMain,
  screen,
  systemPreferences,
  shell,
  dialog,
  desktopCapturer,
  session,
  globalShortcut,
} from "electron";
import * as fs from "fs";
import * as os from "os";
// import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { startServer } from "../src/backend/server.ts";
import fixPath from "fix-path";
// const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
console.log("[Main Process] PATH before fix:", process.env.PATH);
fixPath();
console.log("[Main Process] PATH after fix:", process.env.PATH); // Check if it changed
// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

let win: BrowserWindow;

// Linux Helper Tool State
interface LinuxHelperState {
  isWaitingForSecondHotkey: boolean;
  lastScreenshot: string | null;
  lastSuggestions: string | null;
}

const helperState: LinuxHelperState = {
  isWaitingForSecondHotkey: false,
  lastScreenshot: null,
  lastSuggestions: null,
};

// Screenshot save directory setup
function ensureScreenshotDirectory(): string {
  const homeDir = os.homedir();
  const screenshotDir = path.join(homeDir, "Pictures", "screenshots");
  
  try {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      console.log(`📁 Created screenshot directory: ${screenshotDir}`);
    }
    return screenshotDir;
  } catch (error) {
    console.error("Failed to create screenshot directory:", error);
    // Fallback to home directory
    return homeDir;
  }
}

// Save screenshot to local file
async function saveScreenshotLocally(screenshotDataUrl: string): Promise<{filepath: string, filename: string, size: number} | null> {
  try {
    const screenshotDir = ensureScreenshotDirectoryWithSettings();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `linux-helper-${timestamp}.png`;
    const filepath = path.join(screenshotDir, filename);
    
    // Remove data:image/png;base64, prefix
    const base64Data = screenshotDataUrl.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    fs.writeFileSync(filepath, buffer);
    console.log(`💾 Screenshot saved: ${filepath}`);
    
    return {
      filepath,
      filename,
      size: buffer.length
    };
  } catch (error) {
    console.error("Failed to save screenshot:", error);
    return null;
  }
}

// Screenshot capture function
async function captureActiveMonitorScreenshot(): Promise<{dataUrl: string, filename: string, filepath: string, size: number} | null> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    
    if (sources.length > 0) {
      // Get the primary display screenshot
      const screenshot = sources[0].thumbnail;
      const dataUrl = screenshot.toDataURL();
      
      // Save screenshot locally
      const saveResult = await saveScreenshotLocally(dataUrl);
      
      if (saveResult) {
        return {
          dataUrl,
          filename: saveResult.filename,
          filepath: saveResult.filepath,
          size: saveResult.size
        };
      }
    }
    return null;
  } catch (error) {
    console.error("Failed to capture screenshot:", error);
    return null;
  }
}

// Linux Helper hotkey handler
async function handleLinuxHelperHotkey() {
  if (!helperState.isWaitingForSecondHotkey) {
    // First hotkey press - capture and analyze
    console.log("🔥 Linux Helper activated - capturing screenshot...");
    
    const screenshotData = await captureActiveMonitorScreenshot();
    if (screenshotData) {
      helperState.lastScreenshot = screenshotData.dataUrl;
      
      // Send screenshot with metadata to chat for analysis
      win.webContents.send("linux-helper-screenshot", {
        screenshot: screenshotData.dataUrl,
        filename: screenshotData.filename,
        filepath: screenshotData.filepath,
        size: screenshotData.size,
        action: "analyze"
      });
      
      helperState.isWaitingForSecondHotkey = true;
      
      // Auto-reset after 30 seconds if no second hotkey
      setTimeout(() => {
        if (helperState.isWaitingForSecondHotkey) {
          helperState.isWaitingForSecondHotkey = false;
          console.log("🕐 Linux Helper timeout - resetting state");
        }
      }, 30000);
    }
  } else {
    // Second hotkey press - execute suggestions
    console.log("⚡ Linux Helper executing suggestions...");
    
    win.webContents.send("linux-helper-execute", {
      action: "execute"
    });
    
    helperState.isWaitingForSecondHotkey = false;
  }
}

async function checkAndRequestMicrophonePermission(): Promise<boolean> {
  if (process.platform !== "darwin") {
    return true;
  }

  let accessStatus = systemPreferences.getMediaAccessStatus("microphone");
  console.log(`Initial microphone access status: ${accessStatus}`);

  if (accessStatus === "granted") {
    return true;
  }

  if (accessStatus === "not-determined") {
    const granted = await systemPreferences.askForMediaAccess("microphone");
    console.log(`Permission after askForMediaAccess: ${granted}`);
    if (!granted) {
      const result: MessageBoxReturnValue = await dialog.showMessageBox(win, {
        // await the promise
        type: "warning",
        title: "Microphone Access Denied",
        message:
          "Microphone access was denied. To use voice input, please enable it in System Settings and restart the app.",
        buttons: ["Open System Settings", "Cancel"],
        defaultId: 0,
        cancelId: 1,
      });
      if (result.response === 0) {
        // Check result.response
        shell.openExternal(
          "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
        );
      }
    }
    return granted;
  }

  if (accessStatus === "denied" || accessStatus === "restricted") {
    console.log("Microphone access was previously denied or is restricted.");
    const result: MessageBoxReturnValue = await dialog.showMessageBox(win, {
      // await the promise
      type: "warning",
      title: "Microphone Access Required",
      message:
        "This app requires microphone access for voice input. Please enable it in System Settings > Privacy & Security > Microphone, then restart the application.",
      buttons: ["Open System Settings", "Cancel"],
      defaultId: 0,
      cancelId: 1,
    });
    if (result.response === 0) {
      // Check result.response
      shell.openExternal(
        "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
      );
    }
    return false;
  }
  console.warn(`Unknown microphone access status: ${accessStatus}`);
  return false;
}
function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  win = new BrowserWindow({
    title: "Linux Helper - Pop!_OS Assistant",
    width,
    height,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      webSecurity: false,
      preload: path.join(__dirname, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: true,
      devTools: true, // ✅ explicitly enable devTools
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }

  // ✅ Open DevTools automatically
  win.webContents.openDevTools();
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Unregister all global shortcuts before quitting
    globalShortcut.unregisterAll();
    app.quit();
    // win = null;
  }
});

app.on("will-quit", () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(async () => {
  session.defaultSession.setDisplayMediaRequestHandler(
    (_, callback) => {
      desktopCapturer.getSources({ types: ["screen"] }).then((sources) => {
        callback({ video: sources[0], audio: "loopback" });
      });
    },
    { useSystemPicker: true }
  );
  
  // Load settings and register hotkey
  loadSettings();
  
  // Register Linux Helper global shortcuts using settings
  const hotkeyRegistered = globalShortcut.register(currentSettings.hotkey, handleLinuxHelperHotkey);
  if (hotkeyRegistered) {
    console.log(`🚀 Linux Helper hotkey (${currentSettings.hotkey}) registered successfully`);
  } else {
    console.log(`❌ Failed to register Linux Helper hotkey (${currentSettings.hotkey})`);
  }
  
  // ESC key to dismiss/reset state
  globalShortcut.register('Escape', () => {
    if (helperState.isWaitingForSecondHotkey) {
      helperState.isWaitingForSecondHotkey = false;
      console.log('🚫 Linux Helper dismissed');
      win.webContents.send("linux-helper-dismissed");
    }
  });
  
  await checkAndRequestMicrophonePermission();
  startServer();
  createWindow();
});
ipcMain.handle("get-info", async () => {
  return app.getPath("home");
});
ipcMain.handle("get-mic-status", async () => {
  const status = await checkAndRequestMicrophonePermission();
  return status;
});

// Open screenshots folder
ipcMain.handle("open-screenshots-folder", async () => {
  try {
    const screenshotDir = ensureScreenshotDirectoryWithSettings();
    await shell.openPath(screenshotDir);
    return { success: true };
  } catch (error) {
    console.error("Failed to open screenshots folder:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Linux Helper IPC handlers
ipcMain.handle("linux-helper-analyze-screenshot", async (_, screenshotDataUrl: string) => {
  try {
    // Import the Linux Helper module dynamically
    const { analyzeScreenshotWithLinuxHelper } = await import("../src/utils/linuxHelper.ts");
    const analysis = await analyzeScreenshotWithLinuxHelper(screenshotDataUrl, {
      linuxDistro: currentSettings.linuxDistro,
      showSystemContext: currentSettings.showSystemContext
    });
    return { success: true, analysis };
  } catch (error) {
    console.error("Linux Helper analysis failed:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("linux-helper-execute-command", async (_, command: string) => {
  try {
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);
    
    // Import safety checker
    const { isDangerousCommand } = await import("../src/utils/linuxHelper.ts");
    
    if (isDangerousCommand(command)) {
      return {
        success: false,
        error: "Command rejected for safety reasons",
        requiresConfirmation: true,
        command
      };
    }
    
    const result = await execAsync(command, { 
      timeout: 30000,  // 30 second timeout
      maxBuffer: 1024 * 1024 // 1MB max output
    });
    
    return {
      success: true,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      command
    };
  }
});

ipcMain.handle("linux-helper-get-system-context", async () => {
  try {
    const { getSystemContext } = await import("../src/utils/linuxHelper.ts");
    const context = getSystemContext();
    return { success: true, context };
  } catch (error) {
    console.error("Failed to get system context:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

// Handle manual Linux Helper trigger from UI button
ipcMain.on("manual-linux-helper-trigger", () => {
  console.log("📱 Manual Linux Helper trigger received");
  handleLinuxHelperHotkey();
});

// Settings management
interface AppSettings {
  screenshotLocation: string;
  hotkey: string;
  theme: 'dark' | 'light';
  autoSaveScreenshots: boolean;
  showSystemContext: boolean;
  linuxDistro: string;
}

const defaultSettings: AppSettings = {
  screenshotLocation: '~/Pictures/screenshots',
  hotkey: 'F10',
  theme: 'dark',
  autoSaveScreenshots: true,
  showSystemContext: true,
  linuxDistro: 'pop-os',
};

let currentSettings: AppSettings = { ...defaultSettings };

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings(): AppSettings {
  try {
    const settingsPath = getSettingsPath();
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      currentSettings = { ...defaultSettings, ...settings };
      console.log('⚙️ Settings loaded:', currentSettings);
    } else {
      console.log('⚙️ Using default settings');
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
    currentSettings = { ...defaultSettings };
  }
  return currentSettings;
}

function saveSettingsToFile(settings: AppSettings): void {
  try {
    const settingsPath = getSettingsPath();
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log('💾 Settings saved:', settings);
  } catch (error) {
    console.error('Failed to save settings:', error);
    throw error;
  }
}

function updateHotkey(newHotkey: string): boolean {
  try {
    // Unregister current hotkey
    globalShortcut.unregister(currentSettings.hotkey);
    
    // Register new hotkey
    const registered = globalShortcut.register(newHotkey, handleLinuxHelperHotkey);
    if (registered) {
      console.log(`🔄 Hotkey updated to: ${newHotkey}`);
      return true;
    } else {
      console.error(`❌ Failed to register new hotkey: ${newHotkey}`);
      // Re-register old hotkey
      globalShortcut.register(currentSettings.hotkey, handleLinuxHelperHotkey);
      return false;
    }
  } catch (error) {
    console.error('Error updating hotkey:', error);
    return false;
  }
}

function getScreenshotDirectory(): string {
  const location = currentSettings.screenshotLocation;
  if (location.startsWith('~/')) {
    return path.join(os.homedir(), location.slice(2));
  }
  return location;
}

// Update the ensureScreenshotDirectory function to use settings
function ensureScreenshotDirectoryWithSettings(): string {
  const screenshotDir = getScreenshotDirectory();
  
  try {
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true });
      console.log(`📁 Created screenshot directory: ${screenshotDir}`);
    }
    return screenshotDir;
  } catch (error) {
    console.error("Failed to create screenshot directory:", error);
    // Fallback to default directory
    return ensureScreenshotDirectory();
  }
}

// Settings IPC handlers
ipcMain.handle("get-settings", async () => {
  try {
    return { success: true, settings: currentSettings };
  } catch (error) {
    console.error("Failed to get settings:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("save-settings", async (_, newSettings: AppSettings) => {
  try {
    const oldHotkey = currentSettings.hotkey;
    
    // Update current settings
    currentSettings = { ...newSettings };
    
    // Save to file
    saveSettingsToFile(currentSettings);
    
    // Update hotkey if changed
    if (oldHotkey !== newSettings.hotkey) {
      const hotkeyUpdated = updateHotkey(newSettings.hotkey);
      if (!hotkeyUpdated) {
        return { 
          success: false, 
          error: `Failed to register hotkey: ${newSettings.hotkey}. Settings saved but hotkey not changed.`,
          partialSuccess: true
        };
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error("Failed to save settings:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("select-folder", async () => {
  try {
    const result = await dialog.showOpenDialog(win, {
      title: 'Select Screenshot Folder',
      defaultPath: getScreenshotDirectory(),
      properties: ['openDirectory', 'createDirectory']
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    
    return null;
  } catch (error) {
    console.error("Failed to select folder:", error);
    return null;
  }
});

ipcMain.handle("paste-at-cursor", async (_, command: string) => {
  try {
    const { clipboard } = await import('electron');
    
    // Save current clipboard content
    const previousClipboard = clipboard.readText();
    
    // Set command to clipboard
    clipboard.writeText(command);
    
    // Send notification that command is ready to paste
    win.webContents.send('command-ready-to-paste', command);
    
    console.log(`📋 Command copied to clipboard: ${command}`);
    console.log(`💡 User should now press Ctrl+V to paste where needed`);
    
    // Restore previous clipboard after 5 seconds
    setTimeout(() => {
      clipboard.writeText(previousClipboard);
    }, 5000);
    
    return { success: true };
  } catch (error) {
    console.error("Failed to copy command to clipboard:", error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
});

