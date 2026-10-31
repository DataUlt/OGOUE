// Qui peut modifier ou supprimer une vente / une dépense.
// Le gérant agit sur toutes les opérations de son entreprise.
// Un agent n'agit que sur celles qu'il a lui-même enregistrées :
// ni celles du gérant, ni celles d'un autre agent. La consultation
// reste ouverte à tous.

export const MESSAGE_PAS_AUTEUR =
  "Vous ne pouvez modifier ou supprimer que les opérations que vous avez vous-même enregistrées.";

// Même identifiant que celui écrit dans created_by à l'enregistrement
export function auteurCourant(user) {
  return user?.userId || user?.sub || user?.id || null;
}

export function peutAgirSur(user, createdBy) {
  if (user?.role !== "agent") return true;
  const moi = auteurCourant(user);
  return !!moi && !!createdBy && String(createdBy) === String(moi);
}

export function refusPasAuteur(res) {
  return res.status(403).json({ error: MESSAGE_PAS_AUTEUR, code: "pas_auteur" });
}
