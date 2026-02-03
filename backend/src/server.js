import { app } from "./app.js";
import { ensureBucketExists } from "./utils/supabase-storage.js";

const port = Number(process.env.PORT || 3001);

console.log(`🚀 Starting server on port ${port}...`);

// Initialiser le bucket Supabase Storage
ensureBucketExists().catch(err => {
  console.error("⚠️ Warning: Could not ensure bucket exists", err?.message);
  // Continuer quand même, le bucket peut déjà exister
});

try {
  const server = app.listen(port, "0.0.0.0", () => {
    console.log(`✅ API is running on http://localhost:${port}`);
    console.log(`✅ Access from browser: http://127.0.0.1:${port}`);
  });

  server.on("error", (err) => {
    console.error("❌ Server error:", err.message, err.code);
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${port} is already in use`);
    }
    process.exit(1);
  });
} catch (err) {
  console.error("❌ Failed to start server:", err.message);
  process.exit(1);
}

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});


