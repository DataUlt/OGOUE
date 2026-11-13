// js/sections-repliables.js — Commentaire et justificatif repliés dans les formulaires
// Ventes et dépenses (gérant et agents) : seuls les titres restent visibles ; un appui
// sur le titre ouvre le bloc. Un bloc déjà rempli (commentaire tapé, fichier choisi,
// reçu demandé) reste ouvert. Après un enregistrement, tout se replie.
(function () {
  const style = document.createElement("style");
  style.textContent = '[data-replie="1"] > :not(:first-child) { display: none !important; }';
  document.head.appendChild(style);

  // Le champ repère, et le bloc qui le contient (son premier enfant est le titre)
  const REPERES = [
    ["#vente-note", (el) => el.closest("label")],
    ["#depense-note", (el) => el.closest("label")],
    ["#justificatif-choix", (el) => el.parentElement],
    ["#upload-zone-default", (el) => el.parentElement],
  ];

  // Un bloc est « rempli » s'il porte déjà quelque chose à ne pas cacher
  function rempli(bloc) {
    if ([...bloc.querySelectorAll("textarea")].some((t) => t.value.trim())) return true;
    if ([...bloc.querySelectorAll('input[type="file"]')].some((f) => f.files && f.files.length)) return true;
    const recu = bloc.querySelector("#recu-zone-auto");
    return !!(recu && !recu.classList.contains("hidden"));
  }

  function installer(bloc) {
    if (!bloc || bloc.dataset.repliable) return;
    const titre = bloc.firstElementChild;
    if (!titre) return;
    bloc.dataset.repliable = "1";

    // Le texte du titre à gauche, « Ajouter ⌄ » à droite
    const gauche = document.createElement("span");
    while (titre.firstChild) gauche.appendChild(titre.firstChild);
    titre.appendChild(gauche);
    const action = document.createElement("span");
    action.className = "ml-3 shrink-0 inline-flex items-center gap-0.5 text-sm font-semibold text-primary";
    titre.appendChild(action);
    titre.classList.add("flex", "items-center", "justify-between", "cursor-pointer", "select-none");
    titre.setAttribute("role", "button");
    titre.tabIndex = 0;

    function regler(ouvert) {
      bloc.dataset.replie = ouvert ? "0" : "1";
      titre.setAttribute("aria-expanded", String(ouvert));
      action.innerHTML = ouvert
        ? '<span>Masquer</span><span class="material-symbols-outlined text-lg">expand_less</span>'
        : '<span>Ajouter</span><span class="material-symbols-outlined text-lg">expand_more</span>';
    }
    function basculer(e) {
      // Le titre du commentaire est dans un <label> : pas de focus parasite sur le champ
      e.preventDefault();
      const ouvrir = bloc.dataset.replie === "1";
      regler(ouvrir);
      if (ouvrir) bloc.querySelector("textarea")?.focus();
    }
    titre.addEventListener("click", basculer);
    titre.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") basculer(e); });

    regler(rempli(bloc));
    // Après un enregistrement (formulaire vidé), le bloc se replie
    bloc.closest("form")?.addEventListener("reset", () => setTimeout(() => regler(rempli(bloc)), 0));
  }

  function lancer() {
    REPERES.forEach(([sel, bloc]) => {
      const el = document.querySelector(sel);
      if (el) installer(bloc(el));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", lancer);
  else lancer();
})();
