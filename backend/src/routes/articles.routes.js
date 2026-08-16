import { Router } from "express";
import {
  listArticles,
  createArticle,
  createArticlesBulk,
  updateArticle,
  deleteArticle,
} from "../controllers/articles.controller.js";

const r = Router();
r.get("/", listArticles);
r.post("/", createArticle);
r.post("/bulk", createArticlesBulk);
r.put("/:id", updateArticle);
r.delete("/:id", deleteArticle);
export default r;
