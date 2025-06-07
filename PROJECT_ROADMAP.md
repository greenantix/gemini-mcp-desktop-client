# Linux Helper Tool - Project Roadmap

## Project Overview

Transform the existing Gemini MCP desktop client into a hotkey-activated Linux assistant for new Linux users (Pop OS). The tool will provide contextual help by analyzing screenshots and providing personalized command suggestions and execution.

## User's Vision

- **Trigger**: Mouse button 5 (configurable hotkey)
- **Capture**: Screenshot of active monitor where mouse was pressed
- **Analyze**: Send to Gemini with pre-configured system context
- **Assist**: Provide contextual Linux help for new users
- **Execute**: Stateful interaction (suggest → execute → persist)
- **Learn**: Smart automation for Git workflows, error fixes, command suggestions

## Current Repository Status

**Repository**: `/home/greenantix/AI/gemini-mcp-desktop-client`
**User's Gemini API Key**: `AIzaSyC6oGrn1D62R5urFLAvDgUAhuDQxL-J8xc`

### Existing Issues
- API key cannot be saved in UI due to missing configurations directory
- Path resolution inconsistencies in config files
- Empty `static/serverConfig.json` file

### Existing Assets (Good Foundation)
- ✅ Electron app structure
- ✅ Gemini API integration (`src/llm/gemini.ts`)
- ✅ Chat interface and persistence
- ✅ Backend API routes
- ✅ React frontend with Material-UI

## Implementation Plan

### Phase 1: Fix Current Repository (HIGH PRIORITY)

#### Task 1: Create Missing Configuration Structure
- **Issue**: `/src/backend/configurations/` directory doesn't exist
- **Files to create**:
  - `/src/backend/configurations/` directory
  - `/src/backend/configurations/serverConfig.json` with proper structure

#### Task 2: Fix Path Resolution Inconsistencies
- **Files to update**:
  - `src/utils/getGeminiApiKey.ts:12`
  - `src/backend/controllers/serverConfiguration/getServerConfiguration.ts:11`
  - `src/backend/controllers/serverConfiguration/saveServerConfiguration.ts:11`
- **Solution**: Use consistent absolute path calculations

#### Task 3: Initialize Config Files
- **File**: `src/backend/configurations/serverConfig.json`
- **Structure**: `{"GEMINI_API_KEY": ""}`

#### Task 4: Test API Key Functionality
- Test saving user's API key: `AIzaSyC6oGrn1D62R5urFLAvDgUAhuDQxL-J8xc`
- Verify persistence between sessions

### Phase 2: Transform into Linux Helper (MEDIUM PRIORITY)

#### Task 5: Add Global Hotkey System
- **Location**: `electron/main.ts`
- **Features**:
  - Mouse button 5 detection
  - Configurable hotkey settings
  - Background service when app minimized

#### Task 6: Screenshot and Context Capture
- **New module**: `src/utils/screenshot.ts`
- **Features**:
  - Capture active monitor where mouse was pressed
  - System context gathering:
    - Username (`getpass.getuser()`)
    - Current directory
    - Git repository status
    - Hostname, distro info
    - GitHub username from git config

#### Task 7: Enhance Gemini Integration
- **File to update**: `src/llm/gemini.ts`
- **Add**:
  - Vision capabilities for screenshot analysis
  - Linux helper prompt templates
  - System context integration

#### Task 8: Create Linux Helper Prompts
- **New file**: `src/prompts/linuxHelper.ts`
- **Content**:
```typescript
export const LINUX_HELPER_PROMPT = `
You are a helpful Linux assistant for a user who is NEW TO LINUX.
Provide beginner-friendly explanations with specific, accurate commands.

SYSTEM CONTEXT:
- User: {username}@{hostname}
- OS: {distro}
- Current Directory: {currentDir}
- GitHub User: {githubUser}

ANALYZE THIS SCREENSHOT and provide helpful suggestions:
- If you see errors, provide the exact fix command
- Use ACTUAL usernames/paths from the context above
- If in a git repo, use the real GitHub username for suggestions
- Explain what commands do (user is learning Linux)
- Be specific - use real file paths, not placeholders
- If nothing urgent, suggest 2-3 helpful next steps

Keep responses concise but educational.
`;
```

#### Task 9: Command Execution System
- **New module**: `src/utils/commandExecution.ts`
- **Features**:
  - Parse commands from Gemini responses
  - Safety checks for dangerous commands
  - Terminal integration for command injection
  - Confirmation prompts for risky operations

### Phase 3: Advanced Features (LOWER PRIORITY)

#### Task 10: Stateful Interaction Workflow
- **New module**: `src/utils/stateManager.ts`
- **States**:
  - `IDLE`: Waiting for hotkey
  - `SHOWING_SUGGESTIONS`: Displaying analysis results
  - `READY_TO_EXECUTE`: Second hotkey press executes commands
- **Workflow**:
  1. First hotkey: Screenshot → analyze → suggest
  2. Second hotkey: Execute suggested commands
  3. Escape key: Dismiss UI but maintain chat history

#### Task 11: UI Enhancements
- **Floating suggestion bubble**: Semi-transparent overlay
- **Background service**: App runs minimized in system tray
- **Chat persistence**: Build context over time using Gemini's large context window

#### Task 12: Advanced Context Features
- **Command history**: Learn user patterns
- **Project awareness**: Remember ongoing work
- **Smart suggestions**: Anticipate next actions

## Technical Architecture

### Key Files and Their Roles

```
├── electron/main.ts                           # Add hotkey detection
├── src/
│   ├── llm/gemini.ts                         # Enhance with vision
│   ├── utils/
│   │   ├── getGeminiApiKey.ts               # Fix path resolution
│   │   ├── screenshot.ts                     # NEW: Screenshot capture
│   │   ├── commandExecution.ts              # NEW: Command execution
│   │   └── stateManager.ts                  # NEW: Interaction states
│   ├── prompts/
│   │   └── linuxHelper.ts                   # NEW: Helper prompts
│   └── backend/
│       ├── configurations/
│       │   └── serverConfig.json            # NEW: Config directory
│       └── controllers/serverConfiguration/ # Fix path resolution
```

### Expected User Experience Examples

#### Git Workflow
1. **User**: Working in git repo with uncommitted changes
2. **Hotkey**: Mouse button 5 pressed
3. **Analysis**: "You have 3 uncommitted files in 'my-python-project'. Ready to commit?"
4. **Second hotkey**: Executes `git add . && git commit -m "Add login functionality" && git push origin main`

#### Error Debugging
1. **User**: Terminal showing "command not found: pip"
2. **Hotkey**: Mouse button 5 pressed
3. **Analysis**: "Missing package 'python3-pip'. Install it with: sudo apt install python3-pip"
4. **Second hotkey**: Executes the installation command

#### File Operations
1. **User**: Script file in file manager
2. **Hotkey**: Mouse button 5 pressed
3. **Analysis**: "Script needs execute permission. Run: chmod +x /home/{username}/my-script.sh"
4. **Second hotkey**: Executes the chmod command

## Development Notes

### Safety Considerations
- Whitelist safe commands for auto-execution
- Require confirmation for dangerous operations (`rm -rf`, `sudo`, etc.)
- Sandbox dangerous commands or run with `--dry-run` first

### Performance Optimizations
- Use Gemini 1.5 Flash for cost-effective vision analysis (~$0.001 per image)
- Cache system context to avoid repeated gathering
- Compress screenshots before sending to API

### Future Enhancements
- Voice input integration
- Custom hotkey configurations
- Plugin system for specialized workflows
- Integration with IDE/code editors
- Desktop environment integration

## Getting Started

1. Fix API key saving issue (Phase 1)
2. Test basic Gemini integration works
3. Add hotkey detection to Electron app
4. Implement screenshot capture
5. Create basic Linux helper prompts
6. Build stateful interaction system

---

*This document should be updated as the project evolves. Keep track of completed tasks and new requirements.*