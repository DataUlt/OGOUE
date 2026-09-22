/**
 * Applique la fenetre de consultation de la formule a une plage demandee.
 *
 * La formule gratuite donne acces aux trois derniers mois. Les operations
 * plus anciennes ne sont ni supprimees ni deplacees : elles cessent
 * simplement d'etre renvoyees, et reapparaissent telles quelles des qu'une
 * formule payante est activee.
 *
 * @param {{startDate?: string, endDate?: string}} plage - dates YYYY-MM-DD
 * @param {number|null} historiqueMois - null = sans limite
 * @returns {{startDate: string|undefined, endDate: string|undefined, tronque: boolean}}
 */
export function appliquerFenetre(plage, historiqueMois) {
  if (!historiqueMois) {
    return { ...plage, tronque: false };
  }

  const plancher = new Date();
  plancher.setMonth(plancher.getMonth() - historiqueMois);
  const plancherISO = plancher.toISOString().slice(0, 10);

  // Aucune plage demandee : on borne au plancher, sinon la formule
  // gratuite recevrait tout l'historique en demandant simplement tout.
  if (!plage.startDate) {
    return { startDate: plancherISO, endDate: plage.endDate, tronque: true };
  }

  if (plage.startDate < plancherISO) {
    return { startDate: plancherISO, endDate: plage.endDate, tronque: true };
  }

  return { ...plage, tronque: false };
}
