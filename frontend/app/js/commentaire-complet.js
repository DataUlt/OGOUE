// commentaire-complet.js
//
// Dans les tableaux, un commentaire est coupe pour ne pas ecraser les
// autres colonnes. Le texte entier n'etait lisible qu'au survol de la
// souris, ce qui n'existe pas sur telephone. Toucher ou cliquer le
// commentaire ouvre desormais une fenetre qui l'affiche en entier.
//
// Usage : <button type="button" class="commentaire-complet"
//                 data-commentaire="texte complet">texte</button>
//
// Un seul ecouteur, pose sur le document : les lignes des tableaux sont
// reconstruites a chaque chargement, il n'y a rien a rebrancher.
(function () {
  function fermer() {
    document.getElementById('ogo-modal-commentaire')?.remove();
    document.removeEventListener('keydown', surTouche);
  }

  function surTouche(e) {
    if (e.key === 'Escape') fermer();
  }

  function ouvrir(texte) {
    fermer();

    const fond = document.createElement('div');
    fond.id = 'ogo-modal-commentaire';
    fond.className = 'fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 p-4';
    fond.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="ogo-commentaire-titre" tabindex="-1"
           class="w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl outline-none">
        <div class="flex items-center justify-between gap-4 mb-3">
          <h3 id="ogo-commentaire-titre" class="text-lg font-bold text-[#0a0c0a] dark:text-white">Commentaire</h3>
          <button type="button" data-fermer aria-label="Fermer"
                  class="inline-flex items-center justify-center size-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">
            <span class="material-symbols-outlined text-base" data-fermer>close</span>
          </button>
        </div>
        <p data-texte class="text-sm leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-words max-h-[60vh] overflow-y-auto"></p>
        <button type="button" data-fermer
                class="mt-6 w-full rounded-full h-11 px-5 bg-primary text-white text-sm font-bold hover:bg-primary/90 transition-colors">
          Fermer
        </button>
      </div>
    `;
    // textContent, jamais innerHTML : le commentaire est saisi librement.
    fond.querySelector('[data-texte]').textContent = texte;

    fond.addEventListener('click', (e) => {
      if (e.target === fond || e.target.hasAttribute('data-fermer')) fermer();
    });
    document.addEventListener('keydown', surTouche);
    document.body.appendChild(fond);
    // Le focus va a la fenetre elle-meme : les lecteurs d'ecran y entrent,
    // sans qu'un contour apparaisse autour d'un bouton qu'on n'a pas touche.
    fond.querySelector('[role="dialog"]')?.focus();
  }

  document.addEventListener('click', (e) => {
    const declencheur = e.target.closest('.commentaire-complet');
    if (!declencheur) return;
    e.preventDefault();
    ouvrir(declencheur.dataset.commentaire || declencheur.textContent.trim());
  });
})();
