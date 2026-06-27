@echo off
title QQ Bot x Claude Code

echo === QQ Bot x Claude Code ===
echo.

if not exist "node_modules" (
    echo Installing backend dependencies...
    call npm install
)

if not exist "web\node_modules" (
    echo Installing frontend dependencies...
    cd web
    call npm install
    cd ..
)

if not exist ".env" (
    echo Creating .env from template...
    copy .env.example .env
    echo Please edit .env to fill in QQ_APP_ID and QQ_APP_SECRET
    pause
)

echo.
echo Starting backend...
start "Backend" cmd /k "cd /d %~dp0 && npm run dev"

echo Starting frontend...
start "Frontend" cmd /k "cd /d %~dp0web && npm run dev"

echo.
echo Done! Close the windows to stop services.
pause
