#!/bin/bash
# 🚀 Linux Helper - Unified Startup Script
# This script starts both the main Electron application and the background daemon.

# --- Configuration ---
ROOT_DIR=$(pwd)
DAEMON_DIR="$ROOT_DIR/src/linux-helper-daemon"
DAEMON_PID_FILE="/tmp/linux-helper-daemon.lock" # Standardized PID file location
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

# --- Help Message ---
show_help() {
    echo "Usage: ./start.sh [options]"
    echo ""
    echo "Options:"
    echo "  -d, --daemon-only    Start only the background daemon"
    echo "  -a, --app-only       Start only the main Electron application"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Without options, both daemon and app will be started."
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

# --- Parse Arguments ---
START_DAEMON=true
START_APP=true

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--daemon-only)
            START_APP=false
            shift
            ;;
        -a|--app-only)
            START_DAEMON=false
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# --- Environment Setup ---
# Check for Gemini API key
if [ -f ".env" ]; then
    source .env
    if [ -z "$GEMINI_API_KEY" ]; then
        print_warning "No GEMINI_API_KEY found in .env file."
        print_warning "Screenshot analysis may not work properly."
    else
        print_status "Found Gemini API key in .env file."
        export GEMINI_API_KEY
    fi
else
    print_warning "No .env file found. Creating from example..."
    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_warning "Please edit .env and add your Gemini API key."
    else
        print_error "No .env.example file found!"
        exit 1
    fi
fi

# --- Main Script ---
print_status "🚀 Starting Linux Helper - AI Screenshot Assistant"
echo "================================================="

# 1. Stop any lingering processes first
print_status "Performing initial cleanup..."
"$ROOT_DIR/stop.sh" > /dev/null 2>&1
print_success "Cleanup complete."
echo ""

if $START_DAEMON; then
    # Check for screenshot dependencies
    print_status "Checking screenshot dependencies..."
    MISSING_DEPS=""

    # Check for gnome-screenshot
    if ! command -v gnome-screenshot &> /dev/null; then
        if ! command -v import &> /dev/null && ! command -v scrot &> /dev/null; then
            MISSING_DEPS="gnome-screenshot/imagemagick/scrot"
        fi
    fi

    if [ ! -z "$MISSING_DEPS" ]; then
        print_error "Missing required screenshot tools: $MISSING_DEPS"
        print_error "Please install one of the following:"
        echo "   - gnome-screenshot (recommended)"
        echo "   - imagemagick"
        echo "   - scrot"
        exit 1
    else
        print_success "Screenshot dependencies verified."
    fi

    echo ""

    # 2. Prepare and start the Linux Helper Daemon
    print_status "Preparing the background hotkey daemon..."

    # Check if daemon is already running using PID file
    if [ -f "$DAEMON_PID_FILE" ]; then
        EXISTING_PID=$(cat "$DAEMON_PID_FILE")
        if [ -n "$EXISTING_PID" ] && ps -p "$EXISTING_PID" > /dev/null; then
            print_warning "Daemon is already running with PID $EXISTING_PID (according to $DAEMON_PID_FILE)."
            print_warning "If this is an error, run './stop.sh' and try again."
            exit 1
        else
            print_warning "Stale PID file found ($DAEMON_PID_FILE for PID $EXISTING_PID). Removing it."
            rm -f "$DAEMON_PID_FILE"
        fi
    fi

    cd "$DAEMON_DIR"

    # Install daemon dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "Installing daemon dependencies (one-time setup)..."
        npm install --silent
        if [ $? -ne 0 ]; then
            print_error "Daemon 'npm install' failed."
            cd "$ROOT_DIR"
            exit 1
        fi
        print_success "Daemon dependencies installed."
    fi

    # Build the daemon if needed
    if [ ! -f "dist/main.js" ] || find . -maxdepth 1 -name "*.ts" -newer "dist/main.js" 2>/dev/null | grep -q .; then
        print_status "Daemon source has changed or build is missing, rebuilding..."
        npm run build
        if [ $? -ne 0 ]; then
            print_error "Daemon build failed! Please check for errors in '$DAEMON_DIR'."
            cd "$ROOT_DIR"
            exit 1
        fi
        print_success "Daemon built successfully."
    else
        print_status "Daemon is already up-to-date."
    fi

    # Start the daemon in the background
    print_status "Starting the hotkey daemon in the background..."
    export DISPLAY="${DISPLAY:-:0}"
    print_status "Using DISPLAY=$DISPLAY"

    GEMINI_API_KEY="$GEMINI_API_KEY" DISPLAY="$DISPLAY" nohup node dist/main.js > "$DAEMON_LOG_FILE" 2>&1 &
    sleep 3

    if [ -f "$DAEMON_PID_FILE" ]; then
        DAEMON_PID_FROM_FILE=$(cat "$DAEMON_PID_FILE")
        if [ -n "$DAEMON_PID_FROM_FILE" ] && ps -p "$DAEMON_PID_FROM_FILE" > /dev/null; then
            print_success "Hotkey daemon started successfully (PID: $DAEMON_PID_FROM_FILE). Logs: $DAEMON_LOG_FILE"
        else
            print_error "Daemon started but PID $DAEMON_PID_FROM_FILE from $DAEMON_PID_FILE is not running. Check $DAEMON_LOG_FILE."
            cd "$ROOT_DIR"
            exit 1
        fi
    else
        print_error "Failed to start the hotkey daemon or it did not create PID file $DAEMON_PID_FILE. Check $DAEMON_LOG_FILE."
        cd "$ROOT_DIR"
        exit 1
    fi
    cd "$ROOT_DIR"
    echo ""
fi

if $START_APP; then
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
fi

# Final status message
print_success "🎉 Linux Helper is now running!"
echo ""
if $START_DAEMON; then
    echo "   - Hotkey daemon is listening in the background"
    echo "   - Press the 'Forward Mouse Button' to capture and analyze screenshots"
fi
if $START_APP; then
    echo "   - Main application window should appear shortly"
fi
echo "   - If you haven't already, add your Gemini API key to .env file"
echo ""
echo "📋 Troubleshooting Guide:"
echo "   1. Screenshot not working?"
echo "      - Check DISPLAY environment variable (current: $DISPLAY)"
echo "      - Verify screenshot tools: gnome-screenshot, import, or scrot"
echo "      - Check daemon logs: tail -f $DAEMON_LOG_FILE"
echo ""
echo "   2. Analysis not working?"
echo "      - Verify Gemini API key in .env file"
echo "      - Look for 'Analysis failed' in daemon logs"
echo "      - Try restarting with './stop.sh && ./start.sh'"
echo ""
echo "   LOGS:"
if $START_APP; then
    echo "   - Main App: tail -f $APP_LOG_FILE"
fi
if $START_DAEMON; then
    echo "   - Daemon:   tail -f $DAEMON_LOG_FILE"
    echo "   - Analysis: tail -f $DAEMON_LOG_FILE | grep 'Analysis'"
fi
echo ""
echo "   Press Ctrl+C in this terminal to stop everything."
echo "================================================="

# Wait for processes
if $START_APP; then
    wait $APP_PID
elif $START_DAEMON; then
    # Keep the script running to handle Ctrl+C for daemon cleanup
    while true; do sleep 1; done
fi
