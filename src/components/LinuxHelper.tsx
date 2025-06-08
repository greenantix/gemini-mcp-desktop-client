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
            
            // Debug: Log extracted commands
            console.log('🐧 Extracted commands:', extractedCommands);
            
            // Create enhanced message with commands summary  
            let chatMessage = `💻 **Personal Coding Assistant Analysis**\n\n${result.analysis}`;
            
            if (extractedCommands.length > 0) {
              const firstCommand = extractedCommands[0];
              const command = firstCommand.command || firstCommand;
              const comment = firstCommand.comment || 'Execute solution';
              
              chatMessage += `\n\n🎯 **Smart Solution Ready**`;
              chatMessage += `\n💡 **Press F10 again** to copy project-specific command`;
              chatMessage += `\n\n⚡ **Command**: \`${command}\``;
              chatMessage += `\n🧠 **Context**: ${comment}`;
            }
            
            // Send to chat with actual screenshot metadata
            onSendToChat(
              chatMessage,
              data.screenshot,
              { 
                filename: data.filename || 'screenshot.png', 
                size: data.size || 0 
              }
            );
            
            setHelperState(extractedCommands.length > 0 ? 'ready-to-execute' : 'idle');
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
        // Get the first command
        const firstCommand = lastCommands[0];
        const commandToPaste = firstCommand.command || firstCommand;
        const commandComment = firstCommand.comment || 'Run command';
        
        try {
          // Copy command to clipboard for user to paste
          const result = await (window as any).api.pasteAtCursor(commandToPaste);
          
          if (result.success) {
            // Send confirmation to chat with comment
            onSendToChat(
              `📋 **Command Chain Copied to Clipboard**:\n` +
              `\`${commandToPaste}\`\n\n` +
              `💬 **Purpose**: ${commandComment}\n` +
              `💡 **Press Ctrl+V** to paste and execute this complete solution`
            );
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

  const extractCommandsFromMarkdown = (markdown: string): Array<{command: string, comment: string}> => {
    const commands: Array<{command: string, comment: string}> = [];
    
    // Extract from bash code blocks - looking for ONE command chain
    const codeBlockRegex = /```bash\n(.*?)\n```/gs;
    let match;
    
    while ((match = codeBlockRegex.exec(markdown)) !== null) {
      const blockContent = match[1].trim();
      const lines = blockContent.split('\n');
      
      let comment = '';
      let commandChain = '';
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
          // Extract comment
          comment = trimmed.substring(1).trim();
        } else if (trimmed && !trimmed.startsWith('#')) {
          // This is the command chain
          commandChain = trimmed;
          break; // Take the first non-comment line as the command chain
        }
      }
      
      if (commandChain) {
        commands.push({
          command: commandChain,
          comment: comment || 'Execute command chain'
        });
        break; // Only take the first command chain
      }
    }
    
    // Fallback: Extract any commands from other code blocks (old format)
    if (commands.length === 0) {
      const fallbackRegex = /```(?:bash|shell|sh)?\n(.*?)\n```/gs;
      while ((match = fallbackRegex.exec(markdown)) !== null) {
        const commandBlock = match[1].trim();
        const blockCommands = commandBlock.split('\n').filter(cmd => 
          cmd.trim() && !cmd.trim().startsWith('#')
        );
        if (blockCommands.length > 0) {
          // Join multiple commands with &&
          const chainedCommand = blockCommands.join(' && ');
          commands.push({
            command: chainedCommand,
            comment: 'Execute command sequence'
          });
          break; // Only take the first block
        }
      }
    }
    
    return commands;
  };

  // No UI - this component runs in background only
  return null;
};

export default LinuxHelper;