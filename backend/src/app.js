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
  .map((o) => o.trim().toLowerCase())
  .filter(Boolean);

console.info && console.info('CORS allowedOrigins:', allowedOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      try {
        console.debug && console.debug('CORS check:', { origin, allowedOrigins });

        // allow server-to-server / curl / same-origin (no Origin header)
        if (!origin) return callback(null, true);

        // if no env var set, allow all (dev fallback)
        if (allowedOrigins.length === 0) return callback(null, true);

        // wildcard support
        if (allowedOrigins.includes('*')) return callback(null, true);

        // compare in lowercase
        if (allowedOrigins.includes(origin.toLowerCase())) return callback(null, true);

        console.warn(`CORS blocked for origin: ${origin}`);
        return callback(null, false);
      } catch (err) {
        console.error('CORS origin check error:', err && err.stack ? err.stack : err);
        return callback(null, false);
      }
    },
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
