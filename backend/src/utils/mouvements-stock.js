import { supabase } from "../db/supabase.js";

// ============================================================
// Mouvements de stock et rapports d'inventaire
// ------------------------------------------------------------
// Chaque variation de stock est tracée (stock_movements). Le stock de
// départ d'une période se retrouve en partant du stock actuel et en
// retirant les mouvements postérieurs à la période. Dates en heure du Gabon (UTC+1).
// ============================================================

/** Seuil, en jours de vente, sous lequel un article est à commander. */
const SEUIL_COMMANDE_JOURS = 7;
/** Horizon de réapprovisionnement, en jours de vente. */
const HORIZON_REAPPRO_JOURS = 30;

/** Enregistre une variation de stock. delta > 0 entrée, < 0 sortie ou correction. */
export async function enregistrerMouvement({ organizationId, articleId, delta, motif, saleId = null }) {
  if (!delta) return;
  const { error } = await supabase.from("stock_movements").insert({
    organization_id: organizationId,
    article_id: articleId,
    sale_id: saleId,
    delta,
    motif,
  });
  if (error) console.error("⚠️  Mouvement de stock non enregistré:", error.message);
}

const bornesDebut = (d) => new Date(`${d}T00:00:00+01:00`);
const bornesFin = (d) => new Date(`${d}T23:59:59.999+01:00`);

/** Nombre de jours calendaires d'une période (bornes incluses). */
function joursEntre(debut, fin) {
  // Dates calendaires : on compte les jours, sans passer par les heures
  const jourUtc = (d) => Date.parse(`${d}T00:00:00Z`);
  return Math.round((jourUtc(fin) - jourUtc(debut)) / 86400000) + 1;
}

/**
 * Rapport de stock d'une organisation pour une période.
 * @returns {Promise<{ articles: object[], periode: {debut, fin, jours} }>}
 */
export async function rapportStock(organizationId, debut, fin) {
  const jours = joursEntre(debut, fin);
  const finPeriode = bornesFin(fin);
  const debutPeriode = bornesDebut(debut);

  const { data: articles, error } = await supabase
    .from("articles")
    .select("id, name, unit_price, cost_price, stock")
    .eq("organization_id", organizationId)
    .eq("is_active", true)
    .not("stock", "is", null)
    .order("name", { ascending: true });
  if (error) throw error;

  // Mouvements depuis le début de la période : suffisant pour reconstituer le stock de départ
  const { data: mouvements, error: errMv } = await supabase
    .from("stock_movements")
    .select("article_id, delta, motif, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", debutPeriode.toISOString());
  if (errMv) throw errMv;

  const lignes = (articles || []).map((a) => {
    const mvs = (mouvements || []).filter((m) => m.article_id === a.id);
    const apresFin = mvs.filter((m) => new Date(m.created_at) > finPeriode);
    const dansPeriode = mvs.filter((m) => new Date(m.created_at) <= finPeriode);

    const stockActuel = Number(a.stock);
    const stockFin = stockActuel - apresFin.reduce((s, m) => s + Number(m.delta), 0);
    const variation = dansPeriode.reduce((s, m) => s + Number(m.delta), 0);
    const stockDepart = stockFin - variation;

    const entrees = dansPeriode.filter((m) => Number(m.delta) > 0).reduce((s, m) => s + Number(m.delta), 0);
    const ventes = -dansPeriode.filter((m) => m.motif === "vente").reduce((s, m) => s + Number(m.delta), 0);
    const ventesParJour = ventes / jours;
    const couverture = ventesParJour > 0 ? stockFin / ventesParJour : null;

    let statut;
    if (stockFin <= 0) statut = ventes > 0 ? "Rupture" : "Vide";
    else if (ventes === 0) statut = "Stock dormant";
    else if (couverture < SEUIL_COMMANDE_JOURS) statut = "À commander";
    else statut = "OK";

    const cout = a.cost_price === null || a.cost_price === undefined ? null : Number(a.cost_price);
    const valeur = cout === null ? 0 : stockFin * cout;
    const besoin = ventesParJour * HORIZON_REAPPRO_JOURS;
    const aCommander = Math.max(0, Math.ceil(besoin - Math.max(0, stockFin)));

    return {
      id: a.id,
      name: a.name,
      prixVente: Number(a.unit_price) || 0,
      coutAchat: cout,
      stockDepart,
      entrees,
      ventes,
      stock: stockFin,
      valeur,
      couvertureJours: couverture === null ? null : Math.round(couverture),
      statut,
      besoin30Jours: Math.ceil(besoin),
      aCommander,
      coutEstime: cout === null ? null : aCommander * cout,
    };
  });

  return { articles: lignes, periode: { debut, fin, jours } };
}
