import { z } from "zod";
import { supabase } from "../db/supabase.js";
import { cleClient, duPar, lireCreditsOrganisation } from "../utils/credits.js";

const MESSAGE_MIGRATION = "Le suivi des crédits n'est pas encore activé (sql/CREDITS_CLIENTS.sql).";

const reglementSchema = z.object({
  // Paiement pour une vente précise (bouton « Payer » du tableau des ventes) : le client vient de la vente
  venteId: z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.string().uuid().nullable()).optional(),
  clientNom: z.string().trim().max(150).optional().nullable(),
  clientTelephone: z.string().trim().max(50).optional().nullable(),
  montant: z.coerce.number().positive(),
  moyen: z.enum(["cash", "mobile_money"]),
  nature: z.enum(["avance", "paiement"]).default("paiement"),
});

// Prénom (agent) ou prénom et nom (gérant) de la personne connectée
async function nomDeLaPersonne(req) {
  if (req.user?.role === "agent" && req.user.agentId) {
    const { data } = await supabase.from("agents").select("first_name").eq("id", req.user.agentId).maybeSingle();
    return data?.first_name || "Agent";
  }
  if (req.user?.userId) {
    const { data } = await supabase.from("users").select("first_name, last_name").eq("id", req.user.userId).maybeSingle();
    if (data) return [data.first_name, data.last_name].filter(Boolean).join(" ");
  }
  return "Gérant";
}

/**
 * GET /api/credits — ventes à crédit et règlements de l'entreprise, toutes
 * dates : une dette ne s'arrête pas à la fin du mois. Le regroupement par
 * client, les retards et les échéances se calculent dans le navigateur
 * (ogoue-state.js, resumerCredits) à partir de ces deux listes.
 */
export async function getCredits(req, res) {
  try {
    const lu = await lireCreditsOrganisation(req.user.organizationId);
    if (lu.error) {
      console.error("getCredits:", lu.error.message);
      return res.status(503).json({ error: MESSAGE_MIGRATION, code: "migration_credits" });
    }
    return res.json({
      ventes: lu.ventes.map((v) => ({
        id: v.id,
        date: v.sale_date,
        description: v.description,
        quantite: v.quantity,
        montant: Number(v.amount) || 0,
        client_nom: v.client_name || "",
        client_telephone: v.client_phone || "",
        echeance: v.credit_echeance,
        note: v.note,
        created_at: v.created_at,
      })),
      reglements: lu.reglements.map((r) => ({
        id: r.id,
        client_nom: r.client_nom,
        client_cle: r.client_cle,
        client_telephone: r.client_telephone,
        montant: Number(r.montant) || 0,
        moyen: r.moyen,
        nature: r.nature,
        regle_le: r.regle_le,
        par: r.cree_par_nom,
        sale_id: r.sale_id || null,
      })),
    });
  } catch (error) {
    console.error("Erreur getCredits:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/credits/reglements — le client verse de l'argent : avance au
 * moment de la vente, ou paiement plus tard. Tout ou partie de ce qu'il
 * doit, jamais plus. Ouvert au gérant et aux agents : encaisser une dette
 * n'est pas modifier une vente. La personne qui l'a noté est gardée.
 */
export async function enregistrerReglement(req, res) {
  try {
    const data = reglementSchema.parse(req.body);
    const organizationId = req.user.organizationId;

    const lu = await lireCreditsOrganisation(organizationId);
    if (lu.error) return res.status(503).json({ error: MESSAGE_MIGRATION, code: "migration_credits" });

    // Paiement d'une vente précise : le client et le téléphone viennent de la vente
    if (data.venteId) {
      const vente = lu.ventes.find((v) => v.id === data.venteId);
      if (!vente) return res.status(404).json({ error: "Cette vente n'est pas une vente à crédit de votre entreprise." });
      data.clientNom = vente.client_name;
      data.clientTelephone = data.clientTelephone || vente.client_phone || null;
    }
    if (!String(data.clientNom || "").trim()) return res.status(400).json({ error: "Indiquez le client." });
    const cle = cleClient(data.clientNom);
    const du = duPar(cle, lu.ventes, lu.reglements);
    if (du <= 0) return res.status(409).json({ error: "Ce client ne doit rien." });
    if (data.montant > du + 0.001) {
      return res.status(400).json({ error: `Ce client ne doit que ${Math.round(du).toLocaleString("fr-FR")} FCFA.`, du });
    }

    const ligneReglement = {
      organization_id: organizationId,
      client_nom: data.clientNom,
      client_cle: cle,
      client_telephone: data.clientTelephone || null,
      montant: data.montant,
      moyen: data.moyen,
      nature: data.nature,
      cree_par: req.user.userId || req.user.sub || null,
      cree_par_nom: await nomDeLaPersonne(req),
      ...(data.venteId ? { sale_id: data.venteId } : {}),
    };
    let { data: ligne, error } = await supabase.from("credit_reglements").insert(ligneReglement).select("id, montant, regle_le").single();
    // Colonne sale_id absente (migration à relancer) : le paiement passe, imputé aux ventes les plus anciennes
    if (error && ligneReglement.sale_id && /sale_id/.test(error.message || "")) {
      delete ligneReglement.sale_id;
      ({ data: ligne, error } = await supabase.from("credit_reglements").insert(ligneReglement).select("id, montant, regle_le").single());
    }
    if (error) {
      console.error("enregistrerReglement:", error.message);
      return res.status(500).json({ error: "Paiement non enregistré. Réessayez." });
    }
    return res.status(201).json({ ok: true, reglement: ligne, reste: Math.max(0, du - data.montant) });
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Indiquez le client, un montant supérieur à 0 et Cash ou Mobile Money." });
    }
    console.error("Erreur enregistrerReglement:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** DELETE /api/credits/reglements/:id — annuler un règlement saisi par erreur */
export async function annulerReglement(req, res) {
  try {
    const { data, error } = await supabase
      .from("credit_reglements")
      .delete()
      .eq("id", req.params.id)
      .eq("organization_id", req.user.organizationId)
      .select("id")
      .maybeSingle();
    if (error) return res.status(503).json({ error: MESSAGE_MIGRATION, code: "migration_credits" });
    if (!data) return res.status(404).json({ error: "Règlement introuvable" });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Erreur annulerReglement:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
