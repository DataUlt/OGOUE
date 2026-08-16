// js/role-guard.js
// ============================================================
// RESTRICTION D'ACCES PAR ROLE
// ============================================================
// Un agent ne doit avoir acces qu'aux pages de comptabilite agent.
// Ce script doit etre charge dans le <head>, avant le rendu du body,
// pour eviter que la page manager s'affiche brievement avant la
// redirection.
//
// ATTENTION : il s'agit d'une protection d'interface uniquement.
// Elle empeche la navigation, pas les appels directs a l'API. La
// verification du role doit aussi etre faite cote backend.
// ============================================================

(function () {
  var AGENT_PAGES = [
    "module_agent_dashboard",
    "module_agent_depenses",
    "module_agent_resume",
    // Le catalogue est celui de l'organisation : l'agent travaille dans
    // la boutique du gerant et doit donc y acceder comme lui.
    "module_articles"
  ];

  var user = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch (e) {
    user = null;
  }

  // Pas d'utilisateur connu ou role non-agent : aucune restriction ici.
  // L'authentification elle-meme est geree ailleurs (401 -> login).
  if (!user || user.role !== "agent") return;

  var page = window.location.pathname
    .split("/")
    .pop()
    .replace(/\.html$/, "");

  if (AGENT_PAGES.indexOf(page) !== -1) return;

  console.warn("Acces refuse : cette page est reservee aux gerants.");
  window.location.replace("module_agent_dashboard.html");
})();
