# Linux Helper Daemon

A standalone system-wide daemon that provides AI-powered development assistance through screenshot analysis and popup suggestions.

## Features

- **Global Hotkey Support**: Press F10 anywhere to capture and analyze screenshots
- **Intelligent Popup**: Shows AI suggestions at cursor position
- **System-wide Operation**: Works independently of the main Electron app
- **Automatic Startup**: Runs as a systemd user service
- **Multi-tool Screenshots**: Supports gnome-screenshot, ImageMagick, scrot, and xwd
- **AI Analysis**: Integrates with existing Gemini AI analysis

## Quick Start

### 1. Build the Daemon

```bash
cd src/linux-helper-daemon
npm install
npm run build
```

### 2. Install as System Service

```bash
npm run install-service
```

### 3. Test Hotkey Registration

```bash
node test-hotkey.js
```

## Usage

1. **Press F10**: Captures screenshot and starts AI analysis
2. **View Popup**: See AI suggestions appear near cursor
3. **Click Suggestions**: Execute commands or copy to clipboard
4. **Press ESC**: Dismiss popup

## Configuration

Edit `~/.config/linux-helper/daemon.json`:

```json
{
  "port": 3847,
  "socketPath": "/tmp/linux-helper.sock",
  "logLevel": "info",
  "hotkey": "F10",
  "popupTheme": "dark",
  "autoStart": true
}
```

## Service Management

```bash
# Check status
systemctl --user status linux-helper-daemon

# View logs
journalctl --user -f -u linux-helper-daemon

# Stop service
systemctl --user stop linux-helper-daemon

# Start service
systemctl --user start linux-helper-daemon

# Uninstall
npm run uninstall-service
```

## Architecture

```
┌───────────────────────────────────────┐
│          Linux Helper Daemon             │
├───────────────────────────────────────┤
│ main.ts           │ Main daemon process  │
│ hotkey-manager.ts │ Global hotkey setup  │
│ screenshot.ts     │ Screen capture       │
│ popup-window.ts   │ Floating UI          │
│ ai-analyzer.ts    │ AI integration       │
│ server.ts         │ IPC communication    │
│ logger.ts         │ Logging system       │
└───────────────────────────────────────┘
```

## Dependencies

### Required
- Node.js 18+
- systemd (for service management)
- X11 display server

### Optional (for screenshots)
- `gnome-screenshot` (recommended for Pop!_OS/Ubuntu)
- `imagemagick` (for import command)
- `scrot` (lightweight alternative)
- `xbindkeys` (for hotkey registration)

### Install Dependencies

```bash
# Ubuntu/Pop!_OS/Debian
sudo apt install gnome-screenshot imagemagick scrot xbindkeys

# Fedora
sudo dnf install gnome-screenshot ImageMagick scrot xbindkeys

# Arch Linux
sudo pacman -S gnome-screenshot imagemagick scrot xbindkeys
```

## Troubleshooting

### Hotkey Not Working
1. Check if xbindkeys is installed: `which xbindkeys`
2. Verify X11 session: `echo $DISPLAY`
3. Check logs: `journalctl --user -u linux-helper-daemon`

### Screenshot Capture Failed
1. Test screenshot tools: `gnome-screenshot --help`
2. Check display permissions
3. Verify you're in a graphical session

### Service Won't Start
1. Check Node.js path: `which node`
2. Verify build completed: `ls dist/`
3. Check systemd logs: `journalctl --user -u linux-helper-daemon`

### AI Analysis Failed
1. Set Gemini API key: `export GEMINI_API_KEY=your_key`
2. Check network connectivity
3. Verify API key validity

## Development

### Run in Development Mode

```bash
npm run dev
```

### Build and Test

```bash
npm run build
node test-hotkey.js
```

### Debug Logging

Edit config to set `"logLevel": "debug"` and check:

```bash
tail -f ~/.config/linux-helper/daemon.log
```

## Security

The daemon runs with restricted permissions:
- No network access except for AI API
- Read-only access to home directory
- Private temporary directory
- Memory and CPU limits
- No new privileges

## Future Enhancements

- [ ] Voice command support
- [ ] Multi-monitor awareness
- [ ] Terminal integration
- [ ] Custom hotkey combinations
- [ ] Plugin system
- [ ] Team sharing of solutions