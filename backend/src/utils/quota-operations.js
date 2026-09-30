import { supabase } from "../db/supabase.js";

// Le Gabon vit a UTC+1 toute l'annee, sans heure d'ete. Le mois d'un
// client commence a minuit a Libreville, pas a minuit UTC : sinon une
// vente saisie le 1er entre minuit et une heure compterait pour le mois
// qui vient de se terminer.
const DECALAGE_GABON_MS = 60 * 60 * 1000;

/** Premier instant du mois en cours, heure du Gabon, en ISO UTC. */
export function debutDuMois(maintenant = Date.now()) {
  const local = new Date(maintenant + DECALAGE_GABON_MS);
  const minuitLocal = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1);
  return new Date(minuitLocal - DECALAGE_GABON_MS).toISOString();
}

/**
 * Ventes et depenses creees depuis le debut du mois.
 *
 * On compte les creations, pas ce qui reste en base : une operation
 * supprimee a quand meme ete saisie. Sans cela, saisir, faire ses calculs
 * puis supprimer permettrait de ne jamais atteindre la limite. Les
 * suppressions sont retrouvees dans deletion_audit, qui garde la ligne
 * entiere, date de creation comprise.
 *
 * Renvoie null si l'un des comptages echoue, plutot qu'un chiffre faux.
 */
export async function operationsDuMois(organizationId) {
  const depuis = debutDuMois();

  const compter = (requete) => requete.then(({ count, error }) => {
    if (error) throw error;
    return count || 0;
  });

  try {
    const [ventes, depenses, supprimees] = await Promise.all([
      compter(supabase.from("sales")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", depuis)),
      compter(supabase.from("expenses")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", depuis)),
      // Une operation creee ce mois-ci n'a pu etre supprimee que ce
      // mois-ci : le filtre sur deleted_at reduit la recherche avant de
      // lire la date de creation dans le JSON.
      compter(supabase.from("deletion_audit")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .in("deleted_record_type", ["sale", "expense"])
        .gte("deleted_at", depuis)
        .gte("deleted_record_data->>created_at", depuis)),
    ]);

    return ventes + depenses + supprimees;
  } catch (err) {
    console.error("⚠️  Comptage des opérations impossible:", err?.message || err);
    return null;
  }
}

/**
 * Reste-t-il de la place pour une operation ce mois-ci ?
 *
 * @param {string} organizationId
 * @param {number|null} limite - operationsMois de la formule, null = sans limite
 * @returns {Promise<{ok: true} | {ok: false, message: string, utilisees: number, limite: number}>}
 */
export async function verifierQuotaOperations(organizationId, limite) {
  if (limite === null || limite === undefined) return { ok: true };

  const utilisees = await operationsDuMois(organizationId);

  // Compteur indisponible : on laisse passer, comme pour le stockage.
  // Refuser une vente a cause d'une panne de mesure penaliserait le
  // client pour un incident qui ne le concerne pas.
  if (utilisees === null) return { ok: true };

  // Deux saisies simultanees a la toute derniere place peuvent passer
  // toutes les deux. Une operation de trop, une fois par mois au pire :
  // ca ne justifie pas un verrou en base.
  if (utilisees >= limite) {
    return {
      ok: false,
      utilisees,
      limite,
      message:
        `Vous avez enregistré ${utilisees} opérations ce mois-ci, la limite de votre formule ` +
        `est de ${limite}. Vos données restent consultables ; la saisie reprendra le 1er ` +
        `du mois prochain, ou tout de suite en passant à la formule supérieure.`,
    };
  }

  return { ok: true };
}
