// Lecture paginée des tables Supabase.
//
// PostgREST plafonne le nombre de lignes renvoyées par requête (1000 par
// défaut sur Supabase hébergé). Ce plafond est silencieux : la réponse est
// tronquée sans erreur ni avertissement. Tant que le frontend interrogeait
// l'API mois par mois, le seuil n'était jamais atteint ; depuis qu'une plage
// entière est demandée en une fois, une organisation active le dépasse et les
// lignes au-delà disparaîtraient des totaux.
//
// On lit donc page par page jusqu'à en recevoir une incomplète.

const TAILLE_PAGE = 1000;

/**
 * Exécute une requête Supabase en la paginant jusqu'à épuisement.
 *
 * @param {() => object} construireRequete - Fabrique une NOUVELLE requête à
 *   chaque appel. Un constructeur Supabase n'est pas réutilisable une fois
 *   exécuté : passer un objet déjà construit ferait échouer les pages
 *   suivantes. La requête doit porter un ordre total (voir ci-dessous).
 * @returns {Promise<{ data: Array|null, error: object|null }>}
 *
 * L'ordre doit être déterministe, tiebreaker sur une colonne unique compris.
 * Sans cela deux lignes de même date peuvent changer de place entre deux
 * pages, ce qui en duplique certaines et en omet d'autres.
 */
export async function lireToutesLesLignes(construireRequete) {
  const lignes = [];

  for (let debut = 0; ; debut += TAILLE_PAGE) {
    const { data, error } = await construireRequete().range(debut, debut + TAILLE_PAGE - 1);

    if (error) return { data: null, error };

    const page = data || [];
    lignes.push(...page);

    if (page.length < TAILLE_PAGE) break;
  }

  return { data: lignes, error: null };
}
