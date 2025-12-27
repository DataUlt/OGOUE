#!/bin/bash
# 🔍 Script de vérification des corrections

echo "🔍 Vérification des corrections appliquées..."
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
PASSED=0
FAILED=0

# Fonction pour vérifier la présence d'une chaîne dans un fichier
check_file_contains() {
    local file=$1
    local string=$2
    local description=$3
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}✗${NC} Fichier non trouvé: $file"
        ((FAILED++))
        return 1
    fi
    
    if grep -q "$string" "$file"; then
        echo -e "${GREEN}✓${NC} $description"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        ((FAILED++))
        return 1
    fi
}

# Fonction pour vérifier l'ABSENCE d'une chaîne dans un fichier
check_file_not_contains() {
    local file=$1
    local string=$2
    local description=$3
    
    if [ ! -f "$file" ]; then
        echo -e "${RED}✗${NC} Fichier non trouvé: $file"
        ((FAILED++))
        return 1
    fi
    
    if ! grep -q "$string" "$file"; then
        echo -e "${GREEN}✓${NC} $description"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} $description"
        ((FAILED++))
        return 1
    fi
}

echo "📋 Correction 1: Table 'users' au lieu de 'app.users'"
check_file_contains "backend/src/middleware/auth.middleware.js" '\.from("users")' \
    "authMiddleware utilise la table 'users'"
check_file_not_contains "backend/src/middleware/auth.middleware.js" '\.from("app\.users")' \
    "authMiddleware n'utilise plus 'app.users'"
echo ""

echo "📋 Correction 2: .maybeSingle() dans getMe()"
check_file_contains "backend/src/controllers/auth.controller.js" "\.maybeSingle\(\)" \
    "getMe() utilise .maybeSingle()"
echo ""

echo "📋 Correction 3: .maybeSingle() dans authMiddlewareOptional()"
check_file_contains "backend/src/middleware/auth.middleware.js" "authMiddlewareOptional" \
    "authMiddlewareOptional existe"
check_file_not_contains "backend/src/middleware/auth.middleware.js" 'app\.users.*single\(\)' \
    "app.users n'est plus utilisé avec .single()"
echo ""

echo "📋 Correction 4: URL de redirection correcte après inscription"
check_file_contains "frontend_marketing/homepage/signin.html" "https://app.ogoue.com/module_tableau_bord.html" \
    "signin.html redirige vers app.ogoue.com"
check_file_not_contains "frontend_marketing/homepage/signin.html" "127.0.0.1:5500" \
    "signin.html n'utilise plus localhost"
echo ""

echo "📋 Correction 5: Configuration CORS pour production"
check_file_contains "backend/.env" "NODE_ENV=production" \
    ".env configure NODE_ENV=production"
check_file_contains "backend/.env" "CORS_ORIGIN=https://www.ogoue.com" \
    ".env inclut www.ogoue.com dans CORS_ORIGIN"
check_file_contains "backend/.env" "CORS_ORIGIN=https://app.ogoue.com" \
    ".env inclut app.ogoue.com dans CORS_ORIGIN"
check_file_not_contains "backend/.env" "CORS_ORIGIN=http://127.0.0.1" \
    ".env n'utilise plus localhost pour CORS"
echo ""

# Résumé
echo "════════════════════════════════════════════════════════════"
echo "📊 RÉSUMÉ DE VÉRIFICATION"
echo "════════════════════════════════════════════════════════════"
echo -e "✓ Réussi : ${GREEN}$PASSED${NC}"
echo -e "✗ Échoué  : ${RED}$FAILED${NC}"
echo "════════════════════════════════════════════════════════════"

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ Toutes les corrections ont été appliquées avec succès !${NC}"
    exit 0
else
    echo -e "${RED}✗ Certaines corrections n'ont pas été trouvées.${NC}"
    exit 1
fi
