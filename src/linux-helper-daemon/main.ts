#!/usr/bin/env node

import { HotkeyManager } from './hotkey-manager';
import { ScreenshotManager } from './screenshot';
import { DaemonServer } from './server';
import { Logger } from './logger';
import { PopupController } from './popup-controller';
import { CursorTracker } from './cursor-tracker';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

interface DaemonConfig {
  port: number;
  socketPath: string;
  logLevel: 'debug' | 'info' | 'error';
  hotkey: string;
  popupTheme: 'dark' | 'light' | 'auto';
  autoStart: boolean;
}

class LinuxHelperDaemon {
  private config: DaemonConfig;
  private hotkeyManager: HotkeyManager;
  private screenshotManager: ScreenshotManager;
  private popupController: PopupController;
  private server: DaemonServer;
  private cursorTracker: CursorTracker;
  private logger: Logger;
  private isRunning = false;

  constructor() {
    this.config = this.loadConfig();
    this.logger = new Logger(this.config.logLevel);
    
    this.hotkeyManager = new HotkeyManager(this.config.hotkey, this.logger);
    this.screenshotManager = new ScreenshotManager(this.logger);
    this.popupController = new PopupController(this.logger);
    this.server = new DaemonServer(this.config.port, this.config.socketPath, this.logger);
    this.cursorTracker = new CursorTracker(this.logger);
    
    this.setupEventHandlers();
  }

  private loadConfig(): DaemonConfig {
    const configPath = path.join(os.homedir(), '.config', 'linux-helper', 'daemon.json');
    
    const defaultConfig: DaemonConfig = {
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
    } catch (error) {
      console.warn('Failed to load config, using defaults:', error);
    }

    return defaultConfig;
  }

  private setupEventHandlers(): void {
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
      } catch (error) {
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

  private async analyzeScreenshot(dataUrl: string): Promise<any> {
    // Import AI analyzer
    const { AIAnalyzer } = await import('./ai-analyzer');
    const analyzer = new AIAnalyzer(this.logger, process.env.GEMINI_API_KEY);
    
    try {
      const result = await analyzer.analyzeScreenshot(dataUrl, {
        linuxDistro: 'pop-os',
        showSystemContext: true
      });
      
      return result;
    } catch (error) {
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

  async start(): Promise<void> {
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
      await this.hotkeyManager.unregister();
      await this.popupController.cleanup();
      await this.server.stop();
      
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
      hotkey: this.hotkeyManager.getCurrentHotkey(),
      uptime: process.uptime()
    };
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