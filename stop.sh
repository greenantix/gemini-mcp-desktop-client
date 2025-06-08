#!/bin/bash

# 🛑 Linux Helper - Stop Script
# This script will cleanly stop all Linux Helper processes

echo "🛑 Stopping Linux Helper - Pop!_OS Assistant"
echo "============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_status "Stopping Linux Helper daemon..."
if [ -f "src/linux-helper-daemon/stop.sh" ]; then
    cd src/linux-helper-daemon
    ./stop.sh
    cd ../..
else
    # Manual daemon stop
    pkill -f "linux-helper-daemon" 2>/dev/null || true
fi

print_status "Stopping Electron processes..."
pkill -f "electron" 2>/dev/null || true

print_status "Stopping Node.js development servers..."
pkill -f "vite" 2>/dev/null || true
pkill -f "node.*dev" 2>/dev/null || true

print_status "Freeing up ports..."
lsof -ti:5001 | xargs kill -9 2>/dev/null || true  # Backend
lsof -ti:5173 | xargs kill -9 2>/dev/null || true  # Vite dev server
lsof -ti:3847 | xargs kill -9 2>/dev/null || true  # Daemon

# Wait for processes to clean up
sleep 2

# Check if any processes are still running
REMAINING=$(pgrep -f "linux-helper\|electron.*gemini-mcp" 2>/dev/null | wc -l)

if [ "$REMAINING" -gt 0 ]; then
    print_warning "Some processes are still running. Force killing..."
    pkill -9 -f "linux-helper" 2>/dev/null || true
    pkill -9 -f "electron.*gemini-mcp" 2>/dev/null || true
    sleep 1
fi

print_success "✅ Linux Helper stopped successfully!"
echo ""
echo "All processes have been terminated."
echo "Ports 5001, 5173, and 3847 are now free."
echo ""
echo "To start again, run: ./start.sh"