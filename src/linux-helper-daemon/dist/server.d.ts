import { Logger } from './logger';
interface MessagePayload {
    command?: string;
    screenshotDataUrl?: string;
    cursorPosition?: {
        x: number;
        y: number;
    };
}
interface ServerResponse {
    output?: string;
    analysis?: {
        summary: string;
        suggestions: Array<{
            title: string;
            command: string;
            description: string;
        }>;
        commands: string[];
    };
    message?: string;
    status?: {
        running: boolean;
        uptime: number;
        pid: number;
    };
}
export interface DaemonMessage {
    type: 'ping' | 'status' | 'capture' | 'execute' | 'shutdown' | 'trigger-hotkey' | 'get-analysis';
    payload?: MessagePayload;
}
export interface DaemonResponse {
    success: boolean;
    data?: ServerResponse;
    error?: string;
}
export declare class DaemonServer {
    private port;
    private socketPath;
    private logger;
    private httpServer?;
    private socketServer?;
    private isRunning;
    private hotkeyCallback?;
    private aiAnalyzer;
    private handleScreenshotAnalysis;
    constructor(port: number, socketPath: string, logger: Logger);
    setHotkeyCallback(callback: () => Promise<void>): void;
    start(): Promise<void>;
    private startHttpServer;
    private startSocketServer;
    private handleMessage;
    stop(): Promise<void>;
}
export {};
//# sourceMappingURL=server.d.ts.map