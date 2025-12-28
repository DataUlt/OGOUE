import { Router } from "express";
import { listExpenses, createExpense, updateExpenseReceipt } from "../controllers/expenses.controller.js";
import upload from "../middleware/upload.middleware.js";

const r = Router();
r.get("/", listExpenses);
r.post("/", upload.single("receipt"), createExpense);
r.put("/:id", upload.single("receipt"), updateExpenseReceipt);
export default r;
