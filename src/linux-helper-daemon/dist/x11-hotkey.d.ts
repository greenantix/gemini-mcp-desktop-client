import { Logger } from './logger';
type HotkeyCallback = () => Promise<void> | void;
export declare class X11HotkeyManager {
    private hotkey;
    private logger;
    private isRunning;
    private monitorProcess?;
    private callback?;
    constructor(hotkey: string, logger: Logger);
    start(): Promise<void>;
    private startMonitoring;
    private getButtonMapping;
    private startMouseMonitoring;
    private startKeyboardMonitoring;
    private triggerCallback;
    onHotkeyPress(callback: HotkeyCallback): void;
    stop(): Promise<void>;
    getCurrentHotkey(): string;
    updateHotkey(newHotkey: string): Promise<void>;
}
export {};
//# sourceMappingURL=x11-hotkey.d.ts.map