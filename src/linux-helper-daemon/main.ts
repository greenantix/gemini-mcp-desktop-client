import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as net from 'net';
import { ScreenshotManager } from './screenshot';
import { CursorTracker } from './cursor-tracker';
import { Logger, LogLevel } from './logger';

// --- Singleton Pattern ---
let instance: LinuxHelperDaemon | null = null;

class LinuxHelperDaemon {
    private isRunning = false;
    private hotkeyProcess: ChildProcess | null = null;
    private socketServer: net.Server | null = null;
    private clientSocket: net.Socket | null = null;
    private hotkey: string;

    private readonly logger: Logger;
    private readonly screenshotManager: ScreenshotManager;
    private readonly cursorTracker: CursorTracker;
    private readonly socketPath: string;
    private readonly lockFilePath: string;

    private constructor() {
        // Load config, initialize managers etc.
        const config = this.loadConfig();
        this.logger = new Logger(config.logLevel);
        this.screenshotManager = new ScreenshotManager(this.logger);
        this.cursorTracker = new CursorTracker(this.logger);
        this.socketPath = config.socketPath;
        this.hotkey = config.hotkey;
        this.lockFilePath = '/tmp/linux-helper-daemon.lock';

        this.setupProcessHandlers();
    }

    public static getInstance(): LinuxHelperDaemon {
        if (!instance) {
            instance = new LinuxHelperDaemon();
        }
        return instance;
    }

    private loadConfig() {
        // Simplified config loading
        return {
            socketPath: '/tmp/linux-helper.sock',
            logLevel: 'info' as LogLevel,
            hotkey: 'ForwardButton', // Default hotkey
        };
    }

    private acquireLock(): boolean {
        if (fs.existsSync(this.lockFilePath)) {
            this.logger.error('Lock file exists. Another instance may be running.');
            return false;
        }
        fs.writeFileSync(this.lockFilePath, process.pid.toString());
        return true;
    }

    private releaseLock(): void {
        if (fs.existsSync(this.lockFilePath)) {
            fs.unlinkSync(this.lockFilePath);
        }
    }

    public async start(): Promise<void> {
        if (this.isRunning) {
            this.logger.warn('Daemon is already running.');
            return;
        }
        if (!this.acquireLock()) {
            process.exit(1);
        }

        this.logger.info('Starting Linux Helper Daemon...');
        this.isRunning = true;
        await this.startSocketServer();
        this.startHotkeyMonitoring();
    }

    public async shutdown(): Promise<void> {
        if (!this.isRunning) return;
        this.logger.info('Shutting down daemon...');
        this.isRunning = false;
        this.stopHotkeyMonitoring();
        this.socketServer?.close();
        if (this.clientSocket) {
            this.clientSocket.destroy();
        }
        this.releaseLock();
        this.logger.info('Daemon shutdown complete.');
        process.exit(0);
    }

    private setupProcessHandlers(): void {
        process.on('SIGINT', () => this.shutdown());
        process.on('SIGTERM', () => this.shutdown());
        process.on('exit', () => this.releaseLock());
    }

    private startHotkeyMonitoring(): void {
        this.stopHotkeyMonitoring(); // Ensure no lingering process

        const buttonMapping: Record<string, number> = {
            'ForwardButton': 9,
            'MiddleClick': 2,
            'BackButton': 8
        };
        const button = buttonMapping[this.hotkey];

        if (button) {
            this.startMouseMonitoring(button);
        } else {
            this.logger.warn(`Keyboard hotkey '${this.hotkey}' not yet implemented in daemon. Listening for mouse only.`);
        }
    }

    private stopHotkeyMonitoring(): void {
        if (this.hotkeyProcess) {
            this.hotkeyProcess.kill('SIGKILL'); // Use SIGKILL to ensure it dies
            this.hotkeyProcess = null;
            this.logger.info('Stopped previous hotkey monitoring process.');
        }
    }

    private startMouseMonitoring(button: number): void {
        this.logger.info(`Starting mouse button monitoring for button ${button}`);
        try {
            this.hotkeyProcess = spawn('xinput', ['test-xi2', '--root'], {
                detached: true, // Detach from parent
                stdio: 'pipe'
            });

            this.hotkeyProcess.on('error', (err) => {
                this.logger.error('Failed to spawn xinput process.', err.message);
                this.hotkeyProcess = null;
            });

            this.hotkeyProcess.on('exit', (code, signal) => {
                this.logger.warn(`xinput process exited with code ${code} and signal ${signal}`);
                this.hotkeyProcess = null;
                if (this.isRunning) {
                    this.logger.info('Restarting mouse monitoring in 5 seconds...');
                    setTimeout(() => this.startMouseMonitoring(button), 5000);
                }
            });

            const debounceMs = 500;
            let lastEventTime = 0;
            this.hotkeyProcess.stdout?.on('data', (data: Buffer) => {
                const output = data.toString();
                if (output.includes('ButtonPress') && output.includes(`detail: ${button}`)) {
                     const now = Date.now();
                     if (now - lastEventTime > debounceMs) {
                         lastEventTime = now;
                         this.logger.info(`Hotkey press detected (Button ${button})`);
                         this.onHotkeyPress();
                     }
                }
            });

            this.hotkeyProcess.stderr?.on('data', (data: Buffer) => {
                this.logger.error(`xinput stderr: ${data.toString()}`);
            });

        } catch (error: unknown) {
            if (error instanceof Error) {
                this.logger.error('Error spawning xinput.', error.message);
            }
        }
    }

    private async onHotkeyPress(): Promise<void> {
        try {
            const [screenshot, cursorPos] = await Promise.all([
                this.screenshotManager.captureActiveMonitor(),
                this.cursorTracker.getCurrentPosition()
            ]);

            if (screenshot && cursorPos) {
                const payload = {
                    type: 'hotkey-event',
                    data: {
                        screenshotDataUrl: screenshot.dataUrl,
                        cursorPosition: cursorPos
                    }
                };
                if (this.clientSocket) {
                    this.clientSocket.write(JSON.stringify(payload));
                    this.logger.info('Sent hotkey payload to main process.');
                } else {
                    this.logger.warn('No client connected to send payload.');
                }
            }
        } catch (error: unknown) {
            if (error instanceof Error) {
                this.logger.error('Error during hotkey press handler:', error.message);
            }
        }
    }

    private async startSocketServer(): Promise<void> {
        if (fs.existsSync(this.socketPath)) {
            fs.unlinkSync(this.socketPath);
        }

        this.socketServer = net.createServer((socket) => {
            this.logger.info('Main process connected to daemon.');
            this.clientSocket = socket;

            socket.on('data', (data) => {
                const message = JSON.parse(data.toString());
                if (message.type === 'update-hotkey') {
                    this.logger.info(`Received hotkey update: ${message.hotkey}`);
                    this.hotkey = message.hotkey;
                    this.startHotkeyMonitoring();
                }
            });

            socket.on('close', () => {
                this.logger.info('Main process disconnected.');
                this.clientSocket = null;
            });
            socket.on('error', (err) => {
                this.logger.error('Socket error with main process:', err.message);
                this.clientSocket = null;
            });
        }).listen(this.socketPath, () => {
            this.logger.info(`Daemon socket server listening at ${this.socketPath}`);
        });

        this.socketServer.on('error', (err) => {
            this.logger.error('Socket server error:', err.message);
        });
    }
}

// Ensure singleton instance is created and started
LinuxHelperDaemon.getInstance().start();