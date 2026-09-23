import { Router } from "express";
import { createAgent, listAgents, deleteAgent, authenticateAgentByCode } from "../controllers/agents.controller.js";
import { exigerGerant } from "../middleware/roles.middleware.js";

const r = Router();

// Réservé au gérant, et vérifié ici et non plus seulement dans le
// navigateur. La liste renvoie les codes d'accès en clair : sans ce
// garde, un agent lisait ceux de tous ses collègues, et pouvait s'en
// créer un nouveau que personne n'aurait relié à lui.
r.post("/", exigerGerant, createAgent);       // Créer un agent
r.get("/", exigerGerant, listAgents);          // Lister les agents
r.delete("/:id", exigerGerant, deleteAgent);   // Supprimer un agent

// Route publique pour s'authentifier via code
r.post("/auth/by-code", authenticateAgentByCode);

export default r;
