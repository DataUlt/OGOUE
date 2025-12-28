import express from "express";
import { register, login, getMe } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { cleanBucket } from "../utils/supabase-storage.js";

export const authRoutes = express.Router();

// Routes publiques (sans authentification)
authRoutes.post("/register", register);
authRoutes.post("/login", login);

// Routes protégées (nécessitent un JWT valide)
authRoutes.get("/me", authMiddleware, getMe);

// Route admin pour nettoyer le bucket (DANGER - à utiliser avec prudence)
authRoutes.post("/admin/clean-bucket", async (req, res) => {
  try {
    const adminPassword = req.body.password;
    // Vérifier le mot de passe admin (à définir dans les variables d'env)
    if (adminPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    await cleanBucket();
    res.json({ success: true, message: "Bucket cleaned successfully" });
  } catch (error) {
    console.error("Error cleaning bucket:", error);
    res.status(500).json({ error: error.message });
  }
});

export default authRoutes;
