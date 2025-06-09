#!/usr/bin/env node

import { ScreenshotManager } from './screenshot';
import { Logger } from './logger';
import { CursorTracker } from './cursor-tracker';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as net from 'net';
import { spawn, ChildProcess } from 'child_process';

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
  private hotkeyProcess?: ChildProcess | undefined;
  private isConnectingOrConnected = false;

  constructor() {
    this.config = this.loadConfig();
    this.logger = new Logger(this.config.logLevel);
    this.logger.debug(`Initial daemon environment: DISPLAY=${process.env.DISPLAY}, XAUTHORITY=${process.env.XAUTHORITY}`);
    
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

    let loadedConfig = defaultConfig;
    try {
      if (fs.existsSync(configPath)) {
        const configData = fs.readFileSync(configPath, 'utf8');
        loadedConfig = { ...defaultConfig, ...JSON.parse(configData) };
      }
    } catch (error) {
      // Logger is not available here yet, so use console for critical config load errors.
      console.warn('Failed to load config, using defaults:', error);
    }
    
    // this.logger.debug line moved to constructor
    return loadedConfig;
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
      // Try xbindkeys first for better compatibility
      if (this.hasXbindkeys()) {
        this.startXbindkeysMouseMonitoring(buttonMapping.button, hotkeyHandler);
      } else {
        this.startMouseMonitoring(buttonMapping.button, hotkeyHandler);
      }
    } else {
      this.logger.warn(`Hotkey ${this.config.hotkey} is not a supported mouse button`);
    }
  }
  
  private hasXbindkeys(): boolean {
    try {
      const { execSync } = require('child_process');
      execSync('which xbindkeys', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  
  private startXbindkeysMouseMonitoring(button: number, callback: () => Promise<void>): void {
    this.logger.info(`Starting xbindkeys mouse button monitoring for button ${button}`);
    
    try {
      const tempScriptPath = '/tmp/linux-helper-hotkey.sh';
      const scriptContent = `#!/bin/bash
# Mouse button callback script
echo "$(date): Mouse button ${button} pressed" >> /tmp/linux-helper-debug.log
curl -X POST http://localhost:3847/mouse-button-pressed -d '{"button":${button}}' -H "Content-Type: application/json" > /dev/null 2>&1 || echo "$(date): Failed to send button press" >> /tmp/linux-helper-debug.log
`;
      
      require('fs').writeFileSync(tempScriptPath, scriptContent);
      require('fs').chmodSync(tempScriptPath, '755');

      // Create xbindkeys config for mouse button
      const xbindkeysConfig = `"${tempScriptPath}"
    b:${button}`;
      
      const configPath = '/tmp/.xbindkeysrc.linux-helper';
      require('fs').writeFileSync(configPath, xbindkeysConfig);

      // Start xbindkeys with our config
      this.hotkeyProcess = spawn('xbindkeys', ['-f', configPath, '-n'], {
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      this.hotkeyProcess.on('error', (error: Error) => {
        this.logger.error('Failed to start xbindkeys:', error.message);
        // Fallback to xinput
        this.startMouseMonitoring(button, callback);
      });

      this.hotkeyProcess.on('exit', (code: number | null) => {
        this.logger.warn(`xbindkeys process exited with code ${code}`);
        if (this.isRunning && code !== 0) {
          this.logger.info('Restarting xbindkeys monitoring in 3 seconds...');
          setTimeout(() => {
            if (this.isRunning) {
              this.startXbindkeysMouseMonitoring(button, callback);
            }
          }, 3000);
        }
      });

      // Set up HTTP server to receive button press notifications
      this.setupButtonServer(callback);
      
    } catch (error: unknown) {
      this.logger.error('Error setting up xbindkeys mouse monitoring:', error);
      // Fallback to xinput
      this.startMouseMonitoring(button, callback);
    }
  }
  
  private setupButtonServer(callback: () => Promise<void>): void {
    const http = require('http');
    const server = http.createServer((req: any, res: any) => {
      if (req.method === 'POST' && req.url === '/mouse-button-pressed') {
        this.logger.debug('Mouse button press received via HTTP');
        callback().catch(error => {
          this.logger.error('Error in button callback:', error);
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"status":"ok"}');
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    
    server.listen(3847, '127.0.0.1', () => {
      this.logger.info('Button server listening on port 3847');
    });
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
    
    try {
      const xinputCommand = 'xinput';
      const xinputArgs = ['test-xi2', '--root'];
      
      // Determine DISPLAY value
      const displayEnv = process.env.DISPLAY || ':0'; // Default to :0 if not set
      const xAuthorityEnv = process.env.XAUTHORITY;
      this.logger.debug(`Spawning xinput. Current daemon env: DISPLAY=${process.env.DISPLAY}, XAUTHORITY=${xAuthorityEnv}. Using for spawn: DISPLAY=${displayEnv}, XAUTHORITY=${xAuthorityEnv || 'not set'}`);

      const spawnEnv: NodeJS.ProcessEnv = { ...process.env, 'DISPLAY': displayEnv };
      if (xAuthorityEnv) {
        spawnEnv['XAUTHORITY'] = xAuthorityEnv;
      }

      this.hotkeyProcess = spawn(xinputCommand, xinputArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: spawnEnv
      });

      let lastEventTime = 0;
      const debounceMs = 500;

      this.hotkeyProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        const lines = output.split('\n');
        
        for (const line of lines) {
          if (line.includes('ButtonPress') && line.includes(`detail: ${button}`)) {
            const now = Date.now();
            if (now - lastEventTime > debounceMs) {
              lastEventTime = now;
              this.logger.debug(`Mouse button ${button} pressed (event line: "${line.trim()}")`);
              callback().catch(error => {
                this.logger.error('Error in hotkey callback:', error);
              });
            }
          }
        }
      });

      this.hotkeyProcess.stderr?.on('data', (data: Buffer) => {
        const errorOutput = data.toString().trim();
        if (errorOutput) { // Only log if there's actual error output
            this.logger.error(`Mouse monitoring process stderr: ${errorOutput}`);
            // If xinput fails, try to restart it
            if (errorOutput.includes('BadAccess') || errorOutput.includes('Cannot open display') || errorOutput.includes('Unable to connect')) {
              this.logger.warn('xinput access/display issue, retrying in 5 seconds...');
              setTimeout(() => {
                if (this.isRunning) {
                  this.startMouseMonitoring(button, callback);
                }
              }, 5000);
            }
        }
      });

      this.hotkeyProcess.on('exit', (code: number | null, signal: string | null) => {
        this.logger.warn(`Mouse monitoring process exited with code ${code} and signal ${signal}`);
        // Restart monitoring if the daemon is still running and it wasn't a clean exit
        if (this.isRunning && (code !== 0 || signal !== null)) {
          this.logger.info('Restarting mouse monitoring in 3 seconds due to non-clean exit...');
          setTimeout(() => {
            if (this.isRunning) {
              this.startMouseMonitoring(button, callback);
            }
          }, 3000);
        }
      });

      this.hotkeyProcess.on('error', (error: Error) => {
        this.logger.error('Failed to start or error in xinput process:', error.message);
        // Consider a retry here as well, similar to 'exit'
        if (this.isRunning) {
            this.logger.info('Attempting to restart mouse monitoring due to spawn error in 3 seconds...');
            setTimeout(() => {
                if (this.isRunning) {
                    this.startMouseMonitoring(button, callback);
                }
            }, 3000);
        }
      });
      
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error('Synchronous error during setup of mouse monitoring:', error.message);
      } else {
        this.logger.error('Synchronous error during setup of mouse monitoring (unknown type):', error);
      }
    }
  }

  private connectToMainProcess(): void {
    if (this.isConnectingOrConnected && this.socketClient && this.socketClient.writable) {
      this.logger.debug('Already connected or attempting to connect to main process. Skipping new attempt.');
      return;
    }
    this.logger.debug(`Attempting to connect to main process via socket: ${this.config.socketPath}`);
    this.isConnectingOrConnected = true; // Set flag before attempting

    // Clear previous listeners to avoid duplicates if this is a retry
    if (this.socketClient) {
      this.socketClient.removeAllListeners();
      this.socketClient.destroy(); // Ensure old socket is fully closed
    }

    this.socketClient = net.createConnection({ path: this.config.socketPath }, () => {
      this.logger.info('Successfully connected to main Electron process socket.');
      // this.isConnectingOrConnected is already true
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
      } catch (error: unknown) {
        if (error instanceof Error) {
          this.logger.error('Error parsing main process message:', error.message);
        } else {
          this.logger.error('Error parsing main process message (unknown type):', error);
        }
      }
    });

    this.socketClient.on('error', (error: NodeJS.ErrnoException) => {
      this.logger.warn(`Socket connection error: ${error.message} (Code: ${error.code})`);
      this.isConnectingOrConnected = false; // Reset flag on error
      this.socketClient?.destroy(); // Clean up the problematic socket
      this.socketClient = undefined;
      this.logger.info('Retrying socket connection in 5 seconds...');
      setTimeout(() => this.connectToMainProcess(), 5000);
    });

    this.socketClient.on('close', (hadError) => {
      this.logger.warn(`Socket connection closed. Had error: ${hadError}. Retrying in 5 seconds...`);
      this.isConnectingOrConnected = false; // Reset flag on close
      this.socketClient = undefined; // Ensure it's cleared
      setTimeout(() => this.connectToMainProcess(), 5000);
    });
  }

  private sendToMainProcess(event: string, data: unknown): void {
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
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error('Error during shutdown:', error.message);
      } else {
        this.logger.error('Error during shutdown (unknown type):', error);
      }
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
    if (this.config.hotkey === newHotkey && this.hotkeyProcess) {
      this.logger.info(`Received updateHotkey event for '${newHotkey}', but it's the same as the current hotkey and monitoring is active. No changes made.`);
      return;
    }
    this.logger.info(`Updating hotkey from ${this.config.hotkey} to ${newHotkey}. Current monitoring process: ${this.hotkeyProcess ? 'active' : 'inactive'}`);
    
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
      } catch (error: unknown) {
        if (error instanceof Error) {
          this.logger.error('Failed to handle hotkey press:', error.message);
        } else {
          this.logger.error('Failed to handle hotkey press (unknown type):', error);
        }
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