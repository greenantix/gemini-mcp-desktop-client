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
} from "electron";
import * as fs from "fs";
import * as os from "os";
import * as net from "net";
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
let popupWin: BrowserWindow | null = null;
let daemonSocketServer: net.Server | null = null;
let connectedDaemonSockets: Set<net.Socket> = new Set();

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

interface HotkeyPressPayload {
  screenshotDataUrl: string;
  cursorPosition: { x: number; y: number };
}

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

// Create popup window at cursor position
function createPopupWindow(cursorPosition: { x: number; y: number }): BrowserWindow {
  // Close existing popup if it exists
  if (popupWin && !popupWin.isDestroyed()) {
    popupWin.close();
  }

  popupWin = new BrowserWindow({
    width: 400,
    height: 300,
    x: cursorPosition.x + 10,
    y: cursorPosition.y + 10,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.mjs"),
    },
  });

  // Load popup HTML
  const popupPath = path.join(__dirname, "..", "src", "linux-helper-popup", "popup.html");
  popupWin.loadFile(popupPath);

  // Auto-close popup after 30 seconds
  setTimeout(() => {
    if (popupWin && !popupWin.isDestroyed()) {
      popupWin.close();
      popupWin = null;
    }
  }, 30000);

  return popupWin;
}

// Linux Helper hotkey handler (called from daemon via socket)
function handleLinuxHelperHotkey(payload: HotkeyPressPayload) {
  console.log("🔥 Linux Helper activated via daemon");
  
  // Action A: Create popup at cursor position
  const popup = createPopupWindow(payload.cursorPosition);
  
  // Send screenshot to popup for quick actions
  popup.webContents.once('did-finish-load', () => {
    popup.webContents.send('display-screenshot', payload.screenshotDataUrl);
  });
  
  // Action B: Send to main chat window for analysis
  win.webContents.send('analyze-screenshot', payload.screenshotDataUrl);
  
  console.log(`📍 Popup created at position: ${payload.cursorPosition.x}, ${payload.cursorPosition.y}`);
}

async function checkAndRequestMicrophonePermission(): Promise<boolean> {
  if (process.platform !== "darwin") {
    return true;
  }

  const accessStatus = systemPreferences.getMediaAccessStatus("microphone");
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

// Setup socket server for daemon communication
function setupDaemonSocketServer(): void {
  const socketPath = '/tmp/linux-helper.sock';
  
  // Remove existing socket file if it exists
  if (fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath);
  }
  
  daemonSocketServer = net.createServer((socket) => {
    console.log('🔌 Daemon connected via socket');
    
    // Add socket to our tracking set
    connectedDaemonSockets.add(socket);
    
    socket.on('data', (data) => {
      try {
        const messages = data.toString().split('\n').filter(msg => msg.trim());
        
        for (const message of messages) {
          const { event, data: eventData } = JSON.parse(message);
          
          if (event === 'hotkey-pressed') {
            handleLinuxHelperHotkey(eventData as HotkeyPressPayload);
          }
        }
      } catch (error) {
        console.error('Error parsing daemon message:', error);
      }
    });
    
    socket.on('error', (error) => {
      console.error('Daemon socket error:', error);
      // Remove from tracking set on error
      connectedDaemonSockets.delete(socket);
    });
    
    socket.on('close', () => {
      console.log('🔌 Daemon disconnected');
      // Remove from tracking set when disconnected
      connectedDaemonSockets.delete(socket);
    });
  });
  
  daemonSocketServer.listen(socketPath, () => {
    console.log(`🚀 Daemon socket server listening at ${socketPath}`);
  });
  
  daemonSocketServer.on('error', (error) => {
    console.error('Socket server error:', error);
  });
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    // Clean up socket connections and server
    cleanupSocketConnections();
    app.quit();
    // win = null;
  }
});

app.on("will-quit", () => {
  // Clean up socket connections and server
  cleanupSocketConnections();
});

function cleanupSocketConnections(): void {
  // Close all daemon socket connections
  connectedDaemonSockets.forEach((socket) => {
    if (!socket.destroyed) {
      socket.end();
    }
  });
  connectedDaemonSockets.clear();
  
  // Close socket server
  if (daemonSocketServer) {
    daemonSocketServer.close();
    daemonSocketServer = null;
  }
  
  // Remove socket file
  const socketPath = '/tmp/linux-helper.sock';
  if (fs.existsSync(socketPath)) {
    fs.unlinkSync(socketPath);
  }
}

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
  
  // Load settings
  loadSettings();
  
  // Setup daemon socket server
  setupDaemonSocketServer();
  
  console.log(`🚀 Linux Helper hotkey (${currentSettings.hotkey}) handled by daemon`);
  
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
ipcMain.on("manual-linux-helper-trigger", async () => {
  console.log("📱 Manual Linux Helper trigger received");
  
  // Simulate daemon hotkey press
  const screenshotData = await captureActiveMonitorScreenshot();
  if (screenshotData) {
    const payload: HotkeyPressPayload = {
      screenshotDataUrl: screenshotData.dataUrl,
      cursorPosition: { x: 100, y: 100 } // Default position for manual trigger
    };
    handleLinuxHelperHotkey(payload);
  }
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
  hotkey: 'ForwardButton',
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
    console.log(`🔄 Hotkey updated to: ${newHotkey} (handled by daemon)`);
    
    // Send hotkey update to all connected daemon instances
    if (connectedDaemonSockets.size > 0) {
      const updateMessage = JSON.stringify({
        event: 'update-hotkey',
        data: { hotkey: newHotkey }
      }) + '\n';
      
      let sentCount = 0;
      connectedDaemonSockets.forEach((socket) => {
        if (socket.writable && !socket.destroyed) {
          socket.write(updateMessage);
          sentCount++;
        } else {
          // Clean up dead sockets
          connectedDaemonSockets.delete(socket);
        }
      });
      
      if (sentCount > 0) {
        console.log(`🔄 Sent hotkey update to ${sentCount} daemon instance(s): ${newHotkey}`);
      } else {
        console.warn('⚠️ No active daemon connections to receive hotkey update');
      }
    } else {
      console.warn('⚠️ No daemon connected to receive hotkey update');
    }
    
    return true;
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

