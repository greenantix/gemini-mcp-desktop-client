import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from './logger';

export interface ScreenshotResult {
  dataUrl: string;
  filename: string;
  filepath: string;
  size: number;
  timestamp: Date;
}

export class ScreenshotManager {
  private screenshotDir: string;

  constructor(private logger: Logger) {
    this.screenshotDir = this.ensureScreenshotDirectory();
  }

  private ensureScreenshotDirectory(): string {
    const homeDir = os.homedir();
    const screenshotDir = path.join(homeDir, 'Pictures', 'linux-helper-screenshots');
    
    try {
      if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
        this.logger.info(`Created screenshot directory: ${screenshotDir}`);
      }
      return screenshotDir;
    } catch (error) {
      this.logger.error('Failed to create screenshot directory:', error);
      // Fallback to temp directory
      return os.tmpdir();
    }
  }

  async captureActiveMonitor(): Promise<ScreenshotResult | null> {
    try {
      // Check which screenshot tools are available
      const tool = this.detectScreenshotTool();
      
      if (!tool) {
        throw new Error('No suitable screenshot tool found');
      }

      const timestamp = new Date();
      const filename = `linux-helper-${timestamp.toISOString().replace(/[:.]/g, '-')}.png`;
      const filepath = path.join(this.screenshotDir, filename);

      // Capture screenshot using the detected tool
      await this.captureWithTool(tool, filepath);

      // Convert to base64 data URL
      const buffer = fs.readFileSync(filepath);
      const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;

      this.logger.info(`Screenshot captured: ${filepath}`);

      return {
        dataUrl,
        filename,
        filepath,
        size: buffer.length,
        timestamp
      };
    } catch (error) {
      this.logger.error('Failed to capture screenshot:', error);
      return null;
    }
  }

  private detectScreenshotTool(): string | null {
    const tools = ['gnome-screenshot', 'import', 'scrot', 'xwd'];
    
    for (const tool of tools) {
      try {
        execSync(`which ${tool}`, { stdio: 'ignore' });
        this.logger.debug(`Found screenshot tool: ${tool}`);
        return tool;
      } catch {
        // Tool not available, try next
      }
    }
    
    return null;
  }

  private async captureWithTool(tool: string, filepath: string): Promise<void> {
    let command: string;
    
    // Try to detect active monitor for multi-monitor setups
    const activeMonitor = this.getActiveMonitorInfo();
    
    switch (tool) {
      case 'gnome-screenshot':
        // GNOME Screenshot - use window selection to avoid multi-monitor capture
        if (activeMonitor) {
          // Use area selection with specific coordinates for active monitor
          command = `gnome-screenshot -a -f "${filepath}" && sleep 0.1`;
          // Unfortunately gnome-screenshot -a requires user interaction
          // Fall back to full desktop for now, but crop afterwards if needed
        }
        command = `gnome-screenshot -f "${filepath}"`;
        break;
        
      case 'import':
        // ImageMagick import - can specify display coordinates
        if (activeMonitor) {
          const { x, y, width, height } = activeMonitor;
          command = `import -window root -crop ${width}x${height}+${x}+${y} "${filepath}"`;
        } else {
          command = `import -window root "${filepath}"`;
        }
        break;
        
      case 'scrot':
        // Scrot - can use area selection
        if (activeMonitor) {
          const { x, y, width, height } = activeMonitor;
          command = `scrot -a ${x},${y},${width},${height} "${filepath}"`;
        } else {
          command = `scrot "${filepath}"`;
        }
        break;
        
      case 'xwd':
        // X Window Dump (convert to PNG afterwards)
        const xwdFile = filepath.replace('.png', '.xwd');
        if (activeMonitor) {
          const { x, y, width, height } = activeMonitor;
          command = `xwd -root -out "${xwdFile}" && convert "${xwdFile}" -crop ${width}x${height}+${x}+${y} "${filepath}" && rm "${xwdFile}"`;
        } else {
          command = `xwd -root -out "${xwdFile}" && convert "${xwdFile}" "${filepath}" && rm "${xwdFile}"`;
        }
        break;
        
      default:
        throw new Error(`Unsupported screenshot tool: ${tool}`);
    }

    try {
      execSync(command, { 
        timeout: 10000, // 10 second timeout
        stdio: 'pipe' 
      });
    } catch (error) {
      throw new Error(`Screenshot command failed: ${command}`);
    }

    // Verify the file was created
    if (!fs.existsSync(filepath)) {
      throw new Error('Screenshot file was not created');
    }
  }

  async captureRegion(x: number, y: number, width: number, height: number): Promise<ScreenshotResult | null> {
    try {
      const tool = this.detectScreenshotTool();
      
      if (!tool) {
        throw new Error('No suitable screenshot tool found');
      }

      const timestamp = new Date();
      const filename = `linux-helper-region-${timestamp.toISOString().replace(/[:.]/g, '-')}.png`;
      const filepath = path.join(this.screenshotDir, filename);

      let command: string;
      
      switch (tool) {
        case 'gnome-screenshot':
          command = `gnome-screenshot -a -f "${filepath}"`; // Area selection
          break;
          
        case 'import':
          command = `import -window root -crop ${width}x${height}+${x}+${y} "${filepath}"`;
          break;
          
        case 'scrot':
          command = `scrot -a ${x},${y},${width},${height} "${filepath}"`;
          break;
          
        default:
          // Fallback to full screen capture
          return this.captureActiveMonitor();
      }

      execSync(command, { timeout: 10000, stdio: 'pipe' });

      const buffer = fs.readFileSync(filepath);
      const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;

      this.logger.info(`Region screenshot captured: ${filepath}`);

      return {
        dataUrl,
        filename,
        filepath,
        size: buffer.length,
        timestamp
      };
    } catch (error) {
      this.logger.error('Failed to capture region screenshot:', error);
      return null;
    }
  }

  private getActiveMonitorInfo(): { x: number; y: number; width: number; height: number } | null {
    try {
      // Use xrandr to get monitor information
      const xrandrOutput = execSync('xrandr --query', { encoding: 'utf8' });
      const cursorOutput = execSync('xdotool getmouselocation --shell', { encoding: 'utf8' });
      
      // Parse cursor position
      const cursorMatch = cursorOutput.match(/X=(\d+)\nY=(\d+)/);
      if (!cursorMatch) {
        this.logger.warn('Could not detect cursor position');
        return null;
      }
      
      const cursorX = parseInt(cursorMatch[1]);
      const cursorY = parseInt(cursorMatch[2]);
      
      // Parse xrandr output to find monitor containing cursor
      const lines = xrandrOutput.split('\n');
      for (const line of lines) {
        // Look for connected displays with resolution and position
        const match = line.match(/^(\S+)\s+connected\s+(?:primary\s+)?(\d+)x(\d+)\+(\d+)\+(\d+)/);
        if (match) {
          const [, displayName, width, height, x, y] = match;
          const monitorX = parseInt(x);
          const monitorY = parseInt(y);
          const monitorWidth = parseInt(width);
          const monitorHeight = parseInt(height);
          
          // Check if cursor is within this monitor's bounds
          if (cursorX >= monitorX && cursorX < monitorX + monitorWidth &&
              cursorY >= monitorY && cursorY < monitorY + monitorHeight) {
            this.logger.debug(`Active monitor detected: ${displayName} (${monitorWidth}x${monitorHeight}+${monitorX}+${monitorY})`);
            return {
              x: monitorX,
              y: monitorY,
              width: monitorWidth,
              height: monitorHeight
            };
          }
        }
      }
      
      this.logger.warn('Could not determine active monitor, falling back to full desktop');
      return null;
    } catch (error) {
      this.logger.error('Error detecting active monitor:', error);
      return null;
    }
  }

  getScreenshotDirectory(): string {
    return this.screenshotDir;
  }

  async cleanupOldScreenshots(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const files = fs.readdirSync(this.screenshotDir);
      const now = Date.now();
      let cleaned = 0;

      for (const file of files) {
        if (file.startsWith('linux-helper-') && file.endsWith('.png')) {
          const filePath = path.join(this.screenshotDir, file);
          const stats = fs.statSync(filePath);
          
          if (now - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filePath);
            cleaned++;
          }
        }
      }

      if (cleaned > 0) {
        this.logger.info(`Cleaned up ${cleaned} old screenshots`);
      }
    } catch (error) {
      this.logger.error('Failed to cleanup old screenshots:', error);
    }
  }
}