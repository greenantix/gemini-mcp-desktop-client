#!/bin/bash

echo "🔧 Simple Forward Button Test"
echo "=============================="
echo ""
echo "1. First, let's test if F10 shows the popup (even without AI):"
echo "   Press F10 now"
echo ""
echo "2. Then we'll figure out your Forward button"
echo ""
echo "Press any key to continue..."
read

echo ""
echo "Now we'll test your Forward button detection:"
echo "We'll run a 10-second test - click your Forward button repeatedly"
echo ""
echo "Starting in 3 seconds..."
sleep 3

echo "Click your Forward button NOW! (10 seconds)"
timeout 10s xinput test-xi2 --root 2>/dev/null | grep -E "(ButtonPress|button press)" | head -5

echo ""
echo "Did you see any button press events? If yes, what button numbers?"