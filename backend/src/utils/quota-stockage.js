import { supabase } from "../db/supabase.js";

const OCTETS_PAR_GO = 1024 * 1024 * 1024;

/**
 * Octets deja occupes par les justificatifs d'une organisation.
 *
 * S'appuie sur la fonction SQL stockage_utilise : l'addition se fait en
 * base, sans ramener la liste des tailles a chaque televersement.
 *
 * En cas d'echec — fonction absente parce que QUOTA_STOCKAGE.sql n'a pas
 * ete execute, base injoignable — on renvoie null plutot que zero. Le
 * zero serait un mensonge qui laisserait passer n'importe quel fichier ;
 * null laisse l'appelant decider, et il choisit de ne pas bloquer.
 */
export async function stockageUtilise(organizationId) {
  try {
    const { data, error } = await supabase.rpc("stockage_utilise", { org: organizationId });
    if (error) {
      console.error("⚠️  Quota de stockage illisible:", error.message);
      return null;
    }
    return Number(data) || 0;
  } catch (err) {
    console.error("⚠️  stockageUtilise:", err?.message || err);
    return null;
  }
}

/** Formate des octets pour un message lisible : « 1,4 Go », « 320 Mo ». */
export function formaterTaille(octets) {
  if (octets >= OCTETS_PAR_GO) {
    return `${(octets / OCTETS_PAR_GO).toFixed(1).replace(".", ",")} Go`;
  }
  return `${Math.round(octets / (1024 * 1024))} Mo`;
}

/**
 * Le fichier tient-il dans ce qu'il reste ?
 *
 * @param {string} organizationId
 * @param {number} tailleFichier - octets du fichier a deposer
 * @param {number} quotaGo - plafond de la formule, 0 = fonction fermee
 * @returns {Promise<{ok: true} | {ok: false, message: string, utilise: number, quota: number}>}
 */
export async function verifierQuota(organizationId, tailleFichier, quotaGo) {
  if (!quotaGo) return { ok: true }; // fonction deja barree en amont

  const quota = quotaGo * OCTETS_PAR_GO;
  const utilise = await stockageUtilise(organizationId);

  // Compteur indisponible : on laisse passer. Refuser un justificatif a
  // cause d'une panne de mesure penaliserait le client pour un incident
  // qui ne le concerne pas.
  if (utilise === null) return { ok: true };

  if (utilise + tailleFichier > quota) {
    return {
      ok: false,
      utilise,
      quota,
      message:
        `Votre espace de stockage est plein : ${formaterTaille(utilise)} occupés sur ` +
        `${quotaGo} Go. Supprimez des justificatifs ou passez à la formule supérieure. ` +
        `Vos ventes et dépenses continuent de s'enregistrer normalement.`,
    };
  }

  return { ok: true };
}
