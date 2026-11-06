import { supabase } from "../db/supabase.js";
import { z } from "zod";
import { lireToutesLesLignes } from "../utils/pagination.js";
import { appliquerFenetre } from "../config/fenetre-historique.js";
import { lireCreditsOrganisation, creancesAu, reglementsPlafonnes } from "../utils/credits.js";

const plageSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/**
 * Lit les montants d'une table sur une plage, sans pagination perdue.
 * On ne selectionne que les colonnes utiles aux totaux : inutile de
 * transporter descriptions et justificatifs pour faire des sommes.
 */
async function lireMontants(table, colonneDate, colonnesSup, organizationId, debut, fin) {
  const construire = () => {
    let q = supabase
      .from(table)
      .select(`id, ${colonneDate}, amount, payment_method${colonnesSup}`)
      .eq("organization_id", organizationId);
    if (debut) q = q.gte(colonneDate, debut);
    if (fin) q = q.lte(colonneDate, fin);
    return q.order(colonneDate, { ascending: true }).order("id", { ascending: true });
  };
  return lireToutesLesLignes(construire);
}

function somme(lignes) {
  return lignes.reduce((total, l) => total + (Number(l.amount) || 0), 0);
}

/**
 * Crédits clients vus par la trésorerie.
 *
 * Une vente à crédit compte dans le chiffre d'affaires le jour de la vente
 * (compte de résultat). L'argent n'entre en caisse qu'avec les règlements :
 * avance à la vente, puis paiements, à leur date. On lit donc :
 *   - les règlements de la période ;
 *   - les créances en fin de période (vendu à crédit − réglé, à cette date).
 * Sans la migration sql/CREDITS_CLIENTS.sql, aucun règlement n'existe.
 */
async function lireCredits(organizationId, debut, fin) {
  const lu = await lireCreditsOrganisation(organizationId);
  if (lu.error) {
    // Migration absente : les ventes à crédit restent toutes dues
    const ventes = lu.migration ? (await lireCreditsVentesSeules(organizationId)) : [];
    return { regles: [], creances: creancesAu(fin, ventes, []) };
  }
  const debutMs = debut ? new Date(`${debut}T00:00:00+01:00`).getTime() : -Infinity;
  const finMs = fin ? new Date(`${fin}T23:59:59.999+01:00`).getTime() : Infinity;
  const regles = reglementsPlafonnes(lu.ventes, lu.reglements)
    .filter((r) => { const t = new Date(r.regle_le).getTime(); return t >= debutMs && t <= finMs; })
    .map((r) => ({ amount: r.montant, moyen: r.moyen }));
  return { regles, creances: creancesAu(fin, lu.ventes, lu.reglements) };
}

/**
 * Dépenses à crédit vues par la trésorerie : elles comptent dans les
 * charges à leur date d'achat (compte de résultat), mais l'argent ne sort
 * que le jour du paiement (credit_regle_le), où leur moyen de paiement
 * passe de « credit » à Cash ou Mobile Money. On lit donc toutes les
 * dépenses qui sont ou ont été à crédit :
 *   - celles payées pendant la période, à la date du paiement ;
 *   - celles encore dues en fin de période.
 * Sans sql/DEPENSES_CREDIT.sql, aucune n'a de date de paiement.
 */
async function lireDettesDepenses(organizationId, debut, fin) {
  const lu = await lireToutesLesLignes(() =>
    supabase.from("expenses").select("id, expense_date, amount, payment_method, credit_regle_le")
      .eq("organization_id", organizationId)
      .or("payment_method.eq.credit,credit_regle_le.not.is.null")
      .order("id", { ascending: true }));
  if (lu.error) {
    const seules = await lireToutesLesLignes(() =>
      supabase.from("expenses").select("id, expense_date, amount, payment_method")
        .eq("organization_id", organizationId).eq("payment_method", "credit").order("id", { ascending: true }));
    const toutes = seules.data || [];
    return {
      dejaCredit: new Set(),
      payees: [],
      dettes: somme(toutes.filter((x) => !fin || x.expense_date <= fin)),
      achats: (debutJ, finJ) => somme(toutes.filter((x) => (!debutJ || x.expense_date >= debutJ) && (!finJ || x.expense_date <= finJ))),
    };
  }
  const lignes = lu.data || [];
  const debutMs = debut ? new Date(`${debut}T00:00:00+01:00`).getTime() : -Infinity;
  const finMs = fin ? new Date(`${fin}T23:59:59.999+01:00`).getTime() : Infinity;
  const payeLe = (x) => (x.credit_regle_le ? new Date(x.credit_regle_le).getTime() : null);
  return {
    // Ces dépenses sortent de la trésorerie au paiement, pas à leur date
    dejaCredit: new Set(lignes.filter((x) => x.credit_regle_le).map((x) => x.id)),
    payees: lignes.filter((x) => { const t = payeLe(x); return t !== null && t >= debutMs && t <= finMs; }),
    dettes: somme(lignes.filter((x) => (!fin || x.expense_date <= fin) && (x.payment_method === "credit" || payeLe(x) > finMs))),
    achats: (debutJ, finJ) => somme(lignes.filter((x) => (!debutJ || x.expense_date >= debutJ) && (!finJ || x.expense_date <= finJ))),
  };
}

async function lireCreditsVentesSeules(organizationId) {
  const { data } = await lireToutesLesLignes(() =>
    supabase.from("sales").select("id, sale_date, amount, client_name")
      .eq("organization_id", organizationId).eq("payment_method", "credit").order("id", { ascending: true }));
  return data || [];
}

function grouper(lignes, cle, defaut) {
  const paquets = {};
  lignes.forEach((l) => {
    const k = l[cle] || defaut;
    paquets[k] = (paquets[k] || 0) + (Number(l.amount) || 0);
  });
  return paquets;
}

/**
 * GET /api/etats-financiers?startDate=&endDate=
 *
 * Compte de resultat et tableau de flux, calcules cote serveur.
 *
 * Le client garde evidemment acces a ses ventes et a ses depenses par
 * /api/sales et /api/expenses — ce sont ses donnees. Ce qui est reserve,
 * c'est le document fini.
 *
 * Les deux documents sortent du meme appel, parce que l'impression les
 * demande a la suite et qu'un cache par plage evite trois allers-retours.
 * Consequence : verrouiller la carte du compte de resultat dans la page
 * ne suffirait pas, ses montants voyageraient quand meme dans la reponse
 * et se liraient dans les outils de developpement. Le tri se fait donc
 * ici, sur req.droits, avant l'envoi.
 */
export async function getEtatsFinanciers(req, res) {
  try {
    const demande = plageSchema.parse(req.query);
    const organizationId = req.user.organizationId;

    // La fenêtre de consultation de la formule s'applique ici aussi.
    // Elle ne l'était que sur /api/sales et /api/expenses : la page
    // d'analyse financière, ouverte à la formule gratuite depuis qu'elle
    // donne le tableau de flux, offrait donc une porte latérale vers
    // l'historique complet — il suffisait d'y choisir une période
    // ancienne. Le plancher se pose avant la requête, pas après.
    const { startDate, endDate, tronque } = appliquerFenetre(
      demande,
      req.droits?.historiqueMois
    );

    const [ventesRes, depensesRes] = await Promise.all([
      lireMontants("sales", "sale_date", "", organizationId, startDate, endDate),
      lireMontants("expenses", "expense_date", ", category", organizationId, startDate, endDate),
    ]);

    if (ventesRes.error || depensesRes.error) {
      console.error("Erreur etatsFinanciers:", ventesRes.error || depensesRes.error);
      return res.status(500).json({ error: "Internal server error" });
    }

    const ventes = ventesRes.data || [];
    const depenses = depensesRes.data || [];

    const totalVentes = somme(ventes);
    const depensesByCategory = grouper(depenses, "category", "Autres");
    const totalDepenses = somme(depenses);

    const reponse = {
      // La période renvoyée est celle réellement appliquée, et non celle
      // demandée : un document daté d'une plage qu'il ne couvre pas
      // serait un faux, et le client pourrait le présenter comme tel.
      periode: {
        startDate: startDate || null,
        endDate: endDate || null,
        tronque,
        demande: tronque ? { startDate: demande.startDate || null } : undefined,
      },
      // Ce que la formule ouvre, pour que la page sache quoi cadenasser
      // sans avoir a redemander /api/plan.
      autorise: {
        compteResultat: !!req.droits?.compteResultat,
        tableauFlux: !!req.droits?.tableauFlux,
      },
    };

    if (req.droits?.compteResultat) {
      reponse.compteResultat = {
        totalVentes,
        depensesByCategory,
        totalDepenses,
        resultat: totalVentes - totalDepenses,
      };
    }

    if (req.droits?.tableauFlux) {
      // L'argent réellement entré : ventes payées sur le moment, plus les
      // crédits que les clients ont réglés pendant la période
      const ventesEncaissees = ventes.filter((v) => v.payment_method !== "credit");
      const credits = await lireCredits(organizationId, startDate, endDate);
      const creditsEncaisses = somme(credits.regles);
      const fluxEntrants = somme(ventesEncaissees) + creditsEncaisses;
      // L'argent réellement sorti : dépenses payées sur le moment, plus les
      // dépenses à crédit payées pendant la période (à la date du paiement)
      const dettes = await lireDettesDepenses(organizationId, startDate, endDate);
      const depensesPayees = depenses.filter((d) => d.payment_method !== "credit" && !dettes.dejaCredit.has(d.id));
      const fluxSortants = somme(depensesPayees) + somme(dettes.payees);
      reponse.tableauFlux = {
        fluxEntrants,
        fluxSortants,
        fluxNet: fluxEntrants - fluxSortants,
        ventesByPayment: grouper(ventesEncaissees, "payment_method", "cash"),
        depensesByPayment: grouper(depensesPayees, "payment_method", "cash"),
        // Dépenses à crédit : payées pendant la période (par moyen), achetées
        // à crédit pendant la période, et ce qui reste dû à la fin
        dettesPayeesByPayment: grouper(dettes.payees, "payment_method", "cash"),
        achatsACredit: dettes.achats(startDate, endDate),
        dettesFinPeriode: dettes.dettes,
        // Crédits clients : encaissés pendant la période (par moyen), vendus
        // à crédit pendant la période, et ce qui reste dû à la fin
        creditsEncaisses,
        creditsEncaissesByPayment: grouper(credits.regles, "moyen", "cash"),
        ventesACredit: somme(ventes.filter((v) => v.payment_method === "credit")),
        creancesFinPeriode: credits.creances,
      };
    }

    return res.json(reponse);
  } catch (error) {
    console.error("Erreur etatsFinanciers:", error);
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}
