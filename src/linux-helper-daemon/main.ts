#!/usr/bin/env node

import { ScreenshotManager } from './screenshot';
import { Logger } from './logger';
import { CursorTracker } from './cursor-tracker';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as net from 'net';
import { spawn } from 'child_process';

interface DaemonConfig {
  socketPath: string;
  logLevel: 'debug' | 'info' | 'error';
  hotkey: string;
  autoStart: boolean;
}

interface HotkeyPressPayload {
  screenshotDataUrl: string;
  cursorPosition: { x: number; y: number };
}

class LinuxHelperDaemon {
  private config: DaemonConfig;
  private screenshotManager: ScreenshotManager;
  private cursorTracker: CursorTracker;
  private logger: Logger;
  private isRunning = false;
  private socketClient?: net.Socket;
  private hotkeyProcess?: any;

  constructor() {
    this.config = this.loadConfig();
    this.logger = new Logger(this.config.logLevel);
    
    this.screenshotManager = new ScreenshotManager(this.logger);
    this.cursorTracker = new CursorTracker(this.logger);
    
    this.setupEventHandlers();
  }

  private loadConfig(): DaemonConfig {
    const configPath = path.join(os.homedir(), '.config', 'linux-helper', 'daemon.json');
    
    const defaultConfig: DaemonConfig = {
      socketPath: '/tmp/linux-helper.sock',
      logLevel: 'info',
      hotkey: 'ForwardButton',
      autoStart: true
    };

    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        return { ...defaultConfig, ...JSON.parse(configData) };
      }
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error);
    }

    return defaultConfig;
  }

  private setupEventHandlers(): void {
    // Create the hotkey handler function
    const hotkeyHandler = async () => {
      this.logger.info('Hotkey pressed, capturing screenshot and cursor position');
      
      try {
        // Get cursor position
        const cursorPosition = await this.cursorTracker.getCurrentPosition();
        this.logger.debug(`Cursor position: ${cursorPosition.x}, ${cursorPosition.y}`);
        
        // Capture screenshot
        const screenshot = await this.screenshotManager.captureActiveMonitor();
        if (screenshot) {
          const payload: HotkeyPressPayload = {
            screenshotDataUrl: screenshot.dataUrl,
            cursorPosition
          };
          
          // Send to main Electron process via socket
          this.sendToMainProcess('hotkey-pressed', payload);
        }
      } catch (error) {
        this.logger.error('Failed to handle hotkey press:', error);
      }
    };

    // Set up mouse button monitoring if hotkey is a mouse button
    this.setupMouseButtonMonitoring(hotkeyHandler);

    // Handle graceful shutdown
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
  }

  private setupMouseButtonMonitoring(hotkeyHandler: () => Promise<void>): void {
    const buttonMapping = this.getButtonMapping(this.config.hotkey);
    
    if (buttonMapping.type === 'mouse' && buttonMapping.button !== undefined) {
      this.startMouseMonitoring(buttonMapping.button, hotkeyHandler);
    } else {
      this.logger.warn(`Hotkey ${this.config.hotkey} is not a supported mouse button`);
    }
  }

  private getButtonMapping(hotkey: string): { type: 'mouse' | 'keyboard'; button?: number; key?: string } {
    const mouseButtons: { [key: string]: number } = {
      'MiddleClick': 2,
      'Button1': 1,
      'Button2': 2,
      'Button3': 3,
      'Button4': 4,
      'Button5': 5,
      'Button8': 8,
      'Button9': 9,
      'LeftClick': 1,
      'RightClick': 3,
      'ForwardButton': 9,
      'BackButton': 8
    };

    if (mouseButtons[hotkey]) {
      return { type: 'mouse', button: mouseButtons[hotkey] };
    } else {
      return { type: 'keyboard', key: hotkey };
    }
  }

  private startMouseMonitoring(button: number, callback: () => Promise<void>): void {
    this.logger.info(`Starting mouse button monitoring for button ${button}`);
    
    // Check if xinput is available
    try {
      // Use xinput to monitor mouse events
      this.hotkeyProcess = spawn('xinput', ['test-xi2', '--root'], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let lastEventTime = 0;
      const debounceMs = 500; // Prevent double-clicks

      this.hotkeyProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        const lines = output.split('\n');
        
        for (const line of lines) {
          if (line.includes('ButtonPress') && line.includes(`detail: ${button}`)) {
            const now = Date.now();
            if (now - lastEventTime > debounceMs) {
              lastEventTime = now;
              this.logger.debug(`Mouse button ${button} pressed`);
              callback().catch(error => {
                this.logger.error('Error in hotkey callback:', error);
              });
            }
          }
        }
      });

      this.hotkeyProcess.stderr?.on('data', (data: Buffer) => {
        const errorOutput = data.toString();
        this.logger.error('Mouse monitoring error:', errorOutput);
        // If xinput fails, try to restart it
        if (errorOutput.includes('BadAccess') || errorOutput.includes('Cannot')) {
          this.logger.warn('xinput access denied, retrying in 5 seconds...');
          setTimeout(() => {
            if (this.isRunning) {
              this.startMouseMonitoring(button, callback);
            }
          }, 5000);
        }
      });

      this.hotkeyProcess.on('exit', (code: number | null) => {
        this.logger.warn(`Mouse monitoring process exited with code ${code}`);
        // Restart monitoring if the daemon is still running and it wasn't a clean exit
        if (this.isRunning && code !== 0) {
          this.logger.info('Restarting mouse monitoring in 3 seconds...');
          setTimeout(() => {
            if (this.isRunning) {
              this.startMouseMonitoring(button, callback);
            }
          }, 3000);
        }
      });

      this.hotkeyProcess.on('error', (error) => {
        this.logger.error('Failed to start xinput process:', error);
      });
      
    } catch (error) {
      this.logger.error('Error starting mouse monitoring:', error);
    }
  }

  private connectToMainProcess(): void {
    this.socketClient = net.createConnection({ path: this.config.socketPath }, () => {
      this.logger.info('Connected to main Electron process');
    });

    this.socketClient.on('data', (data) => {
      try {
        const messages = data.toString().split('\n').filter(msg => msg.trim());
        
        for (const message of messages) {
          const { event, data: eventData } = JSON.parse(message);
          
          if (event === 'update-hotkey') {
            this.updateHotkey(eventData.hotkey);
          }
        }
      } catch (error) {
        this.logger.error('Error parsing main process message:', error);
      }
    });

    this.socketClient.on('error', (error) => {
      this.logger.warn('Socket connection error:', error.message);
      // Retry connection after 5 seconds
      setTimeout(() => this.connectToMainProcess(), 5000);
    });

    this.socketClient.on('close', () => {
      this.logger.warn('Socket connection closed, retrying...');
      setTimeout(() => this.connectToMainProcess(), 5000);
    });
  }

  private sendToMainProcess(event: string, data: any): void {
    if (this.socketClient && this.socketClient.writable) {
      const message = JSON.stringify({ event, data });
      this.socketClient.write(message + '\n');
      this.logger.debug(`Sent to main process: ${event}`);
    } else {
      this.logger.warn('Socket not connected, attempting to reconnect...');
      this.connectToMainProcess();
    }
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      this.logger.warn('Daemon already running');
      return;
    }

    // Check if another daemon instance is already running
    const lockFile = '/tmp/linux-helper-daemon.lock';
    if (fs.existsSync(lockFile)) {
      try {
        const pid = fs.readFileSync(lockFile, 'utf8').trim();
        // Check if process is actually running
        process.kill(parseInt(pid), 0);
        this.logger.error('Another daemon instance is already running');
        return;
      } catch (error) {
        // Process not running, remove stale lock file
        fs.unlinkSync(lockFile);
      }
    }

    try {
      this.logger.info('Starting Linux Helper Daemon...');
      
      // Create lock file
      fs.writeFileSync(lockFile, process.pid.toString());
      
      // Connect to main Electron process
      this.connectToMainProcess();
      
      this.isRunning = true;
      this.logger.info(`Linux Helper Daemon started successfully`);
      this.logger.info(`- Hotkey: ${this.config.hotkey}`);
      this.logger.info(`- Socket: ${this.config.socketPath}`);
      this.logger.info(`- PID: ${process.pid}`);
      
    } catch (error) {
      this.logger.error('Failed to start daemon:', error);
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.logger.info('Shutting down Linux Helper Daemon...');
    
    try {
      // Stop hotkey monitoring
      if (this.hotkeyProcess) {
        this.hotkeyProcess.kill('SIGTERM');
        this.hotkeyProcess = undefined;
      }
      
      // Close socket connection
      if (this.socketClient) {
        this.socketClient.end();
        this.socketClient = undefined;
      }
      
      // Remove lock file
      const lockFile = '/tmp/linux-helper-daemon.lock';
      if (fs.existsSync(lockFile)) {
        fs.unlinkSync(lockFile);
      }
      
      this.isRunning = false;
      this.logger.info('Daemon shutdown complete');
      process.exit(0);
    } catch (error) {
      this.logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  getStatus(): object {
    return {
      running: this.isRunning,
      config: this.config,
      hotkey: this.config.hotkey,
      uptime: process.uptime()
    };
  }

  updateHotkey(newHotkey: string): void {
    this.logger.info(`Updating hotkey from ${this.config.hotkey} to ${newHotkey}`);
    
    // Stop current monitoring
    if (this.hotkeyProcess) {
      this.hotkeyProcess.kill('SIGTERM');
      this.hotkeyProcess = undefined;
    }
    
    // Update config
    this.config.hotkey = newHotkey;
    
    // Restart monitoring with new hotkey
    this.setupMouseButtonMonitoring(async () => {
      this.logger.info('Hotkey pressed, capturing screenshot and cursor position');
      
      try {
        const cursorPosition = await this.cursorTracker.getCurrentPosition();
        const screenshot = await this.screenshotManager.captureActiveMonitor();
        
        if (screenshot) {
          const payload: HotkeyPressPayload = {
            screenshotDataUrl: screenshot.dataUrl,
            cursorPosition
          };
          
          this.sendToMainProcess('hotkey-pressed', payload);
        }
      } catch (error) {
        this.logger.error('Failed to handle hotkey press:', error);
      }
    });
  }
}

// Main entry point
if (require.main === module) {
  const daemon = new LinuxHelperDaemon();
  
  daemon.start().catch((error) => {
    console.error('Failed to start daemon:', error);
    process.exit(1);
  });
}

export { LinuxHelperDaemon };