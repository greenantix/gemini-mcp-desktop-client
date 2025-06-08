"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PopupManager = void 0;
const electron_1 = require("electron");
class PopupManager {
    constructor(theme, logger) {
        this.theme = theme;
        this.logger = logger;
        this.window = null;
        this.isVisible = false;
        this.currentState = { status: 'idle' };
    }
    async initialize() {
        // Popup window will be created on-demand
        this.logger.info('Popup manager initialized');
    }
    createPopupWindow() {
        const { width, height } = electron_1.screen.getPrimaryDisplay().workAreaSize;
        this.window = new electron_1.BrowserWindow({
            width: 400,
            height: 300,
            x: width - 420, // 20px from right edge
            y: 20, // 20px from top
            frame: false,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            transparent: true,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            }
        });
        // Load a simple HTML page for the popup
        const popupHtml = this.generatePopupHtml();
        this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(popupHtml)}`);
        this.window.on('closed', () => {
            this.window = null;
            this.isVisible = false;
        });
        // Hide window when it loses focus
        this.window.on('blur', () => {
            if (this.isVisible) {
                this.hide();
            }
        });
        return this.window;
    }
    generatePopupHtml() {
        const isDark = this.theme === 'dark' || (this.theme === 'auto' && true); // Assume dark for now
        return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          margin: 0;
          padding: 16px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: ${isDark ? '#2d2d2d' : '#ffffff'};
          color: ${isDark ? '#ffffff' : '#000000'};
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
          max-width: 100%;
          font-size: 14px;
          line-height: 1.4;
        }
        
        .header {
          display: flex;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid ${isDark ? '#444' : '#eee'};
        }
        
        .title {
          font-weight: 600;
          font-size: 16px;
          margin-left: 8px;
        }
        
        .content {
          margin-bottom: 16px;
          line-height: 1.5;
        }
        
        .suggestions {
          margin-bottom: 12px;
        }
        
        .suggestion {
          padding: 8px 12px;
          margin: 4px 0;
          background: ${isDark ? '#383838' : '#f5f5f5'};
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        
        .suggestion:hover {
          background: ${isDark ? '#484848' : '#e5e5e5'};
        }
        
        .suggestion-title {
          font-weight: 500;
          margin-bottom: 2px;
        }
        
        .suggestion-desc {
          font-size: 12px;
          opacity: 0.8;
        }
        
        .loading {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        
        .spinner {
          width: 20px;
          height: 20px;
          border: 2px solid ${isDark ? '#666' : '#ccc'};
          border-top: 2px solid ${isDark ? '#fff' : '#333'};
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 12px;
        }
        
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .error {
          color: #ff6b6b;
          padding: 12px;
          background: ${isDark ? '#4a2929' : '#ffe5e5'};
          border-radius: 4px;
          margin-bottom: 12px;
        }
        
        .close-btn {
          position: absolute;
          top: 8px;
          right: 8px;
          background: none;
          border: none;
          color: ${isDark ? '#999' : '#666'};
          cursor: pointer;
          font-size: 18px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
        }
        
        .close-btn:hover {
          background: ${isDark ? '#444' : '#eee'};
        }
      </style>
    </head>
    <body>
      <button class="close-btn" onclick="window.close()">×</button>
      <div id="popup-content">
        <div class="loading">
          <div class="spinner"></div>
          <span>Initializing...</span>
        </div>
      </div>
      
      <script>
        // This will be updated via IPC or direct DOM manipulation
        window.updatePopupState = function(state) {
          const content = document.getElementById('popup-content');
          
          if (state.status === 'loading') {
            content.innerHTML = \`
              <div class="loading">
                <div class="spinner"></div>
                <span>\${state.title || 'Loading...'}</span>
              </div>
            \`;
          } else if (state.status === 'error') {
            content.innerHTML = \`
              <div class="error">
                <strong>Error:</strong> \${state.error || 'Unknown error'}
              </div>
            \`;
          } else if (state.status === 'success') {
            let html = \`
              <div class="header">
                <span class="title">\${state.title || 'Analysis Complete'}</span>
              </div>
            \`;
            
            if (state.content) {
              html += \`<div class="content">\${state.content}</div>\`;
            }
            
            if (state.suggestions && state.suggestions.length > 0) {
              html += '<div class="suggestions">';
              state.suggestions.forEach((suggestion, index) => {
                html += \`
                  <div class="suggestion" onclick="executeCommand('\${suggestion.command}')">
                    <div class="suggestion-title">\${suggestion.title}</div>
                    <div class="suggestion-desc">\${suggestion.description}</div>
                  </div>
                \`;
              });
              html += '</div>';
            }
            
            content.innerHTML = html;
          }
        };
        
        window.executeCommand = function(command) {
          // This will be handled by the main process
          console.log('Executing command:', command);
          // For now, just close the popup
          window.close();
        };
      </script>
    </body>
    </html>
    `;
    }
    async showLoadingState() {
        if (!this.window) {
            this.createPopupWindow();
        }
        this.currentState = { status: 'loading', title: 'Analyzing screenshot...' };
        this.updateWindowContent();
        if (this.window && !this.isVisible) {
            this.window.show();
            this.isVisible = true;
            this.logger.debug('Popup shown in loading state');
        }
    }
    async showResults(analysis) {
        this.currentState = {
            status: 'success',
            title: 'Analysis Complete',
            content: analysis.summary || 'Analysis completed',
            suggestions: analysis.suggestions || []
        };
        this.updateWindowContent();
        this.logger.debug('Popup updated with results');
    }
    async showError(error) {
        this.currentState = {
            status: 'error',
            error: error
        };
        this.updateWindowContent();
        this.logger.debug('Popup updated with error');
    }
    updateWindowContent() {
        if (this.window && this.window.webContents) {
            this.window.webContents.executeJavaScript(`window.updatePopupState(${JSON.stringify(this.currentState)})`);
        }
    }
    updateState(state) {
        this.currentState = { ...this.currentState, ...state };
        this.updateWindowContent();
    }
    hide() {
        if (this.window) {
            this.window.hide();
            this.isVisible = false;
            this.logger.debug('Popup hidden');
        }
    }
    show(position) {
        if (!this.window) {
            this.createPopupWindow();
        }
        if (position && this.window) {
            this.window.setPosition(position.x, position.y);
        }
        if (this.window) {
            this.window.show();
            this.isVisible = true;
            this.logger.debug('Popup shown');
        }
    }
    isPopupVisible() {
        return this.isVisible;
    }
    onCommand(callback) {
        this.commandCallback = callback;
    }
    async cleanup() {
        if (this.window) {
            this.window.close();
            this.window = null;
        }
        this.isVisible = false;
        this.logger.info('Popup manager cleaned up');
    }
}
exports.PopupManager = PopupManager;
//# sourceMappingURL=popup-window.js.map