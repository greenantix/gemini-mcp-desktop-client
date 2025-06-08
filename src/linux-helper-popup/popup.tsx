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
}

// Render the popup
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <React.StrictMode>
    <PopupWindow />
  </React.StrictMode>
);
