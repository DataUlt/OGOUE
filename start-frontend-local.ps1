#!/usr/bin/env pwsh

Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  🚀 OGOUE - Frontend Local Dev Server" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📱 Frontend Local:    http://localhost:3000" -ForegroundColor Green
Write-Host "🔗 Backend (Render):  https://ogoue.onrender.com" -ForegroundColor Green
Write-Host "💾 Database:          Supabase (production)" -ForegroundColor Green
Write-Host ""
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node -v 2>$null
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed or not in PATH" -ForegroundColor Red
    Write-Host "Please install Node.js from https://nodejs.org" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ""
Write-Host "Starting frontend server..." -ForegroundColor Yellow
Write-Host ""

# Start the server
& node frontend_server.js
