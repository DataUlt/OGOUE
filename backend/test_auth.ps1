#!/usr/bin/env pwsh
# Test Auth Backend
# Usage: pwsh test_auth.ps1

$baseUrl = "http://127.0.0.1:3001"
$token = $null
$userId = $null

# 1A - REGISTER
Write-Host "=== TEST 1A: REGISTER ===" -ForegroundColor Green
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
    Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Cyan
    Write-Host "User ID: $userId" -ForegroundColor Cyan
    Write-Host "Organization: $($registerData.organization.name)" -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host "❌ Register FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Response.StatusCode
    Write-Host $_.ErrorDetails.Message
    exit 1
}

# 1B - LOGIN
Write-Host "=== TEST 1B: LOGIN ===" -ForegroundColor Green
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
    Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Cyan
    Write-Host ""
} catch {
    Write-Host "❌ Login FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Response.StatusCode
    Write-Host $_.ErrorDetails.Message
    exit 1
}

# 1C - ME
Write-Host "=== TEST 1C: ME (Authenticated) ===" -ForegroundColor Green
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
    Write-Host ""
} catch {
    Write-Host "❌ ME FAILED" -ForegroundColor Red
    Write-Host $_.Exception.Response.StatusCode
    Write-Host $_.ErrorDetails.Message
    exit 1
}

Write-Host "=== ALL TESTS PASSED ===" -ForegroundColor Green
