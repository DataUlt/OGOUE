import { supabase } from "../db/supabase.js";

const BUCKET_NAME = "justificatifs";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Crée le bucket s'il n'existe pas
 */
export async function ensureBucketExists() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (!bucketExists) {
      console.log(`📦 Creating Supabase Storage bucket: ${BUCKET_NAME}`);
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
      });
      console.log(`✅ Bucket ${BUCKET_NAME} created successfully`);
    } else {
      console.log(`✅ Bucket ${BUCKET_NAME} already exists`);
    }
  } catch (error) {
    console.error(`❌ Error ensuring bucket exists:`, error?.message);
  }
}

/**
 * Upload un fichier vers Supabase Storage
 * @param {Buffer} fileBuffer - Contenu du fichier
 * @param {string} originalFilename - Nom original du fichier
 * @param {string} organizationId - ID de l'organisation (pour organiser les fichiers)
 * @returns {Promise<{fileName: string, fileUrl: string, fileSize: number}>}
 */
export async function uploadFileToSupabase(fileBuffer, originalFilename, organizationId) {
  try {
    // Valider la taille du fichier
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum of 10MB`);
    }

    // Créer un nom unique pour le fichier
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 10);
    const fileExtension = originalFilename.split(".").pop();
    const fileName = `${organizationId}/${timestamp}_${randomId}.${fileExtension}`;

    // Upload vers Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, fileBuffer, {
        contentType: "application/octet-stream",
        upsert: false,
      });

    if (error) {
      throw new Error(`Upload failed: ${error.message}`);
    }

    // Obtenir l'URL publique
    const { data: publicUrlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(data.path);

    const fileUrl = publicUrlData.publicUrl;

    console.log(`✅ File uploaded: ${fileName} (${fileBuffer.length} bytes)`);

    return {
      fileName: originalFilename, // Nom original pour affichage
      storagePath: data.path, // Chemin dans le storage
      fileUrl, // URL publique
      fileSize: fileBuffer.length,
    };
  } catch (error) {
    console.error(`❌ Error uploading file:`, error?.message);
    throw error;
  }
}

/**
 * Supprime un fichier du Supabase Storage
 * @param {string} storagePath - Chemin complet du fichier dans le storage
 */
export async function deleteFileFromSupabase(storagePath) {
  try {
    if (!storagePath) return;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    if (error) {
      console.warn(`⚠️ Could not delete file: ${storagePath}`, error?.message);
      return;
    }

    console.log(`✅ File deleted: ${storagePath}`);
  } catch (error) {
    console.error(`❌ Error deleting file:`, error?.message);
  }
}
