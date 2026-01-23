// js/dashboard.js

// Variables globales pour les KPI
let globalKPIData = {
  totalVentes: 0,
  totalDepenses: 0,
  resultat: 0,
  ventesCount: 0,
  depensesCount: 0
};

// Variables globales pour les graphiques
let globalChartData = {
  evolutionChartData: [],
  repartitionChartData: {}
};

// Constantes d'échange
const EXCHANGE_RATES = {
  'FCFA': 1,
  'EUR': 0.00152,
  'USD': 0.0017
};

// Récupérer la devise depuis les préférences
function getCurrency() {
  try {
    const prefs = JSON.parse(localStorage.getItem('ogo_preferences') || '{}');
    return prefs.currency || 'FCFA';
  } catch(e) {
    return 'FCFA';
  }
}

function formatMontant(montant) {
  if (typeof montant !== "number" || isNaN(montant)) return "0 FCFA";
  
  const currency = getCurrency();
  const rate = EXCHANGE_RATES[currency] || 1;
  const convertedAmount = montant * rate;
  
  // Symboles des devises
  const symbols = {
    'FCFA': 'FCFA',
    'EUR': '€',
    'USD': '$'
  };
  const symbol = symbols[currency] || currency;
  
  return (
    convertedAmount.toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) + " " + symbol
  );
}

// Fonction pour mettre à jour l'affichage des KPI (sans re-fetcher les données)
function updateKPIDisplay() {
  const kpiChiffre = document.getElementById("kpi-chiffre-affaires");
  const kpiDepenses = document.getElementById("kpi-depenses");
  const kpiResultat = document.getElementById("kpi-resultat");

  if (kpiChiffre) {
    kpiChiffre.textContent = formatMontant(globalKPIData.totalVentes || 0);
  }

  if (kpiDepenses) {
    kpiDepenses.textContent = formatMontant(globalKPIData.totalDepenses || 0);
  }

  if (kpiResultat) {
    kpiResultat.textContent = formatMontant(globalKPIData.resultat || 0);
  }

  console.log("🔄 KPI display mis à jour avec devise:", getCurrency());
}

// Helpers
function normalizeDate(iso) {
  if (!iso) return null;
  // Parser la date ISO complète (qui est en UTC)
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  
  // Créer une nouvelle date avec la date LOCALE (pas UTC)
  // Si on reçoit "2025-12-21T23:00:00.000Z" (23h UTC du 21),
  // c'est minuit le 22 en heure locale GMT+1, donc on doit retourner le 22
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function parseLocalDateParts(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
  }
  const parts = String(dateStr).split("-");
  if (parts.length >= 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const dd = parseInt(parts[2], 10);
    return { year: y, month: m, day: dd };
  }
  return null;
}

function buildRangeChecker(startISO, endISO) {
  const start = normalizeDate(startISO);
  const end = normalizeDate(endISO || startISO);
  return (iso) => {
    if (!start) return true;
    const d = normalizeDate(iso);
    if (!d) return false;
    return d >= start && d <= end;
  };
}

function groupByDay(ventes, mois, annee) {
  const byDay = {};
  ventes.forEach((vente) => {
    const dateStr = vente.date || vente.sale_date || vente.saleDate;
    const parsed = parseLocalDateParts(dateStr);
    if (!parsed) return;

    const { year: y, month: m, day: d } = parsed;
    if (m === mois && y === annee) {
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push({ ...vente, _localDateParts: parsed });
    }
  });
  return byDay;
}

// Fonction helper: obtenir tous les mois/années entre deux dates ISO
function getMonthsInRange(startISO, endISO) {
  const start = normalizeDate(startISO);
  const end = normalizeDate(endISO || startISO);
  if (!start || !end) return [];
  
  const months = [];
  let current = new Date(start.getFullYear(), start.getMonth(), 1);
  const endDate = new Date(end.getFullYear(), end.getMonth() + 1, 0);
  
  while (current <= endDate) {
    months.push({
      month: current.getMonth() + 1,
      year: current.getFullYear()
    });
    current.setMonth(current.getMonth() + 1);
  }
  return months;
}

// ========== KPI LOADER ==========
async function loadAndDisplayKPI(startDateISO, endDateISO) {
  try {
    if (
      !window.OGOUE ||
      typeof window.OGOUE.getVentesPourPeriode !== "function" ||
      typeof window.OGOUE.getDepensesPourPeriode !== "function"
    ) {
      console.error("OGOUE store non disponible");
      return;
    }

    // Charger TOUS les mois couverts par la plage
    const monthsToLoad = getMonthsInRange(startDateISO, endDateISO);
    console.log("📅 Mois à charger:", monthsToLoad);
    let allVentes = [];
    let allDepenses = [];
    
    for (const { month, year } of monthsToLoad) {
      const ventes = await window.OGOUE.getVentesPourPeriode(month, year);
      const depenses = await window.OGOUE.getDepensesPourPeriode(month, year);
      console.log(`  ${month}/${year} - Ventes: ${ventes?.length || 0}, Dépenses: ${depenses?.length || 0}`);
      allVentes = allVentes.concat(ventes || []);
      allDepenses = allDepenses.concat(depenses || []);
    }

    const ventes = allVentes;
    const depenses = allDepenses;
    
    console.log("📊 Total avant filtre - Ventes:", ventes.length, "Dépenses:", depenses.length);

    const inRange = buildRangeChecker(startDateISO, endDateISO);

    const ventesFiltrees = ventes.filter((v) => inRange(v.date || v.saleDate || v.sale_date));
    const depensesFiltrees = depenses.filter((d) => inRange(d.date || d.expenseDate || d.expense_date));

    console.log("🔎 Après filtre - Ventes:", ventesFiltrees.length, "Dépenses:", depensesFiltrees.length);
    if (ventesFiltrees.length > 0) {
      console.log("  Première vente:", ventesFiltrees[0]);
    }
    if (depensesFiltrees.length > 0) {
      console.log("  Première dépense:", depensesFiltrees[0]);
    }
    
    // Debug: montrer les dates brutes des ventes
    if (ventes.length > 0) {
      console.log("🔴 DATES BRUTES des ventes (avant filtre):");
      ventes.slice(0, 3).forEach((v, i) => {
        console.log(`  Vente ${i+1}: date="${v.date || v.sale_date || v.saleDate}" montant="${v.montant || v.amount}"`);
      });
    }
    
    // Debug: montrer les dates brutes des dépenses
    if (depenses.length > 0) {
      console.log("🔴 DATES BRUTES des dépenses (avant filtre):");
      depenses.slice(0, 3).forEach((d, i) => {
        console.log(`  Dépense ${i+1}: date="${d.date || d.expense_date || d.expenseDate}" montant="${d.montant || d.amount}"`);
      });
    }
    
    console.log("📍 Plage de filtre demandée: " + startDateISO + " à " + endDateISO);

    // Stocker dans les variables globales
    globalKPIData.totalVentes = ventesFiltrees.reduce((sum, v) => sum + parseFloat(v.montant || v.amount || 0), 0);
    globalKPIData.totalDepenses = depensesFiltrees.reduce((sum, d) => sum + parseFloat(d.montant || d.amount || 0), 0);
    globalKPIData.resultat = globalKPIData.totalVentes - globalKPIData.totalDepenses;
    globalKPIData.ventesCount = ventesFiltrees.length;
    globalKPIData.depensesCount = depensesFiltrees.length;

    // Appeler la fonction de mise à jour d'affichage
    updateKPIDisplay();

    const kpiCATrend = document.getElementById("kpi-ca-trend");
    const kpiDepensesTrend = document.getElementById("kpi-depenses-trend");
    const kpiResultatTrend = document.getElementById("kpi-resultat-trend");

    if (kpiCATrend) {
      kpiCATrend.innerHTML = `
        <span class="material-symbols-outlined !text-base">trending_up</span>
        <span>${globalKPIData.ventesCount || 0} vente(s)</span>
      `;
    }

    if (kpiDepensesTrend) {
      kpiDepensesTrend.innerHTML = `
        <span class="material-symbols-outlined !text-base">trending_down</span>
        <span>${globalKPIData.depensesCount || 0} dépense(s)</span>
      `;
    }

    if (kpiResultatTrend) {
      const text = globalKPIData.resultat >= 0 ? "Positif" : "Négatif";
      kpiResultatTrend.innerHTML = `
        <span class="material-symbols-outlined !text-base">${globalKPIData.resultat >= 0 ? "arrow_upward" : "arrow_downward"}</span>
        <span>${text}</span>
      `;
    }

    console.log("ƒo. KPI filtrés:", globalKPIData);
  } catch (error) {
    console.error("ƒ?O Erreur lors du chargement des KPI:", error);
  }
}

// ========== GRAPHIQUES DYNAMIQUES ==========
async function loadAndDisplayChartEvolution(startDateISO, endDateISO) {
  try {
    if (!window.OGOUE || typeof window.OGOUE.getVentesPourPeriode !== "function") {
      console.error("OGOUE store non disponible pour graphique");
      return;
    }

    // Charger TOUS les mois couverts par la plage
    const monthsToLoad = getMonthsInRange(startDateISO, endDateISO);
    let allVentes = [];
    
    for (const { month, year } of monthsToLoad) {
      const v = await window.OGOUE.getVentesPourPeriode(month, year);
      allVentes = allVentes.concat(v || []);
    }

    const inRange = buildRangeChecker(startDateISO, endDateISO);
    const ventesFiltrees = allVentes.filter((v) => inRange(v.date || v.saleDate || v.sale_date));

    // Grouper par jour dans la période (tous les jours avec des ventes)
    const ventesParJour = {};
    ventesFiltrees.forEach((vente) => {
      const dateStr = vente.date || vente.sale_date || vente.saleDate;
      const d = normalizeDate(dateStr);
      if (!d) return;
      
      // Utiliser la date LOCALE, pas UTC
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`; // Format: YYYY-MM-DD en local
      
      if (!ventesParJour[dateKey]) {
        ventesParJour[dateKey] = [];
      }
      ventesParJour[dateKey].push(vente);
    });

    // Créer un tableau de tous les jours de la plage, même sans ventes
    const start = normalizeDate(startDateISO);
    const end = normalizeDate(endDateISO || startDateISO);
    const days = [];
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      // Utiliser la date LOCALE, pas toISOString() qui reconvertit en UTC
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dateKey = `${year}-${month}-${day}`;
      days.push(dateKey);
    }

    const chartData = days.map((dateKey) => {
      const ventes = ventesParJour[dateKey] || [];
      const total = ventes.reduce((sum, v) => sum + parseFloat(v.montant || v.amount || 0), 0);
      const d = new Date(dateKey);
      return { 
        dateKey, 
        day: d.getDate(),
        date: d,
        total, 
        ventes 
      };
    });

    // Calculer maxValue mais avec une compression intelligente pour voir les petites valeurs
    const allValues = chartData.map(d => d.total).filter(v => v > 0);
    let maxValue = Math.max(...allValues, 1);
    const maxValueOriginal = maxValue; // Garder la vraie valeur pour l'étiquette
    
    // Si on a une grosse différence entre min et max, appliquer une compression avec racine carrée
    const minValue = Math.min(...allValues);
    const ratio = maxValue / (minValue || 1);
    
    // Si le ratio est très grand (>100), utiliser une échelle compressée
    if (ratio > 100 && minValue > 0) {
      // Appliquer racine carrée pour compresser l'échelle
      maxValue = Math.sqrt(maxValue);
      chartData.forEach(d => {
        if (d.total > 0) {
          d.displayTotal = Math.sqrt(d.total);
        } else {
          d.displayTotal = 0;
        }
      });
    } else {
      // Sinon, utiliser l'échelle linéaire normale
      chartData.forEach(d => {
        d.displayTotal = d.total;
      });
    }

    const width = 800;
    const height = 250;
    const padding = 50;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding;

    function generatePoints(data) {
      return data.map((item, idx) => {
        const x = padding + (graphWidth / (data.length - 1 || 1)) * idx;
        const y = height - (item.displayTotal / maxValue) * graphHeight;
        return { ...item, x, y };
      });
    }

    const points = generatePoints(chartData);

    function generatePath(points) {
      if (points.length === 0) return "";
      let pathStr = `M${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathStr += ` L${points[i].x} ${points[i].y}`;
      }
      return pathStr;
    }

    const path = generatePath(points);

    function formatChartMontant(val) {
      // Convertir avec la devise actuelle
      const currency = getCurrency();
      const rate = EXCHANGE_RATES[currency] || 1;
      const convertedAmount = val * rate;
      
      // Format compact avec K pour les milliers (sans symbole)
      if (convertedAmount >= 1000) {
        return (convertedAmount / 1000).toFixed(1) + "K";
      } else {
        return Math.round(convertedAmount).toString();
      }
    }

    // Étiquettes Y (axe vertical) - afficher seulement le maximum (valeur réelle formatée avec devise)
    const yLabels = [];
    const yPos = height - graphHeight; // position du sommet
    // Ici on utilise formatChartMontant pour garder le format "K", mais on POURRAIT utiliser formatMontant() si on veut
    // Pour l'instant gardons le format compact avec K
    yLabels.push(`<text x="40" y="${yPos + 5}" text-anchor="end" font-size="12" fill="#64748b">${formatChartMontant(maxValueOriginal)}</text>`);

    // Étiquettes X (axe horizontal) - afficher chaque 5-7 jours
    const xLabels = [];
    const step = Math.ceil(chartData.length / 8); // environ 8 labels
    for (let i = 0; i < chartData.length; i += step) {
      const x = padding + (graphWidth / (chartData.length - 1 || 1)) * i;
      xLabels.push(`<text x="${x}" y="${height + 25}" text-anchor="middle" font-size="11" fill="#64748b">${chartData[i].day}</text>`);
    }

    // Cercles pour interaction (hover)
    let circlesHTML = "";
    points.forEach((point) => {
      circlesHTML += `
        <circle class="chart-point" cx="${point.x}" cy="${point.y}" r="6" fill="#3b82f6" opacity="0" style="pointer-events: all; cursor: pointer;" data-datekey="${point.dateKey}" data-total="${point.total}"/>
      `;
    });

    const svgHTML = `
      <svg fill="none" preserveAspectRatio="none" viewBox="0 0 ${width} ${height + 50}" width="100%" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="gradientMain" x1="400" x2="400" y1="0" y2="${height}" gradientUnits="userSpaceOnUse">
            <stop stop-color="#3b82f6" stop-opacity="0.15"/>
            <stop offset="1" stop-color="#3b82f6" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <!-- Axes -->
        <line x1="45" y1="0" x2="45" y2="${height}" stroke="#e2e8f0" stroke-width="1.5"/>
        <line x1="45" y1="${height}" x2="${width}" y2="${height}" stroke="#e2e8f0" stroke-width="1.5"/>
        
        <!-- Labels Y -->
        ${yLabels.join("")}
        
        <!-- Labels X -->
        ${xLabels.join("")}
        
        <!-- Courbe du CA -->
        <path d="${path}" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        
        <!-- Zone sous la courbe -->
        <path d="${path}L${width - padding} ${height}L45 ${height}Z" fill="url(#gradientMain)"/>
        
        <!-- Points interactifs -->
        ${circlesHTML}
      </svg>
    `;

    const svgContainer = document.getElementById("chart-evolution");

    if (svgContainer) {
      svgContainer.innerHTML = svgHTML;
      svgContainer.style.position = "relative";
      addChartInteractions(svgContainer, points, chartData);
    } else {
      console.warn("⚠️ Conteneur chart-evolution non trouvé");
    }

    console.log("📈 Graphique Évolution CA chargé:", chartData.length, "jours");
  } catch (error) {
    console.error("❌ Erreur graphique Évolution CA:", error);
  }
}

function addChartInteractions(svgContainer, points, chartData) {
  let tooltip = null;
  const circles = svgContainer.querySelectorAll(".chart-point");

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function createTooltip(data) {
    if (tooltip) tooltip.remove();
    tooltip = document.createElement("div");
    tooltip.style.cssText = `
      position: absolute;
      background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 12px;
      pointer-events: none;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      border: 1px solid rgba(255,255,255,0.1);
      max-width: 280px;
      min-width: 180px;
    `;

    const d = new Date(data.dateKey);
    const dateStr = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const montantTotal = formatMontant(parseFloat(data.total) || 0);

    const byDescription = {};
    data.ventes.forEach((v) => {
      const desc = v.description || "Sans description";
      const montant = parseFloat(v.montant || v.amount || 0);
      byDescription[desc] = (byDescription[desc] || 0) + montant;
    });

    let ventesHTML = `
      <div style="font-weight: 600; margin-bottom: 8px; color: #3b82f6;">
        ${dateStr} - ${montantTotal}
      </div>
      <div style="font-size: 11px; opacity: 0.8; line-height: 1.4;">
    `;

    if (data.ventes.length === 0) {
      ventesHTML += "Aucune vente ce jour";
    } else {
      Object.entries(byDescription).forEach(([desc, montant]) => {
        const montantFormate = formatMontant(parseFloat(montant) || 0);
        ventesHTML += `<div>• ${desc}: ${montantFormate}</div>`;
      });
    }
    ventesHTML += `</div>`;

    tooltip.innerHTML = ventesHTML;
    svgContainer.appendChild(tooltip);
  }

  circles.forEach((circle) => {
    const datekey = circle.dataset.datekey;
    const data = chartData.find((d) => d.dateKey === datekey);

    circle.addEventListener("mouseenter", () => {
      circle.style.opacity = "1";
      circle.style.r = "8";

      const rect = circle.getBoundingClientRect();
      const containerRect = svgContainer.getBoundingClientRect();

      createTooltip(data);
      tooltip.style.left = rect.left - containerRect.left + 20 + "px";
      tooltip.style.top = rect.top - containerRect.top - 15 + "px";
    });

    circle.addEventListener("mouseleave", () => {
      if (tooltip) tooltip.remove();
      circle.style.opacity = "0";
      circle.style.r = "6";
      tooltip = null;
    });
  });
}

// Répartition par catégorie
async function loadAndDisplayChartRepartition(startDateISO, endDateISO) {
  try {
    if (!window.OGOUE || typeof window.OGOUE.getVentesPourPeriode !== "function") {
      console.error("OGOUE store non disponible pour répartition");
      return;
    }

    // Charger TOUS les mois couverts par la plage
    const monthsToLoad = getMonthsInRange(startDateISO, endDateISO);
    let allVentes = [];
    
    for (const { month, year } of monthsToLoad) {
      const ventes = await window.OGOUE.getVentesPourPeriode(month, year);
      allVentes = allVentes.concat(ventes || []);
    }
    const inRange = buildRangeChecker(startDateISO, endDateISO);
    const ventesFiltrees = allVentes.filter((v) => inRange(v.date || v.saleDate || v.sale_date));

    const categories = {};
    let totalCA = 0;

    ventesFiltrees.forEach((vente) => {
      const cat = vente.description || "Sans catégorie";
      const montant = parseFloat(vente.amount || vente.montant || 0);
      categories[cat] = (categories[cat] || 0) + montant;
      totalCA += montant;
    });

    const top4 = Object.entries(categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([cat, val]) => ({ cat, val, percent: (val / totalCA) * 100 || 0 }));

    const colors = ["#a855f7", "#13ecc8", "#fb923c", "#3b82f6"];
    let svgCircles = "";
    let strokeDashoffset = 0;
    const radius = 15.9155;
    const circumference = 2 * Math.PI * radius;

    top4.forEach((item, idx) => {
      const dasharray = (item.percent / 100) * circumference;
      const strokeColor = colors[idx];
      svgCircles += `
        <circle cx="18" cy="18" r="${radius}" fill="transparent" stroke="${strokeColor}" stroke-width="3.5" stroke-dasharray="${dasharray} ${circumference}" stroke-dashoffset="${-strokeDashoffset}"/>
      `;
      strokeDashoffset += dasharray;
    });

    function formatTotalForDisplay(total) {
      // Convertir avec la devise actuelle
      const currency = getCurrency();
      const rate = EXCHANGE_RATES[currency] || 1;
      const convertedAmount = total * rate;
      
      // Format compact avec M/K pour les grands nombres (sans symbole)
      if (convertedAmount >= 1000000) {
        return (convertedAmount / 1000000).toFixed(1) + "M";
      } else if (convertedAmount >= 1000) {
        return (convertedAmount / 1000).toFixed(1) + "K";
      } else {
        return convertedAmount.toFixed(0);
      }
    }

    const repartitionContainer = document.getElementById("chart-repartition");
    if (repartitionContainer) {
      let badgesHTML = '<div class="flex flex-wrap gap-2">';
      top4.forEach((item, idx) => {
        badgesHTML += `
          <span class="px-3 py-2 rounded-full text-sm font-semibold bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-200">
            ${item.cat}: ${item.percent.toFixed(1)}%
          </span>
        `;
      });
      badgesHTML += "</div>";

      repartitionContainer.innerHTML = `
        <div>
          <p class="text-lg font-semibold mb-4">Répartition du CA par Catégorie</p>
          ${badgesHTML}
          <div class="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <span class="text-sm text-text-muted-light dark:text-text-muted-dark">Total: </span>
            <span class="text-lg font-bold">${formatTotalForDisplay(totalCA)}</span>
          </div>
        </div>
      `;
    }

    console.log("ƒo. Graphique Répartition chargé (filtré)");
  } catch (error) {
    console.error("ƒ?O Erreur graphique Répartition:", error);
  }
}

// Charger les KPI et graphiques au lancement de la page + sur changement de filtre
document.addEventListener("DOMContentLoaded", async function () {
  // Initialiser avec la plage par défaut (mois courant jusqu'à aujourd'hui)
  function getDefaultDateRange() {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      startDate: startOfMonth.toISOString().slice(0, 10),
      endDate: today.toISOString().slice(0, 10)
    };
  }

  // ✅ Attendre que window.OGOUE soit disponible
  let attempts = 0;
  while (!window.OGOUE && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  if (!window.OGOUE) {
    console.error("❌ window.OGOUE n'a pas pu être chargé");
    return;
  }

  console.log("✅ window.OGOUE est disponible");

  const filterState = getDefaultDateRange();

  async function refreshDashboard() {
    await loadAndDisplayKPI(filterState.startDate, filterState.endDate);
    await loadAndDisplayChartEvolution(filterState.startDate, filterState.endDate);
    await loadAndDisplayChartRepartition(filterState.startDate, filterState.endDate);
  }

  // Écoute le filtre de date (événement dispatché par le datepicker du HTML)
  document.addEventListener("dashboard:dateRangeChanged", async (e) => {
    const { startDate, endDate } = e.detail || {};
    filterState.startDate = startDate || null;
    filterState.endDate = endDate || null;
    await refreshDashboard();
  });

  // Écoute le changement de devise depuis les préférences
  document.addEventListener("currency:changed", async (e) => {
    console.log("🎯 EVENT currency:changed reçu!");
    const { currency } = e.detail || {};
    console.log("💱 Devise changée vers:", currency);
    console.log("📊 Recharging charts with filterState:", filterState);
    // Recharger uniquement les graphiques avec la nouvelle devise
    await loadAndDisplayChartEvolution(filterState.startDate, filterState.endDate);
    await loadAndDisplayChartRepartition(filterState.startDate, filterState.endDate);
  });

  // Premier affichage (plage par défaut: mois en cours jusqu'à aujourd'hui)
  await refreshDashboard();
});
