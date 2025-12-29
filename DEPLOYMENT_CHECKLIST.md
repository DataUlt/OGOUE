# ✅ CHECKLIST DÉPLOIEMENT OGOUE - RENDER

## Phase 1: Préparation Locale (5 minutes)

- [ ] Backend fonctionne localement: `npm start` (port 3001)
- [ ] Frontend fonctionne localement: `node frontend_server.js` (port 3000)
- [ ] Les appels API vont vers `localhost:3001` en dev
- [ ] Tous les tests locaux passent
- [ ] Git repo à jour: `git status` (propre)
- [ ] `.env` local n'est pas commité (dans `.gitignore`)

## Phase 2: Préparation GitHub (5 minutes)

- [ ] Dernier commit: `git log --oneline | head -1`
- [ ] Branch `main` à jour: `git pull origin main`
- [ ] Tous les fichiers committés: `git status` (propre)
- [ ] Pousser vers GitHub: `git push origin main`

## Phase 3: Création Service Render (10 minutes)

### 3.1 Créer le Service
- [ ] Aller sur [render.com](https://render.com)
- [ ] Cliquer **"New +"** → **"Web Service"**
- [ ] Connecter GitHub account
- [ ] Sélectionner repo `OGOUE`
- [ ] Remplir:
  - **Name**: `ogoue-api`
  - **Region**: `Ohio` (ou plus proche de l'Afrique)
  - **Branch**: `main`
  - **Runtime**: `Node`
  - **Build Command**: `npm install`
  - **Start Command**: `npm start`

### 3.2 Configurer Variables d'Environnement
- [ ] Aller dans "Environment"
- [ ] Ajouter chaque variable (voir tableau ci-dessous)
- [ ] NE PAS cliquer "Deploy" jusqu'à configuration complète

### 3.3 Variables à Configurer

Copier-coller depuis Supabase (Settings → API):

```
PORT=3001
NODE_ENV=production
SUPABASE_URL=https://[PROJECT_ID].supabase.co
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
SUPABASE_SERVICE_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
JWT_SECRET=your_very_long_random_string_min_32_chars_12345678901234567890
CORS_ORIGIN=http://localhost:3000,http://localhost:3001,https://ogoue.onrender.com,https://app.ogoue.com
```

- [ ] `PORT`: `3001`
- [ ] `NODE_ENV`: `production`
- [ ] `SUPABASE_URL`: Depuis Supabase Settings → API → Project URL
- [ ] `SUPABASE_ANON_KEY`: Depuis Supabase Settings → API → Anon Key
- [ ] `SUPABASE_SERVICE_KEY`: Depuis Supabase Settings → API → Service Key
- [ ] `JWT_SECRET`: Généré aléatoirement (min 32 caractères)
- [ ] `CORS_ORIGIN`: Valeur complète avec virgules

## Phase 4: Déploiement (15 minutes)

- [ ] Toutes les variables configurées
- [ ] Cliquer **"Create Web Service"** ou **"Deploy"**
- [ ] Attendre que le build se termine (5-10 minutes)
- [ ] Vérifier les logs pour les erreurs
- [ ] Service accessible via l'URL fournie: `https://ogoue-api.onrender.com`

## Phase 5: Vérification Post-Déploiement (5 minutes)

### Test Health Check
```bash
curl https://ogoue-api.onrender.com/health
# Doit retourner: {"ok":true}
```
- [ ] Health check répond correctement

### Test d'Authentification
- [ ] Aller sur `http://localhost:3000/signin.html`
- [ ] Essayer de créer un compte
- [ ] Vérifier les logs Render pour les requêtes
- [ ] Créer un compte complet et vérifier la réponse

### Vérifier CORS
- [ ] Pas d'erreur CORS dans la console du navigateur
- [ ] Si erreur: recheck `CORS_ORIGIN` en production

### Vérifier les Logs
- [ ] Dashboard Render → ogoue-api → Logs
- [ ] Chercher "CORS" et vérifier que les origins sont acceptées
- [ ] Chercher "API is running" ou messages d'erreur

## Phase 6: Configuration Frontend (Déjà fait ✓)

- [ ] ✓ `signin.html` utilise auto-détection API_BASE_URL
- [ ] ✓ `login.html` utilise auto-détection API_BASE_URL  
- [ ] ✓ `forgot-password.html` utilise auto-détection API_BASE_URL
- [ ] ✓ `reset-password.html` utilise auto-détection API_BASE_URL
- [ ] ✓ `agent-login.html` utilise auto-détection API_BASE_URL

**Frontend détecte automatiquement**:
- Dev (localhost) → `http://localhost:3001`
- Prod (Render) → `https://ogoue-api.onrender.com`

## Phase 7: Tests Finaux (10 minutes)

### Test Complet du Flux
- [ ] Naviguer vers page d'accueil (http://localhost:3000 ou Render URL)
- [ ] Cliquer "Créer un compte"
- [ ] Remplir le formulaire
- [ ] Soumettre (devrait utiliser l'API Render)
- [ ] Vérifier l'enregistrement dans Supabase

### Tester depuis Production (optionnel)
- [ ] Frontend déployé sur Render également
- [ ] Accéder via l'URL du frontend Render
- [ ] Vérifier que tout fonctionne

## 🚀 Succès!

Si toutes les cases sont cochées:
- ✅ Backend déployé sur Render
- ✅ API accessible en production
- ✅ Frontend peut accéder l'API
- ✅ Base de données Supabase connectée
- ✅ Authentification fonctionne

---

## 🔧 Troubleshooting Rapide

| Problème | Solution |
|----------|----------|
| Build fails | Vérifier `package.json` dans `backend/`, relancer build |
| 503 Bad Gateway | Service en démarrage, attendre 1-2 minutes |
| CORS Error | Ajouter origin à `CORS_ORIGIN`, redéployer |
| 401 Auth Error | Vérifier `JWT_SECRET` est correct |
| 500 Server Error | Vérifier logs Render, variables Supabase |
| Variables non utilisées | Redéployer après avoir changé: Dashboard → Manual Deploy |

---

## 📋 Checklist Finale de Sécurité

- [ ] `.env` n'est PAS en git (`.gitignore`)
- [ ] `JWT_SECRET` est long et aléatoire (min 32 chars)
- [ ] `JWT_SECRET` n'est jamais en git (seulement sur Render)
- [ ] `CORS_ORIGIN` limité aux domaines connus
- [ ] Pas de logs sensibles en production
- [ ] Variables sensibles seulement sur Render Dashboard
- [ ] Backup de `JWT_SECRET` sauvegardé de façon sécurisée

---

## 📞 Support

En cas de doute:
1. Consulter `RENDER_DEPLOYMENT_GUIDE.md`
2. Vérifier les logs Render: Dashboard → Logs
3. Tester l'API: `curl https://ogoue-api.onrender.com/health`

