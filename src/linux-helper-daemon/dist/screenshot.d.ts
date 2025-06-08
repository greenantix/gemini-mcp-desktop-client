import { Logger } from './logger';
export interface ScreenshotResult {
    dataUrl: string;
    filename: string;
    filepath: string;
    size: number;
    timestamp: Date;
}
export declare class ScreenshotManager {
    private logger;
    private screenshotDir;
    constructor(logger: Logger);
    private ensureScreenshotDirectory;
    captureActiveMonitor(): Promise<ScreenshotResult | null>;
    private detectScreenshotTool;
    private captureWithTool;
    captureRegion(x: number, y: number, width: number, height: number): Promise<ScreenshotResult | null>;
    getScreenshotDirectory(): string;
    cleanupOldScreenshots(maxAge?: number): Promise<void>;
}
//# sourceMappingURL=screenshot.d.ts.map