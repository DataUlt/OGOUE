// Compte dont le gerant a demande la suppression.
// Pendant les 30 jours qui precedent l'effacement, le compte est ferme :
// aucune connexion, aucun appel a l'API, ni pour le gerant ni pour ses
// agents. Il peut etre restaure en base pendant ce delai
// (voir sql/SUPPRESSION_COMPTE.sql).

import { supabase } from "../db/supabase.js";

export const DELAI_SUPPRESSION_JOURS = 30;

// L'etat est relu a chaque requete : un cache court evite une lecture de
// plus par appel, et reste assez bref pour qu'une fermeture s'applique vite.
const DUREE_CACHE_MS = 60 * 1000;
const cache = new Map();
let erreurSignalee = false;

/**
 * @returns {Promise<{ferme: boolean, prevueLe: string|null}>}
 * En cas d'erreur de lecture (colonne absente tant que la migration n'est
 * pas passee), le compte est considere ouvert : on ne ferme pas tout le
 * service sur une erreur technique.
 */
export async function etatSuppression(organizationId) {
  if (!organizationId) return { ferme: false, prevueLe: null };
  const enCache = cache.get(organizationId);
  if (enCache && Date.now() - enCache.lu < DUREE_CACHE_MS) return enCache.etat;

  const { data, error } = await supabase
    .from("organizations")
    .select("suppression_prevue_le")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    // Signalé une fois, pas à chaque requête (colonne absente : cas attendu
    // tant que la migration n'est pas passée)
    if (!erreurSignalee) {
      console.error("⚠️  Lecture de l'état de suppression impossible (sql/SUPPRESSION_COMPTE.sql passé ?) :", error.message);
      erreurSignalee = true;
    }
    const etat = { ferme: false, prevueLe: null };
    cache.set(organizationId, { etat, lu: Date.now() });
    return etat;
  }
  const etat = { ferme: !!data?.suppression_prevue_le, prevueLe: data?.suppression_prevue_le || null };
  cache.set(organizationId, { etat, lu: Date.now() });
  return etat;
}

export function oublierEtatSuppression(organizationId) {
  cache.delete(organizationId);
}

export function messageCompteFerme(prevueLe) {
  const date = prevueLe ? new Date(prevueLe).toLocaleDateString("fr-FR", { timeZone: "Africa/Libreville" }) : null;
  return "Ce compte a été supprimé à la demande du gérant"
    + (date ? ` : ses données seront définitivement effacées le ${date}` : "")
    + ". Pour le restaurer d'ici là, contactez OGOUE.";
}

// 401 et non 403 : l'application deconnecte alors la personne et la
// renvoie a l'ecran de connexion, qui affiche ce message.
export function refusCompteFerme(res, prevueLe) {
  return res.status(401).json({ error: messageCompteFerme(prevueLe), code: "compte_ferme" });
}
