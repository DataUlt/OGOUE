import { supabase, supabaseSecondary, supabaseAuth, supabaseAuthSecondary } from "../db/supabase.js";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/secrets.js";

// Seuls le RCCM et le NIF restent facultatifs : beaucoup de petites
// entreprises n'en disposent pas encore au moment de l'inscription, et
// les exiger fermerait la porte a une partie du public vise.
const registerSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  // 8 caracteres : le minimum raisonnable face a une attaque par
  // dictionnaire. La limitation de debit sur /login fait le reste.
  password: z.string().min(8),
  organizationName: z.string().min(1).max(200),
  rccmNumber: z.string().optional().nullable(),
  nifNumber: z.string().optional().nullable(),
  activity: z.string().min(1).max(200),
  activityDescription: z.string().min(1).max(500),
  acquisitionSource: z.string().max(120).optional().nullable(),
  // Origine du site d'où vient l'inscription : le lien de confirmation y renvoie.
  redirectOrigin: z.string().max(200).optional().nullable(),
  // Numéro WhatsApp facultatif : espaces, points et tirets sont retirés avant contrôle
  whatsapp: z.string().max(30).optional().nullable().refine(
    (v) => !v || /^\+?\d{8,15}$/.test(v.replace(/[\s.\-]/g, "")),
    { message: "Numéro WhatsApp invalide" }
  ),
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
/**
 * Un compte de meme e-mail existe deja dans la base des dossiers : on le reprend
 * au lieu de creer un doublon (qui echouait et laissait un profil desaligne).
 * Le profil PME est cree seulement s'il manque.
 */
async function rattacherCompteExistant(userIdSecondaire, orgData) {
  const { data: pmeExistante } = await supabaseSecondary
    .from("pmes")
    .select("id")
    .eq("user_id", userIdSecondaire)
    .maybeSingle();

  if (pmeExistante) {
    console.log("✅ Compte et PME déjà présents dans la base des dossiers :", userIdSecondaire);
    return { success: true, reprise: true };
  }

  const { error: pmeError } = await supabaseSecondary.from("pmes").insert({
    user_id: userIdSecondaire,
    company_name: orgData.name,
    rccm_number: orgData.rccm_number || null,
    nif_number: orgData.nif_number || null,
    sector: orgData.activity || null,
    activity_description: orgData.activity_description || null,
    created_at: orgData.created_at,
  });
  if (pmeError) {
    console.error("❌ Rattachement PME existante :", pmeError.message);
    return { success: false, reason: "PME sync failed", error: pmeError };
  }
  return { success: true, reprise: true };
}

async function syncToSecondarySupabase(email, password, orgData, userData) {
  if (!supabaseSecondary) {
    console.warn("⚠️  Secondary Supabase not configured, skipping sync");
    return { success: false, reason: "Secondary Supabase not configured" };
  }

  try {
    console.log("🔄 Syncing to secondary Supabase...");
    
    // 0️⃣ Compte deja present dans la base des dossiers (meme e-mail) : on le reprend
    const motifEmail = email.replace(/[%_\\]/g, (c) => `\\${c}`);
    const { data: dejaPresent } = await supabaseSecondary
      .from("users")
      .select("id")
      .ilike("email", motifEmail)
      .maybeSingle();
    if (dejaPresent) {
      return await rattacherCompteExistant(dejaPresent.id, orgData);
    }

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

// Crée organisation et utilisateur à partir des métadonnées du compte, une seule fois,
// à la première connexion (donc après confirmation). Le mot de passe sert ensuite
// à la synchronisation avec la base des dossiers.
async function creerProfilPmeSiAbsent(authUser, password) {
  const meta = authUser?.user_metadata || {};
  if (!meta.organization) return; // compte d'un autre parcours

  const { data: existant } = await supabase.from("users").select("id").eq("auth_id", authUser.id).maybeSingle();
  if (existant) return;

  const org = meta.organization;
  const { data: orgData, error: orgError } = await supabase
    .from("organizations")
    .insert({
      name: org.name,
      rccm_number: org.rccm_number || null,
      nif_number: org.nif_number || null,
      activity: org.activity || null,
      activity_description: org.activity_description || null,
      acquisition_source: org.acquisition_source || null,
    })
    .select("id, name, rccm_number, nif_number, activity, activity_description, created_at")
    .single();
  if (orgError || !orgData) {
    console.error("❌ Organization error:", orgError);
    throw new Error("Erreur lors de la création de l'organisation");
  }

  const { data: userData, error: userError } = await supabase
    .from("users")
    .insert({
      auth_id: authUser.id,
      first_name: meta.firstName,
      last_name: meta.lastName,
      email: authUser.email,
      role: meta.pme_role || "manager",
      whatsapp: meta.whatsapp || null,
      organization_id: orgData.id,
    })
    .select("id, first_name, last_name, email, role, organization_id, created_at")
    .single();
  if (userError || !userData) {
    console.error("User record error:", userError);
    await supabase.from("organizations").delete().eq("id", orgData.id);
    throw new Error("Erreur lors de la création du profil utilisateur");
  }

  // Base des dossiers : non bloquant, comme à l'inscription avant
  const sync = await syncToSecondarySupabase(authUser.email, password, orgData, userData);
  if (!sync.success) console.warn("⚠️  Sync failed at first login:", sync.reason);
}

/**
 * POST /auth/register
 * Crée une nouvelle organisation, un utilisateur Supabase Auth et un record dans users
 */
export async function register(req, res) {
  try {
    const parsed = registerSchema.parse(req.body);

    // Une même adresse ne peut pas être à la fois une PME et une institution :
    // le projet financement (base des dossiers) est partagé, on le consulte d'abord.
    if (supabaseSecondary) {
      const motifEmail = parsed.email.replace(/[%_\\]/g, (c) => `\\${c}`);
      const { data: compteInstitution } = await supabaseSecondary
        .from("users")
        .select("id")
        .ilike("email", motifEmail)
        .eq("role", "institution")
        .maybeSingle();
      if (compteInstitution) {
        return res.status(409).json({
          error: "Cette adresse e-mail est déjà utilisée par un compte institution financière. Utilisez une autre adresse.",
        });
      }
    }

    // Rien n'est écrit dans les tables tant que l'adresse n'est pas confirmée :
    // les données de l'entreprise restent dans les métadonnées du compte et sont
    // créées à la première connexion (voir creerProfilPmeSiAbsent).
    const { error: authError } = await supabase.auth.admin.createUser({
      email: parsed.email,
      password: parsed.password,
      email_confirm: false,
      user_metadata: {
        pme_role: parsed.role,
        firstName: parsed.firstName,
        lastName: parsed.lastName,
        whatsapp: parsed.whatsapp ? parsed.whatsapp.replace(/[\s.\-]/g, "") : null,
        organization: {
          name: parsed.organizationName,
          rccm_number: parsed.rccmNumber || null,
          nif_number: parsed.nifNumber || null,
          activity: parsed.activity || null,
          activity_description: parsed.activityDescription || null,
          acquisition_source: parsed.acquisitionSource || null,
        },
      },
    });

    if (authError) {
      console.error("Auth error:", authError);
      return res.status(400).json({ error: authError.message || "Erreur lors de la création du compte" });
    }

    // Seul le lien de confirmation part ici ; aucune session n'est ouverte.
    await envoyerConfirmation(parsed.email, parsed.redirectOrigin);

    return res.status(201).json({
      message: "Inscription enregistrée. Un e-mail de confirmation vient de vous être envoyé.",
      needsConfirmation: true,
      email: parsed.email,
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
 * Envoie (ou renvoie) le lien de confirmation d'e-mail. Un compte créé par
 * l'API admin ne reçoit rien automatiquement : on le demande ici.
 * Une erreur d'envoi ne bloque pas l'inscription : la personne peut relancer.
 */
// Seules ces origines peuvent recevoir le lien de confirmation (le reste est ignoré).
const ORIGINES_CONFIRMATION = ["http://127.0.0.1:8080", "http://localhost:8080", "https://www.ogoue.com"];

async function envoyerConfirmation(email, origine) {
  const emailRedirectTo = ORIGINES_CONFIRMATION.includes(origine) ? `${origine}/confirmation.html` : undefined;
  const { error } = await supabaseAuth.auth.resend({ type: "signup", email, options: { emailRedirectTo } });
  if (error) console.error("Envoi du lien de confirmation échoué:", error.message);
  return !error;
}

/**
 * POST /auth/resend-confirmation
 * Renvoie le lien de confirmation. La réponse est la même que le compte
 * existe ou non, pour ne pas révéler les adresses inscrites.
 */
export async function resendConfirmation(req, res) {
  try {
    const parsed = z.object({ email: z.string().email(), redirectOrigin: z.string().max(200).optional().nullable() }).parse(req.body);
    await envoyerConfirmation(parsed.email, parsed.redirectOrigin);
    return res.json({
      message: "Si un compte en attente existe pour cette adresse, un nouveau lien de confirmation vient d'être envoyé.",
    });
  } catch (err) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: "Adresse e-mail invalide" });
    }
    console.error("Resend error:", err?.message || err);
    return res.status(500).json({ error: "Impossible d'envoyer le lien pour le moment" });
  }
}

/**
 * GET /auth/whatsapp
 * Renvoie le numéro WhatsApp du gérant connecté (null s'il n'en a pas donné).
 */
export async function getWhatsapp(req, res) {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("whatsapp")
      .eq("auth_id", req.user.sub)
      .maybeSingle();
    if (error) throw error;
    return res.json({ whatsapp: data?.whatsapp || null });
  } catch (err) {
    console.error("GetWhatsapp error:", err?.message || err);
    return res.status(500).json({ error: "Impossible de lire le numéro WhatsApp" });
  }
}

/**
 * POST /auth/whatsapp
 * Enregistre le numéro WhatsApp du gérant. Un numéro déjà renseigné n'est
 * jamais écrasé : on répond 409.
 */
export async function enregistrerWhatsapp(req, res) {
  try {
    const parsed = z.object({
      whatsapp: z.string().max(30).refine(
        (v) => /^\+?\d{8,15}$/.test(v.replace(/[\s.\-]/g, "")),
        { message: "Numéro WhatsApp invalide" }
      ),
    }).parse(req.body);
    const numero = parsed.whatsapp.replace(/[\s.\-]/g, "");
    const { data, error } = await supabase
      .from("users")
      .update({ whatsapp: numero })
      .eq("auth_id", req.user.sub)
      .is("whatsapp", null)
      .select("id");
    if (error) throw error;
    if (!data || data.length === 0) {
      return res.status(409).json({ error: "Un numéro WhatsApp est déjà enregistré" });
    }
    return res.json({ message: "Numéro WhatsApp enregistré", whatsapp: numero });
  } catch (err) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ error: err.issues[0]?.message || "Numéro invalide" });
    }
    console.error("SetWhatsapp error:", err?.message || err);
    return res.status(500).json({ error: "Impossible d'enregistrer le numéro" });
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
    // (client dédié : ne pas attacher de session au client admin)
    const { data: authData, error: authError } = await supabaseAuth.auth.signInWithPassword({
      email: parsed.email,
      password: parsed.password,
    });

    if (authError || !authData.session) {
      console.error("Auth error:", authError);

      // Mot de passe bon mais e-mail pas encore confirmé : Supabase le signale
      // seulement dans ce cas, on le dit donc clairement.
      if (authError?.code === "email_not_confirmed" || /email not confirmed/i.test(authError?.message || "")) {
        return res.status(403).json({
          error: "Votre adresse e-mail n'est pas encore confirmée. Cliquez sur le lien reçu par e-mail, ou demandez un nouvel envoi.",
          code: "EMAIL_NON_CONFIRME",
          email: parsed.email,
        });
      }

      // Supabase renvoie volontairement la même erreur qu'un compte soit
      // inconnu ou que le mot de passe soit faux. Pour dire à la personne ce
      // qui cloche vraiment, on interroge `users` nous-mêmes.
      //
      // La comparaison est insensible à la casse : les e-mails sont stockés
      // tels que saisis à l'inscription, et une simple majuscule ferait
      // répondre « vous n'avez pas de compte » à quelqu'un qui en a un.
      // Les caractères % et _ sont échappés, sinon ils seraient interprétés
      // comme des jokers par ilike.
      const motifEmail = parsed.email.replace(/[%_\\]/g, (c) => `\\${c}`);
      const { data: comptesConnus } = await supabase
        .from("users")
        .select("id")
        .ilike("email", motifEmail)
        .limit(1);

      if (!comptesConnus || comptesConnus.length === 0) {
        return res.status(401).json({
          error: "Oups ! Il semble que vous n'ayez pas encore de compte OGOUE. Inscrivez-vous pour commencer.",
        });
      }

      return res.status(401).json({ error: "Mot de passe incorrect" });
    }

    // Première connexion après confirmation : on crée le profil
    try {
      await creerProfilPmeSiAbsent(authData.user, parsed.password);
    } catch (profilErreur) {
      console.error("Création du profil à la connexion :", profilErreur?.message);
      return res.status(500).json({
        error: "Oups ! Votre inscription n'a pas été finalisée. Contactez-nous pour activer votre accès.",
      });
    }

    // Récupérer les infos utilisateur depuis users
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id, first_name, last_name, email, role, organization_id")
      .eq("auth_id", authData.user.id)
      .maybeSingle();

    // On n'arrive ici que si le mot de passe était BON : Supabase Auth a
    // validé les identifiants, mais aucun profil ne leur correspond dans
    // `users`. Ce n'est donc pas un compte inconnu — celui-là est refusé plus
    // haut par « Email ou mot de passe incorrect » — mais une inscription
    // restée à moitié faite, que l'utilisateur ne peut pas réparer lui-même.
    if (userError || !userData) {
      console.error("User record error:", userError);
      return res.status(500).json({
        error: "Oups ! Votre inscription n'a pas été finalisée. Contactez-nous pour activer votre accès.",
      });
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
      // 8 caracteres : le minimum raisonnable face a une attaque par
  // dictionnaire. La limitation de debit sur /login fait le reste.
  password: z.string().min(8),
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

    // Le code présenté ne se journalise pas : c'est un identifiant de
    // connexion, et les journaux de Render se lisent, se conservent et
    // s'exportent.

    // Vérifier que le code d'accès est valide et actif
    const { data: agentRecord, error: agentError } = await supabase
      .from("agents")
      .select("id, organization_id, first_name, is_active, access_code")
      .eq("access_code", parsed.accessCode)
      .eq("is_active", true)
      .single();

    if (agentError || !agentRecord) {
      // Un échec de connexion ne déclenche plus de relevé de comparaison.
      // La version précédente lisait TOUS les agents de la base et
      // écrivait leurs codes d'accès en clair dans les journaux, à chaque
      // tentative ratée : une seule frappe erronée suffisait à y déverser
      // les identifiants de toutes les entreprises du service.
      console.warn("Tentative de connexion agent avec un code invalide");
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
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    // Le code d'accès ne figure pas dans la trace : identifier l'agent
    // suffit à suivre ce qui s'est passé.
    console.log("✅ Connexion agent:", agentRecord.id);

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

    // FRONTEND_URL absente ne doit pas casser la reinitialisation : c'est
    // une erreur de configuration, dont l'utilisateur n'est pas responsable
    // et qu'il ne peut pas contourner. On se rabat sur l'adresse de
    // production, en le signalant bruyamment dans les journaux.
    const frontendUrl = process.env.FRONTEND_URL || "https://www.ogoue.com";
    if (!process.env.FRONTEND_URL) {
      console.warn(
        "⚠️  FRONTEND_URL non configurée : repli sur https://www.ogoue.com " +
        "pour le lien de réinitialisation. À définir dans l'environnement."
      );
    }

    // Supabase gère automatiquement l'envoi d'email de réinitialisation
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.email, {
      redirectTo: `${frontendUrl}/reset-password.html`,
    });

    if (error) {
      console.error("Password reset error:", error);

      // Quota d'envoi d'emails atteint : ce n'est pas un risque d'énumération,
      // il faut le dire à l'utilisateur au lieu de prétendre que l'email est parti.
      //
      // Le quota est celui du service d'envoi configuré dans Supabase, et il
      // se compte par heure : annoncer "quelques minutes" ferait réessayer
      // l'utilisateur en boucle, sans succès.
      if (error.status === 429 || error.code === "over_email_send_rate_limit") {
        console.error("⚠️  Quota d'envoi d'e-mails atteint côté Supabase.");
        return res.status(429).json({
          error: "Le service d'envoi d'e-mails a atteint sa limite. Réessayez dans une heure, ou contactez-nous pour réinitialiser votre mot de passe.",
        });
      }

      // Toute autre erreur (email inexistant, etc.) : réponse générique pour
      // ne pas révéler si un compte existe avec cette adresse.
      return res.status(200).json({
        message: "Si un compte existe avec cet email, vous recevrez un lien de réinitialisation",
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
      // 8 caracteres : le minimum raisonnable face a une attaque par
  // dictionnaire. La limitation de debit sur /login fait le reste.
  password: z.string().min(8),
    });

    const parsed = resetPasswordSchema.parse(req.body);
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(400).json({ error: "Token manquant" });
    }

    // Le client `supabase` utilise la clé service_role (pas de session active),
    // donc on résout d'abord l'utilisateur à partir du token de réinitialisation...
    const { data: userData, error: getUserError } = await supabase.auth.getUser(token);

    if (getUserError || !userData?.user) {
      console.error("Reset password - token invalide:", getUserError);
      return res.status(400).json({ error: "Lien de réinitialisation invalide ou expiré" });
    }

    // ...puis on met à jour son mot de passe via l'API Admin (droits service_role)
    const { error } = await supabase.auth.admin.updateUserById(userData.user.id, {
      password: parsed.password,
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
    // (client dédié : ne pas attacher de session au client admin)
    const { data: authData, error: authError } = await supabaseAuthSecondary.auth.signInWithPassword({
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

    // Même situation que sur la base principale : identifiants valides, mais
    // pas de profil en face.
    if (userError || !userData) {
      console.error("Secondary user record error:", userError);
      return res.status(500).json({
        error: "Oups ! Votre inscription n'a pas été finalisée. Contactez-nous pour activer votre accès.",
      });
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
      // 8 caracteres : le minimum raisonnable face a une attaque par
  // dictionnaire. La limitation de debit sur /login fait le reste.
  password: z.string().min(8),
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
    // (client dédié : ne pas attacher de session au client admin)
    const { data: sessionData, error: sessionError } = await supabaseAuthSecondary.auth.signInWithPassword({
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

/**
 * POST /auth/change-password
 * Changement volontaire du mot de passe par le gérant connecté.
 * L'ancien mot de passe est vérifié avant tout changement.
 */
export async function changePassword(req, res) {
  try {
    const schema = z.object({
      currentPassword: z.string().min(1).max(128),
      newPassword: z.string().min(8).max(128),
    });
    const parsed = schema.parse(req.body);

    if (!req.user?.email) {
      return res.status(403).json({ error: "Ce compte n'a pas de mot de passe à changer." });
    }
    if (parsed.currentPassword === parsed.newPassword) {
      return res.status(400).json({ error: "Le nouveau mot de passe doit être différent de l'ancien." });
    }

    // Vérifie l'ancien mot de passe (client dédié à la connexion)
    const { error: erreurVerif } = await supabaseAuth.auth.signInWithPassword({
      email: req.user.email,
      password: parsed.currentPassword,
    });
    if (erreurVerif) {
      return res.status(401).json({ error: "Mot de passe actuel incorrect" });
    }

    const { error } = await supabase.auth.admin.updateUserById(req.user.sub, {
      password: parsed.newPassword,
    });
    if (error) {
      console.error("Changement de mot de passe:", error);
      return res.status(500).json({ error: "Changement impossible, réessayez." });
    }

    return res.json({ ok: true });
  } catch (error) {
    if (error?.name === "ZodError") {
      return res.status(400).json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères." });
    }
    console.error("changePassword error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
