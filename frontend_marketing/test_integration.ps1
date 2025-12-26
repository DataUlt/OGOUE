#!/usr/bin/env pwsh
# Test Frontend Marketing Integration
# Tests that login.html and signin.html have correct JS code

Write-Host "=== Frontend Marketing Auth Integration Tests ===" -ForegroundColor Cyan
Write-Host ""

$baseDir = "c:\Users\Benoit NZIENGUI\Desktop\PFE--OGOUE\OGOUE_COMBINED - Copie\OGOUE_COMBINED\frontend_marketing\homepage"
$loginFile = "$baseDir\login.html"
$signinFile = "$baseDir\signin.html"
$authDocFile = "$baseDir\..\AUTH_FLOW.md"

# Test 1: Check login.html
Write-Host "TEST 1: Checking login.html..." -ForegroundColor Yellow
$loginContent = Get-Content $loginFile -Raw

$checks = @(
    @{ pattern = "handleLogin"; name = "handleLogin function" },
    @{ pattern = "API_BASE_URL"; name = "API_BASE_URL constant" },
    @{ pattern = "localStorage.setItem\('authToken'"; name = "Token storage" },
    @{ pattern = "showError"; name = "Error handling" },
    @{ pattern = "onsubmit\s*=\s*['\"]handleLogin"; name = "Form submission handler" }
)

$loginPass = $true
foreach ($check in $checks) {
    if ($loginContent -match $check.pattern) {
        Write-Host "  ✅ $($check.name)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($check.name)" -ForegroundColor Red
        $loginPass = $false
    }
}

Write-Host ""

# Test 2: Check signin.html
Write-Host "TEST 2: Checking signin.html..." -ForegroundColor Yellow
$signinContent = Get-Content $signinFile -Raw

$signinPass = $true
foreach ($check in $checks) {
    # Also check for handleSignup in addition
    if ($check.pattern -eq "handleLogin") {
        $pattern = "handleSignup"
    } else {
        $pattern = $check.pattern
    }
    
    if ($signinContent -match $pattern) {
        Write-Host "  ✅ $($check.name)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($check.name)" -ForegroundColor Red
        $signinPass = $false
    }
}

# Additional check for registration API call
if ($signinContent -match "/api/auth/register") {
    Write-Host "  ✅ POST /api/auth/register call" -ForegroundColor Green
} else {
    Write-Host "  ❌ POST /api/auth/register call" -ForegroundColor Red
    $signinPass = $false
}

Write-Host ""

# Test 3: Check AUTH_FLOW.md
Write-Host "TEST 3: Checking AUTH_FLOW.md..." -ForegroundColor Yellow
$docContent = Get-Content $authDocFile -Raw

$docChecks = @(
    @{ pattern = "Login Flow"; name = "Login flow documentation" },
    @{ pattern = "Signup Flow"; name = "Signup flow documentation" },
    @{ pattern = "LocalStorage Format"; name = "LocalStorage documentation" },
    @{ pattern = "Error Handling"; name = "Error handling documentation" },
    @{ pattern = "Testing Guide"; name = "Testing guide" }
)

$docPass = $true
foreach ($check in $docChecks) {
    if ($docContent -match $check.pattern) {
        Write-Host "  ✅ $($check.name)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($check.name)" -ForegroundColor Red
        $docPass = $false
    }
}

Write-Host ""

# Summary
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host ""

if ($loginPass) {
    Write-Host "✅ login.html: All checks passed" -ForegroundColor Green
} else {
    Write-Host "❌ login.html: Some checks failed" -ForegroundColor Red
}

if ($signinPass) {
    Write-Host "✅ signin.html: All checks passed" -ForegroundColor Green
} else {
    Write-Host "❌ signin.html: Some checks failed" -ForegroundColor Red
}

if ($docPass) {
    Write-Host "✅ AUTH_FLOW.md: All checks passed" -ForegroundColor Green
} else {
    Write-Host "❌ AUTH_FLOW.md: Some checks failed" -ForegroundColor Red
}

Write-Host ""

if ($loginPass -and $signinPass -and $docPass) {
    Write-Host "=== ALL TESTS PASSED ✅ ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Frontend Marketing Auth Integration Ready!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Test in browser:" -ForegroundColor Yellow
    Write-Host "   - Open login.html in browser" -ForegroundColor Cyan
    Write-Host "   - Enter credentials: benoit@test.com / Test1234!" -ForegroundColor Cyan
    Write-Host "   - Check that you're redirected to module_tableau_bord.html" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "2. Check localStorage:" -ForegroundColor Yellow
    Write-Host "   - Open DevTools (F12)" -ForegroundColor Cyan
    Write-Host "   - Go to Application > LocalStorage" -ForegroundColor Cyan
    Write-Host "   - Check authToken and user are stored" -ForegroundColor Cyan
    Write-Host ""
    exit 0
} else {
    Write-Host "=== SOME TESTS FAILED ❌ ===" -ForegroundColor Red
    exit 1
}
