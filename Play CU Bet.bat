@echo off
title CU Bet - Football Tournament Betting Simulator
cd /d "%~dp0"

echo ==========================================
echo    CU Bet
echo    Football Tournament Betting Simulator
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

echo Starting the dev server...
echo Your browser will open automatically in a few seconds.
echo.
echo Leave this window open while you play. Press Ctrl+C to stop.
echo.

start "" /min cmd /c "timeout /t 5 /nobreak >nul & start "" http://localhost:3000"
call npm run dev

echo.
echo Server stopped.
pause
