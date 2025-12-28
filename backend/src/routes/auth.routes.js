import express from "express";
import { register, login, getMe, registerAgent, loginAgent, forgotPassword, resetPassword } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

export const authRoutes = express.Router();

// Routes publiques (sans authentification)
authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.post("/agent-register", registerAgent);    // Enregistrer un agent via code
authRoutes.post("/agent-login", loginAgent);          // Vérifier code d'accès agent
authRoutes.post("/forgot-password", forgotPassword);  // Réinitialiser le mot de passe
authRoutes.post("/reset-password", resetPassword);    // Valider la réinitialisation du mot de passe

// Routes protégées (nécessitent un JWT valide)
authRoutes.get("/me", authMiddleware, getMe);

export default authRoutes;
