// js/periode-selecteurs.js
// ============================================================
// Choix direct du mois et de l'année dans un calendrier
// ------------------------------------------------------------
// Les filtres par date ne se déplaçaient que de mois en mois : rejoindre
// janvier 2024 depuis décembre 2026 demandait trente-cinq clics. Une
// liste de mois et un champ d'année permettent d'y aller d'un coup, les
// flèches restant utiles pour le pas à pas.
//
// Reprend la logique et l'habillage du filtre de module_tableau_bord,
// qui les portait seul. Partagé ici par le résumé ventes/dépenses, son
// équivalent agent et les états financiers, qui ont chacun leur propre
// code de calendrier.
// ============================================================
(function () {
  const MOIS = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"
  ];

  // Mêmes bornes que le champ année du gabarit, pour que la saisie
  // clavier et l'attribut min/max du champ ne se contredisent jamais.
  const ANNEE_MIN = 1900;
  const ANNEE_MAX = 2200;

  /**
   * Installe la liste des mois et le champ de l'année, et les tient
   * synchronisés avec le mois affiché par le calendrier appelant.
   *
   * @param {Object} options
   * @param {HTMLSelectElement} options.selectMois
   * @param {HTMLInputElement}  options.champAnnee
   * @param {Function} options.lireVue    rend la Date actuellement affichée
   * @param {Function} options.ecrireVue  reçoit (annee, mois) et repositionne la vue
   * @returns {{synchroniser: Function}} à appeler à chaque rendu du calendrier
   */
  function installerSelecteursMoisAnnee({ selectMois, champAnnee, lireVue, ecrireVue }) {
    MOIS.forEach((nom, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = nom;
      selectMois.appendChild(option);
    });

    function synchroniser() {
      const vue = lireVue();
      selectMois.value = String(vue.getMonth());
      champAnnee.value = String(vue.getFullYear());
    }

    selectMois.addEventListener("change", () => {
      const vue = lireVue();
      ecrireVue(vue.getFullYear(), parseInt(selectMois.value, 10));
    });

    /**
     * Une saisie vide ou non numerique est ignoree plutot que de
     * projeter le calendrier sur une date invalide. Hors bornes, on
     * ramene dans la plage et on reecrit le champ, pour qu'il ne montre
     * jamais autre chose que ce qu'affiche le calendrier.
     */
    function appliquerAnnee() {
      const saisie = parseInt(champAnnee.value, 10);
      if (!Number.isFinite(saisie)) return;

      const annee = Math.max(ANNEE_MIN, Math.min(ANNEE_MAX, saisie));
      champAnnee.value = String(annee);
      ecrireVue(annee, lireVue().getMonth());
    }

    champAnnee.addEventListener("change", appliquerAnnee);
    champAnnee.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        appliquerAnnee();
      }
    });

    return { synchroniser };
  }

  window.OGOUE_PERIODE = { installerSelecteursMoisAnnee, MOIS };
})();
