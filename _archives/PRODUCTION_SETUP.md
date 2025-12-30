# Configuration Dev → Prod pour Render

## ✅ Modifications appliquées

### Frontend (HTML/JS)
Tous les fichiers HTML et JS ont été mis à jour pour utiliser la détection automatique d'environnement:

**DEV (local):**
```
http://localhost:3001
```

**PROD (Render):**
```
https://api.ogoue.com
```

#### Fichiers modifiés:
- ✅ `frontend_marketing/homepage/signin.html`
- ✅ `frontend_marketing/homepage/login.html`
- ✅ `frontend_marketing/homepage/forgot-password.html`
- ✅ `frontend_marketing/homepage/reset-password.html`
- ✅ `frontend_marketing/homepage/agent-login.html`
- ✅ `frontend_app/js/agents-management.js`
- ✅ `frontend_app/js/ventes.js`
- ✅ `frontend_app/js/depenses.js`
- ✅ `frontend_app/js/ogoue-state.js`
- ✅ `frontend_app/js/header-ui.js`

**Logique de détection (même pattern partout):**
```javascript
// Dev/Prod auto-detection
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : 'https://api.ogoue.com';
```

### Backend
- ✅ CORS déjà configuré via `CORS_ORIGIN` env var
- ✅ Ajout de `https://api.ogoue.com` à la liste CORS_ORIGIN dans `.env`

**Configuration CORS_ORIGIN:**
```
CORS_ORIGIN=https://www.ogoue.com,https://app.ogoue.com,https://ogoue.netlify.app,http://localhost:3000,https://api.ogoue.com
```

## 🚀 Workflow de déploiement

1. **Code développé et testé en local** (localhost:3000 → localhost:3001)
2. **Push sur GitHub** (`git push`)
   - Tout le code utilise la détection auto dev/prod
3. **Le code est prêt pour Render** (aucune modification manuelle nécessaire)
4. **Va sur Render Dashboard**
5. **Clique sur "Manual Deploy"**
   - Render déploie automatiquement le code du repo
   - Toutes les API calls pointent vers `https://api.ogoue.com`
   - Frontend sera déployé sur Netlify et pointera vers le backend Render

## 📝 Variables d'env Render à configurer

Dans le dashboard Render, s'assurer que ces variables sont présentes:

```
PORT=3001
NODE_ENV=production
CORS_ORIGIN=https://www.ogoue.com,https://app.ogoue.com,https://ogoue.netlify.app,http://localhost:3000,https://api.ogoue.com
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
```

## ✅ Workflow final

```
Git push → Render reconnaît les changements → Manual Deploy → Code prêt en prod
```

**Plus besoin de modifier les URLs dans le code!** 🎉
