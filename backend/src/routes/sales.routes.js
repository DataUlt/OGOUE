import { Router } from "express";
import { listSales, createSale, updateSaleReceipt, deleteSale } from "../controllers/sales.controller.js";
import upload from "../middleware/upload.middleware.js";

const r = Router();
r.get("/", listSales);
r.post("/", upload.single("receipt"), createSale);
r.put("/:id", upload.single("receipt"), updateSaleReceipt);
r.delete("/:id", deleteSale);
export default r;
