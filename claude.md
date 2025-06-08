# CLAUDE.MD - Linux Helper Enhancement Project

## 🎯 Project Overview

Transform the existing Linux Helper (F10 screenshot tool) into a powerful system-wide coding assistant that runs independently of the main Electron app, provides instant popup feedback at cursor position, and offers enhanced AI-powered development assistance.

## 📋 Current State Analysis

### What Works Well
- F10 hotkey captures screenshots and analyzes them with Gemini
- Extracts and chains commands intelligently
- Integrates with project context (git, package.json, etc.)
- Copies commands to clipboard for easy execution
- Settings page for customization

### Current Limitations
- Only works when main Electron app is running
- Output appears in chat window on 3rd monitor (not at cursor)
- No visual feedback during analysis
- Limited to screenshot-based interaction
- No persistent system tray presence

## 🚀 Enhancement Roadmap

### Phase 1: System-Wide Daemon Architecture

#### 1.1 Create Standalone Linux Helper Service
```
src/
├── linux-helper-daemon/
│   ├── main.ts              # Standalone Node.js service
│   ├── server.ts            # Local WebSocket/IPC server
│   ├── hotkey-manager.ts    # Global hotkey registration
│   ├── screenshot.ts        # Screenshot capture logic
│   ├── popup-window.ts      # Floating popup management
│   └── package.json         # Separate dependencies
```

#### 1.2 System Integration Options
- **Option A**: SystemD service (Pop!_OS/Ubuntu)
  - Auto-start on boot
  - Runs as user service
  - Proper logging and restart policies
  
- **Option B**: Startup application
  - Add to ~/.config/autostart/
  - Simpler but less robust

#### 1.3 IPC Communication
- Main app ↔ Daemon: Unix domain sockets
- Daemon ↔ Popup: Direct Electron IPC
- Fallback: HTTP localhost server

### Phase 2: Cursor-Following Popup Window

#### 2.1 Popup Window Features
```typescript
interface PopupConfig {
  // Window properties
  alwaysOnTop: true,
  frame: false,
  transparent: true,
  skipTaskbar: true,
  resizable: false,
  
  // Positioning
  followCursor: true,
  offset: { x: 10, y: 10 },
  screenEdgeDetection: true,
  
  // Animations
  fadeIn: 200ms,
  fadeOut: 150ms,
  slideDirection: 'auto' // Based on screen position
}
```

#### 2.2 Popup UI Components
```
┌─────────────────────────────────┐
│ 🤖 Linux Helper                ✕│
├─────────────────────────────────┤
│ 📸 Analyzing screenshot...      │
│ ░░░░░░░░░░░░░░░░░░░░░░ 45%     │
├─────────────────────────────────┤
│ 💡 Error: Missing semicolon     │
│                                 │
│ 📋 Quick Fix:                   │
│ ┌─────────────────────────────┐ │
│ │ npm run lint:fix && npm test│ │
│ └─────────────────────────────┘ │
│                                 │
│ [Copy] [Execute] [Details] [📌] │
└─────────────────────────────────┘
```

#### 2.3 Popup Interactions
- **Single Click**: Copy command
- **Double Click**: Execute in terminal
- **Right Click**: Context menu with options
- **Drag**: Move popup
- **Pin Button**: Keep popup visible
- **ESC**: Dismiss popup

### Phase 3: Enhanced Hotkey System

#### 3.1 Multi-Hotkey Architecture
```typescript
interface HotkeyActions {
  'F10': 'screenshot-analyze',        // Current behavior
  'Ctrl+Shift+H': 'quick-help',       // Instant help for selected text
  'Ctrl+Alt+E': 'explain-error',      // Explain last terminal error
  'Ctrl+Alt+F': 'fix-suggestion',     // AI fix for current file
  'Ctrl+Alt+T': 'test-generator',     // Generate tests for function
  'Ctrl+Alt+D': 'documentation',      // Generate docs
  'F9': 'voice-command',              // Voice input mode
}
```

#### 3.2 Context-Aware Actions
- Detect active window (VSCode, Terminal, Browser)
- Adjust analysis based on context
- Provide relevant suggestions

### Phase 4: Advanced AI Features

#### 4.1 Multi-Modal Analysis
```typescript
interface AnalysisContext {
  screenshot: Buffer,
  activeWindow: {
    title: string,
    class: string,
    pid: number
  },
  selectedText?: string,
  clipboardContent?: string,
  recentTerminalOutput?: string[],
  openFiles?: string[],
  cursorPosition?: { file: string, line: number, column: number }
}
```

#### 4.2 Intelligent Command Chains
- Learn from user's command history
- Suggest project-specific workflows
- Create custom command macros

#### 4.3 Real-time Code Analysis
- Watch file changes
- Proactive error detection
- Suggest optimizations

### Phase 5: System Tray Integration

#### 5.1 Tray Menu Structure
```
🤖 Linux Helper
├── 📸 Take Screenshot (F10)
├── 🎤 Voice Command (F9)
├── ─────────────────────────
├── 📊 Today's Stats
│   ├── Screenshots: 42
│   ├── Commands Run: 18
│   └── Time Saved: ~2.5 hrs
├── ─────────────────────────
├── ⚙️ Settings
├── 📚 Command History
├── 🔄 Restart Service
└── ❌ Quit
```

#### 5.2 Status Indicators
- 🟢 Active and ready
- 🟡 Processing request
- 🔴 Error or offline
- 🔵 Learning mode

### Phase 6: Terminal Integration

#### 6.1 Terminal Augmentation
- Inject helper into popular terminals
- Show inline suggestions
- Preview command effects

#### 6.2 Shell Integration
```bash
# ~/.bashrc or ~/.zshrc additions
source ~/.config/linux-helper/shell-integration.sh

# Features:
# - Automatic error explanation
# - Command suggestion on failure
# - Project context in prompt
```

### Phase 7: Learning & Personalization

#### 7.1 User Behavior Learning
```typescript
interface LearningData {
  commandPatterns: Map<string, frequency>,
  errorSolutions: Map<errorSignature, solution[]>,
  projectWorkflows: Map<projectType, workflow[]>,
  timeOfDayPatterns: Map<hour, commonTasks[]>
}
```

#### 7.2 Adaptive Responses
- Learn coding style
- Adapt to project conventions
- Suggest based on time of day

## 🛠️ Implementation Details

### Technology Stack
- **Daemon**: Node.js + TypeScript
- **Popup**: Electron (separate process)
- **Hotkeys**: node-global-shortcut or ioctl
- **IPC**: Unix sockets + MessagePack
- **AI**: Gemini API (existing)
- **Storage**: SQLite for history/learning

### Security Considerations
- Sandbox popup window
- Validate all commands
- Secure IPC channels
- Optional command whitelist
- Audit log for executed commands

### Performance Targets
- Screenshot capture: <100ms
- Popup appearance: <50ms
- AI response: <2s
- Memory usage: <50MB idle
- CPU usage: <1% idle

## 📝 Configuration Schema

```typescript
interface LinuxHelperConfig {
  daemon: {
    autoStart: boolean,
    logLevel: 'debug' | 'info' | 'error',
    port: number,
    socketPath: string
  },
  
  popup: {
    theme: 'dark' | 'light' | 'auto',
    position: 'cursor' | 'corner' | 'center',
    size: 'compact' | 'normal' | 'expanded',
    opacity: number,
    animations: boolean,
    persistHistory: boolean
  },
  
  ai: {
    model: string,
    temperature: number,
    maxTokens: number,
    contextWindow: number,
    useProjectContext: boolean,
    useLearning: boolean
  },
  
  hotkeys: {
    primary: string,        // Default: F10
    secondary: string[],    // Additional hotkeys
    modifiers: {
      screenshot: string[],
      voice: string[],
      quickFix: string[]
    }
  },
  
  features: {
    terminalIntegration: boolean,
    voiceCommands: boolean,
    autoErrorDetection: boolean,
    proactiveSuggestions: boolean,
    commandMacros: boolean
  }
}
```

## 🚧 Development Phases

### Week 1-2: Daemon Architecture
1. Extract Linux Helper to standalone service
2. Implement global hotkey registration
3. Create IPC communication layer
4. Add systemd service configuration

### Week 3-4: Popup Window
1. Design and implement popup UI
2. Add cursor tracking and positioning
3. Implement animations and themes
4. Add interaction handlers

### Week 5-6: Enhanced Features
1. Multi-hotkey support
2. Context detection
3. Terminal integration
4. System tray application

### Week 7-8: AI & Learning
1. Implement learning system
2. Add personalization features
3. Create command prediction
4. Build workflow automation

## 🎨 UI/UX Mockups

### Popup States
```
1. Loading State:
   ┌───────────────┐
   │ ◐ Analyzing...│
   └───────────────┘

2. Success State:
   ┌─────────────────────────┐
   │ ✓ Fixed: Missing import │
   │ [Copy Fix] [Apply Now]  │
   └─────────────────────────┘

3. Multi-Option State:
   ┌─────────────────────────┐
   │ 3 solutions found:      │
   │ 1. npm install missing  │
   │ 2. Add to package.json  │
   │ 3. Use alternative pkg  │
   │ [1] [2] [3] [More...]   │
   └─────────────────────────┘
```

### Voice Input Visualization
```
┌─────────────────────────────┐
│    🎤 Listening...          │
│   ▁▃▅▇▅▃▁▁▃▅▇▅▃▁          │
│                             │
│ "Show git diff for..."      │
└─────────────────────────────┘
```

## 🔍 Testing Strategy

### Unit Tests
- Hotkey registration
- Screenshot capture
- Command extraction
- IPC communication

### Integration Tests
- Daemon ↔ Main app
- Popup positioning
- Terminal integration
- AI response handling

### Performance Tests
- Startup time
- Memory leaks
- CPU usage monitoring
- Response latency

## 📚 Documentation Plan

### User Documentation
1. Installation guide
2. Configuration options
3. Hotkey reference
4. Troubleshooting guide

### Developer Documentation
1. Architecture overview
2. API reference
3. Plugin development
4. Contributing guide

## 🎯 Success Metrics

- **Response Time**: <2s from hotkey to suggestion
- **Accuracy**: >90% useful suggestions
- **Adoption**: Used >10 times daily
- **Stability**: <1 crash per week
- **Efficiency**: 50% reduction in debugging time

## 🔮 Future Enhancements

1. **AI Model Fine-tuning**: Train on user's coding patterns
2. **Team Sharing**: Share solutions across team
3. **Plugin System**: Extensible architecture
4. **Cloud Sync**: Settings and history sync
5. **Mobile Companion**: View/execute from phone
6. **IDE Plugins**: Deep VSCode/vim integration
7. **Multi-Monitor**: Smart popup positioning
8. **Accessibility**: Screen reader support

## 🏁 Getting Started for Claude Code

1. Clone the repository
2. Review current `src/utils/linuxHelper.ts` implementation
3. Study the Electron main process hotkey handling
4. Create `src/linux-helper-daemon/` directory
5. Start with Phase 1: Extract core functionality
6. Test global hotkey registration separately
7. Implement basic popup window
8. Iterate based on this plan

Remember: Start simple, test often, and gradually add features. The goal is a reliable, fast, and genuinely helpful coding assistant that enhances the Linux development experience.