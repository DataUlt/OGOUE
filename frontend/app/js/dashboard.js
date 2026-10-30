// js/dashboard.js
// Tableau de bord : données réelles de la période choisie, présentées selon
// Éléments absents de la page : l'opération est simplement ignorée
const fantome = new Proxy(function () {}, { get: () => fantome, set: () => true, apply: () => fantome });
const ecran = (id) => document.getElementById(id) || fantome;
// la maquette « OGOUE Refonte ». Une requête par type couvre tout ce qu'il
// faut (période, période précédente, mois en cours, aujourd'hui) ; le reste
// se filtre dans le navigateur.

const EXCHANGE_RATES = { FCFA: 1, EUR: 0.00152, USD: 0.0017 };
const SYMBOLES_DEVISE = { FCFA: "FCFA", EUR: "€", USD: "$" };

// Icônes des catégories de dépenses (celles de la maquette)
const ICONES_CATEGORIE = {
  "Marchandises": "inventory_2",
  "Transport": "local_taxi",
  "Loyer": "storefront",
  "Salaires": "badge",
  "Électricité & eau": "bolt",
  "Téléphone": "smartphone",
  "Entretien": "build",
  "Autre": "more_horiz"
};

// Couleurs des meilleures ventes, dans l'ordre de la maquette
const COULEURS_MEILLEURES = ["var(--navyInk)", "var(--cyan)", "var(--orange)", "#8FB0DA"];

// Géométrie de la courbe (identique à la maquette)
const GRAPHIQUE = { W: 1000, H: 300, N: 28 };

// ========== DEVISE ET MONTANTS ==========

function getCurrency() {
  try {
    const prefs = JSON.parse(localStorage.getItem("ogo_preferences") || "{}");
    return prefs.currency || "FCFA";
  } catch (e) {
    return "FCFA";
  }
}

// Montant converti dans la devise choisie, en chiffre et en unité séparés
function formatParts(montant) {
  const devise = getCurrency();
  const valeur = (Number(montant) || 0) * (EXCHANGE_RATES[devise] || 1);
  return {
    num: Math.round(valeur).toLocaleString("fr-FR").replace(/[  ]/g, " "),
    unit: SYMBOLES_DEVISE[devise] || devise
  };
}

// Montant dans une liste : l'unité n'apparaît que hors FCFA
function montantCourt(montant) {
  const p = formatParts(montant);
  return p.unit === "FCFA" ? p.num : `${p.num} ${p.unit}`;
}

function echapper(texte) {
  return String(texte ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// ========== DATES (heure locale, format AAAA-MM-JJ) ==========

const pad2 = (n) => String(n).padStart(2, "0");

function isoDe(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function deIso(iso) {
  const [y, m, j] = iso.split("-").map(Number);
  return new Date(y, m - 1, j);
}

// Jour d'une opération, en AAAA-MM-JJ local
function jourDe(op) {
  const brut = op.date;
  if (!brut) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(brut)) return brut;
  const d = new Date(brut);
  return isNaN(d.getTime()) ? null : isoDe(d);
}

function heureTexte(op) {
  if (!op.created_at) return "";
  const d = new Date(op.created_at);
  return isNaN(d.getTime()) ? "" : `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function heureDe(op) {
  if (!op.created_at) return null;
  const d = new Date(op.created_at);
  return isNaN(d.getTime()) ? null : d.getHours();
}

function joursEntre(debut, fin) {
  const jours = [];
  for (let d = deIso(debut); isoDe(d) <= fin; d.setDate(d.getDate() + 1)) {
    jours.push(isoDe(d));
  }
  return jours;
}

function plageAujourdhui() {
  return isoDe(new Date());
}

// Périodes rapides de la maquette : aujourd'hui, semaine (du lundi), mois
function plagePreset(preset) {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  if (preset === "jour") {
    return { preset, debut: isoDe(t), fin: isoDe(t) };
  }
  if (preset === "semaine") {
    const lundi = new Date(t);
    lundi.setDate(t.getDate() - ((t.getDay() + 6) % 7));
    return { preset, debut: isoDe(lundi), fin: isoDe(t) };
  }
  return {
    preset: "mois",
    debut: isoDe(new Date(t.getFullYear(), t.getMonth(), 1)),
    fin: isoDe(t)
  };
}

// La plage correspond-elle à une période rapide ? Sinon, plage personnalisée.
function plageDepuis(debut, fin) {
  const preset = ["jour", "semaine", "mois"].find((p) => {
    const r = plagePreset(p);
    return r.debut === debut && r.fin === fin;
  }) || null;
  return { debut, fin, preset };
}

// Période de comparaison : hier, la semaine précédente, le mois précédent,
// ou, pour une plage personnalisée, la même durée juste avant.
function periodePrecedente(debut, fin, preset) {
  if (preset === "jour") {
    const hier = deIso(debut);
    hier.setDate(hier.getDate() - 1);
    return { debut: isoDe(hier), fin: isoDe(hier) };
  }
  if (preset === "semaine") {
    const dimanche = deIso(debut);
    dimanche.setDate(dimanche.getDate() - 1);
    const lundi = new Date(dimanche);
    lundi.setDate(dimanche.getDate() - 6);
    return { debut: isoDe(lundi), fin: isoDe(dimanche) };
  }
  if (preset === "mois") {
    const m = deIso(debut);
    return {
      debut: isoDe(new Date(m.getFullYear(), m.getMonth() - 1, 1)),
      fin: isoDe(new Date(m.getFullYear(), m.getMonth(), 0))
    };
  }
  const n = joursEntre(debut, fin).length;
  const fp = deIso(debut);
  fp.setDate(fp.getDate() - 1);
  const dp = new Date(fp);
  dp.setDate(fp.getDate() - (n - 1));
  return { debut: isoDe(dp), fin: isoDe(fp) };
}

function nomMois(iso) {
  return deIso(iso).toLocaleDateString("fr-FR", { month: "long" });
}

function plusPetit(...dates) {
  return dates.reduce((a, b) => (b < a ? b : a));
}

function plusGrand(...dates) {
  return dates.reduce((a, b) => (b > a ? b : a));
}

// ========== CHARGEMENT ==========

// Une seule requête par type, sur la plus grande plage utile : la période,
// la période de comparaison, le mois en cours et aujourd'hui.
async function chargerDonnees(plage) {
  if (
    !window.OGOUE ||
    typeof window.OGOUE.getVentesPourPlage !== "function" ||
    typeof window.OGOUE.getDepensesPourPlage !== "function"
  ) {
    console.error("OGOUE store non disponible");
    return { ventes: [], depenses: [] };
  }

  const auj = plageAujourdhui();
  const prec = periodePrecedente(plage.debut, plage.fin, plage.preset);
  const debut = plusPetit(prec.debut, plage.debut, plagePreset("mois").debut, auj);
  const fin = plusGrand(plage.fin, auj);

  const [ventes, depenses] = await Promise.all([
    window.OGOUE.getVentesPourPlage(debut, fin),
    window.OGOUE.getDepensesPourPlage(debut, fin)
  ]);
  return { ventes: ventes || [], depenses: depenses || [] };
}

// ========== CALCULS ==========

function somme(liste) {
  return liste.reduce((t, x) => t + (Number(x.montant) || 0), 0);
}

// Variation en pourcentage ; sans référence (période précédente à zéro), pas de pourcentage
function variation(actuel, precedent) {
  if (!precedent) return null;
  return ((actuel - precedent) / Math.abs(precedent)) * 100;
}

function etiquetteJour(iso, nombre) {
  const d = deIso(iso);
  if (nombre <= 7) {
    const j = d.toLocaleDateString("fr-FR", { weekday: "short" });
    return j.charAt(0).toUpperCase() + j.slice(1);
  }
  return `${d.getDate()} ${d.toLocaleDateString("fr-FR", { month: "short" })}`;
}

// ========== SÉRIES DU GRAPHIQUE ==========
// Chaque courbe passe exactement par des points réels : un point par jour
// sur une période, un point à l'heure exacte de chaque opération sur une journée.

// Heure décimale d'une opération (12h30 → 12.5), ou null sans horodatage
function heureDecimale(op) {
  if (!op.created_at) return null;
  const d = new Date(op.created_at);
  return isNaN(d.getTime()) ? null : d.getHours() + d.getMinutes() / 60;
}

// Ajoute un point ; deux opérations au même instant ne font qu'un point
function ajouterPoint(points, x, y) {
  const dernier = points[points.length - 1];
  if (dernier.x === x) dernier.y = y;
  else points.push({ x, y });
}

// Courbe cumulée sur une journée (x entre 0 = 8h et 1 = 20h)
function courbeHoraire(operations) {
  const triees = operations
    .map((o) => ({ o, t: heureDecimale(o) }))
    .sort((a, b) => (a.t ?? -1) - (b.t ?? -1));
  const points = [{ x: 0, y: 0 }];
  let cumul = 0;
  triees.forEach(({ o, t }) => {
    cumul += Number(o.montant) || 0;
    const x = t === null ? 0 : (Math.min(20, Math.max(8, t)) - 8) / 12;
    ajouterPoint(points, x, cumul);
  });
  ajouterPoint(points, 1, cumul);
  return points;
}

// Séries cumulées (entrées, sorties) et opérations de chaque créneau
function construireSerie(jours, ventes, depenses) {
  if (jours.length === 0) {
    return { entrees: [{ x: 0, y: 0 }], sorties: [{ x: 0, y: 0 }], etiquettes: [], seaux: [], heures: false, jours: 0 };
  }

  if (jours.length === 1) {
    const seaux = Array.from({ length: 12 }, (_, i) => ({ libelle: `${8 + i}h`, ventes: [], depenses: [] }));
    const idx = (h) => Math.max(0, Math.min(11, Math.floor(h) - 8));
    ventes.forEach((v) => { const h = heureDecimale(v); if (h !== null) seaux[idx(h)].ventes.push(v); });
    depenses.forEach((d) => { const h = heureDecimale(d); if (h !== null) seaux[idx(h)].depenses.push(d); });
    return {
      entrees: courbeHoraire(ventes),
      sorties: courbeHoraire(depenses),
      etiquettes: ["8h", "10h", "12h", "14h", "16h", "18h", "20h"],
      seaux,
      heures: true,
      jours: 1
    };
  }

  const n = jours.length;
  const position = new Map(jours.map((j, i) => [j, i]));
  const seaux = jours.map((j) => ({
    libelle: deIso(j).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
    ventes: [],
    depenses: []
  }));

  // Total du jour pour chaque créneau, et opérations rangées par jour
  const parJour = (liste, cle) => {
    const totaux = Array(n).fill(0);
    liste.forEach((op) => {
      const i = position.get(jourDe(op));
      if (i !== undefined) {
        totaux[i] += Number(op.montant) || 0;
        seaux[i][cle].push(op);
      }
    });
    return totaux;
  };

  // Un point à la fin de chaque jour, valeur cumulée à cet instant
  const cumulParJour = (totaux) => {
    const points = [{ x: 0, y: 0 }];
    let cumul = 0;
    totaux.forEach((t, i) => {
      cumul += t;
      points.push({ x: (i + 1) / n, y: cumul });
    });
    return points;
  };

  const k = Math.min(n, 6);
  const etiquettes = Array.from({ length: k }, (_, j) => {
    const i = k === 1 ? 0 : Math.round((j * (n - 1)) / (k - 1));
    return etiquetteJour(jours[i], n);
  });

  return {
    entrees: cumulParJour(parJour(ventes, "ventes")),
    sorties: cumulParJour(parJour(depenses, "depenses")),
    etiquettes,
    seaux,
    heures: false,
    jours: n,
    dates: jours
  };
}

// ========== GÉOMÉTRIE DU GRAPHIQUE ==========

// Tracé lissé qui passe par chaque point sans jamais le dépasser
// (interpolation monotone) : une courbe cumulée ne redescend pas.
function tracerMonotone(pts) {
  const n = pts.length;
  let chemin = `M${pts[0].X.toFixed(1)},${pts[0].Y.toFixed(1)}`;
  if (n === 1) return chemin;

  const d = [];
  for (let k = 0; k < n - 1; k++) {
    const h = pts[k + 1].X - pts[k].X;
    d.push(h > 0 ? (pts[k + 1].Y - pts[k].Y) / h : 0);
  }
  const m = [];
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) {
    m[k] = d[k - 1] * d[k] > 0 ? (d[k - 1] + d[k]) / 2 : 0;
  }
  for (let k = 0; k < n - 1; k++) {
    if (d[k] === 0) { m[k] = 0; m[k + 1] = 0; continue; }
    const a = m[k] / d[k], b = m[k + 1] / d[k], s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[k] = t * a * d[k];
      m[k + 1] = t * b * d[k];
    }
  }

  for (let k = 0; k < n - 1; k++) {
    const h = pts[k + 1].X - pts[k].X;
    const c1x = pts[k].X + h / 3, c1y = pts[k].Y + (m[k] * h) / 3;
    const c2x = pts[k + 1].X - h / 3, c2y = pts[k + 1].Y - (m[k + 1] * h) / 3;
    chemin += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${pts[k + 1].X.toFixed(1)},${pts[k + 1].Y.toFixed(1)}`;
  }
  return chemin;
}

function graphiqueSvg(entrees, sorties) {
  const { W, H } = GRAPHIQUE;
  const maxY = Math.max(1, ...entrees.map((p) => p.y), ...sorties.map((p) => p.y)) * 1.12;
  const versPixels = (pts) => pts.map((p) => ({ X: p.x * W, Y: H - 4 - (p.y / maxY) * (H - 8) }));
  const pa = versPixels(entrees), pb = versPixels(sorties);
  const ligneA = tracerMonotone(pa), ligneB = tracerMonotone(pb);
  const tr = "transition:d .8s cubic-bezier(.2,.8,.2,1)";

  const svg = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible;display:block">` +
    `<defs><linearGradient id="gDash" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" style="stop-color:var(--cyan);stop-opacity:.45"/>` +
    `<stop offset="100%" style="stop-color:var(--cyan);stop-opacity:0"/></linearGradient></defs>` +
    `<path d="${ligneA} L${W},${H} L0,${H} Z" fill="url(#gDash)" style="${tr}"/>` +
    `<path d="${ligneB}" fill="none" vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-dasharray="2 7" style="${tr};stroke:var(--orange);stroke-width:3"/>` +
    `<path d="${ligneA}" fill="none" vector-effect="non-scaling-stroke" stroke-linecap="round" style="${tr};stroke:var(--cyan);stroke-width:3.5"/>` +
    `</svg>`;

  return { svg, finY: (pa[pa.length - 1].Y / H * 100).toFixed(2) + "%" };
}

// ========== ÉVOLUTION DE L'ACTIVITÉ ==========
// Ventes et dépenses cumulées, créneau par créneau (heure ou jour), dans le bloc du haut.
// Le dessin est à l'échelle réelle de la zone (1 unité = 1 pixel) pour garder des textes lisibles.

const ACT_ENTREE = "#14B8D9", ACT_SORTIE = "#F2A04B";
let activiteCourante = null;
let activiteDerniere = null;

function fcfa(v) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(v)).replace(/[  ]/g, " ") + " FCFA";
}

// Pas des repères : 1, 2, 2,5 ou 5 fois une puissance de dix (quatre intervalles environ)
function pasActivite(max) {
  const brut = Math.max(max, 1) / 4;
  const p = Math.pow(10, Math.floor(Math.log10(brut)));
  const f = brut / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}

function rendreActivite(v) {
  const zone = document.getElementById("actChart");
  if (!zone) return;
  activiteDerniere = v;
  const serie = v.serie;
  const seaux = serie.seaux || [];
  const n = seaux.length;
  const somme = (liste) => liste.reduce((s, o) => s + (Number(o.montant) || 0), 0);
  // Montants cumulés depuis le début de la période : la courbe montre l'évolution du total
  const cumuler = (liste) => { let t = 0; return liste.map((m) => (t += m)); };
  const ventesCreneau = seaux.map((s) => somme(s.ventes));
  const depensesCreneau = seaux.map((s) => somme(s.depenses));
  const ventes = cumuler(ventesCreneau);
  const depenses = cumuler(depensesCreneau);

  if (!n) {
    zone.innerHTML = `<p class="act-vide">Aucune opération sur la période.</p>`;
    activiteCourante = null;
    return;
  }

  // Dimensions
  const mobile = window.innerWidth <= 760;
  const W = Math.max(280, zone.clientWidth);
  const H = mobile ? 210 : 250;
  const X0 = mobile ? 66 : 84, X1 = W - 10, HAUT = 12, Y0 = H - 30;
  const max = Math.max(0, ...ventes, ...depenses);
  const pas = pasActivite(max);
  const sommet = pas * Math.max(1, Math.ceil(max / pas));
  const x = (i) => (n === 1 ? (X0 + X1) / 2 : X0 + (i * (X1 - X0)) / (n - 1));
  const y = (val) => Y0 - (val / sommet) * (Y0 - HAUT);
  const ptsV = ventes.map((val, i) => ({ X: x(i), Y: y(val) }));
  const ptsD = depenses.map((val, i) => ({ X: x(i), Y: y(val) }));
  const lV = tracerMonotone(ptsV), lD = tracerMonotone(ptsD);
  const fond = (ligne) => `${ligne} L${x(n - 1)},${Y0} L${x(0)},${Y0} Z`;

  // Repères horizontaux et montants
  const court = (val) => (mobile ? montantCourt(val) : fcfa(val));
  let grille = "";
  for (let val = 0; val <= sommet + 1e-6; val += pas) {
    grille += `<line x1="${X0}" y1="${y(val)}" x2="${X1}" y2="${y(val)}" stroke="rgba(255,255,255,.08)" stroke-width="1"/>` +
      `<text x="${X0 - 10}" y="${y(val) + 4}" text-anchor="end" class="act-axe">${court(val)}</text>`;
  }

  // Libellés de l'axe horizontal : tous si peu nombreux, sinon quelques-uns répartis
  const libelleCourt = (i) => (serie.heures ? seaux[i].libelle : etiquetteJour(serie.dates[i], n));
  const k = Math.min(n, mobile ? 4 : n <= 12 ? 12 : 7);
  const indices = k === n
    ? seaux.map((_, i) => i)
    : Array.from({ length: k }, (_, j) => Math.round((j * (n - 1)) / (k - 1)));
  const etiquettes = indices
    .map((i) => {
      const ancre = i === 0 && n > 1 ? "start" : i === n - 1 && n > 1 ? "end" : "middle";
      return `<text x="${x(i)}" y="${H - 8}" text-anchor="${ancre}" class="act-mois" data-i="${i}">${echapper(libelleCourt(i))}</text>`;
    })
    .join("");

  // Un point seulement sur les créneaux qui ont une opération ; les autres restent cachés (r=0)
  const cercles = (pts, couleur, cle, montants) =>
    pts.map((p, i) => {
      const op = montants[i] > 0 ? 1 : 0;
      return `<circle data-${cle}="${i}" data-op="${op}" cx="${p.X}" cy="${p.Y}" r="${op ? 4.5 : 0}" fill="${couleur}"/>`;
    }).join("");

  zone.innerHTML =
    `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="act-svg">` +
    `<defs><linearGradient id="actGV" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${ACT_ENTREE}" stop-opacity=".45"/><stop offset="100%" stop-color="${ACT_ENTREE}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="actGD" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${ACT_SORTIE}" stop-opacity=".3"/><stop offset="100%" stop-color="${ACT_SORTIE}" stop-opacity="0"/></linearGradient></defs>` +
    grille +
    `<path d="${fond(lV)}" fill="url(#actGV)"/><path d="${fond(lD)}" fill="url(#actGD)"/>` +
    `<path d="${lD}" fill="none" stroke="${ACT_SORTIE}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${lV}" fill="none" stroke="${ACT_ENTREE}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<line id="actGuide" x1="0" y1="${HAUT}" x2="0" y2="${Y0}" stroke="rgba(255,255,255,.45)" stroke-dasharray="5 5" visibility="hidden"/>` +
    cercles(ptsD, ACT_SORTIE, "d", depensesCreneau) + cercles(ptsV, ACT_ENTREE, "v", ventesCreneau) +
    etiquettes +
    `</svg><div class="tdb-tip act-tip" id="actTip" hidden></div>`;

  activiteCourante = { n, x, W, ventes, depenses, seaux };

  // Créneau mis en avant au départ : le dernier qui a de l'activité (sans info-bulle)
  let dernier = -1;
  ventesCreneau.forEach((val, i) => { if (val || depensesCreneau[i]) dernier = i; });
  if (dernier >= 0) mettreEnAvant(dernier, false);

  if (!zone.dataset.survol) {
    zone.dataset.survol = "1";
    const survol = (clientX) => {
      const a = activiteCourante;
      if (!a) return;
      const xv = clientX - zone.getBoundingClientRect().left;
      let meilleur = 0;
      for (let i = 1; i < a.n; i++) {
        if (Math.abs(a.x(i) - xv) < Math.abs(a.x(meilleur) - xv)) meilleur = i;
      }
      mettreEnAvant(meilleur, true);
    };
    zone.addEventListener("mousemove", (e) => survol(e.clientX));
    zone.addEventListener("mouseleave", () => { const t = zone.querySelector("#actTip"); if (t) t.hidden = true; });
    zone.addEventListener("touchstart", (e) => survol(e.touches[0].clientX), { passive: true });
    zone.addEventListener("touchmove", (e) => survol(e.touches[0].clientX), { passive: true });
    // Redessin à la nouvelle largeur
    let attente;
    window.addEventListener("resize", () => {
      clearTimeout(attente);
      attente = setTimeout(() => { if (activiteDerniere) rendreActivite(activiteDerniere); }, 150);
    });
  }
}

// Ligne pointillée, points agrandis et, au survol, info-bulle détaillée sur un créneau
function mettreEnAvant(i, avecBulle) {
  const zone = document.getElementById("actChart");
  const a = activiteCourante;
  if (!zone || !a) return;
  const guide = zone.querySelector("#actGuide");
  guide.setAttribute("x1", a.x(i));
  guide.setAttribute("x2", a.x(i));
  guide.setAttribute("visibility", "visible");
  zone.querySelectorAll("circle").forEach((c) => {
    const actif = Number(c.dataset.v ?? c.dataset.d) === i;
    c.setAttribute("r", actif ? 7 : c.dataset.op === "1" ? 4.5 : 0);
    c.setAttribute("stroke", actif ? "#0B2A5B" : "none");
    c.setAttribute("stroke-width", actif ? 3 : 0);
  });
  zone.querySelectorAll(".act-mois").forEach((t) => t.classList.toggle("is-on", Number(t.dataset.i) === i));

  const tip = zone.querySelector("#actTip");
  if (!avecBulle) { tip.hidden = true; return; }
  const seau = a.seaux[i];
  tip.innerHTML =
    `<div class="tdb-tip-h">${echapper(seau.libelle)}</div>` +
    `<div class="tdb-tip-cum">` +
    `<span><i style="background:var(--cyan)"></i>Entré ${montantCourt(a.ventes[i])}</span>` +
    `<span><i style="background:var(--orange)"></i>Sorti ${montantCourt(a.depenses[i])}</span>` +
    `</div>` +
    `<div class="tdb-tip-sec">Ventes</div>` +
    listeInfo(seau.ventes, (o) => o.description || "Vente", "+", "#007C96", "Aucune vente") +
    `<div class="tdb-tip-sec">Dépenses</div>` +
    listeInfo(seau.depenses, (d) => d.categorie || "Dépense", "−", "#0B1F3F", "Aucune dépense");
  tip.hidden = false;
  // À droite du point, ou à gauche dans la seconde moitié
  const largeur = tip.offsetWidth;
  const px = a.x(i);
  tip.style.left = Math.max(0, Math.min(a.W - largeur, px > a.W / 2 ? px - largeur - 14 : px + 14)) + "px";
}

// ========== AFFICHAGE ==========

// Solde affiché : il glisse vers sa nouvelle valeur, comme dans la maquette
let soldeAffiche = 0;
let frameSolde = null;

function afficherSolde(valeur) {
  const p = formatParts(valeur);
  ecran("tdbSolde").textContent = p.num;
  ecran("tdbUnite").textContent = p.unit;
}

function animerSolde(cible) {
  cancelAnimationFrame(frameSolde);
  if (document.hidden) {
    soldeAffiche = cible;
    afficherSolde(cible);
    return;
  }
  const depart = soldeAffiche, t0 = performance.now(), duree = 900;
  const pas = (t) => {
    const k = Math.min(1, (t - t0) / duree), e = 1 - Math.pow(1 - k, 4);
    soldeAffiche = k < 1 ? Math.round((depart + (cible - depart) * e) / 100) * 100 : cible;
    afficherSolde(soldeAffiche);
    if (k < 1) frameSolde = requestAnimationFrame(pas);
  };
  frameSolde = requestAnimationFrame(pas);
}

// Données du graphe affiché, lues par l'info-bulle au survol
let grapheCourant = null;

function rendreGraphique(serie) {
  const { svg, finY } = graphiqueSvg(serie.entrees, serie.sorties);
  ecran("tdbSvg").innerHTML = svg;
  ecran("tdbDot").style.top = finY;
  ecran("tdbXLabels").innerHTML =
    serie.etiquettes.map((l) => `<span>${echapper(l)}</span>`).join("");

  grapheCourant = serie;

  const zone = ecran("chart-evolution");
  if (!zone.dataset.survol) {
    zone.dataset.survol = "1";
    zone.addEventListener("mousemove", (e) => survolerGraphe(e.clientX));
    zone.addEventListener("touchmove", (e) => survolerGraphe(e.touches[0].clientX), { passive: true });
    zone.addEventListener("mouseleave", masquerInfoGraphe);
    zone.addEventListener("touchend", masquerInfoGraphe);
  }
}

function masquerInfoGraphe() {
  ecran("tdbTip").hidden = true;
}

// Ligne d'une opération dans l'info-bulle
function ligneInfo(titre, montant, couleur) {
  return `<div class="tdb-tip-li"><span>${echapper(titre)}</span><b style="color:${couleur}">${montant}</b></div>`;
}

// Quatre opérations au plus, puis le nombre des autres
function listeInfo(liste, titre, signe, couleur, vide) {
  if (!liste.length) return `<div class="tdb-tip-vide">${vide}</div>`;
  const haut = liste.slice(0, 4).map((o) => ligneInfo(titre(o), signe + montantCourt(o.montant), couleur)).join("");
  const reste = liste.length - 4;
  return haut + (reste > 0 ? `<div class="tdb-tip-vide">+ ${reste} autre${reste > 1 ? "s" : ""}</div>` : "");
}

// Valeur cumulée au point du curseur : celle du dernier point situé avant lui
function valeurAu(points, fraction) {
  let y = points[0].y;
  for (const p of points) {
    if (p.x <= fraction) y = p.y;
    else break;
  }
  return y;
}

function survolerGraphe(clientX) {
  if (!grapheCourant || !grapheCourant.seaux.length) return;
  const zone = ecran("chart-evolution");
  const tip = ecran("tdbTip");
  const r = zone.getBoundingClientRect();
  const fraction = Math.min(1, Math.max(0, (clientX - r.left) / r.width));

  const { entrees, sorties, seaux, heures, jours } = grapheCourant;
  let seau, entre, sortie;
  if (heures) {
    seau = seaux[Math.min(11, Math.floor(fraction * 12))];
    entre = valeurAu(entrees, fraction);
    sortie = valeurAu(sorties, fraction);
  } else {
    // Le jour survolé ; cumul à la fin de ce jour
    const j = Math.min(jours - 1, Math.floor(fraction * jours));
    seau = seaux[j];
    entre = entrees[j + 1].y;
    sortie = sorties[j + 1].y;
  }

  tip.innerHTML =
    `<div class="tdb-tip-h">${echapper(seau.libelle)}</div>` +
    `<div class="tdb-tip-cum">` +
    `<span><i style="background:var(--cyan)"></i>Entré ${montantCourt(entre)}</span>` +
    `<span><i style="background:var(--orange)"></i>Sorti ${montantCourt(sortie)}</span>` +
    `</div>` +
    `<div class="tdb-tip-sec">Ventes</div>` +
    listeInfo(seau.ventes, (v) => v.description || "Vente", "+", "var(--cyanInk)", "Aucune vente") +
    `<div class="tdb-tip-sec">Dépenses</div>` +
    listeInfo(seau.depenses, (d) => d.categorie || "Dépense", "−", "var(--ink)", "Aucune dépense");

  tip.hidden = false;
  const x = fraction * r.width;
  const largeur = tip.offsetWidth;
  tip.style.left = (fraction > 0.5 ? x - largeur - 12 : x + 12) + "px";
}

function dateCourte(iso) {
  return deIso(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// Titre de la liste selon la période choisie
function titreOperations(plage) {
  if (plage.preset === "jour") return "Aujourd'hui";
  if (plage.preset === "semaine") return "Cette semaine";
  if (plage.preset === "mois") {
    const mois = nomMois(plage.fin);
    return mois.charAt(0).toUpperCase() + mois.slice(1);
  }
  return "Sur la période";
}

// Ventes et dépenses les plus récentes de la période choisie
function rendreOperations(ops, plage) {
  const cont = document.getElementById("tdbToday");
  document.getElementById("tdbOpsTitre").textContent = titreOperations(plage);
  if (!ops.length) {
    const quand = plage.preset === "jour" ? "aujourd'hui" : "sur la période";
    cont.innerHTML = `<div class="tdb-empty">Aucune opération ${quand}.</div>`;
    return;
  }
  const plusieursJours = plage.debut !== plage.fin;
  cont.innerHTML = ops.map((op) => {
    const vente = op._type === "vente";
    const icone = vente ? "sell" : (ICONES_CATEGORIE[op.categorie] || "receipt_long");
    const couleur = vente ? "var(--cyanInk)" : "var(--orangeInk)";
    const fond = vente ? "var(--cyanSoft)" : "var(--orangeSoft)";
    const titre = vente ? (op.description || "Vente") : (op.categorie || "Dépense");
    const sansJustificatif = vente ? (!op.justificatif && !op.numeroRecu) : !op.justificatif;
    const quand = plusieursJours ? dateCourte(jourDe(op)) : "";
    const meta = [quand, heureTexte(op), op.moyen_paiement, op.created_by_name].filter(Boolean).map(echapper).join(" · ");
    const montant = (vente ? "+" : "−") + montantCourt(op.montant);
    return `<div class="tdb-op">` +
      `<span class="material-symbols-rounded tdb-op-ic" style="background:${fond};color:${couleur}">${icone}</span>` +
      `<div class="tdb-op-b"><div class="tdb-op-t">${echapper(titre)}</div>` +
      `<div class="tdb-op-m">${meta}${sansJustificatif ? '<span class="tdb-miss" title="Justificatif manquant"></span>' : ""}</div></div>` +
      `<div class="tdb-op-a" style="color:${vente ? "var(--cyanInk)" : "var(--ink)"}">${montant}</div>` +
      `</div>`;
  }).join("");
}

function rendreAFaire(items) {
  document.getElementById("tdbTodos").innerHTML = items.map((t) => {
    const contenu =
      `<span class="material-symbols-rounded tdb-todo-ic" style="color:var(--navyInk)">${t.icone}</span>` +
      `<div class="tdb-todo-b"><div class="tdb-todo-t">${echapper(t.titre)}</div><div class="tdb-todo-s">${echapper(t.texte)}</div></div>` +
      `<span class="material-symbols-rounded tdb-chev">chevron_right</span>`;
    return t.action === "justificatifs"
      ? `<button type="button" class="tdb-todo" data-ouvrir-justificatifs>${contenu}</button>`
      : `<a class="tdb-todo" href="${t.lien}">${contenu}</a>`;
  }).join("");
}

// ========== JUSTIFICATIFS MANQUANTS (fenêtre ouverte depuis « À faire ») ==========
let dernierCalcul = null;
let rechargerDashboard = () => {};

function fenetreJustificatifs() {
  return document.getElementById("modalJustificatifs");
}

function ouvrirFenetreJustificatifs() {
  if (!dernierCalcul) return;
  rendreJustificatifs(dernierCalcul);
  fenetreJustificatifs().classList.add("is-open");
}

function fermerFenetreJustificatifs() {
  fenetreJustificatifs().classList.remove("is-open");
}

function ligneJustificatif(op, type) {
  const id = echapper(op.id);
  const titre = type === "vente" ? (op.description || "Vente") : (op.categorie || "Dépense");
  const j = jourDe(op);
  const date = j ? deIso(j).toLocaleDateString("fr-FR") : "";
  const p = formatParts(op.montant);
  const boutonRecu = type === "vente"
    ? `<button type="button" class="jm-btn jm-btn-recu" data-justif-action="recu" data-type="vente" data-id="${id}"><span class="jm-ic">receipt_long</span>Éditer le reçu</button>`
    : "";
  return `<div class="jm-row">
    <div style="min-width:0">
      <p class="jm-name">${echapper(titre)}</p>
      <p class="jm-meta">${echapper(date)} • ${echapper(p.num)} ${echapper(p.unit)}</p>
    </div>
    <div class="jm-actions">${boutonRecu}<button type="button" class="jm-btn" data-justif-action="joindre" data-type="${type}" data-id="${id}"><span class="jm-ic">upload</span>Joindre un fichier</button></div>
  </div>`;
}

function rendreJustificatifs(v) {
  const ventes = v.listeVentesSansJustif || [];
  const depenses = v.listeDepensesSansJustif || [];
  document.getElementById("listeVentesSansJustif").innerHTML = ventes.length
    ? ventes.map((o) => ligneJustificatif(o, "vente")).join("")
    : '<p class="jm-empty">Aucune vente sans justificatif.</p>';
  document.getElementById("listeDepensesSansJustif").innerHTML = depenses.length
    ? depenses.map((o) => ligneJustificatif(o, "depense")).join("")
    : '<p class="jm-empty">Aucune dépense sans justificatif.</p>';
}

// Éditer le reçu d'une vente : même route que la page Ventes
async function ouvrirRecuVente(id) {
  try {
    const reponse = await fetch(`${API_BASE_URL}/api/sales/${id}/recu`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    });
    const data = await reponse.json();
    if (!reponse.ok) throw new Error(data.error || "Reçu indisponible");
    window.open(data.url, "_blank", "noopener");
  } catch (erreur) {
    alert("Le reçu n'a pas pu être ouvert : " + erreur.message);
  }
}

// Joindre un fichier à une vente ou une dépense, puis recharger le tableau de bord
function joindreFichier(type, id) {
  const champ = document.createElement("input");
  champ.type = "file";
  champ.accept = ".pdf,.jpg,.jpeg,.png";
  champ.style.display = "none";
  document.body.appendChild(champ);
  champ.addEventListener("change", async () => {
    const fichier = champ.files[0];
    document.body.removeChild(champ);
    if (!fichier) return;
    if (fichier.size > 5 * 1024 * 1024) {
      alert("Fichier trop volumineux : 5 Mo maximum.");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("receipt", fichier);
      formData.append("receiptName", fichier.name);
      const url = type === "vente" ? `${API_BASE_URL}/api/sales/${id}` : `${API_BASE_URL}/api/expenses/${id}`;
      const reponse = await fetch(url, {
        method: "PUT",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData
      });
      const data = await reponse.json();
      if (!reponse.ok) throw new Error(data.error || "Envoi impossible");
      await rechargerDashboard();
    } catch (erreur) {
      alert("Le justificatif n'a pas pu être joint : " + erreur.message);
    }
  });
  champ.click();
}

document.getElementById("tdbTodos").addEventListener("click", (e) => {
  if (e.target.closest("[data-ouvrir-justificatifs]")) ouvrirFenetreJustificatifs();
});

document.getElementById("btnFermerJustificatifs").addEventListener("click", fermerFenetreJustificatifs);
document.getElementById("btnAnnulerJustificatifs").addEventListener("click", fermerFenetreJustificatifs);
fenetreJustificatifs().addEventListener("click", (e) => {
  if (e.target === fenetreJustificatifs()) fermerFenetreJustificatifs();
  const bouton = e.target.closest("[data-justif-action]");
  if (!bouton) return;
  if (bouton.dataset.justifAction === "recu") ouvrirRecuVente(bouton.dataset.id);
  else joindreFichier(bouton.dataset.type, bouton.dataset.id);
});

function rendreMeilleures(liste, totalCA) {
  const cont = document.getElementById("tdbBest");
  if (!liste.length) {
    cont.innerHTML = `<div class="tdb-empty">Pas encore de vente sur la période.</div>`;
    return;
  }
  const max = liste[0][1] || 1;
  cont.innerHTML = liste.map(([nom, v], i) =>
    `<div class="tdb-best-row">` +
    `<div class="tdb-best-top"><span>${echapper(nom)}</span><b>${montantCourt(v)} <span class="tdb-pct">· ${totalCA > 0 ? (v / totalCA * 100).toFixed(1).replace(".", ",") : "0,0"} %</span></b></div>` +
    `</div>`
  ).join("");
}

function libellePeriode(plage, precedente) {
  if (plage.preset === "jour") return { phrase: "aujourd'hui", vs: "hier", court: "aujourd'hui" };
  if (plage.preset === "semaine") return { phrase: "cette semaine", vs: "la semaine dernière", court: "cette semaine" };
  if (plage.preset === "mois") {
    const mois = nomMois(plage.fin);
    return { phrase: `en ${mois}`, vs: nomMois(precedente.debut), court: mois };
  }
  return { phrase: "sur la période", vs: "la période précédente", court: "la période" };
}

// Calcule tout ce que la page affiche à partir des données chargées
function calculer(donnees, plage) {
  const prec = periodePrecedente(plage.debut, plage.fin, plage.preset);
  const dans = (debut, fin) => (op) => {
    const j = jourDe(op);
    return j !== null && j >= debut && j <= fin;
  };

  const ventes = donnees.ventes.filter(dans(plage.debut, plage.fin));
  const depenses = donnees.depenses.filter(dans(plage.debut, plage.fin));
  const ventesPrec = donnees.ventes.filter(dans(prec.debut, prec.fin));
  const depensesPrec = donnees.depenses.filter(dans(prec.debut, prec.fin));

  const entrees = somme(ventes);
  const sorties = somme(depenses);
  const net = entrees - sorties;
  const netPrecedent = somme(ventesPrec) - somme(depensesPrec);

  const auj = plageAujourdhui();
  const mois = plagePreset("mois");
  const dansMois = (op) => {
    const j = jourDe(op);
    return j !== null && j >= mois.debut && j <= auj;
  };

  // Opérations de la période, les plus récentes d'abord
  const cle = (op) => `${jourDe(op)} ${op.created_at || ""}`;
  const operations = [
    ...ventes.map((v) => ({ ...v, _type: "vente" })),
    ...depenses.map((d) => ({ ...d, _type: "depense" }))
  ].sort((a, b) => cle(b).localeCompare(cle(a))).slice(0, 7);

  const parDescription = {};
  ventes.forEach((v) => {
    const nom = (v.description || "").trim() || "Sans description";
    parDescription[nom] = (parDescription[nom] || 0) + (Number(v.montant) || 0);
  });
  const meilleures = Object.entries(parDescription).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const ventesSansJustif = donnees.ventes.filter((v) => dansMois(v) && !v.justificatif && !v.numeroRecu);
  const depensesSansJustif = donnees.depenses.filter((d) => dansMois(d) && !d.justificatif);

  return {
    entrees,
    sorties,
    nbVentes: ventes.length,
    nbDepenses: depenses.length,
    net,
    netPrecedent,
    variation: variation(net, netPrecedent),
    serie: construireSerie(joursEntre(plage.debut, plage.fin), ventes, depenses),
    operations,
    meilleures,
    depensesSansJustificatif: depensesSansJustif.length,
    ventesSansJustificatif: ventesSansJustif.length,
    listeDepensesSansJustif: depensesSansJustif,
    listeVentesSansJustif: ventesSansJustif,
    precedente: prec
  };
}

function afficher(donnees, plage) {
  const v = calculer(donnees, plage);
  const lib = libellePeriode(plage, v.precedente);
  dernierCalcul = v;
  if (fenetreJustificatifs().classList.contains("is-open")) rendreJustificatifs(v);

  ecran("tdbPhrase").textContent = `Ce qui reste ${lib.phrase}`;
  ecran("tdbVs").textContent = lib.vs;
  document.getElementById("tdbBestPeriode").textContent = `· ${lib.court}`;

  document.querySelectorAll(".tdb-pill").forEach((b) => {
    b.classList.toggle("is-on", b.dataset.preset === plage.preset);
  });

  const pct = v.variation;
  ecran("tdbTendance").textContent = pct === null
    ? "—"
    : `${pct >= 0 ? "+" : "−"}${Math.abs(pct).toFixed(1).replace(".", ",")} %`;
  // Flèche et couleur selon le sens de la variation
  ecran("tdbTendanceIcone").textContent = pct === null || pct === 0 ? "trending_flat" : pct > 0 ? "trending_up" : "trending_down";
  ecran("tdbTendancePastille").classList.toggle("is-baisse", pct !== null && pct < 0);

  ecran("kpi-chiffre-affaires").innerHTML = `${montantCourt(v.entrees)} <span class="tdb-nb">(${v.nbVentes})</span>`;
  ecran("kpi-depenses").innerHTML = `${montantCourt(v.sorties)} <span class="tdb-nb">(${v.nbDepenses})</span>`;

  animerSolde(v.net);
  rendreGraphique(v.serie);
  rendreActivite(v);
  rendreOperations(v.operations, plage);

  const todos = [];
  todos.push(v.depensesSansJustificatif > 0
    ? { icone: "photo_camera", titre: `${v.depensesSansJustificatif} dépense${v.depensesSansJustificatif > 1 ? "s" : ""} sans justificatif`, texte: "Ajoutez une photo de la facture", action: "justificatifs", lien: "module_depenses", couleur: "var(--orangeInk)" }
    : { icone: "task_alt", titre: "Dépenses justifiées", texte: "Rien à compléter ce mois-ci", lien: "module_depenses", couleur: "var(--cyanInk)" });
  todos.push(v.ventesSansJustificatif > 0
    ? { icone: "receipt_long", titre: `${v.ventesSansJustificatif} vente${v.ventesSansJustificatif > 1 ? "s" : ""} sans justificatif`, texte: "Joignez un justificatif ou émettez le reçu", action: "justificatifs", lien: "module_ventes", couleur: "var(--orangeInk)" }
    : { icone: "task_alt", titre: "Ventes justifiées", texte: "Rien à compléter ce mois-ci", lien: "module_ventes", couleur: "var(--cyanInk)" });
  todos.push({ icone: "description", titre: "Compte de résultat et trésorerie", texte: "Voir les états financiers", lien: "module_etats_financiers", couleur: "var(--navyInk)" });
  rendreAFaire(todos);

  rendreMeilleures(v.meilleures, v.entrees);
}

function afficherDateEtBonjour() {
  const date = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  document.getElementById("tdbDate").textContent = date.charAt(0).toUpperCase() + date.slice(1);

  let prenom = "";
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    prenom = user?.firstName || "";
  } catch (e) {
    prenom = "";
  }
  document.getElementById("tdbHello").textContent = prenom ? `Bonjour ${prenom}` : "Bonjour";
}

// ========== MÉMOIRE DU DERNIER AFFICHAGE ==========
// Au rechargement, les chiffres de la dernière visite s'affichent tout de
// suite, puis sont remplacés par ceux du serveur dès qu'ils arrivent.
//
// La clé porte l'utilisateur et l'organisation : sur un appareil partagé,
// personne ne voit les chiffres d'un autre. Seul le mois en cours est
// conservé, réduit aux champs que le tableau de bord lit.
// La déconnexion efface ces clés (ogoue-state.js, header-ui.js).
const PREFIXE_MEMOIRE = "ogo_tdb_";

function cleMemoire() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (!user?.id) return null;
    return `${PREFIXE_MEMOIRE}${user.organizationId || "org"}_${user.id}`;
  } catch (e) {
    return null;
  }
}

function lireMemoire(debut) {
  const cle = cleMemoire();
  if (!cle) return null;
  try {
    const memoire = JSON.parse(localStorage.getItem(cle) || "null");
    // Un autre mois : ces chiffres ne correspondent plus à la période.
    if (!memoire || memoire.debut !== debut) return null;
    return { ventes: memoire.ventes || [], depenses: memoire.depenses || [] };
  } catch (e) {
    return null;
  }
}

function ecrireMemoire(debut, donnees) {
  const cle = cleMemoire();
  if (!cle) return;
  try {
    localStorage.setItem(cle, JSON.stringify({
      debut,
      ventes: donnees.ventes.map((v) => ({
        date: v.date,
        montant: v.montant,
        description: v.description,
        created_at: v.created_at,
        justificatif: v.justificatif,
        numeroRecu: v.numeroRecu,
        moyen_paiement: v.moyen_paiement,
        created_by_name: v.created_by_name
      })),
      depenses: donnees.depenses.map((d) => ({
        date: d.date,
        montant: d.montant,
        categorie: d.categorie,
        created_at: d.created_at,
        justificatif: d.justificatif,
        moyen_paiement: d.moyen_paiement,
        created_by_name: d.created_by_name
      }))
    }));
  } catch (e) {
    // Espace du navigateur plein ou stockage interdit : on s'en passe.
  }
}

// ========== DÉMARRAGE ==========

document.addEventListener("DOMContentLoaded", async function () {
  let tentatives = 0;
  while (!window.OGOUE && tentatives < 50) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    tentatives++;
  }
  if (!window.OGOUE) {
    console.error("window.OGOUE n'a pas pu être chargé");
    return;
  }

  afficherDateEtBonjour();

  let plage = plagePreset("mois");
  let etat = null;
  let jeton = 0;

  function rendre() {
    if (etat) afficher(etat.donnees, etat.plage);
  }

  rechargerDashboard = () => rafraichir(plage);

  async function rafraichir(nouvelle) {
    const mon = ++jeton;
    plage = nouvelle;
    const donnees = await chargerDonnees(plage);
    if (mon !== jeton) return;
    etat = { plage, donnees };
    rendre();
    if (plage.preset === "mois") ecrireMemoire(plage.debut, donnees);
  }

  // Périodes rapides : le sélecteur de date du HTML fait le reste
  document.querySelectorAll(".tdb-pill").forEach((b) => {
    b.addEventListener("click", () => {
      const p = plagePreset(b.dataset.preset);
      document.dispatchEvent(new CustomEvent("dashboard:presetRange", {
        detail: { startDate: p.debut, endDate: p.fin }
      }));
    });
  });

  // Filtre par date (calendrier ou périodes rapides)
  document.addEventListener("dashboard:dateRangeChanged", (e) => {
    const { startDate, endDate } = e.detail || {};
    if (!startDate) return;
    rafraichir(plageDepuis(startDate, endDate || startDate));
  });

  // Changement de devise : on réaffiche sans re-télécharger
  document.addEventListener("currency:changed", () => rendre());

  // Premier affichage : la mémoire d'abord, puis le serveur
  const memoire = lireMemoire(plage.debut);
  if (memoire) {
    etat = { plage, donnees: memoire };
    rendre();
  }
  await rafraichir(plage);
});
