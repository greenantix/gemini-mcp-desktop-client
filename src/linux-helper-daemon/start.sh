#!/bin/bash

# 🤖 Linux Helper Daemon - Easy Startup Script
# This script makes it super easy to start/restart the daemon

echo "🤖 Linux Helper Daemon - Easy Startup"
echo "======================================="
echo ""

# Step 1: Kill any old processes
echo "🧹 Cleaning up old processes..."

# Kill old daemon processes
if pgrep -f "node dist/main.js" > /dev/null; then
    echo "   ❌ Stopping old daemon..."
    pkill -f "node dist/main.js"
    sleep 1
else
    echo "   ✅ No old daemon found"
fi

# Kill old popup processes
if pgrep -f "popup-main.js" > /dev/null; then
    echo "   ❌ Stopping old popup..."
    pkill -f "popup-main.js"
    sleep 1
else
    echo "   ✅ No old popup found"
fi

# Kill old xbindkeys processes
if pgrep -f "xbindkeys.*linux-helper" > /dev/null; then
    echo "   ❌ Stopping old hotkey listeners..."
    pkill -f "xbindkeys.*linux-helper"
    sleep 1
else
    echo "   ✅ No old hotkey listeners found"
fi

# Clean up socket files
if [ -f "/tmp/linux-helper.sock" ]; then
    echo "   🧹 Cleaning up socket files..."
    rm -f /tmp/linux-helper.sock
    rm -f /tmp/linux-helper-popup.sock
fi

echo "   ✅ Cleanup complete!"
echo ""

# Step 2: Check if we need to build
echo "🔨 Checking if build is needed..."
if [ ! -f "dist/main.js" ] || [ "main.ts" -nt "dist/main.js" ]; then
    echo "   🔨 Building daemon..."
    npm run build
    if [ $? -ne 0 ]; then
        echo "   ❌ Build failed! Please check for errors above."
        exit 1
    fi
    echo "   ✅ Build complete!"
else
    echo "   ✅ Build is up to date!"
fi

echo ""

# Step 3: Check dependencies
echo "🔍 Checking required tools..."

# Check if xbindkeys is installed
if ! command -v xbindkeys &> /dev/null; then
    echo "   ❌ xbindkeys not found!"
    echo "   💡 Install with: sudo apt install xbindkeys"
    echo ""
    read -p "   Would you like me to install it? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo apt install xbindkeys
    else
        echo "   ⚠️  Hotkeys may not work without xbindkeys"
    fi
else
    echo "   ✅ xbindkeys found"
fi

# Check if gnome-screenshot is installed
if ! command -v gnome-screenshot &> /dev/null; then
    echo "   ❌ gnome-screenshot not found!"
    echo "   💡 Install with: sudo apt install gnome-screenshot"
    echo ""
    read -p "   Would you like me to install it? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo apt install gnome-screenshot
    else
        echo "   ⚠️  Screenshots may not work without gnome-screenshot"
    fi
else
    echo "   ✅ gnome-screenshot found"
fi

echo ""

# Step 4: Start the daemon
echo "🚀 Starting Linux Helper Daemon..."
echo "   📁 Working directory: $(pwd)"
echo "   🎯 Press F10 anywhere to test!"
echo "   🛑 Press Ctrl+C to stop"
echo ""
echo "🔄 Starting in 3 seconds..."
sleep 1
echo "🔄 Starting in 2 seconds..."
sleep 1  
echo "🔄 Starting in 1 second..."
sleep 1
echo ""
echo "🎉 LINUX HELPER IS STARTING!"
echo "======================================="
echo "💡 TIP: Press F10 to capture and analyze your screen"
echo "💡 TIP: Press Ctrl+C here to stop the daemon"
echo "💡 TIP: Run ./start.sh again to restart"
echo "======================================="
echo ""

# Start the daemon (this will show logs in real-time)
node dist/main.js