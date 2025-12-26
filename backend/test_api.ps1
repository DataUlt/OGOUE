# Test Script for OGOUE API
# Usage: .\test_api.ps1

$BASE_URL = "http://127.0.0.1:3001"
$ErrorActionPreference = "Continue"

Write-Host "🧪 OGOUE API Test Suite" -ForegroundColor Cyan
Write-Host "Base URL: $BASE_URL`n" -ForegroundColor Gray

# Test 1: Health Check
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "Test 1: Health Check" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue

try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/health" -TimeoutSec 5 -UseBasicParsing
    $content = $response.Content | ConvertFrom-Json
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($content | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
Write-Host ""

# Test 2: Register
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "Test 2: Register Endpoint" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue

$registerData = @{
    email = "testuser_$(Get-Random)@ogoue.com"
    password = "Test@123456"
    firstName = "John"
    lastName = "Doe"
    organizationName = "OGOUE Test Corp $(Get-Random)"
    activity = "Microfinance"
    activityDescription = "Test organization"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/auth/register" `
        -Method POST `
        -Body $registerData `
        -ContentType "application/json" `
        -TimeoutSec 10 `
        -UseBasicParsing
    
    $content = $response.Content | ConvertFrom-Json
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($content | ConvertTo-Json -Compress)" -ForegroundColor Green
    
    if ($response.StatusCode -eq 201) {
        Write-Host "✅ User registered successfully!" -ForegroundColor Green
        $token = $content.token
        Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Yellow
    }
} catch {
    $error_response = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "❌ Status: $($_.Exception.Response.StatusCode.Value)" -ForegroundColor Red
    Write-Host "Error: $($error_response.error)" -ForegroundColor Red
}
Write-Host ""

# Test 3: Login
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "Test 3: Login Endpoint" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue

$loginData = @{
    email = $registerData | ConvertFrom-Json | Select-Object -ExpandProperty email
    password = "Test@123456"
} | ConvertTo-Json

try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/api/auth/login" `
        -Method POST `
        -Body $loginData `
        -ContentType "application/json" `
        -TimeoutSec 10 `
        -UseBasicParsing
    
    $content = $response.Content | ConvertFrom-Json
    Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "✅ Login successful!" -ForegroundColor Green
} catch {
    $error_response = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "❌ Status: $($_.Exception.Response.StatusCode.Value)" -ForegroundColor Red
    Write-Host "Error: $($error_response.error)" -ForegroundColor Red
}
Write-Host ""

Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
Write-Host "✅ Test Suite Complete" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Blue
