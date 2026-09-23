import express from "express";
import { getOrganization, updateOrganization } from "../controllers/organization.controller.js";
import { exigerGerant } from "../middleware/roles.middleware.js";

export const organizationRoutes = express.Router();

// Consulter : tout le monde dans l'entreprise, l'agent en a besoin pour
// l'en-tête et pour les reçus. Modifier : le gérant seul — le nom, le
// RCCM et le NIF figurent sur les documents remis aux clients.
organizationRoutes.get("/", getOrganization);
organizationRoutes.put("/", exigerGerant, updateOrganization);

export default organizationRoutes;
