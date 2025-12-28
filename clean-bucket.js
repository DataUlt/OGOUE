import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanBucket() {
  try {
    console.log("📦 Listing files in bucket...");
    const { data: files, error: listError } = await supabase.storage
      .from("justificatifs")
      .list("", {
        limit: 100,
        offset: 0,
      });

    if (listError) {
      console.error("❌ Error listing files:", listError);
      return;
    }

    console.log(`📄 Found ${files.length} files`);

    if (files.length === 0) {
      console.log("✅ Bucket is already empty");
      return;
    }

    // Récupérer tous les fichiers récursivement
    const allFiles = [];
    for (const file of files) {
      if (file.name) {
        allFiles.push(file.name);
      }
    }

    console.log(`🗑️  Deleting ${allFiles.length} files...`);
    const { error: deleteError } = await supabase.storage
      .from("justificatifs")
      .remove(allFiles);

    if (deleteError) {
      console.error("❌ Error deleting files:", deleteError);
      return;
    }

    console.log("✅ Bucket cleaned successfully");
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

cleanBucket();
