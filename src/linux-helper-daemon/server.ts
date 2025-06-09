import * as http from 'http';
import * as net from 'net';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { Logger } from './logger';
import { AIAnalyzer } from './ai-analyzer';

interface MessagePayload {
  command?: string;
  screenshotDataUrl?: string;
  cursorPosition?: { x: number; y: number };
}

interface ServerResponse {
  output?: string;
  analysis?: {
    summary: string;
    suggestions: Array<{
      title: string;
      command: string;
      description: string;
    }>;
    commands: string[];
  };
  message?: string;
  status?: {
    running: boolean;
    uptime: number;
    pid: number;
  };
}

export interface DaemonMessage {
  type: 'ping' | 'status' | 'capture' | 'execute' | 'shutdown' | 'trigger-hotkey' | 'get-analysis';
  payload?: MessagePayload;
}

export interface DaemonResponse {
  success: boolean;
  data?: ServerResponse;
  error?: string;
}

export class DaemonServer {
  private httpServer?: http.Server;
  private socketServer?: net.Server;
  private isRunning = false;
  private hotkeyCallback?: () => Promise<void>;
  private aiAnalyzer: AIAnalyzer;

  private async handleScreenshotAnalysis(screenshotDataUrl: string) {
    try {
      const analysis = await this.aiAnalyzer.analyzeScreenshot(screenshotDataUrl);
      return analysis;
    } catch (error) {
      this.logger.error('Screenshot analysis failed:', error);
      throw error;
    }
  }

  constructor(
    private port: number,
    private socketPath: string,
    private logger: Logger
  ) {
    this.aiAnalyzer = new AIAnalyzer(logger);
  }

  setHotkeyCallback(callback: () => Promise<void>): void {
    this.hotkeyCallback = callback;
  }

  async start(): Promise<void> {
    try {
      // Start HTTP server for web communication
      await this.startHttpServer();
      
      // Start Unix socket server for local IPC
      await this.startSocketServer();
      
      this.isRunning = true;
      this.logger.info(`Server started on port ${this.port} and socket ${this.socketPath}`);
    } catch (error) {
      this.logger.error('Failed to start server:', error);
      throw error;
    }
  }

  private async startHttpServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer = http.createServer((req, res) => {
        // Enable CORS
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        
        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          
          req.on('end', async () => {
            try {
              const message: DaemonMessage = JSON.parse(body);
              const response = await this.handleMessage(message);
              
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(response));
            } catch (error) {
              const errorResponse: DaemonResponse = {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
              };
              
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(errorResponse));
            }
          });
        } else if (req.method === 'GET' && req.url === '/status') {
          const statusResponse: DaemonResponse = {
            success: true,
            data: {
              status: {
                running: this.isRunning,
                uptime: process.uptime(),
                pid: process.pid
              }
            }
          };
          
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(statusResponse));
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });

      this.httpServer.listen(this.port, 'localhost', () => {
        resolve();
      });
      
      this.httpServer.on('error', reject);
    });
  }

  private async startSocketServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Remove existing socket file if it exists
      if (fs.existsSync(this.socketPath)) {
        fs.unlinkSync(this.socketPath);
      }

      this.socketServer = net.createServer((socket) => {
        this.logger.debug('Client connected to Unix socket');
        
        socket.on('data', async (data) => {
          try {
            const message: DaemonMessage = JSON.parse(data.toString());
            const response = await this.handleMessage(message);
            socket.write(JSON.stringify(response) + '\n');
          } catch (error) {
            const errorResponse: DaemonResponse = {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error'
            };
            socket.write(JSON.stringify(errorResponse) + '\n');
          }
        });
        
        socket.on('error', (error) => {
          this.logger.error('Socket client error:', error);
        });
        
        socket.on('close', () => {
          this.logger.debug('Client disconnected from Unix socket');
        });
      });

      this.socketServer.listen(this.socketPath, () => {
        resolve();
      });
      
      this.socketServer.on('error', reject);
    });
  }

  private async handleMessage(message: DaemonMessage): Promise<DaemonResponse> {
    this.logger.debug('Received message:', message.type);
    
    try {
      switch (message.type) {
        case 'ping':
          return { success: true, data: { message: 'pong' } };

        case 'get-analysis':
          if (!message.payload?.screenshotDataUrl) {
            return { success: false, error: 'No screenshot data provided' };
          }
          try {
            const analysis = await this.handleScreenshotAnalysis(message.payload.screenshotDataUrl);
            return { success: true, data: { analysis } };
          } catch (error) {
            return {
              success: false,
              error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
          }
          
        case 'status':
          return {
            success: true,
            data: {
              status: {
                running: this.isRunning,
                uptime: process.uptime(),
                pid: process.pid
              }
            }
          };
          
        case 'capture':
          // Trigger screenshot capture via hotkey callback
          if (this.hotkeyCallback) {
            try {
              await this.hotkeyCallback();
              return { success: true, data: { message: 'Screenshot capture initiated' } };
            } catch (error) {
              return { 
                success: false, 
                error: `Screenshot capture failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
              };
            }
          } else {
            return { success: false, error: 'Hotkey callback not registered' };
          }
          
        case 'execute':
          if (!message.payload?.command) {
            return { success: false, error: 'No command provided' };
          }
          
          try {
            const result = execSync(message.payload.command, { encoding: 'utf-8' });
            return { success: true, data: { output: result } };
          } catch (error) {
            return {
              success: false,
              error: `Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
          }
          
        case 'shutdown':
          // Graceful shutdown
          setTimeout(() => process.exit(0), 100);
          return { success: true, data: { message: 'Shutdown initiated' } };
          
        default:
          return { success: false, error: `Unknown message type: ${message.type}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    return new Promise((resolve) => {
      let stopped = 0;
      const checkComplete = () => {
        stopped++;
        if (stopped === 2) {
          this.isRunning = false;
          resolve();
        }
      };

      if (this.httpServer) {
        this.httpServer.close(() => {
          this.logger.debug('HTTP server stopped');
          checkComplete();
        });
      } else {
        checkComplete();
      }

      if (this.socketServer) {
        this.socketServer.close(() => {
          // Clean up socket file
          if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
          }
          this.logger.debug('Socket server stopped');
          checkComplete();
        });
      } else {
        checkComplete();
      }
    });
  }
}