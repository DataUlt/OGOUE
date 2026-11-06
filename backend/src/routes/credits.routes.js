import { Router } from "express";
import { getCredits, enregistrerReglement, annulerReglement } from "../controllers/credits.controller.js";

// Crédits clients : ce que les clients doivent, et ce qu'ils versent
const r = Router();
r.get("/", getCredits);
r.post("/reglements", enregistrerReglement);
r.delete("/reglements/:id", annulerReglement);
export default r;
