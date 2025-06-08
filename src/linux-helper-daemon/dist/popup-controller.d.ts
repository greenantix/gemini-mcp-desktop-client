import { Logger } from './logger';
export interface PopupMessage {
    type: 'show' | 'hide' | 'update' | 'position';
    data?: any;
}
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
}
/**
 * PopupController manages a separate Electron process for the popup window
 * This keeps the daemon as a pure Node.js service
 */
export declare class PopupController {
    private logger;
    private popupProcess;
    private isRunning;
    private socketClient;
    private popupSocketPath;
    constructor(logger: Logger);
    initialize(): Promise<void>;
    private startPopupProcess;
    private createFallbackPopupScript;
    private connectToPopup;
    private sendMessage;
    showLoadingState(): Promise<void>;
    showLoadingStateAtPosition(cursorPosition: {
        x: number;
        y: number;
    }): Promise<void>;
    showResults(analysis: any): Promise<void>;
    showError(error: string): Promise<void>;
    hide(): Promise<void>;
    cleanup(): Promise<void>;
    isPopupVisible(): boolean;
}
//# sourceMappingURL=popup-controller.d.ts.map