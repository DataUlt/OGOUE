// Effacement définitif des comptes supprimés par leur gérant.
//
// La demande ferme le compte et fixe suppression_prevue_le à J+30
// (organization.controller.js). Cette tâche, lancée par le serveur au
// démarrage puis une fois par jour, efface les comptes dont la date est
// passée : fichiers, ventes, dépenses, catalogue, agents, utilisateurs et
// l'entreprise elle-même.
//
// Côté financement, seuls les brouillons jamais envoyés sont effacés : un
// dossier déposé reste chez l'institution, qui peut en avoir besoin.
//
// Une étape qui échoue arrête l'effacement de ce compte ; il sera repris
// au passage suivant. Rien n'est effacé avant la date prévue.

import { supabase, supabaseSecondary } from "../db/supabase.js";
import { lireToutesLesLignes } from "./pagination.js";

const UNE_JOURNEE_MS = 24 * 60 * 60 * 1000;
const PAR_LOT = 100; // fichiers retirés du stockage par appel

async function retirerFichiers(client, bucket, chemins) {
  const liste = [...new Set(chemins.filter(Boolean))];
  for (let i = 0; i < liste.length; i += PAR_LOT) {
    const { error } = await client.storage.from(bucket).remove(liste.slice(i, i + PAR_LOT));
    // Un fichier introuvable ne doit pas bloquer l'effacement des données
    if (error) console.warn(`⚠️  Purge : fichiers ${bucket} non retirés :`, error.message);
  }
}

async function lire(table, colonnes, organizationId) {
  const { data, error } = await lireToutesLesLignes(() =>
    supabase.from(table).select(colonnes).eq("organization_id", organizationId).order("id"));
  if (error) throw new Error(`lecture ${table} : ${error.message}`);
  return data || [];
}

async function effacer(table, organizationId) {
  const { error } = await supabase.from(table).delete().eq("organization_id", organizationId);
  if (error) throw new Error(`effacement ${table} : ${error.message}`);
}

// Brouillons de financement jamais envoyés, et leurs pièces
async function effacerBrouillonsFinancement(userIds) {
  if (!supabaseSecondary || !userIds.length) return;
  const { data: pmes, error } = await supabaseSecondary.from("pmes").select("id").in("user_id", userIds);
  if (error) throw new Error(`lecture pmes : ${error.message}`);
  const pmeIds = (pmes || []).map((p) => p.id);
  if (!pmeIds.length) return;

  const { data: brouillons, error: e2 } = await supabaseSecondary
    .from("loan_applications").select("id").in("pme_id", pmeIds).eq("status", "brouillon");
  if (e2) throw new Error(`lecture brouillons : ${e2.message}`);
  const ids = (brouillons || []).map((b) => b.id);
  if (!ids.length) return;

  const { data: pieces } = await supabaseSecondary
    .from("application_documents").select("storage_path").in("application_id", ids);
  await retirerFichiers(supabaseSecondary, "dossiers-financement", (pieces || []).map((p) => p.storage_path));

  // Les pièces, messages et historique suivent (ON DELETE CASCADE)
  const { error: e3 } = await supabaseSecondary.from("loan_applications").delete().in("id", ids);
  if (e3) throw new Error(`effacement brouillons : ${e3.message}`);
}

export async function effacerCompte(organizationId) {
  // 1. Fichiers : justificatifs joints et reçus émis
  const ventes = await lire("sales", "id, receipt_storage_path, receipt_doc_path", organizationId);
  const depenses = await lire("expenses", "id, receipt_storage_path", organizationId);
  await retirerFichiers(supabase, "justificatifs", [
    ...ventes.map((v) => v.receipt_storage_path),
    ...depenses.map((d) => d.receipt_storage_path),
  ]);
  await retirerFichiers(supabase, "recus", ventes.map((v) => v.receipt_doc_path));

  // 2. Financement : brouillons seulement
  const utilisateurs = await lire("users", "id, auth_id", organizationId);
  await effacerBrouillonsFinancement(utilisateurs.map((u) => u.id));

  // 3. Données, des tables filles vers l'entreprise
  for (const table of ["stock_movements", "sales", "expenses", "articles", "agents", "deletion_audit", "receipt_counters"]) {
    await effacer(table, organizationId);
  }

  // 4. Comptes de connexion, puis fiches utilisateurs
  for (const u of utilisateurs) {
    if (!u.auth_id) continue;
    const { error } = await supabase.auth.admin.deleteUser(u.auth_id);
    if (error && !/not.?found/i.test(error.message)) throw new Error(`compte de connexion ${u.id} : ${error.message}`);
  }
  await effacer("users", organizationId);

  const { error } = await supabase.from("organizations").delete().eq("id", organizationId);
  if (error) throw new Error(`effacement organisation : ${error.message}`);
}

export async function purgerComptesExpires() {
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .not("suppression_prevue_le", "is", null)
    .lte("suppression_prevue_le", new Date().toISOString());

  if (error) {
    // Colonne absente tant que sql/SUPPRESSION_COMPTE.sql n'est pas passé
    console.warn("⚠️  Purge des comptes supprimés impossible :", error.message);
    return;
  }

  for (const { id } of data || []) {
    try {
      await effacerCompte(id);
      console.log(`🗑️  Compte ${id} définitivement effacé`);
    } catch (e) {
      console.error(`❌ Effacement du compte ${id} interrompu, repris au prochain passage :`, e.message);
    }
  }
}

// Au démarrage (après une minute, le temps que le serveur soit prêt), puis chaque jour
export function planifierPurgeComptes() {
  const lancer = () => purgerComptesExpires().catch((e) => console.error("❌ Purge des comptes :", e?.message));
  setTimeout(lancer, 60 * 1000);
  setInterval(lancer, UNE_JOURNEE_MS);
}
