// js/ventes.js
(function () {
  if (!window.OGOUE) {
    console.error("OGOUE store non chargé");
    return;
  }

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
  // ✅ LOGIQUE "ARTICLES" (Option B)
  // =========================
  const STORAGE_KEY_ARTICLES = "ogoue.ventes.articles";

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
      const raw = localStorage.getItem(STORAGE_KEY_ARTICLES);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter(Boolean) : [];
    } catch (e) {
      return [];
    }
  }

  function saveArticles(list) {
    localStorage.setItem(STORAGE_KEY_ARTICLES, JSON.stringify(list));
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

  setTodayAsDefaultDate();

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
    if (fileInput && fileInput.files && fileInput.files[0]) {
      justificatifFile = fileInput.files[0].name;
    }

    return {
      id: generateId(),
      date,
      description,
      moyen_paiement: moyenPaiement,
      type_vente: typeVente,
      quantite: isNaN(quantite) ? 0 : quantite,
      montant: isNaN(montant) ? 0 : montant,
      justificatif: justificatifFile
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

  function createRow(vente) {
    const tr = document.createElement("tr");
    tr.className = "border-b dark:border-gray-700";

    tr.innerHTML = `
      <td class="px-6 py-4 font-medium text-[#0d1b19] dark:text-white whitespace-nowrap">
        ${formatDateFr(vente.date)}
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
        ${
          vente.justificatif
            ? `<span class="font-medium text-primary cursor-pointer hover:underline justificatif-link" data-file="${vente.justificatif}">${vente.justificatif}</span>`
            : `-`
        }
      </td>
    `;

    // Ajouter l'event listener pour ouvrir le modal si justificatif
    if (vente.justificatif) {
      const link = tr.querySelector('.justificatif-link');
      if (link) {
        link.addEventListener('click', () => openJustificatifModal(vente.justificatif));
      }
    }

    return tr;
  }

  // Modal pour afficher le justificatif
  function openJustificatifModal(fileName) {
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
    content.innerHTML = `
      <div style="margin-bottom:20px;">
        <p style="font-size:14px;color:#666;margin-bottom:10px;">Justificatif enregistré:</p>
        <p style="font-size:18px;font-weight:bold;color:#0d1b19;word-break:break-word;" class="dark:text-white">${fileName}</p>
      </div>
      <div style="padding:20px;background:#f3f4f6;border-radius:6px;margin-top:20px;" class="dark:bg-gray-700">
        <p style="font-size:13px;color:#666;margin:0;" class="dark:text-gray-300">
          📎 Le fichier justificatif a été enregistré avec succès.
        </p>
      </div>
    `;
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
      const ventes = await getVentesPourPeriode(mois, annee);
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
      
      // Parser la date ISO (ex: "2025-12-22T23:00:00.000Z")
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      
      // Créer une date locale sans heure
      const vDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      
      // Comparer les dates
      return vDate.getTime() === todayDateOnly.getTime();
    });

    tbodyCompact.innerHTML = "";

    if (!ventesAujourdhui.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
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
          <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
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

    // ✅ Appeler l'API (asynchrone)
    const result = await addVente(data);
    if (!result) {
      // addVente a déjà affichéun message d'erreur
      return;
    }

    form.reset();
    setTodayAsDefaultDate();
    
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
