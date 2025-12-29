# 🚀 GUIDE DE DÉPLOIEMENT - OGOUE Backend sur Render

## Prérequis
- Compte Render.com (render.com)
- Compte GitHub (le repo doit être public ou connecté)
- Variables Supabase (URL, clés d'API)
- JWT Secret (généré)

## Étapes de Déploiement

### 1. Préparation du Repo GitHub
```bash
# S'assurer que tout est committed
git status
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

### 2. Créer un Service Web sur Render

#### Via Dashboard Render:
1. Aller sur [render.com](https://render.com)
2. Cliquer sur **"New +"** → **"Web Service"**
3. **Connecter GitHub**: 
   - Cliquer "Connect account"
   - Autoriser Render à accéder à vos repos
4. **Sélectionner le Repository**:
   - Choisir le repo OGOUE
5. **Configurer le Service**:
   - **Name**: `ogoue-api` (ou `ogoue-backend`)
   - **Region**: `Ohio` (us-east) pour moins de latence vers l'Afrique
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

### 3. Configurer les Variables d'Environnement

Dans le Dashboard Render (section "Environment"):

```
PORT=3001
NODE_ENV=production

SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_ANON_KEY=eyJ... (depuis Supabase Settings > API)
SUPABASE_SERVICE_KEY=eyJ... (depuis Supabase Settings > API)

JWT_SECRET=votre_secret_très_long_et_aléatoire_min_32_caractères

CORS_ORIGIN=http://localhost:3000,http://localhost:3001,https://ogoue.onrender.com,https://app.ogoue.com
```

### 4. Déployer

1. Cliquer **"Deploy"** depuis le Dashboard
2. Attendre que le build réussisse (5-10 minutes)
3. Vérifier les logs pour les erreurs
4. Une fois déployé, l'URL sera: `https://ogoue-api.onrender.com`

### 5. Tester le Déploiement

```bash
# Test health check
curl https://ogoue-api.onrender.com/health

# Doit retourner: {"ok":true}
```

### 6. Mettre à Jour la Configuration Frontend

Les fichiers frontend utilisent déjà la logique:
```javascript
const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : 'https://ogoue-api.onrender.com';
```

**Rien à changer!** Le frontend détecte automatiquement.

---

## Fichiers Affectés

### Frontend (Auto-configure)
- `signin.html` - Authentification
- `login.html` - Connexion
- `forgot-password.html` - Récupération de mot de passe
- `reset-password.html` - Réinitialisation
- `agent-login.html` - Login agents

### Backend
- `backend/src/server.js` - Écoute sur `process.env.PORT`
- `backend/src/app.js` - CORS configuré via `process.env.CORS_ORIGIN`
- `.env` (production) - Variables sur Render Dashboard

---

## Variables d'Environnement à Configurer

| Variable | Description | Exemple |
|----------|-----------|---------|
| `PORT` | Port d'écoute | `3001` |
| `NODE_ENV` | Environnement | `production` |
| `SUPABASE_URL` | URL Supabase | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Clé publique Supabase | `eyJhbG...` |
| `SUPABASE_SERVICE_KEY` | Clé service Supabase | `eyJhbG...` |
| `JWT_SECRET` | Secret JWT (32+ chars) | `abc123...xyz` |
| `CORS_ORIGIN` | Origins autorisées | `https://ogoue.onrender.com,...` |

---

## URL Finales après Déploiement

| Service | URL |
|---------|-----|
| **API Backend** | `https://ogoue-api.onrender.com` |
| **Frontend Marketing** | `http://localhost:3000` (local) |
| **API Health** | `https://ogoue-api.onrender.com/health` |
| **Auth Routes** | `https://ogoue-api.onrender.com/api/auth/*` |
| **Protected Routes** | `https://ogoue-api.onrender.com/api/*` (JWT required) |

---

## Dépannage Courant

### ❌ Build Failure
```
Error: Cannot find module 'dotenv'
```
→ S'assurer que `npm install` s'exécute correctement
→ Vérifier `package.json` dans `backend/`

### ❌ CORS Error
```
Access to XMLHttpRequest blocked by CORS policy
```
→ Ajouter l'origine du frontend à `CORS_ORIGIN`
→ Exemple: `CORS_ORIGIN=https://ogoue.onrender.com,http://localhost:3000`

### ❌ 401 Unauthorized
```
JWT token expired or invalid
```
→ Vérifier que `JWT_SECRET` est identique partout
→ Vérifier que le token est envoyé en `Authorization: Bearer <token>`

### ❌ Database Connection Error
```
Connection refused to Supabase
```
→ Vérifier `SUPABASE_URL` et `SUPABASE_SERVICE_KEY`
→ S'assurer que les IPs sont autorisées dans Supabase (généralement public)

---

## Maintenance Post-Déploiement

### Auto-Redéployer à chaque Push
→ Par défaut, Render redéploie à chaque push vers `main`
→ Peut être modifié dans Settings → "Auto-Deploy"

### Logs en Production
```
Dashboard Render → ogoue-api → Logs
```

### Redémarrer le Service
```
Dashboard Render → ogoue-api → Manual Deploy → Redeploy
```

### Mettre à Jour les Secrets
```
Dashboard → Environment → Ajouter/Modifier variables → Redeploy
```

---

## Checklist Final

- [ ] GitHub repo mis à jour avec dernier code
- [ ] Service Render créé avec bon nom
- [ ] Toutes les variables d'environnement configurées
- [ ] Build réussi sans erreurs
- [ ] Health check accessible (`/health` retourne `{"ok":true}`)
- [ ] CORS configuré pour les origins frontend
- [ ] JWT_SECRET sauvegardé en toute sécurité
- [ ] Frontend pointe sur la bonne URL API
- [ ] Tests d'authentification réussis
- [ ] Monitoring des logs activé

---

## Support

En cas de problème:
1. Vérifier les logs Render: Dashboard → Logs
2. Tester l'API directement: `curl https://ogoue-api.onrender.com/health`
3. Vérifier les variables d'environnement sont correctes
4. Redéployer après corrections: Dashboard → Manual Deploy

