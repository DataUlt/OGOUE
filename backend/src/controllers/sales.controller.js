import { supabase } from "../db/supabase.js";
import { z } from "zod";

const listSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

const createSchema = z.object({
  saleDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(200),
  saleType: z.string().max(50).optional().nullable(),
  paymentMethod: z.string().max(50).optional().nullable(),
  quantity: z.coerce.number().positive().default(1),
  amount: z.coerce.number().min(0),
  receiptName: z.string().max(200).optional().nullable(),
});

export async function listSales(req, res) {
  try {
    const parsed = listSchema.parse(req.query);
    const { month, year } = parsed;
    
    // Récupérer l'organizationId du JWT
    const organizationId = req.user.organizationId;

    // Récupérer les ventes avec Supabase
    const { data: rows, error } = await supabase
      .from("sales")
      .select("id, sale_date, description, sale_type, payment_method, quantity, amount, receipt_name, created_at")
      .eq("organization_id", organizationId)
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur listSales:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    // Filtrer par mois et année en JavaScript
    const transformedSales = (rows || [])
      .filter(row => {
        const date = new Date(row.sale_date);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      })
      .map(row => ({
        id: row.id,
        date: row.sale_date,
        description: row.description,
        type_vente: row.sale_type,
        moyen_paiement: row.payment_method,
        quantite: row.quantity,
        montant: row.amount,
        justificatif: row.receipt_name,
        created_at: row.created_at
      }));
    
    return res.json({ sales: transformedSales });
  } catch (error) {
    console.error("Erreur listSales:", error);
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function createSale(req, res) {
  try {
    const data = createSchema.parse(req.body);
    
    // Récupérer l'organizationId du JWT
    const organizationId = req.user.organizationId;

    const { data: row, error } = await supabase
      .from("sales")
      .insert({
        organization_id: organizationId,
        sale_date: data.saleDate,
        description: data.description,
        sale_type: data.saleType ?? null,
        payment_method: data.paymentMethod ?? null,
        quantity: data.quantity,
        amount: data.amount,
        receipt_name: data.receiptName ?? null,
      })
      .select("id, sale_date, description, sale_type, payment_method, quantity, amount, receipt_name, created_at")
      .single();

    if (error || !row) {
      console.error("Erreur createSale:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
    
    // Transformer snake_case → camelCase pour le frontend
    const transformed = {
      id: row.id,
      date: row.sale_date,
      description: row.description,
      type_vente: row.sale_type,
      moyen_paiement: row.payment_method,
      quantite: row.quantity,
      montant: row.amount,
      justificatif: row.receipt_name,
      created_at: row.created_at
    };
    
    return res.status(201).json(transformed);
  } catch (error) {
    console.error("Erreur createSale:", error);
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateSaleReceipt(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const receiptName = req.body.receiptName || (req.file?.originalname || null);

    if (!id) {
      return res.status(400).json({ error: "Sale ID is required" });
    }

    // Vérifier que la vente appartient à l'organisation
    const { data: checkData, error: checkError } = await supabase
      .from("sales")
      .select("id")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single();
    
    if (checkError || !checkData) {
      return res.status(404).json({ error: "Sale not found" });
    }

    // Mettre à jour le receipt_name
    const { data: row, error } = await supabase
      .from("sales")
      .update({ receipt_name: receiptName })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("id, sale_date, description, sale_type, payment_method, quantity, amount, receipt_name, created_at")
      .single();

    if (error || !row) {
      console.error("Erreur updateSaleReceipt:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
    
    const transformed = {
      id: row.id,
      date: row.sale_date,
      description: row.description,
      type_vente: row.sale_type,
      moyen_paiement: row.payment_method,
      quantite: row.quantity,
      montant: row.amount,
      justificatif: row.receipt_name,
      created_at: row.created_at
    };

    return res.json(transformed);
  } catch (error) {
    console.error("Erreur updateSaleReceipt:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
