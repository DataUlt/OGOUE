import { Router } from "express";
import { listSales, createSale, updateSaleReceipt } from "../controllers/sales.controller.js";

const r = Router();
r.get("/", listSales);
r.post("/", createSale);
r.put("/:id", updateSaleReceipt);
export default r;
