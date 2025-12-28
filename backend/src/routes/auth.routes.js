import express from "express";
import { register, login, getMe } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

export const authRoutes = express.Router();

// Routes publiques (sans authentification)
authRoutes.post("/register", register);
authRoutes.post("/login", login);

// Routes protégées (nécessitent un JWT valide)
authRoutes.get("/me", authMiddleware, getMe);

export default authRoutes;
