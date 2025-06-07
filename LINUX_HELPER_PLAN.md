# Linux Helper Development Plan

## Current Status (WORKING STATE)
**Date:** June 7, 2025  
**Last Known Good Commit:** About to commit  
**Status:** Core functionality working, ready for enhancements

### ✅ What's Currently Working
1. **Basic Chat Functionality**
   - Gemini API integration with direct API key
   - MCP server connections (filesystem tools)
   - File upload and analysis (images, videos, documents)
   - Chat history management
   - Error handling and logging

2. **Linux Helper Core Features**
   - F10 hotkey screenshot capture ✅
   - Screenshot analysis with Linux context ✅
   - System context gathering (user, git, distro) ✅
   - Smart suggestions based on visible content ✅
   - Integration with chat interface ✅

3. **File Processing**
   - Video analysis (.webm, etc.) ✅
   - Image analysis ✅
   - Document parsing (PDF, DOCX, etc.) ✅
   - Audio transcription ✅

### 🔧 Recent Fixes Applied
1. **Path Resolution Issues**
   - Fixed config file paths in `getGeminiApiKey.ts`
   - Fixed config file paths in `linuxHelper.ts`
   - Both now use: `/src/backend/configurations/serverConfig.json`

2. **File Upload Issues**
   - Fixed "Message is required" error for file-only uploads
   - Fixed Gemini API "First content should be with role 'user'" error
   - Added chat history cleaning logic

3. **Screenshot Analysis Improvements**
   - Modified to prioritize visible screen content
   - Reduced auto-git suggestions when not relevant
   - Better focus on actual screenshot content

## Next Phase: Command Execution Feature

### 🎯 Goal
Transform Linux Helper from "suggestion tool" to "interactive learning assistant" that can execute suggested commands safely.

### 🏗️ Implementation Plan

#### Phase 1: Command Parsing and UI (2-3 hours)
**Files to modify:**
- `src/components/LinuxHelper.tsx` - Add command execution buttons
- `src/utils/linuxHelper.ts` - Add command parsing logic

**Features:**
- Parse commands from Linux Helper suggestions using regex
- Add "Execute" buttons next to each suggested command
- Visual indicators for command safety levels:
  - 🟢 Safe commands (ls, cd, cat, etc.)
  - 🟡 Moderate commands (mkdir, cp, mv, etc.)
  - 🔴 Dangerous commands (sudo, rm, chmod 777, etc.)

#### Phase 2: Safety System (1-2 hours)
**Files to create/modify:**
- `src/utils/commandSafety.ts` - Command classification and safety checks
- Update `src/utils/linuxHelper.ts` - Integrate safety checks

**Safety Features:**
- Whitelist of always-safe commands
- Blacklist of dangerous patterns
- Special handling for sudo commands
- User confirmation dialogs for risky operations
- Dry-run option for file operations

#### Phase 3: Command Execution Engine (2-3 hours)
**Files to create/modify:**
- `src/backend/controllers/commandExecution.ts` - Server-side execution
- `electron/main.ts` - IPC handlers for command execution
- `src/backend/routes/commandExecution.ts` - API routes

**Execution Features:**
- Secure command execution via child_process
- Real-time output streaming to chat
- Command history tracking
- Working directory management
- Environment variable handling

#### Phase 4: Integration and UX (1-2 hours)
**Files to modify:**
- `src/screens/Chat/ChatPage.tsx` - Command output integration
- `src/components/LinuxHelper.tsx` - Enhanced UI
- `src/screens/Chat/MessageItem.tsx` - Command output rendering

**UX Features:**
- Command output appears in chat as new messages
- Execution status indicators (running, success, error)
- Command cancellation capability
- Copy-to-clipboard for commands
- Learning mode with explanations

### 🔒 Safety Measures

#### Command Classification
```typescript
interface CommandSafety {
  level: 'safe' | 'moderate' | 'dangerous' | 'blocked';
  requires_confirmation: boolean;
  warning_message?: string;
  allowed_in_learning_mode: boolean;
}
```

#### Dangerous Command Patterns
- `rm -rf` / `rm -f` operations
- `sudo` commands requiring password
- `chmod 777` or similar permission changes
- `dd` commands (disk operations)
- Network commands affecting security
- Package installation/removal
- System service control

#### Safety Defaults
- **Learning Mode ON** by default (shows explanations)
- **Confirmation Required** for any moderate/dangerous commands
- **Working Directory Restrictions** (only within user home)
- **Command Logging** for audit trail
- **Timeout Protection** (max 30 seconds per command)

### 📁 File Structure Changes

```
src/
├── backend/
│   ├── controllers/
│   │   └── commandExecution.ts         [NEW]
│   └── routes/
│       └── commandExecution.ts         [NEW]
├── components/
│   └── LinuxHelper.tsx                 [MODIFY]
├── utils/
│   ├── commandSafety.ts                [NEW]
│   ├── commandParser.ts                [NEW]
│   └── linuxHelper.ts                  [MODIFY]
└── screens/Chat/
    ├── ChatPage.tsx                    [MODIFY]
    └── MessageItem.tsx                 [MODIFY]
```

### 🧪 Testing Strategy

#### Test Cases
1. **Safe Commands**
   - `ls -la` → Should execute immediately
   - `pwd` → Should show current directory
   - `cat filename.txt` → Should display file content

2. **Moderate Commands**
   - `mkdir new_folder` → Should ask for confirmation
   - `cp file1.txt file2.txt` → Should warn about overwrite

3. **Dangerous Commands**
   - `sudo apt update` → Should require explicit confirmation
   - `rm important_file.txt` → Should show strong warning
   - `chmod 777 /etc/passwd` → Should be blocked entirely

4. **Edge Cases**
   - Commands with pipes: `ls | grep txt`
   - Commands with redirects: `echo "test" > file.txt`
   - Multi-line commands
   - Commands with special characters

### 🚀 Rollout Strategy

#### Phase Implementation Order
1. **Phase 1** → Get basic command parsing and UI working
2. **Commit to Git** → Save progress after each phase
3. **Phase 2** → Add safety system
4. **Commit to Git** → Save safety features
5. **Phase 3** → Add execution engine
6. **Commit to Git** → Save core execution
7. **Phase 4** → Polish UX and integration
8. **Final Commit** → Complete feature

#### Rollback Plan
- Each phase commits maintain working state
- Can rollback to any previous commit if issues arise
- Feature flags to disable command execution if needed

### 📊 Success Metrics

#### Must-Have Features
- ✅ Command suggestions appear with execute buttons
- ✅ Safe commands execute without confirmation
- ✅ Dangerous commands require explicit user approval
- ✅ Command output appears in chat interface
- ✅ No security vulnerabilities in command execution

#### Nice-to-Have Features
- ⚪ Command auto-completion
- ⚪ Command history search
- ⚪ Custom command aliases
- ⚪ Batch command execution
- ⚪ Command scheduling

## Risk Mitigation

### Technical Risks
1. **Security vulnerabilities** → Comprehensive safety system + sandboxing
2. **Performance issues** → Command timeouts + resource limits
3. **Breaking existing features** → Incremental development + frequent commits

### Development Risks
1. **Scope creep** → Stick to defined phases
2. **Time overrun** → Each phase has clear deliverables
3. **Integration issues** → Test after each phase

## Backup & Recovery

### Before Starting Development
1. **Create feature branch**: `git checkout -b feature/command-execution`
2. **Document current state**: This plan + commit hash
3. **Test current functionality**: Ensure everything works before changes

### During Development
1. **Commit after each phase** with descriptive messages
2. **Tag stable versions**: `git tag v1.1-linux-helper-basic`
3. **Regular testing**: Don't break existing features

### If Things Go Wrong
1. **Revert to last working commit**: `git reset --hard <commit-hash>`
2. **Cherry-pick working features**: `git cherry-pick <commit-hash>`
3. **Start over from this plan**: Known good state documented

---

**IMPORTANT**: This document represents the current working state and future development plan. Always refer back to this when making changes to avoid losing progress like we did earlier.