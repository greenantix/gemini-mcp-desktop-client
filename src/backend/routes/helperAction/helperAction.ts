import express from "express";

const router = express.Router();

// Get window references (this will be injected by the server)
let getPopupWindow: () => any | null;
let showHelperPopup: (x: number, y: number, screenshotDataUrl: string) => void;

export function setWindowReferences(
  _mainWindowGetter: () => any | null,
  popupWindowGetter: () => any | null,
  popupShowFunction: (x: number, y: number, screenshotDataUrl: string) => void
) {
  // We don't use mainWindowGetter currently, but keep it for future use
  getPopupWindow = popupWindowGetter;
  showHelperPopup = popupShowFunction;
}

// Handle daemon messages
router.post("/", async (req, res) => {
  try {
    const { type, payload } = req.body;

    switch (type) {
      case 'SHOW_POPUP':
        {
          const { x, y, screenshotDataUrl } = payload;
          console.log(`📱 Received SHOW_POPUP request at position: ${x}, ${y}`);
          
          // Show the popup window at the specified coordinates
          showHelperPopup(x, y, screenshotDataUrl);
          
          res.json({ success: true, message: 'Popup shown successfully' });
        }
        break;

      case 'SHOW_ERROR':
        {
          const { error, details } = payload;
          console.error(`❌ Received error from daemon: ${error}`, details);
          
          // Show error popup at center of screen (use default position)
          const centerX = 800;
          const centerY = 400;
          
          showHelperPopup(centerX, centerY, '');
          
          // Send error state to popup
          const popupWindow = getPopupWindow();
          if (popupWindow && !popupWindow.isDestroyed()) {
            popupWindow.webContents.send('update-state', {
              status: 'error',
              title: 'Daemon Error',
              content: error,
              error: details
            });
          }
          
          res.json({ success: true, message: 'Error popup shown' });
        }
        break;

      default:
        console.warn(`⚠️ Unknown helper action type: ${type}`);
        res.status(400).json({ 
          success: false, 
          error: `Unknown action type: ${type}` 
        });
    }

  } catch (error) {
    console.error('Failed to handle helper action:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Health check endpoint
router.get("/health", (_req, res) => {
  res.json({ 
    success: true, 
    message: 'Helper action endpoint is running',
    timestamp: new Date().toISOString()
  });
});

export default router;