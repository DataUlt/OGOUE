# 🚀 Frontend Local Development Setup

## Architecture Actuelle

```
Frontend (localhost:3000) 
        ↓
Backend (https://ogoue.onrender.com)
        ↓
Database (Supabase)
```

## Démarrage du Frontend Local

### Option 1: Batch Script (Windows)
```bash
start-frontend-local.cmd
```

### Option 2: PowerShell
```powershell
.\start-frontend-local.ps1
```

### Option 3: Node.js Direct
```bash
node frontend_server.js
```

## URLs d'Accès

| Page | URL |
|------|-----|
| 🔐 Login | http://localhost:3000/login.html |
| 📊 Dashboard | http://localhost:3000/app |
| 📈 Ventes | http://localhost:3000/app/module_ventes.html |
| 💰 Dépenses | http://localhost:3000/app/module_depenses.html |
| 📄 États Financiers | http://localhost:3000/app/module_etats_financiers.html |

## Configuration Backend

- **Backend URL**: `https://ogoue.onrender.com`
- **Fichiers de configuration**:
  - `frontend_app/js/ogoue-state.js` (API_BASE_URL)
  - `frontend_app/js/header-ui.js` (MARKETING_BASE)

## Avantages de cette Configuration

✅ **Pas de déploiement Netlify** pendant le debug
✅ **Économise les ressources** (crédits Netlify)
✅ **Tests rapides** en local
✅ **Backend + DB en production** pour des données réelles
✅ **CORS géré** par le serveur local

## Changement d'URL Backend

Si tu dois changer l'URL du backend (ex: pour tester localement):

1. Édite `frontend_app/js/ogoue-state.js`
2. Modifie: `const API_BASE_URL = "https://ogoue.onrender.com";`
3. Redémarre le serveur frontend

## Troubleshooting

**Port 3000 déjà utilisé?**
```bash
# Trouver le processus
netstat -ano | findstr :3000

# Tuer le processus (remplace PID)
taskkill /PID <PID> /F
```

**CORS errors?**
- Vérifie que le backend accepte les requêtes de `http://localhost:3000`
- Le serveur frontend ajoute automatiquement les headers CORS

**Token expiré?**
- Nettoie localStorage: `localStorage.clear()`
- Reconnecte-toi via le login

## Next Steps

Une fois tout configuré et testé localement, redéploie sur Netlify:
```bash
# Build frontend (si nécessaire)
npm run build

# Push vers production
git push
# Netlify auto-déploie
```

---
**Made with ❤️ for OGOUE**
