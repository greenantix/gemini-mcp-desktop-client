import { globalShortcut } from 'electron';
import { popupWindow } from '../src/linux-helper-popup/window-handler';

interface HelperState {
  isWaitingForSecondHotkey: boolean;
  lastScreenshot?: string;
}

const helperState: HelperState = {
  isWaitingForSecondHotkey: false
};

// Import these from your existing code
const captureActiveMonitorScreenshot = async (): Promise<{ dataUrl: string } | null> => {
  // Implement screenshot capture or import from existing code
  return { dataUrl: 'data:image/png;base64,example' };
};

const analyzeScreenshotWithLinuxHelper = async (screenshotDataUrl: string) => {
  // Implement AI analysis or import from existing code
  return {
    summary: 'Analysis of your screen',
    details: 'Detailed explanation'
  };
};

const parseCommandsFromAnalysis = (analysis: any) => {
  // Extract commands from AI analysis
  return [
    {
      title: 'Quick Fix',
      command: 'npm run lint:fix',
      description: 'Auto-fix linting errors'
    },
    {
      title: 'Fix & Commit',
      command: 'npm run lint:fix && git add . && git commit -m "fix: linting"',
      description: 'Fix and commit changes'
    }
  ];
};

async function handleLinuxHelperHotkey() {
  if (!helperState.isWaitingForSecondHotkey) {
    // Show popup immediately
    popupWindow.show();

    // Update state to loading
    popupWindow.updateState({
      status: 'loading',
      title: 'Analyzing screenshot...',
      content: 'Processing your screen capture with AI'
    });

    // Capture screenshot
    const screenshotData = await captureActiveMonitorScreenshot();

    if (screenshotData) {
      helperState.lastScreenshot = screenshotData.dataUrl;

      // Analyze screenshot
      try {
        const analysis = await analyzeScreenshotWithLinuxHelper(screenshotData.dataUrl);

        // Parse the analysis and update popup
        const suggestions = parseCommandsFromAnalysis(analysis);

        popupWindow.updateState({
          status: 'success',
          title: 'Analysis Complete',
          content: analysis.summary || 'Found issues in your code',
          suggestions: suggestions
        });

        helperState.isWaitingForSecondHotkey = true;
      } catch (error: any) {
        popupWindow.updateState({
          status: 'error',
          title: 'Analysis Failed',
          content: 'Could not analyze screenshot',
          error: error.message
        });
      }
    }
  } else {
    // Second hotkey - execute first suggestion
    if (popupWindow.isVisible()) {
      // Let the popup handle execution
      popupWindow.updateState({ executeFirst: true });
    }
    helperState.isWaitingForSecondHotkey = false;
  }
}

export function registerLinuxHelperHotkey() {
  // Register F10 hotkey
  globalShortcut.register('F10', handleLinuxHelperHotkey);

  return () => {
    // Unregister when app is shutting down
    globalShortcut.unregisterAll();
  };
}
