import { Logger } from './logger';
export interface DaemonMessage {
    type: 'ping' | 'status' | 'capture' | 'execute' | 'shutdown' | 'trigger-hotkey' | 'get-analysis';
    payload?: any;
}
export interface DaemonResponse {
    success: boolean;
    data?: any;
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
    constructor(port: number, socketPath: string, logger: Logger);
    setHotkeyCallback(callback: () => Promise<void>): void;
    start(): Promise<void>;
    private startHttpServer;
    private startSocketServer;
    private handleMessage;
    stop(): Promise<void>;
}
//# sourceMappingURL=server.d.ts.map