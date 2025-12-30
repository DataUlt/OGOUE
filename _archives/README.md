# 📦 Dossier Archive (_archives)

Ce dossier contient les fichiers et documentation obsolètes qui ont été archivés lors du passage à la nouvelle architecture Netlify.

## 📋 Contenu

- **Documentation d'audit** : Guides sur le système d'audit Supabase (déjà implémenté)
- **Fichiers SQL** : Migrations et scripts de configuration (déjà appliqués)
- **Guides frontend anciens** : Documentation du système de développement local (remplacé par Netlify)
- **Fichiers de statut** : Rapports d'avancement et checklists des étapes précédentes

## ⚠️ À Noter

Ces fichiers ne sont **pas supprimés du Git** car ils constituent l'historique du projet.

Pour nettoyer complètement le dépôt Git, vous pouvez :

```bash
# Voir l'historique de ce dossier
git log --oneline -- _archives/

# Supprimer complètement du Git (attention : destructif)
git filter-repo --path _archives --invert-paths
```

## 🗂️ Structure

```
_archives/
├── SQL/                    (migrations et configurations)
├── Documentation_Audit/    (guides système d'audit)
├── Guides_Frontend_Anciens/ (dev local obsolète)
└── Fichiers_Statut/       (rapports avancement)
```

## 📌 Référence

Si vous avez besoin de consulter comment le système d'audit était documenté ou comment les migrations Supabase étaient structurées, consultez ce dossier.

---

**Created: 2025-12-30**
