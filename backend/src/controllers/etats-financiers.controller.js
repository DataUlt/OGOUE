import { supabase } from "../db/supabase.js";
import { z } from "zod";
import { lireToutesLesLignes } from "../utils/pagination.js";
import { appliquerFenetre } from "../config/fenetre-historique.js";

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
      reponse.tableauFlux = {
        fluxEntrants: totalVentes,
        fluxSortants: totalDepenses,
        fluxNet: totalVentes - totalDepenses,
        ventesByPayment: grouper(ventes, "payment_method", "cash"),
        depensesByPayment: grouper(depenses, "payment_method", "cash"),
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
