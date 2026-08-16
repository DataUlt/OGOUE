import { supabase } from "../db/supabase.js";
import { z } from "zod";

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
    const firstDay = new Date(year, month - 1, 1).toISOString().split("T")[0];
    const lastDay = new Date(year, month, 0).toISOString().split("T")[0];

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
    });
  } catch (error) {
    console.error("Erreur monthSummary:", error);
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}
