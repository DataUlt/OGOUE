# 🚀 PROCHAINE ÉTAPE: Intégration Frontend

## STATUS: Backend 100% Opérationnel ✅

Le backend OGOUE est maintenant complètement migrés vers Supabase et tous les endpoints fonctionnent.

---

## 📋 ÉTAPES À FAIRE MAINTENANT

### 1️⃣ Installer Supabase SDK Frontend

Dans le dossier `frontend_app`:

```bash
npm install @supabase/supabase-js
```

### 2️⃣ Créer un fichier de configuration Supabase

Créer `frontend_app/js/supabase-client.js`:

```javascript
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://clujljnyhopxkdchnqdw.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNsdWpsam55aG9weGtkY2hucWR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY1NzE0MjgsImV4cCI6MjA4MjE0NzQyOH0.eenY4kG61qibH_K1Y18X8l8VRjSqc0kqeX1JZmdcK4c'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
```

### 3️⃣ Créer un gestionnaire d'authentification

Créer `frontend_app/js/auth.js`:

```javascript
import { supabase } from './supabase-client.js'

export async function register(email, password, firstName, lastName, organizationName) {
  // Appeler le backend
  const response = await fetch('http://127.0.0.1:3001/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      firstName,
      lastName,
      organizationName
    })
  })
  
  const data = await response.json()
  
  if (response.ok) {
    // Sauvegarder le token
    localStorage.setItem('access_token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    return data
  }
  throw new Error(data.error)
}

export async function login(email, password) {
  const response = await fetch('http://127.0.0.1:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  
  const data = await response.json()
  
  if (response.ok) {
    localStorage.setItem('access_token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    return data
  }
  throw new Error(data.error)
}

export function logout() {
  localStorage.removeItem('access_token')
  localStorage.removeItem('user')
}

export function getToken() {
  return localStorage.getItem('access_token')
}

export function getUser() {
  const user = localStorage.getItem('user')
  return user ? JSON.parse(user) : null
}
```

### 4️⃣ Créer un client API pour le backend

Créer `frontend_app/js/api-client.js`:

```javascript
import { getToken } from './auth.js'

const API_URL = 'http://127.0.0.1:3001'

async function apiRequest(endpoint, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  })
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'API Error')
  }
  
  return response.json()
}

export const api = {
  // Sales
  getSales: (month, year) => 
    apiRequest(`/api/sales?month=${month}&year=${year}`),
  
  createSale: (data) =>
    apiRequest('/api/sales', { method: 'POST', body: JSON.stringify(data) }),
  
  updateSaleReceipt: (id, receiptName) =>
    apiRequest(`/api/sales/${id}/receipt`, { 
      method: 'PUT',
      body: JSON.stringify({ receiptName })
    }),
  
  // Expenses
  getExpenses: (month, year) =>
    apiRequest(`/api/expenses?month=${month}&year=${year}`),
  
  createExpense: (data) =>
    apiRequest('/api/expenses', { method: 'POST', body: JSON.stringify(data) }),
  
  // Summary
  getSummary: (month, year) =>
    apiRequest(`/api/summary?month=${month}&year=${year}`),
  
  // Organization
  getOrganization: () =>
    apiRequest('/api/organization'),
  
  updateOrganization: (data) =>
    apiRequest('/api/organization', { method: 'PUT', body: JSON.stringify(data) })
}
```

### 5️⃣ Mettre à jour le HTML frontend

Exemple dans `login.html`:

```html
<form id="loginForm">
  <input type="email" id="email" placeholder="Email">
  <input type="password" id="password" placeholder="Password">
  <button type="submit">Se connecter</button>
</form>

<script type="module">
  import { login } from './js/auth.js'
  
  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    try {
      const email = document.getElementById('email').value
      const password = document.getElementById('password').value
      
      await login(email, password)
      window.location.href = './module_tableau_bord.html'
    } catch (error) {
      alert('Erreur: ' + error.message)
    }
  })
</script>
```

### 6️⃣ Utiliser l'API dans les modules

Exemple dans `module_ventes.html`:

```javascript
import { api } from './js/api-client.js'
import { getUser } from './js/auth.js'

// Récupérer les ventes du mois courant
const now = new Date()
const month = now.getMonth() + 1
const year = now.getFullYear()

try {
  const data = await api.getSales(month, year)
  console.log('Ventes:', data)
  // Afficher les données...
} catch (error) {
  console.error('Erreur:', error.message)
}
```

---

## 🔗 CONFIGURATION URL BACKEND

### Development
```javascript
const API_URL = 'http://127.0.0.1:3001'
```

### Production (après déploiement)
```javascript
const API_URL = 'https://votre-domaine.railway.app'
```

---

## 🧪 TESTS RECOMMANDÉS

1. **Test Register**: Créer un nouvel utilisateur
2. **Test Login**: Se connecter avec le nouvel utilisateur
3. **Test Sales**: Créer/récupérer des ventes
4. **Test Expenses**: Créer/récupérer des dépenses
5. **Test Summary**: Voir le résumé financier

---

## 📝 NOTES IMPORTANTES

### Headers API
Tous les appels API (sauf login/register) doivent inclure:
```
Authorization: Bearer <access_token>
```

### Gestion des erreurs
```javascript
try {
  const data = await api.getSales(12, 2025)
} catch (error) {
  // error.message contient le message d'erreur du serveur
}
```

### Tokens JWT
- Access token: Valide 1 heure
- Refresh token: À implémenter pour renouveler l'accès

---

## 🚀 DÉPLOIEMENT FUTUR

Une fois que la frontend fonctionne:

1. **Build frontend**:
   ```bash
   npm run build  # si applicable
   ```

2. **Deploy backend** sur Railway:
   ```bash
   git push origin main  # Trigger Railway deployment
   ```

3. **Update frontend URL**:
   ```javascript
   const API_URL = 'https://votre-app.railway.app'
   ```

4. **Deploy frontend** sur Netlify/Vercel/etc.

---

## 📚 RESSOURCES

- Supabase Docs: https://supabase.com/docs
- Supabase JS SDK: https://github.com/supabase/supabase-js
- Railway Docs: https://docs.railway.app

---

## 🆘 SUPPORT

Si tu rencontres des problèmes:

1. Vérifier les logs serveur: `backend/server-error.log`
2. Tester l'endpoint directement: `node test_endpoints_local.mjs`
3. Vérifier les credentials Supabase dans `.env`

**Backend Status**: http://127.0.0.1:3001/health

---

**Bon développement ! 🚀**

