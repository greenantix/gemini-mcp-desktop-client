import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
  private logFile: string;
  private logLevels: { [key in LogLevel]: number } = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor(
    private level: LogLevel = 'info',
    private writeToFile: boolean = true
  ) {
    this.logFile = path.join(os.homedir(), '.config', 'linux-helper', 'daemon.log');
    this.ensureLogDirectory();
  }

  private ensureLogDirectory(): void {
    const logDir = path.dirname(this.logFile);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return this.logLevels[level] >= this.logLevels[this.level];
  }

  private formatMessage(level: LogLevel, message: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.length > 0 ? ' ' + args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ') : '';
    
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}`;
  }

  private writeLog(level: LogLevel, message: string, ...args: any[]): void {
    const formattedMessage = this.formatMessage(level, message, ...args);
    
    // Always log to console
    switch (level) {
      case 'debug':
        console.debug(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
    }

    // Write to file if enabled
    if (this.writeToFile) {
      try {
        fs.appendFileSync(this.logFile, formattedMessage + '\n', 'utf8');
      } catch (error) {
        console.error('Failed to write to log file:', error);
      }
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      this.writeLog('debug', message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      this.writeLog('info', message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      this.writeLog('warn', message, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      this.writeLog('error', message, ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
    this.info(`Log level changed to: ${level}`);
  }

  getLogFile(): string {
    return this.logFile;
  }

  async rotateLog(maxSize: number = 10 * 1024 * 1024): Promise<void> {
    try {
      if (!fs.existsSync(this.logFile)) {
        return;
      }

      const stats = fs.statSync(this.logFile);
      if (stats.size > maxSize) {
        const rotatedFile = this.logFile + '.old';
        
        // Remove old rotated file if it exists
        if (fs.existsSync(rotatedFile)) {
          fs.unlinkSync(rotatedFile);
        }
        
        // Rename current log to .old
        fs.renameSync(this.logFile, rotatedFile);
        
        this.info('Log file rotated');
      }
    } catch (error) {
      this.error('Failed to rotate log file:', error);
    }
  }
}