#!/bin/bash

# 🛑 Linux Helper Daemon - Easy Stop Script
# This script cleanly stops all daemon processes

echo "🛑 Linux Helper Daemon - Easy Stop"
echo "=================================="
echo ""

echo "🧹 Stopping all Linux Helper processes..."

# Kill daemon processes
if pgrep -f "node dist/main.js" > /dev/null; then
    echo "   ❌ Stopping daemon..."
    pkill -f "node dist/main.js"
    sleep 1
    echo "   ✅ Daemon stopped"
else
    echo "   ✅ No daemon running"
fi

# Kill popup processes
if pgrep -f "popup-main.js" > /dev/null; then
    echo "   ❌ Stopping popup..."
    pkill -f "popup-main.js"
    sleep 1
    echo "   ✅ Popup stopped"
else
    echo "   ✅ No popup running"
fi

# Kill xbindkeys processes
if pgrep -f "xbindkeys.*linux-helper" > /dev/null; then
    echo "   ❌ Stopping hotkey listeners..."
    pkill -f "xbindkeys.*linux-helper"
    sleep 1
    echo "   ✅ Hotkey listeners stopped"
else
    echo "   ✅ No hotkey listeners running"
fi

# Clean up socket files
if [ -f "/tmp/linux-helper.sock" ]; then
    echo "   🧹 Cleaning up socket files..."
    rm -f /tmp/linux-helper.sock
    rm -f /tmp/linux-helper-popup.sock
    echo "   ✅ Socket files cleaned"
fi

echo ""
echo "🎉 All Linux Helper processes stopped!"
echo "💡 Run ./start.sh to start again"
echo ""