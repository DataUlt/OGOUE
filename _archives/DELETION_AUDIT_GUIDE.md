# 📋 Système d'Audit des Suppressions - Documentation

## 🎯 Vue d'ensemble

Un système complet de traçabilité pour les suppressions d'enregistrements (dépenses, ventes) avec justification obligatoire et historique consultable par les gérants.

## 📁 Fichiers créés/modifiés

### Backend
- **`DELETION_AUDIT_TABLE.sql`** - Migration pour créer la table d'audit
- **`backend/src/utils/deletion-audit.js`** - Fonctions utilitaires d'audit
- **`backend/src/controllers/audit.controller.js`** - Contrôleur pour consulter l'historique
- **`backend/src/routes/audit.routes.js`** - Routes API d'audit
- **`backend/src/controllers/expenses.controller.js`** - Modifié pour capturer justification
- **`backend/src/app.js`** - Enregistrement des routes d'audit

### Frontend
- **`frontend_app/js/deletion-audit.js`** - Module de gestion des suppressions avec modal
- **`frontend_app/module_historique_suppressions.html`** - Page d'historique pour gérants

## 🔧 Installation

### 1. Exécuter la migration SQL

Connectez-vous à votre base Supabase et exécutez :
```sql
-- Exécuter le contenu de DELETION_AUDIT_TABLE.sql
```

### 2. Redémarrer le backend
```bash
npm start  # ou npm run dev
```

## 📡 API Endpoints

### 1. Supprimer une dépense avec justification
**DELETE** `/api/expenses/{id}`

```json
{
  "reason": "Dépense erronée, reçu en double"
}
```

**Réponse succès:**
```json
{
  "message": "Expense deleted successfully"
}
```

### 2. Récupérer l'historique des suppressions (gérants uniquement)
**GET** `/api/audit/deletions`

**Query Parameters:**
- `recordType` (optionnel): `expense` ou `sale`
- `month` (optionnel): 1-12
- `year` (optionnel): année

**Réponse:**
```json
{
  "history": [
    {
      "id": "uuid",
      "type": "expense",
      "recordId": "uuid",
      "motif": "Dépense dupliquée",
      "supprimePar": {
        "id": "uuid",
        "nom": "John Doe",
        "email": "john@example.com"
      },
      "date": "2025-12-30T10:30:00Z",
      "donnees": { /* objet original */ }
    }
  ],
  "total": 1
}
```

### 3. Récupérer détails d'une suppression
**GET** `/api/audit/deletions/{id}`

### 4. Récupérer statistiques
**GET** `/api/audit/stats`

**Réponse:**
```json
{
  "totalDeletions": 5,
  "byType": {
    "expense": 3,
    "sale": 2
  },
  "byUser": {
    "John Doe": 3,
    "Jane Smith": 2
  }
}
```

## 🎨 Utilisation au Frontend

### Exemple 1: Suppression simple d'une dépense
```javascript
import DeletionAuditManager from "./deletion-audit.js";

// Bouton de suppression
deleteBtn.addEventListener("click", async () => {
  const result = await DeletionAuditManager.deleteWithAudit(
    `/api/expenses/${expenseId}`,
    {
      title: "Supprimer cette dépense ?",
      message: "Vous êtes sur le point de supprimer cet enregistrement. Cette action est irréversible.",
      recordType: "expense",
      recordId: expenseId
    }
  );

  if (result.success) {
    console.log("✅ Suppression réussie");
    // Rafraîchir la liste
    loadExpenses();
  } else {
    alert(`❌ ${result.error}`);
  }
});
```

### Exemple 2: Utiliser la modal seule
```javascript
DeletionAuditManager.showDeletionModal({
  title: "Supprimer le paiement ?",
  message: "Cette action ne peut pas être annulée",
  onConfirm: async (reason) => {
    console.log("Motif:", reason);
    // Faire appel à l'API
  },
  onCancel: () => {
    console.log("Suppression annulée");
  }
});
```

## 🔍 Page d'historique pour gérants

Accessible via: `/app/module_historique_suppressions.html`

**Fonctionnalités:**
- 📊 Statistiques (total, par type, par utilisateur)
- 🔍 Filtrer par type, mois, année
- 👁️ Voir les détails complets de chaque suppression
- 📋 Afficher les données originales supprimées

## 🛡️ Sécurité

### Row-Level Security (RLS)
- Table `deletion_audit` : seuls les **gérants** (`role = 'manager'`) peuvent voir
- Données complètement isolées par organisation

### Validations
- ✅ Motif obligatoire (minimum 10 caractères)
- ✅ Authentification JWT requise
- ✅ Vérification du rôle pour consultation historique

## 🔐 Données archivées

Chaque suppression sauvegarde:
- ID de l'enregistrement supprimé
- **Toutes les données originales** (JSONB) - récupérable
- Utilisateur qui a supprimé
- Date/heure exacte
- Motif fourni

## 📝 Exemples de motifs
- "Entrée erronée, montant incorrect"
- "Dépense dupliquée, déjà enregistrée le 25/12"
- "Fournisseur non autorisé, contrat annulé"
- "Reçu non reçu après 30 jours"

## 🚀 Prochaines étapes potentielles

1. **Restauration** : Permettre aux gérants de restaurer une suppression
2. **Notifications** : Email aux gérants quand un agent supprime
3. **Approbation** : Exiger approbation du gérant avant suppression
4. **Export** : Exporter l'historique en PDF/Excel
5. **Analytics** : Graphiques sur les patterns de suppression

## ❓ Dépannage

### "Only managers can view deletion history"
→ L'utilisateur n'a pas le rôle `manager`. Vérifier dans la table `users`.

### "Deletion reason is required"
→ Le motif est vide ou moins de 10 caractères. À inclure dans le body: `{ "reason": "..." }`

### Modal ne s'affiche pas
→ Vérifier que `deletion-audit.js` est importé correctement dans la page.

### Pas de suppressions dans l'historique
→ Vérifier que la migration SQL a été exécutée dans Supabase
