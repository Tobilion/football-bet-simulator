@echo off
title Matchday Exchange - Football Tournament Simulator
cd /d "%~dp0"

echo ==========================================
echo    Matchday Exchange
echo    Football Tournament Simulator
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [!] Node.js is not installed, or not on your PATH.
    echo     Install it from https://nodejs.org then run this file again.
    echo.
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo First run detected - installing dependencies.
    echo This can take a minute or two...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [!] npm install failed. Scroll up to see why.
        pause
        exit /b 1
    )
    echo.
)

echo Starting the wallet server (optional - the game also works if this
echo fails to start; it'll just run fully offline/local instead)...
start "Matchday Exchange Wallet Server" /min cmd /c "npm run server"

echo Starting the dev server...
echo Your browser will open automatically in a few seconds.
echo.
echo Leave this window open while you play. Press Ctrl+C to stop.
echo (Closing this window does NOT stop the wallet server - close its own
echo  minimized window too, or just leave it running, it's harmless.)
echo.

start "" /min cmd /c "timeout /t 5 /nobreak >nul & start "" http://localhost:3001"
call npm run dev

echo.
echo Server stopped.
pause
