#!/bin/bash

echo "🔧 Testing Forward Button Detection Only"
echo "========================================"
echo ""

# Stop any existing processes
./stop.sh > /dev/null 2>&1

echo "Starting ONLY the daemon (not the main app)..."
cd src/linux-helper-daemon
node dist/main.js &
DAEMON_PID=$!
cd ../..

echo "Daemon PID: $DAEMON_PID"
sleep 3

echo ""
echo "🎯 Now click your Forward mouse button!"
echo ""
echo "You should see a message like:"
echo "   [INFO] Mouse button 9 pressed"
echo ""
echo "If you see that message, your Forward button works!"
echo "Press Ctrl+C when done testing"

# Keep daemon running until user stops
trap "kill $DAEMON_PID 2>/dev/null; echo ''; echo 'Test finished.'; exit" INT TERM
wait $DAEMON_PID