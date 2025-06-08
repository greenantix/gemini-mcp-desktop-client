import { Logger } from './logger';
type HotkeyCallback = () => Promise<void> | void;
export declare class HotkeyManager {
    private hotkey;
    private logger;
    private isRegistered;
    private callback?;
    private hotkeyProcess?;
    private tempScriptPath?;
    constructor(hotkey: string, logger: Logger);
    register(): Promise<void>;
    private hasXbindkeys;
    private registerWithXbindkeys;
    private registerWithPolling;
    private convertHotkeyToXbindkeys;
    onHotkeyPress(callback: HotkeyCallback): void;
    triggerHotkey(): Promise<void>;
    getCurrentHotkey(): string;
    updateHotkey(newHotkey: string): Promise<void>;
    unregister(): Promise<void>;
}
export {};
//# sourceMappingURL=hotkey-manager.d.ts.map