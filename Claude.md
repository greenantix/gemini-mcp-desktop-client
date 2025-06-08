# Personal Coding Assistant - Working System

## Current State (WORKING ✅)

**F10 Screenshot System**: Captures screenshots and analyzes them with full project context
**MCP Integration**: 30+ powerful tools including Filesystem, Memory, Everything, etc.
**Chat System**: Full Gemini integration with MCP tools for development assistance
**Linux Helper**: Project-aware coding assistant with intelligent command suggestions

## Working Features

✅ **F10 Hotkey Workflow**
- First F10: Captures screenshot + analyzes with project context
- Second F10: Copies smart command suggestion to clipboard
- Ctrl+V: Execute the intelligent solution

✅ **Project Intelligence** 
- Reads actual project files (package.json, git status, dependencies)
- Analyzes recent commits and development patterns
- Provides project-specific command chains using && operators
- References actual file names and paths in suggestions

✅ **MCP Tools Integration**
- Filesystem: Read/write files across project directories
- Memory: Remember context and development patterns  
- Everything: Search files across the system
- 30+ additional tools available for specialized tasks

✅ **Development Context**
- Git repository analysis (branch, commits, changes)
- Package.json script detection (dev, build, test, lint)
- Dependency analysis and version tracking
- Error detection and specific fix suggestions

## Architecture

```
F10 → Screenshot + Project Context → Gemini Analysis + MCP Tools → Smart Commands → Clipboard
```

## Technical Implementation

**Frontend**: React + TypeScript + Material UI + Electron
**Backend**: Express server with MCP integration
**AI**: Gemini 1.5 Flash with vision capabilities
**Tools**: 30+ MCP servers for file operations, memory, search, etc.
**Platform**: Pop!_OS focused with cross-platform support

## Usage

1. **Start Development**: `npm run dev`
2. **Take Screenshot**: Press F10 while working
3. **Get Analysis**: AI analyzes screenshot with project context
4. **Copy Command**: Press F10 again to copy suggested command
5. **Execute**: Ctrl+V to paste and run the intelligent solution

## Project Structure

- **Linux Helper**: Core AI assistant (`src/utils/linuxHelper.ts`)
- **F10 Component**: Screenshot handling (`src/components/LinuxHelper.tsx`)
- **Chat Integration**: Main chat interface (`src/screens/Chat/ChatPage.tsx`)
- **MCP Tools**: Server integration (`src/utils/llmChat/getMcpTools.ts`)
- **Settings**: Configuration system (`src/screens/ServerConfiguration/`)

## Configuration

- **Screenshot Location**: ~/Pictures/screenshots/ (customizable)
- **Hotkey**: F10 (customizable)
- **Theme**: Dark mode matching Pop!_OS
- **MCP Tools**: Filesystem, Memory, Everything active by default

This is a complete, working AI coding assistant ready for development use.