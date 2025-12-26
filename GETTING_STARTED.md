# 🎉 OGOUÉ App - Guide Complet End-to-End

## 📋 État du Projet

L'application OGOUÉ est **maintenant fonctionnelle end-to-end** avec authentification JWT, interface marketing intégrée, et dashboard avec gestion des ventes/dépenses.

---

## 🚀 Démarrage Rapide

### 1. Lancer le Backend
```bash
cd backend
npm run dev
```
**Résultat attendu :**
```
✅ .env chargé dans pool.js
API: http://localhost:3001
API accessible depuis le navigateur: http://127.0.0.1:3001
```

### 2. Lancer le Serveur Frontend (Marketing)
```bash
# Depuis le dossier racine
node frontend_server.js
```
**Résultat attendu :**
```
Frontend (marketing) server running on http://localhost:3000
Backend API on http://localhost:3001
```

---

## 🔐 Flux d'Authentification Complet

### Étape 1 : Accueil Marketing
Ouvrez : **http://localhost:3000/login.html**

Vous voyez la page de login avec :
- Champ Email
- Champ Mot de passe
- Bouton "Connexion"
- Lien vers "Créer un compte"

### Étape 2 : Créer un Compte (Signup)
1. Cliquez sur **"Créer un compte"** (ou allez sur `http://localhost:3000/signin.html`)
2. Remplissez :
   - Prénom
   - Nom
   - Email
   - Mot de passe
3. Cliquez **"S'inscrire"**

**Backend fait :** 
- Valide les données avec Zod
- Hash le mot de passe avec bcrypt
- Crée l'utilisateur en DB
- Génère un JWT
- Retourne le token

**Frontend fait :**
- Reçoit le token et l'utilisateur
- Sauvegarde dans `localStorage` :
  - `authToken` (JWT)
  - `user` (objet utilisateur avec id, email, firstName, lastName)
- Redirige automatiquement vers **http://localhost:3000/../frontend_app/module_tableau_bord.html**

### Étape 3 : Accès au Dashboard
Vous êtes maintenant sur la page **Tableau de Bord** qui affiche :
- Synthèse KPIs (Chiffre d'affaires, Dépenses, Résultat net)
- Graphiques de tendances
- Filtre par date

Le token JWT est automatiquement envoyé dans tous les appels API avec le header :
```
Authorization: Bearer <votre_jwt>
```

---

## 🎯 Fonctionnalités Implémentées

### ✅ Backend (Node.js + Express + PostgreSQL)
- **Auth Routes** (`/api/auth/`)
  - `POST /register` - Créer un compte
  - `POST /login` - Se connecter
  - `GET /me` - Récupérer mon profil (protégé)
- **Business Routes** (protégées par JWT)
  - `POST /api/sales/add` - Ajouter une vente
  - `POST /api/expenses/add` - Ajouter une dépense
  - `GET /api/summary/monthly` - Résumé mensuel
- **Org Routes**
  - `GET /api/organization/` - Info organisation
  - `PUT /api/organization/` - Modifier organisation

### ✅ Frontend Marketing
- Page **Login** : connexion utilisateur
- Page **Signin** : création de compte
- Validation côté client
- Gestion erreurs (affichage messages)
- Redirect automatique après login

### ✅ Frontend App (Dashboard)
- **Tableau de Bord** : KPIs et graphiques
- **Gestion Comptable** : 
  - Ventes (enregistrement + historique)
  - Dépenses (enregistrement + historique)
  - Résumé (vue synthétique)
- **États Financiers** : rapports financiers
- **Financement** : scoring et dépôt de dossier
- **Suppression de l'orgId hardcodé** : orgId extrait du JWT côté backend
- **Gestion d'erreurs** : 401 Unauthorized → redirection login

### ✅ Topbar Interactive (Header)
Les 3 boutons du header fonctionnent maintenant :

#### 🔔 **Notifications**
- Clic → Liste de notifications s'ouvre
- Badge rouge avec nombre de notifications non lues
- "Aucune notification" si vide
- Fermeture : reclic ou clic ailleurs

#### ⚙️ **Paramètres**
- Clic → Modal "Paramètres"
- Toggle **Thème Sombre/Clair**
- Sauvegarde dans `localStorage` sous `ogo_theme`
- Persiste après rafraîchissement
- Pas de déconnexion ici
- Fermeture : croix ou clic ailleurs

#### 👤 **Profil**
- Clic → Menu profil
- Affiche : Nom/Prénom, Email, Organisation
- Champs éditables : **RCCM** et **NIF**
- Bouton **"Enregistrer"** → sauvegarde dans `localStorage` clé `ogo_org`
- **Bouton "Déconnexion"** (rouge)
  - Efface `authToken` et `user` du localStorage
  - Redirige vers login
- Fermeture : reclic ou clic ailleurs

---

## 💾 Données Persistantes (localStorage)

| Clé | Contenu | Utilisé par |
|-----|---------|------------|
| `authToken` | JWT | Tous les appels API |
| `user` | `{id, email, firstName, lastName, organizationId}` | App UI |
| `ogo_theme` | `"light"` ou `"dark"` | Header UI |
| `ogo_notifications` | `[{id, text, read}]` | Notifications popover |
| `ogo_org` | `{name, rccm, nif}` | Profile modal |

---

## 🧪 Test Complet (Pas à Pas)

### 1. Backend Ready
```bash
npm run dev
# ✅ Vérifiez que le server écoute sur :3001
```

### 2. Créer un Compte
- Allez sur http://localhost:3000/signin.html
- Email: `test@example.com`
- Password: `password123`
- Cliquez **"S'inscrire"**
- ✅ Vous êtes automatiquement redirigé vers le Dashboard

### 3. Tester les Boutons Header
Sur n'importe quelle page du Dashboard :

**Cloche (Notifications) :**
- Clic → popover s'ouvre en bas à droite
- Affiche 2 notifications mock
- Badge "2" en haut à droite du bouton
- Reclic → ferme

**Roue (Paramètres) :**
- Clic → modal "Paramètres"
- Toggle le switch "Thème sombre"
- L'interface passe en mode sombre immédiatement
- Rafraîchissez la page → le thème persiste ✅
- Cliquez la croix → ferme

**Avatar (Profil) :**
- Clic → popover profil
- Affiche "Test Example" (votre nom)
- Affiche votre email
- Champs RCCM / NIF vides (ou avec valeur sauvegardée)
- Modifiez RCCM: "RCCM123"
- Modifiez NIF: "NIF456"
- Clic **"Enregistrer"** → toast "Informations enregistrées"
- Rafraîchissez → les valeurs persistent ✅
- Clic **"Déconnexion"** → redirect vers login

### 4. Vérifier les Appels API
Ouvrez **DevTools** (F12) → **Network** :

À chaque appel API (ex: GET /api/summary/monthly) :
- Header `Authorization: Bearer eyJ...` présent ✅
- Response 200 OK ✅
- Si pas de token → 401 Unauthorized → redirect login ✅

---

## 🔧 Architecture

```
OGOUE_COMBINED/
├── backend/                     # Node.js + Express
│   ├── src/
│   │   ├── app.js              # Express app config
│   │   ├── server.js           # HTTP server
│   │   ├── controllers/        # Business logic
│   │   ├── routes/             # API endpoints
│   │   ├── middleware/         # Auth middleware
│   │   └── db/
│   │       └── pool.js         # PostgreSQL connection
│   ├── .env                    # JWT_SECRET, DATABASE_URL
│   └── package.json
│
├── frontend_marketing/          # HTML/CSS/JS Marketing pages
│   └── homepage/
│       ├── login.html          # Login page (calls /api/auth/login)
│       ├── signin.html         # Signup page (calls /api/auth/register)
│       └── ...
│
├── frontend_app/               # HTML/CSS/JS Dashboard
│   ├── module_tableau_bord.html    # Dashboard home
│   ├── module_ventes.html          # Sales management
│   ├── module_depenses.html        # Expense management
│   ├── module_resume_ventes_depenses.html  # Summary
│   ├── module_etats_financiers.html # Financial reports
│   ├── module_scoring.html         # Financing scoring
│   ├── module_depot_dossier.html   # File submission
│   ├── js/
│   │   ├── ogoue-state.js      # All API calls + token management
│   │   ├── header-ui.js        # Notifications, Settings, Profile popover/modal
│   │   ├── ventes.js           # Sales page logic
│   │   ├── depenses.js         # Expenses page logic
│   │   └── ...
│   └── ...
│
├── frontend_server.js           # Simple HTTP server pour dev (port 3000)
└── start-backend.ps1           # PowerShell script to start backend
```

---

## 🔑 Concepts Clés

### JWT Authentication
- Backend génère JWT avec `organizationId` et `userId` en payload
- Frontend stocke JWT dans localStorage
- Chaque requête API inclut `Authorization: Bearer <token>`
- Si token expiré ou invalide → 401 → redirect login

### Responsive Design
- Tailwind CSS pour tous les styles
- Mode sombre/clair toggle dans settings
- Sauvegarde de préférences utilisateur

### LocalStorage as Minimal DB (Dev Mode)
- Pour dev/demo, on utilise localStorage pour notifications, org info, préférences
- Production : utiliserait Redis ou DB backend

---

## 📱 Pages Disponibles

### Marketing (Frontend 1)
- `/login.html` - Login
- `/signin.html` - Signup
- `/apropos.html` - À propos
- `/accueil.html` - Accueil

### App (Frontend 2)
- `/module_tableau_bord.html` - Dashboard
- `/module_ventes.html` - Sales
- `/module_depenses.html` - Expenses
- `/module_resume_ventes_depenses.html` - Summary
- `/module_etats_financiers.html` - Financial reports
- `/module_scoring.html` - Scoring
- `/module_depot_dossier.html` - File submission

---

## ✨ Prochaines Étapes (Optionnel)

- [ ] Connecter à une vraie BD PostgreSQL complète
- [ ] Ajouter persistance pour organisations
- [ ] Implémentation du scoring réelle
- [ ] Upload fichiers justificatifs
- [ ] Email notifications
- [ ] Export CSV/PDF
- [ ] 2FA / MFA
- [ ] Rate limiting + security headers

---

## 🐛 Troubleshooting

### "Port 3001 already in use"
```bash
taskkill /F /IM node.exe   # Windows
# ou
lsof -ti:3001 | xargs kill -9  # Mac/Linux
```

### "Cannot find module..."
```bash
cd backend && npm install
```

### "Database connection error"
Vérifiez `.env` :
```
DATABASE_URL=postgres://user:password@localhost:5432/ogoue
JWT_SECRET=your_secret_key_here
```

### Tokens pas persistés
Vérifiez que localStorage n'est pas désactivé (mode privé du navigateur).

---

## 📞 Support

Pour toute question :
1. Vérifiez que backend + frontend servers tournent
2. Ouvrez DevTools (F12) → Console pour les erreurs
3. Vérifiez localStorage (F12 → Application → localStorage)
4. Vérifiez Network tab pour les appels API

---

**🎉 L'app est prête à être utilisée en développement !**
