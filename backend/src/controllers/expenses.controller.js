import { supabase } from "../db/supabase.js";
import { z } from "zod";
import { uploadFileToSupabase, deleteFileFromSupabase } from "../utils/supabase-storage.js";
import { logDeletion } from "../utils/deletion-audit.js";

const listSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
    let { month, year, startDate, endDate } = parsed;
    
    // Récupérer l'organizationId du JWT
    const organizationId = req.user.organizationId;

    const { data: rows, error } = await supabase
      .from("expenses")
      .select("id, expense_date, category, payment_method, amount, receipt_name, receipt_url, created_at, created_by")
      .eq("organization_id", organizationId)
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur listExpenses:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    // Enrichir avec les noms des créateurs
    let enrichedRows = rows || [];
    
    if (enrichedRows.length > 0) {
      try {
        // Récupérer les IDs uniques de créateurs
        const createdByIds = [...new Set(enrichedRows.map(r => r.created_by).filter(Boolean))];
        
        if (createdByIds.length > 0) {
          // Récupérer les agents et managers
          const [{ data: agents }, { data: users }] = await Promise.all([
            supabase.from("agents").select("id, first_name").in("id", createdByIds),
            supabase.from("users").select("id, first_name").in("id", createdByIds)
          ]);
          
          const agentMap = {};
          const userMap = {};
          
          (agents || []).forEach(a => { agentMap[a.id] = a.first_name; });
          (users || []).forEach(u => { userMap[u.id] = u.first_name; });
          
          // Ajouter le created_by_name à chaque ligne
          enrichedRows = enrichedRows.map(row => {
            let createdByName = "-";
            if (row.created_by) {
              if (agentMap[row.created_by]) {
                createdByName = agentMap[row.created_by];
              } else if (userMap[row.created_by]) {
                createdByName = "Gérant";
              }
            }
            return { ...row, created_by_name: createdByName };
          });
        } else {
          enrichedRows = enrichedRows.map(row => ({ ...row, created_by_name: "-" }));
        }
      } catch (enrichError) {
        console.error("❌ Erreur enrichissement expenses:", enrichError);
        enrichedRows = enrichedRows.map(row => ({ ...row, created_by_name: "-" }));
      }
    }

    console.log(`📊 listExpenses: ${enrichedRows.length} dépenses brutes, filtre: ${startDate && endDate ? `du ${startDate} au ${endDate}` : `mois=${month}, année=${year}`}`);

    // Déterminer les dates de filtrage
    let finalStartDate, finalEndDate;
    if (startDate && endDate) {
      finalStartDate = startDate;
      finalEndDate = endDate;
    } else if (month && year) {
      // Créer une plage pour le mois/année
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      finalStartDate = firstDay.toISOString().split('T')[0];
      finalEndDate = lastDay.toISOString().split('T')[0];
    } else {
      // Si rien n'est fourni, retourner toutes les dépenses
      const transformedExpenses = enrichedRows.map(row => ({
        id: row.id,
        date: row.expense_date,
        categorie: row.category,
        moyen_paiement: row.payment_method,
        montant: row.amount,
        justificatif: row.receipt_name,
        justificatifUrl: row.receipt_url,
        created_at: row.created_at,
        created_by_name: row.created_by_name
      }));
      return res.json({ expenses: transformedExpenses });
    }

    // Filtrer par plage de dates
    const transformedExpenses = enrichedRows
      .filter(row => {
        const datePart = row.expense_date.split('T')[0];
        const isInRange = datePart >= finalStartDate && datePart <= finalEndDate;
        return isInRange;
      })
      .map(row => {
        return {
          id: row.id,
          date: row.expense_date,
          categorie: row.category,
          moyen_paiement: row.payment_method,
          montant: row.amount,
          justificatif: row.receipt_name,
          justificatifUrl: row.receipt_url,
          created_at: row.created_at,
          created_by_name: row.created_by_name
        };
      });
    
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
        created_by: req.user.userId || req.user.sub || req.user.id,
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
