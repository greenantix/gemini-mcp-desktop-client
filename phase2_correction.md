# Corrected Plan for Phase 2: The Perfect Popup

**Objective:** To implement a visually appealing, stable, and functional popup window that appears at the cursor's position upon a hotkey press. This plan replaces the current buggy implementation and uses the superior UI design from `LLM_Plan.md`.

---

### **Step 1: Simplify the Architecture (Daemon & Electron App)**

The current approach of a Node.js daemon spawning a separate Electron process for the popup is overly complex and prone to errors. We will simplify this:

1.  **Daemon's Role (Node.js - `src/linux-helper-daemon/`)**:
    * **Responsibilities**:
        * Register the global hotkey (e.g., F10).
        * Take the screenshot.
        * Get the cursor's X/Y coordinates at the moment the hotkey is pressed.
    * **Action**: When the hotkey is pressed, the daemon will immediately send a single message to the main Electron app via a simple WebSocket or HTTP request.

2.  **Main Electron App's Role (`electron/main.ts`)**:
    * **Responsibilities**:
        * Listen for messages from the daemon.
        * Create, show, and hide a frameless `BrowserWindow` (the popup).
        * Position the popup window using the X/Y coordinates received from the daemon.
        * Handle all AI analysis and communication with the Gemini API.
        * Manage the popup's state (loading, success, error).
        * Execute commands securely.

This division of labor is much cleaner: the daemon handles system-wide events, and the Electron app manages all GUI and logic.

### **Step 2: Unify and Adopt the Correct Popup UI**

We will discard the current, flawed popup code and use the excellent component from `LLM_Plan.md`.

1.  **Delete Obsolete Files**:
    * Delete the entire `src/linux-helper-popup/` directory.
    * Delete the `src/linux-helper-daemon/popup-window.ts` file.
    * Delete the `src/linux-helper-daemon/popup-controller.ts` file.

2.  **Create the New Popup Component**:
    * Create a new file: `src/components/LinuxHelperPopup.tsx`.
    * Copy the full React component code from `LLM_Plan.md` into this new file. This will be our single source of truth for the popup's UI.

### **Step 3: Implement the Communication Protocol**

The daemon and Electron app will communicate with simple messages.

* **Daemon -> Electron App**:
    * When F10 is pressed, the daemon sends:
        ```json
        {
          "type": "SHOW_POPUP",
          "payload": {
            "x": 1234, // cursor x
            "y": 567,  // cursor y
            "screenshotDataUrl": "data:image/png;base64,..."
          }
        }
        ```

* **Electron App -> Popup Window (IPC)**:
    * The main Electron process will send state updates to the popup's renderer process:
        ```javascript
        // In electron/main.ts, after receiving the daemon message
        popupWindow.webContents.send('update-state', {
            status: 'loading',
            title: 'Analyzing screenshot...',
            content: 'Processing your screen capture with AI'
        });

        // After AI analysis
        popupWindow.webContents.send('update-state', {
            status: 'success',
            title: 'Analysis Complete',
            suggestions: [ ... ]
        });
        ```

### **Step 4: Implement the Corrected Logic**

1.  **Daemon (`src/linux-helper-daemon/main.ts`)**:
    * On hotkey press:
        1.  Get cursor position using the `cursor-tracker.ts`.
        2.  Take a screenshot using `screenshot.ts`.
        3.  Send the `SHOW_POPUP` message (with coordinates and screenshot data URL) to the Electron app's server (e.g., `http://localhost:5001/api/helper-action`).

2.  **Electron Backend (`src/backend/`)**:
    * Create a new route to listen for the daemon's request (e.g., `POST /api/helper-action`).
    * This route will trigger the logic in the main Electron process.

3.  **Electron Main Process (`electron/main.ts`)**:
    * Create a function `showHelperPopup(x, y, screenshotDataUrl)`.
    * Inside this function:
        * Create a new frameless `BrowserWindow`.
        * Set its position using `popupWindow.setPosition(x, y)`.
        * Load the main app's URL with a specific route for the popup (e.g., `http://localhost:5173/#/popup`).
        * Immediately begin the AI analysis (`analyzeScreenshotWithLinuxHelper`).
        * Send `update-state` IPC messages to the popup window as the analysis progresses.

4.  **React App (`src/App.tsx` and `LinuxHelperPopup.tsx`)**:
    * Add a new route for `/popup` that renders only the `<LinuxHelperPopup />` component.
    * The `LinuxHelperPopup.tsx` component will use `ipcRenderer.on('update-state', ...)` to listen for state changes and update its UI accordingly.

### **Step 5: Fix the "Moving Popup" Dragging Logic**

The code in `LLM_Plan.md` is a great start. Here is the corrected logic to ensure smooth dragging without the popup jumping to the cursor.

* **In `src/components/LinuxHelperPopup.tsx`**:
    * The `handleMouseDown` function is **correct**. It calculates the initial offset of the mouse within the popup.
    * The `useEffect` for `handleMouseMove` is also **correct**. It calculates the new window position by subtracting the *initial offset* from the *current mouse position*. This prevents the jump.
    * **The Problem was Likely in Integration**: The previous implementation might have been fighting with a separate "follow cursor" logic. By centralizing all positioning logic within the main Electron process and only allowing the popup to control its own position during a drag-and-drop action, we eliminate this conflict. The popup should **not** have its own `setInterval` to check the global cursor position.

By following these steps, you will have a robust, single-responsibility architecture and a beautiful, functional popup that behaves exactly as expected.
