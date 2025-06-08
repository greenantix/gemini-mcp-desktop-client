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
exports.Logger = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
class Logger {
    constructor(level = 'info', writeToFile = true) {
        this.level = level;
        this.writeToFile = writeToFile;
        this.logLevels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
        this.logFile = path.join(os.homedir(), '.config', 'linux-helper', 'daemon.log');
        this.ensureLogDirectory();
    }
    ensureLogDirectory() {
        const logDir = path.dirname(this.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }
    shouldLog(level) {
        return this.logLevels[level] >= this.logLevels[this.level];
    }
    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const formattedArgs = args.length > 0 ? ' ' + args.map(arg => typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)).join(' ') : '';
        return `[${timestamp}] [${level.toUpperCase()}] ${message}${formattedArgs}`;
    }
    writeLog(level, message, ...args) {
        const formattedMessage = this.formatMessage(level, message, ...args);
        // Always log to console
        switch (level) {
            case 'debug':
                console.debug(formattedMessage);
                break;
            case 'info':
                console.info(formattedMessage);
                break;
            case 'warn':
                console.warn(formattedMessage);
                break;
            case 'error':
                console.error(formattedMessage);
                break;
        }
        // Write to file if enabled
        if (this.writeToFile) {
            try {
                fs.appendFileSync(this.logFile, formattedMessage + '\n', 'utf8');
            }
            catch (error) {
                console.error('Failed to write to log file:', error);
            }
        }
    }
    debug(message, ...args) {
        if (this.shouldLog('debug')) {
            this.writeLog('debug', message, ...args);
        }
    }
    info(message, ...args) {
        if (this.shouldLog('info')) {
            this.writeLog('info', message, ...args);
        }
    }
    warn(message, ...args) {
        if (this.shouldLog('warn')) {
            this.writeLog('warn', message, ...args);
        }
    }
    error(message, ...args) {
        if (this.shouldLog('error')) {
            this.writeLog('error', message, ...args);
        }
    }
    setLevel(level) {
        this.level = level;
        this.info(`Log level changed to: ${level}`);
    }
    getLogFile() {
        return this.logFile;
    }
    async rotateLog(maxSize = 10 * 1024 * 1024) {
        try {
            if (!fs.existsSync(this.logFile)) {
                return;
            }
            const stats = fs.statSync(this.logFile);
            if (stats.size > maxSize) {
                const rotatedFile = this.logFile + '.old';
                // Remove old rotated file if it exists
                if (fs.existsSync(rotatedFile)) {
                    fs.unlinkSync(rotatedFile);
                }
                // Rename current log to .old
                fs.renameSync(this.logFile, rotatedFile);
                this.info('Log file rotated');
            }
        }
        catch (error) {
            this.error('Failed to rotate log file:', error);
        }
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map