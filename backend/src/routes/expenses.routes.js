import { Router } from "express";
import { listExpenses, createExpense, updateExpenseReceipt } from "../controllers/expenses.controller.js";

const r = Router();
r.get("/", listExpenses);
r.post("/", createExpense);
r.put("/:id", updateExpenseReceipt);
export default r;
