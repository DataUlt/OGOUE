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

// Use a function for CORS origin checking with regex fallback
const corsOptions = {
  origin: function (origin, callback) {
    console.log('🔍 [CORS] Incoming origin:', origin);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('✅ [CORS] No origin (accepted)');
      return callback(null, true);
    }
    
    // Get allowed origins from env or use defaults
    const corsOriginString = process.env.CORS_ORIGIN || "https://ogoue.com,https://www.ogoue.com,https://app.ogoue.com,https://ogoue-frontend.netlify.app,http://localhost:3000,http://localhost:3001,http://localhost:8080,http://127.0.0.1:8080";
    const allowedOrigins = corsOriginString
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
    
    // Check explicit list first
    if (allowedOrigins.includes(origin)) {
      console.log('✅ [CORS] Origin allowed (explicit):', origin);
      return callback(null, true);
    }
    
    // Fallback: Allow any ogoue.com domain or localhost
    const ogoueRegex = /^https?:\/\/([a-z0-9-]*\.)*ogoue\.com(:\d+)?$/i;
    const localhostRegex = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
    
    if (ogoueRegex.test(origin) || localhostRegex.test(origin)) {
      console.log('✅ [CORS] Origin allowed (regex):', origin);
      return callback(null, true);
    }
    
    console.log('❌ [CORS] Origin NOT allowed:', origin);
    console.log('📋 [CORS] Allowed origins list:', allowedOrigins);
    console.log('📋 [CORS] Allowed by regex: *.ogoue.com or localhost');
    callback(new Error('CORS policy: origin ' + origin + ' not allowed'));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));

// make sure preflight is handled
app.options("*", cors(corsOptions));

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
