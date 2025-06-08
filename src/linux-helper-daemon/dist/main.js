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
exports.LinuxHelperDaemon = void 0;
const screenshot_1 = require("./screenshot");
const logger_1 = require("./logger");
const cursor_tracker_1 = require("./cursor-tracker");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const net = __importStar(require("net"));
const child_process_1 = require("child_process");
class LinuxHelperDaemon {
    constructor() {
        this.isRunning = false;
        this.config = this.loadConfig();
        this.logger = new logger_1.Logger(this.config.logLevel);
        this.screenshotManager = new screenshot_1.ScreenshotManager(this.logger);
        this.cursorTracker = new cursor_tracker_1.CursorTracker(this.logger);
        this.setupEventHandlers();
    }
    loadConfig() {
        const configPath = path.join(os.homedir(), '.config', 'linux-helper', 'daemon.json');
        const defaultConfig = {
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
        }
        catch (error) {
            console.warn('Failed to load config, using defaults:', error);
        }
        return defaultConfig;
    }
    setupEventHandlers() {
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
                    const payload = {
                        screenshotDataUrl: screenshot.dataUrl,
                        cursorPosition
                    };
                    // Send to main Electron process via socket
                    this.sendToMainProcess('hotkey-pressed', payload);
                }
            }
            catch (error) {
                this.logger.error('Failed to handle hotkey press:', error);
            }
        };
        // Set up mouse button monitoring if hotkey is a mouse button
        this.setupMouseButtonMonitoring(hotkeyHandler);
        // Handle graceful shutdown
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
    }
    setupMouseButtonMonitoring(hotkeyHandler) {
        const buttonMapping = this.getButtonMapping(this.config.hotkey);
        if (buttonMapping.type === 'mouse' && buttonMapping.button !== undefined) {
            this.startMouseMonitoring(buttonMapping.button, hotkeyHandler);
        }
        else {
            this.logger.warn(`Hotkey ${this.config.hotkey} is not a supported mouse button`);
        }
    }
    getButtonMapping(hotkey) {
        const mouseButtons = {
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
        }
        else {
            return { type: 'keyboard', key: hotkey };
        }
    }
    startMouseMonitoring(button, callback) {
        this.logger.info(`Starting mouse button monitoring for button ${button}`);
        // Use xinput to monitor mouse events
        this.hotkeyProcess = (0, child_process_1.spawn)('xinput', ['test-xi2', '--root'], {
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let lastEventTime = 0;
        const debounceMs = 500; // Prevent double-clicks
        this.hotkeyProcess.stdout?.on('data', (data) => {
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
        this.hotkeyProcess.stderr?.on('data', (data) => {
            this.logger.error('Mouse monitoring error:', data.toString());
        });
        this.hotkeyProcess.on('exit', (code) => {
            this.logger.warn(`Mouse monitoring process exited with code ${code}`);
        });
    }
    connectToMainProcess() {
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
            }
            catch (error) {
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
    sendToMainProcess(event, data) {
        if (this.socketClient && this.socketClient.writable) {
            const message = JSON.stringify({ event, data });
            this.socketClient.write(message + '\n');
            this.logger.debug(`Sent to main process: ${event}`);
        }
        else {
            this.logger.warn('Socket not connected, attempting to reconnect...');
            this.connectToMainProcess();
        }
    }
    async start() {
        if (this.isRunning) {
            this.logger.warn('Daemon already running');
            return;
        }
        try {
            this.logger.info('Starting Linux Helper Daemon...');
            // Connect to main Electron process
            this.connectToMainProcess();
            this.isRunning = true;
            this.logger.info(`Linux Helper Daemon started successfully`);
            this.logger.info(`- Hotkey: ${this.config.hotkey}`);
            this.logger.info(`- Socket: ${this.config.socketPath}`);
        }
        catch (error) {
            this.logger.error('Failed to start daemon:', error);
            throw error;
        }
    }
    async shutdown() {
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
            this.isRunning = false;
            this.logger.info('Daemon shutdown complete');
            process.exit(0);
        }
        catch (error) {
            this.logger.error('Error during shutdown:', error);
            process.exit(1);
        }
    }
    getStatus() {
        return {
            running: this.isRunning,
            config: this.config,
            hotkey: this.config.hotkey,
            uptime: process.uptime()
        };
    }
    updateHotkey(newHotkey) {
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
                    const payload = {
                        screenshotDataUrl: screenshot.dataUrl,
                        cursorPosition
                    };
                    this.sendToMainProcess('hotkey-pressed', payload);
                }
            }
            catch (error) {
                this.logger.error('Failed to handle hotkey press:', error);
            }
        });
    }
}
exports.LinuxHelperDaemon = LinuxHelperDaemon;
// Main entry point
if (require.main === module) {
    const daemon = new LinuxHelperDaemon();
    daemon.start().catch((error) => {
        console.error('Failed to start daemon:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=main.js.map