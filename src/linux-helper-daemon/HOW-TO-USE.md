# 🤖 Linux Helper - Super Easy Guide

## 🚀 How to Start

Just run this command:
```bash
./start.sh
```

**That's it!** The script will:
- ✅ Kill any old processes automatically
- ✅ Check if tools are installed (and offer to install them)
- ✅ Build the code if needed
- ✅ Start the daemon with pretty logs

## 🛑 How to Stop

```bash
./stop.sh
```

Or just press **Ctrl+C** in the terminal where it's running.

## 🎯 How to Use

1. **Start the daemon**: `./start.sh`
2. **Press F10** anywhere on your screen
3. **Watch the magic!** A popup will appear near your cursor
4. **Click buttons** in the popup to copy/execute commands

## 🧪 Testing

- **F10** = Capture screenshot and analyze with AI
- **ESC** = Close popup
- **Click buttons** = Copy or execute suggested commands

## 🔧 Troubleshooting

**Problem: "F10 doesn't work"**
- Make sure the daemon is running (`./start.sh`)
- Try pressing F10 multiple times
- Check if xbindkeys is installed

**Problem: "No popup appears"**
- The daemon might have crashed, check the terminal output
- Restart with `./stop.sh` then `./start.sh`

**Problem: "Build errors"**
- Make sure you're in the `linux-helper-daemon` directory
- Run `npm install` first

## 📁 File Structure

```
linux-helper-daemon/
├── start.sh          ← 🚀 START HERE!
├── stop.sh           ← 🛑 Stop daemon
├── main.ts           ← Main daemon code
├── dist/             ← Built files
└── HOW-TO-USE.md     ← This file
```

## 💡 Pro Tips

- **Keep the terminal open** to see logs and debug issues
- **Use Ctrl+C** to stop quickly during development
- **Run `./start.sh`** every time you make code changes
- **The popup follows your cursor** - that's a feature! 

## 🆘 Need Help?

1. Check the terminal output for error messages
2. Try `./stop.sh` then `./start.sh` to restart
3. Make sure you're in the right directory: `src/linux-helper-daemon/`

---

**Ready?** Just run `./start.sh` and press F10! 🎉