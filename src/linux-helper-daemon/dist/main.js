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
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const net = __importStar(require("net"));
const screenshot_1 = require("./screenshot");
const cursor_tracker_1 = require("./cursor-tracker");
const logger_1 = require("./logger");
// --- Singleton Pattern ---
let instance = null;
class LinuxHelperDaemon {
    constructor() {
        this.isRunning = false;
        this.hotkeyProcess = null;
        this.socketServer = null;
        this.clientSocket = null;
        // Load config, initialize managers etc.
        const config = this.loadConfig();
        this.logger = new logger_1.Logger(config.logLevel);
        this.screenshotManager = new screenshot_1.ScreenshotManager(this.logger);
        this.cursorTracker = new cursor_tracker_1.CursorTracker(this.logger);
        this.socketPath = config.socketPath;
        this.hotkey = config.hotkey;
        this.lockFilePath = '/tmp/linux-helper-daemon.lock';
        this.setupProcessHandlers();
    }
    static getInstance() {
        if (!instance) {
            instance = new LinuxHelperDaemon();
        }
        return instance;
    }
    loadConfig() {
        // Simplified config loading
        return {
            socketPath: '/tmp/linux-helper.sock',
            logLevel: 'info',
            hotkey: 'ForwardButton', // Default hotkey
        };
    }
    acquireLock() {
        if (fs.existsSync(this.lockFilePath)) {
            this.logger.error('Lock file exists. Another instance may be running.');
            return false;
        }
        fs.writeFileSync(this.lockFilePath, process.pid.toString());
        return true;
    }
    releaseLock() {
        if (fs.existsSync(this.lockFilePath)) {
            fs.unlinkSync(this.lockFilePath);
        }
    }
    async start() {
        if (this.isRunning) {
            this.logger.warn('Daemon is already running.');
            return;
        }
        if (!this.acquireLock()) {
            process.exit(1);
        }
        this.logger.info('Starting Linux Helper Daemon...');
        this.isRunning = true;
        await this.startSocketServer();
        this.startHotkeyMonitoring();
    }
    async shutdown() {
        if (!this.isRunning)
            return;
        this.logger.info('Shutting down daemon...');
        this.isRunning = false;
        this.stopHotkeyMonitoring();
        this.socketServer?.close();
        if (this.clientSocket) {
            this.clientSocket.destroy();
        }
        this.releaseLock();
        this.logger.info('Daemon shutdown complete.');
        process.exit(0);
    }
    setupProcessHandlers() {
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
        process.on('exit', () => this.releaseLock());
    }
    startHotkeyMonitoring() {
        this.stopHotkeyMonitoring(); // Ensure no lingering process
        const buttonMapping = {
            'ForwardButton': 9,
            'MiddleClick': 2,
            'BackButton': 8
        };
        const button = buttonMapping[this.hotkey];
        if (button) {
            this.startMouseMonitoring(button);
        }
        else {
            this.logger.warn(`Keyboard hotkey '${this.hotkey}' not yet implemented in daemon. Listening for mouse only.`);
        }
    }
    stopHotkeyMonitoring() {
        if (this.hotkeyProcess) {
            this.hotkeyProcess.kill('SIGKILL'); // Use SIGKILL to ensure it dies
            this.hotkeyProcess = null;
            this.logger.info('Stopped previous hotkey monitoring process.');
        }
    }
    startMouseMonitoring(button) {
        this.logger.info(`Starting mouse button monitoring for button ${button}`);
        try {
            this.hotkeyProcess = (0, child_process_1.spawn)('xinput', ['test-xi2', '--root'], {
                detached: true, // Detach from parent
                stdio: 'pipe'
            });
            this.hotkeyProcess.on('error', (err) => {
                this.logger.error('Failed to spawn xinput process.', err.message);
                this.hotkeyProcess = null;
            });
            this.hotkeyProcess.on('exit', (code, signal) => {
                this.logger.warn(`xinput process exited with code ${code} and signal ${signal}`);
                this.hotkeyProcess = null;
                if (this.isRunning) {
                    this.logger.info('Restarting mouse monitoring in 5 seconds...');
                    setTimeout(() => this.startMouseMonitoring(button), 5000);
                }
            });
            const debounceMs = 500;
            let lastEventTime = 0;
            this.hotkeyProcess.stdout?.on('data', (data) => {
                const output = data.toString();
                if (output.includes('ButtonPress') && output.includes(`detail: ${button}`)) {
                    const now = Date.now();
                    if (now - lastEventTime > debounceMs) {
                        lastEventTime = now;
                        this.logger.info(`Hotkey press detected (Button ${button})`);
                        this.onHotkeyPress();
                    }
                }
            });
            this.hotkeyProcess.stderr?.on('data', (data) => {
                this.logger.error(`xinput stderr: ${data.toString()}`);
            });
        }
        catch (error) {
            if (error instanceof Error) {
                this.logger.error('Error spawning xinput.', error.message);
            }
        }
    }
    async onHotkeyPress() {
        try {
            const [screenshot, cursorPos] = await Promise.all([
                this.screenshotManager.captureActiveMonitor(),
                this.cursorTracker.getCurrentPosition()
            ]);
            if (screenshot && cursorPos) {
                const payload = {
                    type: 'hotkey-event',
                    data: {
                        screenshotDataUrl: screenshot.dataUrl,
                        cursorPosition: cursorPos
                    }
                };
                if (this.clientSocket) {
                    this.clientSocket.write(JSON.stringify(payload));
                    this.logger.info('Sent hotkey payload to main process.');
                }
                else {
                    this.logger.warn('No client connected to send payload.');
                }
            }
        }
        catch (error) {
            if (error instanceof Error) {
                this.logger.error('Error during hotkey press handler:', error.message);
            }
        }
    }
    async startSocketServer() {
        if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
        }
        this.socketServer = net.createServer((socket) => {
            this.logger.info('Main process connected to daemon.');
            this.clientSocket = socket;
            socket.on('data', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'update-hotkey') {
                    this.logger.info(`Received hotkey update: ${message.hotkey}`);
                    this.hotkey = message.hotkey;
                    this.startHotkeyMonitoring();
                }
            });
            socket.on('close', () => {
                this.logger.info('Main process disconnected.');
                this.clientSocket = null;
            });
            socket.on('error', (err) => {
                this.logger.error('Socket error with main process:', err.message);
                this.clientSocket = null;
            });
        }).listen(this.socketPath, () => {
            this.logger.info(`Daemon socket server listening at ${this.socketPath}`);
        });
        this.socketServer.on('error', (err) => {
            this.logger.error('Socket server error:', err.message);
        });
    }
}
// Ensure singleton instance is created and started
LinuxHelperDaemon.getInstance().start();
//# sourceMappingURL=main.js.map