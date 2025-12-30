import { supabase } from "../db/supabase.js";
import { z } from "zod";
import { uploadFileToSupabase, deleteFileFromSupabase } from "../utils/supabase-storage.js";
import { logDeletion } from "../utils/deletion-audit.js";

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
      .select("id, sale_date, description, sale_type, payment_method, quantity, amount, receipt_name, receipt_url, created_at, created_by")
      .eq("organization_id", organizationId)
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur listSales:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    // Filtrer par mois et année en JavaScript
    const transformedSales = await Promise.all(
      (rows || [])
        .filter(row => {
          const date = new Date(row.sale_date);
          return date.getMonth() + 1 === month && date.getFullYear() === year;
        })
        .map(async (row) => {
          // Récupérer le prénom de l'agent
          let agentName = "-";
          if (row.created_by) {
            // Chercher dans agents
            const { data: agent } = await supabase
              .from("agents")
              .select("first_name")
              .eq("user_id", row.created_by)
              .maybeSingle();
            
            if (agent) {
              agentName = agent.first_name || "-";
            } else {
              // Chercher dans users
              const { data: user } = await supabase
                .from("users")
                .select("first_name")
                .eq("id", row.created_by)
                .maybeSingle();
              
              if (user) {
                agentName = user.first_name || "-";
              }
            }
          }

          return {
            id: row.id,
            date: row.sale_date,
            description: row.description,
            type_vente: row.sale_type,
            moyen_paiement: row.payment_method,
            quantite: row.quantity,
            montant: row.amount,
            justificatif: row.receipt_name,
            justificatifUrl: row.receipt_url,
            created_at: row.created_at,
            agent_name: agentName
          };
        })
    );
    
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
      .from("sales")
      .insert({
        organization_id: organizationId,
        sale_date: data.saleDate,
        description: data.description,
        sale_type: data.saleType ?? null,
        payment_method: data.paymentMethod ?? null,
        quantity: data.quantity,
        amount: data.amount,
        receipt_name: receiptName,
        receipt_url: receiptUrl,
        receipt_storage_path: receiptStoragePath,
      })
      .select("id, sale_date, description, sale_type, payment_method, quantity, amount, receipt_name, receipt_url, receipt_storage_path, created_at")
      .single();

    if (error || !row) {
      console.error("Erreur createSale:", error);
      // Supprimer le fichier si l'insertion a échoué
      if (receiptStoragePath) {
        await deleteFileFromSupabase(receiptStoragePath);
      }
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
      justificatifUrl: row.receipt_url,
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

export async function deleteSale(req, res) {
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
    const { data: sale, error: fetchError } = await supabase
      .from("sales")
      .select("*")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .single();

    if (fetchError || !sale) {
      console.error("Vente non trouvée:", fetchError);
      return res.status(404).json({ error: "Sale not found" });
    }

    // Enregistrer la suppression dans l'audit
    try {
      await logDeletion({
        organizationId,
        userId,
        recordType: "sale",
        recordId: id,
        recordData: sale,
        reason: reason.trim(),
        userFirstName
      });
    } catch (auditError) {
      console.error("❌ Erreur audit:", auditError);
      return res.status(500).json({ error: "Failed to log deletion" });
    }

    // Supprimer le fichier de Supabase Storage s'il existe
    if (sale.receipt_storage_path) {
      try {
        await deleteFileFromSupabase(sale.receipt_storage_path);
      } catch (fileError) {
        console.error("Erreur suppression fichier:", fileError);
        // Continue même si la suppression du fichier échoue
      }
    }

    // Supprimer l'enregistrement de la base de données
    const { error: deleteError } = await supabase
      .from("sales")
      .delete()
      .eq("id", id)
      .eq("organization_id", organizationId);

    if (deleteError) {
      console.error("Erreur deleteSale:", deleteError);
      return res.status(500).json({ error: "Internal server error" });
    }

    return res.json({ message: "Sale deleted successfully" });
  } catch (error) {
    console.error("Erreur deleteSale:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
