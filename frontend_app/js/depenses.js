// js/depenses.js

(function () {
  if (!window.OGOUE) {
    console.error("OGOUE store non chargé");
    return;
  }

  const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : 'https://api.ogoue.com';
  const { appState, addDepense, getDepensesPourPeriode } = window.OGOUE;

  // ─────────────────────────────────────────────
  // ✅ Gestion Catégories (déplacée depuis le HTML)
  // ─────────────────────────────────────────────
  const CATEGORIES_STORAGE_KEY = "ogoue.depenses.categories.custom";

  const baseCategories = [
    "Achats / Stocks",
    "Salaires",
    "Loyer",
    "Marketing",
    "Électricité",
    "Eau",
    "Internet & Télécom",
    "Transport & Logistique",
    "Impôts & Taxes",
    "Entretien & Maintenance"
  ];

  const categorieSelect = document.getElementById("depense-categorie");
  const categorieAutreWrapper = document.getElementById("categorie-autre-wrapper");
  const categorieAutreInput = document.getElementById("depense-categorie-autre");

  function loadCustomCategories() {
    try {
      const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveCustomCategories(list) {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(list));
  }

  function normalizeLabel(s) {
    return String(s || "").trim().replace(/\s+/g, " ");
  }

  function buildCategorieOptions() {
    if (!categorieSelect) return;

    const custom = loadCustomCategories();
    const all = [...baseCategories, ...custom].filter(Boolean);

    categorieSelect.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Sélectionner une catégorie";
    categorieSelect.appendChild(opt0);

    all.forEach((cat) => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      categorieSelect.appendChild(opt);
    });

    const optOther = document.createElement("option");
    optOther.value = "__OTHER__";
    optOther.textContent = "Autres (préciser)";
    categorieSelect.appendChild(optOther);
  }

  function toggleCategorieAutre(isOther) {
    if (!categorieAutreWrapper || !categorieAutreInput) return;

    if (isOther) {
      categorieAutreWrapper.classList.remove("hidden");
      categorieAutreInput.required = true;
      setTimeout(() => categorieAutreInput.focus(), 0);
    } else {
      categorieAutreWrapper.classList.add("hidden");
      categorieAutreInput.required = false;
      categorieAutreInput.value = "";
    }
  }

  function resolveCategorieValueBeforeSubmit() {
    // Retourne la valeur finale catégorie (string) et met à jour la liste si "Autres"
    if (!categorieSelect) return "";

    if (categorieSelect.value !== "__OTHER__") {
      return categorieSelect.value || "";
    }

    const label = normalizeLabel(categorieAutreInput ? categorieAutreInput.value : "");
    if (!label) return ""; // sera géré par la validation

    const custom = loadCustomCategories();
    const existsInBase = baseCategories.some((b) => b.toLowerCase() === label.toLowerCase());
    const existsInCustom = custom.some((c) => String(c).toLowerCase() === label.toLowerCase());

    if (!existsInBase && !existsInCustom) {
      custom.push(label);
      saveCustomCategories(custom);
    }

    // Rebuild + sélectionner la nouvelle catégorie
    buildCategorieOptions();
    const baseMatch = baseCategories.find((b) => b.toLowerCase() === label.toLowerCase());
    categorieSelect.value = baseMatch ? baseMatch : label;

    toggleCategorieAutre(false);
    return categorieSelect.value || "";
  }

  // Init catégories (si les éléments existent)
  if (categorieSelect && categorieAutreWrapper && categorieAutreInput) {
    buildCategorieOptions();
    toggleCategorieAutre(false);

    categorieSelect.addEventListener("change", () => {
      toggleCategorieAutre(categorieSelect.value === "__OTHER__");
    });
  }

  // ─────────────────────────────────────────────
  // ✅ Logique Dépenses existante (préservée)
  // ─────────────────────────────────────────────
  const form = document.getElementById("form-depenses");
  const tbodyCompact = document.getElementById("depenses-tbody");

  const modal = document.getElementById("depenses-modal");
  const tbodyFull = document.getElementById("depenses-full-tbody");
  const btnExpand = document.getElementById("btn-depenses-expand");
  const btnClose = document.getElementById("btn-depenses-close");
  const btnExport = document.getElementById("btn-depenses-export");

  if (!form || !tbodyCompact) {
    console.error("Formulaire (form-depenses) ou tableau (depenses-tbody) introuvable");
    return;
  }

  // 🔹 Date par défaut = aujourd'hui
  const dateInputDefault = document.getElementById("depense-date");

  function setTodayAsDefaultDate() {
    if (!dateInputDefault) return;
    // Utilise la date locale (corrige le décalage dû à l'UTC de toISOString)
    const now = new Date();
    const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 10); // YYYY-MM-DD
    dateInputDefault.value = localISO;
  }

  // Initialiser immédiatement
  setTodayAsDefaultDate();
  
  // Aussi initialiser quand le document est complètement chargé (en cas de race condition)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setTodayAsDefaultDate);
  }
  
  // Et quand le formulaire est prêt
  if (form) {
    form.addEventListener('loadstart', setTodayAsDefaultDate);
  }

  function generateId() {
    return "depense_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
  }

  function getFormData(finalCategorie) {
    const dateInput = document.getElementById("depense-date");
    const moyenInput = document.getElementById("depense-moyen-paiement");
    const montantInput = document.getElementById("depense-montant");
    const fileInput = document.getElementById("depense-file-upload");

    if (!dateInput || !moyenInput || !montantInput) {
      console.error("Un ou plusieurs champs du formulaire de dépenses sont introuvables :", {
        dateInput,
        moyenInput,
        montantInput
      });
      return null;
    }

    const date = dateInput.value;
    const moyenPaiement = moyenInput.value;
    const montant = parseFloat(montantInput.value || "0");

    let justificatifFile = "";
    let file = null;
    
    if (fileInput && fileInput.files && fileInput.files[0]) {
      file = fileInput.files[0];
      justificatifFile = file.name;
    }

    // ✅ Sur cette version (sans champ description), on garde description vide
    // (la colonne "Description" du tableau affichera "-")
    const description = "";

    return {
      id: generateId(),
      date,
      categorie: finalCategorie || "",
      description,
      moyen_paiement: moyenPaiement,
      montant: isNaN(montant) ? 0 : montant,
      justificatif: justificatifFile,
      file // Ajouter l'objet File pour l'upload
    };
  }

  function formatDateFr(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("fr-FR");
  }

  function formatMontant(montant) {
    // Convertir en nombre si c'est une string
    const val = typeof montant === "string" ? parseFloat(montant) : montant;
    if (typeof val !== "number" || isNaN(val)) return "-";
    return (
      val.toLocaleString("fr-FR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }) + " FCFA"
    );
  }

  async function deleteDepense(depenseId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/expenses/${depenseId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Erreur: ${response.status}`);
      }

      // Rafraîchir les tableaux
      await renderCompactTable();
      renderFullTable();

      alert('Dépense supprimée avec succès');
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression de la dépense');
    }
  }

  function createRow(depense) {
    const tr = document.createElement("tr");
    tr.className = "border-b dark:border-gray-700";

    tr.innerHTML = `
      <td class="px-6 py-4 font-medium text-[#0d1b19] dark:text-white whitespace-nowrap">
        ${formatDateFr(depense.date)}
      </td>
      <td class="px-6 py-4">
        ${depense.categorie || "-"}
      </td>
      <td class="px-6 py-4">
        ${formatMontant(depense.montant)}
      </td>
      <td class="px-6 py-4">
        ${
          depense.moyen_paiement === "mobile_money"
            ? "Mobile Money"
            : depense.moyen_paiement === "cash"
            ? "Cash"
            : depense.moyen_paiement || "-"
        }
      </td>
      <td class="px-6 py-4">
        ${
          depense.justificatif
            ? `<span class="font-medium text-primary cursor-pointer hover:underline justificatif-link" data-file="${depense.justificatif}" data-url="${depense.justificatifUrl || ''}">${depense.justificatif}</span>`
            : `-`
        }
      </td>
      <td class="px-6 py-4 text-center">
        <button class="delete-btn text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xl" title="Supprimer" data-id="${depense.id}">
          🗑️
        </button>
      </td>
    `;

    // Ajouter l'event listener pour ouvrir le modal si justificatif
    if (depense.justificatif) {
      const link = tr.querySelector('.justificatif-link');
      if (link) {
        link.addEventListener('click', () => {
          const fileName = link.getAttribute('data-file');
          const fileUrl = link.getAttribute('data-url');
          openJustificatifModal(fileName, fileUrl);
        });
      }
    }

    // Ajouter l'event listener pour supprimer
    const deleteBtn = tr.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        const depenseId = deleteBtn.getAttribute('data-id');
        if (confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?')) {
          deleteDepense(depenseId);
        }
      });
    }

    return tr;
  }

  // Modal pour afficher le justificatif
  function openJustificatifModal(fileName, fileUrl) {
    // Vérifier si un modal existe déjà et le supprimer
    const existingModal = document.getElementById('justificatif-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'justificatif-modal';
    modal.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;" class="modal-overlay">
        <div style="background:white;border-radius:8px;max-width:500px;width:90%;position:relative;box-shadow:0 10px 40px rgba(0,0,0,0.3);" class="dark:bg-gray-800">
          <button id="close-justificatif" style="position:absolute;top:12px;right:12px;background:#e5e7eb;border:none;width:32px;height:32px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;z-index:10;" class="dark:bg-gray-700">
            ✕
          </button>
          <div id="justificatif-content" style="padding:40px;text-align:center;"></div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Fermer le modal au clic sur le bouton
    document.getElementById('close-justificatif').addEventListener('click', () => {
      modal.remove();
    });

    // Fermer le modal au clic en dehors
    modal.querySelector('.modal-overlay').addEventListener('click', (e) => {
      if (e.target === modal.querySelector('.modal-overlay')) {
        modal.remove();
      }
    });

    // Remplir le contenu
    const content = document.getElementById('justificatif-content');
    
    // Préparer les boutons d'action
    let actionHtml = '';
    if (fileUrl) {
      // Construire l'URL pour visualiser (sans forcer le téléchargement)
      const viewUrl = fileUrl.includes('?') ? `${fileUrl}&download=` : `${fileUrl}?download=`;
      
      actionHtml = `
        <div style="display:flex;gap:10px;justify-content:center;margin-top:20px;">
          <a href="${viewUrl}" target="_blank" rel="noopener noreferrer" style="padding:8px 16px;background:#4CAF50;color:white;border-radius:6px;text-decoration:none;cursor:pointer;font-size:14px;display:inline-flex;align-items:center;gap:6px;">
            👁️ Consulter
          </a>
          <a href="${fileUrl}" download="${fileName}" style="padding:8px 16px;background:#2196F3;color:white;border-radius:6px;text-decoration:none;cursor:pointer;font-size:14px;display:inline-flex;align-items:center;gap:6px;">
            ⬇️ Télécharger
          </a>
        </div>
      `;
    } else {
      actionHtml = `
        <div style="padding:20px;background:#fff3cd;border-radius:6px;margin-top:20px;color:#856404;" class="dark:bg-yellow-900">
          <p style="margin:0;font-size:13px;">⚠️ Fichier non uploadé vers le cloud (ancien enregistrement)</p>
        </div>
      `;
    }
    
    content.innerHTML = `
      <div style="margin-bottom:20px;">
        <p style="font-size:14px;color:#666;margin-bottom:10px;">Justificatif enregistré:</p>
        <p style="font-size:18px;font-weight:bold;color:#0d1b19;word-break:break-word;" class="dark:text-white">${fileName}</p>
      </div>
      ${actionHtml}
    `;
  }

  // Cache pour les dépenses afin de limiter les appels API
  let depensesCache = [];
  let depensesCacheMois = null;
  let depensesCacheAnnee = null;

  async function getDepensesPeriodeCourante() {
    const { mois, annee } = appState.periodeCourante || {};
    
    // Vérifier si on a déjà le cache pour cette période
    if (depensesCacheMois === mois && depensesCacheAnnee === annee) {
      return depensesCache;
    }

    // Sinon, faire l'appel API
    if (typeof getDepensesPourPeriode === "function") {
      const depenses = await getDepensesPourPeriode(mois, annee);
      // Mettre à jour le cache
      depensesCache = depenses;
      depensesCacheMois = mois;
      depensesCacheAnnee = annee;
      return depenses;
    }
    return [];
  }

  async function renderCompactTable() {
    const depenses = await getDepensesPeriodeCourante();
    
    // Filtrer pour afficher les dépenses du mois/année courant (pas juste aujourd'hui)
    // car les dates peuvent avoir un décalage UTC/local
    const { mois, annee } = appState.periodeCourante || {};
    
    const depensesAujourdhui = depenses.filter((d) => {
      const dateStr = d.date || d.expense_date || d.expenseDate;
      if (!dateStr) return false;
      
      // Parser la date ISO
      const dt = new Date(dateStr);
      if (isNaN(dt.getTime())) return false;
      
      // Comparer par mois et année (pas jour pour éviter les décalages UTC)
      return dt.getMonth() + 1 === mois && dt.getFullYear() === annee;
    });

    tbodyCompact.innerHTML = "";

    if (!depensesAujourdhui.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Aucune dépense enregistrée pour aujourd'hui.
        </td>
      `;
      tbodyCompact.appendChild(tr);
      return;
    }

    // Afficher seulement les 5 dépenses les plus récentes
    depensesAujourdhui.slice(0, 5).forEach((d) => tbodyCompact.appendChild(createRow(d)));
  }

  function renderFullTable() {
    if (!tbodyFull) return;

    // Récupérer les dépenses asynchronement
    getDepensesPeriodeCourante().then((depenses) => {
      // Filtrer pour afficher SEULEMENT les dépenses d'aujourd'hui
      const today = new Date();
      const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const depensesAujourdhui = depenses.filter((d) => {
        const dateStr = d.date || d.expense_date || d.expenseDate;
        if (!dateStr) return false;
        
        // Parser la date ISO (ex: "2025-12-22T23:00:00.000Z")
        const dt = new Date(dateStr);
        if (isNaN(dt.getTime())) return false;
        
        // Créer une date locale sans heure
        const dDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
        
        // Comparer les dates
        return dDate.getTime() === todayDateOnly.getTime();
      });

      tbodyFull.innerHTML = "";

      if (!depensesAujourdhui.length) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Aucune dépense enregistrée pour aujourd'hui.
          </td>
        `;
        tbodyFull.appendChild(tr);
        return;
      }

      depensesAujourdhui.forEach((d) => tbodyFull.appendChild(createRow(d)));
    });
  }

  function exportDepensesCSV() {
    getDepensesPeriodeCourante().then((depenses) => {
      if (!depenses.length) {
        alert("Aucune dépense à exporter pour cette période.");
        return;
      }

      const headers = [
        "Date",
        "Categorie",
        "Description",
        "Montant",
        "Moyen de paiement",
        "Justificatif"
      ];

      let csv = headers.join(";") + "\n";

      depenses.forEach((d) => {
        const row = [
          formatDateFr(d.date),
          d.categorie || "",
          d.description || "",
          d.montant != null ? String(d.montant).replace(".", ",") : "",
          d.moyen_paiement || "",
          d.justificatif || ""
        ];

        csv += row
          .map((value) => {
            const v = (value ?? "").toString().replace(/"/g, '""');
            return `"${v}"`;
          })
          .join(";") + "\n";
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const todayIso = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `depenses_${todayIso}.csv`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
    });
  }

  // ─── Événements ─────────────────────────────
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    // ✅ d'abord : finaliser la catégorie (gère "Autres" + persistance)
    const finalCategorie = resolveCategorieValueBeforeSubmit();

    const data = getFormData(finalCategorie);

    if (!data) {
      alert("Un problème est survenu avec le formulaire Dépenses (voir la console).");
      return;
    }

    // ✅ Validation adaptée à ton HTML actuel (sans champ description)
    if (!data.date || !data.categorie || !data.moyen_paiement || data.montant <= 0) {
      alert("Merci de remplir tous les champs obligatoires avec des valeurs valides.");
      return;
    }

    // ✅ Appeler l'API (asynchrone)
    const result = await addDepense(data);
    if (!result) {
      // addDepense a déjà affiché un message d'erreur
      return;
    }

    form.reset();
    setTodayAsDefaultDate();

    // Après reset : remettre le select catégories propre + cacher "Autres"
    if (categorieSelect && categorieAutreWrapper && categorieAutreInput) {
      buildCategorieOptions();
      toggleCategorieAutre(false);
    }

    // Rafraîchir le cache et le tableau
    depensesCacheMois = null;
    depensesCacheAnnee = null;
    await renderCompactTable();
  });

  if (btnExpand && modal) {
    btnExpand.addEventListener("click", () => {
      renderFullTable();
      modal.classList.remove("hidden");
      modal.classList.add("flex");
    });
  }

  if (btnClose && modal) {
    btnClose.addEventListener("click", () => {
      modal.classList.add("hidden");
      modal.classList.remove("flex");
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        modal.classList.add("hidden");
        modal.classList.remove("flex");
      }
    });
  }

  if (btnExport) {
    btnExport.addEventListener("click", exportDepensesCSV);
  }

  // Initialisation
  renderCompactTable();
})();
