#!/usr/bin/env node
declare class LinuxHelperDaemon {
    private config;
    private hotkeyManager;
    private screenshotManager;
    private popupController;
    private server;
    private cursorTracker;
    private logger;
    private isRunning;
    constructor();
    private loadConfig;
    private setupEventHandlers;
    private analyzeScreenshot;
    start(): Promise<void>;
    shutdown(): Promise<void>;
    getStatus(): object;
}
export { LinuxHelperDaemon };
//# sourceMappingURL=main.d.ts.map