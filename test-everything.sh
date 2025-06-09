#!/bin/bash

echo "🔧 Linux Helper Forward Button Test"
echo "==================================="
echo ""

# Stop any existing processes
echo "1. Stopping existing processes..."
./stop.sh > /dev/null 2>&1

echo "2. Starting daemon..."
cd src/linux-helper-daemon
node dist/main.js &
DAEMON_PID=$!
cd ../..
echo "   Daemon started (PID: $DAEMON_PID)"

# Wait for daemon to start
sleep 2

echo "3. Testing daemon..."
if curl -s http://localhost:3847/status > /dev/null; then
    echo "   ✅ Daemon is running"
else
    echo "   ❌ Daemon failed to start"
    exit 1
fi

echo "4. Starting main app..."
npm run dev &
APP_PID=$!
echo "   App started (PID: $APP_PID)"

# Wait for app to start
sleep 5

echo "5. Testing backend..."
if curl -s http://localhost:5001/api/helper-action/health > /dev/null; then
    echo "   ✅ Backend is running"
else
    echo "   ❌ Backend not ready yet (wait 30 seconds and try Forward button)"
fi

echo ""
echo "🎯 READY TO TEST!"
echo "=================="
echo ""
echo "Click your Forward mouse button (front side button)"
echo "A popup should appear instantly!"
echo ""
echo "If nothing happens:"
echo "1. Make sure you're clicking the FRONT side button"
echo "2. Try the other side button"
echo "3. Wait 30 seconds for everything to load"
echo ""
echo "Press Ctrl+C to stop everything"

# Keep script running
trap "kill $DAEMON_PID $APP_PID 2>/dev/null; exit" INT TERM
wait