#!/usr/bin/env node
declare class LinuxHelperDaemon {
    private config;
    private screenshotManager;
    private cursorTracker;
    private logger;
    private isRunning;
    private socketClient?;
    private hotkeyProcess?;
    constructor();
    private loadConfig;
    private setupEventHandlers;
    private setupMouseButtonMonitoring;
    private getButtonMapping;
    private startMouseMonitoring;
    private connectToMainProcess;
    private sendToMainProcess;
    start(): Promise<void>;
    shutdown(): Promise<void>;
    getStatus(): object;
    updateHotkey(newHotkey: string): void;
}
export { LinuxHelperDaemon };
//# sourceMappingURL=main.d.ts.map