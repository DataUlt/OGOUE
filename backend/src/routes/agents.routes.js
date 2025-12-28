import { Router } from "express";
import { createAgent, listAgents, deleteAgent, authenticateAgentByCode } from "../controllers/agents.controller.js";

const r = Router();

// Routes protégées (pour les gérants)
r.post("/", createAgent);              // Créer un agent
r.get("/", listAgents);                 // Lister les agents
r.delete("/:id", deleteAgent);          // Supprimer un agent

// Route publique pour s'authentifier via code
r.post("/auth/by-code", authenticateAgentByCode);

export default r;
