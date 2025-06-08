"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HotkeyManager = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class HotkeyManager {
    constructor(hotkey, logger) {
        this.hotkey = hotkey;
        this.logger = logger;
        this.isRegistered = false;
    }
    async register() {
        if (this.isRegistered) {
            this.logger.warn('Hotkey already registered');
            return;
        }
        try {
            // Check if we're running on a system with xbindkeys support
            if (this.hasXbindkeys()) {
                await this.registerWithXbindkeys();
            }
            else {
                // Fallback to a simple polling approach or other methods
                await this.registerWithPolling();
            }
            this.isRegistered = true;
            this.logger.info(`Hotkey ${this.hotkey} registered successfully`);
        }
        catch (error) {
            this.logger.error('Failed to register hotkey:', error);
            throw error;
        }
    }
    hasXbindkeys() {
        try {
            (0, child_process_1.execSync)('which xbindkeys', { stdio: 'ignore' });
            return true;
        }
        catch {
            return false;
        }
    }
    async registerWithXbindkeys() {
        // Create a temporary script that will be called when hotkey is pressed
        const scriptContent = `#!/bin/bash\n# Linux Helper Hotkey Script\ncurl -X POST http://localhost:3847 -H "Content-Type: application/json" -d '{"type":"capture"}' > /dev/null 2>&1 &`;
        this.tempScriptPath = path.join(os.tmpdir(), 'linux-helper-hotkey.sh');
        fs.writeFileSync(this.tempScriptPath, scriptContent);
        fs.chmodSync(this.tempScriptPath, '755');
        // Create xbindkeys configuration
        const xbindkeysConfig = `"${this.tempScriptPath}"\n    ${this.convertHotkeyToXbindkeys(this.hotkey)}`;
        const configPath = path.join(os.homedir(), '.xbindkeysrc.linux-helper');
        fs.writeFileSync(configPath, xbindkeysConfig);
        // Start xbindkeys with our config
        try {
            this.hotkeyProcess = (0, child_process_1.spawn)('xbindkeys', ['-f', configPath], {
                detached: true,
                stdio: 'ignore'
            });
            this.hotkeyProcess.unref();
        }
        catch (error) {
            this.logger.error('Failed to start xbindkeys:', error);
            throw error;
        }
    }
    async registerWithPolling() {
        // This is a fallback method that uses xinput to monitor key events
        // Note: This is less reliable and more resource-intensive
        this.logger.warn('Using polling fallback for hotkey detection');
        // For now, we'll just log that we would be polling
        // A full implementation would need to monitor X11 events or use other system APIs
        this.logger.info('Hotkey polling would be implemented here');
    }
    convertHotkeyToXbindkeys(hotkey) {
        // Convert common hotkey formats to xbindkeys format
        const hotkeyMap = {
            'F10': 'F10',
            'F9': 'F9',
            'Ctrl+Shift+H': 'control+shift + h',
            'Ctrl+Alt+E': 'control+alt + e',
            'Escape': 'Escape'
        };
        return hotkeyMap[hotkey] || hotkey.toLowerCase();
    }
    onHotkeyPress(callback) {
        this.callback = callback;
    }
    async triggerHotkey() {
        if (this.callback) {
            try {
                await this.callback();
            }
            catch (error) {
                this.logger.error('Error in hotkey callback:', error);
            }
        }
    }
    getCurrentHotkey() {
        return this.hotkey;
    }
    async updateHotkey(newHotkey) {
        if (this.isRegistered) {
            await this.unregister();
        }
        this.hotkey = newHotkey;
        await this.register();
    }
    async unregister() {
        if (!this.isRegistered) {
            return;
        }
        try {
            // Kill xbindkeys process if it exists
            if (this.hotkeyProcess) {
                this.hotkeyProcess.kill();
                this.hotkeyProcess = undefined;
            }
            // Clean up temporary files
            if (this.tempScriptPath && fs.existsSync(this.tempScriptPath)) {
                fs.unlinkSync(this.tempScriptPath);
                this.tempScriptPath = undefined;
            }
            const configPath = path.join(os.homedir(), '.xbindkeysrc.linux-helper');
            if (fs.existsSync(configPath)) {
                fs.unlinkSync(configPath);
            }
            // Kill any running xbindkeys processes for our config
            try {
                (0, child_process_1.execSync)('pkill -f "xbindkeys.*linux-helper"', { stdio: 'ignore' });
            }
            catch {
                // Ignore if no processes found
            }
            this.isRegistered = false;
            this.logger.info('Hotkey unregistered successfully');
        }
        catch (error) {
            this.logger.error('Error unregistering hotkey:', error);
            throw error;
        }
    }
}
exports.HotkeyManager = HotkeyManager;
//# sourceMappingURL=hotkey-manager.js.map