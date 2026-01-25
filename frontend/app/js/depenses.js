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

  // =========================
  // 📁 GESTION DES UPLOADS
  // =========================
  const fileInput = document.getElementById("depense-file-upload");
  const uploadZoneDefault = document.getElementById("upload-zone-default");
  const uploadZoneSelected = document.getElementById("upload-zone-selected");
  const uploadZoneUploading = document.getElementById("upload-zone-uploading");
  const uploadZoneSuccess = document.getElementById("upload-zone-success");
  const uploadZoneError = document.getElementById("upload-zone-error");
  const btnClearFile = document.getElementById("btn-clear-file");
  const btnRetryFile = document.getElementById("btn-retry-file");
  const fileName = document.getElementById("file-name");
  const fileSize = document.getElementById("file-size");
  const fileSuccessName = document.getElementById("file-success-name");
  const uploadErrorMessage = document.getElementById("upload-error-message");
  const uploadProgressBar = document.getElementById("upload-progress-bar");
  const uploadProgressText = document.getElementById("upload-progress-text");

  const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
  const MAX_SIZE = 5 * 1024 * 1024; // 5 Mo

  function hideAllUploadZones() {
    uploadZoneDefault?.classList.add("hidden");
    uploadZoneSelected?.classList.add("hidden");
    uploadZoneUploading?.classList.add("hidden");
    uploadZoneSuccess?.classList.add("hidden");
    uploadZoneError?.classList.add("hidden");
  }

  function showUploadZoneDefault() {
    hideAllUploadZones();
    uploadZoneDefault?.classList.remove("hidden");
  }

  function showUploadZoneSelected(file) {
    hideAllUploadZones();
    if (fileName) fileName.textContent = file.name;
    if (fileSize) {
      const sizeMo = (file.size / (1024 * 1024)).toFixed(2);
      fileSize.textContent = `${sizeMo} Mo`;
    }
    uploadZoneSelected?.classList.remove("hidden");
  }

  function showUploadZoneUploading() {
    hideAllUploadZones();
    uploadZoneUploading?.classList.remove("hidden");
    resetProgressBar();
  }

  function updateProgressBar(percent) {
    if (uploadProgressBar) uploadProgressBar.style.width = `${percent}%`;
    if (uploadProgressText) uploadProgressText.textContent = `${Math.round(percent)}%`;
  }

  function resetProgressBar() {
    updateProgressBar(0);
  }

  function showUploadZoneSuccess(file) {
    hideAllUploadZones();
    if (fileSuccessName) fileSuccessName.textContent = file.name;
    uploadZoneSuccess?.classList.remove("hidden");
  }

  function showUploadZoneError(errorMsg) {
    hideAllUploadZones();
    if (uploadErrorMessage) uploadErrorMessage.textContent = errorMsg;
    uploadZoneError?.classList.remove("hidden");
  }

  function validateFile(file) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return "Format non autorisé. Utilisez PDF, JPEG ou PNG.";
    }
    if (file.size > MAX_SIZE) {
      return "Fichier trop volumineux. Taille max : 5 Mo.";
    }
    return null;
  }

  // Gestion de la sélection de fichier
  fileInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const error = validateFile(file);
      if (error) {
        showUploadZoneError(error);
        fileInput.value = ""; // Réinitialiser l'input
      } else {
        showUploadZoneSelected(file);
      }
    } else {
      showUploadZoneDefault();
    }
  });

  // Bouton pour effacer le fichier
  btnClearFile?.addEventListener("click", () => {
    fileInput.value = "";
    showUploadZoneDefault();
  });

  // Bouton pour réessayer après une erreur
  btnRetryFile?.addEventListener("click", () => {
    fileInput.click();
  });

  // Drag and drop
  uploadZoneDefault?.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZoneDefault.classList.add("border-primary", "bg-primary/5");
  });

  uploadZoneDefault?.addEventListener("dragleave", () => {
    uploadZoneDefault.classList.remove("border-primary", "bg-primary/5");
  });

  uploadZoneDefault?.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZoneDefault.classList.remove("border-primary", "bg-primary/5");
    
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const error = validateFile(file);
      if (error) {
        showUploadZoneError(error);
      } else {
        fileInput.files = e.dataTransfer.files;
        showUploadZoneSelected(file);
      }
    }
  });

  // ─────────────────────────────────────────────
  // ✅ Gestion Catégories (déplacée depuis le HTML)
  // ─────────────────────────────────────────────
  
  function getCategoriesStorageKey() {
    // Récupère l'ID utilisateur actuel pour filtrer les catégories par utilisateur
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return "ogoue.depenses.categories.custom"; // Fallback si pas d'utilisateur
      const user = JSON.parse(userStr);
      const userId = user?.id || user?.user_id;
      if (!userId) return "ogoue.depenses.categories.custom";
      return `ogoue.depenses.categories.custom.${userId}`; // Clé unique par utilisateur
    } catch (e) {
      return "ogoue.depenses.categories.custom";
    }
  }

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
      const storageKey = getCategoriesStorageKey();
      const raw = localStorage.getItem(storageKey);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function saveCustomCategories(list) {
    const storageKey = getCategoriesStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(list));
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

  function formatHeure(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";
    // Ajouter 1 heure pour le fuseau horaire du Gabon (UTC+1)
    d.setHours(d.getHours() + 1);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
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
      // Importer le module d'audit
      const { default: DeletionAuditManager } = await import("./deletion-audit.js");

      // Trouver et mémoriser la ligne à supprimer
      const rowToDelete = document.querySelector(`tr[data-depense-id="${depenseId}"]`);

      // Utiliser le système d'audit pour la suppression
      const result = await DeletionAuditManager.deleteWithAudit(
        `${API_BASE_URL}/api/expenses/${depenseId}`,
        {
          title: "Supprimer cette dépense ?",
          message: "Vous êtes sur le point de supprimer cet enregistrement. Veuillez expliquer le motif de cette suppression.",
          recordType: "expense",
          recordId: depenseId
        }
      );

      if (result.success) {
        // Supprimer la ligne immédiatement du DOM avec animation
        if (rowToDelete) {
          rowToDelete.style.opacity = '0';
          rowToDelete.style.transition = 'opacity 0.3s ease';
          rowToDelete.style.height = rowToDelete.offsetHeight + 'px';
          setTimeout(() => {
            rowToDelete.style.height = '0px';
            rowToDelete.style.overflow = 'hidden';
            setTimeout(() => {
              rowToDelete.remove();
            }, 300);
          }, 50);
        }

        // Notification succès
        console.log('✅ Dépense supprimée avec succès');
      } else {
        console.error('❌ Erreur suppression:', result.error);
        alert(`Erreur: ${result.error}`);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression de la dépense');
    }
  }

  function createRow(depense) {
    const tr = document.createElement("tr");
    tr.className = "border-b dark:border-gray-700";
    tr.setAttribute('data-depense-id', depense.id);

    tr.innerHTML = `
      <td class="px-6 py-4 font-medium text-[#0d1b19] dark:text-white whitespace-nowrap">
        ${formatDateFr(depense.date)}
      </td>
      <td class="px-6 py-4 text-sm">
        ${formatHeure(depense.created_at)}
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
        ${depense.created_by_name || "-"}
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
        deleteDepense(depenseId);
      });
    }

    return tr;
  }

  // Modal pour afficher et télécharger le justificatif
  function openJustificatifModal(fileName, fileUrl) {
    console.log(`📁 Ouverture modal : fileName="${fileName}", fileUrl="${fileUrl}"`);
    
    // Vérifier si un modal existe déjà et le supprimer
    const existingModal = document.getElementById('justificatif-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Fermer les autres modals (comme le tableau d'export)
    const otherModals = document.querySelectorAll('[role="dialog"], .modal, [class*="modal"]');
    otherModals.forEach(m => {
      if (m && m.id !== 'justificatif-modal') {
        const closeBtn = m.querySelector('[aria-label="close"], .close, button:first-of-type');
        if (closeBtn) closeBtn.click();
      }
    });

    const modal = document.createElement('div');
    modal.id = 'justificatif-modal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[99999] p-1 sm:p-2';
    modal.style.position = 'fixed';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.zIndex = '99999';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'bg-card-light dark:bg-card-dark rounded-lg sm:rounded-xl w-[99vw] sm:w-[98vw] h-[99vh] sm:h-[98vh] shadow-lg overflow-hidden border border-[#e8ede8] dark:border-[#2a3a32] flex flex-col';
    modalContent.style.maxWidth = 'calc(100vw - 4px)';
    modalContent.style.maxHeight = 'calc(100vh - 4px)';
    
    const closeBtn = document.createElement('button');
    closeBtn.id = 'close-justificatif';
    closeBtn.className = 'absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f0f0f0] dark:bg-[#2a3a32] flex items-center justify-center text-[#666] dark:text-[#999] hover:bg-[#e0e0e0] dark:hover:bg-[#3a4a42] transition-colors z-10';
    closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
    closeBtn.type = 'button';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'p-2 sm:p-3 border-b border-[#e8ede8] dark:border-[#2a3a32] flex justify-between items-start gap-2 flex-shrink-0';
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'flex-1';
    
    const title = document.createElement('h2');
    title.className = 'text-lg font-bold text-text-light-primary dark:text-text-dark-primary font-display';
    title.textContent = 'Aperçu du justificatif';
    
    const fileName_elem = document.createElement('p');
    fileName_elem.className = 'text-sm text-text-light-secondary dark:text-text-dark-secondary break-words font-medium mt-2';
    fileName_elem.textContent = fileName;
    
    titleDiv.appendChild(title);
    titleDiv.appendChild(fileName_elem);
    headerDiv.appendChild(titleDiv);
    headerDiv.appendChild(closeBtn);
    
    const previewDiv = document.createElement('div');
    previewDiv.className = 'flex-1 overflow-auto flex items-center justify-center bg-white dark:bg-gray-800 relative';
    previewDiv.style.minHeight = '200px';
    
    // Déterminer le type de fichier et créer l'aperçu approprié
    const fileExtension = fileName.split('.').pop().toLowerCase();
    const isPDF = fileExtension === 'pdf';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
    
    if (!fileUrl) {
      // Pas d'URL disponible
      const noUrlDiv = document.createElement('div');
      noUrlDiv.className = 'text-center';
      noUrlDiv.innerHTML = `
        <span class="material-symbols-outlined text-6xl text-gray-400 dark:text-gray-600 mb-4 block">warning</span>
        <p class="text-text-light-secondary dark:text-text-dark-secondary mb-4">URL du fichier non disponible</p>
        <p class="text-sm text-gray-500 dark:text-gray-500">Le fichier n'a pas d'URL de téléchargement associée</p>
      `;
      previewDiv.appendChild(noUrlDiv);
    } else if (isPDF) {
      // Affichage avec Google Docs Viewer (simple et sans folklore)
      const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
      const iframe = document.createElement('iframe');
      iframe.src = googleViewerUrl;
      iframe.className = 'w-full h-full';
      iframe.style.minHeight = '600px';
      iframe.style.border = 'none';
      previewDiv.appendChild(iframe);
    } else if (isImage) {
      // Pour les images, créer un img tag
      const img = document.createElement('img');
      img.src = fileUrl;
      img.alt = fileName;
      img.className = 'max-w-full max-h-full object-contain rounded-lg';
      img.style.maxHeight = 'calc(98vh - 80px)';
      img.onerror = () => {
        img.style.display = 'none';
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-center';
        errorDiv.innerHTML = `
          <span class="material-symbols-outlined text-6xl text-red-400 mb-4 block">image_not_supported</span>
          <p class="text-text-light-secondary dark:text-text-dark-secondary mb-4">Impossible de charger l'image</p>
          <p class="text-sm text-gray-500 dark:text-gray-500">L'URL du fichier pourrait être invalide ou le fichier supprimé</p>
        `;
        previewDiv.appendChild(errorDiv);
      };
      previewDiv.appendChild(img);
    } else {
      // Fichier non supporté pour l'aperçu
      const noPreviewDiv = document.createElement('div');
      noPreviewDiv.className = 'text-center';
      noPreviewDiv.innerHTML = `
        <span class="material-symbols-outlined text-6xl text-gray-400 dark:text-gray-600 mb-4 block">description</span>
        <p class="text-text-light-secondary dark:text-text-dark-secondary mb-4">Aperçu non disponible pour ce type de fichier</p>
        <p class="text-sm text-text-light-secondary dark:text-text-dark-secondary">Utilisez le bouton télécharger pour ouvrir le fichier</p>
      `;
      previewDiv.appendChild(noPreviewDiv);
    }
    
    const footerDiv = document.createElement('div');
    footerDiv.className = 'p-2 sm:p-3 border-t border-[#e8ede8] dark:border-[#2a3a32] flex gap-2 sm:gap-3 justify-center flex-shrink-0';
    
    if (fileUrl) {
        const downloadBtn = document.createElement('a');
        downloadBtn.href = fileUrl;
        downloadBtn.download = fileName;
        downloadBtn.className = 'inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-background-light hover:bg-primary/90 transition-colors font-medium text-sm font-display shadow-soft';
        downloadBtn.innerHTML = '<span class="material-symbols-outlined" style="font-variation-settings: \'FILL\' 1;">download</span> Télécharger';
        
        footerDiv.appendChild(downloadBtn);
    }
    
    modalContent.appendChild(headerDiv);
    modalContent.appendChild(previewDiv);
    modalContent.appendChild(footerDiv);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Fermer le modal au clic sur le bouton
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Fermer le modal au clic en dehors
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
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
      let depenses = await getDepensesPourPeriode(mois, annee);
      
      // Le backend retourne déjà justificatifUrl mappé, pas besoin de remappe
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
    
    // Filtrer pour afficher SEULEMENT les dépenses d'aujourd'hui
    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const depensesAujourdhui = depenses.filter((d) => {
      const dateStr = d.date || d.expense_date || d.expenseDate;
      if (!dateStr) return false;
      
      // Parser la date ISO
      const dt = new Date(dateStr);
      if (isNaN(dt.getTime())) return false;
      
      // Créer une date locale sans heure
      const dDate = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
      
      // Comparer les dates (aujourd'hui uniquement)
      return dDate.getTime() === todayDateOnly.getTime();
    });

    tbodyCompact.innerHTML = "";

    if (!depensesAujourdhui.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
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
          <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
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
        "Créé par",
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
          d.created_by_name || "",
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

    // ✅ Afficher la zone d'upload appropriée si fichier présent
    if (data.file) {
      showUploadZoneUploading();
    }

    // ✅ Appeler l'API (asynchrone) avec suivi de progression
    const onProgress = (percent) => {
      updateProgressBar(percent);
    };

    const result = await addDepense(data, onProgress);
    
    if (!result) {
      // Afficher la zone d'erreur
      showUploadZoneError("Erreur lors de l'enregistrement de la dépense");
      return;
    }

    // ✅ Afficher la zone de succès si fichier
    if (data.file) {
      showUploadZoneSuccess(data.file);
    }

    form.reset();
    setTodayAsDefaultDate();
    showUploadZoneDefault(); // Réinitialiser la zone d'upload

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
