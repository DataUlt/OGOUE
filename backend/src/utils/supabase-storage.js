import { supabase } from "../db/supabase.js";

const BUCKET_NAME = "justificatifs";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Duree de vie d'un lien signe. Assez pour ouvrir le document ou le
// telecharger, trop court pour etre partage utilement. Meme valeur que
// pour les recus et les pieces de dossier.
const DUREE_LIEN_SECONDES = 300;

/**
 * Cree le bucket s'il n'existe pas, et le ferme s'il etait ouvert.
 *
 * Le bucket a longtemps ete public : un RCCM, une facture ou un etat
 * financier se lisait sans authentification pour qui connaissait l'URL,
 * et ces URL etaient enregistrees en clair dans `sales.receipt_url`. La
 * fermeture est donc rattrapee ici au demarrage, pour qu'un
 * environnement restaure depuis une vieille sauvegarde ne rouvre pas la
 * porte en silence.
 */
export async function ensureBucketExists() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucket = buckets?.find((b) => b.name === BUCKET_NAME);

    if (!bucket) {
      console.log(`📦 Creating Supabase Storage bucket: ${BUCKET_NAME}`);
      await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: MAX_FILE_SIZE,
      });
      console.log(`✅ Bucket ${BUCKET_NAME} created (privé)`);
      return;
    }

    if (bucket.public) {
      console.warn(`⚠️  Bucket ${BUCKET_NAME} était PUBLIC — fermeture en cours`);
      const { error } = await supabase.storage.updateBucket(BUCKET_NAME, {
        public: false,
        fileSizeLimit: MAX_FILE_SIZE,
      });
      if (error) {
        console.error(`❌ Fermeture impossible: ${error.message}`);
      } else {
        console.log(`✅ Bucket ${BUCKET_NAME} est désormais privé`);
      }
      return;
    }

    console.log(`✅ Bucket ${BUCKET_NAME} already exists (privé)`);
  } catch (error) {
    console.error(`❌ Error ensuring bucket exists:`, error?.message);
  }
}

/**
 * Lien temporaire vers un justificatif du bucket prive.
 *
 * @param {string} storagePath - chemin enregistre a l'upload
 * @returns {Promise<string|null>} null si le lien n'a pas pu etre emis
 */
export async function urlSigneeJustificatif(storagePath, duree = DUREE_LIEN_SECONDES) {
  if (!storagePath) return null;
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, duree);

    if (error) {
      console.error("⚠️  Lien signé indisponible:", error.message);
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    console.error("⚠️  urlSigneeJustificatif:", err?.message || err);
    return null;
  }
}

/**
 * Retrouve le chemin de stockage d'un justificatif d'avant la fermeture
 * du bucket.
 *
 * Les lignes anciennes portent `receipt_url` — une URL publique — sans
 * toujours porter `receipt_storage_path`. Le chemin s'y lit apres le
 * segment `/object/public/justificatifs/`. Sans cela, ces justificatifs
 * deviendraient definitivement illisibles le jour de la fermeture.
 */
export function cheminDepuisUrlPublique(url) {
  if (!url) return null;
  const m = String(url).match(/\/object\/(?:public|sign)\/justificatifs\/([^?]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
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

    console.log(`✅ File uploaded: ${fileName} (${fileBuffer.length} bytes)`);

    // Aucune URL n'est renvoyee, et surtout aucune n'est enregistree en
    // base : un lien vers un bucket prive expire, donc le stocker
    // reviendrait a garder une adresse morte. Seul le chemin est durable,
    // et le lien s'emet a la demande.
    return {
      fileName: originalFilename, // Nom original pour affichage
      storagePath: data.path, // Chemin dans le storage
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
