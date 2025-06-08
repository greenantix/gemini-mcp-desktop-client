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
exports.ScreenshotManager = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class ScreenshotManager {
    constructor(logger) {
        this.logger = logger;
        this.screenshotDir = this.ensureScreenshotDirectory();
    }
    ensureScreenshotDirectory() {
        const homeDir = os.homedir();
        const screenshotDir = path.join(homeDir, 'Pictures', 'linux-helper-screenshots');
        try {
            if (!fs.existsSync(screenshotDir)) {
                fs.mkdirSync(screenshotDir, { recursive: true });
                this.logger.info(`Created screenshot directory: ${screenshotDir}`);
            }
            return screenshotDir;
        }
        catch (error) {
            this.logger.error('Failed to create screenshot directory:', error);
            // Fallback to temp directory
            return os.tmpdir();
        }
    }
    async captureActiveMonitor() {
        try {
            // Check which screenshot tools are available
            const tool = this.detectScreenshotTool();
            if (!tool) {
                throw new Error('No suitable screenshot tool found');
            }
            const timestamp = new Date();
            const filename = `linux-helper-${timestamp.toISOString().replace(/[:.]/g, '-')}.png`;
            const filepath = path.join(this.screenshotDir, filename);
            // Capture screenshot using the detected tool
            await this.captureWithTool(tool, filepath);
            // Convert to base64 data URL
            const buffer = fs.readFileSync(filepath);
            const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
            this.logger.info(`Screenshot captured: ${filepath}`);
            return {
                dataUrl,
                filename,
                filepath,
                size: buffer.length,
                timestamp
            };
        }
        catch (error) {
            this.logger.error('Failed to capture screenshot:', error);
            return null;
        }
    }
    detectScreenshotTool() {
        const tools = ['gnome-screenshot', 'import', 'scrot', 'xwd'];
        for (const tool of tools) {
            try {
                (0, child_process_1.execSync)(`which ${tool}`, { stdio: 'ignore' });
                this.logger.debug(`Found screenshot tool: ${tool}`);
                return tool;
            }
            catch {
                // Tool not available, try next
            }
        }
        return null;
    }
    async captureWithTool(tool, filepath) {
        let command;
        switch (tool) {
            case 'gnome-screenshot':
                // GNOME Screenshot (most common on Ubuntu/Pop!_OS)
                command = `gnome-screenshot -f "${filepath}"`;
                break;
            case 'import':
                // ImageMagick import (part of ImageMagick suite)
                command = `import -window root "${filepath}"`;
                break;
            case 'scrot':
                // Scrot (lightweight screenshot utility)
                command = `scrot "${filepath}"`;
                break;
            case 'xwd':
                // X Window Dump (convert to PNG afterwards)
                const xwdFile = filepath.replace('.png', '.xwd');
                command = `xwd -root -out "${xwdFile}" && convert "${xwdFile}" "${filepath}" && rm "${xwdFile}"`;
                break;
            default:
                throw new Error(`Unsupported screenshot tool: ${tool}`);
        }
        try {
            (0, child_process_1.execSync)(command, {
                timeout: 10000, // 10 second timeout
                stdio: 'pipe'
            });
        }
        catch (error) {
            throw new Error(`Screenshot command failed: ${command}`);
        }
        // Verify the file was created
        if (!fs.existsSync(filepath)) {
            throw new Error('Screenshot file was not created');
        }
    }
    async captureRegion(x, y, width, height) {
        try {
            const tool = this.detectScreenshotTool();
            if (!tool) {
                throw new Error('No suitable screenshot tool found');
            }
            const timestamp = new Date();
            const filename = `linux-helper-region-${timestamp.toISOString().replace(/[:.]/g, '-')}.png`;
            const filepath = path.join(this.screenshotDir, filename);
            let command;
            switch (tool) {
                case 'gnome-screenshot':
                    command = `gnome-screenshot -a -f "${filepath}"`; // Area selection
                    break;
                case 'import':
                    command = `import -window root -crop ${width}x${height}+${x}+${y} "${filepath}"`;
                    break;
                case 'scrot':
                    command = `scrot -a ${x},${y},${width},${height} "${filepath}"`;
                    break;
                default:
                    // Fallback to full screen capture
                    return this.captureActiveMonitor();
            }
            (0, child_process_1.execSync)(command, { timeout: 10000, stdio: 'pipe' });
            const buffer = fs.readFileSync(filepath);
            const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
            this.logger.info(`Region screenshot captured: ${filepath}`);
            return {
                dataUrl,
                filename,
                filepath,
                size: buffer.length,
                timestamp
            };
        }
        catch (error) {
            this.logger.error('Failed to capture region screenshot:', error);
            return null;
        }
    }
    getScreenshotDirectory() {
        return this.screenshotDir;
    }
    async cleanupOldScreenshots(maxAge = 7 * 24 * 60 * 60 * 1000) {
        try {
            const files = fs.readdirSync(this.screenshotDir);
            const now = Date.now();
            let cleaned = 0;
            for (const file of files) {
                if (file.startsWith('linux-helper-') && file.endsWith('.png')) {
                    const filePath = path.join(this.screenshotDir, file);
                    const stats = fs.statSync(filePath);
                    if (now - stats.mtime.getTime() > maxAge) {
                        fs.unlinkSync(filePath);
                        cleaned++;
                    }
                }
            }
            if (cleaned > 0) {
                this.logger.info(`Cleaned up ${cleaned} old screenshots`);
            }
        }
        catch (error) {
            this.logger.error('Failed to cleanup old screenshots:', error);
        }
    }
}
exports.ScreenshotManager = ScreenshotManager;
//# sourceMappingURL=screenshot.js.map