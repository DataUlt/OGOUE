// Comptes PME orphelins dans la base des dossiers de financement.
//
// Un compte OGOUE est recopié dans la base Financement à sa première
// connexion (auth.controller.js, syncToSecondarySupabase). Quand il disparaît
// d'OGOUE (purge d'un compte fermé, ou suppression à la main dans Supabase),
// rien ne le retirait de la base Financement : il y restait orphelin.
//
// Ce nettoyage, lancé avec la purge des comptes (au démarrage puis chaque
// jour), retire de la base Financement les comptes PME dont l'adresse
// n'existe plus dans OGOUE, ni comme compte de connexion ni comme fiche :
// brouillons de dossiers (et leurs pièces), fiche PME, fiche utilisateur,
// compte de connexion.
//
// Même règle que la purge : un compte qui a déposé un dossier auprès d'une
// institution est gardé, l'institution peut en avoir besoin.
//
// Garde-fous : si la liste des comptes OGOUE ne peut pas être lue, ou paraît
// vide, rien n'est effacé. Un compte créé depuis moins d'une journée est
// laissé de côté (une inscription peut être en cours).

import { supabase, supabaseSecondary } from "../db/supabase.js";
import { lireToutesLesLignes } from "./pagination.js";

const UNE_JOURNEE_MS = 24 * 60 * 60 * 1000;
const norm = (e) => String(e || "").trim().toLowerCase();

async function comptesDeConnexion(client) {
  const comptes = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`liste des comptes de connexion : ${error.message}`);
    const lot = data?.users || [];
    comptes.push(...lot);
    if (lot.length < 1000) break;
  }
  return comptes;
}

async function lireTout(client, table, colonnes, filtre) {
  const { data, error } = await lireToutesLesLignes(() => {
    const q = client.from(table).select(colonnes).order("id");
    return filtre ? filtre(q) : q;
  });
  if (error) throw new Error(`lecture ${table} : ${error.message}`);
  return data || [];
}

export async function nettoyerFinancementOrphelins() {
  if (!supabaseSecondary) return;

  // 1. Toutes les adresses connues d'OGOUE (comptes de connexion et fiches)
  const authOgoue = await comptesDeConnexion(supabase);
  const fichesOgoue = await lireTout(supabase, "users", "id, email");
  if (!authOgoue.length || !fichesOgoue.length) {
    console.warn("⚠️  Nettoyage Financement annulé : la liste des comptes OGOUE paraît vide");
    return;
  }
  const connues = new Set([...authOgoue.map((u) => norm(u.email)), ...fichesOgoue.map((u) => norm(u.email))]);

  // 2. Comptes PME de la base Financement absents d'OGOUE depuis plus d'une journée
  const limite = Date.now() - UNE_JOURNEE_MS;
  const pmesUsers = await lireTout(supabaseSecondary, "users", "id, email, created_at", (q) => q.eq("role", "pme"));
  const orphelins = pmesUsers.filter((u) =>
    u.email && !connues.has(norm(u.email)) && new Date(u.created_at).getTime() < limite);
  if (!orphelins.length) return;

  const authFinancement = await comptesDeConnexion(supabaseSecondary);
  const authParEmail = new Map(authFinancement.map((u) => [norm(u.email), u]));

  for (const u of orphelins) {
    try {
      const { data: pmes, error: e1 } = await supabaseSecondary.from("pmes").select("id").eq("user_id", u.id);
      if (e1) throw new Error(`lecture pmes : ${e1.message}`);
      const pmeIds = (pmes || []).map((p) => p.id);

      let brouillons = [];
      if (pmeIds.length) {
        const { data: dossiers, error: e2 } = await supabaseSecondary
          .from("loan_applications").select("id, status").in("pme_id", pmeIds);
        if (e2) throw new Error(`lecture dossiers : ${e2.message}`);
        // Un dossier déposé : on garde tout le compte
        if ((dossiers || []).some((d) => d.status !== "brouillon")) {
          console.log(`ℹ️  Financement : ${u.email} absent d'OGOUE mais a déposé un dossier, conservé`);
          continue;
        }
        brouillons = (dossiers || []).map((d) => d.id);
      }

      if (brouillons.length) {
        const { data: pieces } = await supabaseSecondary
          .from("application_documents").select("storage_path").in("application_id", brouillons);
        const chemins = [...new Set((pieces || []).map((p) => p.storage_path).filter(Boolean))];
        if (chemins.length) {
          const { error: eF } = await supabaseSecondary.storage.from("dossiers-financement").remove(chemins);
          if (eF) console.warn(`⚠️  Financement : pièces de ${u.email} non retirées :`, eF.message);
        }
        // Pièces, messages et historique suivent (ON DELETE CASCADE)
        const { error: e3 } = await supabaseSecondary.from("loan_applications").delete().in("id", brouillons);
        if (e3) throw new Error(`effacement brouillons : ${e3.message}`);
      }

      const { error: e4 } = await supabaseSecondary.from("pmes").delete().eq("user_id", u.id);
      if (e4) throw new Error(`effacement pmes : ${e4.message}`);
      const { error: e5 } = await supabaseSecondary.from("users").delete().eq("id", u.id);
      if (e5) throw new Error(`effacement fiche : ${e5.message}`);

      const compte = authParEmail.get(norm(u.email));
      if (compte) {
        const { error: e6 } = await supabaseSecondary.auth.admin.deleteUser(compte.id);
        if (e6 && !/not.?found/i.test(e6.message)) throw new Error(`compte de connexion : ${e6.message}`);
      }
      console.log(`🗑️  Financement : compte orphelin ${u.email} retiré`);
    } catch (e) {
      console.error(`❌ Financement : nettoyage de ${u.email} interrompu, repris au prochain passage :`, e.message);
    }
  }
}
