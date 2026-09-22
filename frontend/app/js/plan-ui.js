// plan-ui.js
//
// Adapte l'interface a la formule souscrite.
//
// Le verrou qui compte est celui du backend : toute route protegee repond
// 402 quelle que soit l'apparence de la page. Ce fichier ne securise donc
// rien, il evite d'afficher des boutons qui echoueraient et propose la
// montee en formule au moment ou l'envie est la.
//
// Usage dans le HTML :
//   data-exige="recus"                      -> verrouille et propose /tarifs
//   data-exige="audit" data-exige-mode="masquer" -> retire l'element
(function () {
  const API_BASE_URL = (['localhost', '127.0.0.1'].some(h => location.hostname.includes(h)))
    ? 'http://localhost:3001'
    : 'https://api.ogoue.com';

  // Formule qui ouvre chaque fonction : sert a dire quoi souscrire plutot
  // qu'un vague « passez a la formule superieure ».
  const FORMULE_REQUISE = {
    recus: "Pro",
    justificatifs: "Pro",
    etatsFinanciers: "Pro",
    compteResultat: "Pro",
    tableauFlux: "Pro",
    historiqueVentes: "Pro",
    historiqueDepenses: "Pro",
    exportDocuments: "Pro",
    audit: "Équipe",
    scoreTracabilite: "Équipe",
    agents: "Pro",
  };

  const LIBELLES = {
    recus: "Les reçus numérotés",
    justificatifs: "Les justificatifs",
    etatsFinanciers: "Les états financiers",
    compteResultat: "Le compte de résultat",
    tableauFlux: "Le tableau de flux",
    historiqueVentes: "L'historique des ventes",
    historiqueDepenses: "L'historique des dépenses",
    exportDocuments: "L'export Excel et l'impression",
    audit: "L'historique des suppressions",
    scoreTracabilite: "Le score de traçabilité",
    agents: "La gestion des agents",
  };

  let droits = null;
  let formule = null;
  let catalogue = null;
  let abonnement = null;
  let stockage = null;

  /**
   * La formule la moins chere qui ouvre une fonction.
   *
   * Deduite du catalogue servi par /api/plan plutot que codee en dur :
   * deplacer une fonction d'une formule a l'autre dans plans.js suffit
   * alors a corriger tous les messages, sans retoucher ce fichier.
   * FORMULE_REQUISE ne sert plus que de repli, si le catalogue manque.
   */
  function formuleQuiOuvre(fonction) {
    if (catalogue) {
      const ouverte = Object.entries(catalogue)
        .sort((a, b) => (a[1].prixMensuel || 0) - (b[1].prixMensuel || 0))
        .find(([, f]) => (fonction === "agents" ? f.agentsMax !== 0 : !!f[fonction]));

      if (ouverte) {
        return { nom: ouverte[1].nom, prixMensuel: ouverte[1].prixMensuel };
      }
    }
    return { nom: FORMULE_REQUISE[fonction] || "Pro", prixMensuel: null };
  }

  function prixLisible(montant) {
    if (!montant) return null;
    return `${Number(montant).toLocaleString("fr-FR")} FCFA/mois`;
  }

  function getToken() {
    return localStorage.getItem('authToken');
  }

  async function chargerFormule() {
    const token = getToken();
    if (!token) return null;

    try {
      const reponse = await fetch(`${API_BASE_URL}/api/plan`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!reponse.ok) return null;
      const data = await reponse.json();
      droits = data.droits || null;
      formule = data.formule || null;
      catalogue = data.catalogue || null;
      abonnement = data.abonnement || null;
      stockage = data.stockage || null;
      return data;
    } catch (e) {
      // Reseau indisponible : on laisse l'interface intacte. Le backend
      // refusera de toute facon ce qui n'est pas permis, et masquer des
      // fonctions a cause d'une coupure serait pire que de les laisser.
      console.warn("Formule non chargée :", e?.message || e);
      return null;
    }
  }

  /** Une fonction est-elle ouverte par la formule en cours ? */
  function autorise(fonction) {
    if (!droits) return true;               // formule inconnue : on n'ampute rien
    if (fonction === "agents") return droits.agentsMax !== 0;
    return !!droits[fonction];
  }

  // ---------------------------------------------------------------
  // Infobulle de survol
  // ---------------------------------------------------------------
  // Dire au survol quelle formule ouvre la fonction, sans obliger a
  // cliquer. Une seule bulle est fabriquee puis deplacee : en creer une
  // par element en poserait des dizaines sur une page de cartes.

  let bulle = null;
  let bulleCible = null;

  function construireBulle() {
    if (bulle) return bulle;
    bulle = document.createElement('div');
    bulle.id = 'ogo-bulle-formule';
    bulle.setAttribute('role', 'tooltip');
    bulle.style.cssText = [
      'position:fixed',
      'z-index:110',
      'max-width:260px',
      'padding:8px 12px',
      'border-radius:10px',
      'background:#0a0c0a',
      'color:#fff',
      'font-size:12px',
      'line-height:1.45',
      'box-shadow:0 8px 24px rgba(0,0,0,.25)',
      // La bulle ne doit jamais intercepter la souris : elle se place
      // au-dessus de l'element survole, et le lui voler ferait
      // clignoter l'affichage a l'infini.
      'pointer-events:none',
      'opacity:0',
      'transition:opacity .12s ease',
    ].join(';');
    document.body.appendChild(bulle);
    return bulle;
  }

  function montrerBulle(el, fonction) {
    if (bulleCible === el) return;
    bulleCible = el;

    const { nom, prixMensuel } = formuleQuiOuvre(fonction);
    const libelle = LIBELLES[fonction] || "Cette fonction";
    const prix = prixLisible(prixMensuel);

    const b = construireBulle();
    b.innerHTML = `
      <div style="font-weight:700">${libelle} — formule ${nom}</div>
      <div style="opacity:.75;margin-top:2px">
        ${prix ? `À partir de ${prix}. ` : ''}Cliquez pour changer de formule.
      </div>
    `;

    // Place la bulle au-dessus de l'element, centree. Si le haut de
    // l'ecran manque, elle bascule en dessous plutot que de sortir du
    // cadre.
    b.style.opacity = '0';
    b.style.left = '0px';
    b.style.top = '0px';
    const r = el.getBoundingClientRect();
    const taille = b.getBoundingClientRect();

    let gauche = r.left + r.width / 2 - taille.width / 2;
    gauche = Math.max(8, Math.min(gauche, window.innerWidth - taille.width - 8));

    const dessus = r.top - taille.height - 8;
    const haut = dessus >= 8 ? dessus : r.bottom + 8;

    b.style.left = `${Math.round(gauche)}px`;
    b.style.top = `${Math.round(haut)}px`;
    b.style.opacity = '1';
  }

  function cacherBulle(el) {
    if (el && bulleCible !== el) return;
    bulleCible = null;
    if (bulle) bulle.style.opacity = '0';
  }

  /**
   * Fait reagir au survol un element que le verrou vient de desactiver.
   *
   * Un <button disabled> ne dispatche aucun evenement de souris : ecouter
   * sur lui ne donnerait rien. On ecoute donc sur son parent, qui les
   * recoit a sa place, et on compare la position du curseur au cadre de
   * l'element pour ne reagir que sur lui — sans rien changer a la mise en
   * page, ce qu'un enrobage aurait fait.
   */
  function surveillerSurvol(el, fonction) {
    const zone = el.parentElement || el;

    zone.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const dedans = e.clientX >= r.left && e.clientX <= r.right
                  && e.clientY >= r.top && e.clientY <= r.bottom;
      if (dedans) montrerBulle(el, fonction);
      else cacherBulle(el);
    });

    zone.addEventListener('mouseleave', () => cacherBulle(el));
    window.addEventListener('scroll', () => cacherBulle(el), { passive: true });

    // Meme raison pour le clic : un bouton desactive n'en emet pas, donc
    // le gestionnaire pose sur l'element ne partirait jamais et la
    // fenetre de montee en formule resterait inatteignable. On ne le
    // relaie que dans ce cas, pour ne pas ouvrir deux fois la fenetre
    // sur un element reste actif (un lien, par exemple).
    if (el.disabled) {
      zone.addEventListener('click', (e) => {
        const r = el.getBoundingClientRect();
        const dedans = e.clientX >= r.left && e.clientX <= r.right
                    && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!dedans) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        cacherBulle(el);
        fenetreMontee(fonction);
      }, true);
    }
  }

  function fenetreMontee(fonction) {
    const { nom: requise } = formuleQuiOuvre(fonction);
    const libelle = LIBELLES[fonction] || "Cette fonction";

    const existante = document.getElementById('ogo-modal-formule');
    if (existante) existante.remove();

    const fond = document.createElement('div');
    fond.id = 'ogo-modal-formule';
    fond.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4';
    fond.innerHTML = `
      <div class="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl">
        <div class="flex items-center justify-center size-12 rounded-full bg-primary/10 text-primary mx-auto mb-4">
          <span class="material-symbols-outlined text-2xl">lock</span>
        </div>
        <h3 class="text-lg font-bold text-center text-[#0a0c0a] dark:text-white">
          ${libelle} — formule ${requise}
        </h3>
        <p class="mt-2 text-sm text-center text-gray-600 dark:text-gray-400">
          Cette fonction n'est pas incluse dans votre formule
          ${formule ? `<strong>${droits?.nom || formule}</strong>` : 'actuelle'}.
          Vos données restent intactes : activer la formule ${requise} la débloque immédiatement.
        </p>
        <div class="mt-6 flex flex-col sm:flex-row gap-3">
          <button type="button" data-fermer
                  class="flex-1 rounded-full h-11 px-5 border border-black/10 dark:border-gray-600 text-sm font-bold text-[#0a0c0a] dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
            Plus tard
          </button>
          <a href="module_abonnement.html"
             class="flex-1 rounded-full h-11 px-5 inline-flex items-center justify-center bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
            Changer de formule
          </a>
        </div>
      </div>
    `;

    fond.addEventListener('click', (e) => {
      if (e.target === fond || e.target.hasAttribute('data-fermer')) fond.remove();
    });
    document.body.appendChild(fond);
  }

  /**
   * Applique la formule aux elements porteurs de data-exige.
   *
   * Par defaut on verrouille plutot que de masquer : un bouton disparu
   * laisse croire a un defaut de l'application, un bouton cadenasse dit
   * ce qu'il faut faire pour l'obtenir.
   */
  function appliquer(racine = document) {
    racine.querySelectorAll('[data-exige]').forEach(el => {
      const fonction = el.dataset.exige;
      if (autorise(fonction)) return;

      if (el.dataset.exigeMode === 'masquer') {
        el.remove();
        return;
      }

      el.classList.add('opacity-50', 'cursor-not-allowed', 'relative');
      el.setAttribute('aria-disabled', 'true');
      if ('disabled' in el) el.disabled = true;

      if (!el.querySelector('.ogo-cadenas')) {
        const cadenas = document.createElement('span');
        cadenas.className = 'ogo-cadenas material-symbols-outlined absolute top-2 right-2 text-[18px] text-gray-500 dark:text-gray-400';
        cadenas.textContent = 'lock';
        el.appendChild(cadenas);
      }

      // Le nom de la formule est lu a la demande, pas fige ici : une
      // infobulle native (title) serait lente, non stylable, et
      // doublerait la notre.
      el.setAttribute('aria-label',
        `${LIBELLES[fonction] || 'Cette fonction'} — formule ${formuleQuiOuvre(fonction).nom}`);
      surveillerSurvol(el, fonction);

      // capture:true et stopImmediatePropagation : les boutons concernes
      // ont deja leurs propres gestionnaires, poses avant ce script. Sans
      // cela, leur action partirait quand meme et se solderait par un 402.
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        fenetreMontee(fonction);
      }, true);
    });
  }

  /**
   * Barre une page entiere. Utilise par les pages dont toute la raison
   * d'etre tient a une fonction : etats financiers, historique des
   * suppressions.
   */
  function exigerPage(fonction) {
    if (autorise(fonction)) return true;
    fenetreMontee(fonction);
    const principal = document.querySelector('main');
    if (principal) principal.style.filter = 'blur(4px)';
    return false;
  }

  window.OGOUE_PLAN = {
    chargee: chargerFormule().then(() => {
      appliquer();
      document.dispatchEvent(new CustomEvent('ogoue:formule', { detail: { formule, droits, abonnement, stockage } }));
      return { formule, droits, abonnement, stockage };
    }),
    autorise,
    appliquer,
    exigerPage,
    fenetreMontee,
    get formule() { return formule; },
    get droits() { return droits; },
    get abonnement() { return abonnement; },
    get stockage() { return stockage; },
  };
})();
