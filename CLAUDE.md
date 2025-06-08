# Personal Coding Assistant - Claude Context

## Project Overview
This is a **Personal AI Coding Assistant** built on Electron/React that provides intelligent, context-aware development support. Originally a Gemini MCP desktop client, it's evolved into a deeply integrated personal assistant that knows your entire development environment, current projects, and coding patterns.

## Current State (Working ✅)
- **Personal AI Assistant**: Deep project context awareness with MCP filesystem integration
- **Smart Solutions**: Project-specific command chains using actual file names and dependencies  
- **Enhanced Context**: Git history, package info, recent commits, file modifications
- **Massive Prompting**: Leverages Gemini's 1M+ context window for comprehensive understanding
- **Dark theme**: Pop!_OS orange/teal theme matching Papirus-dark
- **File handling**: Upload/analyze images, videos, documents with MCP integration
- **Screenshot system**: Saves to ~/Pictures/screenshots/ with clickable filenames
- **Chat interface**: Full conversation history with Gemini integration
- **Settings integration**: Screenshot location and hotkey customization in server config

## Key Files & Architecture

### Main Components
- `electron/main.ts` - Main process, screenshot capture, IPC handlers
- `src/screens/Chat/ChatPage.tsx` - Main chat interface
- `src/components/LinuxHelper.tsx` - Linux Helper widget/analysis display
- `src/utils/linuxHelper.ts` - Screenshot analysis logic with system context
- `src/theme.ts` - Pop!_OS dark theme configuration

### Core Flow
1. **F10 pressed** → `electron/main.ts` captures screenshot
2. **Screenshot saved** to ~/Pictures/screenshots/ with timestamped filename  
3. **Analysis sent** to `linuxHelper.ts` → Gemini vision analysis with enhanced prompting
4. **Smart command chain** extracted from response (single chained command with &&)
5. **Results displayed** in chat with clickable filename and command preview
6. **F10 again** → Command chain copied to clipboard for Ctrl+V pasting
7. **System context** included (user, git status, distro, current directory)

### API Integration
- **Gemini 1.5 Flash** with vision for screenshot analysis
- **MCP servers** for filesystem tools (11 tools connected)
- **Direct API key** usage (no file reading issues)

## Next Development Priorities

### Phase 1: Settings System (Safe & Easy)
**User requested features:**
- Screenshot save location customization
- Hotkey assignment (currently F10 only)
- Theme/UI preferences
- Linux distro selection for contextual help

**Implementation approach:**
- New SettingsPage component with persistent storage
- Settings context/hook for app-wide configuration
- Electron store for settings persistence

### Phase 2: Command Execution (Advanced)
**Core feature**: Execute suggested commands safely
- Command parsing from markdown suggestions
- Safety classification system (safe/moderate/dangerous)
- User confirmation for risky operations
- Real terminal execution with output streaming

### Phase 3: Enhanced Learning Features
- Command explanation tooltips
- Learning progress tracking
- Custom command aliases
- Beginner vs advanced modes

## Development Guidelines

### Safety First
- Always commit working state before major changes
- Use feature branches for complex features
- Test core functionality after any changes
- Never break existing screenshot/chat functionality

### Code Patterns
- **Dark theme**: Use theme.palette colors, never hardcoded colors
- **IPC communication**: Add to preload.ts for renderer access
- **File paths**: Use absolute paths, handle development vs production
- **Error handling**: Comprehensive try/catch with user-friendly messages

### User Experience Focus
- **Pop!_OS integration**: Match system theme and behavior
- **Learning-oriented**: Always explain commands and provide context
- **Safety warnings**: Clear indicators for dangerous operations
- **Accessibility**: Proper contrast, keyboard navigation, screen reader support

## Common Pitfalls to Avoid

1. **Path issues**: Development vs production path resolution (already fixed)
2. **Theme conflicts**: Always use theme variables, never hardcoded colors
3. **IPC breaking**: Test electron functionality after renderer changes
4. **MCP hangs**: Keep MCP server connections stable, handle timeouts
5. **Context loss**: Screenshot analysis must maintain Linux learning focus

## Key User Workflows

### Primary: Personal Coding Assistant
F10 → Screenshot + Project Context → AI Analysis with MCP data → Project-Specific Solution → F10 → Copy Smart Command → Ctrl+V → Execute

### Secondary: File Analysis  
Upload file → Parse content → Gemini analysis → Learning suggestions

### Settings Management
Server Config → Set API key + hotkey + screenshot location → Save → Immediate effect

## Success Metrics
- Screenshot capture works reliably
- Dark theme provides good UX on Pop!_OS
- Gemini analysis provides helpful Linux learning suggestions
- File metadata and folder access work properly
- Chat history persists and loads correctly

---

**Last Updated**: June 7, 2025  
**Working Commit**: 8e2e350  
**Status**: Personal Coding Assistant with MCP integration complete - Your AI knows your codebase!