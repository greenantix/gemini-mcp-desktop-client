import { ipcRenderer, contextBridge } from 'electron'

interface LinuxHelperScreenshotData {
  screenshot: string;
  filename: string;
  filepath: string;
  size: number;
  action: "analyze";
}

interface LinuxHelperExecuteData {
  action: "execute";
}

interface AppSettings {
  screenshotLocation: string;
  hotkey: string;
  theme: 'dark' | 'light';
  autoSaveScreenshots: boolean;
  showSystemContext: boolean;
  linuxDistro: string;
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  removeListener(...args: Parameters<typeof ipcRenderer.removeListener>) {
    const [channel, listener] = args
    return ipcRenderer.removeListener(channel, listener)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})
contextBridge.exposeInMainWorld('api', {
  getInfo: () => ipcRenderer.invoke('get-info'),
  getMicStatus: () => ipcRenderer.invoke('get-mic-status'),
  
  // Linux Helper APIs
  onLinuxHelperScreenshot: (callback: (data: LinuxHelperScreenshotData) => void) => {
    ipcRenderer.on('linux-helper-screenshot', (_, data) => callback(data as LinuxHelperScreenshotData));
  },
  onLinuxHelperExecute: (callback: (data: LinuxHelperExecuteData) => void) => {
    ipcRenderer.on('linux-helper-execute', (_, data) => callback(data as LinuxHelperExecuteData));
  },
  onLinuxHelperDismissed: (callback: () => void) => {
    ipcRenderer.on('linux-helper-dismissed', () => callback());
  },
  removeLinuxHelperListeners: () => {
    ipcRenderer.removeAllListeners('linux-helper-screenshot');
    ipcRenderer.removeAllListeners('linux-helper-execute');
    ipcRenderer.removeAllListeners('linux-helper-dismissed');
  },
  
  // Linux Helper IPC methods
  analyzeScreenshot: (screenshotDataUrl: string) => 
    ipcRenderer.invoke('linux-helper-analyze-screenshot', screenshotDataUrl),
  executeCommand: (command: string) => 
    ipcRenderer.invoke('linux-helper-execute-command', command),
  getSystemContext: () => 
    ipcRenderer.invoke('linux-helper-get-system-context'),
  openScreenshotsFolder: () => 
    ipcRenderer.invoke('open-screenshots-folder'),
  
  // Settings APIs
  getSettings: () =>
    ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: AppSettings) =>
    ipcRenderer.invoke('save-settings', settings),
  selectFolder: () =>
    ipcRenderer.invoke('select-folder'),
  
  // Command pasting API
  pasteAtCursor: (command: string) => 
    ipcRenderer.invoke('paste-at-cursor', command)
});