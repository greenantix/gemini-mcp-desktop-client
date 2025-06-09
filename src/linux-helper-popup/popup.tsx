import React from 'react';
import ReactDOM from 'react-dom/client';
import PopupWindow from './components/PopupWindow';
import './styles.css';

// Handle IPC messages from main process
if (window.electron) {
  window.electron.ipcRenderer.on('state-update', (_event, state) => {
    // Update the popup state
    window.dispatchEvent(new CustomEvent('popup-state-update', { detail: state }));
  });

  // Handle screenshot display from main process
  window.electron.ipcRenderer.on('display-screenshot', (_event, screenshotDataUrl) => {
    console.log('📸 Received screenshot for display:', screenshotDataUrl?.substring(0, 50) + '...');
    // TODO: Trigger AI analysis with the screenshot
    window.dispatchEvent(new CustomEvent('popup-state-update', { 
      detail: { 
        status: 'loading',
        title: 'Analyzing Screenshot...',
        content: 'AI is analyzing your screen capture'
      } 
    }));
    
    // Simulate analysis completion (in real implementation, this would call AI service)
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('popup-state-update', { 
        detail: { 
          status: 'success',
          title: 'Analysis Complete',
          content: 'Found potential improvements in your code',
          suggestions: [
            {
              title: 'Fix Linting Issues',
              command: 'npm run lint:fix',
              description: 'Automatically fix code style issues'
            },
            {
              title: 'Run Tests',
              command: 'npm test',
              description: 'Execute test suite to verify changes'
            },
            {
              title: 'Commit Changes',
              command: 'git add . && git commit -m "fix: lint and format"',
              description: 'Stage and commit your fixes'
            }
          ]
        } 
      }));
    }, 2000);
  });
}

// Render the popup
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <PopupWindow />
  </React.StrictMode>
);
