"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.X11HotkeyManager = void 0;
const child_process_1 = require("child_process");
class X11HotkeyManager {
    constructor(hotkey, logger) {
        this.hotkey = hotkey;
        this.logger = logger;
        this.isRunning = false;
    }
    async start() {
        if (this.isRunning) {
            this.logger.warn('X11 hotkey monitor already running');
            return;
        }
        try {
            await this.startMonitoring();
            this.isRunning = true;
            this.logger.info(`X11 hotkey monitoring started for: ${this.hotkey}`);
        }
        catch (error) {
            this.logger.error('Failed to start X11 hotkey monitoring:', error);
            throw error;
        }
    }
    async startMonitoring() {
        const buttonMapping = this.getButtonMapping(this.hotkey);
        if (buttonMapping.type === 'mouse' && buttonMapping.button !== undefined) {
            await this.startMouseMonitoring(buttonMapping.button);
        }
        else if (buttonMapping.type === 'keyboard' && buttonMapping.key !== undefined) {
            await this.startKeyboardMonitoring(buttonMapping.key);
        }
        else {
            throw new Error(`Invalid hotkey configuration: ${this.hotkey}`);
        }
    }
    getButtonMapping(hotkey) {
        const mouseButtons = {
            'MiddleClick': 2,
            'Button1': 1,
            'Button2': 2,
            'Button3': 3,
            'Button4': 4,
            'Button5': 5,
            'Button8': 8,
            'Button9': 9,
            'LeftClick': 1,
            'RightClick': 3,
            'ForwardButton': 9,
            'BackButton': 8
        };
        if (mouseButtons[hotkey]) {
            return { type: 'mouse', button: mouseButtons[hotkey] };
        }
        else {
            return { type: 'keyboard', key: hotkey };
        }
    }
    async startMouseMonitoring(button) {
        this.logger.info(`Starting mouse button monitoring for button ${button}`);
        // Use xinput to monitor mouse events
        this.monitorProcess = (0, child_process_1.spawn)('xinput', ['test-xi2', '--root'], {
            stdio: ['ignore', 'pipe', 'pipe']
        });
        let lastEventTime = 0;
        const debounceMs = 500; // Prevent double-clicks
        this.monitorProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            // Look for button press events
            const lines = output.split('\n');
            for (const line of lines) {
                if (line.includes('ButtonPress') && line.includes(`detail: ${button}`)) {
                    const now = Date.now();
                    if (now - lastEventTime > debounceMs) {
                        lastEventTime = now;
                        this.logger.debug(`Mouse button ${button} pressed`);
                        this.triggerCallback();
                    }
                }
            }
        });
        this.monitorProcess.stderr?.on('data', (data) => {
            this.logger.error('Mouse monitoring error:', data.toString());
        });
        this.monitorProcess.on('exit', (code) => {
            this.logger.warn(`Mouse monitoring process exited with code ${code}`);
            this.isRunning = false;
        });
    }
    async startKeyboardMonitoring(key) {
        this.logger.info(`Starting keyboard monitoring for key ${key}`);
        // For keyboard keys, we can use a simple approach with xdotool or xinput
        // This is a simplified implementation
        this.logger.warn('Keyboard monitoring not fully implemented yet, falling back to HTTP trigger');
    }
    async triggerCallback() {
        if (this.callback) {
            try {
                await this.callback();
            }
            catch (error) {
                this.logger.error('Error in hotkey callback:', error);
            }
        }
    }
    onHotkeyPress(callback) {
        this.callback = callback;
    }
    async stop() {
        if (!this.isRunning) {
            return;
        }
        if (this.monitorProcess) {
            this.monitorProcess.kill('SIGTERM');
            this.monitorProcess = undefined;
        }
        this.isRunning = false;
        this.logger.info('X11 hotkey monitoring stopped');
    }
    getCurrentHotkey() {
        return this.hotkey;
    }
    async updateHotkey(newHotkey) {
        if (this.isRunning) {
            await this.stop();
        }
        this.hotkey = newHotkey;
        await this.start();
    }
}
exports.X11HotkeyManager = X11HotkeyManager;
//# sourceMappingURL=x11-hotkey.js.map