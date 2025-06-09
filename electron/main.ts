import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import net from 'net';
import { startServer } from '../src/backend/server';
import fixPath from 'fix-path';

let win: BrowserWindow;
let popupWindow: BrowserWindow | null = null;
let daemonSocket: net.Socket | null = null;
const DAEMON_SOCKET_PATH = '/tmp/linux-helper.sock';

// --- Socket Client to connect to the Daemon ---
function connectToDaemon() {
    if (daemonSocket && !daemonSocket.destroyed) {
        console.log('[Electron] Already connected or connecting to daemon.');
        return;
    }

    console.log('[Electron] Attempting to connect to daemon...');
    daemonSocket = new net.Socket();

    daemonSocket.connect(DAEMON_SOCKET_PATH, () => {
        console.log('[Electron] Successfully connected to helper daemon.');
    });

    daemonSocket.on('data', (data) => {
        try {
            const payload = JSON.parse(data.toString());
            if (payload.type === 'hotkey-event') {
                console.log('[Electron] Received hotkey event from daemon.');
                handleHotkeyEvent(payload.data);
            }
        } catch (error) {
            console.error('[Electron] Invalid data from daemon:', error);
        }
    });

    daemonSocket.on('close', () => {
        console.log('[Electron] Connection to daemon closed. Retrying in 5 seconds...');
        daemonSocket = null;
        setTimeout(connectToDaemon, 5000);
    });

    daemonSocket.on('error', (err) => {
        console.error(`[Electron] Daemon socket error: ${err.message}. Retrying...`);
        daemonSocket?.destroy();
        daemonSocket = null;
        // The 'close' event will handle the retry logic.
    });
}

function createPopupWindow(cursorPos: { x: number; y: number }): void {
    if (popupWindow && !popupWindow.isDestroyed()) {
        popupWindow.close();
    }
    
    popupWindow = new BrowserWindow({
        width: 400,
        height: 350,
        x: cursorPos.x + 15,
        y: cursorPos.y + 15,
        frame: false,
        transparent: true,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            contextIsolation: true,
        },
    });

    const rendererDist = process.env.RENDERER_DIST;
    if (process.env.VITE_DEV_SERVER_URL) {
        popupWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}/src/linux-helper-popup/popup.html`);
    } else if (rendererDist) {
        popupWindow.loadFile(path.join(rendererDist, 'src/linux-helper-popup/popup.html'));
    } else {
        throw new Error('RENDERER_DIST environment variable is not defined');
    }

    popupWindow.on('blur', () => popupWindow?.close());
    popupWindow.on('closed', () => popupWindow = null);
}

// --- Main Hotkey Event Handler ---
function handleHotkeyEvent(data: { screenshotDataUrl: string, cursorPosition: { x: number, y: number } }) {
    // 1. Show the popup window at the cursor position
    createPopupWindow(data.cursorPosition);

    // 2. Send the screenshot to the main chat window for analysis
    if (win) {
        win.webContents.send('analyze-screenshot', data.screenshotDataUrl);
    }
}

function createWindow() {
    win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            contextIsolation: true,
        },
    });

    const dist = process.env.DIST;
    if (process.env.VITE_DEV_SERVER_URL) {
        win.loadURL(process.env.VITE_DEV_SERVER_URL);
    } else if (dist) {
        win.loadFile(path.join(dist, 'index.html'));
    } else {
        throw new Error('DIST environment variable is not defined');
    }
}

// --- Settings Management (with daemon communication) ---
interface AppSettings {
    hotkey: string;
    // ... other settings
}

let currentSettings: AppSettings = {
    hotkey: 'ForwardButton',
    // ... default values
};

function updateHotkeyInDaemon(newHotkey: string) {
    if (daemonSocket && !daemonSocket.destroyed) {
        const message = {
            type: 'update-hotkey',
            hotkey: newHotkey,
        };
        daemonSocket.write(JSON.stringify(message));
        console.log(`[Electron] Sent hotkey update to daemon: ${newHotkey}`);
    } else {
        console.warn('[Electron] Cannot update hotkey, not connected to daemon.');
    }
}

ipcMain.handle("save-settings", async (_, newSettings: AppSettings) => {
    try {
        const oldHotkey = currentSettings.hotkey;
        currentSettings = { ...newSettings };
        
        // If the hotkey changed, notify the daemon
        if (oldHotkey !== newSettings.hotkey) {
            updateHotkeyInDaemon(newSettings.hotkey);
        }
        
        return { success: true };
    } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// --- App Ready ---
app.whenReady().then(() => {
    fixPath();
    startServer(); // Starts the backend API server
    createWindow();
    connectToDaemon(); // Connect to the running daemon
});
