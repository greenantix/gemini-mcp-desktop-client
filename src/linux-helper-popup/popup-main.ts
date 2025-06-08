#!/usr/bin/env node

import { app, BrowserWindow, screen, ipcMain, globalShortcut } from 'electron';
import * as path from 'path';
import * as net from 'net';
import * as fs from 'fs';
// Get current directory for CommonJS
const __dirname_current = path.dirname(require.main?.filename || '');

interface PopupConfig {
  // Window properties
  alwaysOnTop: true;
  frame: false;
  transparent: true;
  skipTaskbar: true;
  resizable: false;
  
  // Positioning
  followCursor: true;
  offset: { x: 10; y: 10 };
  screenEdgeDetection: true;
  
  // Animations
  fadeIn: 200; // 200ms
  fadeOut: 150; // 150ms
  slideDirection: 'auto'; // Based on screen position
}

interface PopupState {
  status: 'loading' | 'success' | 'error' | 'idle';
  title?: string;
  content?: string;
  progress?: number;
  suggestions?: Array<{
    title: string;
    command: string;
    description: string;
  }>;
  error?: string;
  isPinned?: boolean;
}

class LinuxHelperPopup {
  private window: BrowserWindow | null = null;
  private config: PopupConfig;
  private currentState: PopupState = { status: 'idle' };
  private isVisible = false;
  private server: net.Server | null = null;
  private cursorPosition = { x: 0, y: 0 };
  private socketPath = '/tmp/linux-helper-popup.sock';
  private cursorTrackingInterval: NodeJS.Timeout | null = null;

  constructor() {
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

  private setupApp(): void {
    app.whenReady().then(() => {
      this.createWindow();
      this.startServer();
      this.setupGlobalHotkeys();
      console.log('[Popup Process] Ready and listening');
    });

    app.on('window-all-closed', () => {
      this.cleanup();
    });

    app.on('before-quit', () => {
      this.cleanup();
    });
  }

  private createWindow(): void {
    this.window = new BrowserWindow({
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

  private setupIpcHandlers(): void {
    ipcMain.handle('get-current-state', () => {
      return this.currentState;
    });

    ipcMain.handle('execute-command', (_, command: string) => {
      console.log('[Popup Process] Executing command:', command);
      // This will be handled by sending back to daemon
      this.sendCommandToDaemon(command);
      if (!this.currentState.isPinned) {
        this.hideWithAnimation();
      }
    });

    ipcMain.handle('copy-command', (_, command: string) => {
      console.log('[Popup Process] Copying command:', command);
      // Copy to clipboard logic
      this.copyToClipboard(command);
    });

    ipcMain.handle('pin-popup', () => {
      this.currentState.isPinned = !this.currentState.isPinned;
      console.log('[Popup Process] Popup pinned:', this.currentState.isPinned);
      return this.currentState.isPinned;
    });

    ipcMain.handle('close-popup', () => {
      this.hideWithAnimation();
    });
  }

  private setupGlobalHotkeys(): void {
    // ESC to dismiss popup
    globalShortcut.register('Escape', () => {
      if (this.isVisible) {
        this.hideWithAnimation();
      }
    });
  }

  private startServer(): void {
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
        } catch (error) {
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

  private async handleDaemonMessage(message: any, socket: net.Socket): Promise<void> {
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

  private async showAtCursor(): Promise<void> {
    if (!this.window) return;

    // Get cursor position if not already set
    if (this.cursorPosition.x === 0 && this.cursorPosition.y === 0) {
      this.cursorPosition = screen.getCursorScreenPoint();
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

  private positionAtCursor(): void {
    if (!this.window) return;

    const display = screen.getDisplayNearestPoint(this.cursorPosition);
    const windowBounds = this.window.getBounds();
    
    console.log('[Popup] Positioning popup at cursor:', this.cursorPosition);
    console.log('[Popup] Display bounds:', display.bounds);
    console.log('[Popup] Window bounds:', windowBounds);
    
    let x = this.cursorPosition.x + this.config.offset.x;
    let y = this.cursorPosition.y + this.config.offset.y;
    let slideDirection: 'auto' | 'up' | 'down' | 'left' | 'right' = this.config.slideDirection;

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
        } else {
          // Cursor on left side - slide right  
          slideDirection = 'right';
        }
        
        // Also consider vertical positioning
        if (this.cursorPosition.y < centerY) {
          // Cursor on top half - prefer sliding down
          if (slideDirection === 'left' && this.cursorPosition.y < display.bounds.y + 100) {
            slideDirection = 'down';
          } else if (slideDirection === 'right' && this.cursorPosition.y < display.bounds.y + 100) {
            slideDirection = 'down';
          }
        }
      }
      
      // Apply slide direction positioning
      const actualDirection = slideDirection as string;
      if (actualDirection === 'left') {
        x = this.cursorPosition.x - windowBounds.width - this.config.offset.x;
      } else if (actualDirection === 'right') {
        x = this.cursorPosition.x + this.config.offset.x;
      } else if (actualDirection === 'up') {
        y = this.cursorPosition.y - windowBounds.height - this.config.offset.y;
      } else if (actualDirection === 'down') {
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

  private startCursorTracking(): void {
    if (!this.config.followCursor || this.cursorTrackingInterval) return;
    
    this.cursorTrackingInterval = setInterval(() => {
      if (this.isVisible && this.window) {
        // Get current cursor position
        const newPosition = screen.getCursorScreenPoint();
        
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

  private stopCursorTracking(): void {
    if (this.cursorTrackingInterval) {
      clearInterval(this.cursorTrackingInterval);
      this.cursorTrackingInterval = null;
    }
  }

  private async animateFadeIn(): Promise<void> {
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

  private async hideWithAnimation(): Promise<void> {
    if (!this.window || !this.isVisible) return;

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

  private updateUI(): void {
    console.log('[Popup] Updating UI with state:', this.currentState);
    if (this.window && this.window.webContents) {
      this.window.webContents.send('update-state', this.currentState);
    }
  }

  private sendCommandToDaemon(command: string): void {
    // This would send the command back to the daemon for execution
    console.log('[Popup Process] Would send command to daemon:', command);
  }

  private copyToClipboard(text: string): void {
    // Implement clipboard functionality
    const { clipboard } = require('electron');
    clipboard.writeText(text);
    console.log('[Popup Process] Copied to clipboard:', text);
  }

  private cleanup(): void {
    // Stop cursor tracking
    this.stopCursorTracking();
    
    if (this.server) {
      this.server.close();
    }
    
    if (fs.existsSync(this.socketPath)) {
      fs.unlinkSync(this.socketPath);
    }
    
    globalShortcut.unregisterAll();
    app.quit();
  }
}

// Start the popup application
new LinuxHelperPopup();

export {};