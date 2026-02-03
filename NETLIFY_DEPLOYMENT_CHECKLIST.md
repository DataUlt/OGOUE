# ✅ Checklist de Déploiement OGOUE sur Netlify

## 🎯 Avant le Déploiement

- [ ] Vérifier que la structure `/frontend` est correcte
  ```bash
  # Windows PowerShell
  .\verify-frontend-structure.ps1
  
  # ou Linux/Mac
  bash verify-frontend-structure.sh
  ```

- [ ] Tous les fichiers sont committés dans Git
  ```bash
  git status  # Doit être propre
  ```

- [ ] Backend Render avec CORS configuré pour www.ogoue.com
  ```javascript
  // Dans votre backend
  app.use(cors({
    origin: ['https://www.ogoue.com', 'https://ogoue.com'],
    credentials: true
  }));
  ```

---

## 🚀 Déploiement sur Netlify

### **Étape 1 : Push sur GitHub**

```bash
git add .
git commit -m "Deploy: Frontend reorganized for Netlify"
git push origin main
```

### **Étape 2 : Création du Site sur Netlify**

1. Accédez à https://app.netlify.com
2. Cliquez sur **"Add new site"** → **"Import an existing project"**
3. Autorisez Netlify à accéder à GitHub
4. Sélectionnez votre dépôt GitHub (`OGOUE` ou similaire)
5. Configurez comme suit :

| Paramètre | Valeur |
|-----------|--------|
| **Base directory** | `frontend` |
| **Build command** | (laisser vide) |
| **Publish directory** | `.` |
| **Environment variables** | Optionnel (voir plus bas) |

6. Cliquez sur **"Deploy site"**

**➡️ Résultat : Netlify génère une URL temporaire (ex: `https://xxxxx.netlify.app`)**

### **Étape 3 : Configuration du Domaine**

#### **Sur Netlify :**

1. Dans votre site Netlify, allez à **Site settings** → **Domain management**
2. Cliquez sur **Add custom domain**
3. Entrez `www.ogoue.com`
4. **Netlify vous donne les serveurs de noms DNS à utiliser**

#### **Chez votre registraire de domaine** (ex: OVH, Namecheap, GoDaddy) :

1. Allez à vos paramètres DNS
2. Ajouter un enregistrement **CNAME** :
   - Nom : `www`
   - Cible : `votre-site-netlify.netlify.app`
3. **OU** si vous utilisez les nameservers Netlify, mettez à jour vers les serveurs de noms Netlify

**⏱️ Attendre 24-48h pour la propagation DNS**

### **Étape 4 : Vérifier le Certificat SSL**

1. Retournez sur Netlify
2. Allez à **Domains** → `www.ogoue.com`
3. Vous devriez voir un certificat SSL automatique

---

## 🧪 Tests de Déploiement

```bash
# Test 1 : Site web accessible ?
curl -I https://www.ogoue.com

# Test 2 : Application accessible ?
curl -I https://www.ogoue.com/app

# Test 3 : Page 404 redirige vers index ?
curl -I https://www.ogoue.com/nonexistent

# Test 4 : Fichiers statiques chargent ?
curl -I https://www.ogoue.com/js/config-api.js
```

### **Depuis votre navigateur :**

```javascript
// Ouvrir la console (F12) et exécuter :

// Test 1: Vérifier la config API
console.log(CONFIG.API_BASE_URL);

// Test 2: Tester l'API
fetch('https://api.ogoue.com/api/health')
  .then(r => r.json())
  .then(d => console.log('✅ API fonctionnelle', d))
  .catch(e => console.error('❌ Erreur API', e));

// Test 3: Vérifier le CORS
fetch('https://api.ogoue.com/api/auth/me', {
  headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
})
  .then(r => r.json())
  .then(d => console.log('✅ Authentification OK', d))
  .catch(e => console.error('❌ Erreur Auth', e));
```

---

## 📊 Après Déploiement

### **Monitoring**

- [ ] Ajouter Google Analytics (optionnel)
- [ ] Configurer des alertes d'erreurs (Sentry, etc.)
- [ ] Vérifier les logs Netlify → **Deploys**

### **Performance**

- [ ] Vérifier les scores Lighthouse
  - Allez sur Netlify → **Analytics** → Lighthouse
- [ ] Optimiser les images si nécessaire
- [ ] Minifier le CSS/JS si souhaité

### **Documentation**

- [ ] Mettre à jour README.md avec les instructions de déploiement
- [ ] Communiquer les URLs aux stakeholders :
  - 🌐 **Site web** : https://www.ogoue.com
  - 📱 **Application** : https://www.ogoue.com/app
  - 🔌 **API** : https://api.ogoue.com

---

## 🔄 Déploiements Futurs

Une fois le système en place, **chaque push sur la branche `main`** déclenche automatiquement un redéploiement :

```bash
git add .
git commit -m "Update: feature/description"
git push origin main
# ➡️ Netlify redéploie automatiquement
```

Pour vérifier l'état du déploiement :
- Allez sur Netlify → **Deploys** → Consultez la liste des déploiements

---

## ⚠️ Dépannage

| Problème | Solution |
|----------|----------|
| **Page blanche** | Vérifier que `frontend/` a tous les fichiers HTML |
| **CSS/JS ne charge pas** | Vérifier les chemins relatifs, pas de `/` absolu |
| **Erreur CORS** | Vérifier la config CORS du backend Render |
| **Domaine ne résout pas** | Attendre la propagation DNS ou vérifier le registraire |
| **Déploiement échoue** | Vérifier les logs Netlify pour l'erreur spécifique |

---

## 🎉 Félicitations !

Votre application OGOUE est maintenant :
- ✅ **Déployée sur Netlify**
- ✅ **Accessible via www.ogoue.com**
- ✅ **Avec SSL/HTTPS automatique**
- ✅ **Avec déploiements automatiques à chaque push Git**
- ✅ **Avec la structure marketing + application unifiée**

---

## 📞 Support

Pour toute question :
- Documentation Netlify : https://docs.netlify.com
- Guide complet : Voir `NETLIFY_DEPLOYMENT_GUIDE.md`
- Backend : Render (https://render.com)
- Base de données : Supabase (https://supabase.com)
