import { supabase } from "../db/supabase.js";
import {
  droitsDe,
  formuleActive,
  etatAbonnement,
  FORMULE_PAR_DEFAUT,
} from "../config/plans.js";

/**
 * Retombe pour de bon sur la formule gratuite, en base.
 *
 * formuleActive() suffisait deja a fermer les fonctions a l'echeance :
 * les droits etaient justes, mais la ligne continuait d'afficher
 * 'pro' avec une date passee. Deux verites pour une meme
 * organisation, dont une seule est appliquee — et la table, elle, est ce
 * qu'on lit quand un client appelle. On ecrit donc la retombee.
 *
 * L'ecriture n'a lieu qu'une fois : la condition porte sur le plan
 * encore inscrit, qui vaut 'essentiel' juste apres. Un echec n'interrompt
 * rien, les droits etant deja ceux de la formule gratuite.
 */
async function enregistrerExpiration(organizationId, ancienne, expireLe) {
  const trace = `Formule ${ancienne} expirée le ${String(expireLe).slice(0, 10)}, `
    + `retour automatique à ${FORMULE_PAR_DEFAUT}`;

  const { error } = await supabase
    .from("organizations")
    .update({
      plan: FORMULE_PAR_DEFAUT,
      plan_periode: null,
      plan_debut: null,
      plan_expire_le: null,
      plan_note: trace,
    })
    .eq("id", organizationId);

  if (error) {
    console.error("⚠️  Expiration non enregistrée:", error.message);
  } else {
    console.log(`ℹ️  ${organizationId} : ${trace}`);
  }
}

/**
 * Attache a la requete la formule de l'organisation et ses droits.
 *
 * Place apres authMiddleware, qui a deja resolu req.user.organizationId.
 * L'agent herite de la formule de son organisation : c'est le gerant qui
 * paie, pas lui.
 */
export async function planMiddleware(req, res, next) {
  const organizationId = req.user?.organizationId;

  if (!organizationId) {
    req.formule = FORMULE_PAR_DEFAUT;
    req.droits = droitsDe(FORMULE_PAR_DEFAUT);
    req.abonnement = null;
    return next();
  }

  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("plan, plan_periode, plan_debut, plan_expire_le")
      .eq("id", organizationId)
      .maybeSingle();

    if (error) {
      // La colonne peut ne pas exister si ABONNEMENTS.sql n'a pas encore
      // ete execute. On le signale bruyamment, mais on n'interrompt pas
      // le service : l'organisation est traitee comme gratuite.
      console.error("⚠️  Lecture de la formule impossible:", error.message);
      req.formule = FORMULE_PAR_DEFAUT;
      req.droits = droitsDe(FORMULE_PAR_DEFAUT);
      req.abonnement = null;
      return next();
    }

    req.formule = formuleActive(data);
    req.droits = droitsDe(req.formule);

    // Echeance depassee : les droits sont deja retombes, on aligne la
    // base dans la foulee et on n'affiche plus de compte a rebours.
    const perime = data?.plan
      && data.plan !== FORMULE_PAR_DEFAUT
      && req.formule === FORMULE_PAR_DEFAUT;

    if (perime) {
      await enregistrerExpiration(organizationId, data.plan, data.plan_expire_le);
      req.abonnement = null;
    } else {
      req.abonnement = etatAbonnement(data);
    }

    return next();
  } catch (err) {
    console.error("⚠️  planMiddleware:", err?.message || err);
    req.formule = FORMULE_PAR_DEFAUT;
    req.droits = droitsDe(FORMULE_PAR_DEFAUT);
    req.abonnement = null;
    return next();
  }
}

/**
 * Barre une route reservee a une fonction que la formule n'ouvre pas.
 *
 * @param {string} fonction - cle booleenne de config/plans.js
 * @param {string} libelle  - nom lisible, repris dans le message
 *
 * Le 402 est volontaire : ce n'est ni un defaut d'authentification (401)
 * ni un interdit definitif (403), mais une fonction que le client peut
 * debloquer. Le frontend s'en sert pour proposer la bonne formule.
 */
export function exigerFonction(fonction, libelle) {
  return function (req, res, next) {
    if (req.droits?.[fonction]) return next();

    return res.status(402).json({
      error: `${libelle} n'est pas inclus dans votre formule ${req.droits?.nom || "actuelle"}.`,
      code: "formule_insuffisante",
      fonction,
      formuleActuelle: req.formule,
    });
  };
}
