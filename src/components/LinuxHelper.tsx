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
            let chatMessage = `🖼️ **Linux Helper Screenshot Analysis**\n\n${result.analysis}`;
            
            if (extractedCommands.length > 0) {
              chatMessage += `\n\n🎯 **Commands Detected**: ${extractedCommands.length} command(s) ready`;
              chatMessage += `\n💡 **Press F10 again** to copy the first command to clipboard`;
              
              // Show all detected commands for debugging
              chatMessage += `\n\n📝 **Commands found**:`;
              extractedCommands.forEach((cmd, i) => {
                const command = cmd.command || cmd;
                const comment = cmd.comment || 'Run command';
                chatMessage += `\n${i + 1}. \`${command}\` - ${comment}`;
              });
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
              `📋 **Command copied to clipboard**:\n` +
              `\`${commandToPaste}\`\n\n` +
              `💬 **Purpose**: ${commandComment}\n` +
              `💡 **Press Ctrl+V** to paste at your cursor location`
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
    
    // Extract from bash code blocks with comments
    const codeBlockRegex = /```bash\n(.*?)\n```/gs;
    let match;
    
    while ((match = codeBlockRegex.exec(markdown)) !== null) {
      const blockContent = match[1].trim();
      const lines = blockContent.split('\n');
      
      let currentComment = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('#')) {
          // This is a comment
          currentComment = trimmed.substring(1).trim();
        } else if (trimmed && !trimmed.startsWith('#')) {
          // This is a command
          commands.push({
            command: trimmed,
            comment: currentComment || 'Run command'
          });
          currentComment = ''; // Reset comment for next command
        }
      }
    }
    
    // Fallback: Extract any commands from other code blocks
    if (commands.length === 0) {
      const fallbackRegex = /```(?:bash|shell|sh)?\n(.*?)\n```/gs;
      while ((match = fallbackRegex.exec(markdown)) !== null) {
        const commandBlock = match[1].trim();
        const blockCommands = commandBlock.split('\n').filter(cmd => 
          cmd.trim() && !cmd.trim().startsWith('#')
        );
        blockCommands.forEach(cmd => {
          commands.push({
            command: cmd.trim(),
            comment: 'Run command'
          });
        });
      }
    }
    
    // Extract inline commands (lines starting with $)
    const lines = markdown.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('$ ')) {
        commands.push({
          command: trimmed.substring(2),
          comment: 'Run command'
        });
      }
    }
    
    return commands;
  };

  // No UI - this component runs in background only
  return null;
};

export default LinuxHelper;