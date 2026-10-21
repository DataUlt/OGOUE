import { Router } from "express";
import {
  listProducts,
  getProduct,
  listApplications,
  getApplication,
  createApplication,
  updateApplication,
  submitApplication,
  listMessages,
  postMessage,
  getMessageAttachment,
  uploadApplicationDocument,
  deleteApplicationDocument,
  getApplicationDocumentUrl,
} from "../controllers/financing.controller.js";
import upload from "../middleware/upload.middleware.js";

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

// Pieces justificatives du dossier
r.post("/applications/:id/documents", upload.single("file"), uploadApplicationDocument);
r.get("/applications/:id/documents/:docId/url", getApplicationDocumentUrl);
r.delete("/applications/:id/documents/:docId", deleteApplicationDocument);

// Discussion du dossier : messages texte et piece jointe (champ « file », optionnel)
r.get("/applications/:id/messages", listMessages);
r.post("/applications/:id/messages", upload.single("file"), postMessage);
r.get("/applications/:id/messages/:msgId/attachment", getMessageAttachment);

export default r;
