#!/usr/bin/env pwsh
# Test Auth Backend - Version Debug

$baseUrl = "http://127.0.0.1:3001"

# Test Health d'abord
Write-Host "Testing /health endpoint..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/health" -UseBasicParsing
    Write-Host "✅ Server is responding" -ForegroundColor Green
    Write-Host $response.Content
} catch {
    Write-Host "❌ Server not responding" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)"
    exit 1
}

# Test Register
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

Write-Host "Payload: $registerPayload" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/auth/register" `
        -Method POST `
        -ContentType "application/json" `
        -Body $registerPayload `
        -UseBasicParsing -ErrorAction Stop
    
    Write-Host "✅ Register SUCCESS" -ForegroundColor Green
    Write-Host ($response.Content | ConvertFrom-Json | ConvertTo-Json)
    
} catch {
    Write-Host "❌ Register FAILED" -ForegroundColor Red
    Write-Host "StatusCode: $($_.Exception.Response.StatusCode)" 
    Write-Host "Message: $($_.Exception.Message)"
    if ($_.ErrorDetails) {
        Write-Host "Error Details: $($_.ErrorDetails.Message)"
    }
}
