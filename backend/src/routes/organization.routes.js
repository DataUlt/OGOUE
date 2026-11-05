import express from "express";
import { getOrganization, updateOrganization, enregistrerCanalAcquisition, demanderSuppressionCompte } from "../controllers/organization.controller.js";
import { exigerGerant } from "../middleware/roles.middleware.js";
import { limiterTentatives } from "../middleware/securite.middleware.js";

// Le mot de passe est vérifié ici : on freine les essais comme à la connexion
const limiteSuppression = limiterTentatives(5, 15 * 60 * 1000, "Trop de tentatives. Réessayez dans quelques minutes.");

export const organizationRoutes = express.Router();

// Consulter : tout le monde dans l'entreprise, l'agent en a besoin pour
// l'en-tête et pour les reçus. Modifier : le gérant seul — le nom, le
// RCCM et le NIF figurent sur les documents remis aux clients.
organizationRoutes.get("/", getOrganization);
organizationRoutes.put("/", exigerGerant, updateOrganization);
// Question « comment nous avez-vous connu ? » posée aux comptes existants
organizationRoutes.post("/canal-acquisition", exigerGerant, enregistrerCanalAcquisition);
// Supprimer le compte : le gérant seul, mot de passe exigé ; effacement 30 jours plus tard
organizationRoutes.post("/suppression", exigerGerant, limiteSuppression, demanderSuppressionCompte);

export default organizationRoutes;
