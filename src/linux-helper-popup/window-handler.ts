import { BrowserWindow, screen, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class LinuxHelperPopup {
  private window: BrowserWindow | null = null;
  private isDevMode = process.env.NODE_ENV === 'development';

  constructor() {
    this.setupIpcHandlers();
  }

  private setupIpcHandlers() {
    ipcMain.handle('popup-copy-command', async (_, command: string) => {
      const { clipboard } = await import('electron');
      clipboard.writeText(command);
      return { success: true };
    });

    ipcMain.handle('popup-execute-command', async (_, command: string) => {
      console.log('Execute command:', command);
      // TODO: Implement actual terminal execution
      return { success: true };
    });

    ipcMain.handle('popup-close', () => {
      this.hide();
      return { success: true };
    });
  }

  show(position?: { x: number; y: number }) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.focus();
      return;
    }

    const cursorPoint = position || screen.getCursorScreenPoint();
    const display = screen.getDisplayNearestPoint(cursorPoint);

    // Create window
    this.window = new BrowserWindow({
      width: 420,
      height: 500,
      x: cursorPoint.x + 10,
      y: cursorPoint.y + 10,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: true,
      backgroundColor: '#00000000', // Fully transparent
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, '../../electron/preload.mjs')
      }
    });

    // Ensure window stays within screen bounds
    this.adjustWindowPosition(display);

    // Load the popup
    if (this.isDevMode) {
      // In development, load from Vite dev server
      this.window.loadURL('http://localhost:5173/src/linux-helper-popup/popup.html');
    } else {
      // In production, load from built files
      this.window.loadFile(path.join(__dirname, '../../dist/linux-helper-popup/popup.html'));
    }

    // Window events
    this.window.on('closed', () => {
      this.window = null;
    });

    // Auto-hide on blur unless pinned
    this.window.on('blur', () => {
      if (!this.window?.webContents.isDevToolsOpened()) {
        setTimeout(() => {
          if (this.window && !this.window.isDestroyed()) {
            this.window.webContents.send('check-pin-status');
          }
        }, 100);
      }
    });

    // Show dev tools in development
    if (this.isDevMode) {
      this.window.webContents.openDevTools({ mode: 'detach' });
    }
  }

  private adjustWindowPosition(display: Electron.Display) {
    if (!this.window) return;

    const { x, y, width, height } = display.bounds;
    const windowBounds = this.window.getBounds();

    let newX = windowBounds.x;
    let newY = windowBounds.y;

    // Adjust horizontal position
    if (windowBounds.x + windowBounds.width > x + width) {
      newX = x + width - windowBounds.width - 20;
    }
    if (windowBounds.x < x) {
      newX = x + 20;
    }

    // Adjust vertical position
    if (windowBounds.y + windowBounds.height > y + height) {
      newY = y + height - windowBounds.height - 20;
    }
    if (windowBounds.y < y) {
      newY = y + 20;
    }

    this.window.setPosition(newX, newY);
  }

  hide() {
    if (this.window && !this.window.isDestroyed()) {
      this.window.close();
    }
  }

  updateState(state: any) {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('state-update', state);
    }
  }

  isVisible(): boolean {
    return this.window !== null && !this.window.isDestroyed();
  }
}

// Singleton instance
export const popupWindow = new LinuxHelperPopup();
