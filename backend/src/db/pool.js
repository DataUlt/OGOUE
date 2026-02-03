import pg from "pg";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const { Pool } = pg;

// ✅ Charger le .env ICI, dans pool.js
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, "..", "..", ".env");

// Charger manuellement
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      const value = valueParts.join("=");
      process.env[key.trim()] = value.trim();
    }
  });
  console.log("✅ .env chargé dans pool.js");
}

const isProd = process.env.NODE_ENV === "production";

// ✅ On récupère la variable (et on vérifie qu'elle existe)
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL || typeof DATABASE_URL !== "string") {
  console.error("❌ DATABASE_URL manquante ou invalide.");
  console.error("👉 Vérifie ton fichier backend/.env et assure-toi d'avoir une ligne du type :");
  console.error("   DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/ogoue_dev");
  console.error("👉 Valeur actuelle :", DATABASE_URL);
  console.error("\n⚠️ Assurez-vous que PostgreSQL est en cours d'exécution !");
  console.error("   Windows: Services → PostgreSQL → Démarrer");
  console.error("   Linux/Mac: brew services start postgresql");
  process.exit(1); // on stoppe proprement au lieu d'une erreur pg incompréhensible
}

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isProd ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});
