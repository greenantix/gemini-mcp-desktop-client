import React, { useState, useEffect, useRef } from 'react';
import {
  Check,
  Copy,
  Terminal,
  ChevronRight,
  X,
  Pin,
  Loader2,
  AlertCircle,
  Lightbulb,
  Code2,
  Mic,
  Volume2
} from 'lucide-react';

// Types
interface PopupState {
  status: 'loading' | 'success' | 'error' | 'voice-listening';
  title: string;
  content: string;
  commands?: string[];
  suggestions?: Array<{
    title: string;
    command: string;
    description: string;
  }>;
  error?: string;
  executeFirst?: boolean;
}

interface PopupPosition {
  x: number;
  y: number;
}

// Mock data for demonstration
const mockStates: { [key: string]: PopupState } = {
  loading: {
    status: 'loading',
    title: 'Analyzing screenshot...',
    content: 'Processing your screen capture with AI'
  },
  success: {
    status: 'success',
    title: 'TypeScript Error Detected',
    content: 'Missing semicolon on line 42',
    commands: ['npm run lint:fix', 'git add . && git commit -m "fix: add missing semicolon"'],
    suggestions: [
      {
        title: 'Quick Fix',
        command: 'npm run lint:fix',
        description: 'Auto-fix linting errors'
      },
      {
        title: 'Fix & Commit',
        command: 'npm run lint:fix && git add . && git commit -m "fix: linting"',
        description: 'Fix and commit changes'
      },
      {
        title: 'Run Tests',
        command: 'npm test -- --watch',
        description: 'Verify fix with tests'
      }
    ]
  },
  error: {
    status: 'error',
    title: 'Analysis Failed',
    content: 'Could not connect to AI service',
    error: 'Please check your API key configuration'
  },
  voice: {
    status: 'voice-listening',
    title: 'Listening...',
    content: 'Say your command'
  }
};

const PopupWindow: React.FC = () => {
  const [state, setState] = useState<PopupState>(mockStates.loading);
  const [isPinned, setIsPinned] = useState(false);
  const [selectedCommand, setSelectedCommand] = useState<number>(0);
  const [showCopied, setShowCopied] = useState(false);
  const [position, setPosition] = useState<PopupPosition>({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const popupRef = useRef<HTMLDivElement>(null);

  // Handle external state updates
  useEffect(() => {
    const handleStateUpdate = (event: CustomEvent<PopupState>) => {
      setState(prevState => ({
        ...prevState,
        ...event.detail
      }));

      // Auto-execute first command if requested
      if (event.detail.executeFirst && event.detail.suggestions?.length) {
        handleExecuteCommand(event.detail.suggestions[0].command);
      }
    };

    window.addEventListener('popup-state-update', handleStateUpdate as EventListener);
    return () => {
      window.removeEventListener('popup-state-update', handleStateUpdate as EventListener);
    };
  }, []);

  // Simulate state changes for demo
  useEffect(() => {
    const timer = setTimeout(() => {
      setState(mockStates.success);
    }, 2000);
    return () => clearTimeout(timer);
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

      if (e.key === 'Escape' && !isPinned) {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, selectedCommand, isPinned]);

  // Dragging functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.no-drag')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleCopyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  const handleExecuteCommand = (command: string) => {
    console.log('Execute:', command);
    // In real implementation, this would send command to terminal via IPC
    if (window.electron) {
      window.electron.ipcRenderer.invoke('popup-execute-command', command);
    }
  };

  const handleClose = () => {
    console.log('Close popup');
    // In real implementation, this would close the window via IPC
    if (window.electron) {
      window.electron.ipcRenderer.invoke('popup-close');
    }
  };

  const handlePin = () => {
    setIsPinned(!isPinned);
  };

  // Voice visualization
  const VoiceVisualizer = () => (
    <div className="flex items-center justify-center space-x-1 h-16">
      {[...Array(7)].map((_, i) => (
        <div
          key={i}
          className="w-1 bg-orange-400 rounded-full animate-pulse"
          style={{
            height: `${Math.random() * 40 + 10}px`,
            animationDelay: `${i * 0.1}s`,
            animationDuration: `${0.5 + Math.random() * 0.5}s`
          }}
        />
      ))}
    </div>
  );

  return (
    <div
      ref={popupRef}
      className="fixed bg-gray-900 text-white rounded-lg shadow-2xl border border-gray-700 overflow-hidden popup-window"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '400px',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none'
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse" />
          <span className="font-semibold text-sm">Linux Helper</span>
        </div>
        <div className="flex items-center space-x-1 no-drag">
          <button
            onClick={handlePin}
            className={`p-1.5 rounded hover:bg-gray-700 transition-colors ${
              isPinned ? 'text-orange-400' : 'text-gray-400'
            }`}
            title={isPinned ? 'Unpin' : 'Pin'}
          >
            <Pin size={16} className={isPinned ? 'fill-current' : ''} />
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Close (ESC)"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Status Header */}
        <div className="flex items-start space-x-3 mb-3">
          <div className="mt-0.5">
            {state.status === 'loading' && (
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            )}
            {state.status === 'success' && (
              <Lightbulb className="w-5 h-5 text-green-400" />
            )}
            {state.status === 'error' && (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            {state.status === 'voice-listening' && (
              <Mic className="w-5 h-5 text-orange-400 animate-pulse" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-base mb-1">{state.title}</h3>
            <p className="text-sm text-gray-400">{state.content}</p>
            {state.error && (
              <p className="text-xs text-red-400 mt-1">{state.error}</p>
            )}
          </div>
        </div>

        {/* Voice Visualizer */}
        {state.status === 'voice-listening' && <VoiceVisualizer />}

        {/* Loading Progress */}
        {state.status === 'loading' && (
          <div className="mt-3">
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div className="bg-orange-400 h-2 rounded-full animate-pulse" style={{ width: '45%' }} />
            </div>
          </div>
        )}

        {/* Command Suggestions */}
        {state.suggestions && state.suggestions.length > 0 && (
          <div className="mt-4 space-y-2">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">
              Suggested Actions
            </div>
            {state.suggestions.map((suggestion, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border transition-all cursor-pointer ${
                  selectedCommand === index
                    ? 'bg-gray-800 border-orange-400'
                    : 'bg-gray-850 border-gray-700 hover:bg-gray-800 hover:border-gray-600'
                }`}
                onClick={() => setSelectedCommand(index)}
                onDoubleClick={() => handleExecuteCommand(suggestion.command)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <Code2 size={14} className="text-orange-400" />
                      <span className="font-medium text-sm">{suggestion.title}</span>
                    </div>
                    <code className="text-xs bg-black px-2 py-1 rounded text-gray-300 block mb-1 font-mono">
                      {suggestion.command}
                    </code>
                    <p className="text-xs text-gray-500">{suggestion.description}</p>
                  </div>
                  {selectedCommand === index && (
                    <ChevronRight size={16} className="text-orange-400 ml-2 mt-1" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Buttons */}
        {state.suggestions && state.suggestions.length > 0 && (
          <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-gray-800">
            <button
              onClick={() => handleCopyCommand(state.suggestions![selectedCommand].command)}
              className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors no-drag"
            >
              {showCopied ? (
                <>
                  <Check size={16} className="text-green-400" />
                  <span className="text-sm text-green-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span className="text-sm">Copy</span>
                </>
              )}
            </button>
            <button
              onClick={() => handleExecuteCommand(state.suggestions![selectedCommand].command)}
              className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors no-drag"
            >
              <Terminal size={16} />
              <span className="text-sm font-medium">Execute</span>
            </button>
          </div>
        )}

        {/* Keyboard Shortcuts */}
        <div className="mt-3 pt-3 border-t border-gray-800 flex items-center justify-center space-x-4 text-xs text-gray-500">
          <span>↑↓ Navigate</span>
          <span>Enter Execute</span>
          <span>Ctrl+C Copy</span>
          <span>ESC Close</span>
        </div>
      </div>
    </div>
  );
};

export default PopupWindow;
