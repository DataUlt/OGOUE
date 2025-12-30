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

// Get CORS origins from env var, with fallback for dev
const corsOriginString = process.env.CORS_ORIGIN || "https://ogoue.com,https://www.ogoue.com,https://ogoue-frontend.netlify.app,http://localhost:3000,http://localhost:3001";
const allowedOrigins = corsOriginString
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

console.info('✅ CORS allowedOrigins:', allowedOrigins);

// CORS configuration with function for better debugging
const corsOptions = {
  origin: function (origin, callback) {
    console.log('🔍 [CORS] Incoming origin:', origin);
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      console.log('✅ [CORS] No origin (accepted)');
      return callback(null, true);
    }
    
    const isAllowed = allowedOrigins.includes(origin);
    
    if (isAllowed) {
      console.log('✅ [CORS] Origin accepted:', origin);
      callback(null, true);
    } else {
      console.error('❌ [CORS] Origin blocked:', origin);
      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// TEMP DEBUG MIDDLEWARE: force CORS headers for all responses
// NOTE: garder uniquement pour debug rapide, retirer une fois résolu
app.use((req, res, next) => {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Apply cors with our options as well (keeps existing behavior)
app.use(cors(corsOptions));

// Handle preflight with same options
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
