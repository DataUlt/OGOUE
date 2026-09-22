import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import salesRoutes from "./routes/sales.routes.js";
import expensesRoutes from "./routes/expenses.routes.js";
import summaryRoutes from "./routes/summary.routes.js";
import organizationRoutes from "./routes/organization.routes.js";
import agentsRoutes from "./routes/agents.routes.js";
import auditRoutes from "./routes/audit.routes.js";
import articlesRoutes from "./routes/articles.routes.js";
import financingRoutes from "./routes/financing.routes.js";
import etatsFinanciersRoutes from "./routes/etats-financiers.routes.js";
import { authMiddleware } from "./middleware/auth.middleware.js";
import { planMiddleware } from "./middleware/plan.middleware.js";
import { stockageUtilise } from "./utils/quota-stockage.js";
import { FORMULES, FORMULE_PAR_DEFAUT, droitsDe } from "./config/plans.js";
import { supabase } from "./db/supabase.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Serve static files from the frontend directory
const frontendPath = path.join(__dirname, "../../frontend");
app.use(express.static(frontendPath));

app.get("/health", (req, res) => res.json({ ok: true }));

// Routes publiques
app.use("/api/auth", authRoutes);

// Routes protégées (nécessitent JWT).
// planMiddleware suit authMiddleware : il a besoin de l'organizationId
// que celui-ci vient de résoudre, et renseigne req.droits pour la suite.
app.use("/api/sales", authMiddleware, planMiddleware, salesRoutes);
app.use("/api/expenses", authMiddleware, planMiddleware, expensesRoutes);
app.use("/api/summary", authMiddleware, planMiddleware, summaryRoutes);
app.use("/api/organization", authMiddleware, planMiddleware, organizationRoutes);
app.use("/api/agents", authMiddleware, planMiddleware, agentsRoutes);
app.use("/api/audit", authMiddleware, planMiddleware, auditRoutes);
app.use("/api/etats-financiers", authMiddleware, planMiddleware, etatsFinanciersRoutes);
app.use("/api/articles", authMiddleware, articlesRoutes);
app.use("/api/financing", authMiddleware, financingRoutes);
// Le financement reste ouvert à toutes les formules, y compris la
// gratuite : le verrouiller priverait les institutions du volume qui
// fait l'intérêt du module.

// Ce que la formule en cours autorise, pour que le frontend n'affiche
// pas des boutons qui répondront 402.
app.get("/api/plan", authMiddleware, planMiddleware, async (req, res) => {
  // La consommation n'a de sens que si la formule ouvre les documents.
  // Sur la formule gratuite, l'interroger ferait un aller-retour en base
  // pour afficher « 0 sur 0 ».
  const stockage = req.droits?.stockageGo
    ? await stockageUtilise(req.user?.organizationId)
    : null;

  res.json({
    formule: req.formule,
    droits: req.droits,
    // Echeance et jours restants, pour la jauge de la page d'abonnement.
    // null sur la formule gratuite et sur une activation sans date : il
    // n'y a alors rien a decompter.
    abonnement: req.abonnement || null,
    stockage: {
      utiliseOctets: stockage,
      quotaOctets: (req.droits?.stockageGo || 0) * 1024 * 1024 * 1024,
    },
    // Le catalogue complet accompagne la formule en cours : la page
    // d'abonnement affiche ainsi exactement les prix et les limites que
    // le backend applique, au lieu d'une copie qui pourrait diverger.
    catalogue: FORMULES,
  });
});

// Redescendre sur la formule gratuite.
//
// La montee reste manuelle — elle suppose un versement recu et verifie.
// La descente, elle, ne coute rien a personne et n'a aucune raison de
// faire attendre le client derriere un echange de mails : il reprend
// simplement ce qu'il avait au depart.
//
// Reserve au gerant : un agent ne doit pas pouvoir fermer les fonctions
// de l'organisation qui l'emploie.
app.post("/api/plan/redescendre", authMiddleware, async (req, res) => {
  const organizationId = req.user?.organizationId;

  if (!organizationId) {
    return res.status(400).json({ error: "Organisation introuvable" });
  }
  if (req.user?.role !== "manager") {
    return res.status(403).json({
      error: "Seul le gérant peut changer la formule de l'organisation.",
    });
  }

  try {
    const { data: avant } = await supabase
      .from("organizations")
      .select("plan")
      .eq("id", organizationId)
      .maybeSingle();

    if (avant?.plan === FORMULE_PAR_DEFAUT) {
      return res.status(409).json({
        error: "Votre organisation est déjà sur la formule gratuite.",
      });
    }

    // plan_note garde la trace : sans elle, une formule retombee sur
    // 'essentiel' serait indiscernable d'une activation jamais faite, le
    // jour ou le client appellera pour comprendre.
    const trace = `Retour à Essentiel demandé par le gérant le ${new Date()
      .toISOString()
      .slice(0, 10)} (formule précédente : ${avant?.plan || "inconnue"})`;

    const { error } = await supabase
      .from("organizations")
      .update({
        plan: FORMULE_PAR_DEFAUT,
        plan_periode: null,
        plan_debut: null,
        plan_expire_le: null,
        plan_note: trace,
      })
      .eq("id", organizationId);

    if (error) {
      console.error("Erreur redescendre:", error.message);
      return res.status(500).json({ error: "Internal server error" });
    }

    return res.json({
      formule: FORMULE_PAR_DEFAUT,
      droits: droitsDe(FORMULE_PAR_DEFAUT),
    });
  } catch (err) {
    console.error("Erreur redescendre:", err?.message || err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

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
