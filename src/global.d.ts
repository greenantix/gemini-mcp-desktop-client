// global.d.ts
interface Window {
  electron?: {
    ipcRenderer: {
      invoke(channel: string, ...args: any[]): Promise<any>;
      on(channel: string, listener: (event: any, ...args: any[]) => void): void;
      removeListener(channel: string, listener: (event: any, ...args: any[]) => void): void;
    };
  };
}

// For custom events
interface WindowEventMap {
  'popup-state-update': CustomEvent<any>;
}
// Types based on preload.ts and component usage
// Note: `IpcRenderer` type is expected to be available globally
// via `vite-plugin-electron/electron-env` reference in `electron/electron-env.d.ts`.
interface LinuxHelperScreenshotDataFromPreload {
  screenshot: string;
  filename: string;
  filepath: string;
  size: number;
  action: "analyze";
}

interface LinuxHelperExecuteDataFromPreload {
  action: "execute";
}

interface AppSettingsFromPreload {
  screenshotLocation: string;
  hotkey: string;
  theme: 'dark' | 'light';
  autoSaveScreenshots: boolean;
  showSystemContext: boolean;
  linuxDistro: string;
}

interface AnalysisResult {
  success: boolean;
  analysis?: string;
  error?: string;
}

interface CommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
  requiresConfirmation?: boolean;
  command?: string;
}

interface SystemContextResult {
  success: boolean;
  context?: Record<string, unknown>; // Changed from any
  error?: string;
}

interface FolderResponse {
  success: boolean;
  error?: string;
}

interface SettingsResponse {
  success: boolean;
  settings?: AppSettingsFromPreload;
  error?: string;
}

interface SaveSettingsResponse extends SettingsResponse {
  partialSuccess?: boolean;
}

interface WindowApi {
  getInfo: () => Promise<string>;
  getMicStatus: () => Promise<boolean>;
  onLinuxHelperScreenshot: (callback: (data: LinuxHelperScreenshotDataFromPreload) => void) => void;
  onLinuxHelperExecute: (callback: (data: LinuxHelperExecuteDataFromPreload) => void) => void;
  onLinuxHelperDismissed: (callback: () => void) => void;
  removeLinuxHelperListeners: () => void;
  analyzeScreenshot: (screenshotDataUrl: string) => Promise<AnalysisResult>;
  executeCommand: (command: string) => Promise<CommandResult>;
  getSystemContext: () => Promise<SystemContextResult>;
  openScreenshotsFolder: () => Promise<FolderResponse>;
  getSettings: () => Promise<SettingsResponse>;
  saveSettings: (settings: AppSettingsFromPreload) => Promise<SaveSettingsResponse>;
  selectFolder: () => Promise<string | null>;
  pasteAtCursor: (command: string) => Promise<{ success: boolean; error?: string }>;
}

// All interfaces like LinuxHelperScreenshotDataFromPreload, WindowApi, etc., are defined above this block.

declare global {
  // Ensure Electron's IpcRenderer is available globally if this file doesn't import it.
  // This typically comes from a reference like /// <reference types="vite-plugin-electron/electron-env" />
  // in another .d.ts file (e.g., electron/electron-env.d.ts).
  // If 'IpcRenderer' is not found after this change, it means it's not globally available as expected.
  // For now, assuming it is, to simplify this file.
  interface Window {
    api: WindowApi;
    ipcRenderer: Electron.IpcRenderer; // Assuming Electron.IpcRenderer is globally available
  }
}

// Removed export {}; to ensure this is treated as an ambient declaration file