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
    
    switch (tool) {
      case 'gnome-screenshot':
        // GNOME Screenshot (most common on Ubuntu/Pop!_OS)
        command = `gnome-screenshot -f "${filepath}"`;
        break;
        
      case 'import':
        // ImageMagick import (part of ImageMagick suite)
        command = `import -window root "${filepath}"`;
        break;
        
      case 'scrot':
        // Scrot (lightweight screenshot utility)
        command = `scrot "${filepath}"`;
        break;
        
      case 'xwd':
        // X Window Dump (convert to PNG afterwards)
        const xwdFile = filepath.replace('.png', '.xwd');
        command = `xwd -root -out "${xwdFile}" && convert "${xwdFile}" "${filepath}" && rm "${xwdFile}"`;
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