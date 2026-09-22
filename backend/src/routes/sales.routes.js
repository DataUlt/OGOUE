import { Router } from "express";
import { listSales, createSale, updateSaleReceipt, deleteSale, getSaleRecuUrl, etablirSaleRecu } from "../controllers/sales.controller.js";
import upload from "../middleware/upload.middleware.js";
import { exigerFonction } from "../middleware/plan.middleware.js";

const r = Router();
r.get("/", listSales);

// L'envoi d'un justificatif dépend de la formule, mais l'enregistrement
// d'une vente ne doit jamais l'être : le contrôle est donc fait dans le
// contrôleur, sur la présence du fichier, et non sur la route entière.
r.post("/", upload.single("receipt"), createSale);

// Consulter un reçu déjà émis reste ouvert : une vente antérieure à une
// baisse de formule ne doit pas devenir inaccessible.
r.get("/:id/recu", getSaleRecuUrl);
r.post("/:id/recu", exigerFonction("recus", "L'émission de reçus numérotés"), etablirSaleRecu);

r.put("/:id", upload.single("receipt"), updateSaleReceipt);
r.delete("/:id", deleteSale);
export default r;
