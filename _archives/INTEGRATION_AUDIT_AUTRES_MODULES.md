// INTÉGRATION DU SYSTÈME D'AUDIT DANS AUTRES MODULES
// Copier-coller ce code dans d'autres modules (ventes, etc.)

// ============================================================
// 1. DANS LE CONTRÔLEUR BACKEND (sales.controller.js par ex.)
// ============================================================

// Au top du fichier, ajouter:
import { logDeletion } from "../utils/deletion-audit.js";

// Modifier la fonction DELETE existante:
export async function deleteSale(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;  // ← NOUVEAU: récupérer motif
    const organizationId = req.user.organizationId;
    const userId = req.user.id;  // ← NOUVEAU: utilisateur qui supprime

    // NOUVEAU: Vérifier que le motif est fourni
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: "Deletion reason is required" });
    }

    // Récupérer l'enregistrement AVANT suppression
    const { data: sale, error: fetchError } = await supabase
      .from("sales")
      .select("*")  // ← Récupérer TOUT pour l'audit
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single();

    if (fetchError || !sale) {
      return res.status(404).json({ error: "Sale not found" });
    }

    // NOUVEAU: Enregistrer dans l'audit
    try {
      await logDeletion({
        organizationId,
        userId,
        recordType: "sale",  // ← Type spécifique
        recordId: id,
        recordData: sale,    // ← Données complètes
        reason: reason.trim()
      });
    } catch (auditError) {
      console.error("❌ Erreur audit:", auditError);
      return res.status(500).json({ error: "Failed to log deletion" });
    }

    // Supprimer l'enregistrement (code existant)
    const { error: deleteError } = await supabase
      .from("sales")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (deleteError) {
      console.error("Erreur deleteSale:", deleteError);
      return res.status(500).json({ error: "Internal server error" });
    }

    return res.json({ message: "Sale deleted successfully" });
  } catch (error) {
    console.error("Erreur deleteSale:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ============================================================
// 2. DANS LE MODULE FRONTEND (ventes.js par ex.)
// ============================================================

// Remplacer la fonction de suppression existante par:

async function deleteSale(saleId) {
  try {
    // Importer le module d'audit
    const { default: DeletionAuditManager } = await import("./deletion-audit.js");

    // Utiliser le système d'audit
    const result = await DeletionAuditManager.deleteWithAudit(
      `${API_BASE_URL}/api/sales/${saleId}`,
      {
        title: "Supprimer cette vente ?",
        message: "Vous êtes sur le point de supprimer cet enregistrement. Veuillez expliquer le motif de cette suppression.",
        recordType: "sale",
        recordId: saleId
      }
    );

    if (result.success) {
      // Rafraîchir les données
      loadSales();
      console.log('✅ Vente supprimée avec succès');
    } else {
      console.error('❌ Erreur suppression:', result.error);
      alert(`Erreur: ${result.error}`);
    }
  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    alert('Erreur lors de la suppression de la vente');
  }
}

// ============================================================
// 3. DANS LE HTML (module_ventes.html par ex.)
// ============================================================

// S'assurer que le bouton de suppression appelle simplement:
// deleteBtn.addEventListener('click', () => {
//   const saleId = deleteBtn.getAttribute('data-id');
//   deleteSale(saleId);  // ← Pas de confirm() ici!
// });

// ============================================================
// 4. MODÈLES DE SUPPRESSION POUR D'AUTRES ENTITÉS
// ============================================================

/*
Pour les agents (agents.controller.js):
  - recordType: "agent"
  - Protéger avec vérification: que c'est un gérant qui supprime
  
Pour les organisations (organization.controller.js):
  - recordType: "organization"
  - ATTENTION: suppression extrême, bien sécuriser!

Pour les utilisateurs (users.controller.js):
  - recordType: "user"
  - Audit très important ici
*/

// ============================================================
// 5. PERSONNALISATION DES MESSAGES
// ============================================================

// Adapter le titre et message selon le type:

const deletionMessages = {
  expense: {
    title: "Supprimer cette dépense ?",
    message: "Vous êtes sur le point de supprimer cet enregistrement de dépense."
  },
  sale: {
    title: "Supprimer cette vente ?",
    message: "Vous êtes sur le point de supprimer cet enregistrement de vente."
  },
  agent: {
    title: "Supprimer cet agent ?",
    message: "Vous êtes sur le point de désactiver cet agent. Cette action sera enregistrée."
  },
  user: {
    title: "Supprimer cet utilisateur ?",
    message: "Attention: Vous êtes sur le point de supprimer un utilisateur. Tous ses enregistrements seront supprimés."
  }
};

// Utilisation:
const messages = deletionMessages[recordType];
const result = await DeletionAuditManager.deleteWithAudit(endpoint, {
  title: messages.title,
  message: messages.message,
  recordType: recordType,
  recordId: id
});

// ============================================================
// 6. GESTION DES ERREURS SPÉCIFIQUES
// ============================================================

if (result.success) {
  // ✅ Succès
  showSuccessNotification("✅ Enregistrement supprimé");
  refreshDataTable();
} else {
  // ❌ Erreur
  if (result.error.includes("reason")) {
    alert("❌ Vous devez fournir un motif de suppression");
  } else if (result.error.includes("403")) {
    alert("❌ Vous n'avez pas la permission de supprimer cet enregistrement");
  } else {
    alert(`❌ Erreur: ${result.error}`);
  }
}

// ============================================================
// 7. AUDIT À CHAQUE SUPPRESSION SENSIBLE
// ============================================================

// ✅ À ajouter audit:
// - Suppression de dépenses
// - Suppression de ventes
// - Suppression d'agents
// - Suppression d'utilisateurs
// - Changements de droits d'accès
// - Remise à zéro de données

// ❌ Ne pas nécessaire:
// - Petits changements non sensibles
// - Suppressions de sessions
// - Suppression de cache

// ============================================================
// 8. VÉRIFICATION CÔTÉ API
// ============================================================

// Dans auth.middleware.js, s'assurer que req.user contient:
req.user = {
  id: "uuid-from-jwt",           // Utilisateur qui agit
  organizationId: "uuid-from-jwt", // Organisation
  role: "manager" ou "agent"      // Pour vérifier permissions
}

// ============================================================
// 9. TEST DE L'INTÉGRATION
// ============================================================

// 1. Supprimez une dépense → vérifiez audit
// 2. Supprimez une vente → vérifiez audit
// 3. Filtrez l'historique par type → doit montrer les 2
// 4. Vérifiez que données sont archivées complètement

// ============================================================
// 10. CHECKLIST D'INTÉGRATION
// ============================================================

/*
Pour chaque nouveau module:

□ Contrôleur backend modifié
□ Import logDeletion ajouté
□ Récupération objet avant suppression
□ Appel logDeletion avec bons paramètres
□ Module frontend mis à jour
□ Import DeletionAuditManager ajouté
□ deleteWithAudit() appelé au lieu de simple delete()
□ Messages personnalisés
□ Tests de suppression
□ Vérification dans historique audit
□ Vérification filtres par type
□ Documentation mise à jour
*/
