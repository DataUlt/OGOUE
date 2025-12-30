// js/resume.js

// Helpers pour normaliser les dates
function normalizeDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

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

function formatMontant(montant) {
  if (typeof montant !== "number" || isNaN(montant)) return "0 FCFA";
  return (
    montant.toLocaleString("fr-FR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }) + " FCFA"
  );
}

// Charge et affiche les statistiques
async function loadAndDisplayStats(startDateISO, endDateISO) {
  if (!window.OGOUE) return;

  const monthsToLoad = getMonthsInRange(startDateISO, endDateISO);
  let allVentes = [];
  let allDepenses = [];
  
  for (const { month, year } of monthsToLoad) {
    const ventes = await window.OGOUE.getVentesPourPeriode(month, year);
    const depenses = await window.OGOUE.getDepensesPourPeriode(month, year);
    allVentes = allVentes.concat(ventes || []);
    allDepenses = allDepenses.concat(depenses || []);
  }

  const inRange = buildRangeChecker(startDateISO, endDateISO);
  const ventesFiltrees = allVentes.filter((v) => inRange(v.date || v.saleDate || v.sale_date));
  const depensesFiltrees = allDepenses.filter((d) => inRange(d.date || d.expenseDate || d.expense_date));

  const totalVentes = ventesFiltrees.reduce((sum, v) => sum + parseFloat(v.montant || v.amount || 0), 0);
  const totalDepenses = depensesFiltrees.reduce((sum, d) => sum + parseFloat(d.montant || d.amount || 0), 0);
  const solde = totalVentes - totalDepenses;

  // Mettre à jour les stats
  const statVentes = document.getElementById("stat-total-ventes");
  const statDepenses = document.getElementById("stat-total-depenses");
  const statSolde = document.getElementById("stat-solde");
  const trendVentes = document.getElementById("stat-trend-ventes");
  const trendDepenses = document.getElementById("stat-trend-depenses");
  const trendSolde = document.getElementById("stat-trend-solde");

  if (statVentes) statVentes.textContent = formatMontant(totalVentes);
  if (statDepenses) statDepenses.textContent = formatMontant(totalDepenses);
  if (statSolde) statSolde.textContent = formatMontant(solde);
  
  if (trendVentes) trendVentes.textContent = `${ventesFiltrees.length} vente(s)`;
  if (trendDepenses) trendDepenses.textContent = `${depensesFiltrees.length} dépense(s)`;
  if (trendSolde) trendSolde.innerHTML = `<span class="material-symbols-outlined" style="display:inline; font-size:16px;">${solde >= 0 ? "arrow_upward" : "arrow_downward"}</span> ${solde >= 0 ? "Positif" : "Négatif"}`;

  // Charger les répartitions
  loadRepartitions(ventesFiltrees, depensesFiltrees);
}

// Charge et affiche les répartitions
function loadRepartitions(ventes, depenses) {
  // Répartition des ventes par description (catégorie)
  const ventesParDesc = {};
  let totalVentes = 0;
  ventes.forEach((v) => {
    const desc = v.description || "Sans catégorie";
    const montant = parseFloat(v.montant || v.amount || 0);
    ventesParDesc[desc] = (ventesParDesc[desc] || 0) + montant;
    totalVentes += montant;
  });

  const containerVentes = document.getElementById("repartition-ventes");
  if (containerVentes) {
    containerVentes.innerHTML = "";
    const entries = Object.entries(ventesParDesc).sort((a, b) => b[1] - a[1]);
    entries.forEach(([ desc, montant ], idx) => {
      const percent = totalVentes > 0 ? ((montant / totalVentes) * 100) : 0;
      const html = `
        <div class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700/50 py-4 ${idx % 2 === 0 ? 'pr-2' : 'sm:pl-2'}">
          <div class="flex flex-col gap-1">
            <p class="text-sm font-normal leading-normal text-gray-500 dark:text-gray-400">${desc}</p>
            <p class="text-base font-semibold leading-normal text-gray-800 dark:text-gray-200">${formatMontant(montant)}</p>
          </div>
          <div class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-700">
            ${percent.toFixed(1)}%
          </div>
        </div>
      `;
      containerVentes.innerHTML += html;
    });
  }

  // Répartition moyens de paiement (ventes)
  const ventesParPaiement = {};
  ventes.forEach((v) => {
    const paiement = v.moyen_paiement === "mobile_money" ? "Mobile Money" : 
                     v.moyen_paiement === "cash" ? "Cash" : 
                     (v.moyen_paiement || "Autres");
    const montant = parseFloat(v.montant || v.amount || 0);
    ventesParPaiement[paiement] = (ventesParPaiement[paiement] || 0) + montant;
  });

  const containerPaiementVentes = document.getElementById("repartition-paiement-ventes");
  if (containerPaiementVentes) {
    containerPaiementVentes.innerHTML = "";
    const entries = Object.entries(ventesParPaiement).sort((a, b) => b[1] - a[1]);
    entries.forEach(([ paiement, montant ], idx) => {
      const percent = totalVentes > 0 ? ((montant / totalVentes) * 100) : 0;
      const html = `
        <div class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700/50 py-4 ${idx % 2 === 0 ? 'pr-2' : 'sm:pl-2'}">
          <div class="flex flex-col gap-1">
            <p class="text-sm font-normal leading-normal text-gray-500 dark:text-gray-400">Total encaissé en ${paiement}</p>
            <p class="text-base font-semibold leading-normal text-gray-800 dark:text-gray-200">${formatMontant(montant)}</p>
          </div>
          <div class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-700">
            ${percent.toFixed(0)}%
          </div>
        </div>
      `;
      containerPaiementVentes.innerHTML += html;
    });
  }

  // Répartition moyens de paiement (dépenses)
  const depensesParPaiement = {};
  let totalDepenses = 0;
  depenses.forEach((d) => {
    const paiement = d.moyen_paiement === "mobile_money" ? "Mobile Money" : 
                     d.moyen_paiement === "cash" ? "Cash" : 
                     (d.moyen_paiement || "Autres");
    const montant = parseFloat(d.montant || d.amount || 0);
    depensesParPaiement[paiement] = (depensesParPaiement[paiement] || 0) + montant;
    totalDepenses += montant;
  });

  const containerPaiementDepenses = document.getElementById("repartition-paiement-depenses");
  if (containerPaiementDepenses) {
    containerPaiementDepenses.innerHTML = "";
    const entries = Object.entries(depensesParPaiement).sort((a, b) => b[1] - a[1]);
    entries.forEach(([ paiement, montant ], idx) => {
      const percent = totalDepenses > 0 ? ((montant / totalDepenses) * 100) : 0;
      const html = `
        <div class="flex items-center justify-between border-t border-gray-200 dark:border-gray-700/50 py-4 ${idx % 2 === 0 ? 'pr-2' : 'sm:pl-2'}">
          <div class="flex flex-col gap-1">
            <p class="text-sm font-normal leading-normal text-gray-500 dark:text-gray-400">Total payé en ${paiement}</p>
            <p class="text-base font-semibold leading-normal text-gray-800 dark:text-gray-200">${formatMontant(montant)}</p>
          </div>
          <div class="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-xs font-bold text-gray-700">
            ${percent.toFixed(0)}%
          </div>
        </div>
      `;
      containerPaiementDepenses.innerHTML += html;
    });
  }

  // Répartition catégories dépenses
  const depensesParCat = {};
  depenses.forEach((d) => {
    const cat = d.categorie || "Autres";
    const montant = parseFloat(d.montant || d.amount || 0);
    depensesParCat[cat] = (depensesParCat[cat] || 0) + montant;
  });

  const containerDepenses = document.getElementById("repartition-depenses");
  if (containerDepenses) {
    containerDepenses.innerHTML = "";
    const entries = Object.entries(depensesParCat).sort((a, b) => b[1] - a[1]);
    entries.forEach(([ cat, montant ]) => {
      const html = `
        <div class="flex justify-between py-4 border-t border-gray-200 dark:border-gray-700/50">
          <p class="text-sm font-normal text-gray-500 dark:text-gray-400">${cat}</p>
          <p class="text-sm font-semibold text-gray-800 dark:text-gray-200">${formatMontant(montant)}</p>
        </div>
      `;
      containerDepenses.innerHTML += html;
    });
  }
}

document.addEventListener("DOMContentLoaded", async function () {
  const btn = document.getElementById("dateFilterButton");
  const panel = document.getElementById("dateFilterPanel");
  const labelSpan = document.getElementById("dateFilterLabel");
  const calendarGrid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("monthLabel");
  const prevMonthBtn = document.getElementById("prevMonth");
  const nextMonthBtn = document.getElementById("nextMonth");
  const resetBtn = document.getElementById("resetRange");
  const closeBtn = document.getElementById("closeCalendar");

  // Si le filtre n'existe pas (page différente), on sort proprement
  if (!btn || !panel || !calendarGrid || !monthLabel) {
    return;
  }

  // Attendre que window.OGOUE soit disponible
  let attempts = 0;
  while (!window.OGOUE && attempts < 50) {
    await new Promise(resolve => setTimeout(resolve, 100));
    attempts++;
  }

  if (!window.OGOUE) {
    console.error("❌ window.OGOUE n'a pas pu être chargé");
    return;
  }

  const monthNames = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre"
  ];

  let current = new Date();
  let startDate = null;
  let endDate = null;

  function pad(n) {
    return n.toString().padStart(2, "0");
  }

  function formatDateFR(isoStr) {
    if (!isoStr) return "";
    const [y, m, d] = isoStr.split("-");
    return `${d}/${m}/${y}`;
  }

  function getDaysInMonth(year, monthIndex) {
    return new Date(year, monthIndex + 1, 0).getDate();
  }

  function renderCalendar() {
    const year = current.getFullYear();
    const month = current.getMonth();
    monthLabel.textContent = `${monthNames[month]} ${year}`;

    calendarGrid.innerHTML = "";

    const firstDay = new Date(year, month, 1).getDay();
    const offset = (firstDay + 6) % 7;

    for (let i = 0; i < offset; i++) {
      const emptyCell = document.createElement("div");
      calendarGrid.appendChild(emptyCell);
    }

    const daysInMonth = getDaysInMonth(year, month);
    for (let day = 1; day <= daysInMonth; day++) {
      const btnDay = document.createElement("button");
      const isoDate = `${year}-${pad(month + 1)}-${pad(day)}`;

      btnDay.textContent = day;
      btnDay.dataset.date = isoDate;
      btnDay.type = "button";

      btnDay.className =
        "h-9 rounded-full flex items-center justify-center text-sm " +
        "hover:bg-background-light dark:hover:bg-background-dark " +
        "text-[#0d1b19] dark:text-gray-100";

      if (startDate && !endDate && isoDate === startDate) {
        btnDay.classList.add("bg-primary", "text-[#0d1b19]");
      }

      if (startDate && endDate) {
        if (isoDate === startDate || isoDate === endDate) {
          btnDay.classList.add("bg-primary", "text-[#0d1b19]");
        } else if (isoDate > startDate && isoDate < endDate) {
          btnDay.classList.add(
            "bg-primary/10",
            "text-[#0d1b19]",
            "dark:text-gray-100"
          );
        }
      }

      btnDay.addEventListener("click", () => handleDayClick(isoDate));
      calendarGrid.appendChild(btnDay);
    }
  }

  function handleDayClick(isoDate) {
    if (!startDate || (startDate && endDate)) {
      startDate = isoDate;
      endDate = null;
    } else if (startDate && !endDate) {
      if (isoDate < startDate) {
        endDate = startDate;
        startDate = isoDate;
      } else if (isoDate === startDate) {
        endDate = null;
      } else {
        endDate = isoDate;
      }
    }

    updateLabelAndNotify();
    renderCalendar();
  }

  async function updateLabelAndNotify() {
    if (startDate && endDate) {
      labelSpan.textContent = `${formatDateFR(startDate)} - ${formatDateFR(endDate)}`;
    } else if (startDate) {
      labelSpan.textContent = formatDateFR(startDate);
    } else {
      labelSpan.textContent = "Choisir une date";
    }

    // Charger les données avec les dates sélectionnées
    if (startDate) {
      const end = endDate || startDate;
      await loadAndDisplayStats(startDate, end);
    }
  }

  function setTodayDefault() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayISO = `${firstDay.getFullYear()}-${pad(firstDay.getMonth() + 1)}-${pad(firstDay.getDate())}`;
    const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    startDate = firstDayISO;
    endDate = todayISO;
    current = new Date(today.getFullYear(), today.getMonth(), 1);
    updateLabelAndNotify();
    renderCalendar();
  }

  // Initialisation
  setTodayDefault();

  btn.addEventListener("click", () => {
    panel.classList.toggle("hidden");
  });

  prevMonthBtn.addEventListener("click", () => {
    current.setMonth(current.getMonth() - 1);
    renderCalendar();
  });

  nextMonthBtn.addEventListener("click", () => {
    current.setMonth(current.getMonth() + 1);
    renderCalendar();
  });

  resetBtn.addEventListener("click", () => {
    setTodayDefault();
  });

  closeBtn.addEventListener("click", () => {
    panel.classList.add("hidden");
  });

  document.addEventListener("click", (e) => {
    if (!panel.contains(e.target) && !btn.contains(e.target)) {
      panel.classList.add("hidden");
    }
  });

  window.OGUE_RESUME_FILTER = {
    get startDate() {
      return startDate;
    },
    get endDate() {
      return endDate;
    }
  };
});
