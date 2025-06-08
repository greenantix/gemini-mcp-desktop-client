#!/bin/bash
# 🚀 Linux Helper - Unified Startup Script
# This script starts both the main Electron application and the background daemon.

# --- Configuration ---
ROOT_DIR=$(pwd)
DAEMON_DIR="$ROOT_DIR/src/linux-helper-daemon"
DAEMON_LOG_FILE="$ROOT_DIR/daemon.log"
APP_LOG_FILE="$ROOT_DIR/app.log"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# --- Helper Functions ---
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# --- Cleanup Function ---
cleanup() {
    print_status "\n🛑 Shutting down all Linux Helper processes..."
    # Use the stop script for a clean shutdown
    "$ROOT_DIR/stop.sh" > /dev/null 2>&1
    print_success "Cleanup complete. Goodbye!"
    exit 0
}

# Trap Ctrl+C to run the cleanup function
trap cleanup INT TERM

# --- Main Script ---
print_status "🚀 Starting Linux Helper - Pop!_OS Assistant"
echo "================================================="

# 1. Stop any lingering processes first
print_status "Performing initial cleanup..."
"$ROOT_DIR/stop.sh" > /dev/null 2>&1
print_success "Cleanup complete."
echo ""

# 2. Prepare and start the Linux Helper Daemon
print_status "Preparing the background hotkey daemon..."
if [ ! -d "$DAEMON_DIR" ]; then
    print_error "Daemon directory not found at: $DAEMON_DIR"
    exit 1
fi

cd "$DAEMON_DIR"

# Install daemon dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing daemon dependencies (one-time setup)..."
    npm install
fi

# Build the daemon if sources are newer than the build
if [ ! -f "dist/main.js" ] || find . -name "*.ts" -newer "dist/main.js" | grep -q .; then
    print_status "Daemon source has changed, rebuilding..."
    npm run build
    if [ $? -ne 0 ]; then
        print_error "Daemon build failed! Please check for errors."
        exit 1
    fi
    print_success "Daemon built successfully."
else
    print_status "Daemon is already up-to-date."
fi

# Start the daemon in the background
print_status "Starting the hotkey daemon in the background..."
nohup node dist/main.js > "$DAEMON_LOG_FILE" 2>&1 &
DAEMON_PID=$!
sleep 2 # Give it a moment to initialize

# Verify daemon is running
if ps -p $DAEMON_PID > /dev/null; then
    print_success "Hotkey daemon is running (PID: $DAEMON_PID). Logs are in daemon.log"
else
    print_error "Failed to start the hotkey daemon. Check daemon.log for errors."
    exit 1
fi
echo ""

# 3. Prepare and start the Main Application
print_status "Preparing the main Electron application..."
cd "$ROOT_DIR"

# Install main app dependencies if needed
if [ ! -d "node_modules" ]; then
    print_status "Installing main application dependencies (one-time setup)..."
    npm install
fi

print_status "Starting the main application..."
# Start the Vite dev server and Electron app
npm run dev > "$APP_LOG_FILE" 2>&1 &
APP_PID=$!

sleep 5 # Give Electron time to launch

print_success "🎉 Linux Helper is now running!"
echo ""
echo "   - Main application window should appear shortly."
echo "   - Hotkey daemon is listening in the background."
echo "   - Press the 'Forward Mouse Button' to trigger the AI Helper."
echo ""
echo "   LOGS:"
echo "   - Main App: tail -f $APP_LOG_FILE"
echo "   - Daemon:   tail -f $DAEMON_LOG_FILE"
echo ""
echo "   Press Ctrl+C in this terminal to stop everything."
echo "================================================="

# Wait for the main app process to exit
wait $APP_PID
