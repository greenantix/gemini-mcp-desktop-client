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
exports.DaemonServer = void 0;
const http = __importStar(require("http"));
const net = __importStar(require("net"));
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const ai_analyzer_1 = require("./ai-analyzer");
class DaemonServer {
    async handleScreenshotAnalysis(screenshotDataUrl) {
        try {
            const analysis = await this.aiAnalyzer.analyzeScreenshot(screenshotDataUrl);
            return analysis;
        }
        catch (error) {
            this.logger.error('Screenshot analysis failed:', error);
            throw error;
        }
    }
    constructor(port, socketPath, logger) {
        this.port = port;
        this.socketPath = socketPath;
        this.logger = logger;
        this.isRunning = false;
        this.aiAnalyzer = new ai_analyzer_1.AIAnalyzer(logger);
    }
    setHotkeyCallback(callback) {
        this.hotkeyCallback = callback;
    }
    async start() {
        try {
            // Start HTTP server for web communication
            await this.startHttpServer();
            // Start Unix socket server for local IPC
            await this.startSocketServer();
            this.isRunning = true;
            this.logger.info(`Server started on port ${this.port} and socket ${this.socketPath}`);
        }
        catch (error) {
            this.logger.error('Failed to start server:', error);
            throw error;
        }
    }
    async startHttpServer() {
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
                            const message = JSON.parse(body);
                            const response = await this.handleMessage(message);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(response));
                        }
                        catch (error) {
                            const errorResponse = {
                                success: false,
                                error: error instanceof Error ? error.message : 'Unknown error'
                            };
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(errorResponse));
                        }
                    });
                }
                else if (req.method === 'GET' && req.url === '/status') {
                    const statusResponse = {
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
                }
                else {
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
    async startSocketServer() {
        return new Promise((resolve, reject) => {
            // Remove existing socket file if it exists
            if (fs.existsSync(this.socketPath)) {
                fs.unlinkSync(this.socketPath);
            }
            this.socketServer = net.createServer((socket) => {
                this.logger.debug('Client connected to Unix socket');
                socket.on('data', async (data) => {
                    try {
                        const message = JSON.parse(data.toString());
                        const response = await this.handleMessage(message);
                        socket.write(JSON.stringify(response) + '\n');
                    }
                    catch (error) {
                        const errorResponse = {
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
    async handleMessage(message) {
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
                    }
                    catch (error) {
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
                        }
                        catch (error) {
                            return {
                                success: false,
                                error: `Screenshot capture failed: ${error instanceof Error ? error.message : 'Unknown error'}`
                            };
                        }
                    }
                    else {
                        return { success: false, error: 'Hotkey callback not registered' };
                    }
                case 'execute':
                    if (!message.payload?.command) {
                        return { success: false, error: 'No command provided' };
                    }
                    try {
                        const result = (0, child_process_1.execSync)(message.payload.command, { encoding: 'utf-8' });
                        return { success: true, data: { output: result } };
                    }
                    catch (error) {
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
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async stop() {
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
            }
            else {
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
            }
            else {
                checkComplete();
            }
        });
    }
}
exports.DaemonServer = DaemonServer;
//# sourceMappingURL=server.js.map