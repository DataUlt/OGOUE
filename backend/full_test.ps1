#!/usr/bin/env pwsh
# Comprehensive Auth Backend Tests
# Starts server, waits, then runs all tests

$ErrorActionPreference = "Continue"
$baseUrl = "http://127.0.0.1:3001"

# Kill any existing node processes
Write-Host "Cleaning up existing node processes..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# Start backend in a background job
Write-Host "Starting backend server..." -ForegroundColor Yellow
$backendDir = "c:\Users\Benoit NZIENGUI\Desktop\PFE--OGOUE\OGOUE_COMBINED - Copie\OGOUE_COMBINED\backend"
Push-Location $backendDir

$backendJob = Start-Job -ScriptBlock {
    cd "c:\Users\Benoit NZIENGUI\Desktop\PFE--OGOUE\OGOUE_COMBINED - Copie\OGOUE_COMBINED\backend"
    npm run dev 2>&1
}

# Wait for server to start
Write-Host "Waiting for backend to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 4

# Test health endpoint
Write-Host "`n=== HEALTH CHECK ===" -ForegroundColor Cyan
$healthAttempts = 0
$healthOk = $false
do {
    $healthAttempts++
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl/health" -UseBasicParsing -TimeoutSec 2
        Write-Host "✅ Server is responding on port 3001" -ForegroundColor Green
        Write-Host "Response: $($response.Content)" -ForegroundColor Cyan
        $healthOk = $true
        break
    } catch {
        if ($healthAttempts -lt 3) {
            Write-Host "Retry $healthAttempts... Server not ready yet" -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        } else {
            Write-Host "❌ Server not responding after 3 attempts" -ForegroundColor Red
            Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
            exit 1
        }
    }
} while ($healthAttempts -lt 3)

if (-not $healthOk) {
    exit 1
}

# 1A - REGISTER TEST
Write-Host "`n=== TEST 1A: REGISTER ===" -ForegroundColor Green

$registerPayload = @{
    firstName = "Benoit"
    lastName = "Test"
    email = "benoit@test.com"
    password = "Test1234!"
    organizationName = "OGOUE Demo"
    rccmNumber = "RCCM-001"
    nifNumber = "NIF-001"
    activity = "Commerce"
    activityDescription = "Org de test"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-WebRequest -Uri "$baseUrl/api/auth/register" `
        -Method POST `
        -ContentType "application/json" `
        -Body $registerPayload `
        -UseBasicParsing
    
    $registerData = $registerResponse.Content | ConvertFrom-Json
    $token = $registerData.token
    $userId = $registerData.user.id
    
    Write-Host "✅ Register SUCCESS (201)" -ForegroundColor Green
    Write-Host "Token: $($token.Substring(0, 30))..." -ForegroundColor Cyan
    Write-Host "User ID: $userId" -ForegroundColor Cyan
    Write-Host "Organization: $($registerData.organization.name)" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Register FAILED" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    Pop-Location
    Stop-Job -Job $backendJob
    exit 1
}

# 1B - LOGIN TEST
Write-Host "`n=== TEST 1B: LOGIN ===" -ForegroundColor Green

$loginPayload = @{
    email = "benoit@test.com"
    password = "Test1234!"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginPayload `
        -UseBasicParsing
    
    $loginData = $loginResponse.Content | ConvertFrom-Json
    $token = $loginData.token
    
    Write-Host "✅ Login SUCCESS (200)" -ForegroundColor Green
    Write-Host "Token: $($token.Substring(0, 30))..." -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Login FAILED" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    Pop-Location
    Stop-Job -Job $backendJob
    exit 1
}

# 1C - ME TEST
Write-Host "`n=== TEST 1C: ME (Authenticated) ===" -ForegroundColor Green

try {
    $meResponse = Invoke-WebRequest -Uri "$baseUrl/api/auth/me" `
        -Method GET `
        -Headers @{ Authorization = "Bearer $token" } `
        -UseBasicParsing
    
    $meData = $meResponse.Content | ConvertFrom-Json
    
    Write-Host "✅ ME SUCCESS (200)" -ForegroundColor Green
    Write-Host "User: $($meData.user.firstName) $($meData.user.lastName)" -ForegroundColor Cyan
    Write-Host "Email: $($meData.user.email)" -ForegroundColor Cyan
    Write-Host "Organization ID: $($meData.user.organizationId)" -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ ME FAILED" -ForegroundColor Red
    Write-Host "Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
    Write-Host "Message: $($_.Exception.Message)" -ForegroundColor Red
    Pop-Location
    Stop-Job -Job $backendJob
    exit 1
}

Write-Host "`n=== ALL TESTS PASSED ✅ ===" -ForegroundColor Green
Write-Host "Backend is ready for integration!" -ForegroundColor Green

Pop-Location

# Keep job running
Write-Host "`nBackend server is running in background. Press Ctrl+C to stop." -ForegroundColor Yellow
Wait-Job -Job $backendJob
