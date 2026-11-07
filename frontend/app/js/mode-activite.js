// js/mode-activite.js — « Ma boutique » : revente ou fabrication
// Une seule question, posée au gérant au-dessus du catalogue (« les deux » :
// chaque produit dit ensuite s'il est revendu ou fabriqué). La réponse
// est gardée avec l'entreprise (PUT /api/organization, modeActivite) et sert
// au compte de résultat SYSCOHADA (etats_financiers.js) :
//   revente     → ventes de marchandises (TA), achats de marchandises (RA)
//   fabrication → produits fabriqués (TB), matières premières (RC)
//   les_deux    → selon chaque produit du catalogue (articles.fabrique)
// Le mode choisi est publié dans window.OGOUE_MODE_ACTIVITE et par
// l'événement « ogo:mode-activite » (le catalogue en dépend).
(function () {
  const publier = (mode) => {
    window.OGOUE_MODE_ACTIVITE = mode || null;
    document.dispatchEvent(new CustomEvent("ogo:mode-activite", { detail: { mode: mode || null } }));
  };
  let utilisateur = null;
  try { utilisateur = JSON.parse(localStorage.getItem("user") || "null"); } catch (e) {}
  if (!utilisateur || utilisateur.role === "agent") return;
  const formulaire = document.getElementById("article-form");
  if (!formulaire) return;

  const API = (["localhost", "127.0.0.1"].some((h) => location.hostname.includes(h)))
    ? "http://localhost:3001/api" : "https://api.ogoue.com/api";
  const entetes = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken")}` });

  const CHOIX = [
    { valeur: "revente", icone: "storefront", titre: "Je revends ce que j'achète", exemple: "Boutique, alimentation, quincaillerie…" },
    { valeur: "fabrication", icone: "bakery_dining", titre: "Je fabrique ce que je vends", exemple: "Boulangerie, couture, restaurant, atelier…" },
    { valeur: "les_deux", icone: "swap_horiz", titre: "Je fais les deux", exemple: "Boutique qui fait aussi son pain, ses jus…" }
  ];

  const bloc = document.createElement("section");
  bloc.className = "bg-white dark:bg-card-dark rounded-lg p-6 shadow-sm mb-8";
  bloc.innerHTML = `
    <h2 class="text-lg font-bold">Votre activité</h2>
    <p class="mt-1 text-sm text-text-light-muted dark:text-gray-400">Sert à classer vos ventes et vos achats dans le compte de résultat. Les services restent toujours des services.</p>
    <div class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3" data-modes>
      ${CHOIX.map((c) => `<button type="button" data-mode="${c.valeur}" class="flex items-center gap-3 text-left rounded-2xl border-2 px-4 py-3 min-h-[64px] transition border-[#cfe7e3] dark:border-gray-700 hover:border-primary/50">
        <span class="material-symbols-outlined text-2xl text-gray-400">${c.icone}</span>
        <span class="min-w-0"><span class="block font-bold text-[15px] leading-tight">${c.titre}</span>
          <span class="block mt-0.5 text-xs text-gray-500 dark:text-gray-400">${c.exemple}</span></span></button>`).join("")}
    </div>
    <p data-mode-message class="hidden mt-3 text-sm"></p>`;
  formulaire.insertAdjacentElement("beforebegin", bloc);

  const message = bloc.querySelector("[data-mode-message]");
  const dire = (texte, erreur) => {
    message.textContent = texte;
    message.className = `mt-3 text-sm ${erreur ? "text-red-600" : "text-green-700 dark:text-green-400"}`;
  };
  function marquer(mode) {
    bloc.querySelectorAll("[data-mode]").forEach((b) => {
      const on = b.dataset.mode === mode;
      // Couleurs posées directement : les classes ajoutées après coup ne sont
      // pas toujours générées par Tailwind sur cette page
      b.style.borderColor = on ? "#0088CC" : "";
      b.style.backgroundColor = on ? "rgba(0, 136, 204, 0.08)" : "";
      const icone = b.querySelector(".material-symbols-outlined");
      icone.classList.toggle("text-primary", on);
      icone.classList.toggle("text-gray-400", !on);
    });
  }

  let actuel = null;
  fetch(`${API}/organization`, { headers: entetes() })
    .then((r) => (r.ok ? r.json() : null))
    .then((org) => {
      actuel = org?.modeActivite || null;
      marquer(actuel);
      publier(actuel);
      if (!actuel) dire("Pas encore choisi : pour l'instant, vos produits sont comptés comme de la revente.", false);
    })
    .catch(() => {});

  bloc.querySelector("[data-modes]").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-mode]");
    if (!b || b.dataset.mode === actuel) return;
    const avant = actuel;
    marquer(b.dataset.mode);
    try {
      const r = await fetch(`${API}/organization`, { method: "PUT", headers: entetes(), body: JSON.stringify({ modeActivite: b.dataset.mode }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Enregistrement impossible. Réessayez.");
      actuel = b.dataset.mode;
      publier(actuel);
      dire(actuel === "les_deux"
        ? "Enregistré. Indiquez pour chaque produit s'il est revendu tel quel ou fabriqué par vous (menu « Modifier » du catalogue)."
        : "Enregistré. Le compte de résultat en tient compte.", false);
    } catch (err) {
      marquer(avant);
      dire(err.message, true);
    }
  });
})();
