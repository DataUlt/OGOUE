import express from "express";
import { register, login, getMe, registerAgent, loginAgent } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

export const authRoutes = express.Router();

// Routes publiques (sans authentification)
authRoutes.post("/register", register);
authRoutes.post("/login", login);
authRoutes.post("/agent-register", registerAgent);    // Enregistrer un agent via code
authRoutes.post("/agent-login", loginAgent);          // Vérifier code d'accès agent

// Routes protégées (nécessitent un JWT valide)
authRoutes.get("/me", authMiddleware, getMe);

export default authRoutes;
