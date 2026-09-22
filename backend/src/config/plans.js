// Ce que chaque formule donne le droit de faire.
//
// Source de verite unique du backend. Les memes montants et les memes
// limites sont ecrits dans frontend/tarifs.html : toute modification ici
// doit y etre reportee, sinon la page vendrait autre chose que ce que le
// code autorise.
//
// La regle de lecture : `null` signifie "sans limite", `0` signifie
// "interdit". Un booleen a false ferme la fonction.

export const FORMULES = {
  essentiel: {
    // Les cles ('essentiel', 'pro', 'equipe') sont ce qui est ecrit dans
    // organizations.plan et tape a la main dans le Table Editor : elles
    // restent sans accent ni majuscule. `nom` est ce qui s'affiche.
    nom: "Essentiel",
    // Prix en FCFA. Ils vivaient jusqu'ici dans quatre fichiers du
    // frontend ; ils sont desormais servis par /api/plan, pour que
    // l'application affiche toujours ce que le backend applique.
    prixMensuel: 0,
    prixAnnuel: 0,
    resume: "Je commence à mieux gérer mon activité.",
    // Saisie et consultation courante : jamais bridees, c'est ce qui
    // donne envie de rester.
    recus: false,
    justificatifs: false,
    // La page des etats financiers est ouverte a tous : ce qui se paie,
    // ce sont les documents qu'elle produit, pas le fait d'y entrer. Le
    // gerant gratuit voit ainsi ce qu'il n'a pas, cadenas a l'appui.
    etatsFinanciers: true,
    // Documents pris un par un. Le tableau de flux et l'historique des
    // ventes suffisent a suivre son activite au jour le jour ; le compte
    // de resultat et l'historique des depenses relevent de la tenue de
    // comptes, qui est ce que la formule Pro vend.
    compteResultat: false,
    tableauFlux: true,
    historiqueVentes: true,
    historiqueDepenses: false,
    // Exporter en Excel et imprimer, sur la page des etats financiers.
    // Consulter un document a l'ecran est une chose, en emporter une
    // copie opposable a un banquier en est une autre.
    exportDocuments: false,
    audit: false,
    scoreTracabilite: false,
    // Fenetre de consultation, en mois. Au-dela, les operations restent
    // en base mais ne sont plus renvoyees.
    historiqueMois: 3,
    agentsMax: 0,
    stockageGo: 0,
  },

  pro: {
    nom: "Pro",
    prixMensuel: 10000,
    prixAnnuel: 100000,
    resume: "Je veux aller plus loin dans ma gestion.",
    recus: true,
    justificatifs: true,
    etatsFinanciers: true,
    compteResultat: true,
    tableauFlux: true,
    historiqueVentes: true,
    historiqueDepenses: true,
    exportDocuments: true,
    audit: false,
    scoreTracabilite: false,
    historiqueMois: null,
    agentsMax: 3,
    stockageGo: 2,
  },

  equipe: {
    nom: "Équipe",
    prixMensuel: 25000,
    prixAnnuel: 250000,
    resume: "Nous sommes plusieurs à gérer l'activité.",
    recus: true,
    justificatifs: true,
    etatsFinanciers: true,
    compteResultat: true,
    tableauFlux: true,
    historiqueVentes: true,
    historiqueDepenses: true,
    exportDocuments: true,
    audit: true,
    scoreTracabilite: true,
    historiqueMois: null,
    agentsMax: null,
    stockageGo: 10,
  },
};

export const FORMULE_PAR_DEFAUT = "essentiel";

/**
 * Droits correspondant a une formule.
 *
 * Toute valeur inconnue retombe sur la formule gratuite : mieux vaut
 * fermer une fonction a tort que de l'ouvrir a cause d'une faute de
 * frappe en base.
 */
export function droitsDe(formule) {
  return FORMULES[formule] || FORMULES[FORMULE_PAR_DEFAUT];
}

/**
 * Formule reellement active, echeance comprise.
 *
 * Un abonnement expire n'est pas supprime : l'organisation retombe
 * simplement sur la formule gratuite. Ses donnees restent intactes, et
 * un nouveau versement la relance sans rien reconstruire.
 *
 * @param {{plan?: string, plan_expire_le?: string|null}} organisation
 */
export function formuleActive(organisation) {
  const formule = organisation?.plan || FORMULE_PAR_DEFAUT;
  if (!FORMULES[formule]) return FORMULE_PAR_DEFAUT;

  // La gratuite n'expire pas.
  if (formule === FORMULE_PAR_DEFAUT) return FORMULE_PAR_DEFAUT;

  const echeance = organisation?.plan_expire_le;
  if (!echeance) return formule;

  // Comparaison en dates seules : une echeance au 21/09 doit rester
  // valable toute la journee du 21, pas expirer a minuit UTC.
  const aujourdhui = new Date().toISOString().slice(0, 10);
  return String(echeance).slice(0, 10) >= aujourdhui ? formule : FORMULE_PAR_DEFAUT;
}

const JOUR_MS = 24 * 60 * 60 * 1000;

/** Minuit d'une date ISO, en millisecondes. `null` si illisible. */
function jourEnMs(valeur) {
  if (!valeur) return null;
  const t = Date.parse(`${String(valeur).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(t) ? null : t;
}

/**
 * Jours restants avant l'echeance, l'echeance elle-meme comprise.
 *
 * 0 le dernier jour de validite — l'abonnement vaut encore. Negatif une
 * fois passe. `null` si l'abonnement n'a pas d'echeance, ce qui est le
 * cas de la formule gratuite et d'une activation manuelle sans date.
 *
 * La comparaison se fait de minuit a minuit en UTC : compter en heures
 * ferait expirer a midi un abonnement paye jusqu'au soir.
 */
export function joursRestants(organisation) {
  const fin = jourEnMs(organisation?.plan_expire_le);
  if (fin === null) return null;

  const aujourdhui = jourEnMs(new Date().toISOString());
  return Math.round((fin - aujourdhui) / JOUR_MS);
}

/**
 * Etat complet de l'abonnement, pret a afficher.
 *
 * `joursTotal` sert a remplir une jauge. Il se mesure de plan_debut a
 * plan_expire_le quand les deux sont connus ; sinon on retombe sur la
 * duree nominale de la periode, faute de quoi une activation manuelle
 * sans date de debut n'aurait pas de jauge du tout.
 */
export function etatAbonnement(organisation) {
  const restants = joursRestants(organisation);
  if (restants === null) return null;

  const debut = jourEnMs(organisation?.plan_debut);
  const fin = jourEnMs(organisation?.plan_expire_le);

  let joursTotal = debut !== null ? Math.round((fin - debut) / JOUR_MS) : null;
  if (!joursTotal || joursTotal <= 0) {
    joursTotal = organisation?.plan_periode === "annuel" ? 365 : 30;
  }

  return {
    periode: organisation?.plan_periode || null,
    debut: organisation?.plan_debut || null,
    expireLe: organisation?.plan_expire_le || null,
    joursRestants: restants,
    joursTotal,
    expire: restants < 0,
  };
}
