import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import salesRoutes from "./routes/sales.routes.js";
import expensesRoutes from "./routes/expenses.routes.js";
import summaryRoutes from "./routes/summary.routes.js";
import organizationRoutes from "./routes/organization.routes.js";
import { authMiddleware } from "./middleware/auth.middleware.js";

export const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Autorise les requêtes sans Origin (Postman/curl/server-to-server)
      if (!origin) return callback(null, true);

      // Dev fallback
      if (allowedOrigins.length === 0 || process.env.CORS_ORIGIN === "*") {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "200kb" }));

app.get("/health", (req, res) => res.json({ ok: true }));

// Routes publiques
app.use("/api/auth", authRoutes);

// Routes protégées (nécessitent JWT)
app.use("/api/sales", authMiddleware, salesRoutes);
app.use("/api/expenses", authMiddleware, expensesRoutes);
app.use("/api/summary", authMiddleware, summaryRoutes);
app.use("/api/organization", authMiddleware, organizationRoutes);

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
