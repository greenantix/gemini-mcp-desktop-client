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
const hotkey_manager_1 = require("./hotkey-manager");
const screenshot_1 = require("./screenshot");
const server_1 = require("./server");
const logger_1 = require("./logger");
const popup_controller_1 = require("./popup-controller");
const cursor_tracker_1 = require("./cursor-tracker");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
class LinuxHelperDaemon {
    constructor() {
        this.isRunning = false;
        this.config = this.loadConfig();
        this.logger = new logger_1.Logger(this.config.logLevel);
        this.hotkeyManager = new hotkey_manager_1.HotkeyManager(this.config.hotkey, this.logger);
        this.screenshotManager = new screenshot_1.ScreenshotManager(this.logger);
        this.popupController = new popup_controller_1.PopupController(this.logger);
        this.server = new server_1.DaemonServer(this.config.port, this.config.socketPath, this.logger);
        this.cursorTracker = new cursor_tracker_1.CursorTracker(this.logger);
        this.setupEventHandlers();
    }
    loadConfig() {
        const configPath = path.join(os.homedir(), '.config', 'linux-helper', 'daemon.json');
        const defaultConfig = {
            port: 3847,
            socketPath: '/tmp/linux-helper.sock',
            logLevel: 'info',
            hotkey: 'ForwardButton',
            popupTheme: 'dark',
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
            this.logger.info('Hotkey pressed, capturing screenshot');
            try {
                // Get cursor position for popup positioning
                const cursorPos = await this.cursorTracker.getCurrentPosition();
                this.logger.debug(`Cursor position: ${cursorPos.x}, ${cursorPos.y}`);
                const screenshot = await this.screenshotManager.captureActiveMonitor();
                if (screenshot) {
                    // Send cursor position to popup and show loading state
                    await this.popupController.showLoadingStateAtPosition(cursorPos);
                    // Analyze screenshot
                    const analysis = await this.analyzeScreenshot(screenshot.dataUrl);
                    // Update popup with results
                    await this.popupController.showResults(analysis);
                }
            }
            catch (error) {
                this.logger.error('Failed to handle hotkey press:', error);
                await this.popupController.showError('Screenshot capture failed');
            }
        };
        // Register hotkey handler
        this.hotkeyManager.onHotkeyPress(hotkeyHandler);
        // Register the same handler with the server for HTTP/socket triggers
        this.server.setHotkeyCallback(hotkeyHandler);
        // Handle popup interactions will be implemented via IPC
        // Handle graceful shutdown
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
    }
    async analyzeScreenshot(dataUrl) {
        // Import AI analyzer
        const { AIAnalyzer } = await Promise.resolve().then(() => __importStar(require('./ai-analyzer')));
        const analyzer = new AIAnalyzer(this.logger, process.env.GEMINI_API_KEY);
        try {
            const result = await analyzer.analyzeScreenshot(dataUrl, {
                linuxDistro: 'pop-os',
                showSystemContext: true
            });
            return result;
        }
        catch (error) {
            this.logger.error('AI analysis failed:', error);
            // Return fallback response
            return {
                summary: 'Analysis failed - screenshot captured',
                suggestions: [
                    {
                        title: 'Manual Review',
                        command: 'echo "Please review the screenshot manually"',
                        description: 'AI analysis was not available'
                    }
                ]
            };
        }
    }
    async start() {
        if (this.isRunning) {
            this.logger.warn('Daemon already running');
            return;
        }
        try {
            this.logger.info('Starting Linux Helper Daemon...');
            // Start server
            await this.server.start();
            // Register hotkeys
            await this.hotkeyManager.register();
            // Initialize popup system
            await this.popupController.initialize();
            this.isRunning = true;
            this.logger.info(`Linux Helper Daemon started successfully`);
            this.logger.info(`- Hotkey: ${this.config.hotkey}`);
            this.logger.info(`- Server: localhost:${this.config.port}`);
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
            await this.hotkeyManager.unregister();
            await this.popupController.cleanup();
            await this.server.stop();
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
            hotkey: this.hotkeyManager.getCurrentHotkey(),
            uptime: process.uptime()
        };
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