@echo off
echo 🚀 Setting up Alarm PWA...

REM Check if we're in the right directory
if not exist "index.html" (
    echo ❌ Error: Please run this script from the alarm-pwa directory
    echo    Make sure index.html is in the current directory
    pause
    exit /b 1
)

echo ✅ Found index.html - in correct directory

REM Check for icons directory
if not exist "icons" (
    echo 📁 Creating icons directory...
    mkdir icons
)

REM Count SVG files in icons directory
set icon_count=0
for %%f in (icons\*.svg) do set /a icon_count+=1

if %icon_count%==0 (
    echo ⚠️  No icons found in icons\ directory
    echo    Icons are already included as SVG files!
    echo    If you don't see them, make sure you extracted all files correctly
    echo.
    echo 📋 Current project structure should include:
    echo    - icons\icon-*.svg files (8 total)
    echo    - All other project files
    echo.
    echo 🔧 If icons are missing, check that all files were extracted properly
    echo    Or use the svg-to-png-converter.html to generate PNG versions
    echo.
    pause
    exit /b 1
) else (
    echo ✅ Found %icon_count% icon files
)

REM Check for Python
python --version >nul 2>&1
if %errorlevel%==0 (
    set PYTHON_CMD=python
    echo ✅ Found Python
) else (
    python3 --version >nul 2>&1
    if %errorlevel%==0 (
        set PYTHON_CMD=python3
        echo ✅ Found Python3
    ) else (
        echo ❌ Python not found. Please install Python to run the local server.
        echo    Alternative: Use any other local server method from the README
        pause
        exit /b 1
    )
)

REM Check if port 8000 is available
netstat -an | find "8000" >nul
if %errorlevel%==0 (
    echo ⚠️  Port 8000 is already in use
    echo    Trying port 8001...
    set PORT=8001
    netstat -an | find "8001" >nul
    if %errorlevel%==0 (
        echo ⚠️  Port 8001 is also in use
        echo    Please manually choose a different port
        echo    Run: %PYTHON_CMD% -m http.server [PORT]
        pause
        exit /b 1
    )
) else (
    set PORT=8000
)

echo.
echo 🎉 Setup complete! Starting local server...
echo.
echo 📱 Your Alarm PWA will be available at:
echo    http://localhost:%PORT%
echo.
echo 📋 Next steps:
echo    1. Open the URL above in your browser
echo    2. Grant notification permissions when prompted
echo    3. To install as PWA:
echo       • Android: Menu → 'Add to Home Screen'
echo       • iOS: Share → 'Add to Home Screen'
echo       • Desktop: Look for install icon in address bar
echo.
echo ⏰ Press Ctrl+C to stop the server
echo.

REM Start the server
%PYTHON_CMD% -m http.server %PORT%