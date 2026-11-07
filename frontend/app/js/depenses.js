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

  // Moins fréquentes : proposées derrière « Plus de catégories ». Elles ont
  // chacune leur place dans le compte de résultat SYSCOHADA (etats_financiers.js) ;
  // les trois dernières sortent de l'argent sans être des charges.
  const categoriesPlus = [
    "Matières premières",
    "Intérêts d'emprunt",
    "Amendes & pénalités",
    "Impôt sur le bénéfice",
    "Retrait personnel",
    "Remboursement d'emprunt",
    "Matériel / Équipement"
  ];
  const categoriesConnues = () => [...baseCategories, ...categoriesPlus, ...loadCustomCategories()];

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
    const all = [...baseCategories, ...categoriesPlus, ...custom].filter(Boolean);

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
    const existsInBase = [...baseCategories, ...categoriesPlus].some((b) => b.toLowerCase() === label.toLowerCase());
    const existsInCustom = custom.some((c) => String(c).toLowerCase() === label.toLowerCase());

    if (!existsInBase && !existsInCustom) {
      custom.push(label);
      saveCustomCategories(custom);
    }

    // Rebuild + sélectionner la nouvelle catégorie
    buildCategorieOptions();
    const baseMatch = [...baseCategories, ...categoriesPlus].find((b) => b.toLowerCase() === label.toLowerCase());
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
    const noteInput = document.getElementById("depense-note");
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
      // Facultatif : absent du contrôle de présence plus haut, une dépense
      // sans commentaire doit pouvoir s'enregistrer.
      note: (noteInput?.value || "").trim(),
      // Dépense à crédit : date de remboursement estimée (facultative)
      credit_echeance: moyenPaiement === "credit" ? (document.getElementById("depense-credit-echeance")?.value || "") : "",
      file // Ajouter l'objet File pour l'upload
    };
  }

  function formatDateFr(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString("fr-FR");
  }

  // Heure de la dernière modification (instant précis, fuseau du Gabon)
  function formatHeureModification(value) {
    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Libreville" });
  }

  function affichageHeure(objet) {
    if (objet.modified_at) {
      return formatHeureModification(objet.modified_at) + ' <span class="block text-[10px] font-semibold text-primary">modifiée</span>';
    }
    return formatHeure(objet.created_at);
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

  /**
   * Neutralise le texte saisi par l'utilisateur avant insertion dans du
   * HTML. Les lignes sont construites par innerHTML : sans cela, un
   * commentaire contenant « < » casserait la mise en page, et un
   * `<img onerror=…>` s'exécuterait dans le navigateur du gérant.
   */
  function echapperHtml(valeur) {
    return String(valeur ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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
        ${affichageHeure(depense)}
      </td>
      <td class="px-6 py-4">
        ${echapperHtml(depense.categorie || "-")}
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
            : depense.moyen_paiement === "credit"
            ? `<span class="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 text-xs font-bold text-orange-700 dark:text-orange-300">Crédit</span>`
            : echapperHtml(depense.moyen_paiement || "-")
        }${
          // Encore à payer : date prévue et bouton « Payer » (à tout moment, pas seulement 24 h)
          depense.moyen_paiement === "credit"
            ? `${depense.credit_echeance ? `<span class="block text-[11px] ${depense.credit_echeance < new Date().toISOString().slice(0, 10) ? "font-bold text-red-600" : "text-gray-500 dark:text-gray-400"}">à rembourser le ${formatDateFr(depense.credit_echeance)}</span>` : ""}
               ${depense.peut_agir === false ? "" : `<span class="payer-dette mt-1 flex flex-wrap items-center gap-1">
                 <button type="button" class="payer-ouvrir h-7 px-3 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary/90">Payer</button></span>`}`
            // Déjà payée : on garde la trace du crédit
            : depense.credit_regle_le
            ? `<span class="block text-[11px] text-gray-500 dark:text-gray-400">crédit payé le ${formatDateFr(depense.credit_regle_le)}</span>`
            : ""
        }
      </td>
      <td class="px-6 py-4">
        ${echapperHtml(depense.created_by_name || "-")}
      </td>
      <td class="px-6 py-4">
        ${
          depense.justificatif
            ? `<span class="font-medium text-primary cursor-pointer hover:underline justificatif-link" data-file="${echapperHtml(depense.justificatif)}" data-justif-id="${echapperHtml(depense.id)}">${echapperHtml(depense.justificatif)}</span>`
            : `-`
        }
      </td>
      <td class="px-6 py-4">
        ${
          // Tronqué à l'affichage : un commentaire long écraserait les
          // autres colonnes. Un clic l'ouvre en entier
          // (commentaire-complet.js), le survol ne suffisant pas sur
          // téléphone.
          depense.note
            ? `<button type="button" class="commentaire-complet block max-w-[16rem] truncate text-left underline decoration-dotted underline-offset-2 hover:text-primary" title="Lire le commentaire" data-commentaire="${echapperHtml(depense.note)}">${echapperHtml(depense.note)}</button>`
            : "-"
        }
      </td>
      <td class="px-6 py-4 text-center">
        ${depense.peut_agir === false ? `<span class="material-symbols-outlined text-lg text-gray-400" title="Enregistrée par ${echapperHtml(depense.created_by_name || "un autre utilisateur")} : seul son auteur ou le gérant peut la modifier ou la supprimer">lock</span>` : `
        ${window.OGOUE_MODIFIER?.estModifiable(depense.created_at) ? `<button class="edit-btn text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-primary text-lg mr-3" title="Modifier" data-id="${depense.id}">✏️</button>` : ""}
        <button class="delete-btn text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xl" title="Supprimer" data-id="${depense.id}">
          🗑️
        </button>`}
      </td>
    `;

    // Ajouter l'event listener pour ouvrir le modal si justificatif
    if (depense.justificatif) {
      const link = tr.querySelector('.justificatif-link');
      if (link) {
        // Le bucket est privé : il n'y a plus d'URL à porter dans le
        // tableau. Le lien se demande au clic et vaut cinq minutes —
        // signer les justificatifs de toutes les lignes au chargement
        // ferait autant d'appels que de dépenses, pour un seul ouvert.
        link.addEventListener('click', async () => {
          const fileName = link.getAttribute('data-file');
          const depenseId = link.getAttribute('data-justif-id');
          const libelle = link.textContent;
          link.textContent = '…';
          try {
            const reponse = await fetch(`${API_BASE_URL}/api/expenses/${depenseId}/justificatif`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
            });
            const data = await reponse.json();
            if (!reponse.ok) throw new Error(data.error || "Justificatif indisponible");
            openJustificatifModal(fileName, data.url);
          } catch (erreur) {
            console.error('Erreur justificatif:', erreur);
            alert("Le justificatif n'a pas pu être ouvert : " + erreur.message);
          } finally {
            link.textContent = libelle;
          }
        });
      }
    }

    // Payer une dépense à crédit : on choisit le moyen, la ligne passe à ce moyen
    const zonePayer = tr.querySelector('.payer-dette');
    if (zonePayer) {
      zonePayer.addEventListener('click', async (e) => {
        if (e.target.closest('.payer-ouvrir')) {
          zonePayer.innerHTML =
            '<span class="text-[11px] text-gray-500">Payé en :</span>' +
            '<button type="button" data-moyen="cash" class="h-7 px-2.5 rounded-full bg-[#0d1b19] text-white text-xs font-bold">Cash</button>' +
            '<button type="button" data-moyen="mobile_money" class="h-7 px-2.5 rounded-full bg-[#0d1b19] text-white text-xs font-bold">Mobile Money</button>' +
            '<button type="button" data-renoncer class="h-7 px-1 text-xs text-gray-500 hover:underline">Annuler</button>';
          return;
        }
        if (e.target.closest('[data-renoncer]')) {
          zonePayer.innerHTML = '<button type="button" class="payer-ouvrir h-7 px-3 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary/90">Payer</button>';
          return;
        }
        const moyen = e.target.closest('[data-moyen]')?.dataset.moyen;
        if (!moyen) return;
        zonePayer.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        const r = await window.OGOUE.reglerDepense(depense.id, moyen);
        if (!r.ok) { alert(r.error); zonePayer.querySelectorAll('button').forEach((b) => { b.disabled = false; }); return; }
        window.OGOUE_FEEDBACK?.succes(`Dette payée en ${moyen === "cash" ? "Cash" : "Mobile Money"} · ${formatMontant(depense.montant)}`);
        depensesCacheMois = null;
        depensesCacheAnnee = null;
        await renderCompactTable();
        if (modal && !modal.classList.contains("hidden")) renderFullTable();
      });
    }

    // Ajouter l'event listener pour supprimer
    const deleteBtn = tr.querySelector('.delete-btn');
    tr.querySelector('.edit-btn')?.addEventListener('click', () => ouvrirModificationDepense(depense));
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
      
      // Le backend ne renvoie plus d'URL : le bucket est privé, le
      // lien se signe au clic. Seul l'id de la ligne est nécessaire.
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
        <td colspan="9" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
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
          <td colspan="9" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
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
  // Modification d'une dépense (24 h après l'enregistrement, contrôlée par le serveur)
  function ouvrirModificationDepense(depense) {
    window.OGOUE_MODIFIER.ouvrir({
      titre: "Modifier la dépense",
      url: `${API_BASE_URL}/api/expenses/${depense.id}`,
      token: getToken(),
      champs: [
        { name: "expenseDate", label: "Date de la transaction", type: "date", value: depense.date },
        { name: "category", label: "Catégorie", type: "select", value: depense.categorie || "",
          options: [].concat(
            [{ value: "", label: "Sélectionner une catégorie" }],
            depense.categorie && !categoriesConnues().includes(depense.categorie) ? [{ value: depense.categorie, label: depense.categorie }] : [],
            categoriesConnues().map((c) => ({ value: c, label: c })),
            [{ value: "__OTHER__", label: "Autres (préciser)" }]
          ) },
        { name: "categorieAutre", label: "Préciser la catégorie", type: "text", value: "",
          visibleSi: { champ: "category", valeur: "__OTHER__" } },
        { name: "paymentMethod", label: "Moyen de paiement", type: "select", value: depense.moyen_paiement || "",
          options: [{ value: "cash", label: "Cash" }, { value: "mobile_money", label: "Mobile Money" }, { value: "credit", label: "Crédit (payé plus tard)" }] },
        { name: "amount", label: "Montant (FCFA)", type: "number", value: depense.montant },
        { name: "note", label: "Commentaire (facultatif)", type: "textarea", value: depense.note || "", pleine: true },
      ],
      transformer: (corps) => {
        if (corps.category === "__OTHER__") {
          const libelle = String(corps.categorieAutre || "").trim().replace(/s+/g, " ");
          corps.category = libelle;
          if (libelle) {
            const custom = loadCustomCategories();
            const existe = [...baseCategories, ...categoriesPlus, ...custom].some((c) => c.toLowerCase() === libelle.toLowerCase());
            if (!existe) saveCustomCategories([...custom, libelle]);
          }
        }
        delete corps.categorieAutre;
        if (corps.category === "") delete corps.category;
        return corps;
      },
      onSaved: async () => {
        depensesCacheMois = null;
        depensesCacheAnnee = null;
        await renderCompactTable();
        if (modal && !modal.classList.contains("hidden")) renderFullTable();
      },
    });
  }

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

    const bouton = form.querySelector('button[type="submit"]');
    window.OGOUE_FEEDBACK?.debut(bouton, "Enregistrement de la dépense…");

    const result = await addDepense(data, onProgress);

    if (!result) {
      window.OGOUE_FEEDBACK?.fin(bouton);
      // Afficher la zone d'erreur
      showUploadZoneError("Erreur lors de l'enregistrement de la dépense");
      return;
    }

    window.OGOUE_FEEDBACK?.fin(bouton);
    window.OGOUE_FEEDBACK?.succes("Dépense enregistrée avec succès");

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

  // =========================
  // 💳 DÉPENSE À CRÉDIT (payée plus tard)
  // =========================
  // Le moyen « Crédit » fait apparaître une date de remboursement estimée,
  // et rappelle de noter le fournisseur dans le commentaire. La dette se
  // paie ensuite depuis le tableau (bouton « Payer »).
  (function depenseACredit() {
    const moyen = document.getElementById("depense-moyen-paiement");
    const note = document.getElementById("depense-note");
    if (!moyen) return;
    const ligne = moyen.closest(".grid") || moyen.closest("label");
    const bloc = document.createElement("div");
    bloc.className = "hidden rounded-2xl border border-orange-200 dark:border-orange-900/50 bg-orange-50/70 dark:bg-orange-950/20 p-4";
    bloc.innerHTML =
      '<label class="flex flex-col md:max-w-sm"><p class="text-base font-medium leading-normal pb-2 text-[#0a0c0a] dark:text-gray-200">Date de remboursement estimée <span class="font-normal text-gray-500">(facultatif)</span></p>' +
      '<input id="depense-credit-echeance" type="date" class="form-input date-input flex w-full rounded-lg text-[#0a0c0a] dark:text-white border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark h-14 p-[15px] text-base"></label>' +
      '<p class="mt-3 text-sm text-orange-800 dark:text-orange-300"><strong>Pensez à écrire le nom du fournisseur dans le commentaire</strong> : vous saurez à qui vous devez cet argent. Quand vous l\'aurez payé, appuyez sur « Payer » dans le tableau des dépenses.</p>';
    ligne.insertAdjacentElement("afterend", bloc);
    const placeholderNote = note ? note.placeholder : "";
    function maj() {
      const credit = moyen.value === "credit";
      bloc.classList.toggle("hidden", !credit);
      if (note) note.placeholder = credit ? "Ex. : Laiterie Estuaire, 20 L de lait, à régler vendredi." : placeholderNote;
    }
    moyen.addEventListener("change", maj);
    form.addEventListener("reset", () => setTimeout(maj, 0));
    maj();
  })();

  // =========================
  // 🧾 SAISIE PAR BOUTONS ET CARTES (même présentation que les ventes)
  // =========================
  // Le moyen de paiement devient trois boutons à côté de la date, et les
  // catégories des cartes à toucher. Les listes d'origine restent dans la
  // page, cachées : ce sont toujours elles qui portent les valeurs envoyées.
  (function saisieParCartes() {
    const moyen = document.getElementById("depense-moyen-paiement");
    const dateInput = document.getElementById("depense-date");
    if (!moyen || !dateInput || !categorieSelect) return;
    const ligneDate = dateInput.closest(".grid");
    const labelCategorie = categorieSelect.closest("label");
    const labelMoyen = moyen.closest("label");
    if (!ligneDate || !labelCategorie || !labelMoyen) return;

    // Choix vérifiés à l'envoi, avec un message sous les cartes
    categorieSelect.required = false;
    moyen.required = false;
    labelCategorie.classList.add("hidden");
    labelMoyen.classList.add("hidden");

    const CLE_PAIEMENT = "ogo_depense_paiement";
    // Crédit : choisi dépense par dépense, jamais retenu ; sinon le dernier moyen utilisé
    const paiementHabituel = () => { try { return localStorage.getItem(CLE_PAIEMENT) === "mobile_money" ? "mobile_money" : "cash"; } catch (e) { return "cash"; } };
    const choisirMoyen = (valeur) => { moyen.value = valeur; moyen.dispatchEvent(new Event("change")); majMoyen(); };

    // ── Moyen de paiement, à côté de la date ──
    const blocPaiement = document.createElement("div");
    blocPaiement.className = "flex flex-col";
    blocPaiement.innerHTML =
      `<p class="text-base font-medium leading-normal pb-2 text-[#0a0c0a] dark:text-gray-200">Moyen de paiement <span class="text-red-500">*</span></p>` +
      `<div class="inline-flex self-start rounded-full bg-gray-100 dark:bg-gray-800 p-1" data-depense-paiement>` +
      `<button type="button" data-paiement="cash" class="px-3 sm:px-5 h-12 rounded-full text-sm font-bold whitespace-nowrap">Cash</button>` +
      `<button type="button" data-paiement="mobile_money" class="px-3 sm:px-5 h-12 rounded-full text-sm font-bold whitespace-nowrap">Mobile Money</button>` +
      `<button type="button" data-paiement="credit" class="px-3 sm:px-5 h-12 rounded-full text-sm font-bold whitespace-nowrap" title="Payé plus tard">Crédit</button></div>`;
    labelCategorie.insertAdjacentElement("afterend", blocPaiement);
    function majMoyen() {
      blocPaiement.querySelectorAll("[data-paiement]").forEach((b) => {
        const on = b.dataset.paiement === moyen.value;
        ["bg-white", "dark:bg-gray-600", "shadow-sm", "text-[#0a0c0a]", "dark:text-white"].forEach((k) => b.classList.toggle(k, on));
        b.classList.toggle("text-gray-500", !on);
      });
    }
    blocPaiement.addEventListener("click", (e) => {
      const b = e.target.closest("[data-paiement]");
      if (!b) return;
      if (b.dataset.paiement !== "credit") { try { localStorage.setItem(CLE_PAIEMENT, b.dataset.paiement); } catch (err) {} }
      choisirMoyen(b.dataset.paiement);
    });

    // ── Catégories en cartes, sous la date ──
    const ICONES = {
      "achats / stocks": "inventory_2", "salaires": "payments", "loyer": "home", "marketing": "campaign",
      "électricité": "bolt", "eau": "water_drop", "internet & télécom": "wifi", "transport & logistique": "local_shipping",
      "impôts & taxes": "account_balance", "entretien & maintenance": "build",
      "matières premières": "grain", "intérêts d'emprunt": "percent", "amendes & pénalités": "gavel", "impôt sur le bénéfice": "receipt_long",
      "retrait personnel": "person", "remboursement d'emprunt": "credit_score", "matériel / équipement": "construction"
    };
    // Petite précision sous les cartes qui ne sont pas des charges
    const PRECISIONS = {
      "Matières premières": "Farine, tissu… pour fabriquer",
      "Retrait personnel": "Argent pris pour vous",
      "Remboursement d'emprunt": "Capital remboursé",
      "Matériel / Équipement": "Achat durable : four, moto…"
    };
    let plusOuvert = false;
    // Entreprise qui revend et fabrique : « Matières premières » parmi les
    // cartes habituelles, juste après « Achats / Stocks »
    let promues = [];
    (async () => {
      try {
        const API = (["localhost", "127.0.0.1"].some((h) => location.hostname.includes(h))) ? "http://localhost:3001" : "https://api.ogoue.com";
        const r = await fetch(`${API}/api/organization`, { headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` } });
        const org = r.ok ? await r.json() : null;
        if (org?.modeActivite === "les_deux") { promues = ["Matières premières"]; afficherCartes(); }
      } catch (e) {}
    })();
    const blocCartes = document.createElement("div");
    blocCartes.innerHTML = `
      <p class="text-base font-medium leading-normal pb-2 text-[#0a0c0a] dark:text-gray-200">Catégorie <span class="text-red-500">*</span></p>
      <div data-cartes-categories class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"></div>
      <button type="button" data-changer-categorie class="hidden mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
        <span class="material-symbols-outlined text-base">swap_horiz</span>Changer de catégorie</button>
      <p data-cartes-erreur class="hidden mt-3 text-sm font-medium text-red-600">Choisissez la catégorie de cette dépense.</p>`;
    ligneDate.insertAdjacentElement("afterend", blocCartes);
    const grille = blocCartes.querySelector("[data-cartes-categories]");
    const erreur = blocCartes.querySelector("[data-cartes-erreur]");
    const changer = blocCartes.querySelector("[data-changer-categorie]");

    // Tant qu'aucune catégorie n'est choisie, la suite du formulaire (montant,
    // commentaire, justificatif, bouton) reste cachée. Classe dédiée : les
    // blocs gardent leur propre « hidden » (cadre crédit, zones d'envoi).
    const styleEtape = document.createElement("style");
    styleEtape.textContent = ".depense-attente { display: none !important; }";
    document.head.appendChild(styleEtape);
    const suite = () => { const l = []; for (let n = blocCartes.nextElementSibling; n; n = n.nextElementSibling) l.push(n); return l; };
    // « Préciser la catégorie » apparaît juste sous les cartes
    if (categorieAutreWrapper) {
      categorieAutreWrapper.classList.remove("md:col-span-2");
      categorieAutreWrapper.classList.add("mt-4");
      blocCartes.appendChild(categorieAutreWrapper);
    }

    function afficherCartes() {
      const choix = [...categorieSelect.options].filter((o) => o.value && o.value !== "__OTHER__").map((o) => o.value);
      const carte = (valeur, libelle, icone, precision = PRECISIONS[valeur]) => {
        const on = categorieSelect.value === valeur;
        return `<button type="button" data-categorie="${echapperHtml(valeur)}"
          class="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3 min-w-0 text-left rounded-2xl border-2 px-3 max-[359px]:px-2.5 py-3 sm:px-4 min-h-[64px] transition ${on
            ? "border-primary bg-primary/10 dark:bg-primary/20"
            : "border-[#cfe7e3] dark:border-gray-700 bg-white dark:bg-[#182c29] hover:border-primary/50"}">
          <span class="material-symbols-outlined text-2xl ${on ? "text-primary" : "text-gray-400"}">${icone}</span>
          <span class="min-w-0 max-w-full font-bold text-sm max-[359px]:text-[13px] sm:text-[15px] leading-tight break-words hyphens-auto text-[#0a0c0a] dark:text-white">${echapperHtml(libelle).replace("Remboursement", "Rembourse\u00ADment")}${precision ? `<span class="block mt-0.5 text-xs font-normal text-gray-500 dark:text-gray-400">${echapperHtml(precision)}</span>` : ""}</span></button>`;
      };
      // Catégorie choisie : seule sa carte reste, et la suite du formulaire apparaît
      const choisie = categorieSelect.value;
      const icone = (c) => ICONES[c.toLowerCase()] || "sell";
      const courantes = choix.filter((c) => !categoriesPlus.includes(c));
      promues.forEach((c) => { const i = courantes.indexOf("Achats / Stocks"); courantes.splice(i + 1, 0, c); });
      const cartes = courantes.map((c) => carte(c, c, icone(c))).join("") +
        (plusOuvert
          ? categoriesPlus.filter((c) => !promues.includes(c)).map((c) => carte(c, c, icone(c))).join("")
          : `<button type="button" data-plus-categories class="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-3 min-w-0 text-left rounded-2xl border-2 border-dashed border-[#cfe7e3] dark:border-gray-700 px-3 py-3 sm:px-4 min-h-[64px] hover:border-primary/50">
              <span class="material-symbols-outlined text-2xl text-gray-400">expand_more</span>
              <span class="font-bold text-sm sm:text-[15px] leading-tight text-[#0a0c0a] dark:text-white">Plus de catégories</span></button>`) +
        carte("__OTHER__", "Autre catégorie", "add_circle");
      grille.innerHTML = choisie
        ? (choisie === "__OTHER__" ? carte("__OTHER__", "Autre catégorie", "add_circle") : carte(choisie, choisie, icone(choisie)))
        : cartes;
      changer.classList.toggle("hidden", !choisie);
      suite().forEach((el) => el.classList.toggle("depense-attente", !choisie));
    }
    function choisirCategorie(valeur) {
      categorieSelect.value = valeur;
      categorieSelect.dispatchEvent(new Event("change")); // « Autres » : affiche ou cache le champ à préciser
      erreur.classList.add("hidden");
      afficherCartes();
    }
    grille.addEventListener("click", (e) => {
      if (e.target.closest("[data-plus-categories]")) { plusOuvert = true; afficherCartes(); return; }
      const b = e.target.closest("[data-categorie]");
      if (!b) return;
      // Un appui sur la carte déjà choisie revient à la liste complète
      if (categorieSelect.value === b.dataset.categorie) { choisirCategorie(""); return; }
      choisirCategorie(b.dataset.categorie);
      if (b.dataset.categorie !== "__OTHER__") document.getElementById("depense-montant")?.focus();
    });
    changer.addEventListener("click", () => choisirCategorie(""));

    // Sans catégorie, on ne laisse pas partir la dépense : le message est sous les cartes
    form.addEventListener("submit", (e) => {
      if (categorieSelect.value) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      erreur.classList.remove("hidden");
      blocCartes.scrollIntoView({ behavior: "smooth", block: "center" });
    }, true);

    // Après un enregistrement (le formulaire est vidé) : moyen habituel, aucune
    // catégorie choisie, et la nouvelle catégorie « Autres » parmi les cartes
    form.addEventListener("reset", () => setTimeout(() => {
      choisirMoyen(paiementHabituel());
      plusOuvert = false;
      afficherCartes();
    }, 0));

    choisirMoyen(paiementHabituel());
    afficherCartes();
  })();
})();
