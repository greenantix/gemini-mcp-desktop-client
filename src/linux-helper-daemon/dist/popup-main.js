#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const net = __importStar(require("net"));
const fs = __importStar(require("fs"));
// Get current directory for CommonJS
const __dirname_current = path.dirname(require.main?.filename || '');
class LinuxHelperPopup {
    constructor() {
        this.window = null;
        this.currentState = { status: 'idle' };
        this.isVisible = false;
        this.server = null;
        this.cursorPosition = { x: 0, y: 0 };
        this.socketPath = '/tmp/linux-helper-popup.sock';
        this.cursorTrackingInterval = null;
        this.config = {
            alwaysOnTop: true,
            frame: false,
            transparent: true,
            skipTaskbar: true,
            resizable: false,
            followCursor: true,
            offset: { x: 10, y: 10 },
            screenEdgeDetection: true,
            fadeIn: 200,
            fadeOut: 150,
            slideDirection: 'auto'
        };
        this.setupApp();
    }
    setupApp() {
        electron_1.app.whenReady().then(() => {
            this.createWindow();
            this.startServer();
            this.setupGlobalHotkeys();
            console.log('[Popup Process] Ready and listening');
        });
        electron_1.app.on('window-all-closed', () => {
            this.cleanup();
        });
        electron_1.app.on('before-quit', () => {
            this.cleanup();
        });
    }
    createWindow() {
        this.window = new electron_1.BrowserWindow({
            width: 400,
            height: 300,
            show: false, // Start hidden
            frame: false,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            transparent: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
            }
        });
        // Load the popup HTML
        const htmlPath = path.join(__dirname_current, 'popup.html');
        this.window.loadFile(htmlPath);
        // Handle window events
        this.window.on('closed', () => {
            this.window = null;
            this.isVisible = false;
        });
        // Hide on blur unless pinned
        this.window.on('blur', () => {
            if (!this.currentState.isPinned && this.isVisible) {
                this.hideWithAnimation();
            }
        });
        this.setupIpcHandlers();
    }
    setupIpcHandlers() {
        electron_1.ipcMain.handle('get-current-state', () => {
            return this.currentState;
        });
        electron_1.ipcMain.handle('execute-command', (_, command) => {
            console.log('[Popup Process] Executing command:', command);
            // This will be handled by sending back to daemon
            this.sendCommandToDaemon(command);
            if (!this.currentState.isPinned) {
                this.hideWithAnimation();
            }
        });
        electron_1.ipcMain.handle('copy-command', (_, command) => {
            console.log('[Popup Process] Copying command:', command);
            // Copy to clipboard logic
            this.copyToClipboard(command);
        });
        electron_1.ipcMain.handle('pin-popup', () => {
            this.currentState.isPinned = !this.currentState.isPinned;
            console.log('[Popup Process] Popup pinned:', this.currentState.isPinned);
            return this.currentState.isPinned;
        });
        electron_1.ipcMain.handle('close-popup', () => {
            this.hideWithAnimation();
        });
    }
    setupGlobalHotkeys() {
        // ESC to dismiss popup
        electron_1.globalShortcut.register('Escape', () => {
            if (this.isVisible) {
                this.hideWithAnimation();
            }
        });
    }
    startServer() {
        // Remove existing socket
        if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
        }
        this.server = net.createServer((socket) => {
            console.log('[Popup Process] Daemon connected');
            socket.on('data', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    this.handleDaemonMessage(message, socket);
                }
                catch (error) {
                    console.error('[Popup Process] Invalid message:', error);
                    socket.write(JSON.stringify({ success: false, error: 'Invalid JSON' }));
                }
            });
            socket.on('close', () => {
                console.log('[Popup Process] Daemon disconnected');
            });
        });
        this.server.listen(this.socketPath, () => {
            console.log('[Popup Process] Server listening on', this.socketPath);
        });
    }
    async handleDaemonMessage(message, socket) {
        console.log('[Popup Process] Received:', message.type);
        switch (message.type) {
            case 'show':
                this.currentState = {
                    status: 'loading',
                    title: 'Linux Helper',
                    ...message.data
                };
                await this.showAtCursor();
                socket.write(JSON.stringify({ success: true, visible: true }));
                break;
            case 'update':
                this.currentState = { ...this.currentState, ...message.data };
                this.updateUI();
                socket.write(JSON.stringify({ success: true, state: this.currentState }));
                break;
            case 'hide':
                await this.hideWithAnimation();
                socket.write(JSON.stringify({ success: true, visible: false }));
                break;
            case 'position':
                if (message.data && message.data.x !== undefined && message.data.y !== undefined) {
                    this.cursorPosition = { x: message.data.x, y: message.data.y };
                    if (this.isVisible && this.config.followCursor) {
                        this.positionAtCursor();
                    }
                }
                socket.write(JSON.stringify({ success: true }));
                break;
            default:
                socket.write(JSON.stringify({ success: false, error: 'Unknown message type' }));
        }
    }
    async showAtCursor() {
        if (!this.window)
            return;
        // Get cursor position if not already set
        if (this.cursorPosition.x === 0 && this.cursorPosition.y === 0) {
            this.cursorPosition = electron_1.screen.getCursorScreenPoint();
        }
        this.positionAtCursor();
        // Show with fade-in animation
        this.window.setOpacity(0);
        this.window.show();
        this.isVisible = true;
        // Don't start cursor tracking - popup should stay at initial position for interaction
        // this.startCursorTracking();
        // Animate fade-in
        await this.animateFadeIn();
        // Update UI with current state
        this.updateUI();
    }
    positionAtCursor() {
        if (!this.window)
            return;
        const display = electron_1.screen.getDisplayNearestPoint(this.cursorPosition);
        const windowBounds = this.window.getBounds();
        console.log('[Popup] Positioning popup at cursor:', this.cursorPosition);
        console.log('[Popup] Display bounds:', display.bounds);
        console.log('[Popup] Window bounds:', windowBounds);
        let x = this.cursorPosition.x + this.config.offset.x;
        let y = this.cursorPosition.y + this.config.offset.y;
        let slideDirection = this.config.slideDirection;
        // Screen edge detection with slideDirection auto calculation
        if (this.config.screenEdgeDetection) {
            const rightEdge = display.bounds.x + display.bounds.width;
            const bottomEdge = display.bounds.y + display.bounds.height;
            // Auto-determine slide direction based on cursor position
            if (slideDirection === 'auto') {
                const centerX = display.bounds.x + display.bounds.width / 2;
                const centerY = display.bounds.y + display.bounds.height / 2;
                if (this.cursorPosition.x > centerX) {
                    // Cursor on right side - slide left
                    slideDirection = 'left';
                }
                else {
                    // Cursor on left side - slide right  
                    slideDirection = 'right';
                }
                // Also consider vertical positioning
                if (this.cursorPosition.y < centerY) {
                    // Cursor on top half - prefer sliding down
                    if (slideDirection === 'left' && this.cursorPosition.y < display.bounds.y + 100) {
                        slideDirection = 'down';
                    }
                    else if (slideDirection === 'right' && this.cursorPosition.y < display.bounds.y + 100) {
                        slideDirection = 'down';
                    }
                }
            }
            // Apply slide direction positioning
            const actualDirection = slideDirection;
            if (actualDirection === 'left') {
                x = this.cursorPosition.x - windowBounds.width - this.config.offset.x;
            }
            else if (actualDirection === 'right') {
                x = this.cursorPosition.x + this.config.offset.x;
            }
            else if (actualDirection === 'up') {
                y = this.cursorPosition.y - windowBounds.height - this.config.offset.y;
            }
            else if (actualDirection === 'down') {
                y = this.cursorPosition.y + this.config.offset.y;
            }
            // Ensure popup stays within screen bounds
            if (x + windowBounds.width > rightEdge) {
                x = rightEdge - windowBounds.width - 10;
            }
            if (x < display.bounds.x) {
                x = display.bounds.x + 10;
            }
            if (y + windowBounds.height > bottomEdge) {
                y = bottomEdge - windowBounds.height - 10;
            }
            if (y < display.bounds.y) {
                y = display.bounds.y + 10;
            }
        }
        console.log('[Popup] Final position:', { x: Math.floor(x), y: Math.floor(y) });
        this.window.setPosition(Math.floor(x), Math.floor(y));
    }
    startCursorTracking() {
        if (!this.config.followCursor || this.cursorTrackingInterval)
            return;
        this.cursorTrackingInterval = setInterval(() => {
            if (this.isVisible && this.window) {
                // Get current cursor position
                const newPosition = electron_1.screen.getCursorScreenPoint();
                // Only update if cursor moved significantly (reduce flickering)
                const threshold = 5;
                if (Math.abs(newPosition.x - this.cursorPosition.x) > threshold ||
                    Math.abs(newPosition.y - this.cursorPosition.y) > threshold) {
                    this.cursorPosition = newPosition;
                    this.positionAtCursor();
                }
            }
        }, 100); // Update every 100ms for smooth following
    }
    stopCursorTracking() {
        if (this.cursorTrackingInterval) {
            clearInterval(this.cursorTrackingInterval);
            this.cursorTrackingInterval = null;
        }
    }
    async animateFadeIn() {
        return new Promise((resolve) => {
            if (!this.window) {
                resolve();
                return;
            }
            const steps = 10;
            const stepTime = this.config.fadeIn / steps;
            let currentStep = 0;
            const fadeInterval = setInterval(() => {
                currentStep++;
                const opacity = currentStep / steps;
                if (this.window) {
                    this.window.setOpacity(opacity);
                }
                if (currentStep >= steps) {
                    clearInterval(fadeInterval);
                    resolve();
                }
            }, stepTime);
        });
    }
    async hideWithAnimation() {
        if (!this.window || !this.isVisible)
            return;
        // Stop cursor tracking when hiding
        this.stopCursorTracking();
        return new Promise((resolve) => {
            if (!this.window) {
                resolve();
                return;
            }
            const steps = 8;
            const stepTime = this.config.fadeOut / steps;
            let currentStep = steps;
            const fadeInterval = setInterval(() => {
                currentStep--;
                const opacity = currentStep / steps;
                if (this.window) {
                    this.window.setOpacity(opacity);
                }
                if (currentStep <= 0) {
                    clearInterval(fadeInterval);
                    if (this.window) {
                        this.window.hide();
                    }
                    this.isVisible = false;
                    resolve();
                }
            }, stepTime);
        });
    }
    updateUI() {
        console.log('[Popup] Updating UI with state:', this.currentState);
        if (this.window && this.window.webContents) {
            this.window.webContents.send('update-state', this.currentState);
        }
    }
    sendCommandToDaemon(command) {
        // This would send the command back to the daemon for execution
        console.log('[Popup Process] Would send command to daemon:', command);
    }
    copyToClipboard(text) {
        // Implement clipboard functionality
        const { clipboard } = require('electron');
        clipboard.writeText(text);
        console.log('[Popup Process] Copied to clipboard:', text);
    }
    cleanup() {
        // Stop cursor tracking
        this.stopCursorTracking();
        if (this.server) {
            this.server.close();
        }
        if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
        }
        electron_1.globalShortcut.unregisterAll();
        electron_1.app.quit();
    }
}
// Start the popup application
new LinuxHelperPopup();
