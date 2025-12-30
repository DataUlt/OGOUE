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
 * @param {string} params.userFirstName - Prénom de l'utilisateur (optional)
 * @param {string} params.userLastName - Nom de l'utilisateur (optional)
 * @returns {Promise<Object>} Résultat de l'insertion
 */
export async function logDeletion({
  organizationId,
  userId,
  recordType,
  recordId,
  recordData,
  reason,
  userFirstName
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
          deleted_user_first_name: userFirstName,
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
    // Query avec LEFT JOIN manuel pour récupérer les infos de l'utilisateur
    const { data, error } = await supabase
      .from("deletion_audit")
      .select(`
        id,
        deleted_record_type,
        deleted_record_id,
        deleted_record_data,
        deletion_reason,
        deleted_at,
        deleted_by_user_id,
        deleted_user_first_name,
        deleted_user_last_name
      `)
      .eq("organization_id", organizationId)
      .order("deleted_at", { ascending: false });

    if (error) {
      console.error("❌ Erreur lors de la récupération de l'historique:", error);
      throw error;
    }

    // Pour chaque suppression, chercher les infos de l'utilisateur si non stockées
    let results = data || [];
    
    const enrichedResults = await Promise.all(
      results.map(async (record) => {
        let userFirstName = record.deleted_user_first_name;
        let userLastName = record.deleted_user_last_name;

        // Si le nom n'est pas stocké, chercher dans users par auth_id
        if (!userFirstName && !userLastName && record.deleted_by_user_id) {
          const { data: userRecord } = await supabase
            .from("users")
            .select("first_name, last_name, email")
            .eq("auth_id", record.deleted_by_user_id)
            .maybeSingle();
          
          if (userRecord) {
            userFirstName = userRecord.first_name;
            userLastName = userRecord.last_name;
          }
        }

        return {
          ...record,
          users: userFirstName || userLastName ? {
            first_name: userFirstName,
            last_name: userLastName,
          } : null
        };
      })
    );

    // Appliquer les filtres
    let filtered = enrichedResults;
    
    if (filters.recordType) {
      filtered = filtered.filter(r => r.deleted_record_type === filters.recordType);
    }

    if (filters.month && filters.year) {
      filtered = filtered.filter(record => {
        const date = new Date(record.deleted_at);
        return (
          date.getMonth() + 1 === filters.month &&
          date.getFullYear() === filters.year
        );
      });
    }

    return filtered;
  } catch (error) {
    console.error("❌ getDeletionHistory erreur:", error);
    throw error;
  }
}
