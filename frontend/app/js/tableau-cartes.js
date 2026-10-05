// tableau-cartes.js
//
// Sur telephone, un tableau de dix colonnes ne se lit qu'en faisant
// defiler de cote, une colonne a la fois. Ce fichier transforme chaque
// ligne en carte, sous 768 px de large : l'essentiel en gros, le reste en
// dessous, les boutons en bas. Sur ordinateur, rien ne change.
//
// Usage :
//   <table data-cartes> ... <th data-carte="titre">Article</th> ...
//
// Role de chaque colonne, porte par son <th> :
//   titre    - en gras, en haut a gauche (l'article, la categorie...)
//   montant  - en gras, en haut a droite
//   meta     - ligne discrete sous le titre, valeurs separees par « · »
//   meta-lib - idem, precede du libelle de la colonne (« Qté 3 »)
//   actions  - boutons, en bas de la carte
//   masquer  - absent de la carte (deja dit ailleurs)
//   (rien)   - ligne « Libellé  valeur », masquee si la valeur est vide
//
// Les lignes sont souvent reconstruites par le JavaScript de la page : un
// observateur repose les roles a chaque changement, sans que les pages
// aient a y penser.
(function () {
  const STYLE_ID = 'ogo-tableau-cartes-style';

  function injecterStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
/* Le libelle court (« Qté ») n'a de sens que dans la carte : sur
   ordinateur, l'en-tete de colonne le dit deja. */
table[data-cartes] .ogo-lib { display: none; }

@media screen and (max-width: 767.98px) {
  table[data-cartes], table[data-cartes] tbody { display: block; width: 100%; }
  table[data-cartes] thead { display: none; }

  table[data-cartes] tbody tr {
    display: flex; flex-wrap: wrap; align-items: baseline;
    column-gap: 0; row-gap: 4px;
    padding: 14px 16px;
    border-bottom: 1px solid rgba(127,127,127,.18);
  }
  table[data-cartes] tbody tr:last-child { border-bottom: 0; }

  table[data-cartes] tbody td {
    display: block; padding: 0 !important; border: 0 !important;
    white-space: normal !important; text-align: left !important;
    min-width: 0;
  }

  /* Ligne vide (« Aucune vente ») : un simple message centre. */
  table[data-cartes] tbody td[colspan] {
    flex-basis: 100%; text-align: center !important; padding: 8px 0 !important;
  }

  table[data-cartes] td[data-carte="titre"] {
    order: 1; flex: 0 0 60%; font-size: 15px; font-weight: 700; line-height: 1.3;
    color: inherit; overflow-wrap: anywhere; padding-right: 8px !important;
  }
  .dark table[data-cartes] td[data-carte="titre"] { color: #fff; }
  html:not(.dark) table[data-cartes] td[data-carte="titre"] { color: #0d1b19; }

  table[data-cartes] td[data-carte="montant"] {
    order: 2; flex: 0 0 40%; font-size: 15px; font-weight: 700;
    text-align: right !important; white-space: nowrap !important;
  }
  html:not(.dark) table[data-cartes] td[data-carte="montant"] { color: #0d1b19; }
  .dark table[data-cartes] td[data-carte="montant"] { color: #fff; }

  /* Ligne meta : petites valeurs a la suite. Une coupure forcee la fait
     toujours partir sous le titre. */
  table[data-cartes] tr::after { content: ""; order: 3; flex-basis: 100%; height: 0; }
  table[data-cartes] td[data-carte="meta"],
  table[data-cartes] td[data-carte="meta-lib"] {
    order: 4; flex: 0 0 auto; font-size: 12.5px; opacity: .85;
  }
  table[data-cartes] td[data-carte^="meta"]:not([data-vide]) ~ td[data-carte^="meta"]:not([data-vide])::before {
    content: "·"; margin: 0 6px; opacity: .6;
  }
  table[data-cartes] td[data-carte="meta-lib"] > .ogo-lib { display: inline; opacity: .75; margin-right: 3px; }

  /* Details : « Libellé  valeur » sur toute la largeur. */
  table[data-cartes] td[data-carte="detail"] {
    order: 5; flex: 0 0 100%; display: flex; gap: 12px;
    justify-content: space-between; align-items: baseline;
    font-size: 13px; padding-top: 2px !important;
  }
  table[data-cartes] td[data-carte="detail"]::before {
    content: attr(data-label); flex: 0 0 auto; font-size: 12px; opacity: .65;
  }
  table[data-cartes] td[data-carte="detail"] > * { text-align: right; min-width: 0; }

  table[data-cartes] td[data-carte="actions"] {
    order: 6; flex: 0 0 100%; display: flex; justify-content: flex-end;
    gap: 8px; padding-top: 6px !important;
  }

  table[data-cartes] td[data-carte="masquer"],
  table[data-cartes] td[data-vide] { display: none !important; }
}`;
    document.head.appendChild(style);
  }

  /** Une cellule sans rien d'utile : vide, ou un simple tiret. */
  function estVide(td) {
    if (td.querySelector('button, a, input, img, svg, [data-id]')) return false;
    const texte = td.textContent.replace(/\s+/g, '');
    return texte === '' || texte === '-' || texte === '—';
  }

  function appliquer(table) {
    const entetes = Array.from(table.querySelectorAll('thead th'));
    if (!entetes.length) return;

    table.querySelectorAll('tbody tr').forEach(tr => {
      const cellules = Array.from(tr.children);
      // Ligne de message sur toute la largeur : on la laisse telle quelle.
      if (cellules.length === 1 && cellules[0].hasAttribute('colspan')) return;

      cellules.forEach((td, i) => {
        const th = entetes[i];
        if (!th) return;
        const libelle = th.textContent.trim();
        const role = th.dataset.carte || 'detail';

        td.dataset.label = libelle;
        td.dataset.carte = role;

        if (estVide(td) && role !== 'titre' && role !== 'montant') td.dataset.vide = '';
        else delete td.dataset.vide;

        if (role === 'meta-lib' && !td.querySelector(':scope > .ogo-lib')) {
          const lib = document.createElement('span');
          lib.className = 'ogo-lib';
          lib.textContent = th.dataset.carteLib || libelle;
          td.prepend(lib);
        }
      });
    });
  }

  function surveiller(table) {
    if (table.dataset.cartesActif) return;
    table.dataset.cartesActif = '1';
    appliquer(table);

    // Les pages reconstruisent leurs lignes a chaque chargement ou filtre.
    // On ne reagit qu'aux ajouts de lignes : nos propres retouches sur les
    // cellules ne relancent rien, faute de quoi l'observateur tournerait
    // en boucle.
    let prevu = false;
    new MutationObserver(mutations => {
      if (prevu) return;
      const lignes = mutations.some(m => Array.from(m.addedNodes).some(n => n.nodeName === 'TR' || n.nodeName === 'TBODY'));
      if (!lignes) return;
      prevu = true;
      requestAnimationFrame(() => { prevu = false; appliquer(table); });
    }).observe(table, { childList: true, subtree: true });
  }

  function demarrer() {
    injecterStyle();
    document.querySelectorAll('table[data-cartes]').forEach(surveiller);

    // Certains tableaux n'existent qu'apres coup : les historiques des
    // etats financiers sont fabriques a chaque « Générer l'aperçu ».
    new MutationObserver(mutations => {
      mutations.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.matches('table[data-cartes]')) surveiller(n);
        n.querySelectorAll?.('table[data-cartes]').forEach(surveiller);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }

  window.OGOUE_CARTES = { activer: (table) => { injecterStyle(); surveiller(table); } };
})();
