#!/bin/bash
echo "Testing Forward Button..."
echo "Click your mouse's FORWARD button (front side button)"
echo ""
# Monitor xinput for button 9
xinput test-xi2 --root | while read line; do
    if [[ $line == *"ButtonPress"* ]] && [[ $line == *"detail: 9"* ]]; then
        echo "✅ FORWARD BUTTON DETECTED!"
        echo "The daemon should trigger the popup now."
    fi
done