/**
 * Controle du role, cote serveur.
 *
 * Jusqu'ici il n'existait que dans le navigateur (`role-guard.js`), qui
 * masque des ecrans. Un agent n'avait donc qu'a appeler l'API
 * directement — avec son propre jeton, parfaitement valide — pour :
 *
 *   POST   /api/agents        creer un agent, et recuperer son code
 *   GET    /api/agents        lire les codes d'acces de ses collegues
 *   DELETE /api/agents/:id    supprimer un agent
 *   PUT    /api/organization  renommer l'entreprise, changer RCCM et NIF
 *
 * Masquer un bouton n'a jamais ferme une porte. Ces quatre routes
 * appartiennent au gerant : c'est lui qui paie, lui qui recrute, lui qui
 * repond de l'entreprise.
 */
export function exigerGerant(req, res, next) {
  if (req.user?.role === "manager") return next();

  // 403 et non 401 : le jeton est valide, c'est le role qui ne suffit
  // pas. Un 401 ferait croire a une session expiree et declencherait une
  // reconnexion inutile.
  return res.status(403).json({
    error: "Cette action est réservée au gérant de l'entreprise.",
    code: "role_insuffisant",
  });
}
