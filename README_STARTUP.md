# 🚀 Quick Start Guide - Linux Helper

This guide will help you get Linux Helper running in just a few minutes!

## Prerequisites

Before starting, make sure you have:

- **Ubuntu/Pop!_OS 20.04+** (or similar Debian-based distro)
- **Node.js 18+** installed
- **Internet connection** for downloading dependencies

## 🎯 One-Command Startup

The easiest way to start Linux Helper:

```bash
./start.sh
```

That's it! The script will:
- ✅ Kill any old processes
- ✅ Install missing dependencies
- ✅ Set up system requirements
- ✅ Start both daemon and main app
- ✅ Open your browser automatically

## 🛑 Stopping the Application

To stop Linux Helper:

```bash
./stop.sh
```

Or just press `Ctrl+C` in the terminal where you ran `./start.sh`

## 🔧 First-Time Setup

### 1. Get Your API Key (Optional but Recommended)

For AI analysis features, you'll need a Gemini API key:

1. Visit: https://aistudio.google.com/app/apikey
2. Create a new API key
3. Add it to your environment:

```bash
echo "GEMINI_API_KEY=your_api_key_here" > .env
```

### 2. Make Scripts Executable

If you get permission errors:

```bash
chmod +x start.sh stop.sh
chmod +x src/linux-helper-daemon/start.sh
chmod +x src/linux-helper-daemon/stop.sh
```

## 📱 How to Use

Once running:

1. **Press F10** anywhere on your screen to activate Linux Helper
2. The popup will appear at your cursor position
3. AI will analyze your screenshot and suggest commands
4. Use arrow keys to navigate suggestions
5. Press Enter to execute or Ctrl+C to copy

## 🔧 Configuration

- **Settings**: Visit http://localhost:5173 → Settings
- **Hotkey**: Change from F10 to your preferred key
- **Screenshot Location**: Default is `~/Pictures/screenshots`
- **Theme**: Dark/Light mode toggle

## 🐛 Troubleshooting

### Port Already in Use

```bash
# Kill processes using our ports
sudo lsof -ti:5001,5173,3847 | xargs kill -9
./start.sh
```

### Missing System Dependencies

The start script will automatically install:
- `scrot` (for screenshots)
- `xdotool` (for cursor tracking)

If auto-install fails:

```bash
sudo apt update
sudo apt install scrot xdotool
```

### Node.js Version Issues

Check your Node.js version:

```bash
node --version  # Should be 18.0.0 or higher
```

If too old, update:

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Permission Errors

If you get permission errors:

```bash
# Fix script permissions
find . -name "*.sh" -exec chmod +x {} \;

# Fix node_modules if needed
sudo chown -R $USER:$USER node_modules/
```

## 📊 Application Status

When running, you'll see:

- **Main App**: http://localhost:5173
- **Backend API**: http://localhost:5001
- **Daemon**: Port 3847

Check health:

```bash
curl http://localhost:5001/api/helper-action/health
```

## 🆘 Getting Help

If you encounter issues:

1. **Check the terminal output** - errors are usually clearly displayed
2. **Try the stop/start cycle**: `./stop.sh && ./start.sh`
3. **Check system logs**: `journalctl -f` while running
4. **Verify dependencies**: The start script will check and install what's needed

## 🎉 Success Indicators

You know it's working when:

- ✅ Terminal shows "Linux Helper is now running!"
- ✅ Browser opens to http://localhost:5173
- ✅ F10 key shows popup window
- ✅ No error messages in terminal

## 📋 Quick Commands Reference

```bash
# Start everything
./start.sh

# Stop everything  
./stop.sh

# Check if running
ps aux | grep -E "(electron|linux-helper|vite)"

# Kill everything manually
pkill -f "electron|linux-helper|vite"

# Check ports
netstat -tulpn | grep -E "(5001|5173|3847)"
```

That's it! You're ready to use Linux Helper. Press F10 anywhere and watch the magic happen! ✨