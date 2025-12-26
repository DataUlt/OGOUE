@echo off
REM Kill any existing node processes
taskkill /F /IM node.exe >nul 2>&1

REM Start backend in a separate window  
start "OGOUE Backend" /D "c:\Users\Benoit NZIENGUI\Desktop\PFE--OGOUE\OGOUE_COMBINED - Copie\OGOUE_COMBINED\backend" cmd /k "npm run dev"

REM Wait for backend to start
timeout /t 4 /nobreak

REM Run tests
powershell -NoProfile -ExecutionPolicy Bypass -File "c:\Users\Benoit NZIENGUI\Desktop\PFE--OGOUE\OGOUE_COMBINED - Copie\OGOUE_COMBINED\backend\test_debug.ps1"

pause
