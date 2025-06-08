Project Cleanup & Refinement: Linux Helper Assistant
1. Project Overview
This document outlines a refactoring and cleanup plan for the Linux Helper Assistant, an Electron-based desktop application for Pop!_OS. The application integrates a Gemini-based AI to provide contextual help to developers, triggered by a global hotkey.
The current architecture consists of four main parts:
Electron Main Process (electron/): Manages windows, application state, and inter-process communication (IPC).
React Frontend (src/): The primary user interface, built with React and MUI, for chat and settings.
Linux Helper Daemon (src/linux-helper-daemon/): A background Node.js process responsible for low-level system tasks like listening for global hotkeys (mouse and keyboard) and taking screenshots.
Linux Helper Popup (src/linux-helper-popup/): A small, secondary window intended to appear at the cursor's position to show quick actions.
The core issues stem from convoluted communication between these parts, an overly complex and unreliable hotkey system, and a fragmented settings interface.
2. Core Objectives
The goal of this cleanup is to create a stable, intuitive, and polished user experience.
Fix Hotkey System: Implement a reliable hotkey system with the Forward Mouse Button as the primary, working trigger.
Unify Settings: Consolidate the multiple settings pages into a single, functional, and persistent settings system.
Refine UI/UX: Re-theme the application to match the modern, sleek aesthetic of the Pop!_OS dark theme.
Implement Dual-Output Flow: Ensure the intended two-part response works correctly: an immediate, small popup at the cursor, and a more detailed analysis in the main application window.
3. Action Plan: Step-by-Step Guide
Section 1: Hotkey & Daemon Architecture Overhaul
Problem: The current system for detecting hotkeys is fragile. It appears to use a mix of Electron's globalShortcut, shell scripts, and a daemon parsing xinput stdout. This is unreliable. The daemon should be the single source of truth for global input events.
Action Steps:
Centralize Hotkey Logic in the Daemon:
The linux-helper-daemon must be the only component responsible for listening for global hotkeys (both keyboard and mouse). This eliminates conflicts with Electron's globalShortcut.
File to Modify: src/linux-helper-daemon/main.ts.
Implement Reliable Mouse Button Detection:
The current method of spawning and parsing xinput is brittle.
Task: Replace the xinput test-xi2 logic in src/linux-helper-daemon/x11-hotkey.js (or its TypeScript source) with a more robust Node.js library designed for listening to raw input events on Linux, such as iohook or a similar native addon. If a library is not feasible, the stdout parsing must be made rock-solid, handling all edge cases.
The daemon should be configured from the settings file to listen for a specific button (e.g., button 9 for the forward mouse button).
Simplify the Daemon's Role:
The daemon's only jobs are:
Listen for the configured hotkey.
On press, get the cursor coordinates (using cursor-tracker.ts).
On press, take a screenshot (using screenshot.ts).
Send a single IPC message to the main Electron process with the payload: { screenshotDataUrl: '...', cursorPosition: {x, y} }.
CRITICAL: The daemon should not create or manage any windows. It is a headless event listener.
Refactor the Main Electron Process (electron/main.ts):
Remove all globalShortcut registration for the helper functionality.
Set up an IPC listener (e.g., ipcMain.on('hotkey-pressed', ...)).
When this event is received from the daemon, the main process will orchestrate the dual-output response. (See Section 4 for the flow).
Section 2: Settings System Unification
Problem: The user is faced with three different settings pages (McpSettingsPage, ServerConfiguration, SettingsPage), and changes do not persist reliably.
Action Steps:
Consolidate UI:
Deprecate and remove the routes and components for McpSettingsPage and ServerConfiguration.
Merge all essential configuration options into a single, comprehensive SettingsPage component.
File to Modify: src/screens/Settings/SettingsPage.tsx.
New Feature: Add a dropdown/input field in the UI for "AI Helper Hotkey". This should include options like "Forward Mouse Button", "Middle Mouse Button", "F10", etc.
Centralize State Management in Main Process:
The main Electron process (electron/main.ts) will be the sole manager of the settings.json file stored in app.getPath('userData').
Task: Implement the following IPC handlers in electron/main.ts:
ipcMain.handle('get-settings', ...): Reads settings.json and returns the settings object to the renderer.
ipcMain.handle('save-settings', ...): Receives a new settings object from the renderer, writes it to settings.json, and applies the settings immediately (e.g., tells the daemon to update its hotkey listener).
Refactor the Settings React Component:
On component mount, use window.api.getSettings() to fetch and display the current settings.
When the user clicks "Save", send the entire updated settings object back to the main process via window.api.saveSettings(newSettings).
Section 3: UI/UX Polish (Pop!_OS Theme)
Problem: The application's visual theme does not feel integrated with the target Pop!_OS desktop environment.
Action Steps:
Update the MUI Theme (src/theme.ts):
Research the official Pop!_OS dark theme color palette.
Background: Dark charcoal (e.g., #333130).
Primary/Accent: Pop!_OS Orange (e.g., #E95420).
Secondary Accent: Pop!_OS Teal (e.g., #48B9C7).
Text: Off-white.
Task: Update the createTheme object in src/theme.ts with these new colors. Ensure palette.mode is 'dark'. Use a font like "Fira Sans" or "Roboto" to match the OS.
Style the At-Cursor Popup (src/linux-helper-popup/popup.html):
This is a separate HTML file and its CSS must be updated to match the new theme.
Task: Make the popup window frameless and transparent. The content body should have a dark background, rounded corners, and use the orange accent color for highlights and buttons. The design should be minimalist and sleek.
Review Components for Theming:
Audit the main React components (ChatPage, MessageItem, etc.) to ensure they use theme variables (primary.main, background.paper) instead of hardcoded colors.
Section 4: Implementing the Dual-Output Workflow
Problem: The intended flow of a quick popup and a verbose chat response is not working. This plan clarifies the new, simplified data flow.
Action Steps (The New Flow):
User Presses Hotkey.
The Daemon detects it, captures the screen/cursor, and sends the hotkey-pressed IPC message to the main process.
The Main Process (electron/main.ts), upon receiving the message, performs two actions:
Action A (Popup):
Creates a new BrowserWindow for the popup (if one doesn't exist).
Uses the cursorPosition from the payload to position the window near the mouse.
Shows the window.
Sends the screenshotDataUrl to the popup window's renderer process via popupWindow.webContents.send('display-screenshot', ...)
Action B (Main Client):
Sends the same screenshotDataUrl to the main chat window's renderer process via mainWindow.webContents.send('analyze-screenshot', ...)
The Popup Renderer (src/linux-helper-popup/popup.js):
Listens for the display-screenshot event and shows the image and quick action buttons ("Explain," "Copy Text," etc.).
The Main Client Renderer (src/components/LinuxHelper.tsx):
Listens for the analyze-screenshot event.
Triggers the full Gemini analysis.
Displays the verbose response as a new message in the ChatPage.
