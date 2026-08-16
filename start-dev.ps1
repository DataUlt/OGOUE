# =====================================================
#  OGOUE - Environnement de developpement local
#
#  Usage :  .\start-dev.ps1
#
#  Backend  (API)      -> http://localhost:3001
#  Frontend (site web) -> http://localhost:8080
#
#  Chaque serveur s'ouvre dans sa propre fenetre PowerShell.
#  Fermez la fenetre ou faites Ctrl+C pour arreter un serveur.
# =====================================================

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot

Write-Host ""
Write-Host "=== OGOUE - demarrage de l'environnement local ===" -ForegroundColor Cyan
Write-Host ""

# --- 1. Verifier la configuration du backend -------------------------
$envFile = Join-Path $root "backend\.env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERREUR : le fichier backend\.env est introuvable." -ForegroundColor Red
    Write-Host ""
    Write-Host "Ce fichier contient vos cles Supabase et n'est volontairement pas"
    Write-Host "versionne dans Git. Pour le creer :"
    Write-Host ""
    Write-Host "   Copy-Item backend\.env.example backend\.env" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "puis renseignez les valeurs indiquees dans backend\.env.example."
    exit 1
}

# --- 2. Liberer les ports 3001 et 8080 s'ils sont occupes -------------
foreach ($port in 3001, 8080) {
    $busy = (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).OwningProcess |
            Select-Object -Unique
    foreach ($procId in $busy) {
        if ($procId -ne 0) {
            Write-Host "Port $port deja utilise : arret du processus $procId" -ForegroundColor DarkYellow
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        }
    }
}

# --- 3. Installer les dependances du backend si necessaire ------------
if (-not (Test-Path (Join-Path $root "backend\node_modules"))) {
    Write-Host "Installation des dependances du backend..." -ForegroundColor Cyan
    Push-Location (Join-Path $root "backend")
    npm install
    Pop-Location
}

# --- 4. Lancer les deux serveurs --------------------------------------
# Backend en mode --watch : il redemarre tout seul a chaque modification
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$root\backend'; Write-Host 'BACKEND - http://localhost:3001' -ForegroundColor Green; npm run dev"
)

# Frontend : serveur statique, -c-1 desactive le cache navigateur
Start-Process powershell -ArgumentList @(
    "-NoExit", "-Command",
    "Set-Location '$root\frontend'; Write-Host 'FRONTEND - http://localhost:8080' -ForegroundColor Green; npx http-server . -p 8080 -c-1"
)

Write-Host ""
Write-Host "Deux fenetres viennent de s'ouvrir :" -ForegroundColor Green
Write-Host "   Backend  ->  http://localhost:3001"
Write-Host "   Frontend ->  http://localhost:8080"
Write-Host ""
Write-Host "Pages utiles :"
Write-Host "   Connexion          http://localhost:8080/login.html"
Write-Host "   Mot de passe oub.  http://localhost:8080/forgot-password.html"
Write-Host "   Tableau de bord    http://localhost:8080/app/module_tableau_bord.html"
Write-Host ""
Write-Host "Le backend redemarre automatiquement quand vous modifiez un fichier."
Write-Host "Pour le frontend, un simple rafraichissement du navigateur suffit."
Write-Host ""
