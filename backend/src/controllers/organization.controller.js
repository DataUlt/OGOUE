import { supabase } from "../db/supabase.js";

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
