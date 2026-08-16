import { supabase } from "../db/supabase.js";
import { z } from "zod";

// ============================================================
// Catalogue d'articles / services d'une organisation
// ------------------------------------------------------------
// Le catalogue est partage par toute l'organisation : c'est ce qui
// harmonise les libelles entre le gerant et ses agents.
// ============================================================

const createSchema = z.object({
  name: z.string().trim().min(1).max(200),
  type: z.enum(["produits", "services"]).default("produits"),
  unitPrice: z.coerce.number().min(0).default(0),
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  type: z.enum(["produits", "services"]).optional(),
  unitPrice: z.coerce.number().min(0).optional(),
});

// Plusieurs articles d'un coup, pour l'etape de configuration
// qui suit la creation du compte.
const bulkSchema = z.object({
  articles: z.array(createSchema).min(1).max(100),
});

function transform(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    unitPrice: Number(row.unit_price) || 0,
    createdAt: row.created_at,
  };
}

/** Code Postgres renvoye quand l'index unique (organisation, nom) est viole. */
const UNIQUE_VIOLATION = "23505";

export async function listArticles(req, res) {
  try {
    const organizationId = req.user.organizationId;

    const { data, error } = await supabase
      .from("articles")
      .select("id, name, type, unit_price, created_at")
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .order("name", { ascending: true });

    if (error) {
      console.error("Erreur listArticles:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    return res.json({ articles: (data || []).map(transform) });
  } catch (error) {
    console.error("Erreur listArticles:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function createArticle(req, res) {
  try {
    const data = createSchema.parse(req.body);
    const organizationId = req.user.organizationId;

    // Sans organisation resolue, l'insertion echouerait avec une erreur
    // Postgres peu lisible : on le dit explicitement.
    if (!organizationId) {
      console.error("createArticle : organizationId absent pour", req.user);
      return res.status(400).json({ error: "Organisation introuvable pour cet utilisateur" });
    }

    const { data: row, error } = await supabase
      .from("articles")
      .insert({
        organization_id: organizationId,
        name: data.name,
        type: data.type,
        unit_price: data.unitPrice,
        created_by: req.user.userId || req.user.sub || req.user.id,
      })
      .select("id, name, type, unit_price, created_at")
      .single();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return res.status(409).json({ error: "Un article portant ce nom existe déjà" });
      }
      console.error("Erreur createArticle:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        organizationId,
        createdBy: req.user.userId || req.user.sub || req.user.id,
      });
      return res.status(500).json({ error: "Internal server error" });
    }

    return res.status(201).json(transform(row));
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Erreur createArticle:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Creation en lot, utilisee par l'etape de configuration.
 * Les doublons sont ignores plutot que de faire echouer tout le lot :
 * l'utilisateur qui saisit deux fois le meme nom ne doit pas perdre
 * le reste de sa saisie.
 */
export async function createArticlesBulk(req, res) {
  try {
    const { articles } = bulkSchema.parse(req.body);
    const organizationId = req.user.organizationId;
    const createdBy = req.user.userId || req.user.sub || req.user.id;

    // Dedoublonnage a l'interieur du lot lui-meme (insensible a la casse)
    const seen = new Set();
    const rows = [];
    for (const a of articles) {
      const key = a.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        organization_id: organizationId,
        name: a.name,
        type: a.type,
        unit_price: a.unitPrice,
        created_by: createdBy,
      });
    }

    const created = [];
    const ignored = [];

    // Insertion ligne par ligne : un nom deja present dans le catalogue
    // ne doit pas annuler les autres.
    for (const row of rows) {
      const { data, error } = await supabase
        .from("articles")
        .insert(row)
        .select("id, name, type, unit_price, created_at")
        .single();

      if (error) {
        if (error.code === UNIQUE_VIOLATION) {
          ignored.push(row.name);
          continue;
        }
        console.error("Erreur createArticlesBulk:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
      created.push(transform(data));
    }

    return res.status(201).json({ created, ignored });
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Erreur createArticlesBulk:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateArticle(req, res) {
  try {
    const { id } = req.params;
    const data = updateSchema.parse(req.body);
    const organizationId = req.user.organizationId;

    const payload = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) payload.name = data.name;
    if (data.type !== undefined) payload.type = data.type;
    if (data.unitPrice !== undefined) payload.unit_price = data.unitPrice;

    const { data: row, error } = await supabase
      .from("articles")
      .update(payload)
      .eq("id", id)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .select("id, name, type, unit_price, created_at")
      .maybeSingle();

    if (error) {
      if (error.code === UNIQUE_VIOLATION) {
        return res.status(409).json({ error: "Un article portant ce nom existe déjà" });
      }
      console.error("Erreur updateArticle:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (!row) {
      return res.status(404).json({ error: "Article introuvable" });
    }

    return res.json(transform(row));
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: error.issues });
    }
    console.error("Erreur updateArticle:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * Suppression logique : les ventes deja enregistrees conservent le
 * libelle saisi a l'epoque, on ne veut donc pas casser l'historique.
 */
export async function deleteArticle(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    const { data: row, error } = await supabase
      .from("articles")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("organization_id", organizationId)
      .eq("is_active", true)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Erreur deleteArticle:", error);
      return res.status(500).json({ error: "Internal server error" });
    }

    if (!row) {
      return res.status(404).json({ error: "Article introuvable" });
    }

    return res.json({ message: "Article supprimé du catalogue" });
  } catch (error) {
    console.error("Erreur deleteArticle:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
