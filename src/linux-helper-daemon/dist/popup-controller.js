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
exports.PopupController = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const net = __importStar(require("net"));
/**
 * PopupController manages a separate Electron process for the popup window
 * This keeps the daemon as a pure Node.js service
 */
class PopupController {
    constructor(logger) {
        this.logger = logger;
        this.popupProcess = null;
        this.isRunning = false;
        this.socketClient = null;
        this.popupSocketPath = '/tmp/linux-helper-popup.sock';
    }
    async initialize() {
        try {
            await this.startPopupProcess();
            await this.connectToPopup();
            this.logger.info('Popup controller initialized');
        }
        catch (error) {
            this.logger.error('Failed to initialize popup controller:', error);
            throw error;
        }
    }
    async startPopupProcess() {
        return new Promise((resolve, reject) => {
            const popupScript = path.join(__dirname, 'popup-main.js');
            // Check if popup script exists
            if (!fs.existsSync(popupScript)) {
                // Fallback: use the basic popup
                const fallbackScript = path.join(__dirname, 'popup-process.js');
                this.createFallbackPopupScript(fallbackScript);
                this.logger.info(`Starting popup process with fallback: ${fallbackScript}`);
                this.popupProcess = (0, child_process_1.spawn)('node', [fallbackScript], {
                    detached: false,
                    stdio: ['pipe', 'pipe', 'pipe']
                });
            }
            else {
                this.logger.info(`Starting Electron popup process: ${popupScript}`);
                // Use electron to run the popup
                this.popupProcess = (0, child_process_1.spawn)('npx', ['electron', popupScript], {
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
                }
                else {
                    reject(new Error('Popup process failed to start'));
                }
            }, 2000);
        });
    }
    createFallbackPopupScript(scriptPath) {
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
    async connectToPopup() {
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
                    }
                    else {
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
    async sendMessage(message) {
        return new Promise((resolve, reject) => {
            if (!this.socketClient) {
                reject(new Error('Not connected to popup process'));
                return;
            }
            const messageStr = JSON.stringify(message);
            this.socketClient.write(messageStr);
            // Listen for response
            const responseHandler = (data) => {
                try {
                    const response = JSON.parse(data.toString());
                    this.socketClient?.off('data', responseHandler);
                    resolve(response);
                }
                catch (error) {
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
    async showLoadingState() {
        try {
            await this.sendMessage({
                type: 'show',
                data: { status: 'loading', title: 'Analyzing screenshot...' }
            });
            this.logger.debug('Popup shown in loading state');
        }
        catch (error) {
            this.logger.error('Failed to show popup loading state:', error);
        }
    }
    async showLoadingStateAtPosition(cursorPosition) {
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
        }
        catch (error) {
            this.logger.error('Failed to show popup at position:', error);
        }
    }
    async showResults(analysis) {
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
        }
        catch (error) {
            this.logger.error('Failed to show popup results:', error);
        }
    }
    async showError(error) {
        try {
            await this.sendMessage({
                type: 'update',
                data: { status: 'error', error }
            });
            this.logger.debug('Popup updated with error');
        }
        catch (error) {
            this.logger.error('Failed to show popup error:', error);
        }
    }
    async hide() {
        try {
            await this.sendMessage({ type: 'hide' });
            this.logger.debug('Popup hidden');
        }
        catch (error) {
            this.logger.error('Failed to hide popup:', error);
        }
    }
    async cleanup() {
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
        }
        catch (error) {
            this.logger.error('Error during popup cleanup:', error);
        }
    }
    isPopupVisible() {
        return this.isRunning && this.socketClient !== null;
    }
}
exports.PopupController = PopupController;
//# sourceMappingURL=popup-controller.js.map