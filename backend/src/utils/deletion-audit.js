import { supabase } from "../db/supabase.js";

/**
 * Enregistre une suppression dans la table d'audit
 * @param {Object} params
 * @param {string} params.organizationId - ID de l'organisation
 * @param {string} params.userId - ID de l'utilisateur qui supprime
 * @param {string} params.recordType - Type du record (expense, sale, etc.)
 * @param {string} params.recordId - ID du record supprimé
 * @param {Object} params.recordData - Données complètes du record supprimé
 * @param {string} params.reason - Motif de la suppression
 * @returns {Promise<Object>} Résultat de l'insertion
 */
export async function logDeletion({
  organizationId,
  userId,
  recordType,
  recordId,
  recordData,
  reason
}) {
  try {
    if (!organizationId || !userId || !recordType || !recordId || !reason) {
      throw new Error("Missing required parameters for audit log");
    }

    const { data, error } = await supabase
      .from("deletion_audit")
      .insert([
        {
          organization_id: organizationId,
          deleted_record_type: recordType,
          deleted_record_id: recordId,
          deleted_record_data: recordData,
          deleted_by_user_id: userId,
          deletion_reason: reason,
        }
      ])
      .select();

    if (error) {
      console.error("❌ Erreur lors de l'enregistrement de la suppression:", error);
      throw error;
    }

    console.log(`✅ Suppression enregistrée dans l'audit: ${recordType} ${recordId}`);
    return data[0];
  } catch (error) {
    console.error("❌ logDeletion erreur:", error);
    throw error;
  }
}

/**
 * Récupère l'historique des suppressions pour un gérant
 * @param {string} organizationId - ID de l'organisation
 * @param {Object} filters - Filtres optionnels
 * @param {string} filters.recordType - Type de record à filtrer
 * @param {string} filters.month - Mois (1-12)
 * @param {string} filters.year - Année
 * @returns {Promise<Array>} Liste des suppressions
 */
export async function getDeletionHistory(organizationId, filters = {}) {
  try {
    let query = supabase
      .from("deletion_audit")
      .select(`
        id,
        deleted_record_type,
        deleted_record_id,
        deleted_record_data,
        deletion_reason,
        deleted_at,
        deleted_by_user_id,
        users!deleted_by_user_id (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq("organization_id", organizationId)
      .order("deleted_at", { ascending: false });

    // Appliquer les filtres
    if (filters.recordType) {
      query = query.eq("deleted_record_type", filters.recordType);
    }

    const { data, error } = await query;

    if (error) {
      console.error("❌ Erreur lors de la récupération de l'historique:", error);
      throw error;
    }

    // Filtrer par mois/année si spécifiés
    let results = data || [];
    if (filters.month && filters.year) {
      results = results.filter(record => {
        const date = new Date(record.deleted_at);
        return (
          date.getMonth() + 1 === filters.month &&
          date.getFullYear() === filters.year
        );
      });
    }

    return results;
  } catch (error) {
    console.error("❌ getDeletionHistory erreur:", error);
    throw error;
  }
}
