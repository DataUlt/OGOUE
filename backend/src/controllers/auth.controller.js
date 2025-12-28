import { supabase } from "../db/supabase.js";
import { z } from "zod";

const registerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(6),
  organizationName: z.string().min(1).max(200),
  rccmNumber: z.string().optional().nullable(),
  nifNumber: z.string().optional().nullable(),
  activity: z.string().optional().nullable(),
  activityDescription: z.string().optional().nullable(),
  role: z.enum(["manager", "agent"]).default("manager"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * POST /auth/register
 * Crée une nouvelle organisation, un utilisateur Supabase Auth et un record dans users
 */
export async function register(req, res) {
  try {
    const parsed = registerSchema.parse(req.body);

    // 1️⃣ Créer l'utilisateur dans Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password,
      email_confirm: true, // Auto-confirmer l'email (optionnel)
    });

    if (authError || !authData.user) {
      console.error("Auth error:", authError);
      return res.status(400).json({ error: authError?.message || "Erreur lors de la création du compte" });
    }

    const authUserId = authData.user.id;

    // 2️⃣ Créer l'organisation
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: parsed.organizationName,
        rccm_number: parsed.rccmNumber || null,
        nif_number: parsed.nifNumber || null,
        activity: parsed.activity || null,
        activity_description: parsed.activityDescription || null,
      })
      .select("id, name, created_at")
      .single();

    if (orgError || !orgData) {
      console.error("Organization error:", orgError);
      // Supprimer l'utilisateur Auth si la création de l'organisation échoue
      await supabase.auth.admin.deleteUser(authUserId);
      return res.status(500).json({ error: "Erreur lors de la création de l'organisation" });
    }

    // 3️⃣ Créer le record utilisateur dans users
    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert({
        auth_id: authUserId,
        first_name: parsed.firstName,
        last_name: parsed.lastName,
        email: parsed.email,
        role: parsed.role,
        organization_id: orgData.id,
      })
      .select("id, first_name, last_name, email, role, organization_id, created_at")
      .single();

    if (userError || !userData) {
      console.error("User record error:", userError);
      // Supprimer l'utilisateur Auth et l'organisation si ça échoue
      await supabase.auth.admin.deleteUser(authUserId);
      await supabase.from("organizations").delete().eq("id", orgData.id);
      return res.status(500).json({ error: "Erreur lors de la création du profil utilisateur" });
    }

    // 4️⃣ Créer une session en loggant avec l'email et password
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password
    });

    if (sessionError || !sessionData.session) {
      console.error("Session error:", sessionError);
      return res.status(500).json({ error: "Erreur lors de la création de la session" });
    }

    return res.status(201).json({
      message: "Inscription réussie",
      token: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
      user: {
        id: userData.id,
        firstName: userData.first_name,
        lastName: userData.last_name,
        email: userData.email,
        role: userData.role,
        organizationId: userData.organization_id,
      },
      organization: {
        id: orgData.id,
        name: orgData.name,
      },
    });
  } catch (err) {
    console.error("Register error:", err?.message || err);
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: err.issues });
    }
    return res.status(500).json({ error: err?.message || "Erreur lors de l'inscription" });
  }
}

/**
 * POST /auth/login
 * Authentifie un utilisateur et retourne un JWT
 */
export async function login(req, res) {
  try {
    const parsed = loginSchema.parse(req.body);

    // Authentifier avec Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });

    if (authError || !authData.session) {
      console.error("Auth error:", authError);
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    // Récupérer les infos utilisateur depuis users
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, first_name, last_name, email, role, organization_id")
      .eq("auth_id", authData.user.id)
      .maybeSingle();

    if (userError || !userData) {
      console.error("User record error:", userError);
      return res.status(500).json({ error: "Erreur lors de la récupération du profil utilisateur" });
    }

    return res.json({
      message: "Connexion réussie",
      token: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      user: {
        id: userData.id,
        firstName: userData.first_name,
        lastName: userData.last_name,
        email: userData.email,
        role: userData.role,
        organizationId: userData.organization_id,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: err.issues });
    }
    return res.status(500).json({ error: "Erreur lors de la connexion" });
  }
}

/**
 * GET /auth/me
 * Retourne les infos de l'utilisateur connecté (nécessite JWT valide)
 */
export async function getMe(req, res) {
  try {
    const authId = req.user?.sub; // Supabase met l'ID dans 'sub'
    if (!authId) {
      return res.status(401).json({ error: "Non authentifié" });
    }

    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, first_name, last_name, email, role, organization_id, created_at")
      .eq("auth_id", authId)
      .maybeSingle();

    if (userError || !userData) {
      console.error("User record error:", userError);
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    return res.json({
      user: {
        id: userData.id,
        firstName: userData.first_name,
        lastName: userData.last_name,
        email: userData.email,
        role: userData.role,
        organizationId: userData.organization_id,
      },
    });
  } catch (err) {
    console.error("GetMe error:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
}

/**
 * POST /auth/agent-register
 * Enregistre un nouvel agent via un code d'accès
 */
export async function registerAgent(req, res) {
  try {
    const agentRegisterSchema = z.object({
      accessCode: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
    });

    const parsed = agentRegisterSchema.parse(req.body);

    // 1️⃣ Vérifier que le code d'accès est valide et actif
    const { data: agentRecord, error: agentError } = await supabase
      .from("agents")
      .select("id, organization_id, first_name, is_active")
      .eq("access_code", parsed.accessCode)
      .eq("is_active", true)
      .single();

    if (agentError || !agentRecord) {
      console.error("Agent code invalid:", agentError);
      return res.status(401).json({ error: "Code d'accès invalide ou désactivé" });
    }

    // 2️⃣ Créer l'utilisateur dans Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      console.error("Auth error:", authError);
      return res.status(400).json({ error: authError?.message || "Erreur lors de la création du compte" });
    }

    const authUserId = authData.user.id;

    // 3️⃣ Créer le record utilisateur dans users avec le rôle 'agent'
    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert({
        auth_id: authUserId,
        first_name: parsed.firstName,
        last_name: parsed.lastName,
        email: parsed.email,
        role: "agent", // Les agents ont toujours le rôle 'agent'
        organization_id: agentRecord.organization_id,
      })
      .select("id, first_name, last_name, email, role, organization_id, created_at")
      .single();

    if (userError || !userData) {
      console.error("User record error:", userError);
      // Supprimer l'utilisateur Auth si ça échoue
      await supabase.auth.admin.deleteUser(authUserId);
      return res.status(500).json({ error: "Erreur lors de la création du compte" });
    }

    // 4️⃣ Générer un token JWT
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.createSession(authUserId);
    if (sessionError || !sessionData.session) {
      console.error("Session error:", sessionError);
      return res.status(500).json({ error: "Erreur lors de la création de la session" });
    }

    return res.status(201).json({
      message: "Agent enregistré avec succès",
      user: {
        id: userData.id,
        firstName: userData.first_name,
        lastName: userData.last_name,
        email: userData.email,
        role: userData.role,
        organizationId: userData.organization_id,
      },
      token: sessionData.session.access_token,
    });
  } catch (err) {
    console.error("Register agent error:", err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.issues });
    }
    return res.status(500).json({ error: "Erreur lors de l'enregistrement" });
  }
}

/**
 * POST /auth/agent-login
 * Permet à un agent de se connecter via code d'accès (sans email/password)
 */
export async function loginAgent(req, res) {
  try {
    const agentLoginSchema = z.object({
      accessCode: z.string().min(1),
    });

    const parsed = agentLoginSchema.parse(req.body);

    // Vérifier que le code d'accès est valide et actif
    const { data: agentRecord, error: agentError } = await supabase
      .from("agents")
      .select("id, organization_id, is_active")
      .eq("access_code", parsed.accessCode)
      .eq("is_active", true)
      .single();

    if (agentError || !agentRecord) {
      console.error("Agent code invalid:", agentError);
      return res.status(401).json({ error: "Code d'accès invalide ou désactivé" });
    }

    // Retourner les infos de l'agent
    return res.json({
      agentId: agentRecord.id,
      organizationId: agentRecord.organization_id,
      message: "Code valide. Procédez à l'enregistrement ou la connexion.",
    });
  } catch (err) {
    console.error("Login agent error:", err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.issues });
    }
    return res.status(500).json({ error: "Erreur lors de la connexion" });
  }
}
