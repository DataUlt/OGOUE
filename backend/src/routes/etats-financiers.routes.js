import { Router } from "express";
import { getEtatsFinanciers } from "../controllers/etats-financiers.controller.js";
import { exigerFonction } from "../middleware/plan.middleware.js";

const r = Router();

// La route n'est plus barree en bloc : la formule gratuite y a droit
// pour son tableau de flux. Le tri document par document se fait dans le
// controleur, qui n'envoie que ce que la formule ouvre. Le garde reste
// en place pour le jour ou une formule fermerait la page entiere.
r.get("/", exigerFonction("etatsFinanciers", "Les états financiers"), getEtatsFinanciers);

export default r;
