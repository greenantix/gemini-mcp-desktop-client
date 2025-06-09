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
    
    // Show the screenshot in the popup with quick action buttons
    window.dispatchEvent(new CustomEvent('popup-state-update', { 
      detail: { 
        status: 'ready',
        title: 'Screenshot Captured',
        content: 'Choose a quick action',
        screenshot: screenshotDataUrl,
        suggestions: [
          {
            title: 'Explain This',
            command: 'analyze-explain',
            description: 'Get AI explanation of what you see'
          },
          {
            title: 'Copy Text',
            command: 'extract-text',
            description: 'Extract and copy any text from image'
          },
          {
            title: 'Quick Fix',
            command: 'suggest-fix',
            description: 'Get suggestions for improvements'
          }
        ]
      } 
    }));
  });
}

// Render the popup
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <PopupWindow />
  </React.StrictMode>
);
