import { supabase } from "../db/supabase.js";
import { z } from "zod";
import { appliquerFenetre } from "../config/fenetre-historique.js";

const schema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

export async function monthSummary(req, res) {
  try {
    const parsed = schema.parse(req.query);
    const { month, year } = parsed;
    
    // Récupérer l'organizationId du JWT
    const organizationId = req.user.organizationId;

    // Plage de dates du mois demandé (filtrage fait par la DB, pas en JS)
    const premierJour = new Date(year, month - 1, 1).toISOString().split("T")[0];
    const lastDay = new Date(year, month, 0).toISOString().split("T")[0];

    // La fenêtre de consultation de la formule s'applique ici aussi.
    // Le résumé raisonne en mois plutôt qu'en plage, mais il lit les
    // mêmes tables : sans ce plancher, demander « janvier 2024 » sur la
    // formule gratuite renvoyait les totaux de janvier 2024, quand la
    // liste des ventes, elle, s'arrêtait à trois mois.
    const { startDate: firstDay, tronque } = appliquerFenetre(
      { startDate: premierJour, endDate: lastDay },
      req.droits?.historiqueMois
    );

    // Mois entièrement antérieur au plancher : il n'y a rien à montrer,
    // et le borner donnerait une plage inversée que la base accepterait
    // en renvoyant zéro — un zéro qu'on ne saurait pas lire.
    if (firstDay > lastDay) {
      return res.json({
        month, year,
        totalSales: 0, totalExpenses: 0, result: 0,
        salesCount: 0, expensesCount: 0,
        horsFenetre: true,
      });
    }

    // Récupérer ventes et dépenses en parallèle, déjà filtrées par période
    const [{ data: salesData, error: salesError }, { data: expensesData, error: expensesError }] =
      await Promise.all([
        supabase
          .from("sales")
          .select("amount")
          .eq("organization_id", organizationId)
          .gte("sale_date", firstDay)
          .lte("sale_date", lastDay),
        supabase
          .from("expenses")
          .select("amount")
          .eq("organization_id", organizationId)
          .gte("expense_date", firstDay)
          .lte("expense_date", lastDay),
      ]);

    if (salesError) {
      console.error("Erreur monthSummary (sales):", salesError);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (expensesError) {
      console.error("Erreur monthSummary (expenses):", expensesError);
      return res.status(500).json({ error: "Internal server error" });
    }

    const filteredSales = salesData || [];
    const filteredExpenses = expensesData || [];

    const totalSales = filteredSales.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

    return res.json({
      month,
      year,
      totalSales,
      totalExpenses,
      result: totalSales - totalExpenses,
      salesCount: filteredSales.length,
      expensesCount: filteredExpenses.length,
      // Mois partiellement couvert par la fenêtre de la formule : les
      // totaux sont justes pour ce qui est consultable, mais ils ne
      // valent pas pour le mois entier.
      tronque,
    });
  } catch (error) {
    console.error("Erreur monthSummary:", error);
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}
