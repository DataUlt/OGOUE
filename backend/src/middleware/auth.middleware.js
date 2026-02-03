import jwt from "jsonwebtoken";
import { supabase } from "../db/supabase.js";

/**
 * Middleware pour vérifier et décoder le JWT Supabase
 * Ajoute l'utilisateur dans req.user si le token est valide
 */
export async function authMiddleware(req, res, next) {
  try {
    // Récupérer le token du header Authorization
    const authHeader = req.headers.authorization;
    console.log("Authorization header:", authHeader ? "présent" : "ABSENT");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("Token manquant ou format invalide");
      return res.status(401).json({ error: "Token manquant" });
    }

    const token = authHeader.substring(7); // Enlever "Bearer "
    console.log("Token length:", token.length);

    // 1️⃣ Essayer de vérifier comme JWT agent d'abord
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "default_secret");
      if (decoded.role === "agent") {
        // C'est un agent JWT
        req.user = {
          sub: decoded.sub,
          agentId: decoded.agentId,
          role: "agent",
          organizationId: decoded.organizationId,
        };
        console.log("✅ Agent JWT vérifié");
        return next();
      }
    } catch (jwtErr) {
      console.log("❌ Pas un JWT agent valide, essayant Supabase Auth...");
    }

    // 2️⃣ Si ce n'est pas un JWT agent, vérifier avec Supabase
    const { data: userData, error: userError } = await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      console.error("Token verification error:", userError?.message || "Invalid user");
      return res.status(401).json({ error: "Token invalide" });
    }

    // Ajouter les données de l'utilisateur à la requête
    req.user = {
      sub: userData.user.id, // Supabase Auth ID
      email: userData.user.email,
    };

    // Récupérer l'organizationId depuis users
    const { data: userRecord, error: recordError } = await supabase
      .from("users")
      .select("id, organization_id, role")
      .eq("auth_id", userData.user.id)
      .maybeSingle();

    if (!recordError && userRecord) {
      req.user.userId = userRecord.id;
      req.user.organizationId = userRecord.organization_id;
      req.user.role = userRecord.role;
    }

    console.log("✅ Supabase Auth token vérifié");
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(401).json({ error: "Erreur d'authentification" });
  }
}

/**
 * Middleware optionnel pour décoder le JWT sans l'exiger
 * Utile si tu veux accepter les requêtes authentifiées ET non-authentifiées
 */
export async function authMiddlewareOptional(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { data: userData, error: userError } = await supabase.auth.getUser(token);

      if (!userError && userData.user) {
        req.user = {
          sub: userData.user.id,
          email: userData.user.email,
        };

        // Récupérer l'organizationId depuis users
        const { data: userRecord } = await supabase
          .from("users")
          .select("id, organization_id, role")
          .eq("auth_id", userData.user.id)
          .maybeSingle();

        if (userRecord) {
          req.user.userId = userRecord.id;
          req.user.organizationId = userRecord.organization_id;
          req.user.role = userRecord.role;
        }
      }
    }
  } catch (err) {
    console.error("Optional auth middleware error:", err);
  }
  next();
}
