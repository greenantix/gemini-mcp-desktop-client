#!/bin/bash

echo "🖱️ Testing Forward Mouse Button Detection"
echo "========================================="
echo ""
echo "This script will monitor mouse button presses."
echo "Press the FORWARD button (side button) on your mouse."
echo "Press Ctrl+C to exit."
echo ""

# Check if xinput is installed
if ! command -v xinput &> /dev/null; then
    echo "❌ xinput is not installed. Installing..."
    sudo apt-get update && sudo apt-get install -y xinput
fi

echo "Monitoring mouse events..."
echo ""

# Monitor mouse events and filter for button presses
xinput test-xi2 --root | while read line; do
    if [[ $line == *"ButtonPress"* ]]; then
        # Extract button number
        if [[ $line == *"detail: 9"* ]]; then
            echo "✅ FORWARD BUTTON DETECTED! (Button 9)"
            echo "   This is the button that will trigger Linux Helper"
        elif [[ $line == *"detail: 8"* ]]; then
            echo "⬅️ Back button detected (Button 8)"
        elif [[ $line == *"detail:"* ]]; then
            button=$(echo $line | grep -o 'detail: [0-9]*' | grep -o '[0-9]*')
            echo "🖱️ Button $button pressed"
        fi
    fi
done