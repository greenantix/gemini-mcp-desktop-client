# Project Roadmap: Phases 3-7

With a stable and functional popup from the corrected Phase 2, we can now confidently build the advanced features outlined in the original plan.

---

### **Phase 3: Enhanced Hotkey System**

**Objective:** Expand beyond a single F10 hotkey to support multiple, context-aware actions.

1.  **Daemon (`hotkey-manager.ts`)**:
    * Modify the `HotkeyManager` to register a map of hotkeys to actions, defined in a configuration file.
        ```json
        // in ~/.config/linux-helper/daemon.json
        "hotkeys": {
          "F10": "analyze-screenshot",
          "Ctrl+Shift+H": "analyze-selection",
          "Ctrl+Alt+E": "analyze-last-error"
        }
        ```
    * When a hotkey is pressed, the daemon will send its action type to the Electron app.

2.  **Communication Protocol**:
    * Expand the message from the daemon to include the action type.
        ```json
        {
          "type": "EXECUTE_ACTION",
          "payload": {
            "action": "analyze-selection", // 'analyze-screenshot', etc.
            "context": { ... } // Any data the daemon can gather
          }
        }
        ```

3.  **Electron App (`electron/main.ts`)**:
    * The main process will receive the action and decide what to do.
    * For `analyze-selection`, it may need to use tools to get the currently selected text from the active application.
    * For `analyze-last-error`, it would need a way to read the history from the user's terminal. This is complex and might require shell integration (see Phase 6).

---

### **Phase 4: Advanced AI & Multi-Modal Analysis**

**Objective:** Make the AI analysis smarter by providing it with more than just a screenshot.

1.  **Data Gathering (Daemon & Electron)**:
    * **Selected Text**: Implement a method for the daemon or Electron app to capture the currently highlighted text system-wide.
    * **Clipboard Content**: The Electron app can easily read the clipboard content (`clipboard.readText()`).
    * **Terminal Output**: Requires shell integration (Phase 6) to pipe recent command output to the daemon.
    * **Active Window Info**: The daemon can use command-line tools like `xdotool getactivewindow getwindowname` to get the title of the active window, providing context (e.g., "VS Code", "Google Chrome", "Terminal").

2.  **Augmented Prompt (`src/utils/linuxHelper.ts`)**:
    * The `createPersonalAssistantPrompt` function will be updated to include this new context. The prompt will dynamically add sections for "Selected Text," "Clipboard Content," etc., only if they are available. This gives the AI a rich, multi-modal view of the user's current state.

---

### **Phase 5: System Tray Integration**

**Objective:** Provide a persistent UI to manage the daemon and access features. This will be managed entirely by the **main Electron app**, not the daemon.

1.  **Electron App (`electron/main.ts`)**:
    * Use Electron's `Tray` module to create a system tray icon.
    * Create a `ContextMenu` with options:
        * **Status**: (Running / Stopped)
        * **Start/Stop Daemon**: These menu items will execute shell commands to start (`systemctl --user start linux-helper-daemon`) or stop the daemon process.
        * **Restart Daemon**: Combines stop and start.
        * **Manual Screenshot (F10)**: Triggers the screenshot action directly.
        * **Settings**: Opens the settings window in the main Electron app.
        * **Quit**: Quits both the Electron app and stops the daemon.

---

### **Phase 6: Terminal Integration**

**Objective:** Allow the helper to read from and interact with the user's terminal.

1.  **Shell Integration Script**:
    * Create a shell script (`~/.config/linux-helper/shell-integration.sh`) that users will source in their `.bashrc` or `.zshrc`.
    * This script will override the shell's `PROMPT_COMMAND` or use `trap '...' DEBUG`.
    * **On Command Execution**: Before a command runs, it records the command. After it runs, it captures the exit code.
    * **On Error**: If the exit code is non-zero, the script will capture the `stderr` and send the failed command and its output to the daemon's local server for analysis.

2.  **Daemon Server (`src/linux-helper-daemon/server.ts`)**:
    * Add a new endpoint (e.g., `/api/terminal-error`) to receive data from the shell script.
    * When an error is received, the daemon will trigger the `analyze-last-error` action in the Electron app, which will show the popup with a suggested fix.

---

### **Phase 7: Learning & Personalization**

**Objective:** Adapt to the user's habits and coding style over time.

1.  **Data Storage (Electron App)**:
    * Integrate a simple, file-based database like SQLite (using `sqlite3`) into the main Electron app. The database file will be stored in the app's user data directory.
    * Create tables to store:
        * `interactions`: (timestamp, hotkey_action, accepted_command, source_language)
        * `common_errors`: (error_signature, successful_fix_command, count)

2.  **Personalized Prompts**:
    * Before calling the Gemini API, the `analyzeScreenshotWithLinuxHelper` function will query the local SQLite database.
    * It will retrieve the user's most common commands, previous successful fixes for similar errors, and preferred coding patterns.
    * This information will be added to a new "Personalization Context" section in the prompt, allowing the AI to tailor its suggestions to that specific user.
