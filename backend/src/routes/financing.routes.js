import { Router } from "express";
import {
  listProducts,
  getProduct,
  listApplications,
  getApplication,
  createApplication,
  updateApplication,
  submitApplication,
} from "../controllers/financing.controller.js";

const r = Router();

// Offre de credit des institutions partenaires
r.get("/products", listProducts);
r.get("/products/:id", getProduct);

// Dossiers de la PME connectee
r.get("/applications", listApplications);
r.post("/applications", createApplication);
r.get("/applications/:id", getApplication);
r.put("/applications/:id", updateApplication);
r.post("/applications/:id/submit", submitApplication);

export default r;
