import React, { useEffect, useState } from 'react';
import { 
  Box, 
  Paper, 
  Typography, 
  Button, 
  Alert, 
  Chip,
  CircularProgress,
  Stack,
  Divider
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

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
  const [isVisible, setIsVisible] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string>("");
  const [commands, setCommands] = useState<string[]>([]);
  const [executingCommand, setExecutingCommand] = useState<string | null>(null);
  const [commandResults, setCommandResults] = useState<{[key: string]: CommandResult}>({});
  const [currentScreenshot, setCurrentScreenshot] = useState<string>("");
  const [helperState, setHelperState] = useState<'idle' | 'analyzing' | 'ready-to-execute'>('idle');

  useEffect(() => {
    // Setup Linux Helper event listeners
    const handleScreenshot = async (data: { screenshot: string; action: string; filename?: string; size?: number; filepath?: string }) => {
      if (data.action === 'analyze') {
        setCurrentScreenshot(data.screenshot);
        setIsVisible(true);
        setIsAnalyzing(true);
        setHelperState('analyzing');
        
        try {
          // Send to main process for analysis
          const result: AnalysisResult = await (window as any).api.analyzeScreenshot(data.screenshot);
          
          if (result.success && result.analysis) {
            setAnalysis(result.analysis);
            
            // Extract commands from the analysis
            const extractedCommands = extractCommandsFromMarkdown(result.analysis);
            setCommands(extractedCommands);
            
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
            setAnalysis(result.error || "Failed to analyze screenshot");
            onSendToChat(`❌ **Linux Helper Error**: ${result.error || "Failed to analyze"}`);
          }
        } catch (error) {
          setAnalysis(`Error: ${error}`);
          onSendToChat(`❌ **Linux Helper Error**: ${error}`);
        } finally {
          setIsAnalyzing(false);
        }
      }
    };

    const handleExecute = async () => {
      if (commands.length > 0) {
        // Execute all safe commands
        for (const command of commands) {
          await executeCommand(command);
        }
      }
    };

    const handleDismissed = () => {
      setIsVisible(false);
      setHelperState('idle');
      resetState();
    };

    // Register event listeners
    (window as any).api.onLinuxHelperScreenshot(handleScreenshot);
    (window as any).api.onLinuxHelperExecute(handleExecute);
    (window as any).api.onLinuxHelperDismissed(handleDismissed);

    return () => {
      (window as any).api.removeLinuxHelperListeners();
    };
  }, [commands, onSendToChat]);

  const resetState = () => {
    setAnalysis("");
    setCommands([]);
    setCommandResults({});
    setCurrentScreenshot("");
    setExecutingCommand(null);
  };

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

  const executeCommand = async (command: string) => {
    setExecutingCommand(command);
    
    try {
      const result: CommandResult = await (window as any).api.executeCommand(command);
      setCommandResults(prev => ({ ...prev, [command]: result }));
      
      // Send result to chat
      if (result.success) {
        onSendToChat(
          `✅ **Command Executed**: \`${command}\`\n\n` +
          (result.stdout ? `**Output:**\n\`\`\`\n${result.stdout}\`\`\`` : "") +
          (result.stderr ? `\n**Warnings:**\n\`\`\`\n${result.stderr}\`\`\`` : "")
        );
      } else if (result.requiresConfirmation) {
        onSendToChat(
          `⚠️ **Dangerous Command Blocked**: \`${command}\`\n\n` +
          `This command was blocked for safety reasons. Please review and execute manually if needed.`
        );
      } else {
        onSendToChat(
          `❌ **Command Failed**: \`${command}\`\n\n` +
          `**Error:** ${result.error}`
        );
      }
    } catch (error) {
      onSendToChat(`❌ **Execution Error**: ${error}`);
    } finally {
      setExecutingCommand(null);
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 1000,
          maxWidth: 400,
        }}
      >
        <Paper
          elevation={8}
          sx={{
            p: 3,
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: 3,
          }}
        >
          <Stack spacing={2}>
            <Box display="flex" alignItems="center" justifyContent="space-between">
              <Typography variant="h6" fontWeight="bold">
                🐧 Linux Helper
              </Typography>
              <Chip
                label={
                  helperState === 'analyzing' ? 'Analyzing...' :
                  helperState === 'ready-to-execute' ? 'Ready to Execute' :
                  'Idle'
                }
                color={
                  helperState === 'analyzing' ? 'warning' :
                  helperState === 'ready-to-execute' ? 'success' :
                  'default'
                }
                size="small"
              />
            </Box>

            {isAnalyzing && (
              <Box display="flex" alignItems="center" gap={2}>
                <CircularProgress size={20} sx={{ color: 'white' }} />
                <Typography variant="body2">
                  Analyzing screenshot with Gemini...
                </Typography>
              </Box>
            )}

            {analysis && !isAnalyzing && (
              <Box>
                <Typography variant="body2" sx={{ mb: 1, opacity: 0.9 }}>
                  Screenshot analyzed! Check chat for details.
                </Typography>
                
                {commands.length > 0 && (
                  <Box>
                    <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.3)' }} />
                    <Typography variant="body2" fontWeight="bold" gutterBottom>
                      Commands found ({commands.length}):
                    </Typography>
                    
                    <Stack spacing={1}>
                      {commands.map((command, index) => (
                        <Box key={index} display="flex" alignItems="center" gap={1}>
                          <Button
                            size="small"
                            variant="contained"
                            color="secondary"
                            startIcon={
                              executingCommand === command ? (
                                <CircularProgress size={16} color="inherit" />
                              ) : commandResults[command]?.success ? (
                                <CheckCircleIcon />
                              ) : commandResults[command]?.success === false ? (
                                <ErrorIcon />
                              ) : (
                                <PlayArrowIcon />
                              )
                            }
                            onClick={() => executeCommand(command)}
                            disabled={!!executingCommand}
                            sx={{ minWidth: 'auto' }}
                          >
                            Run
                          </Button>
                          
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: 'monospace',
                              backgroundColor: 'rgba(0,0,0,0.2)',
                              px: 1,
                              py: 0.5,
                              borderRadius: 1,
                              flex: 1,
                              fontSize: '0.75rem'
                            }}
                          >
                            {command.length > 30 ? `${command.substring(0, 30)}...` : command}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Box>
                )}
              </Box>
            )}

            <Box display="flex" gap={1} justifyContent="flex-end">
              <Button
                size="small"
                variant="outlined"
                onClick={() => setIsVisible(false)}
                sx={{ color: 'white', borderColor: 'white' }}
              >
                Dismiss
              </Button>
              
              {helperState === 'ready-to-execute' && commands.length > 0 && (
                <Button
                  size="small"
                  variant="contained"
                  color="secondary"
                  onClick={() => {
                    commands.forEach(cmd => executeCommand(cmd));
                  }}
                  disabled={!!executingCommand}
                >
                  Execute All
                </Button>
              )}
            </Box>

            <Typography variant="caption" sx={{ opacity: 0.7, textAlign: 'center' }}>
              Press F12 again to execute • ESC to dismiss
            </Typography>
          </Stack>
        </Paper>
      </motion.div>
    </AnimatePresence>
  );
};

export default LinuxHelper;