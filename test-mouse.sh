#!/bin/bash
echo "Testing your mouse buttons..."
echo "Click ANY mouse button and I'll tell you which one it is"
echo "Press Ctrl+C to stop"
echo ""
xinput test-xi2 --root | grep -A2 ButtonPress