# 🚀 Guide de Déploiement - Frontend OGOUE sur Netlify

## 📋 Prérequis

- Compte Netlify actif
- Dépôt GitHub connecté à Netlify
- Domaine www.ogoue.com pointant vers Netlify (DNS configuré)
- Backend Render avec CORS configuré pour www.ogoue.com
- Base de données Supabase opérationnelle

---

## ✅ Étapes de Déploiement

### **1️⃣ Préparer votre dépôt GitHub**

```bash
# Vérifier la structure du projet
ls -la frontend/
# Doit contenir: index.html, app/, js/, css/, etc.

# Committer la nouvelle structure
git add frontend/
git commit -m "chore: reorganize frontend for Netlify deployment"
git push origin main  # ou votre branche principale
```

### **2️⃣ Connecter Netlify à GitHub**

1. **Accédez à [Netlify](https://app.netlify.com)**
2. Cliquez sur **"New site from Git"**
3. Sélectionnez **GitHub** et autorisez Netlify
4. Choisissez votre dépôt `OGOUE`
5. Configurez les paramètres :
   - **Base directory** : `frontend`
   - **Build command** : laissez vide (fichiers statiques)
   - **Publish directory** : `.` (racine du dossier frontend)

```
Base directory: frontend
Build command: (empty)
Publish directory: .
```

6. Cliquez sur **"Deploy site"**

---

### **3️⃣ Configuration des Domaines Netlify**

#### **Sur votre compte Netlify :**

1. Allez dans **Site settings** → **Domain management**
2. Cliquez sur **Add custom domain**
3. Entrez `www.ogoue.com`

#### **Configurer le DNS (Votre registraire de domaine) :**

Pointez votre domaine vers Netlify :
- **Type CNAME** : `www.ogoue.com` → `votre-site-netlify.netlify.app`
- **ou Type A** : Utilisez l'adresse IP Netlify si fournie

Vérifiez avec :
```bash
nslookup www.ogoue.com
# ou
dig www.ogoue.com
```

---

### **4️⃣ Configuration des Variables d'Environnement**

#### **Sur Netlify (optionnel pour le frontend statique) :**

1. Site settings → **Build & deploy** → **Environment**
2. Ajouter les variables (pour les scripts) :

```
VITE_API_BASE_URL=https://api.ogoue.com
REACT_APP_API_BASE_URL=https://api.ogoue.com
```

---

### **5️⃣ Configuration du Backend (CORS)**

Votre **backend Render** doit autoriser les requêtes du frontend.

#### **Dans votre backend Express/Node.js :**

```javascript
const cors = require('cors');

app.use(cors({
  origin: [
    'https://www.ogoue.com',
    'https://ogoue.com',
    'http://localhost:3000',  // pour le développement local
    'http://localhost:8080'   // pour le développement local
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

### **6️⃣ Configuration des Redirects (Netlify)**

Le fichier `frontend/_redirects` est déjà configuré :

```
/app/*  /app/index.html  200
/*      /index.html     200
```

**Cela signifie :**
- Toutes les routes `/app/*` affichent `/app/index.html` (pour le SPA routing)
- Les autres routes qui ne trouvent pas de fichier affichent `index.html`

---

### **7️⃣ Déploiement Automatique**

Une fois configuré, **chaque push** sur GitHub déclenche :
1. Netlify détecte le changement
2. Récupère les fichiers du dossier `frontend/`
3. Déploie sur le domaine www.ogoue.com
4. Accessible immédiatement

```bash
# Pour déclencher un nouveau déploiement
git add .
git commit -m "Update frontend"
git push origin main
```

---

## 🗂️ Structure du Frontend Déployé

Après déploiement, votre site sera organisé ainsi :

```
www.ogoue.com
├── /                          ← Pages marketing (index.html)
│   ├── apropos.html
│   ├── pricing.html
│   ├── contact.html
│   └── ...
│
├── /app                       ← Application web
│   ├── index.html            ← Point d'entrée app
│   ├── login.html
│   ├── dashboard.html
│   ├── module_agents.html
│   ├── module_depenses.html
│   └── ...
│
├── /js                        ← Scripts JavaScript
│   ├── config-api.js         ← Configuration API
│   ├── dashboard.js
│   └── ...
│
└── /css                       ← Feuilles de style
```

---

## 🔗 Points de Terminaison

Après déploiement :

| Route | Contenu | URL |
|-------|---------|-----|
| **Marketing** | Homepage, A propos, etc. | `https://www.ogoue.com/` |
| **App** | Dashboard, Modules | `https://www.ogoue.com/app` |
| **API** | Backend REST | `https://api.ogoue.com` |

---

## 🧪 Tests de Déploiement

```bash
# Test 1: Vérifier que le marketing charge
curl -I https://www.ogoue.com/

# Test 2: Vérifier que l'app charge
curl -I https://www.ogoue.com/app

# Test 3: Vérifier l'API
curl -I https://api.ogoue.com/api/health

# Test 4: Test CORS (depuis le frontend)
# Ouvrir console navigateur et exécuter :
# fetch('https://api.ogoue.com/api/auth/me')
#   .then(r => r.json())
#   .then(d => console.log(d))
```

---

## 🐛 Dépannage

### **Problème : Page blanche au déploiement**
- ✅ Vérifier que `frontend/` contient tous les fichiers HTML
- ✅ Vérifier que les chemins relatifs sont corrects

### **Problème : Erreur CORS**
- ✅ Vérifier la configuration CORS du backend Render
- ✅ S'assurer que `www.ogoue.com` est dans la liste des origines autorisées

### **Problème : App ne charge pas**
- ✅ Vérifier que `frontend/app/index.html` existe
- ✅ Vérifier la redirection dans `_redirects`

### **Problème : Domaine ne pointe pas**
- ✅ Attendre 24-48h pour la propagation DNS
- ✅ Vérifier les enregistrements DNS chez votre registraire
- ✅ Vérifier que Netlify a validé le certificat SSL

---

## 📊 Monitoring

Après déploiement, consultez :

1. **Logs de build** : Netlify → Deploys
2. **Rapports de performance** : Netlify → Analytics
3. **Certificat SSL** : Automatiquement via Netlify (Let's Encrypt)

---

## 🔐 Sécurité

✅ **HTTPS obligatoire** (Netlify)
✅ **Certificate SSL auto-renouvelé** (Netlify)
✅ **Headers de sécurité configurés** (netlify.toml)
✅ **CORS limité** (API seulement depuis www.ogoue.com)

---

## 📞 Prochaines Étapes

- [ ] Configurer les analytics (Google Analytics, etc.)
- [ ] Mettre en place le monitoring d'erreurs (Sentry, etc.)
- [ ] Configurer les backups
- [ ] Tests de charge avec Artillery ou K6
- [ ] Documentation pour l'équipe

---

**✨ Votre frontend est prêt à être déployé sur Netlify ! 🚀**
