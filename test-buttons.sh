#!/bin/bash
echo "Mouse Button Tester"
echo "==================="
echo ""
echo "Click any mouse button to see which number it is:"
echo "(Press Ctrl+C to stop)"
echo ""

xinput test-xi2 --root | grep --line-buffered "ButtonPress" | while read -r line; do
    button=$(echo "$line" | grep -o "detail: [0-9]*" | cut -d' ' -f2)
    case $button in
        1) echo "Left Click (Button 1)" ;;
        2) echo "Middle Click (Button 2)" ;;
        3) echo "Right Click (Button 3)" ;;
        4) echo "Scroll Up (Button 4)" ;;
        5) echo "Scroll Down (Button 5)" ;;
        8) echo "Back/Side Button (Button 8)" ;;
        9) echo "🎯 FORWARD BUTTON (Button 9) - This is what triggers Linux Helper!" ;;
        *) echo "Button $button" ;;
    esac
done