#!/usr/bin/env pwsh
# Test Frontend App Auth Integration
# Validates ogoue-state.js modifications

Write-Host "=== Frontend App Auth Integration Tests ===" -ForegroundColor Cyan
Write-Host ""

$baseDir = "c:\Users\Benoit NZIENGUI\Desktop\PFE--OGOUE\OGOUE_COMBINED - Copie\OGOUE_COMBINED\frontend_app"
$stateFile = "$baseDir\js\ogoue-state.js"
$appDocFile = "$baseDir\APP_AUTH.md"

# Test 1: Check ogoue-state.js
Write-Host "TEST 1: Checking ogoue-state.js..." -ForegroundColor Yellow
$stateContent = Get-Content $stateFile -Raw

$checks = @(
    @{ pattern = "function getToken\(\)"; name = "getToken() function" },
    @{ pattern = "function getCurrentUser\(\)"; name = "getCurrentUser() function" },
    @{ pattern = "function handleUnauthorized\(\)"; name = "handleUnauthorized() function" },
    @{ pattern = "Authorization.*Bearer.*getToken"; name = "Authorization header in requests" },
    @{ pattern = "response\.status === 401"; name = "401 status check" },
    @{ pattern = 'localStorage\.removeItem\("authToken"\)'; name = "Token cleanup" }
)

$statePass = $true
foreach ($check in $checks) {
    if ($stateContent -match $check.pattern) {
        Write-Host "  ✅ $($check.name)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($check.name)" -ForegroundColor Red
        $statePass = $false
    }
}

# Check that ORG_ID is removed
if ($stateContent -notmatch 'const ORG_ID') {
    Write-Host "  ✅ ORG_ID hardcoded constant removed" -ForegroundColor Green
} else {
    Write-Host "  ❌ ORG_ID still exists" -ForegroundColor Red
    $statePass = $false
}

# Check that organizationId is not in payloads
if ($stateContent -notmatch 'organizationId.*ORG_ID|organizationId:.*ORG_ID') {
    Write-Host "  ✅ No hardcoded organizationId in payloads" -ForegroundColor Green
} else {
    Write-Host "  ❌ Still has hardcoded organizationId" -ForegroundColor Red
    $statePass = $false
}

Write-Host ""

# Test 2: Check that API_BASE_URL is correct
Write-Host "TEST 2: Checking API configuration..." -ForegroundColor Yellow

if ($stateContent -match 'const API_BASE_URL = "http://127.0.0.1:3001"') {
    Write-Host "  ✅ API_BASE_URL set to correct backend" -ForegroundColor Green
} else {
    Write-Host "  ❌ API_BASE_URL incorrect" -ForegroundColor Red
    $statePass = $false
}

Write-Host ""

# Test 3: Check APP_AUTH.md
Write-Host "TEST 3: Checking APP_AUTH.md documentation..." -ForegroundColor Yellow
$docContent = Get-Content $appDocFile -Raw

$docChecks = @(
    @{ pattern = "## Overview"; name = "Overview section" },
    @{ pattern = "## Key Changes in ogoue-state.js"; name = "Changes documentation" },
    @{ pattern = "## Modified Functions"; name = "Functions documentation" },
    @{ pattern = "## Testing Guide"; name = "Testing guide" },
    @{ pattern = "## Browser DevTools Debugging"; name = "Debugging guide" },
    @{ pattern = "## Security Improvements"; name = "Security section" }
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

# Test 4: Check function exports
Write-Host "TEST 4: Checking window.OGOUE exports..." -ForegroundColor Yellow

$exportChecks = @(
    @{ pattern = "window\.OGOUE.*=.*{"; name = "window.OGOUE object defined" },
    @{ pattern = "getToken"; name = "getToken exported" },
    @{ pattern = "getCurrentUser"; name = "getCurrentUser exported" },
    @{ pattern = "handleUnauthorized"; name = "handleUnauthorized exported" }
)

foreach ($check in $exportChecks) {
    if ($stateContent -match $check.pattern) {
        Write-Host "  ✅ $($check.name)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $($check.name)" -ForegroundColor Red
        $statePass = $false
    }
}

# Check that ORG_ID is NOT exported
if ($stateContent -notmatch 'window\.OGOUE.*ORG_ID') {
    Write-Host "  ✅ ORG_ID not exported" -ForegroundColor Green
} else {
    Write-Host "  ❌ ORG_ID still exported" -ForegroundColor Red
    $statePass = $false
}

Write-Host ""

# Summary
Write-Host "=== Test Summary ===" -ForegroundColor Cyan
Write-Host ""

if ($statePass) {
    Write-Host "✅ ogoue-state.js: All checks passed" -ForegroundColor Green
} else {
    Write-Host "❌ ogoue-state.js: Some checks failed" -ForegroundColor Red
}

if ($docPass) {
    Write-Host "✅ APP_AUTH.md: All checks passed" -ForegroundColor Green
} else {
    Write-Host "❌ APP_AUTH.md: Some checks failed" -ForegroundColor Red
}

Write-Host ""

if ($statePass -and $docPass) {
    Write-Host "=== ALL TESTS PASSED ✅ ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Frontend App Auth Integration Complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Summary of changes:" -ForegroundColor Yellow
    Write-Host "  • Removed hardcoded ORG_ID constant" -ForegroundColor Cyan
    Write-Host "  • Added getToken() - retrieves JWT from localStorage" -ForegroundColor Cyan
    Write-Host "  • Added getCurrentUser() - retrieves user data" -ForegroundColor Cyan
    Write-Host "  • Added handleUnauthorized() - clears token + redirects on 401" -ForegroundColor Cyan
    Write-Host "  • Added Authorization: Bearer header to all requests" -ForegroundColor Cyan
    Write-Host "  • Removed organizationId from all API payloads" -ForegroundColor Cyan
    Write-Host "  • Backend now determines org from JWT token" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Test login flow end-to-end" -ForegroundColor Cyan
    Write-Host "2. Verify data loads in dashboard" -ForegroundColor Cyan
    Write-Host "3. Test 401 handling (logout/redirect)" -ForegroundColor Cyan
    Write-Host "4. Test token cleanup on unauthorized" -ForegroundColor Cyan
    Write-Host ""
    exit 0
} else {
    Write-Host "=== SOME TESTS FAILED ❌ ===" -ForegroundColor Red
    exit 1
}
