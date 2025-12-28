@echo off
cls
echo.
echo ═══════════════════════════════════════════════════════════
echo   🚀 OGOUE - Frontend Local Dev Server
echo ═══════════════════════════════════════════════════════════
echo.
echo 📱 Frontend Local:    http://localhost:3000
echo 🔗 Backend (Render):  https://ogoue.onrender.com
echo 💾 Database:          Supabase (production)
echo.
echo ═══════════════════════════════════════════════════════════
echo.

cd /d "%~dp0"

REM Check if Node.js is installed
node -v >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org
    pause
    exit /b 1
)

echo ✅ Node.js found
echo.

REM Start the frontend server
echo Starting frontend server...
echo.
node frontend_server.js

pause
