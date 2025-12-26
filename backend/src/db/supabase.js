import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, "..", "..", ".env");

// Charger manuellement le .env
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
  console.log("✅ .env chargé dans supabase.js");
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquante.");
  console.error("👉 Vérifiez votre fichier backend/.env");
  process.exit(1);
}

// Créer le client Supabase avec la clé Service Role (pour l'admin)
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Pour les requêtes authentifiées côté frontend
export const supabaseAnon = (anonKey) => {
  return createClient(SUPABASE_URL, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

console.log("✅ Supabase client initialized");
