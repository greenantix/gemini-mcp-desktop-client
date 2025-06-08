#!/bin/bash

echo "🖱️  Mouse Button Detection Tool"
echo "============================="
echo ""
echo "This will help us identify which mouse button you want to use."
echo "We'll monitor for 10 seconds - please click the mouse button you want to use."
echo ""
echo "Press Enter to start monitoring..."
read

echo "Monitoring mouse events for 10 seconds..."
echo "Please click your desired mouse button now!"
echo ""

# Use xinput to list devices and find mouse
MOUSE_ID=$(xinput list | grep -i mouse | head -1 | grep -o 'id=[0-9]*' | cut -d= -f2)

if [ -z "$MOUSE_ID" ]; then
    echo "❌ Could not find mouse device. Trying alternative method..."
    # Alternative: monitor all pointer devices
    timeout 10s xinput test-xi2 --root | grep -E "(ButtonPress|ButtonRelease)" | head -5
else
    echo "📱 Found mouse device ID: $MOUSE_ID"
    echo "Monitoring button events..."
    timeout 10s xinput test $MOUSE_ID | head -10
fi

echo ""
echo "✅ Monitoring complete!"
echo ""
echo "Common mouse button mappings:"
echo "  Button 1 = Left click"
echo "  Button 2 = Middle click (scroll wheel)"
echo "  Button 3 = Right click"
echo "  Button 4 = Scroll up"
echo "  Button 5 = Scroll down"
echo "  Button 8 = Side button (back)"
echo "  Button 9 = Side button (forward)"
echo ""
echo "Which button number did you see when you clicked? (or type 'auto' to use middle-click)"
read BUTTON_CHOICE

if [ "$BUTTON_CHOICE" = "auto" ]; then
    BUTTON_CHOICE="2"
    echo "Using middle-click (button 2) as the hotkey"
fi

echo "Selected button: $BUTTON_CHOICE"
echo ""
echo "To use this button as the hotkey, we'll update the daemon configuration."