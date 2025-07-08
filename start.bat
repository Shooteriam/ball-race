@echo off
echo Starting Ball Race Server...
cd server
echo Current directory: %CD%
echo.
echo Checking Node.js...
where node > nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found in PATH!
    echo Please install Node.js or add it to your PATH
    pause
    exit /b 1
)
echo Node.js found!
echo.
echo Testing configuration...
node test-config.js
if %errorlevel% neq 0 (
    echo Configuration test failed!
    pause
    exit /b 1
)
echo.
echo Starting server...
npm start
pause
