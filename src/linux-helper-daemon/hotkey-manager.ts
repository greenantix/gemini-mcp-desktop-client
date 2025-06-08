import { execSync, spawn } from 'child_process';
import { Logger } from './logger';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type HotkeyCallback = () => Promise<void> | void;

export class HotkeyManager {
  private isRegistered = false;
  private callback?: HotkeyCallback;
  private hotkeyProcess?: any;
  private tempScriptPath?: string;

  constructor(
    private hotkey: string,
    private logger: Logger
  ) {}

  async register(): Promise<void> {
    if (this.isRegistered) {
      this.logger.warn('Hotkey already registered');
      return;
    }

    try {
      // Check if we're running on a system with xbindkeys support
      if (this.hasXbindkeys()) {
        await this.registerWithXbindkeys();
      } else {
        // Fallback to a simple polling approach or other methods
        await this.registerWithPolling();
      }
      
      this.isRegistered = true;
      this.logger.info(`Hotkey ${this.hotkey} registered successfully`);
    } catch (error) {
      this.logger.error('Failed to register hotkey:', error);
      throw error;
    }
  }

  private hasXbindkeys(): boolean {
    try {
      execSync('which xbindkeys', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  private async registerWithXbindkeys(): Promise<void> {
    // Create a temporary script that will be called when hotkey is pressed
    const scriptContent = `#!/bin/bash\n# Linux Helper Hotkey Script\ncurl -X POST http://localhost:3847 -H "Content-Type: application/json" -d '{"type":"capture"}' > /dev/null 2>&1 &`;
    
    this.tempScriptPath = path.join(os.tmpdir(), 'linux-helper-hotkey.sh');
    fs.writeFileSync(this.tempScriptPath, scriptContent);
    fs.chmodSync(this.tempScriptPath, '755');

    // Create xbindkeys configuration
    const xbindkeysConfig = `"${this.tempScriptPath}"\n    ${this.convertHotkeyToXbindkeys(this.hotkey)}`;
    
    const configPath = path.join(os.homedir(), '.xbindkeysrc.linux-helper');
    fs.writeFileSync(configPath, xbindkeysConfig);

    // Start xbindkeys with our config
    try {
      this.hotkeyProcess = spawn('xbindkeys', ['-f', configPath], {
        detached: true,
        stdio: 'ignore'
      });
      
      this.hotkeyProcess.unref();
    } catch (error) {
      this.logger.error('Failed to start xbindkeys:', error);
      throw error;
    }
  }

  private async registerWithPolling(): Promise<void> {
    // This is a fallback method that uses xinput to monitor key events
    // Note: This is less reliable and more resource-intensive
    this.logger.warn('Using polling fallback for hotkey detection');
    
    // For now, we'll just log that we would be polling
    // A full implementation would need to monitor X11 events or use other system APIs
    this.logger.info('Hotkey polling would be implemented here');
  }

  private convertHotkeyToXbindkeys(hotkey: string): string {
    // Convert common hotkey formats to xbindkeys format
    const hotkeyMap: { [key: string]: string } = {
      'F10': 'F10',
      'F9': 'F9',
      'Ctrl+Shift+H': 'control+shift + h',
      'Ctrl+Alt+E': 'control+alt + e',
      'Escape': 'Escape'
    };

    return hotkeyMap[hotkey] || hotkey.toLowerCase();
  }

  onHotkeyPress(callback: HotkeyCallback): void {
    this.callback = callback;
  }

  async triggerHotkey(): Promise<void> {
    if (this.callback) {
      try {
        await this.callback();
      } catch (error) {
        this.logger.error('Error in hotkey callback:', error);
      }
    }
  }

  getCurrentHotkey(): string {
    return this.hotkey;
  }

  async updateHotkey(newHotkey: string): Promise<void> {
    if (this.isRegistered) {
      await this.unregister();
    }
    
    this.hotkey = newHotkey;
    await this.register();
  }

  async unregister(): Promise<void> {
    if (!this.isRegistered) {
      return;
    }

    try {
      // Kill xbindkeys process if it exists
      if (this.hotkeyProcess) {
        this.hotkeyProcess.kill();
        this.hotkeyProcess = undefined;
      }

      // Clean up temporary files
      if (this.tempScriptPath && fs.existsSync(this.tempScriptPath)) {
        fs.unlinkSync(this.tempScriptPath);
        this.tempScriptPath = undefined;
      }

      const configPath = path.join(os.homedir(), '.xbindkeysrc.linux-helper');
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
      }

      // Kill any running xbindkeys processes for our config
      try {
        execSync('pkill -f "xbindkeys.*linux-helper"', { stdio: 'ignore' });
      } catch {
        // Ignore if no processes found
      }

      this.isRegistered = false;
      this.logger.info('Hotkey unregistered successfully');
    } catch (error) {
      this.logger.error('Error unregistering hotkey:', error);
      throw error;
    }
  }
}