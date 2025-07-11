#!/bin/bash

# Alarm PWA Setup Script
echo "🚀 Setting up Alarm PWA..."

# Check if we're in the right directory
if [ ! -f "index.html" ]; then
    echo "❌ Error: Please run this script from the alarm-pwa directory"
    echo "   Make sure index.html is in the current directory"
    exit 1
fi

echo "✅ Found index.html - in correct directory"

# Check for icons directory
if [ ! -d "icons" ]; then
    echo "📁 Creating icons directory..."
    mkdir icons
fi

# Check if icons exist
icon_count=$(ls icons/*.svg 2>/dev/null | wc -l)
if [ "$icon_count" -eq 0 ]; then
    echo "⚠️  No icons found in icons/ directory"
    echo "   Icons are already included as SVG files!"
    echo "   If you don't see them, make sure you extracted all files correctly"
    echo ""
    echo "📋 Current project structure should include:"
    echo "   - icons/icon-*.svg files (8 total)"
    echo "   - All other project files"
    echo ""
    echo "🔧 If icons are missing, check that all files were extracted properly"
    echo "   Or use the svg-to-png-converter.html to generate PNG versions"
    echo ""
    exit 1
else
    echo "✅ Found $icon_count icon files"
fi

# Check for Python
if command -v python3 > /dev/null; then
    PYTHON_CMD="python3"
elif command -v python > /dev/null; then
    PYTHON_CMD="python"
else
    echo "❌ Python not found. Please install Python to run the local server."
    echo "   Alternative: Use any other local server method from the README"
    exit 1
fi

echo "✅ Found Python: $PYTHON_CMD"

# Check if port 8000 is available
if lsof -i :8000 > /dev/null 2>&1; then
    echo "⚠️  Port 8000 is already in use"
    echo "   Trying port 8001..."
    PORT=8001
    if lsof -i :8001 > /dev/null 2>&1; then
        echo "⚠️  Port 8001 is also in use"
        echo "   Please manually choose a different port"
        echo "   Run: $PYTHON_CMD -m http.server [PORT]"
        exit 1
    fi
else
    PORT=8000
fi

echo ""
echo "🎉 Setup complete! Starting local server..."
echo ""
echo "📱 Your Alarm PWA will be available at:"
echo "   http://localhost:$PORT"
echo ""
echo "📋 Next steps:"
echo "   1. Open the URL above in your browser"
echo "   2. Grant notification permissions when prompted"
echo "   3. To install as PWA:"
echo "      • Android: Menu → 'Add to Home Screen'"
echo "      • iOS: Share → 'Add to Home Screen'"
echo "      • Desktop: Look for install icon in address bar"
echo ""
echo "⏰ Press Ctrl+C to stop the server"
echo ""

# Start the server
$PYTHON_CMD -m http.server $PORT