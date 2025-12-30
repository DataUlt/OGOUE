# 🚀 Procédure de Déploiement - Système d'Audit des Suppressions

## ⏱️ Durée estimée: 15 minutes

---

## ÉTAPE 1: Exécuter la migration SQL (5 min)

### Pour Supabase (recommandé)
1. Connexion à [supabase.com](https://supabase.com)
2. Sélectionner votre projet
3. Aller à **SQL Editor**
4. Créer une **New Query**
5. Copier le contenu de `DELETION_AUDIT_TABLE.sql`
6. Exécuter (**Cmd+Enter** ou bouton Run)
7. Vérifier pas d'erreurs (message vert ✅)

**Contenu à exécuter:**
```sql
-- Depuis: DELETION_AUDIT_TABLE.sql
-- Copier-coller tout le fichier SQL
```

### Pour PostgreSQL Local
```bash
psql -U postgres -d ogoue_dev -f DELETION_AUDIT_TABLE.sql
```

### Vérification
```sql
-- Vérifier que la table existe
SELECT * FROM app.deletion_audit LIMIT 1;
-- Doit retourner: (0 rows) si nouvelle table
```

---

## ÉTAPE 2: Déployer le Backend (5 min)

### Sur votre machine locale (test d'abord)
```bash
# 1. Aller au dossier backend
cd backend

# 2. Les dépendances sont déjà installées ✅
# (pas besoin de npm install)

# 3. Redémarrer le serveur
npm start
# Doit afficher: ✅ API is running on http://localhost:3001
```

### Sur Render (production)
1. Aller sur [render.com](https://render.com) → Votre dashboard
2. Sélectionner le service backend
3. Aller à **Settings** → **Deploy**
4. Cliquer **Deploy latest commit**
5. Attendre 2-3 minutes
6. Vérifier que le service démarre ✅

**Vérification:**
```bash
curl https://ogoue.onrender.com/health
# Doit retourner: {"ok":true}
```

---

## ÉTAPE 3: Déployer le Frontend (3 min)

### Sur machine locale (test)
```bash
# Les fichiers sont déjà en place ✅
# Rafraîchir la page (F5) pour charger les nouveaux modules
http://localhost:3000/app/module_historique_suppressions.html
```

### Sur Netlify (production)
1. Aller sur [netlify.com](https://netlify.com) → Dashboard
2. Sélectionner le site frontend
3. Aller à **Deploys** → **Trigger deploy** → **Deploy site**
4. Attendre 1-2 minutes
5. Vérifier déploiement OK ✅

---

## ÉTAPE 4: Tester l'intégration (2 min)

### Test 1: Suppression d'une dépense
1. Accéder à http://localhost:3000/app/ (ou votre URL)
2. Aller au module Dépenses
3. Cliquer 🗑️ sur une dépense
4. **Vérifier:** Modal avec "Motif de suppression" s'affiche
5. Entrer un motif (min. 10 caractères)
6. Cliquer "Supprimer"
7. **Vérifier:** Dépense supprimée ✅

### Test 2: Consulter l'historique (gérant)
1. Accéder à http://localhost:3000/app/module_historique_suppressions.html
2. **Vérifier:** La suppression apparaît dans le tableau
3. Cliquer 👁️ sur la ligne
4. **Vérifier:** Modal avec tous les détails (motif, utilisateur, date)

### Test 3: Filtres
1. Sur page historique
2. Sélectionner filtre "Dépenses"
3. Cliquer "Appliquer"
4. **Vérifier:** Seules les dépenses s'affichent

---

## ÉTAPE 5: Vérifier les bases de données

### Supabase
```sql
-- Vérifier table créée
SELECT COUNT(*) FROM app.deletion_audit;
-- Doit afficher: 1 (minimum, après test)

-- Voir la suppression de test
SELECT deleted_record_type, deletion_reason, deleted_at 
FROM app.deletion_audit 
ORDER BY deleted_at DESC LIMIT 1;
```

### RLS Activé?
```sql
-- Vérifier que seuls gérants peuvent voir
SELECT * FROM app.deletion_audit 
WHERE organization_id = 'votre-org-id';
-- (Test avec compte gérant vs agent)
```

---

## ÉTAPE 6: Configurer l'accès

### Accorder accès au module d'historique
```javascript
// Dans votre contrôleur auth/authorization:
// S'assurer que seuls MANAGERS peuvent accéder:
if (req.user.role !== "manager") {
  return res.status(403).json({ error: "Managers only" });
}
```

### Vérifier dans Supabase
```sql
-- Voir les rôles des utilisateurs
SELECT email, role FROM app.users ORDER BY created_at DESC;
```

---

## ÉTAPE 7: Documentation utilisateurs

### Envoyer à l'équipe:

**Pour les AGENTS:**
> Attention! Quand vous supprimez une dépense ou vente, vous devez now donner une raison (minimum 10 mots). Ceci est enregistré pour l'audit et la traçabilité.

**Pour les GÉRANTS:**
> Vous pouvez maintenant consulter l'historique des suppressions: `/app/module_historique_suppressions.html`
> Vous y verrez: qui a supprimé quoi, quand, et pourquoi. Très utile pour auditer les agents!

---

## 🔍 TROUBLESHOOTING

### Problème: "Table doesn't exist"
```
❌ Erreur: relation "deletion_audit" does not exist
```
**Solution:** La migration SQL n'a pas été exécutée. Relancer ÉTAPE 1.

### Problème: "Only managers can view"
```
❌ 403 Forbidden
```
**Solution:** Votre utilisateur n'a pas le rôle `manager`. Vérifier:
```sql
SELECT role FROM app.users WHERE id = 'votre-id';
```

### Problème: Modal ne s'affiche pas
```
❌ ReferenceError: DeletionAuditManager is not defined
```
**Solution:** Vérifier que `deletion-audit.js` existe dans `frontend_app/js/`

### Problème: "Deletion reason is required"
**Solution:** Le backend envoie correctement ce message. L'agent doit entrer un motif dans la modal.

---

## ✅ CHECKLIST DE DÉPLOIEMENT

- [ ] Migration SQL exécutée sur Supabase
- [ ] Backend redémarré/déployé
- [ ] Frontend rafraîchi/déployé
- [ ] Test suppression d'une dépense
- [ ] Test consultation historique
- [ ] Test filtres par type
- [ ] Test avec compte gérant
- [ ] Test avec compte agent (pas accès historique)
- [ ] Vérifier RLS activé
- [ ] Documenter pour l'équipe
- [ ] Ajouter page à la nav du dashboard (optionnel)

---

## 📝 NOTES

- **Pas besoin** de redéployer si vous modifiez seulement le CSS/HTML
- **Besoin de redéployer** si vous modifiez backend (routes, contrôleurs)
- Les données supprimées sont **archivées complètement** avant suppression
- L'historique peut être **consulté mais pas édité** par les gérants
- Les suppressions peuvent être **restaurées manuellement** (optionnel: ajouter feature plus tard)

---

## 🚨 POINTS IMPORTANTS

1. **RLS est activé** → Sécurité: seuls gérants voient historique
2. **Données archivées** → Récupération possible si besoin
3. **Audit complet** → Qui, quand, où, pourquoi, quoi
4. **Motif obligatoire** → Au moins 10 caractères
5. **Compatible** → Fonctionne avec dépenses et ventes (extensible)

---

**🎉 Déploiement réussi!**
