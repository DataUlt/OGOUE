// js/connexion-feedback.js — retour visuel des pages de connexion
// Pendant la vérification : un indicateur de chargement dans le bouton.
// Une fois connecté : un écran « Connexion réussie » avec une coche animée,
// le temps d'ouvrir l'espace. Utilisé par login.html et agent-login.html.
// pret() : le même écran pour un document généré (analyse financière), qui
// se ferme tout seul pour laisser voir l'aperçu.
(function () {
  const style = document.createElement("style");
  style.textContent = `
    @keyframes ogoTourne { to { transform: rotate(360deg); } }
    @keyframes ogoApparait { from { opacity: 0; } to { opacity: 1; } }
    @keyframes ogoMonte { from { opacity: 0; transform: translateY(10px) scale(.96); } to { opacity: 1; transform: none; } }
    @keyframes ogoCercle { to { stroke-dashoffset: 0; } }
    @keyframes ogoCoche { to { stroke-dashoffset: 0; } }
    @keyframes ogoBarre { from { width: 0; } to { width: 100%; } }
    .ogo-roue { display: inline-block; width: 18px; height: 18px; border: 2.5px solid rgba(255,255,255,.45); border-top-color: #fff; border-radius: 50%; animation: ogoTourne .7s linear infinite; vertical-align: -3px; }
    #ogo-connexion-ok { position: fixed; inset: 0; z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 16px; background: rgba(246,248,246,.92); backdrop-filter: blur(4px); animation: ogoApparait .2s ease-out; font-family: inherit; }
    #ogo-connexion-ok .boite { width: 100%; max-width: 340px; background: #fff; border-radius: 28px; padding: 32px 24px 26px; text-align: center; box-shadow: 0 20px 50px rgba(11,42,91,.15); animation: ogoMonte .35s ease-out; }
    #ogo-connexion-ok svg circle { stroke-dasharray: 166; stroke-dashoffset: 166; animation: ogoCercle .5s ease-out forwards; }
    #ogo-connexion-ok svg path { stroke-dasharray: 48; stroke-dashoffset: 48; animation: ogoCoche .3s .45s ease-out forwards; }
    #ogo-connexion-ok .barre { height: 4px; border-radius: 99px; background: #E7EBF0; overflow: hidden; margin-top: 20px; }
    #ogo-connexion-ok .barre i { display: block; height: 100%; background: #0088CC; animation: ogoBarre var(--duree, 1.2s) linear forwards; }
    #ogo-connexion-ok.ogo-sortie { transition: opacity .25s ease; opacity: 0; }`;
  document.head.appendChild(style);

  const echapper = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  window.OGOUE_CONNEXION = {
    // Bouton en attente : roue qui tourne et texte court
    attente(bouton, texte = "Connexion…") {
      if (!bouton) return;
      bouton.dataset.texteInitial = bouton.dataset.texteInitial || bouton.innerHTML;
      bouton.disabled = true;
      bouton.innerHTML = `<span class="ogo-roue"></span><span style="margin-left:10px">${echapper(texte)}</span>`;
    },
    // Retour à l'état normal (erreur)
    fin(bouton) {
      if (!bouton) return;
      if (bouton.dataset.texteInitial) bouton.innerHTML = bouton.dataset.texteInitial;
      bouton.disabled = false;
    },
    // Écran de réussite, puis ouverture de l'espace
    reussie({ prenom = "", destination, duree = 1200 }) {
      this.ecran({ titre: "Connexion réussie", texte: `${prenom ? `Bonjour ${echapper(prenom)} ! ` : ""}Ouverture de votre espace…`, duree });
      setTimeout(() => { window.location.href = destination; }, duree);
    },
    // Document prêt : même écran, qui disparaît seul (un appui le ferme plus tôt)
    pret({ titre = "Document prêt", texte = "", duree = 1100 } = {}) {
      const fond = this.ecran({ titre: echapper(titre), texte: echapper(texte), duree });
      const fermer = () => { fond.classList.add("ogo-sortie"); setTimeout(() => fond.remove(), 260); };
      fond.addEventListener("click", fermer);
      setTimeout(fermer, duree);
    },
    ecran({ titre, texte, duree }) {
      document.getElementById("ogo-connexion-ok")?.remove();
      const fond = document.createElement("div");
      fond.id = "ogo-connexion-ok";
      fond.style.setProperty("--duree", duree + "ms");
      fond.innerHTML = `<div class="boite" role="status" aria-live="polite">
          <svg width="72" height="72" viewBox="0 0 56 56" fill="none" aria-hidden="true" style="display:block;margin:0 auto">
            <circle cx="28" cy="28" r="26" stroke="#16a34a" stroke-width="3" fill="#ecfdf3"/>
            <path d="M17 29l7 7 15-16" stroke="#16a34a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <div style="margin-top:14px;font-size:20px;font-weight:800;color:#0B1F3F">${titre}</div>
          ${texte ? `<div style="margin-top:4px;font-size:14px;color:#4A5870">${texte}</div>` : ""}
          <div class="barre"><i></i></div>
        </div>`;
      document.body.appendChild(fond);
      return fond;
    }
  };
})();
