import { supabase, supabaseSecondary } from "../db/supabase.js";
import { z } from "zod";
import jwt from "jsonwebtoken";

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
 * Helper: Sync user and organization to secondary Supabase with real Auth
 * PRIMARY schema → SECONDARY schema mapping:
 * - PRIMARY: users (first_name, last_name, email, auth_id) → SECONDARY: users (full_name, email, auth_id, role)
 * - PRIMARY: organizations → SECONDARY: pmes (linked via user_id)
 */
async function syncToSecondarySupabase(email, password, orgData, userData) {
  if (!supabaseSecondary) {
    console.warn("⚠️  Secondary Supabase not configured, skipping sync");
    return { success: false, reason: "Secondary Supabase not configured" };
  }

  try {
    console.log("🔄 Syncing to secondary Supabase...");
    
    // 1️⃣ Create user in secondary Supabase Auth
    console.log("➡️ Creating auth user in secondary database...");
    const { data: secondaryAuthData, error: secondaryAuthError } = await supabaseSecondary.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    });

    if (secondaryAuthError || !secondaryAuthData.user) {
      console.error("❌ Secondary auth error:", secondaryAuthError);
      return { success: false, reason: "Secondary auth creation failed", error: secondaryAuthError };
    }

    const secondaryAuthUserId = secondaryAuthData.user.id;
    console.log("✅ Secondary auth user created:", secondaryAuthUserId);

    // 2️⃣ Create user record in secondary 'users' table
    const fullName = `${userData.first_name} ${userData.last_name}`;
    const secondaryRole = userData.role === 'manager' ? 'pme' : 'pme';
    
    console.log("➡️ Inserting into secondary users table:", {
      id: userData.id,
      email: userData.email,
      auth_id: secondaryAuthUserId,
      role: secondaryRole,
      full_name: fullName,
      is_active: true,
      created_at: userData.created_at,
    });
    
    const { data: secondaryUserData, error: secondaryUserError } = await supabaseSecondary
      .from("users")
      .insert({
        id: userData.id,
        email: userData.email,
        auth_id: secondaryAuthUserId, // Link to secondary Auth
        role: secondaryRole,
        full_name: fullName,
        is_active: true,
        created_at: userData.created_at,
      })
      .select("id")
      .single();

    if (secondaryUserError) {
      console.error("❌ Secondary user sync error:", {
        message: secondaryUserError.message,
        code: secondaryUserError.code,
        details: secondaryUserError.details,
      });
      // Try to rollback auth user
      await supabaseSecondary.auth.admin.deleteUser(secondaryAuthUserId).catch(err => 
        console.error("Rollback auth user failed:", err)
      );
      return { success: false, reason: "User sync failed", error: secondaryUserError };
    }

    console.log("✅ User synced to secondary Supabase:", secondaryUserData.id);

    // 3️⃣ Create PME in secondary 'pmes' table
    console.log("➡️ Inserting into secondary pmes table:", {
      user_id: secondaryUserData.id,
      company_name: orgData.name,
      rccm_number: orgData.rccm_number || null,
      nif_number: orgData.nif_number || null,
      sector: orgData.activity || null,
      activity_description: orgData.activity_description || null,
    });

    const { data: secondaryPmeData, error: secondaryPmeError } = await supabaseSecondary
      .from("pmes")
      .insert({
        user_id: secondaryUserData.id,
        company_name: orgData.name,
        rccm_number: orgData.rccm_number || null,
        nif_number: orgData.nif_number || null,
        sector: orgData.activity || null,
        activity_description: orgData.activity_description || null,
        created_at: orgData.created_at,
      })
      .select("id")
      .single();

    if (secondaryPmeError) {
      console.error("❌ Secondary pmes sync error:", {
        message: secondaryPmeError.message,
        code: secondaryPmeError.code,
        details: secondaryPmeError.details,
      });
      // Try to rollback user and auth
      await supabaseSecondary
        .from("users")
        .delete()
        .eq("id", secondaryUserData.id)
        .catch(err => console.error("Rollback user sync failed:", err));
      await supabaseSecondary.auth.admin.deleteUser(secondaryAuthUserId).catch(err => 
        console.error("Rollback auth user failed:", err)
      );
      return { success: false, reason: "PME sync failed", error: secondaryPmeError };
    }

    console.log("✅ PME synced to secondary Supabase:", secondaryPmeData.id);
    console.log("✅ Successfully synced to secondary Supabase (auth + users + pmes)");
    return { success: true, secondaryAuthUserId };
  } catch (error) {
    console.error("❌ Sync to secondary Supabase exception:", {
      message: error?.message,
      stack: error?.stack,
      name: error?.name,
    });
    return { success: false, reason: "Sync exception", error };
  }
}

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
    console.log("➡️ Attempting to insert organization into table 'organizations':", parsed.organizationName);
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: parsed.organizationName,
        rccm_number: parsed.rccmNumber || null,
        nif_number: parsed.nifNumber || null,
        activity: parsed.activity || null,
        activity_description: parsed.activityDescription || null,
      })
      .select("id, name, rccm_number, nif_number, activity, activity_description, created_at")
      .single();

    if (orgError || !orgData) {
      console.error("❌ Organization error:", {
        message: orgError?.message,
        code: orgError?.code,
        details: orgError?.details,
        hint: orgError?.hint
      });
      // Supprimer l'utilisateur Auth si la création de l'organisation échoue
      await supabase.auth.admin.deleteUser(authUserId);
      return res.status(500).json({ 
        error: "Erreur lors de la création de l'organisation",
        details: orgError?.message 
      });
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

    // 3️⃣ Sync to secondary Supabase (optional, non-blocking)
    const syncResult = await syncToSecondarySupabase(parsed.email, parsed.password, orgData, userData);
    if (!syncResult.success) {
      console.warn("⚠️  Sync failed but continuing:", syncResult.reason);
      // Don't fail registration if sync fails - it can be retried later
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
      sync: {
        primary: true,
        secondary: syncResult.success,
        message: syncResult.success 
          ? "User and organization created in both Supabase instances" 
          : `Created in primary Supabase only. Secondary sync: ${syncResult.reason}`
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
    
    // DEBUG: Log received code
    console.log("🔍 [DEBUG] Received accessCode:", JSON.stringify(parsed.accessCode));
    console.log("🔍 [DEBUG] Code length:", parsed.accessCode.length);
    console.log("🔍 [DEBUG] Code charCodes:", [...parsed.accessCode].map(c => c.charCodeAt(0)));

    // Vérifier que le code d'accès est valide et actif
    const { data: agentRecord, error: agentError } = await supabase
      .from("agents")
      .select("id, organization_id, first_name, is_active, access_code")
      .eq("access_code", parsed.accessCode)
      .eq("is_active", true)
      .single();

    if (agentError || !agentRecord) {
      console.error("❌ [DEBUG] Agent code invalid. Error:", agentError);
      
      // Additional debug: try to get ALL agents to compare
      const { data: allAgents, error: allError } = await supabase
        .from("agents")
        .select("id, access_code, is_active");
      
      console.log("📋 [DEBUG] All agents in DB:", allAgents?.map(a => ({
        id: a.id,
        code: a.access_code,
        active: a.is_active,
        received: parsed.accessCode,
        match: a.access_code === parsed.accessCode
      })));
      
      return res.status(401).json({ error: "Code d'accès invalide ou désactivé" });
    }

    // Récupérer les informations de l'organisation
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .select("id, name, rccm_number, nif_number")
      .eq("id", agentRecord.organization_id)
      .single();

    // Créer un JWT manuelement avec les données de l'agent
    const token = jwt.sign(
      {
        sub: agentRecord.id,
        agentId: agentRecord.id,
        role: "agent",
        organizationId: agentRecord.organization_id,
      },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "24h" }
    );

    console.log("✅ [DEBUG] Agent login successful:", {
      id: agentRecord.id,
      name: agentRecord.first_name,
      code: agentRecord.access_code
    });

    // Retourner le token et les infos utilisateur
    return res.json({
      token,
      user: {
        id: agentRecord.id,
        firstName: agentRecord.first_name,
        role: "agent",
        organizationId: agentRecord.organization_id,
        organization_name: orgData?.name || '',
      },
      organization: {
        id: agentRecord.organization_id,
        name: orgData?.name || '',
        rccm: orgData?.rccm_number || '',
        nif: orgData?.nif_number || '',
      },
    });
  } catch (err) {
    console.error("Login agent error:", err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.issues });
    }
    return res.status(500).json({ error: "Erreur lors de la connexion" });
  }
}

/**
 * POST /auth/forgot-password
 * Envoie un lien de réinitialisation de mot de passe via Supabase
 */
export async function forgotPassword(req, res) {
  try {
    const forgotPasswordSchema = z.object({
      email: z.string().email(),
    });

    const parsed = forgotPasswordSchema.parse(req.body);

    // Supabase gère automatiquement l'envoi d'email de réinitialisation
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.email, {
      redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password.html`,
    });

    if (error) {
      console.error("Password reset error:", error);
      // Ne pas révéler si l'email existe ou non (sécurité)
      return res.status(200).json({ 
        message: "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation" 
      });
    }

    return res.status(200).json({ 
      message: "Un email de réinitialisation a été envoyé" 
    });
  } catch (err) {
    console.error("Forgot password error:", err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.issues });
    }
    return res.status(500).json({ error: "Erreur lors de la réinitialisation du mot de passe" });
  }
}

/**
 * POST /auth/reset-password
 * Réinitialise le mot de passe avec le token de réinitialisation Supabase
 */
export async function resetPassword(req, res) {
  try {
    const resetPasswordSchema = z.object({
      password: z.string().min(6),
    });

    const parsed = resetPasswordSchema.parse(req.body);
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(400).json({ error: "Token manquant" });
    }

    // Utiliser le token pour mettre à jour le mot de passe
    const { error } = await supabase.auth.updateUser({ 
      password: parsed.password 
    }, {
      // Set the user session with the token
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (error) {
      console.error("Reset password error:", error);
      return res.status(400).json({ error: error.message || "Erreur lors de la réinitialisation" });
    }

    return res.status(200).json({ 
      message: "Mot de passe réinitialisé avec succès" 
    });
  } catch (err) {
    console.error("Reset password error:", err);
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Validation error", details: err.issues });
    }
    return res.status(500).json({ error: "Erreur lors de la réinitialisation du mot de passe" });
  }
}

/**
 * POST /auth-secondary/login
 * Authentifie un utilisateur sur la base de données secondaire
 */
export async function loginSecondary(req, res) {
  try {
    const parsed = loginSchema.parse(req.body);

    if (!supabaseSecondary) {
      return res.status(503).json({ error: "Secondary database not configured" });
    }

    // Authentifier avec Supabase Auth SECONDARY
    const { data: authData, error: authError } = await supabaseSecondary.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });

    if (authError || !authData.session) {
      console.error("Secondary auth error:", authError);
      return res.status(401).json({ error: "Email ou mot de passe incorrect" });
    }

    // Récupérer les infos utilisateur depuis secondary users table
    const { data: userData, error: userError } = await supabaseSecondary
      .from("users")
      .select("id, full_name, email, role")
      .eq("auth_id", authData.user.id)
      .maybeSingle();

    if (userError || !userData) {
      console.error("Secondary user record error:", userError);
      return res.status(500).json({ error: "Erreur lors de la récupération du profil utilisateur" });
    }

    // Get PME info if exists
    const { data: pmeData } = await supabaseSecondary
      .from("pmes")
      .select("id, company_name, user_id")
      .eq("user_id", userData.id)
      .maybeSingle();

    return res.json({
      message: "Connexion réussie (Secondary)",
      token: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      database: "secondary",
      user: {
        id: userData.id,
        fullName: userData.full_name,
        email: userData.email,
        role: userData.role,
      },
      pme: pmeData ? {
        id: pmeData.id,
        companyName: pmeData.company_name,
      } : null,
    });
  } catch (err) {
    console.error("Secondary login error:", err);
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: err.issues });
    }
    return res.status(500).json({ error: "Erreur lors de la connexion" });
  }
}

/**
 * POST /auth-secondary/register
 * Crée un compte utilisateur sur la base de données secondaire
 */
export async function registerSecondary(req, res) {
  try {
    const secondaryRegisterSchema = z.object({
      firstName: z.string().min(1).max(100),
      lastName: z.string().min(1).max(100),
      email: z.string().email(),
      password: z.string().min(6),
      companyName: z.string().min(1).max(200),
      rccmNumber: z.string().optional().nullable(),
      nifNumber: z.string().optional().nullable(),
      sector: z.string().optional().nullable(),
      activityDescription: z.string().optional().nullable(),
    });

    const parsed = secondaryRegisterSchema.parse(req.body);

    if (!supabaseSecondary) {
      return res.status(503).json({ error: "Secondary database not configured" });
    }

    // 1️⃣ Create user in secondary Supabase Auth
    const { data: authData, error: authError } = await supabaseSecondary.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      console.error("Secondary auth error:", authError);
      return res.status(400).json({ error: authError?.message || "Erreur lors de la création du compte" });
    }

    const authUserId = authData.user.id;

    // 2️⃣ Create user record in secondary users table
    const fullName = `${parsed.firstName} ${parsed.lastName}`;
    const { data: userData, error: userError } = await supabaseSecondary
      .from("users")
      .insert({
        email: parsed.email,
        auth_id: authUserId,
        full_name: fullName,
        role: "pme",
        is_active: true,
      })
      .select("id, full_name, email, role, created_at")
      .single();

    if (userError || !userData) {
      console.error("Secondary user record error:", userError);
      // Delete auth user on failure
      await supabaseSecondary.auth.admin.deleteUser(authUserId);
      return res.status(500).json({ error: "Erreur lors de la création du profil utilisateur" });
    }

    // 3️⃣ Create PME record in secondary pmes table
    const { data: pmeData, error: pmeError } = await supabaseSecondary
      .from("pmes")
      .insert({
        user_id: userData.id,
        company_name: parsed.companyName,
        rccm_number: parsed.rccmNumber || null,
        nif_number: parsed.nifNumber || null,
        sector: parsed.sector || null,
        activity_description: parsed.activityDescription || null,
      })
      .select("id, company_name")
      .single();

    if (pmeError) {
      console.error("Secondary PME error:", pmeError);
      // Try to rollback user and auth
      await supabaseSecondary
        .from("users")
        .delete()
        .eq("id", userData.id)
        .catch(err => console.error("Rollback user failed:", err));
      await supabaseSecondary.auth.admin.deleteUser(authUserId);
      return res.status(500).json({ error: "Erreur lors de la création de la PME" });
    }

    // 4️⃣ Create session by logging in
    const { data: sessionData, error: sessionError } = await supabaseSecondary.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password
    });

    if (sessionError || !sessionData.session) {
      console.error("Secondary session error:", sessionError);
      return res.status(500).json({ error: "Erreur lors de la création de la session" });
    }

    return res.status(201).json({
      message: "Inscription réussie (Secondary)",
      token: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
      database: "secondary",
      user: {
        id: userData.id,
        fullName: userData.full_name,
        email: userData.email,
        role: userData.role,
      },
      pme: {
        id: pmeData.id,
        companyName: pmeData.company_name,
      },
    });
  } catch (err) {
    console.error("Secondary register error:", err);
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: "Validation error", details: err.issues });
    }
    return res.status(500).json({ error: "Erreur lors de l'inscription" });
  }
}
