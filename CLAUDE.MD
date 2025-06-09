The following steps will be executed sequentially by the LLM agent to diagnose and resolve the identified issues.
Phase 1: Core Functionality & Communication Overhaul

Objective: Establish reliable inter-process communication (IPC) and a robust hotkey system to ensure screenshots are captured, analyzed, and sent to the main application correctly.

    Analyze and Centralize Hotkey Logic in the Daemon:
        Action: Examine src/linux-helper-daemon/main.ts and src/linux-helper-daemon/x11-hotkey.js to understand the current hotkey detection mechanism.

Diagnosis: The current system relies on xinput parsing and potentially globalShortcut in Electron, which is brittle. The daemon should be the single source of truth for global input events.
Modification: Refactor src/linux-helper-daemon/main.ts to use a more robust Node.js library for raw input events on Linux if xinput parsing proves unreliable. If a library is not feasible, enhance the existing xinput stdout parsing to be "rock-solid". The daemon must be configured from settings to listen for a specific button (e.g., button 9 for the forward mouse button).
Expected Outcome: The daemon (src/linux-helper-daemon/main.ts) reliably detects the configured hotkey (e.g., Forward Mouse Button) and is the only component responsible for this.

Simplify the Daemon's Role:

    Action: Review src/linux-helper-daemon/main.ts , src/linux-helper-daemon/cursor-tracker.ts , and src/linux-helper-daemon/screenshot.ts.

Diagnosis: The daemon might be attempting too many tasks. Its core responsibilities should be streamlined.
Modification: Ensure the daemon's only jobs are:

    Listen for the configured hotkey.

On press, get cursor coordinates using cursor-tracker.ts.
On press, take a screenshot using screenshot.ts.
Send a single IPC message to the main Electron process with the payload: { screenshotDataUrl: '...', cursorPosition: {x, y} }.

Constraint: The daemon should not create or manage any windows; it is a headless event listener.

    Expected Outcome: The daemon becomes a lean, efficient event and data collection service, communicating exclusively with the main process via IPC.

Refactor Main Electron Process for Hotkey Reception:

    Action: Analyze electron/main.ts and electron/hotkey-handler.ts.

Diagnosis: electron/main.ts might still have globalShortcut registrations that conflict with the daemon's role.
Modification:

    Remove all globalShortcut registrations for the helper functionality from electron/main.ts.

Set up an IPC listener (e.g., ipcMain.on('hotkey-pressed', ...) ) in electron/main.ts.
When this event is received from the daemon, the main process will orchestrate the dual-output response (popup and main window analysis).

        Expected Outcome: The main Electron process correctly receives hotkey events from the daemon and initiates the dual-output workflow.

Phase 2: Dual-Output Workflow Implementation & Refinement

Objective: Implement the intended two-part response flow: an immediate, small popup at the cursor, and a more detailed analysis in the main application window.

    Implement Dual-Output Flow in Main Process:
        Action: Focus on electron/main.ts and src/components/LinuxHelper.tsx.

Diagnosis: The current dual-output flow is likely incomplete or incorrectly orchestrated.
Modification:

    In electron/main.ts , upon receiving the hotkey-pressed IPC message from the daemon: 

    Action A (Popup): Create a new BrowserWindow for the popup (if one doesn't exist). Use the cursorPosition from the payload to position the window near the mouse. Show the window. Send the screenshotDataUrl to the popup window's renderer process via popupWindow.webContents.send('display-screenshot', ...).

Action B (Main Client): Send the same screenshotDataUrl to the main chat window's renderer process via mainWindow.webContents.send('analyze-screenshot', ...).

    Expected Outcome: Pressing the hotkey triggers both a popup at the cursor and initiates analysis in the main chat window.

Refine Popup Renderer (src/linux-helper-popup/popup.tsx):

    Action: Examine src/linux-helper-popup/popup.tsx , src/linux-helper-popup/popup.html , and src/linux-helper-popup/styles.css.

Diagnosis: The popup styling and functionality are "terrible". The pin and close buttons are non-functional.
Modification:

    In src/linux-helper-popup/popup.tsx: 

    Ensure it listens for the display-screenshot event from the main process.

Implement logic to show the screenshot and quick action buttons ("Explain," "Copy Text," etc.).
Make the pin button functional, allowing the popup to remain visible and not hide on blur.
Make the close button functional, properly hiding or destroying the popup window.
Ensure src/linux-helper-popup/popup.html and src/linux-helper-popup/styles.css are correctly linked and applied, making the window frameless and transparent with dark background, rounded corners, and orange accent color for highlights and buttons.
The design should be minimalist and sleek.

    Expected Outcome: The popup appears correctly, displays the screenshot, offers quick actions, and its pin/close buttons work as expected, adhering to the Pop!_OS dark theme.

Integrate Analysis into Main Client Renderer:

    Action: Review src/components/LinuxHelper.tsx and src/screens/Chat/ChatPage.tsx.

Diagnosis: The analysis results are not consistently displayed in the main chat window.
Modification:

    In src/components/LinuxHelper.tsx , ensure it listens for the analyze-screenshot event from the main process.

Trigger the full Gemini analysis when this event is received.
Display the verbose response as a new message in the ChatPage.

        Expected Outcome: Detailed AI analysis appears as a chat message in the main application.

Phase 3: Settings System Unification & Persistence

Objective: Consolidate disparate settings interfaces into a single, functional, and persistent system.

    Consolidate Settings UI:
        Action: Examine src/screens/McpSettingsPage/McpSettingsPage.tsx , src/screens/ServerConfiguration/ServerConfiguration.tsx , and src/screens/Settings/SettingsPage.tsx.

Diagnosis: Users are presented with multiple settings pages, leading to fragmentation and confusion.
Modification:

    Deprecate and remove the routes and components for McpSettingsPage and ServerConfiguration.

Merge all essential configuration options (including MCP server management, Gemini API key, hotkey selection, screenshot location, theme, etc.) into a single, comprehensive SettingsPage component (src/screens/Settings/SettingsPage.tsx).
Add a dropdown/input field in the UI for "AI Helper Hotkey" with options like "Forward Mouse Button", "Middle Mouse Button", "F10", etc..

    Expected Outcome: A single, intuitive settings interface handles all application configurations.

Centralize State Management in Main Process:

    Action: Focus on electron/main.ts.

Diagnosis: Settings changes do not persist reliably across application sessions.
Modification:

    The main Electron process (electron/main.ts) will be the sole manager of the settings.json file stored in app.getPath('userData').

Implement the following IPC handlers in electron/main.ts:

    ipcMain.handle('get-settings', ...): Reads settings.json and returns the settings object to the renderer.

ipcMain.handle('save-settings', ...): Receives a new settings object from the renderer, writes it to settings.json, and applies the settings immediately (e.g., tells the daemon to update its hotkey listener).

    Expected Outcome: All application settings are managed centrally and persist correctly.

Refactor Settings React Component:

    Action: Update src/screens/Settings/SettingsPage.tsx.

Diagnosis: The settings UI needs to interact with the new centralized state management.
Modification:

    On component mount, use window.api.getSettings() to fetch and display the current settings.

When the user clicks "Save", send the entire updated settings object back to the main process via window.api.saveSettings(newSettings).

        Expected Outcome: The settings UI correctly loads and saves settings via IPC.

Phase 4: UI/UX Polish (Pop!_OS Theme)

Objective: Re-theme the application to match the modern, sleek aesthetic of the Pop!_OS dark theme.

    Update the MUI Theme:
        Action: Review src/theme.ts.

Diagnosis: The application's visual theme does not feel integrated with the target Pop!_OS desktop environment.
Modification:

    Research the official Pop!_OS dark theme color palette and update the createTheme object in src/theme.ts.

Set palette.mode to 'dark'.
Apply colors: Background: Dark charcoal (e.g., #333130). Primary/Accent: Pop!_OS Orange (e.g., #E95420, #FAA41A). Secondary Accent: Pop!_OS Teal (e.g., #48B9C7). Text: Off-white (#F6F6F6).
Use a font like "Fira Sans" or "Roboto" to match the OS.

    Expected Outcome: The main application window adheres to the Pop!_OS dark theme.

Style the At-Cursor Popup:

    Action: Review src/linux-helper-popup/popup.html and src/linux-helper-popup/styles.css.

Diagnosis: The popup's styling is inconsistent with the desired Pop!_OS theme and overall aesthetic.
Modification:

    Update the CSS in src/linux-helper-popup/popup.html and src/linux-helper-popup/styles.css to match the new theme.

Make the popup window frameless and transparent.
Ensure the content body has a dark background (#333130), rounded corners, and uses the orange accent color (#FAA41A) for highlights and buttons.
The design should be minimalist and sleek.

    Expected Outcome: The popup is visually consistent with the main application and the Pop!_OS theme.

Review Components for Theming:

    Action: Audit src/screens/Chat/ChatPage.tsx , src/screens/Chat/MessageItem.tsx, and other relevant React components.

Diagnosis: Components might use hardcoded colors instead of theme variables.
Modification: Ensure components use theme variables (e.g., theme.palette.primary.main, theme.palette.background.paper) instead of hardcoded colors.

        Expected Outcome: All UI elements dynamically adapt to the selected theme.

Phase 5: Debugging, Testing & Refinement

Objective: Ensure all implemented features work as expected and the application is stable.

    Comprehensive Testing:
        Action: Utilize existing test scripts like debug-mouse.sh , quick-test.sh , simple-test.sh , test-buttons.sh , test-daemon-only.sh , test-everything.sh , test-forward-button.sh , test-mouse-button.sh , and test-mouse.sh.

Diagnosis: The "MOCK issues" with screenshot analysis and popup functionality indicate a need for rigorous testing.
Modification: Run all provided test scripts. Specifically, verify:

    debug-mouse.sh confirms button 9 is detected for the forward mouse button.

quick-test.sh and test-forward-button.sh accurately detect the forward button.
test-daemon-only.sh verifies the daemon correctly logs button presses.
test-everything.sh confirms the full stack (daemon, backend, app) starts and the popup appears.

    Expected Outcome: All tests pass, confirming basic functionality and hotkey detection.

Logging and Error Handling:

    Action: Review src/linux-helper-daemon/logger.ts , src/linux-helper-daemon/main.ts , and electron/main.ts.

Diagnosis: Effective debugging requires clear and comprehensive logging.
Modification:

    Ensure robust error logging in src/linux-helper-daemon/main.ts and electron/main.ts to capture IPC errors, hotkey detection failures, and other runtime issues.

Utilize src/linux-helper-daemon/logger.ts for consistent logging within the daemon.

    Expected Outcome: Detailed logs are available for troubleshooting, aiding in identifying and fixing any remaining "MOCK issues" or new bugs.

Refactorings and Cleanup:

    Action: Perform general code cleanup and ensure adherence to best practices.
    Diagnosis: Code might be convoluted due to previous attempts to fix issues.

Modification:

    Remove any redundant code or commented-out sections.
    Ensure consistent naming conventions and modularity.
    Optimize performance where possible (e.g., debouncing hotkey events).

Expected Outcome: A clean, maintainable, and efficient codebase.
