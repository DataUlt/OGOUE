import { supabase } from "../db/supabase.js";
import { z } from "zod";
import { uploadFileToSupabase, deleteFileFromSupabase } from "../utils/supabase-storage.js";
import { emettreRecu, urlSigneeRecu } from "../utils/recu-vente.js";
import { logDeletion } from "../utils/deletion-audit.js";

const listSchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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
    let { month, year, startDate, endDate } = parsed;

    // Récupérer l'organizationId du JWT
    const organizationId = req.user.organizationId;

    // Déterminer la plage de dates à filtrer (avant la requête, pour filtrer côté DB)
    let finalStartDate, finalEndDate;
    if (startDate && endDate) {
      finalStartDate = startDate;
      finalEndDate = endDate;
    } else if (month && year) {
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month, 0);
      finalStartDate = firstDay.toISOString().split('T')[0];
      finalEndDate = lastDay.toISOString().split('T')[0];
    }

    // Récupérer les ventes avec Supabase (filtrées par période côté DB si fournie)
    let query = supabase
      .from("sales")
      .select("id, sale_date, description, sale_type, payment_method, quantity, amount, receipt_name, receipt_url, receipt_number, created_at, created_by")
      .eq("organization_id", organizationId);

    if (finalStartDate && finalEndDate) {
      query = query.gte("sale_date", finalStartDate).lte("sale_date", finalEndDate);
    }

    const { data: rows, error } = await query
      .order("sale_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur listSales:", error);
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
        console.error("❌ Erreur enrichissement sales:", enrichError);
        enrichedRows = enrichedRows.map(row => ({ ...row, created_by_name: "-" }));
      }
    }

    console.log(`📊 listSales: ${enrichedRows.length} ventes retournées, filtre: ${finalStartDate && finalEndDate ? `du ${finalStartDate} au ${finalEndDate}` : "aucun (toutes)"}`);

    // Le filtrage par période a déjà été appliqué au niveau de la requête DB
    const transformedSales = enrichedRows.map(row => ({
      id: row.id,
      date: row.sale_date,
      description: row.description,
      type_vente: row.sale_type,
      moyen_paiement: row.payment_method,
      quantite: row.quantity,
      montant: row.amount,
      justificatif: row.receipt_name,
      justificatifUrl: row.receipt_url,
      // Le reçu émis par OGOUE : on n'expose que son numéro, le PDF
      // se demande à la pièce via /sales/:id/recu (lien signé).
      numeroRecu: row.receipt_number,
      created_at: row.created_at,
      created_by_name: row.created_by_name
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

/**
 * GET /api/sales/:id/recu
 * Lien de telechargement du recu, valable quelques minutes. Le bucket
 * etant prive, c'est le seul acces possible, et il exige que la vente
 * appartienne bien a l'organisation de l'appelant.
 */
export async function getSaleRecuUrl(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const { data: vente } = await supabase
      .from("sales")
      .select("id, receipt_number, receipt_doc_path")
      .eq("id", id)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (!vente) return res.status(404).json({ error: "Vente introuvable" });
    if (!vente.receipt_doc_path) {
      return res.status(404).json({ error: "Aucun reçu n'a été émis pour cette vente" });
    }

    const url = await urlSigneeRecu(vente.receipt_doc_path);
    if (!url) return res.status(500).json({ error: "Lien de téléchargement indisponible" });

    return res.json({ url, numero: vente.receipt_number });
  } catch (error) {
    console.error("Erreur getSaleRecuUrl:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Emet le recu d'une vente et l'attache a la ligne.
 *
 * Ne propage aucune erreur : l'echec du document ne doit jamais
 * invalider une vente deja enregistree. Le reçu pourra etre reemis.
 */
async function emettreRecuPourVente(row, organizationId, req) {
  try {
    const { data: organisation } = await supabase
      .from("organizations")
      .select("id, name, rccm_number, nif_number, activity")
      .eq("id", organizationId)
      .single();

    if (!organisation) {
      console.warn("⚠️  Organisation introuvable, reçu non émis");
      return null;
    }

    const recu = await emettreRecu({
      vente: row,
      organisation,
      emisPar: req.user.role === "agent" ? "Agent" : "Gérant",
    });
    if (!recu) return null;

    const { error } = await supabase
      .from("sales")
      .update({ receipt_number: recu.numero, receipt_doc_path: recu.chemin })
      .eq("id", row.id);

    if (error) {
      console.error("⚠️  Reçu émis mais non rattaché à la vente:", error.message);
      return null;
    }

    return recu;
  } catch (error) {
    console.error("⚠️  Émission du reçu impossible:", error?.message);
    return null;
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
        created_by: req.user.userId || req.user.sub || req.user.id,
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

    // Émettre le reçu de la vente.
    // Volontairement APRÈS l'insertion et sans jamais la remettre en
    // cause : une vente enregistrée doit le rester, même si la
    // production du document échoue. Le reçu se régénère à la demande.
    const recu = await emettreRecuPourVente(row, organizationId, req);

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
      numeroRecu: recu?.numero || null,
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
