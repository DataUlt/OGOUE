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

    // Récupérer les ventes
    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("amount, sale_date")
      .eq("organization_id", organizationId);

    if (salesError) {
      console.error("Erreur monthSummary (sales):", salesError);
      return res.status(500).json({ error: "Internal server error" });
    }

    // Récupérer les dépenses
    const { data: expensesData, error: expensesError } = await supabase
      .from("expenses")
      .select("amount, expense_date")
      .eq("organization_id", organizationId);

    if (expensesError) {
      console.error("Erreur monthSummary (expenses):", expensesError);
      return res.status(500).json({ error: "Internal server error" });
    }

    // Filtrer par mois et année en JavaScript
    const filteredSales = (salesData || []).filter(item => {
      const date = new Date(item.sale_date);
      return date.getMonth() + 1 === month && date.getFullYear() === year;
    });

    const filteredExpenses = (expensesData || []).filter(item => {
      const date = new Date(item.expense_date);
      return date.getMonth() + 1 === month && date.getFullYear() === year;
    });

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
