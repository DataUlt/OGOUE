import { supabase, supabaseAuth } from "../db/supabase.js";
import { DELAI_SUPPRESSION_JOURS, oublierEtatSuppression } from "../utils/compte-ferme.js";

export async function getOrganization(req, res) {
  try {
    const organizationId = req.user.organizationId;

    console.log("➡️ Fetching organization id:", organizationId);
    const { data: orgData, error } = await supabase
      .from("organizations")
      .select("id, name, rccm_number, nif_number, activity, activity_description, created_at, acquisition_source")
      .eq("id", organizationId)
      .single();

    if (error || !orgData) {
      console.error("Organization error:", error);
      return res.status(404).json({ error: "Organization not found" });
    }

    return res.json({
      id: orgData.id,
      name: orgData.name,
      rccm: orgData.rccm_number,
      nif: orgData.nif_number,
      activity: orgData.activity,
      activityDescription: orgData.activity_description,
      createdAt: orgData.created_at,
      acquisitionSource: orgData.acquisition_source,
    });
  } catch (error) {
    console.error("GetOrganization error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateOrganization(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const { name, activity, activityDescription, rccm, nif } = req.body;

    console.log("➡️ Updating organization id:", organizationId);
    const { data: orgData, error } = await supabase
      .from("organizations")
      .update({
        name: name || undefined,
        activity: activity || undefined,
        activity_description: activityDescription || undefined,
        rccm_number: rccm || undefined,
        nif_number: nif || undefined,
        updated_at: new Date().toISOString(),
      })
      .eq("id", organizationId)
      .select("id, name, rccm_number, nif_number, activity, activity_description, created_at")
      .single();

    if (error || !orgData) {
      console.error("Update organization error:", error);
      return res.status(500).json({ error: "Failed to update organization" });
    }

    return res.json({
      organization: {
        id: orgData.id,
        name: orgData.name,
        rccmNumber: orgData.rccm_number,
        nifNumber: orgData.nif_number,
        activity: orgData.activity,
        activityDescription: orgData.activity_description,
        createdAt: orgData.created_at,
      },
    });
  } catch (error) {
    console.error("UpdateOrganization error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Canal d'acquisition : réponse unique. Une réponse déjà donnée n'est jamais écrasée.
export async function enregistrerCanalAcquisition(req, res) {
  try {
    const organizationId = req.user.organizationId;
    const source = String(req.body?.source || "").trim();
    if (!source || source.length > 120) {
      return res.status(400).json({ error: "Réponse invalide" });
    }

    const { data, error } = await supabase
      .from("organizations")
      .update({ acquisition_source: source })
      .eq("id", organizationId)
      .is("acquisition_source", null)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Canal d'acquisition non enregistré:", error);
      return res.status(500).json({ error: "Enregistrement impossible" });
    }
    if (!data) {
      return res.status(409).json({ error: "Réponse déjà enregistrée" });
    }
    return res.json({ ok: true });
  } catch (error) {
    console.error("enregistrerCanalAcquisition error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/organization/suppression — le gérant supprime son compte.
 *
 * Rien n'est effacé sur le moment : le compte est fermé (plus de connexion,
 * agents compris) et l'effacement est programmé 30 jours plus tard
 * (utils/purge-comptes.js). D'ici là, il se restaure en base
 * (sql/SUPPRESSION_COMPTE.sql).
 * Le mot de passe et le mot SUPPRIMER sont exigés : un clic égaré, ou un
 * téléphone resté ouvert, ne doit pas suffire.
 */
export async function demanderSuppressionCompte(req, res) {
  try {
    const { password, confirmation } = req.body || {};
    if (String(confirmation || "").trim().toUpperCase() !== "SUPPRIMER") {
      return res.status(400).json({ error: "Tapez SUPPRIMER pour confirmer." });
    }
    if (!password || !req.user?.email) {
      return res.status(400).json({ error: "Votre mot de passe est nécessaire pour confirmer." });
    }

    const { error: erreurVerif } = await supabaseAuth.auth.signInWithPassword({
      email: req.user.email,
      password: String(password),
    });
    if (erreurVerif) {
      return res.status(401).json({ error: "Mot de passe incorrect", code: "mot_de_passe" });
    }

    const maintenant = new Date();
    const prevueLe = new Date(maintenant.getTime() + DELAI_SUPPRESSION_JOURS * 24 * 60 * 60 * 1000);
    const { data, error } = await supabase
      .from("organizations")
      .update({
        suppression_demandee_le: maintenant.toISOString(),
        suppression_prevue_le: prevueLe.toISOString(),
      })
      .eq("id", req.user.organizationId)
      .select("id")
      .maybeSingle();

    if (error || !data) {
      // Colonnes absentes tant que sql/SUPPRESSION_COMPTE.sql n'est pas passé
      console.error("Demande de suppression impossible:", error?.message);
      return res.status(500).json({ error: "La suppression n'a pas pu être enregistrée. Réessayez ou contactez OGOUE." });
    }

    oublierEtatSuppression(req.user.organizationId);
    console.log(`🗑️  Suppression demandée pour ${req.user.organizationId}, effacement prévu le ${prevueLe.toISOString()}`);
    return res.json({ ok: true, prevueLe: prevueLe.toISOString() });
  } catch (error) {
    console.error("demanderSuppressionCompte error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
