// Fallback popup process for Linux Helper daemon
const net = require('net');
const path = require('path');
const fs = require('fs');

const SOCKET_PATH = '/tmp/linux-helper-popup.sock';

class FallbackPopup {
  constructor() {
    this.server = null;
    this.currentState = { status: 'idle' };
    this.isVisible = false;
  }

  async start() {
    console.log('[Popup Process] Starting fallback popup server...');
    
    // Remove existing socket
    if (fs.existsSync(SOCKET_PATH)) {
      fs.unlinkSync(SOCKET_PATH);
    }

    this.server = net.createServer((socket) => {
      console.log('[Popup Process] Client connected');
      
      socket.on('data', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message, socket);
        } catch (error) {
          console.error('[Popup Process] Invalid message:', error);
        }
      });
      
      socket.on('close', () => {
        console.log('[Popup Process] Client disconnected');
      });
    });

    this.server.listen(SOCKET_PATH, () => {
      console.log('[Popup Process] Popup server listening on', SOCKET_PATH);
    });
  }

  handleMessage(message, socket) {
    console.log('[Popup Process] Received message:', message.type);
    
    switch (message.type) {
      case 'show':
        this.isVisible = true;
        this.currentState = message.data || { status: 'loading' };
        console.log('[Popup Process] Popup shown with state:', this.currentState.status);
        socket.write(JSON.stringify({ success: true, visible: true }));
        break;
        
      case 'hide':
        this.isVisible = false;
        console.log('[Popup Process] Popup hidden');
        socket.write(JSON.stringify({ success: true, visible: false }));
        break;
        
      case 'update':
        this.currentState = { ...this.currentState, ...message.data };
        console.log('[Popup Process] State updated:', this.currentState.status);
        socket.write(JSON.stringify({ success: true, state: this.currentState }));
        break;
        
      default:
        socket.write(JSON.stringify({ success: false, error: 'Unknown message type' }));
    }
  }

  async stop() {
    if (this.server) {
      this.server.close();
      console.log('[Popup Process] Server stopped');
    }
  }
}

const popup = new FallbackPopup();
popup.start().catch(console.error);

process.on('SIGINT', async () => {
  console.log('[Popup Process] Shutting down...');
  await popup.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[Popup Process] Terminating...');
  await popup.stop();
  process.exit(0);
});
