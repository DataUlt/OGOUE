import { supabase } from "../db/supabase.js";
import { getDeletionHistory } from "../utils/deletion-audit.js";
import { z } from "zod";

const historyQuerySchema = z.object({
  recordType: z.string().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

/**
 * Récupère l'historique des suppressions pour un gérant
 */
export async function getDeletionHistoryList(req, res) {
  try {
    // Vérifier que c'est un gérant
    if (req.user.role !== "manager") {
      return res.status(403).json({ error: "Only managers can view deletion history" });
    }

    const parsed = historyQuerySchema.parse(req.query);
    const organizationId = req.user.organizationId;

    const history = await getDeletionHistory(organizationId, {
      recordType: parsed.recordType,
      month: parsed.month,
      year: parsed.year,
    });

    // Transformer les données
    const transformed = history.map(record => ({
      id: record.id,
      type: record.deleted_record_type,
      recordId: record.deleted_record_id,
      motif: record.deletion_reason,
      supprimePar: record.deleted_user_first_name ? {
        nom: record.deleted_user_first_name,
      } : (record.users ? {
        nom: `${record.users.first_name} ${record.users.last_name}`,
        email: record.users.email,
      } : null),
      date: record.deleted_at,
      donnees: record.deleted_record_data,
    }));

    return res.json({
      history: transformed,
      total: transformed.length,
    });
  } catch (error) {
    console.error("❌ Erreur getDeletionHistoryList:", error);
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Récupère un seul enregistrement supprimé en détail
 */
export async function getDeletionDetail(req, res) {
  try {
    // Vérifier que c'est un gérant
    if (req.user.role !== "manager") {
      return res.status(403).json({ error: "Only managers can view deletion details" });
    }

    const { id } = req.params;
    const organizationId = req.user.organizationId;

    if (!id) {
      return res.status(400).json({ error: "Deletion ID is required" });
    }

    const { data: record, error } = await supabase
      .from("deletion_audit")
      .select(`
        id,
        deleted_record_type,
        deleted_record_id,
        deleted_record_data,
        deletion_reason,
        deleted_at,
        deleted_by_user_id,
        deleted_user_first_name
      `)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single();

    if (error || !record) {
      return res.status(404).json({ error: "Deletion record not found" });
    }

    // Récupérer les infos de l'utilisateur manuellement si pas stockées
    let userInfo = null;
    if (record.deleted_user_first_name) {
      userInfo = {
        nom: record.deleted_user_first_name
      };
    } else if (record.deleted_by_user_id) {
      const { data: userRecord } = await supabase
        .from("users")
        .select("id, first_name, last_name, email")
        .eq("auth_id", record.deleted_by_user_id)
        .maybeSingle();
      
      userInfo = userRecord ? {
        id: userRecord.id,
        nom: `${userRecord.first_name} ${userRecord.last_name}`,
        email: userRecord.email
      } : null;
    }

    const transformed = {
      id: record.id,
      type: record.deleted_record_type,
      recordId: record.deleted_record_id,
      motif: record.deletion_reason,
      supprimePar: userInfo,
      date: record.deleted_at,
      donnees: record.deleted_record_data,
    };

    return res.json(transformed);
  } catch (error) {
    console.error("❌ Erreur getDeletionDetail:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Récupère des statistiques sur les suppressions
 */
export async function getDeletionStats(req, res) {
  try {
    // Vérifier que c'est un gérant
    if (req.user.role !== "manager") {
      return res.status(403).json({ error: "Only managers can view deletion stats" });
    }

    const organizationId = req.user.organizationId;

    // Total suppressions par type
    const { data: byType } = await supabase
      .from("deletion_audit")
      .select("deleted_record_type")
      .eq("organization_id", organizationId);

    // Suppressions par utilisateur
    const { data: byUser } = await supabase
      .from("deletion_audit")
      .select(`
        deleted_by_user_id,
        users!deleted_by_user_id (
          first_name,
          last_name
        )
      `)
      .eq("organization_id", organizationId);

    // Calculer les stats
    const typeStats = {};
    (byType || []).forEach(record => {
      typeStats[record.deleted_record_type] = 
        (typeStats[record.deleted_record_type] || 0) + 1;
    });

    const userStats = {};
    (byUser || []).forEach(record => {
      const userName = record.users 
        ? `${record.users.first_name} ${record.users.last_name}`
        : "Unknown";
      userStats[userName] = (userStats[userName] || 0) + 1;
    });

    return res.json({
      totalDeletions: (byType || []).length,
      byType: typeStats,
      byUser: userStats,
    });
  } catch (error) {
    console.error("❌ Erreur getDeletionStats:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Supprime un enregistrement d'audit (managers only)
 */
export async function deleteDeletionRecord(req, res) {
  try {
    // Vérifier que c'est un gérant
    if (req.user.role !== "manager") {
      return res.status(403).json({ error: "Only managers can delete audit records" });
    }

    const { id } = req.params;
    const organizationId = req.user.organizationId;

    if (!id) {
      return res.status(400).json({ error: "Deletion ID is required" });
    }

    // Vérifier que le record existe et appartient à l'organisation
    const { data: existing, error: getError } = await supabase
      .from("deletion_audit")
      .select("id")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single();

    if (getError || !existing) {
      return res.status(404).json({ error: "Deletion record not found" });
    }

    // Supprimer le record
    const { error: deleteError } = await supabase
      .from("deletion_audit")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (deleteError) {
      console.error("❌ Erreur lors de la suppression:", deleteError);
      return res.status(500).json({ error: "Failed to delete audit record" });
    }

    return res.json({ 
      message: "Deletion record deleted successfully",
      id: id 
    });
  } catch (error) {
    console.error("❌ Erreur deleteDeletionRecord:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
