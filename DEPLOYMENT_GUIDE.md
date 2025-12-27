# 📱 Guide de déploiement des corrections en production

## 🎯 Objectif
Déployer les 5 corrections critiques sans interrompre le service en production.

---

## ✅ Étape 1 : Vérifier les changements localement

```bash
# Vérifier que tous les fichiers sont modifiés correctement
git status
```

Les fichiers modifiés doivent être :
- ✅ `backend/src/middleware/auth.middleware.js`
- ✅ `backend/src/controllers/auth.controller.js`
- ✅ `backend/.env`
- ✅ `frontend_marketing/homepage/signin.html`
- ✅ `frontend_marketing/homepage/login.html` (redirection, déjà corrigée)

---

## 🔄 Étape 2 : Déployer le Backend sur Render

### Méthode 1 : Via Git push (Recommandé - Zéro downtime)

```bash
# Depuis le répertoire backend
cd backend

# Commit les changements
git add -A
git commit -m "Fix: Corriger bugs d'authentification en production

- Fix: Table app.users → users dans le middleware
- Fix: .single() → .maybeSingle() pour les SELECT
- Fix: CORS_ORIGIN pour production
- Fix: URLs de redirection pour production"

# Push vers le dépôt distant
git push origin main
```

**Render détectera automatiquement** le push et redéploiera en ~3-5 minutes.

### Méthode 2 : Variables d'environnement sur Render

Bien que le `.env` ait été modifié, **Render utilise ses propres variables d'environnement**. 

**À FAIRE** :
1. Allez sur https://dashboard.render.com
2. Sélectionnez votre service backend
3. Allez dans **Settings** → **Environment**
4. Mettez à jour `CORS_ORIGIN` :
   ```
   CORS_ORIGIN=https://www.ogoue.com,https://app.ogoue.com,https://ogoue.netlify.app
   ```
5. Changez `NODE_ENV` de `development` à `production`
6. Sauvegardez et redéployez

---

## 🌐 Étape 3 : Déployer le Frontend sur Netlify

### Méthode 1 : Via Git push (Recommandé)

```bash
# Depuis le répertoire du projet
git add frontend_marketing/homepage/signin.html
git add frontend_marketing/homepage/login.html

git commit -m "Fix: Corriger les URLs de redirection après authentification

- Fix: Redirection après inscription vers production URL
- Fix: URLs absolues pour les redirects"

git push origin main
```

**Netlify déploiera automatiquement** en ~1-2 minutes.

### Vérification
Netlify affichera un ✅ si tout s'est bien passé dans le dashboard.

---

## 🧪 Étape 4 : Tester en production

### Test 1 : Création de compte

```bash
# 1. Allez sur https://www.ogoue.com/signin.html
# 2. Créez un compte avec :
#    - Email : test@example.com
#    - Mot de passe : Test123456
#    - Entreprise : Test Company
# 3. Observez la création (ne doit pas montrer "Erreur lors de la création de l'organisation")
# 4. Vérifiez la redirection vers https://app.ogoue.com/module_tableau_bord.html
```

### Test 2 : Connexion

```bash
# 1. Allez sur https://www.ogoue.com/login.html
# 2. Connectez-vous avec :
#    - Email : test@example.com
#    - Mot de passe : Test123456
# 3. Vérifiez qu'il ne montre pas "Erreur lors de la récupération du profil utilisateur"
# 4. Vérifiez la redirection vers le dashboard
```

### Test 3 : Vérifier les logs

Sur **Render** :
1. Allez dans **Logs** pour votre service
2. Cherchez des messages d'erreur concernant :
   - "app.users" (ne devrait pas en avoir)
   - "CORS blocked" (ne devrait pas en avoir)
   - "Token invalid" (peut arriver mais normal)

---

## ⚠️ En cas de problème

### Symptôme : "Erreur lors de la création de l'organisation"

**Causes possibles** :
1. CORS bloqué (vérifiez les logs Render)
2. Supabase ne répond pas (vérifiez https://status.supabase.com)
3. Organisation n'a pas été créée (vérifiez Supabase dashboard)

**Solution** :
```bash
# Vérifier la requête via curl
curl -X POST https://api.ogoue.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Test",
    "lastName": "User",
    "email": "test@example.com",
    "password": "Password123",
    "organizationName": "Test Org"
  }'
```

### Symptôme : "Erreur lors de la récupération du profil utilisateur"

**Causes possibles** :
1. `.single()` vs `.maybeSingle()` (vérifiez le code)
2. Utilisateur introuvable (vérifiez Supabase)

**Solution** :
- Vérifier dans Supabase que la table `users` contient bien l'utilisateur créé
- Vérifier les logs du backend pour voir les erreurs exactes

---

## 📊 Checklist de déploiement

- [ ] Code committé et pushé vers le dépôt
- [ ] Backend redéployé sur Render (vérifier le build log)
- [ ] Variables d'environnement mises à jour sur Render
- [ ] Frontend redéployé sur Netlify
- [ ] Test création de compte réussi
- [ ] Test connexion réussi
- [ ] Pas d'erreurs "Erreur lors de la création de l'organisation"
- [ ] Pas d'erreurs "Erreur lors de la récupération du profil utilisateur"
- [ ] Les redirects pointent vers les bonnes URLs

---

## 🔄 Rollback en cas de problème critique

Si quelque chose ne fonctionne pas en production :

### Option 1 : Revert le dernier commit
```bash
git revert HEAD
git push origin main
```

### Option 2 : Redéployer la version précédente sur Render
1. Allez dans **Deployments** sur Render
2. Cliquez sur le déploiement précédent
3. Cliquez sur **Redeploy**

---

## 📝 Notes importantes

- **Zéro downtime** : Les déploiements Git ne causent pas d'interruption
- **Cache** : Netlify peut avoir un cache de 1-2 minutes pour le frontend
- **Supabase** : Vérifiez que les schémas des tables `users` et `organizations` sont corrects
- **Monitoring** : Après le déploiement, attendez 5-10 minutes et vérifiez les logs

---

**Date** : 27 décembre 2025
**Durée estimée du déploiement** : 5-10 minutes
