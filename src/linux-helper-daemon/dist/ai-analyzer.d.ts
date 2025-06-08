import { Logger } from './logger';
export interface AnalysisResult {
    summary: string;
    suggestions: Array<{
        title: string;
        command: string;
        description: string;
    }>;
    commands: string[];
    context?: any;
}
export declare class AIAnalyzer {
    private logger;
    private apiKey?;
    constructor(logger: Logger, apiKey?: string);
    analyzeScreenshot(screenshotDataUrl: string, settings?: {
        linuxDistro?: string;
        showSystemContext?: boolean;
    }): Promise<AnalysisResult>;
    private analyzeScreenshotWithGemini;
    private getSystemContext;
    private createPersonalAssistantPrompt;
    private parseCommandsFromResponse;
    private extractSuggestions;
    private extractSummary;
    setApiKey(apiKey: string): void;
    getApiKey(): string | undefined;
}
//# sourceMappingURL=ai-analyzer.d.ts.map