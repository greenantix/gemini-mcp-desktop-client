import { Logger } from './logger';
export interface PopupState {
    status: 'loading' | 'success' | 'error' | 'idle';
    title?: string;
    content?: string;
    suggestions?: Array<{
        title: string;
        command: string;
        description: string;
    }>;
    error?: string;
    executeFirst?: boolean;
}
type CommandCallback = (command: string) => void;
export declare class PopupManager {
    private theme;
    private logger;
    private window;
    private isVisible;
    private commandCallback?;
    private currentState;
    constructor(theme: 'dark' | 'light' | 'auto', logger: Logger);
    initialize(): Promise<void>;
    private createPopupWindow;
    private generatePopupHtml;
    showLoadingState(): Promise<void>;
    showResults(analysis: any): Promise<void>;
    showError(error: string): Promise<void>;
    private updateWindowContent;
    updateState(state: PopupState): void;
    hide(): void;
    show(position?: {
        x: number;
        y: number;
    }): void;
    isPopupVisible(): boolean;
    onCommand(callback: CommandCallback): void;
    cleanup(): Promise<void>;
}
export {};
//# sourceMappingURL=popup-window.d.ts.map