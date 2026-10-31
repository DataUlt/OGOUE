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

  var page = window.location.pathname
    .split("/")
    .pop()
    .replace(/\.html$/, "");

  // Gerant sur une page agent : ses operations y seraient enregistrees a
  // son nom (« Gerant ») alors qu'il croit travailler comme agent. On le
  // renvoie vers la page equivalente de son propre espace.
  var EQUIVALENT_GERANT = {
    module_agent_dashboard: "module_ventes.html",
    module_agent_depenses: "module_depenses.html",
    module_agent_resume: "module_resume_ventes_depenses.html"
  };
  if (user && user.role !== "agent" && EQUIVALENT_GERANT[page]) {
    window.location.replace(EQUIVALENT_GERANT[page]);
    return;
  }

  // Pas d'utilisateur connu ou role non-agent : aucune autre restriction ici.
  // L'authentification elle-meme est geree ailleurs (401 -> login).
  if (!user || user.role !== "agent") return;

  if (AGENT_PAGES.indexOf(page) !== -1) return;

  console.warn("Acces refuse : cette page est reservee aux gerants.");
  window.location.replace("module_agent_dashboard.html");
})();
