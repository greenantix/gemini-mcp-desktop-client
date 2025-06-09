#!/bin/bash
echo "Testing your SteelSeries mouse buttons..."
echo "Click ANY button on your mouse to see its number:"
echo ""

# Test the specific SteelSeries mouse device
xinput test 9 | while read line; do
    if [[ $line == *"button press"* ]] || [[ $line == *"button release"* ]]; then
        echo "Detected: $line"
        if [[ $line == *" 9 "* ]]; then
            echo "🎯 FORWARD BUTTON FOUND! This is button 9"
        elif [[ $line == *" 8 "* ]]; then
            echo "⬅️ BACK BUTTON FOUND! This is button 8"
        fi
    fi
done