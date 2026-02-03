// js/ventes.js
(function () {
  if (!window.OGOUE) {
    console.error("OGOUE store non chargé");
    return;
  }

  const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:3001'
    : 'https://api.ogoue.com';
  const { appState, addVente, getVentesPourPeriode } = window.OGOUE;

  const form = document.getElementById("form-ventes");
  const tbodyCompact = document.getElementById("ventes-tbody");

  const modal = document.getElementById("ventes-modal");
  const tbodyFull = document.getElementById("ventes-full-tbody");
  const btnExpand = document.getElementById("btn-ventes-expand");
  const btnClose = document.getElementById("btn-ventes-close");
  const btnExport = document.getElementById("btn-ventes-export");

  if (!form || !tbodyCompact) {
    console.error("Formulaire (form-ventes) ou tableau (ventes-tbody) introuvable");
    return;
  }

  // =========================
  // 📁 GESTION DES UPLOADS
  // =========================
  const fileInput = document.getElementById("file-upload");
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

  // =========================
  // ✅ LOGIQUE "ARTICLES" (Option B)
  // =========================
  
  function getArticlesStorageKey() {
    // Récupère l'ID utilisateur actuel pour filtrer les articles par utilisateur
    try {
      const userStr = localStorage.getItem("user");
      if (!userStr) return "ogoue.ventes.articles"; // Fallback si pas d'utilisateur
      const user = JSON.parse(userStr);
      const userId = user?.id || user?.user_id;
      if (!userId) return "ogoue.ventes.articles";
      return `ogoue.ventes.articles.${userId}`; // Clé unique par utilisateur
    } catch (e) {
      return "ogoue.ventes.articles";
    }
  }

  const firstWrapper = document.getElementById("article-first-input-wrapper");
  const selectWrapper = document.getElementById("article-select-wrapper");
  const autreWrapper = document.getElementById("article-autre-wrapper");

  // Champ texte historique (existant) => utilisé en 1ère vente (liste vide)
  const firstInput = document.getElementById("vente-description");

  // Select + champ "Autre"
  const articleSelect = document.getElementById("vente-article-select");
  const autreInput = document.getElementById("vente-article-autre");

  function normalizeLabel(s) {
    return String(s || "").trim().replace(/\s+/g, " ");
  }

  function loadArticles() {
    try {
      const storageKey = getArticlesStorageKey();
      const raw = localStorage.getItem(storageKey);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }

  function saveArticles(list) {
    const storageKey = getArticlesStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(list));
  }

  function buildArticleOptions() {
    if (!articleSelect) return;

    const list = loadArticles();

    articleSelect.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Sélectionner un article / service";
    articleSelect.appendChild(opt0);

    list.forEach((label) => {
      const opt = document.createElement("option");
      opt.value = label;
      opt.textContent = label;
      articleSelect.appendChild(opt);
    });

    // ✅ “Autres” apparaît UNIQUEMENT si liste non vide (donc à partir de la 2e vente)
    const optOther = document.createElement("option");
    optOther.value = "__OTHER__";
    optOther.textContent = "Autres (ajouter un nouvel article)";
    articleSelect.appendChild(optOther);
  }

  function setModeListEmpty() {
    // liste vide => input texte seul, pas de select, pas de "Autres"
    if (firstWrapper) firstWrapper.classList.remove("hidden");
    if (selectWrapper) selectWrapper.classList.add("hidden");
    if (autreWrapper) autreWrapper.classList.add("hidden");

    if (firstInput) firstInput.required = true;

    if (articleSelect) {
      articleSelect.required = false;
      articleSelect.value = "";
    }
    if (autreInput) {
      autreInput.required = false;
      autreInput.value = "";
    }
  }

  function setModeListNotEmpty() {
    // liste non vide => select
    if (firstWrapper) firstWrapper.classList.add("hidden");
    if (selectWrapper) selectWrapper.classList.remove("hidden");

    if (autreWrapper) autreWrapper.classList.add("hidden");

    if (firstInput) {
      firstInput.required = false;
      firstInput.value = "";
    }

    if (articleSelect) {
      articleSelect.required = true;
    }
    if (autreInput) {
      autreInput.required = false;
      autreInput.value = "";
    }

    buildArticleOptions();
  }

  function toggleOther(isOther) {
    if (!autreWrapper || !autreInput) return;

    if (isOther) {
      autreWrapper.classList.remove("hidden");
      autreInput.required = true;
      setTimeout(() => autreInput.focus(), 0);
    } else {
      autreWrapper.classList.add("hidden");
      autreInput.required = false;
      autreInput.value = "";
    }
  }

  function initArticlesUI() {
    const list = loadArticles();
    if (list.length === 0) setModeListEmpty();
    else setModeListNotEmpty();

    if (articleSelect) {
      articleSelect.addEventListener("change", () => {
        toggleOther(articleSelect.value === "__OTHER__");
      });
    }
  }

  // Lance l'UI au chargement
  initArticlesUI();

  // =========================
  // 🔹 Date par défaut = aujourd'hui
  // =========================
  const dateInputDefault = document.getElementById("vente-date");

  function setTodayAsDefaultDate() {
    if (!dateInputDefault) return;
    // Utilise la date locale (évite le décalage dû à l'UTC de toISOString)
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
    return "vente_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
  }

  // ✅ Récupère l'article/service selon le mode
  function getArticleValue() {
    const list = loadArticles();

    // Mode 1ère vente (liste vide)
    if (list.length === 0) {
      const v = normalizeLabel(firstInput ? firstInput.value : "");
      return v;
    }

    // Mode liste non vide : select
    const selected = articleSelect ? articleSelect.value : "";
    if (selected === "__OTHER__") {
      const other = normalizeLabel(autreInput ? autreInput.value : "");
      return other;
    }

    return normalizeLabel(selected);
  }

  // ✅ Ajoute l'article en storage si nécessaire
  function persistArticleIfNeeded(articleLabel) {
    const label = normalizeLabel(articleLabel);
    if (!label) return;

    const list = loadArticles();
    const exists = list.some((x) => String(x).toLowerCase() === label.toLowerCase());

    if (!exists) {
      list.push(label);
      saveArticles(list);
    }
  }

  function getFormData() {
    const dateInput = document.getElementById("vente-date");
    const moyenInput = document.getElementById("vente-moyen-paiement");
    const typeInput = document.getElementById("vente-type");
    const qteInput = document.getElementById("vente-quantite");
    const montantInput = document.getElementById("vente-montant");
    const fileInput = document.getElementById("file-upload");

    if (!dateInput || !moyenInput || !typeInput || !qteInput || !montantInput) {
      console.error("Un ou plusieurs champs du formulaire ventes sont introuvables :", {
        dateInput,
        moyenInput,
        typeInput,
        qteInput,
        montantInput
      });
      return null;
    }

    const date = dateInput.value;
    const description = getArticleValue(); // ✅ article/service final
    const moyenPaiement = moyenInput.value;
    const typeVente = typeInput.value;
    const quantite = parseFloat(qteInput.value || "0");
    const montant = parseFloat(montantInput.value || "0");

    let justificatifFile = "";
    let file = null;
    
    if (fileInput && fileInput.files && fileInput.files[0]) {
      file = fileInput.files[0];
      justificatifFile = file.name;
    }

    return {
      id: generateId(),
      date,
      description,
      moyen_paiement: moyenPaiement,
      type_vente: typeVente,
      quantite: isNaN(quantite) ? 0 : quantite,
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

  async function deleteVente(venteId) {
    try {
      // Importer le module d'audit
      const { default: DeletionAuditManager } = await import("./deletion-audit.js");

      // Trouver et mémoriser la ligne à supprimer
      const rowToDelete = document.querySelector(`tr[data-vente-id="${venteId}"]`);

      // Utiliser le système d'audit pour la suppression
      const result = await DeletionAuditManager.deleteWithAudit(
        `${API_BASE_URL}/api/sales/${venteId}`,
        {
          title: "Supprimer cette vente ?",
          message: "Vous êtes sur le point de supprimer cet enregistrement. Veuillez expliquer le motif de cette suppression.",
          recordType: "sale",
          recordId: venteId
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
        console.log('✅ Vente supprimée avec succès');
      } else {
        console.error('❌ Erreur suppression:', result.error);
        alert(`Erreur: ${result.error}`);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression de la vente');
    }
  }

  function createRow(vente) {
    const tr = document.createElement("tr");
    tr.className = "border-b dark:border-gray-700";
    tr.setAttribute('data-vente-id', vente.id);

    tr.innerHTML = `
      <td class="px-6 py-4 font-medium text-[#0d1b19] dark:text-white whitespace-nowrap">
        ${formatDateFr(vente.date)}
      </td>
      <td class="px-6 py-4 text-sm">
        ${formatHeure(vente.created_at)}
      </td>
      <td class="px-6 py-4">
        ${vente.description || "-"}
      </td>
      <td class="px-6 py-4">
        ${vente.quantite ?? "-"}
      </td>
      <td class="px-6 py-4">
        ${formatMontant(vente.montant)}
      </td>
      <td class="px-6 py-4">
        ${
          vente.moyen_paiement === "mobile_money"
            ? "Mobile Money"
            : vente.moyen_paiement === "cash"
            ? "Cash"
            : vente.moyen_paiement || "-"
        }
      </td>
      <td class="px-6 py-4">
        ${
          vente.type_vente === "produits"
            ? "Produits"
            : vente.type_vente === "services"
            ? "Service"
            : vente.type_vente || "-"
        }
      </td>
      <td class="px-6 py-4">
        ${vente.created_by_name || "-"}
      </td>
      <td class="px-6 py-4">
        ${
          vente.justificatif
            ? `<span class="font-medium text-primary cursor-pointer hover:underline justificatif-link" data-file="${vente.justificatif}" data-url="${vente.justificatifUrl || ''}">${vente.justificatif}</span>`
            : `-`
        }
      </td>
      <td class="px-6 py-4 text-center">
        <button class="delete-btn text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xl" title="Supprimer" data-id="${vente.id}">
          🗑️
        </button>
      </td>
    `;

    // Ajouter l'event listener pour ouvrir le modal si justificatif
    if (vente.justificatif) {
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
        const venteId = deleteBtn.getAttribute('data-id');
        deleteVente(venteId);
      });
    }

    return tr;
  }

  // Modal pour afficher et télécharger le justificatif
  function openJustificatifModal(fileName, fileUrl) {
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
    closeBtn.className = 'absolute top-6 right-6 w-8 h-8 rounded-full bg-[#f0f0f0] dark:bg-[#2a3a32] flex items-center justify-center text-[#666] dark:text-[#999] hover:bg-[#e0e0e0] dark:hover:bg-[#3a4a42] transition-colors z-10';
    closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
    closeBtn.type = 'button';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'p-4 sm:p-6 border-b border-[#e8ede8] dark:border-[#2a3a32] flex justify-between items-start gap-2 flex-shrink-0';
    
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
    
    if (fileUrl) {
      if (isPDF) {
        // Affichage avec Google Docs Viewer (simple et sans folkore)
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
    } else {
      const noFileDiv = document.createElement('div');
      noFileDiv.className = 'text-center';
      noFileDiv.innerHTML = `
        <span class="material-symbols-outlined text-6xl text-gray-400 dark:text-gray-600 mb-4 block">warning</span>
        <p class="text-text-light-secondary dark:text-text-dark-secondary mb-4">URL du fichier non disponible</p>
        <p class="text-sm text-gray-500 dark:text-gray-500">Le fichier n'a pas d'URL de téléchargement associée</p>
      `;
      previewDiv.appendChild(noFileDiv);
    }
    
    const footerDiv = document.createElement('div');
    footerDiv.className = 'p-4 sm:p-6 border-t border-[#e8ede8] dark:border-[#2a3a32] flex gap-2 sm:gap-3 justify-center flex-shrink-0';
    
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

  // Cache pour les ventes afin de limiter les appels API
  let ventesCache = [];
  let ventesCacheMois = null;
  let ventesCacheAnnee = null;

  async function getVentesPeriodeCourante() {
    const { mois, annee } = appState.periodeCourante || {};
    
    // Vérifier si on a déjà le cache pour cette période
    if (ventesCacheMois === mois && ventesCacheAnnee === annee) {
      return ventesCache;
    }

    // Sinon, faire l'appel API
    if (typeof getVentesPourPeriode === "function") {
      let ventes = await getVentesPourPeriode(mois, annee);
      
      // Le backend retourne déjà justificatifUrl mappé, pas besoin de remappe
      // Mettre à jour le cache
      ventesCache = ventes;
      ventesCacheMois = mois;
      ventesCacheAnnee = annee;
      return ventes;
    }
    return [];
  }

  async function renderCompactTable() {
    const ventes = await getVentesPeriodeCourante();
    
    // Filtrer pour afficher SEULEMENT les ventes d'aujourd'hui
    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    const ventesAujourdhui = ventes.filter((v) => {
      const dateStr = v.date || v.sale_date || v.saleDate;
      if (!dateStr) return false;
      
      // Parser la date ISO
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      
      // Créer une date locale sans heure
      const vDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      
      // Comparer les dates (jour exact)
      return vDate.getTime() === todayDateOnly.getTime();
    });

    tbodyCompact.innerHTML = "";

    if (!ventesAujourdhui.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td colspan="9" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          Aucune vente enregistrée pour aujourd'hui.
        </td>
      `;
      tbodyCompact.appendChild(tr);
      return;
    }

    // Afficher seulement les 5 ventes les plus récentes
    ventesAujourdhui.slice(0, 5).forEach((v) => {
      tbodyCompact.appendChild(createRow(v));
    });
  }

  function renderFullTable() {
    if (!tbodyFull) return;

    // Récupérer les ventes asynchronement
    getVentesPeriodeCourante().then((ventes) => {
      // Filtrer pour afficher SEULEMENT les ventes d'aujourd'hui
      const today = new Date();
      const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      
      const ventesAujourdhui = ventes.filter((v) => {
        const dateStr = v.date || v.sale_date || v.saleDate;
        if (!dateStr) return false;
        
        // Parser la date ISO (ex: "2025-12-22T23:00:00.000Z")
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return false;
        
        // Créer une date locale sans heure
        const vDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        
        // Comparer les dates
        return vDate.getTime() === todayDateOnly.getTime();
      });

      tbodyFull.innerHTML = "";

      if (!ventesAujourdhui.length) {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td colspan="10" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
            Aucune vente enregistrée pour aujourd'hui.
          </td>
        `;
        tbodyFull.appendChild(tr);
        return;
      }

      ventesAujourdhui.forEach((v) => {
        tbodyFull.appendChild(createRow(v));
      });
    });
  }

  function exportVentesCSV() {
    getVentesPeriodeCourante().then((ventes) => {
      if (!ventes.length) {
        alert("Aucune vente à exporter pour cette période.");
        return;
      }

      const headers = [
        "Date",
        "Article",
        "Quantite",
        "Prix Total",
        "Paiement",
        "Type",
        "Créé par",
        "Justificatif"
      ];

      let csv = headers.join(";") + "\n";

      ventes.forEach((v) => {
        const row = [
          formatDateFr(v.date),
          v.description || "",
          v.quantite != null ? String(v.quantite).replace(".", ",") : "",
          v.montant != null ? String(v.montant).replace(".", ",") : "",
          v.moyen_paiement || "",
          v.type_vente || "",
          v.created_by_name || "",
          v.justificatif || ""
        ];

        csv += row
          .map((value) => {
            const vv = (value ?? "").toString().replace(/"/g, '""');
            return `"${vv}"`;
          })
          .join(";") + "\n";
      });

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const todayIso = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ventes_${todayIso}.csv`;

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      URL.revokeObjectURL(url);
    });
  }

  // ─── Events ─────────────────────────────

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const data = getFormData();

    if (!data) {
      alert("Un problème est survenu avec le formulaire Ventes (voir la console).");
      return;
    }

    // ✅ Validation article/service
    if (!data.description) {
      alert("Merci de saisir ou sélectionner un article / service.");
      return;
    }

    if (!data.date || !data.moyen_paiement || !data.type_vente || data.montant <= 0) {
      alert("Merci de remplir tous les champs obligatoires avec des valeurs valides.");
      return;
    }

    // ✅ Persist article avant reset, et bascule UI si besoin
    persistArticleIfNeeded(data.description);

    // ✅ Afficher la zone d'upload appropriée si fichier présent
    if (data.file) {
      showUploadZoneUploading();
    }

    // ✅ Appeler l'API (asynchrone) avec suivi de progression
    const onProgress = (percent) => {
      updateProgressBar(percent);
    };

    const result = await addVente(data, onProgress);
    
    if (!result) {
      // Afficher la zone d'erreur
      showUploadZoneError("Erreur lors de l'enregistrement de la vente");
      return;
    }

    // ✅ Afficher la zone de succès si fichier
    if (data.file) {
      showUploadZoneSuccess(data.file);
    }

    form.reset();
    setTodayAsDefaultDate();
    showUploadZoneDefault(); // Réinitialiser la zone d'upload
    
    // Rafraîchir le cache et le tableau
    ventesCacheMois = null;
    ventesCacheAnnee = null;
    await renderCompactTable();

    // ✅ Refresh UI articles après ajout
    const list = loadArticles();
    if (list.length === 0) {
      setModeListEmpty();
    } else {
      setModeListNotEmpty();
      // Optionnel : pré-sélectionner l'article qui vient d'être ajouté
      if (articleSelect) {
        articleSelect.value = data.description;
      }
      toggleOther(false);
    }
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
    btnExport.addEventListener("click", exportVentesCSV);
  }

  // Initialisation : charger et afficher les ventes de la période actuelle
  renderCompactTable();
})();
