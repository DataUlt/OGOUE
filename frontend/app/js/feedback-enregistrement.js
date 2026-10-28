// Retour visuel à l'enregistrement d'une vente ou d'une dépense.
// Pendant l'envoi : une barre de progression sous les boutons, bouton désactivé.
// Une fois enregistré : une confirmation verte affichée en haut de l'écran.
(function () {
  const DUREE_SUCCES_MS = 3500;
  const ID_BARRE = "feedback-progression";
  let conteneur = null;
  let minuterie = null;

  function ajouterStyle() {
    if (document.getElementById("feedback-style")) return;
    const style = document.createElement("style");
    style.id = "feedback-style";
    style.textContent =
      "@keyframes feedback-glisse{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}" +
      ".feedback-glisse{animation:feedback-glisse 1.2s ease-in-out infinite}";
    document.head.appendChild(style);
  }

  function getConteneur() {
    if (conteneur) return conteneur;
    conteneur = document.createElement("div");
    conteneur.setAttribute("role", "status");
    conteneur.setAttribute("aria-live", "polite");
    conteneur.className = "pointer-events-none";
    conteneur.style.cssText = "position:fixed;top:16px;left:50%;transform:translateX(-50%);z-index:200;width:calc(100% - 32px);max-width:448px;";
    document.body.appendChild(conteneur);
    return conteneur;
  }

  function effacerSucces() {
    if (minuterie) clearTimeout(minuterie);
    minuterie = null;
    if (conteneur) conteneur.innerHTML = "";
  }

  // Barre sous la rangée des boutons (Annuler / Enregistrer)
  function poserBarre(bouton) {
    if (!bouton) return;
    ajouterStyle();
    retirerBarre();
    const rangee = bouton.parentElement;
    const barre = document.createElement("div");
    barre.id = ID_BARRE;
    barre.setAttribute("role", "progressbar");
    barre.setAttribute("aria-label", "Enregistrement en cours");
    barre.className = "mt-4 h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700";
    barre.innerHTML = '<div class="feedback-glisse h-full w-1/4 rounded-full bg-primary"></div>';
    rangee.insertAdjacentElement("afterend", barre);
  }

  function retirerBarre() {
    document.getElementById(ID_BARRE)?.remove();
  }

  // Début d'envoi : barre de progression, bouton désactivé
  function debut(bouton) {
    effacerSucces();
    if (bouton) {
      bouton.disabled = true;
      bouton.classList.add("opacity-60", "cursor-wait");
    }
    poserBarre(bouton);
  }

  // Confirmation verte, visible sans faire défiler la page
  function succes(message) {
    effacerSucces();
    getConteneur().innerHTML =
      '<div class="pointer-events-auto flex items-center gap-3 rounded-xl border border-green-600 bg-green-600 px-4 py-3 shadow-lg">' +
      '<span class="material-symbols-outlined text-white">check_circle</span>' +
      '<span class="text-sm font-bold text-white">' + message + "</span></div>";
    minuterie = setTimeout(effacerSucces, DUREE_SUCCES_MS);
  }

  // Fin d'envoi (succès ou erreur) : barre retirée, bouton redevient utilisable
  function fin(bouton) {
    retirerBarre();
    if (bouton) {
      bouton.disabled = false;
      bouton.classList.remove("opacity-60", "cursor-wait");
    }
  }

  window.OGOUE_FEEDBACK = { debut: debut, succes: succes, fin: fin };
})();
