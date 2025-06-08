import { Logger } from './logger';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as net from 'net';

export interface PopupMessage {
  type: 'show' | 'hide' | 'update' | 'position';
  data?: any;
}

export interface PopupState {
  status: 'loading' | 'success' | 'error' | 'idle';
  title?: string;
  content?: string;
  suggestions?: Array<{
    title: string;
    command: string;
    description: string;
  }>;
  error?: string;
}

/**
 * PopupController manages a separate Electron process for the popup window
 * This keeps the daemon as a pure Node.js service
 */
export class PopupController {
  private popupProcess: ChildProcess | null = null;
  private isRunning = false;
  private socketClient: net.Socket | null = null;
  private popupSocketPath: string;

  constructor(private logger: Logger) {
    this.popupSocketPath = '/tmp/linux-helper-popup.sock';
  }

  async initialize(): Promise<void> {
    try {
      await this.startPopupProcess();
      await this.connectToPopup();
      this.logger.info('Popup controller initialized');
    } catch (error) {
      this.logger.error('Failed to initialize popup controller:', error);
      throw error;
    }
  }

  private async startPopupProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      const popupScript = path.join(__dirname, 'popup-main.js');
      
      // Check if popup script exists
      if (!fs.existsSync(popupScript)) {
        // Fallback: use the basic popup
        const fallbackScript = path.join(__dirname, 'popup-process.js');
        this.createFallbackPopupScript(fallbackScript);
        
        this.logger.info(`Starting popup process with fallback: ${fallbackScript}`);
        this.popupProcess = spawn('node', [fallbackScript], {
          detached: false,
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } else {
        this.logger.info(`Starting Electron popup process: ${popupScript}`);
        // Use electron to run the popup
        this.popupProcess = spawn('npx', ['electron', popupScript], {
          detached: false,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, DISPLAY: process.env.DISPLAY || ':0' }
        });
      }

      this.popupProcess.on('error', (error) => {
        this.logger.error('Popup process error:', error);
        reject(error);
      });

      this.popupProcess.on('exit', (code) => {
        this.logger.info(`Popup process exited with code: ${code}`);
        this.isRunning = false;
        this.popupProcess = null;
      });

      // Give the process time to start
      setTimeout(() => {
        if (this.popupProcess && !this.popupProcess.killed) {
          this.isRunning = true;
          resolve();
        } else {
          reject(new Error('Popup process failed to start'));
        }
      }, 2000);
    });
  }

  private createFallbackPopupScript(scriptPath: string): void {
    const script = `// Fallback popup process for Linux Helper daemon
const net = require('net');
const path = require('path');
const fs = require('fs');

const SOCKET_PATH = '/tmp/linux-helper-popup.sock';

class FallbackPopup {
  constructor() {
    this.server = null;
    this.currentState = { status: 'idle' };
    this.isVisible = false;
  }

  async start() {
    console.log('[Popup Process] Starting fallback popup server...');
    
    // Remove existing socket
    if (fs.existsSync(SOCKET_PATH)) {
      fs.unlinkSync(SOCKET_PATH);
    }

    this.server = net.createServer((socket) => {
      console.log('[Popup Process] Client connected');
      
      socket.on('data', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message, socket);
        } catch (error) {
          console.error('[Popup Process] Invalid message:', error);
        }
      });
      
      socket.on('close', () => {
        console.log('[Popup Process] Client disconnected');
      });
    });

    this.server.listen(SOCKET_PATH, () => {
      console.log('[Popup Process] Popup server listening on', SOCKET_PATH);
    });
  }

  handleMessage(message, socket) {
    console.log('[Popup Process] Received message:', message.type);
    
    switch (message.type) {
      case 'show':
        this.isVisible = true;
        this.currentState = message.data || { status: 'loading' };
        console.log('[Popup Process] Popup shown with state:', this.currentState.status);
        socket.write(JSON.stringify({ success: true, visible: true }));
        break;
        
      case 'hide':
        this.isVisible = false;
        console.log('[Popup Process] Popup hidden');
        socket.write(JSON.stringify({ success: true, visible: false }));
        break;
        
      case 'update':
        this.currentState = { ...this.currentState, ...message.data };
        console.log('[Popup Process] State updated:', this.currentState.status);
        socket.write(JSON.stringify({ success: true, state: this.currentState }));
        break;
        
      default:
        socket.write(JSON.stringify({ success: false, error: 'Unknown message type' }));
    }
  }

  async stop() {
    if (this.server) {
      this.server.close();
      console.log('[Popup Process] Server stopped');
    }
  }
}

const popup = new FallbackPopup();
popup.start().catch(console.error);

process.on('SIGINT', async () => {
  console.log('[Popup Process] Shutting down...');
  await popup.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Popup Process] Terminating...');
  await popup.stop();
  process.exit(0);
});
`;

    fs.writeFileSync(scriptPath, script);
    fs.chmodSync(scriptPath, '755');
    this.logger.info(`Created fallback popup script: ${scriptPath}`);
  }

  private async connectToPopup(): Promise<void> {
    return new Promise((resolve, reject) => {
      const maxRetries = 5;
      let retries = 0;

      const tryConnect = () => {
        this.socketClient = net.createConnection(this.popupSocketPath);

        this.socketClient.on('connect', () => {
          this.logger.debug('Connected to popup process');
          resolve();
        });

        this.socketClient.on('error', (error) => {
          retries++;
          if (retries < maxRetries) {
            this.logger.debug(`Popup connection attempt ${retries} failed, retrying...`);
            setTimeout(tryConnect, 1000);
          } else {
            this.logger.error('Failed to connect to popup process after retries');
            reject(error);
          }
        });

        this.socketClient.on('close', () => {
          this.logger.debug('Popup connection closed');
          this.socketClient = null;
        });
      };

      // Wait a moment for the popup process to start its server
      setTimeout(tryConnect, 500);
    });
  }

  private async sendMessage(message: PopupMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.socketClient) {
        reject(new Error('Not connected to popup process'));
        return;
      }

      const messageStr = JSON.stringify(message);
      this.socketClient.write(messageStr);

      // Listen for response
      const responseHandler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          this.socketClient?.off('data', responseHandler);
          resolve(response);
        } catch (error) {
          reject(error);
        }
      };

      this.socketClient.on('data', responseHandler);

      // Timeout after 5 seconds
      setTimeout(() => {
        this.socketClient?.off('data', responseHandler);
        reject(new Error('Popup message timeout'));
      }, 5000);
    });
  }

  async showLoadingState(): Promise<void> {
    try {
      await this.sendMessage({
        type: 'show',
        data: { status: 'loading', title: 'Analyzing screenshot...' }
      });
      this.logger.debug('Popup shown in loading state');
    } catch (error) {
      this.logger.error('Failed to show popup loading state:', error);
    }
  }

  async showLoadingStateAtPosition(cursorPosition: { x: number; y: number }): Promise<void> {
    try {
      // First send cursor position
      await this.sendMessage({
        type: 'position',
        data: { x: cursorPosition.x, y: cursorPosition.y }
      });
      
      // Then show loading state
      await this.sendMessage({
        type: 'show',
        data: { status: 'loading', title: 'Analyzing screenshot...' }
      });
      
      this.logger.debug(`Popup shown at cursor position (${cursorPosition.x}, ${cursorPosition.y})`);
    } catch (error) {
      this.logger.error('Failed to show popup at position:', error);
    }
  }

  async showResults(analysis: any): Promise<void> {
    try {
      await this.sendMessage({
        type: 'update',
        data: {
          status: 'success',
          title: 'Analysis Complete',
          content: analysis.summary || 'Analysis completed',
          suggestions: analysis.suggestions || []
        }
      });
      this.logger.debug('Popup updated with results');
    } catch (error) {
      this.logger.error('Failed to show popup results:', error);
    }
  }

  async showError(error: string): Promise<void> {
    try {
      await this.sendMessage({
        type: 'update',
        data: { status: 'error', error }
      });
      this.logger.debug('Popup updated with error');
    } catch (error) {
      this.logger.error('Failed to show popup error:', error);
    }
  }

  async hide(): Promise<void> {
    try {
      await this.sendMessage({ type: 'hide' });
      this.logger.debug('Popup hidden');
    } catch (error) {
      this.logger.error('Failed to hide popup:', error);
    }
  }

  async cleanup(): Promise<void> {
    try {
      if (this.socketClient) {
        this.socketClient.destroy();
        this.socketClient = null;
      }

      if (this.popupProcess && !this.popupProcess.killed) {
        this.popupProcess.kill('SIGTERM');
        this.popupProcess = null;
      }

      // Clean up socket file
      if (fs.existsSync(this.popupSocketPath)) {
        fs.unlinkSync(this.popupSocketPath);
      }

      this.isRunning = false;
      this.logger.info('Popup controller cleaned up');
    } catch (error) {
      this.logger.error('Error during popup cleanup:', error);
    }
  }

  isPopupVisible(): boolean {
    return this.isRunning && this.socketClient !== null;
  }
}