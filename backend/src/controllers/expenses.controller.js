import { supabase } from "../db/supabase.js";
import { z } from "zod";
import { uploadFileToSupabase, deleteFileFromSupabase } from "../utils/supabase-storage.js";
import { logDeletion } from "../utils/deletion-audit.js";

const listSchema = z.object({
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

const createSchema = z.object({
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category: z.string().min(1).max(100),
  paymentMethod: z.string().max(50).optional().nullable(),
  amount: z.coerce.number().min(0),
  receiptName: z.string().max(200).optional().nullable(),
});

export async function listExpenses(req, res) {
  try {
    const parsed = listSchema.parse(req.query);
    const { month, year } = parsed;
    
    // Récupérer l'organizationId du JWT
    const organizationId = req.user.organizationId;

    const { data: rows, error } = await supabase
      .from("expenses")
      .select("id, expense_date, category, payment_method, amount, receipt_name, receipt_url, created_at")
      .eq("organization_id", organizationId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur listExpenses:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    // Filtrer par mois et année en JavaScript
    const transformedExpenses = (rows || [])
      .filter(row => {
        const date = new Date(row.expense_date);
        return date.getMonth() + 1 === month && date.getFullYear() === year;
      })
      .map(row => ({
        id: row.id,
        date: row.expense_date,
        categorie: row.category,
        moyen_paiement: row.payment_method,
        montant: row.amount,
        justificatif: row.receipt_name,
        justificatifUrl: row.receipt_url,
        created_at: row.created_at
      }));
    
    return res.json({ expenses: transformedExpenses });
  } catch (error) {
    console.error("Erreur listExpenses:", error);
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function createExpense(req, res) {
  try {
    const data = createSchema.parse(req.body);
    
    // Récupérer l'organizationId du JWT
    const organizationId = req.user.organizationId;

    let receiptUrl = null;
    let receiptStoragePath = null;
    let receiptName = data.receiptName || null;

    // Uploader le fichier s'il existe
    if (req.file) {
      try {
        const uploadResult = await uploadFileToSupabase(
          req.file.buffer,
          req.file.originalname,
          organizationId
        );
        receiptUrl = uploadResult.fileUrl;
        receiptStoragePath = uploadResult.storagePath;
        receiptName = uploadResult.fileName;
      } catch (uploadError) {
        console.error("❌ File upload failed:", uploadError?.message);
        return res.status(400).json({ error: "File upload failed", details: uploadError?.message });
      }
    }

    const { data: row, error } = await supabase
      .from("expenses")
      .insert({
        organization_id: organizationId,
        expense_date: data.expenseDate,
        category: data.category,
        payment_method: data.paymentMethod ?? null,
        amount: data.amount,
        receipt_name: receiptName,
        receipt_url: receiptUrl,
        receipt_storage_path: receiptStoragePath,
      })
      .select("id, expense_date, category, payment_method, amount, receipt_name, receipt_url, receipt_storage_path, created_at")
      .single();

    if (error || !row) {
      console.error("Erreur createExpense:", error);
      // Supprimer le fichier si l'insertion a échoué
      if (receiptStoragePath) {
        await deleteFileFromSupabase(receiptStoragePath);
      }
      return res.status(500).json({ error: "Internal server error" });
    }
    
    // Transformer snake_case → camelCase pour le frontend
    const transformed = {
      id: row.id,
      date: row.expense_date,
      categorie: row.category,
      moyen_paiement: row.payment_method,
      montant: row.amount,
      justificatif: row.receipt_name,
      justificatifUrl: row.receipt_url,
      created_at: row.created_at
    };
    
    return res.status(201).json(transformed);
  } catch (error) {
    console.error("Erreur createExpense:", error);
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateExpenseReceipt(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const receiptName = req.body.receiptName || (req.file?.originalname || null);

    if (!id) {
      return res.status(400).json({ error: "Expense ID is required" });
    }

    // Vérifier que la dépense appartient à l'organisation
    const { data: checkData, error: checkError } = await supabase
      .from("expenses")
      .select("id")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single();
    
    if (checkError || !checkData) {
      return res.status(404).json({ error: "Expense not found" });
    }

    // Mettre à jour le receipt_name
    const { data: row, error } = await supabase
      .from("expenses")
      .update({ receipt_name: receiptName })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .select("id, expense_date, category, payment_method, amount, receipt_name, created_at")
      .single();

    if (error || !row) {
      console.error("Erreur updateExpenseReceipt:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
    
    const transformed = {
      id: row.id,
      date: row.expense_date,
      categorie: row.category,
      moyen_paiement: row.payment_method,
      montant: row.amount,
      justificatif: row.receipt_name,
      created_at: row.created_at
    };

    return res.json(transformed);
  } catch (error) {
    console.error("Erreur updateExpenseReceipt:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteExpense(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const organizationId = req.user.organizationId;
    const userId = req.user.userId || req.user.sub;
    const agentId = req.user.agentId;
    const role = req.user.role;

    // Vérifier que le motif est fourni
    if (!reason || reason.trim().length === 0) {
      return res.status(400).json({ error: "Deletion reason is required" });
    }

    // Récupérer les infos de l'agent/utilisateur qui supprime
    let userFirstName = null;

    if (role === "agent" && agentId) {
      // Chercher dans la table agents (seulement first_name)
      const { data: agent } = await supabase
        .from("agents")
        .select("first_name")
        .eq("id", agentId)
        .maybeSingle();
      if (agent) {
        userFirstName = agent.first_name;
      }
    } else if (role === "manager" && userId) {
      // Chercher dans la table users
      const { data: user } = await supabase
        .from("users")
        .select("first_name, last_name")
        .eq("id", userId)
        .maybeSingle();
      if (user) {
        userFirstName = `${user.first_name} ${user.last_name}`;
      }
    }

    // Récupérer l'enregistrement avant suppression
    const { data: expense, error: fetchError } = await supabase
      .from("expenses")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single();

    if (fetchError || !expense) {
      console.error("Dépense non trouvée:", fetchError);
      return res.status(404).json({ error: "Expense not found" });
    }

    // Enregistrer la suppression dans l'audit
    try {
      await logDeletion({
        organizationId,
        userId,
        recordType: "expense",
        recordId: id,
        recordData: expense,
        reason: reason.trim(),
        userFirstName
      });
    } catch (auditError) {
      console.error("❌ Erreur audit:", auditError);
      return res.status(500).json({ error: "Failed to log deletion" });
    }

    // Supprimer le fichier de Supabase Storage s'il existe
    if (expense.receipt_storage_path) {
      try {
        await deleteFileFromSupabase(expense.receipt_storage_path);
      } catch (fileError) {
        console.error("Erreur suppression fichier:", fileError);
        // Continue même si la suppression du fichier échoue
      }
    }

    // Supprimer l'enregistrement de la base de données
    const { error: deleteError } = await supabase
      .from("expenses")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (deleteError) {
      console.error("Erreur deleteExpense:", deleteError);
      return res.status(500).json({ error: "Internal server error" });
    }

    return res.json({ message: "Expense deleted successfully" });
  } catch (error) {
    console.error("Erreur deleteExpense:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
