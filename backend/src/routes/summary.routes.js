import { Router } from "express";
import { monthSummary } from "../controllers/summary.controller.js";

const r = Router();
r.get("/month", monthSummary);
export default r;
