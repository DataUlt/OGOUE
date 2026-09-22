import { Router } from "express";
import { listExpenses, createExpense, updateExpenseReceipt, deleteExpense, getExpenseJustificatifUrl } from "../controllers/expenses.controller.js";
import upload from "../middleware/upload.middleware.js";

const r = Router();
r.get("/", listExpenses);

// Consulter un justificatif deja depose reste ouvert a toutes les
// formules : c'est le document du client. Seul son depot est reserve.
r.get("/:id/justificatif", getExpenseJustificatifUrl);
r.post("/", upload.single("receipt"), createExpense);
r.put("/:id", upload.single("receipt"), updateExpenseReceipt);
r.delete("/:id", deleteExpense);
export default r;
