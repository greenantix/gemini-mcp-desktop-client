// This file is kept for backward compatibility
// New code should use the LinuxHelperPopup class from src/linux-helper-popup/window-handler.ts

import { BrowserWindow, screen } from 'electron';
import path from 'path';
import { popupWindow } from '../linux-helper-popup/window-handler';

export class PopupWindow {
  private window: BrowserWindow | null = null;

  show(position?: { x: number, y: number }) {
    // Delegate to the new implementation
    popupWindow.show(position);
  }

  hide() {
    // Delegate to the new implementation
    popupWindow.hide();
  }

  send(channel: string, data: any) {
    // Delegate to the new implementation
    popupWindow.updateState(data);
  }
}