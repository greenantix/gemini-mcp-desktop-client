import { useEffect, useState } from 'react';

interface LinuxHelperProps {
  onSendToChat: (message: string, screenshot?: string, screenshotMeta?: {filename: string, size: number}) => void;
}

interface CommandResult {
  success: boolean;
  stdout?: string;
  stderr?: string;
  error?: string;
  requiresConfirmation?: boolean;
  command?: string;
}

interface AnalysisResult {
  success: boolean;
  analysis?: string;
  error?: string;
}

const LinuxHelper: React.FC<LinuxHelperProps> = ({ onSendToChat }) => {
  const [lastAnalysis, setLastAnalysis] = useState<string>("");
  const [lastCommands, setLastCommands] = useState<string[]>([]);
  const [helperState, setHelperState] = useState<'idle' | 'ready-to-execute'>('idle');

  useEffect(() => {
    // Setup Linux Helper event listeners
    const handleScreenshot = async (data: { screenshot: string; action: string; filename?: string; size?: number; filepath?: string }) => {
      if (data.action === 'analyze') {
        try {
          // Send to main process for analysis
          const result: AnalysisResult = await (window as any).api.analyzeScreenshot(data.screenshot);
          
          if (result.success && result.analysis) {
            setLastAnalysis(result.analysis);
            
            // Extract commands from the analysis
            const extractedCommands = extractCommandsFromMarkdown(result.analysis);
            setLastCommands(extractedCommands);
            
            // Send to chat with actual screenshot metadata
            onSendToChat(
              `🖼️ **Linux Helper Screenshot Analysis**\n\n${result.analysis}`,
              data.screenshot,
              { 
                filename: data.filename || 'screenshot.png', 
                size: data.size || 0 
              }
            );
            
            setHelperState('ready-to-execute');
          } else {
            onSendToChat(`❌ **Linux Helper Error**: ${result.error || "Failed to analyze"}`);
          }
        } catch (error) {
          onSendToChat(`❌ **Linux Helper Error**: ${error}`);
        }
      }
    };

    const handleExecute = async () => {
      if (lastCommands.length > 0 && helperState === 'ready-to-execute') {
        // Get the first safe command
        const commandToPaste = lastCommands[0];
        
        try {
          // Copy command to clipboard for user to paste
          const result = await (window as any).api.pasteAtCursor(commandToPaste);
          
          if (result.success) {
            // Send confirmation to chat
            onSendToChat(`📋 **Command copied to clipboard**: \`${commandToPaste}\`\n\n💡 **Press Ctrl+V** to paste at your cursor location`);
          } else {
            onSendToChat(`❌ **Failed to copy command**: ${result.error}`);
          }
          
          // Reset state
          setHelperState('idle');
          setLastCommands([]);
        } catch (error) {
          onSendToChat(`❌ **Failed to copy command**: ${error}`);
        }
      }
    };

    const handleDismissed = () => {
      setHelperState('idle');
      setLastCommands([]);
    };

    // Register event listeners
    (window as any).api.onLinuxHelperScreenshot(handleScreenshot);
    (window as any).api.onLinuxHelperExecute(handleExecute);
    (window as any).api.onLinuxHelperDismissed(handleDismissed);

    return () => {
      (window as any).api.removeLinuxHelperListeners();
    };
  }, [onSendToChat]);

  const extractCommandsFromMarkdown = (markdown: string): string[] => {
    const commands: string[] = [];
    
    // Extract from code blocks
    const codeBlockRegex = /```(?:bash|shell|sh)?\n(.*?)\n```/gs;
    let match;
    
    while ((match = codeBlockRegex.exec(markdown)) !== null) {
      const commandBlock = match[1].trim();
      const blockCommands = commandBlock.split('\n').filter(cmd => 
        cmd.trim() && !cmd.trim().startsWith('#')
      );
      commands.push(...blockCommands);
    }
    
    // Extract inline commands (lines starting with $)
    const lines = markdown.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('$ ')) {
        commands.push(trimmed.substring(2));
      }
    }
    
    return [...new Set(commands)]; // Remove duplicates
  };

  // No UI - this component runs in background only
  return null;
};

export default LinuxHelper;