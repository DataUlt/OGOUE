#!/bin/bash

# Script de vérification de la structure frontend pour Netlify
# Exécuter depuis la racine du projet

echo "🔍 Vérification de la structure du frontend OGOUÉ pour Netlify..."
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
passed=0
failed=0

# Fonction pour vérifier un fichier
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✅${NC} $1"
        ((passed++))
    else
        echo -e "${RED}❌${NC} MANQUANT: $1"
        ((failed++))
    fi
}

# Fonction pour vérifier un dossier
check_dir() {
    if [ -d "$1" ]; then
        echo -e "${GREEN}✅${NC} Dossier: $1"
        ((passed++))
    else
        echo -e "${RED}❌${NC} MANQUANT: Dossier $1"
        ((failed++))
    fi
}

echo "📁 Vérification des dossiers principaux..."
check_dir "frontend"
check_dir "frontend/app"
check_dir "frontend/js"
check_dir "frontend/css"
echo ""

echo "📄 Vérification des fichiers marketing (racine /frontend)..."
check_file "frontend/index.html"
check_file "frontend/apropos.html"
check_file "frontend/contact.html"
echo ""

echo "📱 Vérification des fichiers application (/frontend/app)..."
check_file "frontend/app/index.html"
check_file "frontend/app/login.html"
check_file "frontend/app/module_tableau_bord.html"
check_file "frontend/app/module_agents.html"
check_file "frontend/app/module_depenses.html"
check_file "frontend/app/module_ventes.html"
check_file "frontend/app/module_scoring.html"
echo ""

echo "⚙️ Vérification des fichiers de configuration..."
check_file "frontend/netlify.toml"
check_file "frontend/_redirects"
check_file "frontend/package.json"
check_file "frontend/.env.example"
echo ""

echo "🔧 Vérification des scripts JavaScript..."
check_file "frontend/js/config-api.js"
check_file "frontend/js/dashboard.js"
check_file "frontend/js/agents-management.js"
echo ""

echo "📋 Vérification de la documentation..."
check_file "NETLIFY_DEPLOYMENT_GUIDE.md"
echo ""

echo "═══════════════════════════════════════════════"
echo -e "${GREEN}✅ Vérifications réussies: $passed${NC}"
if [ $failed -gt 0 ]; then
    echo -e "${RED}❌ Vérifications échouées: $failed${NC}"
    exit 1
else
    echo -e "${GREEN}🎉 Structure complète et prête pour le déploiement !${NC}"
    exit 0
fi
