import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import salesRoutes from "./routes/sales.routes.js";
import expensesRoutes from "./routes/expenses.routes.js";
import summaryRoutes from "./routes/summary.routes.js";
import organizationRoutes from "./routes/organization.routes.js";
import agentsRoutes from "./routes/agents.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import { authMiddleware } from "./middleware/auth.middleware.js";

export const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim().toLowerCase())
  .filter(Boolean);

console.info && console.info('CORS allowedOrigins:', allowedOrigins);

// Get CORS origins from env var, with fallback for dev
const corsOriginString = process.env.CORS_ORIGIN || "https://www.ogoue.com,https://ogoue-frontend.netlify.app,http://localhost:3000";
const allowedOrigins = corsOriginString
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

console.info('✅ CORS allowedOrigins:', allowedOrigins);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// make sure preflight is handled
app.options("*", cors());

app.use(express.json({ limit: "200kb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

// Routes publiques
app.use("/api/auth", authRoutes);

// Routes protégées (nécessitent JWT)
app.use("/api/sales", authMiddleware, salesRoutes);
app.use("/api/expenses", authMiddleware, expensesRoutes);
app.use("/api/summary", authMiddleware, summaryRoutes);
app.use("/api/organization", authMiddleware, organizationRoutes);
app.use("/api/agents", authMiddleware, agentsRoutes);
app.use("/api/audit", authMiddleware, auditRoutes);

// 404
app.use((req, res) => res.status(404).json({ error: "Not found" }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  // Zod validation errors
  if (err?.name === "ZodError") {
    return res.status(400).json({ error: "Validation error", details: err.issues });
  }
  return res.status(500).json({ error: "Internal server error" });
});
