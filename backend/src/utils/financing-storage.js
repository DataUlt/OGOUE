import { supabaseSecondary } from "../db/supabase.js";

// ============================================================
// Stockage des pieces d'un dossier de financement
// ------------------------------------------------------------
// Bucket PRIVE, et sur le projet SECONDAIRE (celui des institutions).
//
// Prive : un dossier de credit rassemble RCCM, bilans et pieces
// d'identite. Le bucket "justificatifs" des ventes et depenses est
// public ; on ne reproduit pas ce choix ici. Les fichiers ne sont
// servis que par URL signee, a duree limitee, apres controle des
// droits par l'API.
//
// Secondaire : c'est la que vivent les dossiers, et les DEUX backends
// y ont des droits service_role. L'espace institution peut donc signer
// ses propres URL sans le moindre acces a la base d'OGOUE.
// ============================================================

const BUCKET_NAME = "dossiers-financement";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 Mo
const DUREE_URL_SIGNEE = 300; // 5 minutes

/** Cree le bucket prive s'il n'existe pas. */
export async function ensureDossiersBucketExists() {
  if (!supabaseSecondary) {
    console.warn("⚠️  Base de financement non configurée, bucket non vérifié");
    return;
  }

  try {
    const { data: buckets } = await supabaseSecondary.storage.listBuckets();
    const existe = buckets?.some((b) => b.name === BUCKET_NAME);

    if (existe) {
      console.log(`✅ Bucket ${BUCKET_NAME} already exists`);
      return;
    }

    console.log(`📦 Creating private Supabase Storage bucket: ${BUCKET_NAME}`);
    const { error } = await supabaseSecondary.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: MAX_FILE_SIZE,
    });

    if (error) throw error;
    console.log(`✅ Bucket ${BUCKET_NAME} created (private)`);
  } catch (error) {
    console.error(`❌ Error ensuring bucket ${BUCKET_NAME}:`, error?.message);
  }
}

/**
 * Depose un fichier dans le bucket prive.
 * @param {Buffer} fileBuffer
 * @param {string} originalFilename
 * @param {string} pmeId - prefixe de dossier, pour ranger par PME
 * @returns {Promise<{fileName: string, storagePath: string, fileSize: number}>}
 */
export async function uploadDossierFile(fileBuffer, originalFilename, pmeId) {
  if (!supabaseSecondary) throw new Error("Base de financement non configurée");

  if (fileBuffer.length > MAX_FILE_SIZE) {
    throw new Error("File size exceeds maximum of 10MB");
  }

  const horodatage = Date.now();
  const alea = Math.random().toString(36).substring(2, 10);
  const extension = originalFilename.includes(".") ? originalFilename.split(".").pop() : "bin";
  const chemin = `${pmeId}/${horodatage}_${alea}.${extension}`;

  const { data, error } = await supabaseSecondary.storage
    .from(BUCKET_NAME)
    .upload(chemin, fileBuffer, {
      contentType: "application/octet-stream",
      upsert: false,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  console.log(`✅ Pièce déposée : ${data.path} (${fileBuffer.length} octets)`);

  return {
    fileName: originalFilename,
    storagePath: data.path,
    fileSize: fileBuffer.length,
  };
}

/** Retire un fichier du bucket. L'echec est journalise, pas propage. */
export async function deleteDossierFile(storagePath) {
  if (!supabaseSecondary || !storagePath) return;

  try {
    const { error } = await supabaseSecondary.storage.from(BUCKET_NAME).remove([storagePath]);
    if (error) {
      console.warn(`⚠️ Pièce non supprimée : ${storagePath}`, error?.message);
      return;
    }
    console.log(`✅ Pièce supprimée : ${storagePath}`);
  } catch (error) {
    console.error("❌ Erreur suppression pièce :", error?.message);
  }
}

/**
 * Produit une URL de telechargement a duree limitee.
 * L'appelant DOIT avoir verifie les droits au prealable.
 * @returns {Promise<string|null>}
 */
export async function createDossierSignedUrl(storagePath, dureeSecondes = DUREE_URL_SIGNEE) {
  if (!supabaseSecondary || !storagePath) return null;

  const { data, error } = await supabaseSecondary.storage
    .from(BUCKET_NAME)
    .createSignedUrl(storagePath, dureeSecondes);

  if (error) {
    console.error("❌ Erreur URL signée :", error.message);
    return null;
  }

  return data?.signedUrl || null;
}
