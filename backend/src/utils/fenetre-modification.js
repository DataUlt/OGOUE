// Une vente ou une dépense peut être modifiée pendant 24 h après son enregistrement.
// Ensuite, seule la suppression reste possible. La date de référence est celle
// de la base (created_at), jamais celle du téléphone.
export const FENETRE_MODIFICATION_MS = 24 * 60 * 60 * 1000;

/** Les horodatages sans fuseau sont lus en UTC (comme ailleurs dans le projet). */
function dateUtc(valeur) {
  if (!valeur) return null;
  return new Date(/([zZ]|[+-]\d{2}:?\d{2})$/.test(valeur) ? valeur : valeur + "Z");
}

export function dansFenetreModification(createdAt, maintenant = new Date()) {
  const creation = dateUtc(createdAt);
  if (!creation || Number.isNaN(creation.getTime())) return false;
  return maintenant.getTime() - creation.getTime() <= FENETRE_MODIFICATION_MS;
}

export const MESSAGE_FENETRE_DEPASSEE =
  "La modification n'est possible que pendant 24 heures après l'enregistrement. Vous pouvez encore la supprimer.";
