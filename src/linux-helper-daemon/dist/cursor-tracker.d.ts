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
export declare class CursorTracker {
    private logger;
    private lastPosition;
    private trackingMethod;
    constructor(logger: Logger);
    private detectTrackingMethod;
    getCurrentPosition(): Promise<CursorPosition>;
    private getPositionWithXdotool;
    private getPositionWithXwininfo;
    private getFallbackPosition;
    getLastKnownPosition(): CursorPosition;
    getScreenInfo(): Promise<{
        width: number;
        height: number;
    } | null>;
    /**
     * Install required tools for cursor tracking
     */
    static getInstallInstructions(): string;
    /**
     * Check if cursor tracking is available
     */
    isTrackingAvailable(): boolean;
    getTrackingMethod(): string;
}
//# sourceMappingURL=cursor-tracker.d.ts.map