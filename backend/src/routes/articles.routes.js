import { Router } from "express";
import {
  listArticles,
  createArticle,
  createArticlesBulk,
  updateArticle,
  deleteArticle,
  getRapportStock,
  sortieStock,
  corrigerInventaire,
} from "../controllers/articles.controller.js";
import { exigerGerant } from "../middleware/roles.middleware.js";

const r = Router();
r.get("/", listArticles);
r.post("/", createArticle);
r.post("/bulk", createArticlesBulk);
r.get("/rapport", getRapportStock);
r.post("/inventaire", exigerGerant, corrigerInventaire);
r.put("/:id", updateArticle);
r.post("/:id/sortie", sortieStock);
r.delete("/:id", deleteArticle);
export default r;
