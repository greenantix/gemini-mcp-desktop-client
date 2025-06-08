import { Logger } from './logger';

// Import the existing Linux Helper functionality
// We'll need to adapt this to work outside of the Electron context
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

export class AIAnalyzer {
  private logger: Logger;
  private apiKey?: string;

  constructor(logger: Logger, apiKey?: string) {
    this.logger = logger;
    this.apiKey = apiKey || process.env.GEMINI_API_KEY;
  }

  async analyzeScreenshot(screenshotDataUrl: string, settings?: {
    linuxDistro?: string;
    showSystemContext?: boolean;
  }): Promise<AnalysisResult> {
    try {
      // Import the existing Linux Helper functionality
      const { analyzeScreenshotWithLinuxHelper, parseCommandsFromResponse } = await this.importLinuxHelper();
      
      this.logger.info('Starting AI analysis of screenshot');
      
      // Use the existing analysis function
      const analysisText = await analyzeScreenshotWithLinuxHelper(screenshotDataUrl, settings);
      
      // Parse commands from the response
      const commands = parseCommandsFromResponse(analysisText);
      
      // Extract suggestions from the analysis
      const suggestions = this.extractSuggestions(analysisText, commands);
      
      // Extract summary
      const summary = this.extractSummary(analysisText);
      
      this.logger.info(`Analysis complete: ${commands.length} commands found`);
      
      return {
        summary,
        suggestions,
        commands,
        context: { analysisText }
      };
    } catch (error) {
      this.logger.error('Failed to analyze screenshot:', error);
      throw error;
    }
  }

  private async importLinuxHelper() {
    // For Phase 1, we'll use a standalone version to avoid Electron dependencies
    // Later phases will implement proper communication with the main app
    this.logger.info('Using standalone AI analyzer (Phase 1 implementation)');
    return this.createStandaloneAnalyzer();
  }

  private createStandaloneAnalyzer() {
    // Simplified version of the analysis functionality
    return {
      analyzeScreenshotWithLinuxHelper: async (screenshotDataUrl: string, settings?: any) => {
        // This would be a simplified version that doesn't depend on Electron
        // For now, return a placeholder
        return "Analysis: The screenshot shows development work. Consider running tests and checking for errors.";
      },
      parseCommandsFromResponse: (response: string) => {
        // Simple command extraction
        const commands: string[] = [];
        const codeBlockRegex = /```(?:bash|shell|sh)?\n(.*?)\n```/gs;
        let match;
        
        while ((match = codeBlockRegex.exec(response)) !== null) {
          const commandBlock = match[1].trim();
          const blockCommands = commandBlock.split('\n').filter(cmd => 
            cmd.trim() && !cmd.trim().startsWith('#')
          );
          commands.push(...blockCommands);
        }
        
        return commands;
      }
    };
  }

  private extractSuggestions(analysisText: string, commands: string[]): Array<{
    title: string;
    command: string;
    description: string;
  }> {
    const suggestions: Array<{ title: string; command: string; description: string; }> = [];
    
    // Try to extract structured suggestions from the analysis
    commands.forEach((command, index) => {
      let title = `Solution ${index + 1}`;
      let description = 'Execute this command';
      
      // Try to extract context around the command
      const commandIndex = analysisText.indexOf(command);
      if (commandIndex > -1) {
        // Look for context before the command
        const beforeCommand = analysisText.substring(Math.max(0, commandIndex - 200), commandIndex);
        const afterCommand = analysisText.substring(commandIndex + command.length, commandIndex + command.length + 200);
        
        // Try to find a title or description
        const titleMatch = beforeCommand.match(/##\s*(.+)$/m) || beforeCommand.match(/\*\*(.+)\*\*/);
        if (titleMatch) {
          title = titleMatch[1].trim();
        }
        
        // Try to find a description
        const descMatch = afterCommand.match(/^[\s\S]*?(?=\n\n|$)/);
        if (descMatch) {
          description = descMatch[0].trim().substring(0, 100) + '...';
        }
      }
      
      // Generate smart titles based on command content
      if (command.includes('npm run lint')) {
        title = 'Fix Linting Issues';
        description = 'Run linter to fix code style issues';
      } else if (command.includes('npm test')) {
        title = 'Run Tests';
        description = 'Execute test suite to verify functionality';
      } else if (command.includes('git')) {
        title = 'Git Operation';
        description = 'Perform git version control operation';
      } else if (command.includes('npm install')) {
        title = 'Install Dependencies';
        description = 'Install missing packages';
      }
      
      suggestions.push({ title, command, description });
    });
    
    return suggestions;
  }

  private extractSummary(analysisText: string): string {
    // Try to extract the first meaningful section as summary
    const lines = analysisText.split('\n');
    let summary = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('*') && !trimmed.startsWith('-')) {
        summary = trimmed;
        break;
      }
    }
    
    // If no good summary found, create one from context
    if (!summary) {
      if (analysisText.includes('error')) {
        summary = 'Detected errors that need attention';
      } else if (analysisText.includes('test')) {
        summary = 'Testing-related task identified';
      } else if (analysisText.includes('lint')) {
        summary = 'Code quality issues found';
      } else {
        summary = 'Analysis complete - review suggestions below';
      }
    }
    
    return summary.length > 100 ? summary.substring(0, 100) + '...' : summary;
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  getApiKey(): string | undefined {
    return this.apiKey;
  }
}