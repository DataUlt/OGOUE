// js/filtre-periode.js — périodes rapides à côté du filtre de dates
// Pages Résumé (gérant, agent) et Analyse financière : le cadre « Filtrer par
// date » devient la même barre que le tableau de bord, avec les boutons
// Aujourd'hui / Semaine / Mois / Année puis le bouton des dates. Le calendrier
// reste celui de la page ; elle fournit OGOUE_FILTRE_DATES.definir(debut, fin).
(function () {
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const fr = (s) => s.split("-").reverse().join("/");

  function plages() {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    const lundi = new Date(t);
    lundi.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    return {
      jour: [iso(t), iso(t)],
      semaine: [iso(lundi), iso(t)],
      mois: [iso(new Date(t.getFullYear(), t.getMonth(), 1)), iso(t)],
      annee: [iso(new Date(t.getFullYear(), 0, 1)), iso(t)]
    };
  }
  const LIBELLES = [["jour", "Aujourd'hui"], ["semaine", "Semaine"], ["mois", "Mois"], ["annee", "Année"]];

  function installer() {
    const bouton = document.getElementById("dateFilterButton");
    const libelle = document.getElementById("dateFilterLabel");
    const carte = bouton?.parentElement;
    if (!bouton || !libelle || !carte || carte.dataset.periodesRapides) return;
    carte.dataset.periodesRapides = "1";

    // Le cadre blanc et son titre laissent place à la barre du tableau de bord
    carte.querySelector(":scope > p")?.remove();
    carte.className = "relative flex flex-wrap sm:flex-nowrap items-center justify-end gap-2";
    // Les onglets et la barre ne tiennent pas sur une ligne : la barre passe
    // juste au-dessus des onglets, alignée à droite
    const ligneOnglets = carte.closest(".border-b");
    if (ligneOnglets) {
      ligneOnglets.parentElement.insertBefore(carte, ligneOnglets);
      carte.classList.add("mb-4");
    }

    const groupe = document.createElement("div");
    groupe.setAttribute("role", "group");
    groupe.setAttribute("aria-label", "Période rapide");
    groupe.style.cssText = "display:flex;background:#0B2A5B;border-radius:999px;padding:4px;gap:2px";
    groupe.innerHTML = LIBELLES.map(([p, t]) =>
      `<button type="button" data-periode="${p}" style="border:0;height:36px;padding:0 14px;border-radius:999px;cursor:pointer;font-weight:700;font-size:14px;white-space:nowrap;background:transparent;color:rgba(255,255,255,.85)">${t}</button>`).join("");
    carte.insertBefore(groupe, bouton);

    bouton.className = "inline-flex items-center gap-2 h-11 px-5 rounded-full text-[15px] font-bold whitespace-nowrap";
    bouton.style.cssText = "background:#0B2A5B;color:#fff";
    libelle.className = "whitespace-nowrap";
    const icone = bouton.querySelector(".material-symbols-outlined");
    if (icone) icone.className = "material-symbols-outlined text-xl";

    // Bouton actif : la période choisie correspond-elle à un raccourci ?
    function majActif() {
      const m = libelle.textContent.match(/(\d{2}\/\d{2}\/\d{4})(?:\s*-\s*(\d{2}\/\d{2}\/\d{4}))?/);
      const choisi = m ? [m[1], m[2] || m[1]] : null;
      const p = plages();
      groupe.querySelectorAll("[data-periode]").forEach((b) => {
        const [d, f] = p[b.dataset.periode];
        const on = !!choisi && choisi[0] === fr(d) && choisi[1] === fr(f);
        b.style.background = on ? "#fff" : "transparent";
        b.style.color = on ? "#0B1F3F" : "rgba(255,255,255,.85)";
      });
    }
    new MutationObserver(majActif).observe(libelle, { childList: true, characterData: true, subtree: true });
    majActif();

    groupe.addEventListener("click", (e) => {
      const b = e.target.closest("[data-periode]");
      if (!b) return;
      const [d, f] = plages()[b.dataset.periode];
      window.OGOUE_FILTRE_DATES.definir(d, f);
    });

    // Téléphone : boutons un peu plus serrés pour tenir sur une ligne
    const style = document.createElement("style");
    style.textContent = "@media (max-width: 420px) { [data-periode] { padding: 0 9px !important; font-size: 13px !important; } }";
    document.head.appendChild(style);
  }

  // La page installe son calendrier (et OGOUE_FILTRE_DATES) après le chargement
  let essais = 0;
  (function attendre() {
    if (window.OGOUE_FILTRE_DATES?.definir) return installer();
    if (++essais < 80) setTimeout(attendre, 100);
  })();
})();
