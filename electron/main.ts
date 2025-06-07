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
  nativeImage,
} from "electron";
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

// Screenshot capture function
async function captureActiveMonitorScreenshot(): Promise<string | null> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    
    if (sources.length > 0) {
      // Get the primary display screenshot
      const screenshot = sources[0].thumbnail;
      return screenshot.toDataURL();
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
    
    const screenshot = await captureActiveMonitorScreenshot();
    if (screenshot) {
      helperState.lastScreenshot = screenshot;
      
      // Send screenshot to chat for analysis
      win.webContents.send("linux-helper-screenshot", {
        screenshot,
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
  
  // Register Linux Helper global shortcuts
  // Mouse button 5 alternative - using F10 for now (configurable later)
  const hotkeyRegistered = globalShortcut.register('F10', handleLinuxHelperHotkey);
  if (hotkeyRegistered) {
    console.log('🚀 Linux Helper hotkey (F10) registered successfully');
  } else {
    console.log('❌ Failed to register Linux Helper hotkey (F10)');
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

// Linux Helper IPC handlers
ipcMain.handle("linux-helper-analyze-screenshot", async (_, screenshotDataUrl: string) => {
  try {
    // Import the Linux Helper module dynamically
    const { analyzeScreenshotWithLinuxHelper } = await import("../src/utils/linuxHelper.ts");
    const analysis = await analyzeScreenshotWithLinuxHelper(screenshotDataUrl);
    return { success: true, analysis };
  } catch (error) {
    console.error("Linux Helper analysis failed:", error);
    return { success: false, error: error.message };
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
      error: error.message,
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
    return { success: false, error: error.message };
  }
});

// Handle manual Linux Helper trigger from UI button
ipcMain.on("manual-linux-helper-trigger", () => {
  console.log("📱 Manual Linux Helper trigger received");
  handleLinuxHelperHotkey();
});
