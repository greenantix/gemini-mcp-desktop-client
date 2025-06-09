#!/bin/bash

# 🛑 Linux Helper - Stop Script
# This script will cleanly stop all Linux Helper processes

echo "🛑 Stopping Linux Helper - Pop!_OS Assistant"
echo "============================================="

# --- Configuration ---
ROOT_DIR=$(pwd) # Assuming script is run from project root
DAEMON_PID_FILE="/tmp/linux-helper-daemon.lock"
DAEMON_PROCESS_PATTERN="src/linux-helper-daemon/dist/main.js" # More specific pattern
ELECTRON_PROCESS_PATTERN="electron/main.js" # Pattern for the main Electron process
VITE_PROCESS_PATTERN="vite" # Pattern for Vite

# Colors for output
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

# --- Stop Main Application (Electron + Vite) ---
print_status "Stopping main Electron application and Vite server..."
pkill -f "$ELECTRON_PROCESS_PATTERN" 2>/dev/null
if [ $? -eq 0 ]; then
    print_success "Electron process(es) signaled."
else
    print_warning "No Electron process found matching '$ELECTRON_PROCESS_PATTERN'."
fi

pkill -f "$VITE_PROCESS_PATTERN" 2>/dev/null
if [ $? -eq 0 ]; then
    print_success "Vite process(es) signaled."
else
    print_warning "No Vite process found matching '$VITE_PROCESS_PATTERN'."
fi
# General Node dev server pattern as a fallback
pkill -f "node.*dev" 2>/dev/null || true


# --- Stop Linux Helper Daemon ---
print_status "Stopping Linux Helper Daemon..."
DAEMON_STOPPED=false
if [ -f "$DAEMON_PID_FILE" ]; then
    DAEMON_PID=$(cat "$DAEMON_PID_FILE")
    if [ -n "$DAEMON_PID" ] && ps -p "$DAEMON_PID" > /dev/null; then
        print_status "Found daemon PID $DAEMON_PID from $DAEMON_PID_FILE. Sending SIGTERM..."
        kill -SIGTERM "$DAEMON_PID"
        sleep 1 # Give it a moment to shut down
        if ! ps -p "$DAEMON_PID" > /dev/null; then
            print_success "Daemon (PID $DAEMON_PID) stopped successfully."
            rm -f "$DAEMON_PID_FILE"
            print_status "Removed PID file: $DAEMON_PID_FILE"
            DAEMON_STOPPED=true
        else
            print_warning "Daemon (PID $DAEMON_PID) did not stop with SIGTERM. Sending SIGKILL..."
            kill -SIGKILL "$DAEMON_PID"
            sleep 1
            if ! ps -p "$DAEMON_PID" > /dev/null; then
                 print_success "Daemon (PID $DAEMON_PID) stopped with SIGKILL."
                 rm -f "$DAEMON_PID_FILE"
                 print_status "Removed PID file: $DAEMON_PID_FILE"
                 DAEMON_STOPPED=true
            else
                print_error "Failed to stop daemon (PID $DAEMON_PID) even with SIGKILL."
            fi
        fi
    else
        print_warning "PID file found but process $DAEMON_PID is not running or PID is empty. Removing stale PID file."
        rm -f "$DAEMON_PID_FILE"
    fi
fi

if [ "$DAEMON_STOPPED" = false ]; then
    print_status "PID file not found or daemon not stopped via PID. Attempting pkill with pattern '$DAEMON_PROCESS_PATTERN'..."
    pkill -f "$DAEMON_PROCESS_PATTERN"
    if [ $? -eq 0 ]; then
        print_success "Daemon process(es) matching '$DAEMON_PROCESS_PATTERN' signaled."
        # Attempt to remove lock file if pkill was successful and file exists (e.g. daemon created it but was killed before it could remove it)
        if [ -f "$DAEMON_PID_FILE" ]; then
            # Check if the process that owned the lock file is truly gone
            DAEMON_PID_FROM_FILE=$(cat "$DAEMON_PID_FILE")
            if [ -z "$DAEMON_PID_FROM_FILE" ] || ! ps -p "$DAEMON_PID_FROM_FILE" > /dev/null; then
                 rm -f "$DAEMON_PID_FILE"
                 print_status "Removed PID file $DAEMON_PID_FILE after pkill."
            fi
        fi
    else
        print_warning "No daemon process found matching '$DAEMON_PROCESS_PATTERN'."
    fi
fi
echo ""

# --- Free Up Ports (Forceful) ---
print_status "Ensuring ports are free..."
PORTS_TO_CLEAR=(5001 5173 3847) # Backend, Vite, Daemon (adjust if changed)
for PORT in "${PORTS_TO_CLEAR[@]}"; do
    PIDS_ON_PORT=$(lsof -t -i:$PORT 2>/dev/null)
    if [ -n "$PIDS_ON_PORT" ]; then
        print_warning "Port $PORT is in use by PID(s): $PIDS_ON_PORT. Force killing..."
        echo "$PIDS_ON_PORT" | xargs kill -9 2>/dev/null
        if [ $? -eq 0 ]; then
            print_success "Processes on port $PORT killed."
        else
            print_error "Failed to kill processes on port $PORT."
        fi
    else
        print_status "Port $PORT is already free."
    fi
done
echo ""

# --- Final Check & Cleanup ---
print_status "Performing final process check..."
# More specific patterns for remaining processes
REMAINING_DAEMON=$(pgrep -f "$DAEMON_PROCESS_PATTERN" 2>/dev/null)
REMAINING_ELECTRON=$(pgrep -f "$ELECTRON_PROCESS_PATTERN" 2>/dev/null)
REMAINING_VITE=$(pgrep -f "$VITE_PROCESS_PATTERN" 2>/dev/null)

if [ -n "$REMAINING_DAEMON" ] || [ -n "$REMAINING_ELECTRON" ] || [ -n "$REMAINING_VITE" ]; then
    print_warning "Some relevant processes might still be running. Attempting final force kill..."
    [ -n "$REMAINING_DAEMON" ] && pkill -9 -f "$DAEMON_PROCESS_PATTERN" && print_status "Force killed remaining daemon processes."
    [ -n "$REMAINING_ELECTRON" ] && pkill -9 -f "$ELECTRON_PROCESS_PATTERN" && print_status "Force killed remaining Electron processes."
    [ -n "$REMAINING_VITE" ] && pkill -9 -f "$VITE_PROCESS_PATTERN" && print_status "Force killed remaining Vite processes."
    sleep 1
else
    print_success "No relevant processes seem to be running."
fi
echo ""

print_success "✅ Linux Helper stop sequence complete!"
echo "To start again, run: $ROOT_DIR/start.sh"