#!/bin/bash

# 🚀 Linux Helper - Easy Startup Script
# This script will clean up old processes and start the application fresh

set -e  # Exit on any error

echo "🔥 Starting Linux Helper - Pop!_OS Assistant"
echo "=============================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the project root directory."
    exit 1
fi

print_status "Checking for existing processes..."

# Kill existing Electron processes
print_status "Stopping any existing Electron processes..."
pkill -f "electron" 2>/dev/null || true
pkill -f "linux-helper" 2>/dev/null || true

# Kill any processes using our ports
print_status "Freeing up ports 5001, 5173, 3847..."
lsof -ti:5001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
lsof -ti:3847 | xargs kill -9 2>/dev/null || true

# Wait a moment for processes to clean up
sleep 2

print_success "Old processes cleaned up!"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
    echo "  sudo apt-get install -y nodejs"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm first:"
    echo "  sudo apt-get install -y npm"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_warning "Node.js version is $NODE_VERSION. Recommended version is 18+."
    print_warning "You may encounter compatibility issues."
fi

print_status "Node.js version: $(node --version)"
print_status "npm version: $(npm --version)"

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    npm install
    print_success "Dependencies installed!"
else
    print_status "Dependencies already installed. Checking for updates..."
    npm update
fi

# Check for Gemini API key
if [ -z "$GEMINI_API_KEY" ] && [ ! -f ".env" ]; then
    print_warning "No GEMINI_API_KEY found in environment or .env file"
    print_warning "The AI analysis feature will not work without an API key"
    echo ""
    echo "To get your API key:"
    echo "1. Visit: https://aistudio.google.com/app/apikey"
    echo "2. Create a new API key"
    echo "3. Add it to .env file: echo 'GEMINI_API_KEY=your_key_here' > .env"
    echo ""
    read -p "Press Enter to continue without API key, or Ctrl+C to exit and set up API key..."
fi

# Make sure daemon scripts are executable
print_status "Setting up daemon permissions..."
chmod +x src/linux-helper-daemon/start.sh 2>/dev/null || true
chmod +x src/linux-helper-daemon/stop.sh 2>/dev/null || true

# Create screenshots directory
print_status "Creating screenshots directory..."
mkdir -p ~/Pictures/screenshots
print_success "Screenshots will be saved to: ~/Pictures/screenshots"

# Check for required system dependencies
print_status "Checking system dependencies..."

# Check for scrot (screenshot tool)
if ! command -v scrot &> /dev/null; then
    print_warning "scrot not found. Installing screenshot tool..."
    sudo apt-get update && sudo apt-get install -y scrot
fi

# Check for xdotool (cursor position)
if ! command -v xdotool &> /dev/null; then
    print_warning "xdotool not found. Installing cursor tracking tool..."
    sudo apt-get update && sudo apt-get install -y xdotool
fi

print_success "System dependencies ready!"

# Build the application (if needed)
if [ ! -d "dist" ] || [ ! -d "dist-electron" ]; then
    print_status "Building application..."
    npm run build
    print_success "Application built!"
fi

# Build the daemon (if needed)
print_status "Preparing daemon..."
if [ ! -f "src/linux-helper-daemon/dist/main.js" ] || [ "src/linux-helper-daemon/main.ts" -nt "src/linux-helper-daemon/dist/main.js" ]; then
    print_status "Building daemon..."
    cd src/linux-helper-daemon
    npm run build
    if [ $? -ne 0 ]; then
        print_error "Daemon build failed!"
        exit 1
    fi
    cd ../..
    print_success "Daemon built!"
else
    print_status "Daemon is up to date!"
fi

# Install daemon dependencies if needed
if [ ! -d "src/linux-helper-daemon/node_modules" ]; then
    print_status "Installing daemon dependencies..."
    cd src/linux-helper-daemon
    npm install
    cd ../..
    print_success "Daemon dependencies installed!"
fi

# Start the daemon first
print_status "Starting Linux Helper daemon..."
cd src/linux-helper-daemon
# Make sure we have the built files
if [ ! -f "dist/main.js" ]; then
    print_status "Building daemon first..."
    npm run build
fi
# Start daemon in background (not using the interactive start.sh script)
node dist/main.js &
DAEMON_PID=$!
cd ../..
print_success "Daemon started (PID: $DAEMON_PID)"

# Wait a moment for daemon to initialize
sleep 3

# Start the main application with Electron for popup support
print_status "Starting main application (Electron + Vite)..."
npm run dev &
MAIN_PID=$!

print_success "Main application started (PID: $MAIN_PID)"
print_status "Waiting for Electron app to initialize..."

# Wait a moment for everything to initialize
sleep 5

# Verify services are running
print_status "Verifying services..."

# Check daemon
if curl -s http://localhost:3847 >/dev/null 2>&1; then
    print_success "✅ Daemon is responding on port 3847"
else
    print_warning "⚠️  Daemon may not be fully ready yet (port 3847)"
fi

# Check backend API
if curl -s http://localhost:5001 >/dev/null 2>&1; then
    print_success "✅ Backend API is responding on port 5001"
else
    print_warning "⚠️  Backend API may not be fully ready yet (port 5001)"
fi

# Check if Electron is running
if pgrep -f "electron" >/dev/null 2>&1; then
    print_success "✅ Electron process is running (popup support enabled)"
else
    print_warning "⚠️  Electron process not detected (popup may not work)"
fi

print_success "🎉 Linux Helper is now running!"
echo ""
echo "📱 Application: http://localhost:5173"
echo "🔧 Backend API: http://localhost:5001"
echo "🤖 Daemon: Running on port 3847"
echo ""
echo "🔥 Press the Forward mouse button anywhere to activate Linux Helper!"
echo "   - Screenshot capture will trigger the AI popup"
echo "   - Popup will show AI-powered suggestions"
echo "   - The Forward button is typically the side button used for browser navigation"
echo "⚙️  Visit the Settings page to configure your preferences"
echo ""
echo "📋 Process IDs:"
echo "   Daemon PID: $DAEMON_PID"
echo "   Main PID: $MAIN_PID"
echo ""
echo "To stop the application:"
echo "   1. Press Ctrl+C in this terminal"
echo "   2. Or run: ./stop.sh"
echo "   3. Or kill processes: kill $DAEMON_PID $MAIN_PID"
echo ""
echo "🔧 Troubleshooting:"
echo "   If Forward button doesn't work:"
echo "   - Manual test: curl http://localhost:3847/test-popup"
echo "   - Check that Electron is running: ps aux | grep electron"
echo "   - Check daemon communication: curl http://localhost:3847/status"
echo "   - Check API endpoint: curl http://localhost:5001/api/helper-action/health"
echo "   - Check logs in this terminal for any errors"
echo ""

# Function to cleanup on exit
cleanup() {
    print_status "Shutting down Linux Helper..."
    kill $DAEMON_PID 2>/dev/null || true
    kill $MAIN_PID 2>/dev/null || true
    
    # Kill any remaining processes
    pkill -f "electron" 2>/dev/null || true
    pkill -f "linux-helper" 2>/dev/null || true
    
    print_success "Linux Helper stopped. Goodbye! 👋"
}

# Trap Ctrl+C and cleanup
trap cleanup EXIT INT TERM

# Keep the script running and show logs
print_status "Monitoring application... Press Ctrl+C to stop."
echo ""

# Wait for processes to finish
wait $MAIN_PID 2>/dev/null || true