# ⚡ Migration Supabase Storage - Instructions

## 🎯 Objectif
Ajouter les colonnes `receipt_url` et `receipt_storage_path` aux tables `expenses` et `sales` pour supporter le vrai upload de fichiers vers Supabase Storage.

## 📋 Quoi faire ?

### Option 1: Utiliser Supabase Dashboard (Recommandé)
1. Ouvrir https://app.supabase.com
2. Sélectionner le projet "ogoue"
3. Aller dans **SQL Editor**
4. Copier le contenu du fichier `ADD_FILE_STORAGE_COLUMNS.sql`
5. Exécuter la requête

### Option 2: Via CLI (Si vous avez Supabase CLI installé)
```bash
supabase db push
```

## 🔍 Comment vérifier que ça marche ?

Après l'ajout des colonnes:

1. **Tester depuis le frontend (localhost:3000)**
   - Créer une dépense ou vente avec un fichier justificatif
   - Le fichier doit être uploadé vers Supabase Storage
   - Vérifier dans le modal qu'il y a un bouton "Consulter" et "Télécharger"

2. **Vérifier les colonnes créées**
   - Aller dans Supabase Dashboard → SQL Editor
   - Exécuter: `SELECT receipt_url, receipt_storage_path FROM expenses LIMIT 1;`

3. **Vérifier le storage**
   - Aller dans Supabase Dashboard → Storage → justificatifs
   - Vous devriez voir les fichiers uploadés organisés par organization ID

## 🚀 Architecture du système

```
Frontend (depenses.js/ventes.js)
    ↓
    │ FormData avec fichier + métadonnées
    ↓
Backend (expenses.controller.js/sales.controller.js)
    ↓ multer middleware
    ↓ supabase-storage.js
    ↓ uploadFileToSupabase()
    ↓
Supabase Storage (bucket: justificatifs)
    ↓ Retourne fileUrl + storagePath
    ↓
PostgreSQL (expenses/sales)
    ↓ Stocke receipt_url + receipt_storage_path
    ↓
API répond avec justificatifUrl
    ↓
Frontend affiche modal avec liens "Consulter" / "Télécharger"
```

## 📝 Colonnes ajoutées

```sql
-- expenses table
receipt_url TEXT NULL              -- URL publique Supabase Storage
receipt_storage_path TEXT NULL     -- Chemin interne du fichier

-- sales table  
receipt_url TEXT NULL
receipt_storage_path TEXT NULL
```

## ⚠️ Notes importantes

1. **Ancien vs Nouveau système:**
   - Ancien: Seul le NOM du fichier était stocké (pas de fichier réel)
   - Nouveau: Le fichier est uploadé + URL stockée pour consultation/téléchargement

2. **Rétrocompatibilité:**
   - Les anciennes entrées sans `receipt_url` afficheront une alerte "⚠️ Fichier non uploadé vers le cloud"
   - Les nouveaux uploads fonctionneront pleinement

3. **Limites de fichiers:**
   - Taille max: 10 MB par fichier
   - Types acceptés: PDF, PNG, JPG, WEBP, DOCX, XLSX, DOC, XLS, TXT
   - Stockage: Illimité (plan Supabase gratuit: 1GB par mois gratuit)

4. **Organisaton-based storage:**
   - Les fichiers sont rangés dans `justificatifs/{organization_id}/{timestamp_randomId}.{ext}`
   - Cela garantit une isolation par organisation

## 🐛 Troubleshooting

**Q: Le bucket n'a pas été créé automatiquement?**
A: Le backend crée le bucket au démarrage. Si pas de création, vérifier les logs backend.

**Q: Les fichiers ne s'uploadent pas?**
A: Vérifier:
   - Que la colonne `receipt_url` existe
   - Que Supabase Storage API fonctionne (vérifier les logs Render)
   - Que le fichier < 10MB
   - Que le type MIME est accepté

**Q: Les URLs Supabase Storage ne sont pas accessibles?**
A: Le bucket `justificatifs` doit être PUBLIC. Vérifier dans Supabase:
   - Storage → justificatifs → Settings → Change visibility to PUBLIC

## ✅ Checklist finale

- [ ] Colonnes ajoutées à la DB (via SQL Editor ou CLI)
- [ ] Backend redémarré (auto-redeploy sur Render)
- [ ] Frontend reloadé (localhost:3000)
- [ ] Test d'upload d'un fichier
- [ ] Vérification que le fichier apparaît dans le storage
- [ ] Vérification que les liens "Consulter" et "Télécharger" fonctionnent

---

**Créé:** Décembre 2025
**Commit:** 647c593 - Implémenter upload Supabase Storage pour les justificatifs
