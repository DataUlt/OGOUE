import express from "express";
import { register, login, getMe, registerAgent, loginAgent, forgotPassword, resetPassword, loginSecondary, registerSecondary } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { limiterTentatives } from "../middleware/securite.middleware.js";

export const authRoutes = express.Router();

// Rien ne freinait les essais : ni verrouillage, ni délai, ni alerte. Un
// code d'accès agent fait neuf caractères sur un alphabet de 32 ; sans
// limite, une machine les parcourt. Les plafonds sont larges — ils
// visent la machine qui essaie en boucle, pas le gérant qui se trompe
// deux fois de mot de passe le matin.
const limiteConnexion = limiterTentatives(
  10, 15 * 60 * 1000,
  "Trop de tentatives de connexion. Réessayez dans quelques minutes."
);

// Plus strict sur le code d'accès : il n'y a ni identifiant ni mot de
// passe à deviner en plus, le code est le seul secret.
const limiteCodeAgent = limiterTentatives(
  8, 15 * 60 * 1000,
  "Trop de tentatives. Réessayez dans quelques minutes."
);

// L'envoi de courriels est un coût, et un moyen de harceler une adresse.
const limiteMotDePasseOublie = limiterTentatives(
  5, 60 * 60 * 1000,
  "Trop de demandes de réinitialisation. Réessayez dans une heure."
);

// La création de comptes en rafale remplit la base et la file SMTP.
const limiteInscription = limiterTentatives(
  5, 60 * 60 * 1000,
  "Trop de créations de compte depuis cette connexion. Réessayez plus tard."
);

// ============================================
// PRIMARY DATABASE ROUTES
// ============================================

// Routes publiques (sans authentification)
authRoutes.post("/register", limiteInscription, register);
authRoutes.post("/login", limiteConnexion, login);
authRoutes.post("/agent-register", limiteCodeAgent, registerAgent);    // Enregistrer un agent via code
authRoutes.post("/agent-login", limiteCodeAgent, loginAgent);          // Vérifier code d'accès agent
authRoutes.post("/forgot-password", limiteMotDePasseOublie, forgotPassword);  // Réinitialiser le mot de passe
authRoutes.post("/reset-password", limiteConnexion, resetPassword);    // Valider la réinitialisation du mot de passe

// Routes protégées (nécessitent un JWT valide)
authRoutes.get("/me", authMiddleware, getMe);

// ============================================
// SECONDARY DATABASE ROUTES
// ============================================

// Secondary database auth routes
authRoutes.post("/secondary/register", limiteInscription, registerSecondary);  // Créer compte secondaire
authRoutes.post("/secondary/login", limiteConnexion, loginSecondary);          // Se connecter secondaire

export default authRoutes;
