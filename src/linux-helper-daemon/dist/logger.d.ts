export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export declare class Logger {
    private level;
    private writeToFile;
    private logFile;
    private logLevels;
    constructor(level?: LogLevel, writeToFile?: boolean);
    private ensureLogDirectory;
    private shouldLog;
    private formatMessage;
    private writeLog;
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
    setLevel(level: LogLevel): void;
    getLogFile(): string;
    rotateLog(maxSize?: number): Promise<void>;
}
//# sourceMappingURL=logger.d.ts.map