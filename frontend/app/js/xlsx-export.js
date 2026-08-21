// js/xlsx-export.js
// ============================================================
// PRODUCTION DE CLASSEURS EXCEL (.xlsx)
// ------------------------------------------------------------
// Un .xlsx est une archive ZIP contenant des fichiers XML. On la
// fabrique ici a la main, sans bibliotheque.
//
// Pourquoi : les bibliotheques du marche pesent de 450 Ko a 1 Mo, a
// telecharger a chaque export. Nos utilisateurs sont au Gabon, souvent
// en 3G, avec des forfaits factures au megaoctet. Ce fichier fait
// quelques kilo-octets et fonctionne meme sans reseau.
//
// Les entrees de l'archive sont stockees sans compression (methode 0) :
// c'est autorise par le format ZIP et cela evite d'embarquer un
// compresseur. Nos classeurs pesent quelques dizaines de kilo-octets.
// ============================================================

// ─────────────────────────────────────────────────
// Briques ZIP
// ─────────────────────────────────────────────────

/** Table de CRC-32, calculee une fois. */
const TABLE_CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(octets) {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i++) {
    c = TABLE_CRC[(c ^ octets[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

const u16 = (n) => [n & 0xff, (n >>> 8) & 0xff];
const u32 = (n) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

/**
 * Assemble une archive ZIP sans compression.
 * @param {Array<{nom: string, contenu: string}>} fichiers
 * @returns {Uint8Array}
 */
function construireZip(fichiers) {
  const encodeur = new TextEncoder();
  const morceaux = [];
  const entrees = [];
  let position = 0;

  // L'horodatage MS-DOS ne descend pas avant 1980 ; on fige une date
  // valide plutot que de dependre de l'horloge locale.
  const heureDos = 0;
  const dateDos = ((2020 - 1980) << 9) | (1 << 5) | 1;

  for (const fichier of fichiers) {
    const nom = encodeur.encode(fichier.nom);
    const contenu = encodeur.encode(fichier.contenu);
    const crc = crc32(contenu);

    const enteteLocale = [
      ...u32(0x04034b50),
      ...u16(20),          // version minimale
      ...u16(0x0800),      // noms de fichiers en UTF-8
      ...u16(0),           // methode 0 : stocke, non compresse
      ...u16(heureDos), ...u16(dateDos),
      ...u32(crc),
      ...u32(contenu.length), ...u32(contenu.length),
      ...u16(nom.length), ...u16(0),
    ];

    entrees.push({ nom, contenu, crc, decalage: position });
    morceaux.push(new Uint8Array(enteteLocale), nom, contenu);
    position += enteteLocale.length + nom.length + contenu.length;
  }

  const debutCentral = position;
  for (const e of entrees) {
    const enteteCentrale = [
      ...u32(0x02014b50),
      ...u16(20), ...u16(20),
      ...u16(0x0800),
      ...u16(0),
      ...u16(heureDos), ...u16(dateDos),
      ...u32(e.crc),
      ...u32(e.contenu.length), ...u32(e.contenu.length),
      ...u16(e.nom.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0),
      ...u32(0),
      ...u32(e.decalage),
    ];
    morceaux.push(new Uint8Array(enteteCentrale), e.nom);
    position += enteteCentrale.length + e.nom.length;
  }

  const finCentral = new Uint8Array([
    ...u32(0x06054b50),
    ...u16(0), ...u16(0),
    ...u16(entrees.length), ...u16(entrees.length),
    ...u32(position - debutCentral),
    ...u32(debutCentral),
    ...u16(0),
  ]);
  morceaux.push(finCentral);

  const total = morceaux.reduce((n, m) => n + m.length, 0);
  const archive = new Uint8Array(total);
  let curseur = 0;
  for (const m of morceaux) {
    archive.set(m, curseur);
    curseur += m.length;
  }
  return archive;
}

// ─────────────────────────────────────────────────
// Briques XML du classeur
// ─────────────────────────────────────────────────

function echapperXml(valeur) {
  return String(valeur)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // Les caracteres de controle rendent le fichier illisible par Excel
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
}

/** Numero de colonne vers sa lettre : 1 -> A, 27 -> AA. */
function lettreColonne(index) {
  let lettre = "";
  while (index > 0) {
    const reste = (index - 1) % 26;
    lettre = String.fromCharCode(65 + reste) + lettre;
    index = Math.floor((index - 1) / 26);
  }
  return lettre;
}

/**
 * Une cellule numerique reste un nombre pour Excel : c'est tout
 * l'interet du format par rapport au CSV, ou tout est du texte.
 */
function cellule(reference, valeur) {
  if (valeur === null || valeur === undefined || valeur === "") {
    return `<c r="${reference}"/>`;
  }
  if (typeof valeur === "number" && Number.isFinite(valeur)) {
    return `<c r="${reference}"><v>${valeur}</v></c>`;
  }
  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${echapperXml(valeur)}</t></is></c>`;
}

function feuilleXml(lignes) {
  const corps = lignes.map((ligne, i) => {
    const numero = i + 1;
    const cellules = ligne
      .map((valeur, j) => cellule(`${lettreColonne(j + 1)}${numero}`, valeur))
      .join("");
    return `<row r="${numero}">${cellules}</row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${corps}</sheetData></worksheet>`;
}

/** Excel refuse ces caracteres dans un nom d'onglet, et le limite a 31 signes. */
function nomFeuilleValide(nom, index) {
  const nettoye = String(nom).replace(/[\\\/\?\*\[\]:]/g, " ").trim().slice(0, 31);
  return nettoye || `Feuille${index + 1}`;
}

/**
 * Construit le classeur.
 * @param {Array<{nom: string, lignes: Array<Array>}>} feuilles
 * @returns {Uint8Array}
 */
export function construireClasseur(feuilles) {
  if (!feuilles.length) throw new Error("Un classeur doit contenir au moins une feuille");

  const noms = feuilles.map((f, i) => nomFeuilleValide(f.nom, i));

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${feuilles.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
</Types>`;

  const relsRacine = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>
${noms.map((nom, i) => `<sheet name="${echapperXml(nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("\n")}
</sheets></workbook>`;

  const relsWorkbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${feuilles.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
</Relationships>`;

  const fichiers = [
    { nom: "[Content_Types].xml", contenu: contentTypes },
    { nom: "_rels/.rels", contenu: relsRacine },
    { nom: "xl/workbook.xml", contenu: workbook },
    { nom: "xl/_rels/workbook.xml.rels", contenu: relsWorkbook },
    ...feuilles.map((f, i) => ({
      nom: `xl/worksheets/sheet${i + 1}.xml`,
      contenu: feuilleXml(f.lignes),
    })),
  ];

  return construireZip(fichiers);
}

/** Construit le classeur et le propose au telechargement. */
export function telechargerClasseur(nomFichier, feuilles) {
  const octets = construireClasseur(feuilles);
  const blob = new Blob([octets], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const lien = document.createElement("a");
  lien.href = url;
  lien.download = nomFichier;
  document.body.appendChild(lien);
  lien.click();
  document.body.removeChild(lien);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default { construireClasseur, telechargerClasseur };
