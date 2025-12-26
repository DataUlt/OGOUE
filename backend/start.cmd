@echo off
REM Quick Start Script for OGOUE Backend
REM Usage: Run this .cmd file to start everything

setlocal enabledelayedexpansion

cls
echo ╔════════════════════════════════════════════════════╗
echo ║          OGOUE Backend Quick Start                 ║
echo ╚════════════════════════════════════════════════════╝
echo.

REM Kill existing node processes
echo [1/4] Killing existing Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 1 /nobreak >nul

REM Navigate to backend directory
echo [2/4] Navigating to backend directory...
cd /d "%~dp0"

REM Install/Update dependencies
echo [3/4] Ensuring dependencies are installed...
call npm install

REM Start the server
echo [4/4] Starting server on port 3001...
echo.
echo ╔════════════════════════════════════════════════════╗
echo ║          Server Starting...                        ║
echo ║          http://127.0.0.1:3001                    ║
echo ║          Press Ctrl+C to stop                      ║
echo ╚════════════════════════════════════════════════════╝
echo.

call npm run dev

pause
