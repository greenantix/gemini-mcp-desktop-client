import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  Copy,
  Terminal,
  ChevronRight,
  X,
  Loader2,
  AlertCircle,
  Code2
} from 'lucide-react';

// Types
interface PopupState {
  status: 'loading' | 'success' | 'error' | 'idle';
  title: string;
  content: string;
  suggestions?: Array<{
    title: string;
    command: string;
    description: string;
  }>;
  error?: string;
}

const LinuxHelperPopup: React.FC = () => {
  const [state, setState] = useState<PopupState>({
    status: 'loading',
    title: 'Analyzing screenshot...',
    content: 'Processing your screen capture with AI'
  });
  const [selectedCommand, setSelectedCommand] = useState<number>(0);
  const [showCopied, setShowCopied] = useState(false);

  // Listen for IPC messages from main process
  useEffect(() => {
    if (window.electron?.ipcRenderer) {
      const handleStateUpdate = (_event: any, newState: PopupState) => {
        setState(newState);
        if (newState.suggestions && newState.suggestions.length > 0) {
          setSelectedCommand(0);
        }
      };

      window.electron.ipcRenderer.on('update-state', handleStateUpdate);

      return () => {
        window.electron?.ipcRenderer.removeAllListeners('update-state');
      };
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (state.suggestions) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelectedCommand((prev) =>
            prev < state.suggestions!.length - 1 ? prev + 1 : 0
          );
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelectedCommand((prev) =>
            prev > 0 ? prev - 1 : state.suggestions!.length - 1
          );
        } else if (e.key === 'Enter') {
          e.preventDefault();
          handleExecuteCommand(state.suggestions[selectedCommand].command);
        } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault();
          handleCopyCommand(state.suggestions[selectedCommand].command);
        }
      }

      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, selectedCommand]);

  const handleCopyCommand = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleExecuteCommand = async (command: string) => {
    if (window.electron?.ipcRenderer) {
      await window.electron.ipcRenderer.invoke('linux-helper-execute-command', command);
    }
  };

  const handleClose = () => {
    if (window.close) {
      window.close();
    }
  };

  const styles = {
    container: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#1a1a1a',
      color: '#d4d4d4',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column' as const,
      fontSize: '14px'
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      backgroundColor: '#252525',
      borderBottom: '1px solid #333'
    },
    headerTitle: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      fontSize: '13px',
      fontWeight: 500,
      color: '#e0e0e0'
    },
    closeButton: {
      background: 'none',
      border: 'none',
      color: '#808080',
      cursor: 'pointer',
      padding: '4px',
      borderRadius: '4px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.2s ease'
    },
    content: {
      flex: 1,
      padding: '16px',
      overflowY: 'auto' as const
    },
    statusSection: {
      marginBottom: '16px'
    },
    statusHeader: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px'
    },
    statusIcon: {
      marginTop: '2px'
    },
    statusText: {
      flex: 1
    },
    statusTitle: {
      fontSize: '15px',
      fontWeight: 500,
      marginBottom: '4px',
      color: '#ffffff'
    },
    statusContent: {
      fontSize: '13px',
      color: '#a0a0a0',
      lineHeight: 1.5
    },
    errorText: {
      fontSize: '12px',
      color: '#f87171',
      marginTop: '4px'
    },
    loadingBar: {
      marginTop: '12px',
      height: '3px',
      backgroundColor: '#2a2a2a',
      borderRadius: '3px',
      overflow: 'hidden'
    },
    loadingProgress: {
      height: '100%',
      backgroundColor: '#ff6b2b',
      width: '40%',
      animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
    },
    suggestionsSection: {
      marginTop: '16px'
    },
    suggestionsLabel: {
      fontSize: '12px',
      color: '#808080',
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
      marginBottom: '8px'
    },
    suggestionItem: {
      padding: '12px',
      marginBottom: '8px',
      borderRadius: '6px',
      border: '1px solid #2a2a2a',
      backgroundColor: '#202020',
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    },
    suggestionItemSelected: {
      backgroundColor: '#252525',
      borderColor: '#ff6b2b'
    },
    suggestionHeader: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginBottom: '6px'
    },
    suggestionTitle: {
      fontSize: '13px',
      fontWeight: 500,
      color: '#ffffff'
    },
    suggestionCommand: {
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      fontSize: '12px',
      backgroundColor: '#0d0d0d',
      color: '#ff6b2b',
      padding: '6px 8px',
      borderRadius: '4px',
      marginBottom: '4px',
      overflowX: 'auto' as const,
      whiteSpace: 'nowrap' as const
    },
    suggestionDescription: {
      fontSize: '12px',
      color: '#808080',
      lineHeight: 1.4
    },
    actions: {
      display: 'flex',
      gap: '8px',
      padding: '12px 16px',
      backgroundColor: '#252525',
      borderTop: '1px solid #333'
    },
    button: {
      flex: 1,
      padding: '8px 16px',
      borderRadius: '6px',
      border: 'none',
      fontSize: '13px',
      fontWeight: 500,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6px',
      transition: 'all 0.2s ease'
    },
    copyButton: {
      backgroundColor: '#2a2a2a',
      color: '#d4d4d4'
    },
    executeButton: {
      backgroundColor: '#ff6b2b',
      color: '#ffffff'
    },
    shortcuts: {
      padding: '8px 16px',
      backgroundColor: '#1a1a1a',
      borderTop: '1px solid #2a2a2a',
      display: 'flex',
      justifyContent: 'center',
      gap: '16px',
      fontSize: '11px',
      color: '#606060'
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <div style={{ width: 6, height: 6, backgroundColor: '#ff6b2b', borderRadius: '50%' }} />
          <span>Linux Helper</span>
        </div>
        <button
          style={styles.closeButton}
          onClick={handleClose}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {/* Status Section */}
        <div style={styles.statusSection}>
          <div style={styles.statusHeader}>
            <div style={styles.statusIcon}>
              {state.status === 'loading' && (
                <Loader2 size={18} style={{ color: '#ff6b2b', animation: 'spin 1s linear infinite' }} />
              )}
              {state.status === 'success' && (
                <Code2 size={18} style={{ color: '#10b981' }} />
              )}
              {state.status === 'error' && (
                <AlertCircle size={18} style={{ color: '#f87171' }} />
              )}
            </div>
            <div style={styles.statusText}>
              <div style={styles.statusTitle}>{state.title}</div>
              <div style={styles.statusContent}>{state.content}</div>
              {state.error && (
                <div style={styles.errorText}>{state.error}</div>
              )}
            </div>
          </div>
        </div>

        {/* Loading Progress */}
        {state.status === 'loading' && (
          <div style={styles.loadingBar}>
            <div style={styles.loadingProgress} />
          </div>
        )}

        {/* Suggestions */}
        {state.suggestions && state.suggestions.length > 0 && (
          <div style={styles.suggestionsSection}>
            <div style={styles.suggestionsLabel}>Suggestions</div>
            {state.suggestions.map((suggestion, index) => (
              <div
                key={index}
                style={{
                  ...styles.suggestionItem,
                  ...(selectedCommand === index ? styles.suggestionItemSelected : {})
                }}
                onClick={() => setSelectedCommand(index)}
                onDoubleClick={() => handleExecuteCommand(suggestion.command)}
                onMouseEnter={() => setSelectedCommand(index)}
              >
                <div style={styles.suggestionHeader}>
                  <Code2 size={14} style={{ color: '#ff6b2b' }} />
                  <span style={styles.suggestionTitle}>{suggestion.title}</span>
                  {selectedCommand === index && (
                    <ChevronRight size={14} style={{ color: '#ff6b2b', marginLeft: 'auto' }} />
                  )}
                </div>
                <div style={styles.suggestionCommand}>{suggestion.command}</div>
                <div style={styles.suggestionDescription}>{suggestion.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {state.suggestions && state.suggestions.length > 0 && (
        <>
          <div style={styles.actions}>
            <button
              style={{ ...styles.button, ...styles.copyButton }}
              onClick={() => handleCopyCommand(state.suggestions![selectedCommand].command)}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#2a2a2a'}
            >
              {showCopied ? (
                <>
                  <Check size={14} />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              style={{ ...styles.button, ...styles.executeButton }}
              onClick={() => handleExecuteCommand(state.suggestions![selectedCommand].command)}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ff8040'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ff6b2b'}
            >
              <Terminal size={14} />
              <span>Execute</span>
            </button>
          </div>

          {/* Keyboard Shortcuts */}
          <div style={styles.shortcuts}>
            <span>↑↓ Navigate</span>
            <span>Enter Execute</span>
            <span>Ctrl+C Copy</span>
            <span>ESC Close</span>
          </div>
        </>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default LinuxHelperPopup;