// Crédits clients : lecture et calcul de ce que chaque client doit.
//
//   Dû = ventes à crédit − règlements (avances et paiements)
//
// Les règlements sont imputés aux ventes les plus anciennes d'abord : c'est
// ce qui permet de dire quelle vente reste impayée, donc depuis quand le
// client est en retard. Le même calcul existe côté navigateur
// (ogoue-state.js, resumerCredits) : les deux doivent rester d'accord.

import { supabase } from "../db/supabase.js";
import { lireToutesLesLignes } from "./pagination.js";

// Sans date promise, une vente à crédit est due 30 jours après la vente
export const DELAI_PAR_DEFAUT_JOURS = 30;

// Même client malgré les majuscules, accents ou espaces en trop
export function cleClient(nom) {
  return String(nom || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/\s+/g, " ");
}

export async function lireCreditsOrganisation(organizationId) {
  const lireVentes = (colonnes) => lireToutesLesLignes(() =>
    supabase.from("sales")
      .select(colonnes)
      .eq("organization_id", organizationId)
      .eq("payment_method", "credit")
      .order("sale_date", { ascending: true })
      .order("id", { ascending: true }));
  let ventes = await lireVentes("id, sale_date, description, quantity, amount, client_name, client_phone, credit_echeance, note, created_at");
  // Sans la migration, la colonne credit_echeance manque : on lit sans elle
  if (ventes.error) ventes = await lireVentes("id, sale_date, description, quantity, amount, client_name, client_phone, note, created_at");
  if (ventes.error) return { error: ventes.error };

  const lireReglements = (colonnes) => lireToutesLesLignes(() =>
    supabase.from("credit_reglements")
      .select(colonnes)
      .eq("organization_id", organizationId)
      .order("regle_le", { ascending: true })
      .order("id", { ascending: true }));
  let reglements = await lireReglements("id, client_nom, client_cle, client_telephone, montant, moyen, nature, regle_le, cree_par_nom, sale_id");
  // Colonne sale_id absente tant que la dernière version de la migration n'est pas passée
  if (reglements.error) reglements = await lireReglements("id, client_nom, client_cle, client_telephone, montant, moyen, nature, regle_le, cree_par_nom");
  if (reglements.error) return { error: reglements.error, migration: true };

  return { ventes: ventes.data || [], reglements: reglements.data || [] };
}

// Ce que doit un client donné, à l'instant
export function duPar(cle, ventes, reglements) {
  const vendu = ventes.filter((v) => cleClient(v.client_name) === cle).reduce((s, v) => s + (Number(v.amount) || 0), 0);
  const verse = reglements.filter((r) => r.client_cle === cle).reduce((s, r) => s + (Number(r.montant) || 0), 0);
  return Math.max(0, vendu - verse);
}

/**
 * Un client ne peut pas avoir payé plus que ce qu'il a acheté à crédit. Si
 * une vente a été supprimée ou modifiée après des paiements, le surplus
 * n'est pas de l'argent reçu pour une vente : on ne le compte pas. Les
 * règlements sont pris dans l'ordre des dates, le dernier est rogné.
 */
export function reglementsPlafonnes(ventes, reglements) {
  const vendu = {};
  ventes.forEach((v) => { const k = cleClient(v.client_name); vendu[k] = (vendu[k] || 0) + (Number(v.amount) || 0); });
  const pris = {};
  return [...reglements]
    .sort((a, b) => String(a.regle_le).localeCompare(String(b.regle_le)))
    .map((r) => {
      const k = r.client_cle || cleClient(r.client_nom);
      const montant = Math.min(Number(r.montant) || 0, Math.max(0, (vendu[k] || 0) - (pris[k] || 0)));
      pris[k] = (pris[k] || 0) + montant;
      return { ...r, montant };
    })
    .filter((r) => r.montant > 0);
}

/**
 * Après la suppression ou la modification d'une vente à crédit : retire les
 * paiements de ce client qui dépassent désormais ce qu'il a acheté à crédit.
 * D'abord ceux faits pour cette vente précise (idsPrioritaires), puis les
 * plus récents ; le dernier touché est réduit plutôt que supprimé.
 * Renvoie la somme retirée. Sans la table (migration absente), ne fait rien.
 */
export async function retirerExcedentReglements(organizationId, nomClient, idsPrioritaires = []) {
  const cle = cleClient(nomClient);
  if (!cle) return 0;
  const lu = await lireCreditsOrganisation(organizationId);
  if (lu.error) return 0;
  const vendu = lu.ventes.filter((v) => cleClient(v.client_name) === cle).reduce((s, v) => s + (Number(v.amount) || 0), 0);
  const siens = lu.reglements.filter((r) => (r.client_cle || cleClient(r.client_nom)) === cle);
  let excedent = siens.reduce((s, r) => s + (Number(r.montant) || 0), 0) - vendu;
  if (excedent <= 0) return 0;
  const prioritaire = new Set(idsPrioritaires.map(String));
  const ordre = [...siens].sort((a, b) =>
    (prioritaire.has(String(b.id)) - prioritaire.has(String(a.id))) || String(b.regle_le).localeCompare(String(a.regle_le)));
  let retire = 0;
  for (const r of ordre) {
    if (excedent <= 0) break;
    const montant = Number(r.montant) || 0;
    const requete = montant <= excedent
      ? supabase.from("credit_reglements").delete()
      : supabase.from("credit_reglements").update({ montant: montant - excedent });
    const { error } = await requete.eq("id", r.id).eq("organization_id", organizationId);
    if (error) { console.error("retirerExcedentReglements:", error.message); break; }
    const enleve = Math.min(montant, excedent);
    excedent -= enleve;
    retire += enleve;
  }
  return retire;
}

/**
 * Créances à une date (incluse) : vendu à crédit jusqu'à cette date,
 * moins ce qui a été réglé jusqu'à cette date. Pour l'analyse financière.
 */
export function creancesAu(finJour, ventes, reglements) {
  const finInstant = finJour ? new Date(`${finJour}T23:59:59.999+01:00`).getTime() : Infinity;
  const parClient = {};
  ventes.forEach((v) => {
    if (finJour && v.sale_date > finJour) return;
    const k = cleClient(v.client_name);
    parClient[k] = (parClient[k] || 0) + (Number(v.amount) || 0);
  });
  reglements.forEach((r) => {
    if (new Date(r.regle_le).getTime() > finInstant) return;
    parClient[r.client_cle] = (parClient[r.client_cle] || 0) - (Number(r.montant) || 0);
  });
  return Object.values(parClient).reduce((s, x) => s + Math.max(0, x), 0);
}
