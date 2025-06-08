"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CursorTracker = void 0;
const child_process_1 = require("child_process");
class CursorTracker {
    constructor(logger) {
        this.lastPosition = { x: 0, y: 0 };
        this.trackingMethod = 'fallback';
        this.logger = logger;
        this.detectTrackingMethod();
    }
    detectTrackingMethod() {
        try {
            // Try xdotool first (most reliable)
            (0, child_process_1.execSync)('which xdotool', { stdio: 'ignore' });
            this.trackingMethod = 'xdotool';
            this.logger.debug('Using xdotool for cursor tracking');
            return;
        }
        catch { }
        try {
            // Try xwininfo as fallback
            (0, child_process_1.execSync)('which xwininfo', { stdio: 'ignore' });
            this.trackingMethod = 'xwininfo';
            this.logger.debug('Using xwininfo for cursor tracking');
            return;
        }
        catch { }
        this.logger.warn('No cursor tracking tools found, using fallback method');
        this.trackingMethod = 'fallback';
    }
    async getCurrentPosition() {
        try {
            switch (this.trackingMethod) {
                case 'xdotool':
                    return await this.getPositionWithXdotool();
                case 'xwininfo':
                    return await this.getPositionWithXwininfo();
                default:
                    return this.getFallbackPosition();
            }
        }
        catch (error) {
            this.logger.error('Failed to get cursor position:', error);
            return this.lastPosition;
        }
    }
    async getPositionWithXdotool() {
        const output = (0, child_process_1.execSync)('xdotool getmouselocation --shell', { encoding: 'utf8' });
        const lines = output.trim().split('\n');
        let x = 0, y = 0, screenX = 0, screenY = 0;
        for (const line of lines) {
            const [key, value] = line.split('=');
            switch (key) {
                case 'X':
                    x = parseInt(value, 10);
                    break;
                case 'Y':
                    y = parseInt(value, 10);
                    break;
                case 'SCREEN':
                    // Get screen dimensions if available
                    try {
                        const screenInfo = (0, child_process_1.execSync)(`xdpyinfo | grep dimensions`, { encoding: 'utf8' });
                        const match = screenInfo.match(/dimensions:\s+(\d+)x(\d+)/);
                        if (match) {
                            screenX = parseInt(match[1], 10);
                            screenY = parseInt(match[2], 10);
                        }
                    }
                    catch { }
                    break;
            }
        }
        const position = {
            x,
            y,
            screen: screenX && screenY ? {
                width: screenX,
                height: screenY,
                x: 0,
                y: 0
            } : undefined
        };
        this.lastPosition = position;
        return position;
    }
    async getPositionWithXwininfo() {
        // This is less reliable but works as a fallback
        try {
            const output = (0, child_process_1.execSync)('xwininfo -root -tree | grep "Absolute upper-left X" | head -1', { encoding: 'utf8' });
            const match = output.match(/Absolute upper-left X:\s+(\d+)/);
            if (match) {
                // This method is less precise, we'd need to implement mouse tracking differently
                // For now, return center of screen as approximation
                const position = {
                    x: parseInt(match[1], 10) || 960,
                    y: 540 // Approximate center
                };
                this.lastPosition = position;
                return position;
            }
        }
        catch (error) {
            this.logger.debug('xwininfo method failed:', error);
        }
        return this.getFallbackPosition();
    }
    getFallbackPosition() {
        // Fallback: assume center of a 1920x1080 screen
        // In real implementation, this could try to read from /proc or other methods
        const position = {
            x: 960,
            y: 540,
            screen: {
                width: 1920,
                height: 1080,
                x: 0,
                y: 0
            }
        };
        this.lastPosition = position;
        return position;
    }
    getLastKnownPosition() {
        return this.lastPosition;
    }
    async getScreenInfo() {
        try {
            // Try to get screen resolution
            const output = (0, child_process_1.execSync)('xdpyinfo | grep dimensions', { encoding: 'utf8' });
            const match = output.match(/dimensions:\s+(\d+)x(\d+)/);
            if (match) {
                return {
                    width: parseInt(match[1], 10),
                    height: parseInt(match[2], 10)
                };
            }
        }
        catch (error) {
            this.logger.debug('Failed to get screen info:', error);
        }
        return null;
    }
    /**
     * Install required tools for cursor tracking
     */
    static getInstallInstructions() {
        return `
To enable precise cursor tracking, install one of these tools:

# Ubuntu/Debian/Pop!_OS:
sudo apt install xdotool

# Or alternatively:
sudo apt install x11-utils

# Fedora:
sudo dnf install xdotool

# Arch Linux:
sudo pacman -S xdotool
`;
    }
    /**
     * Check if cursor tracking is available
     */
    isTrackingAvailable() {
        return this.trackingMethod !== 'fallback';
    }
    getTrackingMethod() {
        return this.trackingMethod;
    }
}
exports.CursorTracker = CursorTracker;
//# sourceMappingURL=cursor-tracker.js.map