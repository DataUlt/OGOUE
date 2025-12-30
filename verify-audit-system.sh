#!/bin/bash
# Script de vérification du système d'audit
# Usage: bash verify-audit-system.sh

echo "═══════════════════════════════════════════════════════════════"
echo "🔍 VÉRIFICATION DU SYSTÈME D'AUDIT DES SUPPRESSIONS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Compteurs
PASSED=0
FAILED=0

# Fonction pour afficher le résultat
check_result() {
    local test_name=$1
    local result=$2
    
    if [ $result -eq 0 ]; then
        echo -e "${GREEN}✅${NC} $test_name"
        ((PASSED++))
    else
        echo -e "${RED}❌${NC} $test_name"
        ((FAILED++))
    fi
}

echo "📁 VÉRIFICATION DES FICHIERS"
echo "──────────────────────────────────────────────────────────────"

# Vérifier les fichiers SQL
if [ -f "DELETION_AUDIT_TABLE.sql" ]; then
    check_result "Migration SQL existe (DELETION_AUDIT_TABLE.sql)" 0
else
    check_result "Migration SQL existe (DELETION_AUDIT_TABLE.sql)" 1
fi

# Vérifier backend/utils
if [ -f "backend/src/utils/deletion-audit.js" ]; then
    check_result "Utilitaire audit backend (deletion-audit.js)" 0
else
    check_result "Utilitaire audit backend (deletion-audit.js)" 1
fi

# Vérifier contrôleur audit
if [ -f "backend/src/controllers/audit.controller.js" ]; then
    check_result "Contrôleur audit (audit.controller.js)" 0
else
    check_result "Contrôleur audit (audit.controller.js)" 1
fi

# Vérifier routes audit
if [ -f "backend/src/routes/audit.routes.js" ]; then
    check_result "Routes audit (audit.routes.js)" 0
else
    check_result "Routes audit (audit.routes.js)" 1
fi

# Vérifier frontend module
if [ -f "frontend_app/js/deletion-audit.js" ]; then
    check_result "Module deletion-audit frontend" 0
else
    check_result "Module deletion-audit frontend" 1
fi

# Vérifier page historique
if [ -f "frontend_app/module_historique_suppressions.html" ]; then
    check_result "Page historique suppressions" 0
else
    check_result "Page historique suppressions" 1
fi

echo ""
echo "📝 VÉRIFICATION DES MODIFICATIONS"
echo "──────────────────────────────────────────────────────────────"

# Vérifier modification expenses.controller.js
if grep -q "logDeletion" backend/src/controllers/expenses.controller.js; then
    check_result "Import logDeletion dans expenses.controller.js" 0
else
    check_result "Import logDeletion dans expenses.controller.js" 1
fi

# Vérifier modification app.js
if grep -q "auditRoutes" backend/src/app.js; then
    check_result "Routes audit enregistrées dans app.js" 0
else
    check_result "Routes audit enregistrées dans app.js" 1
fi

# Vérifier modification depenses.js
if grep -q "DeletionAuditManager" frontend_app/js/depenses.js; then
    check_result "DeletionAuditManager intégré dans depenses.js" 0
else
    check_result "DeletionAuditManager intégré dans depenses.js" 1
fi

echo ""
echo "🌐 VÉRIFICATION DE L'API"
echo "──────────────────────────────────────────────────────────────"

# Vérifier que le backend tourne
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    check_result "Backend API accessible sur :3001" 0
else
    echo -e "${YELLOW}⚠️${NC} Backend API non accessible (ok si pas démarré)"
fi

# Vérifier que le frontend tourne
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    check_result "Frontend accessible sur :3000" 0
else
    echo -e "${YELLOW}⚠️${NC} Frontend non accessible (ok si pas démarré)"
fi

echo ""
echo "📚 VÉRIFICATION DE LA DOCUMENTATION"
echo "──────────────────────────────────────────────────────────────"

docs=(
    "DELETION_AUDIT_TABLE.sql"
    "DELETION_AUDIT_GUIDE.md"
    "INTEGRATION_AUDIT_AUTRES_MODULES.md"
    "PROCEDURES_DEPLOIEMENT_AUDIT.md"
    "CHANGEMENT_AUDIT_SUPPRESSIONS.md"
    "QUICK_START_AUDIT.md"
)

for doc in "${docs[@]}"; do
    if [ -f "$doc" ]; then
        check_result "Documentation: $doc" 0
    else
        check_result "Documentation: $doc" 1
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "📊 RÉSUMÉ"
echo "═══════════════════════════════════════════════════════════════"

TOTAL=$((PASSED + FAILED))
echo ""
echo -e "${GREEN}✅ Vérifications réussies: $PASSED/$TOTAL${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Vérifications échouées: $FAILED/$TOTAL${NC}"
    echo ""
    echo "🔧 À corriger:"
    echo "1. Vérifiez que tous les fichiers sont en place"
    echo "2. Vérifiez les modifications dans app.js et expenses.controller.js"
    echo "3. Relancez le backend: npm start"
fi

if [ $FAILED -eq 0 ]; then
    echo ""
    echo "🎉 TOUT EST PRÊT!"
    echo ""
    echo "Prochaines étapes:"
    echo "1. Exécuter la migration SQL: DELETION_AUDIT_TABLE.sql"
    echo "2. Redémarrer le backend: npm start"
    echo "3. Tester la suppression d'une dépense"
    echo "4. Consulter l'historique: /app/module_historique_suppressions.html"
    echo ""
    echo "📖 Lire QUICK_START_AUDIT.md pour démarrer rapidement"
fi

echo ""
