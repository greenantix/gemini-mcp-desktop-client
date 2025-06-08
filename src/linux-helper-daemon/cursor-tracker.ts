import { execSync } from 'child_process';
import { Logger } from './logger';

export interface CursorPosition {
  x: number;
  y: number;
  screen?: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
}

export class CursorTracker {
  private logger: Logger;
  private lastPosition: CursorPosition = { x: 0, y: 0 };
  private trackingMethod: 'xdotool' | 'xwininfo' | 'fallback' = 'fallback';

  constructor(logger: Logger) {
    this.logger = logger;
    this.detectTrackingMethod();
  }

  private detectTrackingMethod(): void {
    try {
      // Try xdotool first (most reliable)
      execSync('which xdotool', { stdio: 'ignore' });
      this.trackingMethod = 'xdotool';
      this.logger.debug('Using xdotool for cursor tracking');
      return;
    } catch {}

    try {
      // Try xwininfo as fallback
      execSync('which xwininfo', { stdio: 'ignore' });
      this.trackingMethod = 'xwininfo';
      this.logger.debug('Using xwininfo for cursor tracking');
      return;
    } catch {}

    this.logger.warn('No cursor tracking tools found, using fallback method');
    this.trackingMethod = 'fallback';
  }

  async getCurrentPosition(): Promise<CursorPosition> {
    try {
      switch (this.trackingMethod) {
        case 'xdotool':
          return await this.getPositionWithXdotool();
        case 'xwininfo':
          return await this.getPositionWithXwininfo();
        default:
          return this.getFallbackPosition();
      }
    } catch (error) {
      this.logger.error('Failed to get cursor position:', error);
      return this.lastPosition;
    }
  }

  private async getPositionWithXdotool(): Promise<CursorPosition> {
    const output = execSync('xdotool getmouselocation --shell', { encoding: 'utf8' });
    const lines = output.trim().split('\n');
    
    let x = 0, y = 0, screenX = 0, screenY = 0;
    
    for (const line of lines) {
      const [key, value] = line.split('=');
      switch (key) {
        case 'X':
          x = parseInt(value, 10);
          break;
        case 'Y':
          y = parseInt(value, 10);
          break;
        case 'SCREEN':
          // Get screen dimensions if available
          try {
            const screenInfo = execSync(`xdpyinfo | grep dimensions`, { encoding: 'utf8' });
            const match = screenInfo.match(/dimensions:\s+(\d+)x(\d+)/);
            if (match) {
              screenX = parseInt(match[1], 10);
              screenY = parseInt(match[2], 10);
            }
          } catch {}
          break;
      }
    }

    const position: CursorPosition = {
      x,
      y,
      screen: screenX && screenY ? {
        width: screenX,
        height: screenY,
        x: 0,
        y: 0
      } : undefined
    };

    this.lastPosition = position;
    return position;
  }

  private async getPositionWithXwininfo(): Promise<CursorPosition> {
    // This is less reliable but works as a fallback
    try {
      const output = execSync('xwininfo -root -tree | grep "Absolute upper-left X" | head -1', { encoding: 'utf8' });
      const match = output.match(/Absolute upper-left X:\s+(\d+)/); 
      
      if (match) {
        // This method is less precise, we'd need to implement mouse tracking differently
        // For now, return center of screen as approximation
        const position: CursorPosition = {
          x: parseInt(match[1], 10) || 960,
          y: 540 // Approximate center
        };
        
        this.lastPosition = position;
        return position;
      }
    } catch (error) {
      this.logger.debug('xwininfo method failed:', error);
    }
    
    return this.getFallbackPosition();
  }

  private getFallbackPosition(): CursorPosition {
    // Fallback: assume center of a 1920x1080 screen
    // In real implementation, this could try to read from /proc or other methods
    const position: CursorPosition = {
      x: 960,
      y: 540,
      screen: {
        width: 1920,
        height: 1080,
        x: 0,
        y: 0
      }
    };
    
    this.lastPosition = position;
    return position;
  }

  getLastKnownPosition(): CursorPosition {
    return this.lastPosition;
  }

  async getScreenInfo(): Promise<{ width: number; height: number } | null> {
    try {
      // Try to get screen resolution
      const output = execSync('xdpyinfo | grep dimensions', { encoding: 'utf8' });
      const match = output.match(/dimensions:\s+(\d+)x(\d+)/);
      
      if (match) {
        return {
          width: parseInt(match[1], 10),
          height: parseInt(match[2], 10)
        };
      }
    } catch (error) {
      this.logger.debug('Failed to get screen info:', error);
    }
    
    return null;
  }

  /**
   * Install required tools for cursor tracking
   */
  static getInstallInstructions(): string {
    return `
To enable precise cursor tracking, install one of these tools:

# Ubuntu/Debian/Pop!_OS:
sudo apt install xdotool

# Or alternatively:
sudo apt install x11-utils

# Fedora:
sudo dnf install xdotool

# Arch Linux:
sudo pacman -S xdotool
`;
  }

  /**
   * Check if cursor tracking is available
   */
  isTrackingAvailable(): boolean {
    return this.trackingMethod !== 'fallback';
  }

  getTrackingMethod(): string {
    return this.trackingMethod;
  }
}