import { supabaseSecondary } from "../db/supabase.js";
import { z } from "zod";

// ============================================================
// Financement : offre de credit et dossiers des PME
// ------------------------------------------------------------
// Tout vit dans la base SECONDAIRE (PFE-OGOUE-FINANCEMENT) :
// les institutions y decrivent leurs produits, les PME y deposent
// leurs dossiers. Le lien entre les deux bases est l'identifiant
// utilisateur, identique de part et d'autre (voir syncToSecondarySupabase).
// ============================================================

/** Statuts possibles d'un dossier, dans l'ordre du parcours. */
const STATUTS = ["brouillon", "depose", "en_examen", "complement_requis", "accepte", "refuse"];

/** Statuts encore modifiables par la PME. */
const STATUTS_MODIFIABLES = ["brouillon", "complement_requis"];

function secondaryIndisponible(res) {
  return res.status(503).json({ error: "Base de financement non configurée" });
}

/**
 * Retrouve la PME correspondant a l'utilisateur connecte.
 * `users.id` est partage entre les deux bases, et `pmes.user_id`
 * pointe dessus.
 */
async function getPmeForUser(req) {
  const userId = req.user.userId || req.user.sub || req.user.id;
  if (!userId) return { pme: null, error: "Utilisateur non identifié" };

  const { data, error } = await supabaseSecondary
    .from("pmes")
    .select("id, company_name, rccm_number, nif_number, sector")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Erreur getPmeForUser:", error);
    return { pme: null, error: "Erreur lors de la récupération de la PME" };
  }
  if (!data) {
    return { pme: null, error: "Aucun profil PME n'est associé à ce compte" };
  }
  return { pme: data, error: null };
}

// ────────────────────────────────────────────────────────────
// Offre de credit
// ────────────────────────────────────────────────────────────

/**
 * GET /api/financing/products
 * Credits proposes par les institutions partenaires.
 */
export async function listProducts(req, res) {
  try {
    if (!supabaseSecondary) return secondaryIndisponible(res);

    const { data, error } = await supabaseSecondary
      .from("credit_products")
      .select(`
        id, name, objective, amount_min, amount_max,
        duration_min_months, duration_max_months,
        interest_type, typology, target, institution_id,
        institutions ( id, name, institution_type, logo_url, website )
      `)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Erreur listProducts:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    const products = (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      objective: p.objective,
      amountMin: Number(p.amount_min) || 0,
      amountMax: Number(p.amount_max) || 0,
      durationMinMonths: p.duration_min_months,
      durationMaxMonths: p.duration_max_months,
      interestType: p.interest_type,
      typology: p.typology,
      target: p.target,
      institution: p.institutions
        ? {
            id: p.institutions.id,
            name: p.institutions.name,
            type: p.institutions.institution_type,
            logoUrl: p.institutions.logo_url,
            website: p.institutions.website,
          }
        : null,
    }));

    return res.json({ products });
  } catch (error) {
    console.error("Erreur listProducts:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/financing/products/:id
 * Detail d'un produit et pieces exigees pour constituer le dossier.
 */
export async function getProduct(req, res) {
  try {
    if (!supabaseSecondary) return secondaryIndisponible(res);
    const { id } = req.params;

    const { data: product, error } = await supabaseSecondary
      .from("credit_products")
      .select(`
        id, name, objective, amount_min, amount_max,
        duration_min_months, duration_max_months,
        interest_type, typology, target, institution_id, is_active,
        institutions ( id, name, institution_type, logo_url, website )
      `)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      console.error("Erreur getProduct:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
    if (!product || !product.is_active) {
      return res.status(404).json({ error: "Produit introuvable" });
    }

    const { data: docs, error: docsError } = await supabaseSecondary
      .from("product_required_documents")
      .select("id, name")
      .eq("credit_product_id", id)
      .order("name", { ascending: true });

    if (docsError) {
      console.error("Erreur getProduct (documents):", docsError);
      return res.status(500).json({ error: "Internal server error" });
    }

    return res.json({
      id: product.id,
      name: product.name,
      objective: product.objective,
      amountMin: Number(product.amount_min) || 0,
      amountMax: Number(product.amount_max) || 0,
      durationMinMonths: product.duration_min_months,
      durationMaxMonths: product.duration_max_months,
      interestType: product.interest_type,
      typology: product.typology,
      target: product.target,
      institution: product.institutions
        ? {
            id: product.institutions.id,
            name: product.institutions.name,
            type: product.institutions.institution_type,
            logoUrl: product.institutions.logo_url,
            website: product.institutions.website,
          }
        : null,
      requiredDocuments: (docs || []).map((d) => ({ id: d.id, name: d.name })),
    });
  } catch (error) {
    console.error("Erreur getProduct:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// ────────────────────────────────────────────────────────────
// Dossiers
// ────────────────────────────────────────────────────────────

const createApplicationSchema = z.object({
  creditProductId: z.string().uuid(),
  amountRequested: z.coerce.number().min(0).optional(),
  durationMonths: z.coerce.number().int().min(1).optional(),
  purpose: z.string().max(2000).optional(),
});

const updateApplicationSchema = z.object({
  amountRequested: z.coerce.number().min(0).optional(),
  durationMonths: z.coerce.number().int().min(1).optional(),
  purpose: z.string().max(2000).optional(),
});

function transformApplication(row) {
  return {
    id: row.id,
    status: row.status,
    amountRequested: row.amount_requested === null ? null : Number(row.amount_requested),
    durationMonths: row.duration_months,
    purpose: row.purpose,
    submittedAt: row.submitted_at,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    product: row.credit_products
      ? {
          id: row.credit_products.id,
          name: row.credit_products.name,
          amountMin: Number(row.credit_products.amount_min) || 0,
          amountMax: Number(row.credit_products.amount_max) || 0,
          durationMinMonths: row.credit_products.duration_min_months,
          durationMaxMonths: row.credit_products.duration_max_months,
        }
      : null,
    institution: row.institutions
      ? { id: row.institutions.id, name: row.institutions.name, logoUrl: row.institutions.logo_url }
      : null,
  };
}

const SELECT_APPLICATION = `
  id, status, amount_requested, duration_months, purpose,
  submitted_at, decided_at, decision_note, created_at,
  credit_products ( id, name, amount_min, amount_max, duration_min_months, duration_max_months ),
  institutions ( id, name, logo_url )
`;

/** GET /api/financing/applications — dossiers de la PME connectee */
export async function listApplications(req, res) {
  try {
    if (!supabaseSecondary) return secondaryIndisponible(res);

    const { pme, error: pmeError } = await getPmeForUser(req);
    if (!pme) return res.status(404).json({ error: pmeError });

    const { data, error } = await supabaseSecondary
      .from("loan_applications")
      .select(SELECT_APPLICATION)
      .eq("pme_id", pme.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur listApplications:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    return res.json({ applications: (data || []).map(transformApplication) });
  } catch (error) {
    console.error("Erreur listApplications:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** GET /api/financing/applications/:id — detail, pieces et historique */
export async function getApplication(req, res) {
  try {
    if (!supabaseSecondary) return secondaryIndisponible(res);
    const { id } = req.params;

    const { pme, error: pmeError } = await getPmeForUser(req);
    if (!pme) return res.status(404).json({ error: pmeError });

    const { data: application, error } = await supabaseSecondary
      .from("loan_applications")
      .select(SELECT_APPLICATION)
      .eq("id", id)
      .eq("pme_id", pme.id)
      .maybeSingle();

    if (error) {
      console.error("Erreur getApplication:", error);
      return res.status(500).json({ error: "Internal server error" });
    }
    if (!application) return res.status(404).json({ error: "Dossier introuvable" });

    const [{ data: docs }, { data: history }] = await Promise.all([
      supabaseSecondary
        .from("application_documents")
        .select("id, name, file_url, required_document_id, uploaded_at")
        .eq("application_id", id)
        .order("uploaded_at", { ascending: true }),
      supabaseSecondary
        .from("application_status_history")
        .select("status, note, changed_by, created_at")
        .eq("application_id", id)
        .order("created_at", { ascending: true }),
    ]);

    return res.json({
      ...transformApplication(application),
      documents: (docs || []).map((d) => ({
        id: d.id,
        name: d.name,
        fileUrl: d.file_url,
        requiredDocumentId: d.required_document_id,
        uploadedAt: d.uploaded_at,
      })),
      history: (history || []).map((h) => ({
        status: h.status,
        note: h.note,
        changedBy: h.changed_by,
        at: h.created_at,
      })),
    });
  } catch (error) {
    console.error("Erreur getApplication:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** POST /api/financing/applications — ouvre un dossier en brouillon */
export async function createApplication(req, res) {
  try {
    if (!supabaseSecondary) return secondaryIndisponible(res);
    const data = createApplicationSchema.parse(req.body);

    const { pme, error: pmeError } = await getPmeForUser(req);
    if (!pme) return res.status(404).json({ error: pmeError });

    // L'institution est deduite du produit : la PME ne la choisit pas.
    const { data: product, error: productError } = await supabaseSecondary
      .from("credit_products")
      .select("id, institution_id, is_active, amount_min, amount_max")
      .eq("id", data.creditProductId)
      .maybeSingle();

    if (productError) {
      console.error("Erreur createApplication (produit):", productError);
      return res.status(500).json({ error: "Internal server error" });
    }
    if (!product || !product.is_active) {
      return res.status(404).json({ error: "Produit de crédit introuvable" });
    }

    const { data: row, error } = await supabaseSecondary
      .from("loan_applications")
      .insert({
        pme_id: pme.id,
        credit_product_id: product.id,
        institution_id: product.institution_id,
        status: "brouillon",
        amount_requested: data.amountRequested ?? null,
        duration_months: data.durationMonths ?? null,
        purpose: data.purpose ?? null,
      })
      .select(SELECT_APPLICATION)
      .single();

    if (error) {
      // Index unique : un dossier est deja ouvert sur ce produit
      if (error.code === "23505") {
        return res.status(409).json({
          error: "Un dossier est déjà en cours pour ce produit de crédit",
        });
      }
      console.error("Erreur createApplication:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    await supabaseSecondary.from("application_status_history").insert({
      application_id: row.id,
      status: "brouillon",
      note: "Dossier créé",
      changed_by: "pme",
    });

    return res.status(201).json(transformApplication(row));
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Erreur createApplication:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/** PUT /api/financing/applications/:id — modifie un dossier encore ouvert */
export async function updateApplication(req, res) {
  try {
    if (!supabaseSecondary) return secondaryIndisponible(res);
    const { id } = req.params;
    const data = updateApplicationSchema.parse(req.body);

    const { pme, error: pmeError } = await getPmeForUser(req);
    if (!pme) return res.status(404).json({ error: pmeError });

    const { data: existing } = await supabaseSecondary
      .from("loan_applications")
      .select("id, status")
      .eq("id", id)
      .eq("pme_id", pme.id)
      .maybeSingle();

    if (!existing) return res.status(404).json({ error: "Dossier introuvable" });

    // Une fois chez l'institution, le dossier n'est plus modifiable
    if (!STATUTS_MODIFIABLES.includes(existing.status)) {
      return res.status(409).json({
        error: "Ce dossier a été déposé et ne peut plus être modifié",
      });
    }

    const payload = { updated_at: new Date().toISOString() };
    if (data.amountRequested !== undefined) payload.amount_requested = data.amountRequested;
    if (data.durationMonths !== undefined) payload.duration_months = data.durationMonths;
    if (data.purpose !== undefined) payload.purpose = data.purpose;

    const { data: row, error } = await supabaseSecondary
      .from("loan_applications")
      .update(payload)
      .eq("id", id)
      .eq("pme_id", pme.id)
      .select(SELECT_APPLICATION)
      .single();

    if (error) {
      console.error("Erreur updateApplication:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    return res.json(transformApplication(row));
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Erreur updateApplication:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * POST /api/financing/applications/:id/submit
 * Depose le dossier aupres de l'institution. Toutes les pieces
 * exigees par le produit doivent avoir ete fournies.
 */
export async function submitApplication(req, res) {
  try {
    if (!supabaseSecondary) return secondaryIndisponible(res);
    const { id } = req.params;

    const { pme, error: pmeError } = await getPmeForUser(req);
    if (!pme) return res.status(404).json({ error: pmeError });

    const { data: application } = await supabaseSecondary
      .from("loan_applications")
      .select("id, status, credit_product_id, amount_requested")
      .eq("id", id)
      .eq("pme_id", pme.id)
      .maybeSingle();

    if (!application) return res.status(404).json({ error: "Dossier introuvable" });
    if (!STATUTS_MODIFIABLES.includes(application.status)) {
      return res.status(409).json({ error: "Ce dossier a déjà été déposé" });
    }
    if (application.amount_requested === null) {
      return res.status(400).json({ error: "Le montant demandé est obligatoire" });
    }

    // Verifier que chaque piece exigee a bien ete fournie
    const [{ data: required }, { data: fournis }] = await Promise.all([
      supabaseSecondary
        .from("product_required_documents")
        .select("id, name")
        .eq("credit_product_id", application.credit_product_id),
      supabaseSecondary
        .from("application_documents")
        .select("required_document_id")
        .eq("application_id", id),
    ]);

    const fournisIds = new Set((fournis || []).map((d) => d.required_document_id).filter(Boolean));
    const manquants = (required || []).filter((r) => !fournisIds.has(r.id));

    if (manquants.length > 0) {
      return res.status(400).json({
        error: "Des pièces justificatives sont manquantes",
        missing: manquants.map((m) => ({ id: m.id, name: m.name })),
      });
    }

    const now = new Date().toISOString();
    const { data: row, error } = await supabaseSecondary
      .from("loan_applications")
      .update({ status: "depose", submitted_at: now, updated_at: now })
      .eq("id", id)
      .eq("pme_id", pme.id)
      .select(SELECT_APPLICATION)
      .single();

    if (error) {
      console.error("Erreur submitApplication:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    await supabaseSecondary.from("application_status_history").insert({
      application_id: id,
      status: "depose",
      note: "Dossier déposé auprès de l'institution",
      changed_by: "pme",
    });

    return res.json(transformApplication(row));
  } catch (error) {
    console.error("Erreur submitApplication:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
