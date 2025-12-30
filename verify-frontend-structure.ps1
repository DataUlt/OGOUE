#!/usr/bin/env pwsh

# Script de vérification de la structure frontend pour Netlify (Windows)
# Exécuter depuis VS Code Terminal

Write-Host "🔍 Vérification de la structure du frontend OGOUÉ pour Netlify..." -ForegroundColor Cyan
Write-Host ""

# Compteurs
$passed = 0
$failed = 0

# Fonction pour vérifier un fichier
function Check-File {
    param([string]$path)
    
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        Write-Host "✅ $path" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "❌ MANQUANT: $path" -ForegroundColor Red
        $script:failed++
    }
}

# Fonction pour vérifier un dossier
function Check-Directory {
    param([string]$path)
    
    if (Test-Path -LiteralPath $path -PathType Container) {
        Write-Host "✅ Dossier: $path" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "❌ MANQUANT: Dossier $path" -ForegroundColor Red
        $script:failed++
    }
}

Write-Host "📁 Vérification des dossiers principaux..." -ForegroundColor Yellow
Check-Directory "frontend"
Check-Directory "frontend\app"
Check-Directory "frontend\js"
Check-Directory "frontend\css"
Write-Host ""

Write-Host "📄 Vérification des fichiers marketing (racine /frontend)..." -ForegroundColor Yellow
Check-File "frontend\index.html"
Check-File "frontend\apropos.html"
Check-File "frontend\contact.html"
Write-Host ""

Write-Host "📱 Vérification des fichiers application (/frontend/app)..." -ForegroundColor Yellow
Check-File "frontend\app\index.html"
Check-File "frontend\app\login.html"
Check-File "frontend\app\module_tableau_bord.html"
Check-File "frontend\app\module_agents.html"
Check-File "frontend\app\module_depenses.html"
Check-File "frontend\app\module_ventes.html"
Check-File "frontend\app\module_scoring.html"
Write-Host ""

Write-Host "⚙️ Vérification des fichiers de configuration..." -ForegroundColor Yellow
Check-File "frontend\netlify.toml"
Check-File "frontend\_redirects"
Check-File "frontend\package.json"
Check-File "frontend\.env.example"
Write-Host ""

Write-Host "🔧 Vérification des scripts JavaScript..." -ForegroundColor Yellow
Check-File "frontend\js\config-api.js"
Check-File "frontend\js\dashboard.js"
Check-File "frontend\js\agents-management.js"
Write-Host ""

Write-Host "📋 Vérification de la documentation..." -ForegroundColor Yellow
Check-File "NETLIFY_DEPLOYMENT_GUIDE.md"
Write-Host ""

Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan

if ($failed -eq 0) {
    Write-Host "✅ Vérifications réussies: $passed" -ForegroundColor Green
    Write-Host "🎉 Structure complète et prête pour le déploiement !" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✅ Vérifications réussies: $passed" -ForegroundColor Green
    Write-Host "❌ Vérifications échouées: $failed" -ForegroundColor Red
    exit 1
}
