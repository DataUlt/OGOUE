import { supabase } from "../db/supabase.js";
import { z } from "zod";
import { codeAleatoire } from "../config/secrets.js";

/**
 * Génère un code d'accès pour un agent. Format : XXX-XXX-XXX.
 *
 * Ce code est un identifiant de connexion à part entière : il ouvre
 * l'accès aux ventes et aux dépenses de l'entreprise. Il était tiré avec
 * Math.random(), dont l'état interne se reconstitue à partir de quelques
 * tirages — connaître deux ou trois codes émis permettait de prédire les
 * suivants. Il vient désormais de crypto (voir config/secrets.js).
 */
function generateAccessCode() {
  const brut = codeAleatoire(9);
  return `${brut.slice(0, 3)}-${brut.slice(3, 6)}-${brut.slice(6, 9)}`;
}

const createAgentSchema = z.object({
  firstName: z.string().min(2).max(100),
});

/**
 * Créer un nouvel agent
 */
export async function createAgent(req, res) {
  try {
    const parsed = createAgentSchema.parse(req.body);
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(400).json({ error: "Organization ID missing" });
    }

    // Plafond d'agents de la formule. `null` vaut illimité, `0` interdit
    // la fonction : on compte l'existant avant d'en créer un de plus,
    // sinon un gérant pourrait dépasser en enchaînant les créations.
    const agentsMax = req.droits?.agentsMax;
    if (agentsMax !== null && agentsMax !== undefined) {
      const { count, error: erreurComptage } = await supabase
        .from("agents")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId);

      if (erreurComptage) {
        console.error("Erreur comptage agents:", erreurComptage);
        return res.status(500).json({ error: "Internal server error" });
      }

      if ((count || 0) >= agentsMax) {
        return res.status(402).json({
          error: agentsMax === 0
            ? "La gestion des agents n'est pas incluse dans votre formule."
            : `Votre formule permet ${agentsMax} agents, vous les avez tous créés.`,
          code: "formule_insuffisante",
          fonction: "agents",
          formuleActuelle: req.formule,
          limite: agentsMax,
        });
      }
    }

    // Générer un code d'accès unique
    let accessCode = generateAccessCode();
    let codeExists = true;
    let attempts = 0;

    // S'assurer que le code est unique
    while (codeExists && attempts < 10) {
      const { data: existing } = await supabase
        .from("agents")
        .select("id")
        .eq("access_code", accessCode)
        .single();

      if (!existing) {
        codeExists = false;
      } else {
        accessCode = generateAccessCode();
        attempts++;
      }
    }

    if (codeExists) {
      return res.status(500).json({ error: "Failed to generate unique access code" });
    }

    // Créer l'agent
    const { data: agent, error } = await supabase
      .from("agents")
      .insert({
        organization_id: organizationId,
        first_name: parsed.firstName,
        access_code: accessCode,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error("Erreur createAgent:", error);
      return res.status(500).json({ error: "Failed to create agent" });
    }

    return res.json({
      id: agent.id,
      firstName: agent.first_name,
      accessCode: agent.access_code,
      isActive: agent.is_active,
      createdAt: agent.created_at,
    });
  } catch (error) {
    console.error("Erreur createAgent:", error);
    return res.status(400).json({ error: error.message });
  }
}

/**
 * Lister tous les agents d'une organisation
 */
export async function listAgents(req, res) {
  try {
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(400).json({ error: "Organization ID missing" });
    }

    const { data: agents, error } = await supabase
      .from("agents")
      .select("id, first_name, access_code, is_active, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erreur listAgents:", error);
      return res.status(500).json({ error: "Failed to list agents" });
    }

    const transformed = agents.map((agent) => ({
      id: agent.id,
      firstName: agent.first_name,
      accessCode: agent.access_code,
      isActive: agent.is_active,
      createdAt: agent.created_at,
    }));

    return res.json(transformed);
  } catch (error) {
    console.error("Erreur listAgents:", error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Désactiver/Supprimer un agent
 */
export async function deleteAgent(req, res) {
  try {
    const { id } = req.params;
    const organizationId = req.user.organizationId;

    if (!organizationId) {
      return res.status(400).json({ error: "Organization ID missing" });
    }

    // Vérifier que l'agent appartient à cette organisation
    const { data: agent, error: fetchError } = await supabase
      .from("agents")
      .select("organization_id")
      .eq("id", id)
      .single();

    if (fetchError || !agent || agent.organization_id !== organizationId) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Supprimer l'agent
    const { error: deleteError } = await supabase
      .from("agents")
      .delete()
      .eq("id", id);

    if (deleteError) {
      console.error("Erreur deleteAgent:", deleteError);
      return res.status(500).json({ error: "Failed to delete agent" });
    }

    return res.json({ message: "Agent deleted successfully" });
  } catch (error) {
    console.error("Erreur deleteAgent:", error);
    return res.status(500).json({ error: error.message });
  }
}

/**
 * Authentifier un agent via access code
 * (Utilisé lors de l'enregistrement ou connexion avec code)
 */
export async function authenticateAgentByCode(req, res) {
  try {
    const { accessCode } = req.body;

    if (!accessCode) {
      return res.status(400).json({ error: "Access code required" });
    }

    const { data: agent, error } = await supabase
      .from("agents")
      .select("id, organization_id, first_name, is_active")
      .eq("access_code", accessCode)
      .single();

    if (error || !agent) {
      return res.status(401).json({ error: "Invalid access code" });
    }

    if (!agent.is_active) {
      return res.status(403).json({ error: "This agent account has been deactivated" });
    }

    // Retourner les infos de l'agent
    return res.json({
      agentId: agent.id,
      organizationId: agent.organization_id,
      firstName: agent.first_name,
      accessCode: accessCode,
    });
  } catch (error) {
    console.error("Erreur authenticateAgentByCode:", error);
    return res.status(500).json({ error: error.message });
  }
}
