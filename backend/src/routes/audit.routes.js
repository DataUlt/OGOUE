import express from "express";
import { 
  getDeletionHistoryList, 
  getDeletionDetail, 
  getDeletionStats,
  deleteDeletionRecord
} from "../controllers/audit.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { exigerFonction } from "../middleware/plan.middleware.js";

const router = express.Router();

// L'historique des suppressions est réservé à la formule Équipe :
// savoir qui a effacé quoi n'a de sens qu'à plusieurs.
router.use(exigerFonction("audit", "L'historique des suppressions"));

/**
 * GET /api/audit/deletions
 * Récupère l'historique des suppressions avec filtres
 * Query params: ?recordType=expense&month=12&year=2025
 */
router.get("/deletions", authMiddleware, getDeletionHistoryList);

/**
 * GET /api/audit/deletions/:id
 * Récupère les détails d'une suppression
 */
router.get("/deletions/:id", authMiddleware, getDeletionDetail);

/**
 * GET /api/audit/stats
 * Récupère les statistiques sur les suppressions
 */
router.get("/stats", authMiddleware, getDeletionStats);

/**
 * DELETE /api/audit/deletions/:id
 * Supprime un enregistrement d'audit (managers only)
 */
router.delete("/deletions/:id", authMiddleware, deleteDeletionRecord);

export default router;
