import PDFDocument from "pdfkit";
import { supabase } from "../db/supabase.js";

// ============================================================
// Reçus de vente émis par OGOUE
// ------------------------------------------------------------
// Chaque vente enregistrée donne lieu a un reçu, produit ici puis
// depose dans un bucket PRIVE. Un reçu porte le detail commercial
// d'une transaction : il n'a pas a etre lisible par quiconque
// connait son URL, on le sert donc par lien signe a duree limitee.
//
// Attention a ne pas confondre avec le justificatif televerse par le
// gerant (receipt_url) : celui-ci vient d'un tiers, le reçu vient de
// nous. C'est cette distinction qui permet au score de tracabilite de
// rester une mesure honnete.
// ============================================================

const BUCKET = "recus";
const DUREE_URL_SIGNEE = 300; // 5 minutes

/** Cree le bucket prive s'il n'existe pas. */
export async function ensureRecusBucketExists() {
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (buckets?.some((b) => b.name === BUCKET)) {
      console.log(`✅ Bucket ${BUCKET} already exists`);
      return;
    }

    console.log(`📦 Creating private Supabase Storage bucket: ${BUCKET}`);
    const { error } = await supabase.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 2 * 1024 * 1024,
    });
    if (error) throw error;
    console.log(`✅ Bucket ${BUCKET} created (private)`);
  } catch (error) {
    console.error(`❌ Error ensuring bucket ${BUCKET}:`, error?.message);
  }
}

/**
 * Attribue le prochain numero de reçu de l'organisation.
 * L'attribution est atomique cote base (voir sql/RECUS_DE_VENTE.sql).
 * @returns {Promise<string|null>} ex. "REC-2026-000012"
 */
export async function attribuerNumeroRecu(organizationId, annee) {
  const { data, error } = await supabase.rpc("next_receipt_number", {
    org: organizationId,
    yr: annee,
  });

  if (error || data === null || data === undefined) {
    console.error("❌ Numérotation du reçu impossible:", error?.message);
    return null;
  }

  return `REC-${annee}-${String(data).padStart(6, "0")}`;
}

const FCFA = new Intl.NumberFormat("fr-FR");

/**
 * Les polices standard du PDF (Helvetica, encodage WinAnsi) ne
 * connaissent ni l'espace insecable etroite (U+202F) ni l'espace
 * insecable (U+00A0), que Intl.NumberFormat utilise en francais pour
 * separer les milliers. Non remplacees, elles s'impriment en "/" :
 * "12 500" devient "12/500". On les ramene donc a une espace ordinaire.
 */
function espacesImprimables(texte) {
  return String(texte).replace(/[   ]/g, " ");
}

function formatMontant(valeur) {
  const n = Number(valeur) || 0;
  return espacesImprimables(`${FCFA.format(n)} FCFA`);
}

function formatDate(valeur) {
  if (!valeur) return "-";
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return String(valeur);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

const MOYENS = {
  cash: "Espèces",
  mobile_money: "Mobile Money",
  card: "Carte bancaire",
  bank_transfer: "Virement bancaire",
  cheque: "Chèque",
};

/**
 * Compose le PDF du reçu.
 * @returns {Promise<Buffer>}
 */
export function composerRecuPdf({ numero, vente, organisation, emisPar }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56 });
    const morceaux = [];

    doc.on("data", (m) => morceaux.push(m));
    doc.on("end", () => resolve(Buffer.concat(morceaux)));
    doc.on("error", reject);

    const gauche = doc.page.margins.left;
    const largeur = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ── En-tête : l'entreprise émettrice ──
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#0a0c0a")
       .text(organisation.name || "Entreprise", gauche, doc.y);

    doc.moveDown(0.2);
    doc.font("Helvetica").fontSize(9).fillColor("#5c6c60");
    const identifiants = [
      organisation.activity ? organisation.activity : null,
      organisation.rccm_number ? `RCCM : ${organisation.rccm_number}` : null,
      organisation.nif_number ? `NIF : ${organisation.nif_number}` : null,
    ].filter(Boolean);
    identifiants.forEach((ligne) => doc.text(ligne));

    // ── Titre du document ──
    doc.moveDown(1.5);
    doc.font("Helvetica-Bold").fontSize(15).fillColor("#0088CC")
       .text("REÇU DE VENTE", { align: "left" });

    doc.font("Helvetica").fontSize(10).fillColor("#0a0c0a");
    doc.moveDown(0.3);
    doc.text(`N° ${numero}`);
    doc.text(`Date de la vente : ${formatDate(vente.sale_date)}`);

    doc.moveDown(0.8);
    doc.moveTo(gauche, doc.y).lineTo(gauche + largeur, doc.y)
       .strokeColor("#d9e3e9").lineWidth(1).stroke();
    doc.moveDown(0.8);

    // ── Le détail de la vente ──
    const colonnes = [
      { titre: "Désignation", largeur: largeur * 0.44 },
      { titre: "Qté", largeur: largeur * 0.10 },
      { titre: "Prix unitaire", largeur: largeur * 0.23 },
      { titre: "Total", largeur: largeur * 0.23 },
    ];

    let x = gauche;
    const yEntete = doc.y;
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#5c6c60");
    colonnes.forEach((c, i) => {
      doc.text(c.titre, x, yEntete, { width: c.largeur, align: i === 0 ? "left" : "right" });
      x += c.largeur;
    });

    doc.moveDown(0.6);
    doc.moveTo(gauche, doc.y).lineTo(gauche + largeur, doc.y)
       .strokeColor("#d9e3e9").stroke();
    doc.moveDown(0.5);

    const quantite = Number(vente.quantity) || 1;
    const total = Number(vente.amount) || 0;
    // Le prix unitaire n'est pas stocké : on le déduit. Une remise
    // éventuelle est donc absorbée dans le prix affiché.
    const prixUnitaire = quantite > 0 ? total / quantite : total;

    const yLigne = doc.y;
    x = gauche;
    doc.font("Helvetica").fontSize(10).fillColor("#0a0c0a");
    const valeurs = [
      vente.description || "Vente",
      String(quantite),
      formatMontant(prixUnitaire),
      formatMontant(total),
    ];
    colonnes.forEach((c, i) => {
      doc.text(valeurs[i], x, yLigne, { width: c.largeur, align: i === 0 ? "left" : "right" });
      x += c.largeur;
    });

    doc.moveDown(1.2);
    doc.moveTo(gauche, doc.y).lineTo(gauche + largeur, doc.y)
       .strokeColor("#d9e3e9").stroke();
    doc.moveDown(0.6);

    // ── Total ──
    doc.font("Helvetica-Bold").fontSize(13).fillColor("#0a0c0a")
       .text(`Total : ${formatMontant(total)}`, gauche, doc.y, { width: largeur, align: "right" });

    doc.moveDown(1.2);
    doc.font("Helvetica").fontSize(10).fillColor("#0a0c0a");
    doc.text(`Moyen de paiement : ${MOYENS[vente.payment_method] || vente.payment_method || "-"}`);
    if (emisPar) doc.text(`Établi par : ${emisPar}`);

    // ── Pied de page ──
    doc.font("Helvetica").fontSize(8).fillColor("#5c6c60");
    doc.text(
      "Document émis par OGOUE à partir de la vente enregistrée. Montants exprimés en francs CFA.",
      gauche,
      doc.page.height - doc.page.margins.bottom - 24,
      { width: largeur, align: "center" }
    );

    doc.end();
  });
}

/**
 * Produit le reçu et le depose dans le bucket prive.
 * @returns {Promise<{numero: string, chemin: string}|null>} null si l'operation echoue
 */
export async function emettreRecu({ vente, organisation, emisPar }) {
  try {
    const annee = new Date(vente.sale_date || Date.now()).getFullYear();
    const numero = await attribuerNumeroRecu(organisation.id, annee);
    if (!numero) return null;

    const pdf = await composerRecuPdf({ numero, vente, organisation, emisPar });
    const chemin = `${organisation.id}/${numero}.pdf`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(chemin, pdf, { contentType: "application/pdf", upsert: true });

    if (error) {
      console.error("❌ Dépôt du reçu impossible:", error.message);
      return null;
    }

    console.log(`✅ Reçu ${numero} émis (${pdf.length} octets)`);
    return { numero, chemin };
  } catch (error) {
    console.error("❌ Émission du reçu impossible:", error?.message);
    return null;
  }
}

/** Lien de telechargement a duree limitee. */
export async function urlSigneeRecu(chemin, duree = DUREE_URL_SIGNEE) {
  if (!chemin) return null;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, duree);
  if (error) {
    console.error("❌ URL signée du reçu impossible:", error.message);
    return null;
  }
  return data?.signedUrl || null;
}
