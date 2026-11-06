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
  const zoneChoix = document.getElementById("justificatif-choix");
  const recuZoneAuto = document.getElementById("recu-zone-auto");
  const btnChoixRecu = document.getElementById("btn-choix-recu");
  const btnChoixFichier = document.getElementById("btn-choix-fichier");
  const btnAnnulerChoixRecu = document.getElementById("btn-annuler-choix-recu");
  const btnRevenirChoix = document.getElementById("btn-revenir-choix");
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
    zoneChoix?.classList.add("hidden");
    recuZoneAuto?.classList.add("hidden");
    uploadZoneDefault?.classList.add("hidden");
    uploadZoneSelected?.classList.add("hidden");
    uploadZoneUploading?.classList.add("hidden");
    uploadZoneSuccess?.classList.add("hidden");
    uploadZoneError?.classList.add("hidden");
  }

  /**
   * État initial du bloc justificatif : les deux voies proposées à
   * égalité. Le fichier éventuellement sélectionné est oublié, sinon il
   * ferait office de justificatif alors que le choix est remis à zéro.
   */
  function showChoixJustificatif() {
    hideAllUploadZones();
    if (fileInput) fileInput.value = "";
    zoneChoix?.classList.remove("hidden");
  }

  /**
   * Choix retenu : OGOUE éditera le reçu. Aucun fichier ne doit rester
   * sélectionné, sinon c'est lui qui servirait de justificatif et le
   * reçu ne serait pas émis.
   */
  function showRecuAuto() {
    hideAllUploadZones();
    if (fileInput) fileInput.value = "";
    recuZoneAuto?.classList.remove("hidden");
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

  // Voie 1 : OGOUE édite le reçu de la vente.
  btnChoixRecu?.addEventListener("click", () => {
    showRecuAuto();
  });

  // Voie 2 : le gérant joint son propre document (facture d'un tiers,
  // reçu manuscrit scanné...).
  btnChoixFichier?.addEventListener("click", () => {
    showUploadZoneDefault();
  });

  // Revenir sur son choix, depuis l'une ou l'autre des deux voies.
  btnAnnulerChoixRecu?.addEventListener("click", () => {
    showChoixJustificatif();
  });

  btnRevenirChoix?.addEventListener("click", () => {
    showChoixJustificatif();
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
  
  // Le catalogue vient désormais du serveur et non plus du localStorage :
  // il est partagé par toute l'organisation (gérant + agents), il survit
  // au changement d'appareil, et il porte un prix unitaire.
  // `articlesCache` conserve les objets {id, name, type, unitPrice}.
  let articlesCache = [];

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

  /** Recharge le catalogue depuis l'API et met à jour le cache local. */
  async function loadArticles() {
    if (!window.OGOUE || typeof window.OGOUE.getArticles !== "function") {
      console.warn("Catalogue indisponible : OGOUE.getArticles manquant");
      articlesCache = [];
      return articlesCache;
    }
    articlesCache = await window.OGOUE.getArticles();
    return articlesCache;
  }

  function findArticleByName(name) {
    const key = normalizeLabel(name).toLowerCase();
    return articlesCache.find((a) => String(a.name).toLowerCase() === key) || null;
  }

  function buildArticleOptions() {
    if (!articleSelect) return;

    articleSelect.innerHTML = "";

    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Sélectionner un article / service";
    articleSelect.appendChild(opt0);

    articlesCache.forEach((article) => {
      const opt = document.createElement("option");
      opt.value = article.name;
      // Seul le nom est affiché ; le prix reste porté par l'option et
      // sert à remplir automatiquement le champ Prix Total.
      // Article suivi en stock : la quantité disponible s'affiche, et une rupture
      // rend le choix impossible.
      const suivi = article.stock !== null && article.stock !== undefined;
      const rupture = suivi && Number(article.stock) <= 0;
      opt.textContent = rupture
        ? `${article.name} (rupture de stock)`
        : suivi
          ? `${article.name} (stock : ${Number(article.stock)})`
          : article.name;
      opt.disabled = rupture;
      opt.dataset.unitPrice = String(article.unitPrice || 0);
      opt.dataset.type = article.type || "";
      articleSelect.appendChild(opt);
    });

    // "Autres" permet une vente ponctuelle hors catalogue
    const optOther = document.createElement("option");
    optOther.value = "__OTHER__";
    optOther.textContent = "Autres (article hors catalogue)";
    articleSelect.appendChild(optOther);
  }

  function formatPrice(value) {
    const n = Number(value) || 0;
    return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA";
  }

  // Appelé après chaque mise en place des champs d'article (saisie par cartes)
  let apresChangementListe = null;

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
    if (apresChangementListe) apresChangementListe();
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
    if (apresChangementListe) apresChangementListe();
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

  // ── Remplissage automatique du prix ─────────────────────────
  // Le prix unitaire du catalogue sert de base : total = prix x quantité.
  // Il reste modifiable à la main (remise, prix négocié) ; dès que
  // l'utilisateur touche au montant, on cesse de le recalculer.
  let montantModifieManuellement = false;
  let prixUnitaireCourant = null;

  function recalculerMontant() {
    const qteInput = document.getElementById("vente-quantite");
    const montantInput = document.getElementById("vente-montant");
    if (!montantInput || prixUnitaireCourant === null) return;
    if (montantModifieManuellement) return;

    const qte = parseFloat(qteInput?.value || "0") || 0;
    // Sans quantité saisie, on affiche le prix d'une unité
    const total = prixUnitaireCourant * (qte > 0 ? qte : 1);
    montantInput.value = String(total);
  }

  function appliquerArticleSelectionne() {
    if (!articleSelect) return;
    const opt = articleSelect.selectedOptions && articleSelect.selectedOptions[0];
    const typeInput = document.getElementById("vente-type");

    if (!opt || !opt.dataset || opt.dataset.unitPrice === undefined) {
      prixUnitaireCourant = null;
      return;
    }

    prixUnitaireCourant = Number(opt.dataset.unitPrice) || 0;
    // Nouvelle sélection : on repart d'un montant calculé
    montantModifieManuellement = false;
    recalculerMontant();

    // Le type de vente du catalogue pré-remplit le champ correspondant
    if (typeInput && opt.dataset.type) {
      typeInput.value = opt.dataset.type;
    }
  }

  async function initArticlesUI() {
    await loadArticles();

    if (articlesCache.length === 0) setModeListEmpty();
    else setModeListNotEmpty();

    if (articleSelect) {
      articleSelect.addEventListener("change", () => {
        const isOther = articleSelect.value === "__OTHER__";
        toggleOther(isOther);
        if (isOther) {
          // Hors catalogue : aucun prix connu, saisie libre
          prixUnitaireCourant = null;
          montantModifieManuellement = false;
        } else {
          appliquerArticleSelectionne();
        }
      });
    }

    const qteInput = document.getElementById("vente-quantite");
    if (qteInput) qteInput.addEventListener("input", recalculerMontant);

    const montantInput = document.getElementById("vente-montant");
    if (montantInput) {
      montantInput.addEventListener("input", () => {
        montantModifieManuellement = true;
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
    // Catalogue vide : saisie libre
    if (articlesCache.length === 0) {
      return normalizeLabel(firstInput ? firstInput.value : "");
    }

    const selected = articleSelect ? articleSelect.value : "";
    if (selected === "__OTHER__") {
      return normalizeLabel(autreInput ? autreInput.value : "");
    }

    return normalizeLabel(selected);
  }

  /**
   * Propose d'ajouter au catalogue un article saisi hors liste.
   * Le prix unitaire enregistré est déduit du montant et de la quantité,
   * pour que la prochaine vente soit pré-remplie.
   */
  async function persistArticleIfNeeded(articleLabel) {
    const label = normalizeLabel(articleLabel);
    if (!label) return;
    if (findArticleByName(label)) return;

    if (!window.OGOUE || typeof window.OGOUE.addArticle !== "function") return;

    const typeInput = document.getElementById("vente-type");
    const qteInput = document.getElementById("vente-quantite");
    const montantInput = document.getElementById("vente-montant");

    const qte = parseFloat(qteInput?.value || "0") || 0;
    const montant = parseFloat(montantInput?.value || "0") || 0;
    const prixUnitaire = qte > 0 ? Math.round((montant / qte) * 100) / 100 : montant;

    const message =
      `Ajouter "${label}" à votre catalogue ?\n\n` +
      `Prix unitaire enregistré : ${formatPrice(prixUnitaire)}\n\n` +
      `Il sera proposé automatiquement lors des prochaines ventes, ` +
      `pour vous et vos agents.`;

    if (!window.confirm(message)) return;

    const type = typeInput?.value === "services" ? "services" : "produits";
    const result = await window.OGOUE.addArticle({ name: label, type, unitPrice: prixUnitaire });

    if (!result.ok && result.status !== 409) {
      console.error("Ajout au catalogue impossible:", result.error);
      return;
    }

    // Le catalogue a changé : on rafraîchit la liste déroulante
    await loadArticles();
    if (articlesCache.length > 0) setModeListNotEmpty();
  }

  function getFormData() {
    const dateInput = document.getElementById("vente-date");
    const moyenInput = document.getElementById("vente-moyen-paiement");
    const typeInput = document.getElementById("vente-type");
    const qteInput = document.getElementById("vente-quantite");
    const montantInput = document.getElementById("vente-montant");
    const noteInput = document.getElementById("vente-note");
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

    // Le reçu n'est émis que si le gérant l'a explicitement demandé.
    // Sans choix, la vente part sans justificatif : la colonne restera
    // vide, avec le lien « Établir un reçu » pour se rattraper.
    // Ce même drapeau commande la lecture des champs client, qui restent
    // dans le DOM quand le gérant change d'avis.
    const editeRecu = !!recuZoneAuto && !recuZoneAuto.classList.contains("hidden");
    const lireClient = (id) =>
      editeRecu ? (document.getElementById(id)?.value || "").trim() : "";
    // Vente à crédit : le client vient du bloc « Qui doit payer ? »
    const credit = moyenPaiement === "credit";
    const lireCredit = (id) => (document.getElementById(id)?.value || "").trim();

    return {
      id: generateId(),
      date,
      description,
      // Article du catalogue (vide si hors catalogue) : sert à décompter le stock
      article_id: (findArticleByName(description) || {}).id || "",
      moyen_paiement: moyenPaiement,
      type_vente: typeVente,
      quantite: isNaN(quantite) ? 0 : quantite,
      montant: isNaN(montant) ? 0 : montant,
      justificatif: justificatifFile,
      editer_recu: editeRecu,
      client_nom: credit ? lireCredit("vente-credit-client") : lireClient("recu-client-nom"),
      client_telephone: credit ? lireCredit("vente-credit-telephone") : lireClient("recu-client-telephone"),
      // Vente à crédit : date promise du solde, et avance versée tout de suite
      credit_echeance: credit ? lireCredit("vente-credit-echeance") : "",
      credit_avance: credit ? (Number(lireCredit("vente-credit-avance")) || 0) : 0,
      credit_avance_moyen: credit ? lireCredit("vente-credit-avance-moyen") : "",
      client_email: lireClient("recu-client-email"),
      // Facultatif : absent du contrôle de présence plus haut, une vente
      // sans commentaire doit pouvoir s'enregistrer.
      note: (noteInput?.value || "").trim(),
      file // Ajouter l'objet File pour l'upload
    };
  }

  /**
   * Neutralise le texte saisi par l'utilisateur avant insertion dans du
   * HTML. Les lignes du tableau sont construites par innerHTML : sans
   * cela, un commentaire contenant « < » casserait la mise en page, et
   * un `<img onerror=…>` s'exécuterait dans le navigateur du gérant.
   * Convient aussi bien au contenu d'une cellule qu'à un attribut.
   */
  function echapperHtml(valeur) {
    return String(valeur ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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

  async function deleteVente(venteId, vente) {
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
          message: messageSuppression(venteId, vente),
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

        // Vente à crédit : ce que doit le client et ses paiements ont changé
        if (vente?.moyen_paiement === "credit") {
          try { sessionStorage.removeItem("ogo_credits_retard"); } catch (err) {}
          creditsClients.rafraichir();
        }
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

  // Texte de la fenêtre de suppression ; pour une vente à crédit déjà
  // (en partie) payée, on prévient que ces paiements partent avec elle
  function messageSuppression(venteId, vente) {
    const base = "Vous êtes sur le point de supprimer cet enregistrement. Veuillez expliquer le motif de cette suppression.";
    if (vente?.moyen_paiement !== "credit") return base;
    const info = creditsClients.infoVente(venteId);
    const paye = info ? (Number(vente.montant) || 0) - info.reste : 0;
    if (!(paye > 0)) return base;
    return `${base}<span class="block mt-3 rounded-lg bg-orange-50 dark:bg-orange-900/30 px-3 py-2 text-orange-800 dark:text-orange-200 font-semibold">${echapperHtml(info.client)} a déjà payé ${formatMontant(paye)} sur cette vente. Ce qui ne couvre pas ses autres crédits sera retiré de l'argent entré.</span>`;
  }

  // Vente à crédit : encore due (reste, bouton « Payer ») ou déjà réglée (moyen et date).
  // Le détail vient des crédits clients (page Crédits), chargés à part.
  function celluleCreditVente(vente) {
    const info = creditsClients.infoVente(vente.id);
    const MOYENS = { cash: "Cash", mobile_money: "Mobile Money" };
    if (info && info.reste <= 0) {
      return `${MOYENS[info.soldeMoyen] || "Réglé"}<span class="block text-[11px] text-gray-500 dark:text-gray-400">crédit réglé le ${formatDateFr(info.soldeLe)}</span>`;
    }
    const pastille = '<span class="inline-flex items-center rounded-full bg-orange-100 dark:bg-orange-900/40 px-2 py-0.5 text-xs font-bold text-orange-700 dark:text-orange-300">Crédit</span>';
    if (!info) return pastille; // crédits pas encore chargés : le bouton viendra ensuite
    const partiel = info.reste < (Number(vente.montant) || 0);
    return pastille +
      (partiel ? `<span class="block text-[11px] text-gray-500 dark:text-gray-400">reste ${formatMontant(info.reste)}</span>` : "") +
      `<span class="payer-vente mt-1 flex flex-wrap items-center gap-1" data-id="${echapperHtml(vente.id)}">
         <button type="button" class="payer-ouvrir h-7 px-3 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary/90">Payer</button></span>`;
  }

  // « Payer » : un paiement du client pour ce qui reste dû sur cette vente
  function brancherPayerVente(tr) {
    const zone = tr.querySelector(".payer-vente");
    if (!zone) return;
    zone.addEventListener("click", async (e) => {
      if (e.target.closest(".payer-ouvrir")) {
        zone.innerHTML =
          '<span class="text-[11px] text-gray-500">Payé en :</span>' +
          '<button type="button" data-moyen="cash" class="h-7 px-2.5 rounded-full bg-[#0d1b19] text-white text-xs font-bold">Cash</button>' +
          '<button type="button" data-moyen="mobile_money" class="h-7 px-2.5 rounded-full bg-[#0d1b19] text-white text-xs font-bold">Mobile Money</button>' +
          '<button type="button" data-renoncer class="h-7 px-1 text-xs text-gray-500 hover:underline">Annuler</button>';
        return;
      }
      if (e.target.closest("[data-renoncer]")) {
        zone.innerHTML = '<button type="button" class="payer-ouvrir h-7 px-3 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary/90">Payer</button>';
        return;
      }
      const moyen = e.target.closest("[data-moyen]")?.dataset.moyen;
      if (!moyen) return;
      const info = creditsClients.infoVente(zone.dataset.id);
      if (!info || !(info.reste > 0)) return;
      zone.querySelectorAll("button").forEach((b) => { b.disabled = true; });
      const r = await window.OGOUE.enregistrerReglement({ venteId: zone.dataset.id, montant: info.reste, moyen, nature: "paiement" });
      if (!r.ok) { alert(r.error); zone.querySelectorAll("button").forEach((b) => { b.disabled = false; }); return; }
      window.OGOUE_FEEDBACK?.succes(`Crédit réglé · ${echapperHtml(info.client)} · ${formatMontant(info.reste)}`);
      try { sessionStorage.removeItem("ogo_credits_retard"); } catch (err) {}
      await creditsClients.rafraichir(); // le tableau se redessine avec la vente réglée
    });
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
        ${affichageHeure(vente)}
      </td>
      <td class="px-6 py-4">
        ${echapperHtml(vente.description || "-")}
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
            : vente.moyen_paiement === "credit"
            ? celluleCreditVente(vente)
            : echapperHtml(vente.moyen_paiement || "-")
        }
      </td>
      <td class="px-6 py-4">
        ${
          vente.type_vente === "produits"
            ? "Produits"
            : vente.type_vente === "services"
            ? "Service"
            : echapperHtml(vente.type_vente || "-")
        }
      </td>
      <td class="px-6 py-4">
        ${echapperHtml(vente.created_by_name || "-")}
      </td>
      <td class="px-6 py-4">
        ${
          // La colonne restitue le choix fait au moment de la saisie :
          // le fichier joint, ou à défaut le reçu édité par OGOUE.
          vente.justificatif
            ? `<span class="justificatif-link inline-flex items-center gap-1 font-medium text-primary cursor-pointer hover:underline break-all" title="Ouvrir le justificatif joint" data-file="${echapperHtml(vente.justificatif)}" data-justif-id="${echapperHtml(vente.id)}">
                 <span class="material-symbols-outlined text-[15px] flex-shrink-0">attach_file</span>${echapperHtml(vente.justificatif)}
               </span>`
            : vente.numeroRecu
            ? `<span class="recu-lien inline-flex items-center gap-1 font-medium text-primary cursor-pointer hover:underline whitespace-nowrap" title="Ouvrir le reçu ${echapperHtml(vente.numeroRecu)}" data-id="${echapperHtml(vente.id)}">
                 <span class="material-symbols-outlined text-[15px]">description</span>${echapperHtml(vente.numeroRecu)}
               </span>`
            // Vente d'un autre (agent qui consulte) : rien à compléter ici
            : vente.peut_agir === false
            ? "-"
            // Vente sans justificatif : les deux mêmes voies que dans le
            // formulaire restent ouvertes, sans quoi la case resterait
            // vide définitivement.
            : `<div class="flex items-center gap-2 whitespace-nowrap">
                 <button type="button" class="recu-etablir text-xs text-gray-500 dark:text-gray-400 hover:text-primary hover:underline" title="Établir le reçu de cette vente" data-id="${vente.id}">
                   Établir un reçu
                 </button>
                 <span class="text-xs text-gray-300 dark:text-gray-600">·</span>
                 <button type="button" class="joindre-lien text-xs text-gray-500 dark:text-gray-400 hover:text-primary hover:underline" title="Joindre un justificatif à cette vente" data-id="${vente.id}">
                   Joindre un fichier
                 </button>
               </div>`
        }
      </td>
      <td class="px-6 py-4">
        ${
          // Tronqué à l'affichage : le tableau compte déjà dix colonnes,
          // un commentaire long les écraserait toutes. Un clic l'ouvre en
          // entier (commentaire-complet.js), le survol ne suffisant pas
          // sur téléphone.
          vente.note
            ? `<button type="button" class="commentaire-complet block max-w-[16rem] truncate text-left underline decoration-dotted underline-offset-2 hover:text-primary" title="Lire le commentaire" data-commentaire="${echapperHtml(vente.note)}">${echapperHtml(vente.note)}</button>`
            : "-"
        }
      </td>
      <td class="px-6 py-4 text-center">
        ${vente.peut_agir === false ? `<span class="material-symbols-outlined text-lg text-gray-400" title="Enregistrée par ${echapperHtml(vente.created_by_name || "un autre utilisateur")} : seul son auteur ou le gérant peut la modifier ou la supprimer">lock</span>` : `
        ${window.OGOUE_MODIFIER?.estModifiable(vente.created_at) ? `<button class="edit-btn text-gray-600 hover:text-primary dark:text-gray-300 dark:hover:text-primary text-lg mr-3" title="Modifier" data-id="${vente.id}">✏️</button>` : ""}
        <button class="delete-btn text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xl" title="Supprimer" data-id="${vente.id}">
          🗑️
        </button>`}
      </td>
    `;

    // Ajouter l'event listener pour ouvrir le modal si justificatif
    if (vente.justificatif) {
      const link = tr.querySelector('.justificatif-link');
      if (link) {
        // Le bucket est privé : il n'y a plus d'URL à porter dans le
        // tableau. Le lien se demande au clic et vaut cinq minutes —
        // signer les justificatifs de toutes les lignes au chargement
        // ferait autant d'appels que de ventes, pour un seul ouvert.
        link.addEventListener('click', async () => {
          const fileName = link.getAttribute('data-file');
          const venteId = link.getAttribute('data-justif-id');
          const libelle = link.innerHTML;
          link.innerHTML = '<span class="material-symbols-outlined text-[15px]">hourglass_top</span> …';
          try {
            const reponse = await fetch(`${API_BASE_URL}/api/sales/${venteId}/justificatif`, {
              headers: { Authorization: `Bearer ${getToken()}` }
            });
            const data = await reponse.json();
            if (!reponse.ok) throw new Error(data.error || "Justificatif indisponible");
            openJustificatifModal(fileName, data.url);
          } catch (erreur) {
            console.error('Erreur justificatif:', erreur);
            alert("Le justificatif n'a pas pu être ouvert : " + erreur.message);
          } finally {
            link.innerHTML = libelle;
          }
        });
      }
    }

    // Ajouter l'event listener pour supprimer
    const deleteBtn = tr.querySelector('.delete-btn');
    tr.querySelector('.edit-btn')?.addEventListener('click', () => ouvrirModificationVente(vente));
    brancherPayerVente(tr);
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        const venteId = deleteBtn.getAttribute('data-id');
        deleteVente(venteId, vente);
      });
    }

    // Reçu déjà établi : un clic le rouvre.
    const recuLien = tr.querySelector('.recu-lien');
    if (recuLien) {
      recuLien.addEventListener('click', () => ouvrirRecu(recuLien));
    }

    // Vente sans justificatif : on demande d'abord le client, puis on
    // établit le reçu.
    const recuEtablir = tr.querySelector('.recu-etablir');
    if (recuEtablir) {
      recuEtablir.addEventListener('click', () => demanderClientPuisEtablirRecu(recuEtablir));
    }

    // L'autre voie de rattrapage : téléverser un document existant.
    const joindreLien = tr.querySelector('.joindre-lien');
    if (joindreLien) {
      joindreLien.addEventListener('click', () => joindreJustificatif(joindreLien));
    }

    return tr;
  }

  /**
   * Ouvre le reçu d'une vente.
   * Le document vit dans un espace privé : on demande un lien signé,
   * valable quelques minutes, au moment du clic.
   */
  async function ouvrirRecu(element) {
    const venteId = element.getAttribute('data-id');
    const libelle = element.innerHTML;

    element.disabled = true;
    element.innerHTML = '<span class="material-symbols-outlined text-[15px]">hourglass_top</span> …';

    try {
      const token = getToken();
      const reponse = await fetch(`${API_BASE_URL}/api/sales/${venteId}/recu`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await reponse.json();

      if (!reponse.ok) throw new Error(data.error || "Reçu indisponible");

      window.open(data.url, '_blank', 'noopener');
    } catch (erreur) {
      console.error('Erreur reçu:', erreur);
      alert("Le reçu n'a pas pu être ouvert : " + erreur.message);
    } finally {
      element.disabled = false;
      element.innerHTML = libelle;
    }
  }

  /**
   * Établit le reçu d'une vente qui n'en a pas encore.
   * La saisie du client est partagée avec le module de scoring, d'où
   * son extraction dans js/recu-client.js.
   */
  function demanderClientPuisEtablirRecu(bouton) {
    if (!window.OGOUE_RECU) {
      console.error("recu-client.js n'est pas chargé");
      return;
    }

    window.OGOUE_RECU.demanderClientPuisEtablirRecu({
      venteId: bouton.getAttribute('data-id'),
      apresEtablissement: async () => {
        // La case doit maintenant afficher le numéro attribué
        ventesCacheMois = null;
        ventesCacheAnnee = null;
        await renderCompactTable();
        if (typeof renderFullTable === "function") renderFullTable();
      }
    });
  }

  /**
   * Joint un justificatif à une vente déjà enregistrée : ouvre le
   * sélecteur de fichier, puis envoie sur la route de mise à jour.
   */
  function joindreJustificatif(bouton) {
    const venteId = bouton.getAttribute('data-id');

    const champ = document.createElement('input');
    champ.type = 'file';
    champ.accept = '.pdf,.jpg,.jpeg,.png';
    champ.style.display = 'none';
    document.body.appendChild(champ);

    champ.addEventListener('change', async () => {
      const fichier = champ.files[0];
      document.body.removeChild(champ);
      if (!fichier) return;

      const erreurFichier = validateFile(fichier);
      if (erreurFichier) {
        alert(erreurFichier);
        return;
      }

      const libelle = bouton.innerHTML;
      bouton.disabled = true;
      bouton.innerHTML = '…';

      try {
        const token = getToken();
        const formData = new FormData();
        formData.append('receipt', fichier);
        formData.append('receiptName', fichier.name);

        const reponse = await fetch(`${API_BASE_URL}/api/sales/${venteId}`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        const data = await reponse.json();

        if (!reponse.ok) throw new Error(data.error || "Envoi impossible");

        // Recharger pour faire apparaître le nom du fichier joint
        ventesCacheMois = null;
        ventesCacheAnnee = null;
        await renderCompactTable();
        if (typeof renderFullTable === "function") renderFullTable();
      } catch (erreur) {
        console.error('Erreur justificatif:', erreur);
        alert("Le justificatif n'a pas pu être joint : " + erreur.message);
        bouton.disabled = false;
        bouton.innerHTML = libelle;
      }
    });

    champ.click();
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
      
      // Le backend ne renvoie plus d'URL : le bucket est privé, le
      // lien se signe au clic. Seul l'id de la ligne est nécessaire.
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
        <td colspan="11" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
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
          <td colspan="11" class="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
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
          v.justificatif || v.numeroRecu || ""
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

  // Modification d'une vente (24 h après l'enregistrement, contrôlée par le serveur)
  function ouvrirModificationVente(vente) {
    // Vente sans article lié : si le libellé correspond à un article du catalogue, on le pré-sélectionne,
    // sans rien envoyer tant que le choix n'est pas modifié (sinon le stock serait décompté à tort).
    const articleLie = vente.article_id || null;
    const correspondance = articleLie ? null : (articlesCache || []).find(
      (x) => String(x.name).trim().toLowerCase() === String(vente.description || "").trim().toLowerCase()
    );
    const valeurInitiale = articleLie || (correspondance ? correspondance.id : "__autre__");
    window.OGOUE_MODIFIER.ouvrir({
      titre: "Modifier la vente",
      url: `${API_BASE_URL}/api/sales/${vente.id}`,
      token: getToken(),
      champs: [
        { name: "saleDate", label: "Date de la transaction", type: "date", value: vente.date, disabled: !!vente.numeroRecu,
          aide: vente.numeroRecu ? "Un reçu numéroté a été émis : la date ne peut plus changer." : "" },
        { name: "articleId", label: "Nom de l'article / service", type: "select",
          value: valeurInitiale, disabled: !!vente.numeroRecu,
          options: [].concat(articleLie && !(articlesCache || []).some((x) => x.id === articleLie) ? [{ value: articleLie, label: "Article actuel (hors catalogue)" }] : [], (articlesCache || []).map((x) => ({ value: x.id, label: x.name })), [{ value: "__autre__", label: "Autres (saisir un libellé)" }]),
          aide: vente.numeroRecu ? "Un reçu numéroté a été émis : l'article ne peut plus changer." : "Le stock de l'article est recalculé automatiquement." },
        { name: "description", label: "Libellé", type: "text", value: vente.description || "", disabled: !!vente.numeroRecu,
          visibleSi: { champ: "articleId", valeur: "__autre__" } },
        { name: "quantity", label: "Quantité", type: "number", value: vente.quantite, disabled: !!vente.numeroRecu,
          aide: vente.numeroRecu ? "Un reçu numéroté a été émis : la quantité ne peut plus changer." : "" },
        { name: "paymentMethod", label: "Moyen de paiement", type: "select", value: vente.moyen_paiement || "",
          options: [{ value: "cash", label: "Cash" }, { value: "mobile_money", label: "Mobile Money" }, { value: "credit", label: "Crédit (payé plus tard)" }] },
        { name: "amount", label: "Montant (FCFA)", type: "number", value: vente.montant, disabled: !!vente.numeroRecu,
          aide: vente.numeroRecu ? "Un reçu numéroté a été émis : le montant ne peut plus changer." : "" },
        { name: "note", label: "Commentaire (facultatif)", type: "textarea", value: vente.note || "", pleine: true },
      ],
      transformer: (corps) => {
        // Choix inchangé : on n'envoie pas l'article (le stock ne bouge pas)
        if (corps.articleId === valeurInitiale) {
          delete corps.articleId;
          if (valeurInitiale !== "__autre__") delete corps.description;
        } else if (corps.articleId === "__autre__") corps.articleId = null;
        else delete corps.description;
        return corps;
      },
      onSaved: async () => {
        ventesCacheMois = null;
        ventesCacheAnnee = null;
        await renderCompactTable();
        if (modal && !modal.classList.contains("hidden")) renderFullTable();
      },
    });
  }

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

    // ✅ Stock épuisé : on n'envoie pas la vente, on le dit clairement
    const articleCatalogue = findArticleByName(data.description);
    if (articleCatalogue && articleCatalogue.stock !== null && articleCatalogue.stock !== undefined) {
      const dispo = Number(articleCatalogue.stock);
      if (dispo <= 0) {
        alert(`Vente impossible : "${articleCatalogue.name}" n'est plus en stock (stock à 0).\n\nRéapprovisionnez-le depuis votre catalogue pour pouvoir le vendre.`);
        return;
      }
      if (dispo < Number(data.quantite || 0)) {
        alert(`Vente impossible : il ne reste que ${dispo} unité(s) de "${articleCatalogue.name}" en stock.\n\nDiminuez la quantité ou réapprovisionnez votre stock.`);
        return;
      }
    }

    // ✅ Propose d'ajouter l'article au catalogue s'il n'y est pas encore
    await persistArticleIfNeeded(data.description);

    // ✅ Afficher la zone d'upload appropriée si fichier présent
    if (data.file) {
      showUploadZoneUploading();
    }

    // ✅ Appeler l'API (asynchrone) avec suivi de progression
    const onProgress = (percent) => {
      updateProgressBar(percent);
    };

    const bouton = form.querySelector('button[type="submit"]');
    window.OGOUE_FEEDBACK?.debut(bouton, "Enregistrement de la vente…");

    const result = await addVente(data, onProgress);

    if (!result) {
      window.OGOUE_FEEDBACK?.fin(bouton);
      // Afficher la zone d'erreur, avec la raison renvoyée par le serveur si elle existe
      window.OGOUE_DERNIERE_ERREUR_VENTE = window.OGOUE_DERNIERE_ERREUR_VENTE || null;
      showUploadZoneError(window.OGOUE_DERNIERE_ERREUR_VENTE || "Erreur lors de l'enregistrement de la vente");
      window.OGOUE_DERNIERE_ERREUR_VENTE = null;
      return;
    }

    window.OGOUE_FEEDBACK?.fin(bouton);
    window.OGOUE_FEEDBACK?.succes("Vente enregistrée avec succès");
    if (data.moyen_paiement === "credit") await creditsClients.apresVente(data);

    // ✅ Afficher la zone de succès si fichier
    if (data.file) {
      showUploadZoneSuccess(data.file);
    }

    form.reset();
    setTodayAsDefaultDate();
    showChoixJustificatif(); // Le choix est à refaire pour la vente suivante
    
    // Rafraîchir le cache et le tableau
    ventesCacheMois = null;
    ventesCacheAnnee = null;
    await renderCompactTable();

    // ✅ Refresh UI articles après ajout
    await loadArticles();
    if (articlesCache.length === 0) {
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

  // =========================
  // 🤝 CLIENTS À CRÉDIT
  // =========================
  // Qui doit déjà combien : sert aux raccourcis du bloc « Le client paiera
  // plus tard » et à l'avance versée à la vente. La page « Crédits »
  // (module_credits.html) montre le détail et encaisse les paiements.
  const creditsClients = (function () {
    let resume = { clients: [] };
    const abonnes = [];
    async function rafraichir() {
      if (!window.OGOUE?.getCredits) return;
      const r = await window.OGOUE.getCredits();
      if (!r.ok) return;
      resume = window.OGOUE.resumerCredits(r.ventes, r.reglements);
      abonnes.forEach((f) => f(resume));
    }
    // Avance reçue au moment d'une vente à crédit : un règlement pour ce client
    async function apresVente(data) {
      const avance = Number(data.credit_avance) || 0;
      if (avance > 0 && window.OGOUE?.enregistrerReglement) {
        const r = await window.OGOUE.enregistrerReglement({
          clientNom: data.client_nom,
          clientTelephone: data.client_telephone || null,
          montant: avance,
          moyen: data.credit_avance_moyen === "mobile_money" ? "mobile_money" : "cash",
          nature: "avance",
        });
        if (!r.ok) alert(`La vente est enregistrée, mais l'avance n'a pas pu l'être : ${r.error}\n\nAjoutez-la depuis la page Crédits.`);
      }
      await rafraichir();
      try { sessionStorage.removeItem("ogo_credits_retard"); } catch (e) {}
    }
    return {
      rafraichir,
      apresVente,
      resume: () => resume,
      surChangement: (f) => abonnes.push(f),
      infoVente: (id) => (resume.parVente ? resume.parVente[id] || null : null),
      duPar: (nom) => {
        const k = window.OGOUE?.cleClient ? window.OGOUE.cleClient(nom) : String(nom).toLowerCase();
        return resume.clients.find((c) => c.cle === k) || null;
      },
    };
  })();

  // Crédits chargés ou modifiés : les ventes à crédit du tableau changent d'état
  creditsClients.surChangement(() => {
    renderCompactTable();
    if (modal && !modal.classList.contains("hidden")) renderFullTable();
  });

  // =========================
  // 🧾 SAISIE NORMALE PAR CARTES
  // =========================
  // Même grille d'articles que le mode rush, mais rien ne part tout seul.
  // Un appui ajoute l'article au panier, chaque appui de plus sur la même
  // carte ajoute une unité ; plusieurs articles peuvent être choisis. Le
  // prix se calcule depuis le catalogue. La personne remplit la date, le
  // commentaire et le justificatif, puis appuie sur « Enregistrer la vente ».
  // Un panier de plusieurs articles devient une vente par article (même
  // date, même paiement, même client).
  // Les champs d'origine restent dans la page, cachés : ils portent les
  // valeurs envoyées (getFormData) et reviennent quand le catalogue est vide.
  (function saisieParCartes() {
    const dateInput = document.getElementById("vente-date");
    const moyenInput = document.getElementById("vente-moyen-paiement");
    const typeInput = document.getElementById("vente-type");
    const qteInput = document.getElementById("vente-quantite");
    const montantInput = document.getElementById("vente-montant");
    if (!dateInput || !moyenInput || !typeInput || !qteInput || !montantInput || !selectWrapper) return;

    const ligneDate = dateInput.closest(".grid");
    const blocArticle = selectWrapper.parentElement;
    const ligneMoyen = moyenInput.closest(".grid");
    const ligneQuantite = qteInput.closest(".grid");
    const blocJustificatif = document.getElementById("justificatif-choix")?.parentElement || null;
    const CLE_PAIEMENT = "ogo_rush_paiement"; // même préférence que le mode rush
    const lire = (cle, defaut) => { try { return localStorage.getItem(cle) || defaut; } catch (e) { return defaut; } };
    const ecrire = (cle, val) => { try { localStorage.setItem(cle, val); } catch (e) {} };
    const fcfa = (n) => (Number(n) || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 });

    let actif = false;      // grille affichée (sinon : saisie à la main)
    let manuel = false;     // saisie à la main (catalogue vide)
    let chargement = true;  // catalogue pas encore reçu du serveur : on montre déjà la grille
    let ordre = [];
    let panier = [];        // [{ article, quantite }]
    // Crédit : choisi vente par vente, jamais retenu ; sinon le dernier moyen utilisé
    const paiementHabituel = () => { const m = lire(CLE_PAIEMENT, "cash"); return m === "mobile_money" ? m : "cash"; };
    let paiement = paiementHabituel();

    // ── Paiement, à côté de la date ──
    const blocPaiement = document.createElement("div");
    blocPaiement.className = "hidden flex-col";
    blocPaiement.innerHTML =
      `<p class="text-base font-medium leading-normal pb-2 text-[#0d1b19] dark:text-gray-200">Moyen de paiement<span class="text-red-500">*</span></p>` +
      `<div class="inline-flex self-start rounded-full bg-gray-100 dark:bg-gray-800 p-1" data-cartes-paiement>` +
      `<button type="button" data-paiement="cash" class="px-3 sm:px-5 h-12 rounded-full text-sm font-bold whitespace-nowrap">Cash</button>` +
      `<button type="button" data-paiement="mobile_money" class="px-3 sm:px-5 h-12 rounded-full text-sm font-bold whitespace-nowrap">Mobile Money</button>` +
      `<button type="button" data-paiement="credit" class="px-3 sm:px-5 h-12 rounded-full text-sm font-bold whitespace-nowrap" title="Le client paiera plus tard">Crédit</button></div>`;
    ligneDate.appendChild(blocPaiement);

    // ── Grille d'articles, panier et total ──
    const blocCartes = document.createElement("div");
    blocCartes.className = "hidden";
    blocCartes.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3 mb-3">
        <p class="text-base font-medium leading-normal text-[#0d1b19] dark:text-gray-200">Article / service<span class="text-red-500">*</span></p>
        <input type="search" data-cartes-recherche placeholder="Rechercher un article"
               class="form-input w-full sm:w-64 h-10 rounded-full border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark text-sm px-4 text-[#0d1b19] dark:text-white">
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">Un appui choisit l'article. Appuis répétés sur la même carte = plusieurs unités (2 appuis = quantité 2).</p>
      <div data-cartes-grille class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"></div>
      <p data-cartes-erreur class="hidden mt-3 text-sm font-medium text-red-600"></p>
      <button type="button" data-cartes-ajouter class="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        <span class="material-symbols-outlined text-base">add_circle</span>Article ou service absent ? Ajoutez-le au catalogue
      </button>
      <div data-cartes-panier class="hidden mt-4 rounded-2xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700"></div>
      <div data-cartes-total class="hidden mt-3 flex-wrap items-center justify-between gap-x-6 gap-y-1 rounded-2xl bg-gray-100 dark:bg-gray-800 px-5 py-3 text-[15px] text-[#0d1b19] dark:text-gray-100"></div>`;
    ligneDate.insertAdjacentElement("afterend", blocCartes);

    // ── Vente à crédit : trois questions (qui, avance, quand) ──
    const champ = "form-input w-full h-12 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-background-dark px-5 text-base text-[#0d1b19] dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-primary/40";
    const pastille = "h-10 px-4 rounded-full border text-sm font-semibold transition";
    const blocCredit = document.createElement("div");
    blocCredit.className = "hidden rounded-[22px] border border-sky-200 dark:border-sky-900/60 bg-sky-50/70 dark:bg-sky-950/20 p-5 space-y-4";
    blocCredit.innerHTML = `
      <p class="flex items-center gap-2"><span class="size-2 rounded-full bg-primary"></span>
        <strong class="text-[15px] text-[#0d1b19] dark:text-white">Le client paiera plus tard</strong>
        <span class="text-sm text-gray-500 dark:text-gray-400">· 3 questions, c'est tout</span></p>
      <div>
        <label for="vente-credit-client" class="block text-sm font-semibold text-[#0d1b19] dark:text-gray-200 mb-2">Qui vous doit cet argent ?<span class="text-red-500">*</span></label>
        <input id="vente-credit-client" type="text" maxlength="150" autocomplete="off" placeholder="Nom du client" class="${champ}">
        <div data-credit-clients class="mt-3 flex flex-wrap gap-2"></div>
        <p data-credit-doit class="hidden mt-2 text-sm font-bold text-orange-800 dark:text-orange-300"></p>
        <div data-credit-tel class="hidden mt-3">
          <input id="vente-credit-telephone" type="tel" maxlength="50" autocomplete="off" placeholder="Téléphone (facultatif, pour lui rappeler sur WhatsApp)" class="${champ}">
        </div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="vente-credit-avance" class="block text-sm font-semibold text-[#0d1b19] dark:text-gray-200 mb-2">Avance reçue <span class="font-normal text-gray-500">(facultatif)</span></label>
          <input id="vente-credit-avance" type="number" min="0" step="1" inputmode="numeric" placeholder="0 FCFA" class="${champ}">
          <input id="vente-credit-avance-moyen" type="hidden" value="cash">
          <div data-credit-avance-moyen class="hidden mt-2 inline-flex rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-1 text-xs">
            <button type="button" data-valeur="cash" class="px-3 h-8 rounded-full font-bold">reçue en Cash</button>
            <button type="button" data-valeur="mobile_money" class="px-3 h-8 rounded-full font-bold">en Mobile Money</button>
          </div>
        </div>
        <div>
          <label for="vente-credit-echeance" class="block text-sm font-semibold text-[#0d1b19] dark:text-gray-200 mb-2">Il paiera le reste le… <span class="font-normal text-gray-500">(facultatif)</span></label>
          <input id="vente-credit-echeance" type="date" class="form-input date-input w-full h-12 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-background-dark px-5 text-base text-[#0d1b19] dark:text-white">
        </div>
      </div>`;
    ligneDate.insertAdjacentElement("afterend", blocCredit);
    const champNomCredit = blocCredit.querySelector("#vente-credit-client");
    const champTelCredit = blocCredit.querySelector("#vente-credit-telephone");
    const champAvance = blocCredit.querySelector("#vente-credit-avance");
    const champAvanceMoyen = blocCredit.querySelector("#vente-credit-avance-moyen");
    const champEcheance = blocCredit.querySelector("#vente-credit-echeance");
    const zoneClients = blocCredit.querySelector("[data-credit-clients]");
    const zoneDoit = blocCredit.querySelector("[data-credit-doit]");
    const zoneTel = blocCredit.querySelector("[data-credit-tel]");
    const zoneAvanceMoyen = blocCredit.querySelector("[data-credit-avance-moyen]");

    // Plusieurs articles : le reçu ou le justificatif s'ajoute ensuite, vente par vente
    const noteJustificatif = document.createElement("p");
    noteJustificatif.className = "hidden text-sm text-gray-500 dark:text-gray-400";
    noteJustificatif.textContent = "Plusieurs articles : chacun devient une vente. Le reçu ou le justificatif s'ajoute ensuite depuis le tableau des ventes.";
    blocJustificatif?.insertAdjacentElement("afterend", noteJustificatif);

    // Retour à la grille depuis la saisie à la main
    const lienGrille = document.createElement("button");
    lienGrille.type = "button";
    lienGrille.className = "hidden mt-2 items-center gap-1 text-sm font-medium text-primary hover:underline";
    lienGrille.innerHTML = `<span class="material-symbols-outlined text-base">grid_view</span>Revenir aux articles du catalogue`;
    blocArticle.appendChild(lienGrille);

    const grille = blocCartes.querySelector("[data-cartes-grille]");
    const zonePanier = blocCartes.querySelector("[data-cartes-panier]");
    const zoneTotal = blocCartes.querySelector("[data-cartes-total]");
    const erreur = blocCartes.querySelector("[data-cartes-erreur]");
    const recherche = blocCartes.querySelector("[data-cartes-recherche]");
    const cle = (nom) => normalizeLabel(nom).toLowerCase();
    const suiviStock = (a) => a.stock !== null && a.stock !== undefined;
    const enCredit = () => moyenInput.value === "credit";
    const totalPanier = () => panier.reduce((s, l) => s + (Number(l.article.unitPrice) || 0) * l.quantite, 0);
    const styleChoix = (b, on) => {
      ["bg-white", "dark:bg-gray-600", "shadow-sm", "text-[#0d1b19]", "dark:text-white"].forEach((k) => b.classList.toggle(k, on));
      b.classList.toggle("text-gray-500", !on);
    };

    // Le serveur met parfois plusieurs secondes à répondre : le dernier
    // catalogue connu, rangé dans l'ordre d'affichage, s'affiche tout de
    // suite, puis il est remplacé dès que la réponse arrive.
    const CLE_CATALOGUE = "ogo_catalogue_cartes";
    const entreprise = (() => { try { return (JSON.parse(localStorage.getItem("user") || "null") || {}).organizationId || ""; } catch (e) { return ""; } })();
    function lireCatalogue() {
      try {
        const c = JSON.parse(localStorage.getItem(CLE_CATALOGUE) || "null");
        return c && c.entreprise === entreprise && Array.isArray(c.articles) ? c.articles : null;
      } catch (e) { return null; }
    }
    function garderCatalogue() {
      try { localStorage.setItem(CLE_CATALOGUE, JSON.stringify({ entreprise, articles: ordre })); } catch (e) {}
    }

    // ── Bloc crédit ──
    function majClientsCredit() {
      const debiteurs = creditsClients.resume().clients.filter((c) => c.du > 0).sort((a, b) => b.du - a.du).slice(0, 5);
      const choisi = window.OGOUE?.cleClient ? window.OGOUE.cleClient(champNomCredit.value) : "";
      zoneClients.innerHTML = debiteurs.map((c) =>
        `<button type="button" data-client="${echapperHtml(c.nom)}" data-tel="${echapperHtml(c.telephone || "")}" class="${pastille} ${c.cle === choisi ? "border-2 border-primary text-primary font-extrabold bg-white dark:bg-gray-800" : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-[#0d1b19] dark:text-white"}">${echapperHtml(c.nom)}</button>`
      ).join("") + (debiteurs.length ? `<button type="button" data-nouveau-client class="${pastille} border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-[#0d1b19] dark:text-white">+ Nouveau client</button>` : "");
      const connu = champNomCredit.value.trim() ? creditsClients.duPar(champNomCredit.value) : null;
      zoneDoit.classList.toggle("hidden", !(connu && connu.du > 0));
      if (connu && connu.du > 0) zoneDoit.textContent = `Ce client vous doit déjà ${fcfa(connu.du)} F.`;
      // Téléphone demandé seulement si on ne le connaît pas encore
      zoneTel.classList.toggle("hidden", !champNomCredit.value.trim() || !!(connu && connu.telephone));
    }
    function majAvance() {
      const avance = Number(champAvance.value) || 0;
      zoneAvanceMoyen.classList.toggle("hidden", !(avance > 0));
      zoneAvanceMoyen.classList.toggle("inline-flex", avance > 0);
      zoneAvanceMoyen.querySelectorAll("[data-valeur]").forEach((b) => styleChoix(b, b.dataset.valeur === champAvanceMoyen.value));
    }
    // La date promise ne peut pas précéder la vente
    function majEcheances() {
      champEcheance.min = dateInput.value || "";
      if (champEcheance.value && champEcheance.min && champEcheance.value < champEcheance.min) champEcheance.value = "";
    }
    dateInput.addEventListener("change", majEcheances);
    function majCredit() {
      const credit = enCredit();
      blocCredit.classList.toggle("hidden", !credit);
      champNomCredit.required = credit;
      if (credit) { majClientsCredit(); majAvance(); majEcheances(); }
      afficherTotal();
    }
    moyenInput.addEventListener("change", majCredit);
    creditsClients.surChangement(() => { if (enCredit()) majClientsCredit(); });

    zoneClients.addEventListener("click", (e) => {
      const b = e.target.closest("[data-client]");
      if (b) {
        champNomCredit.value = b.dataset.client;
        champTelCredit.value = b.dataset.tel || "";
        majClientsCredit();
        return;
      }
      if (e.target.closest("[data-nouveau-client]")) {
        champNomCredit.value = "";
        champTelCredit.value = "";
        majClientsCredit();
        champNomCredit.focus();
      }
    });
    champNomCredit.addEventListener("input", majClientsCredit);
    champAvance.addEventListener("input", () => { majAvance(); afficherTotal(); });
    zoneAvanceMoyen.addEventListener("click", (e) => {
      const b = e.target.closest("[data-valeur]");
      if (b) { champAvanceMoyen.value = b.dataset.valeur; majAvance(); }
    });

    function majPaiement() {
      blocPaiement.querySelectorAll("[data-paiement]").forEach((b) => styleChoix(b, b.dataset.paiement === paiement));
      moyenInput.value = paiement;
      majCredit();
    }

    async function trier() {
      let ventes = [];
      try { ventes = await getVentesPeriodeCourante(); } catch (e) {}
      const compte = {};
      (ventes || []).forEach((v) => { const k = cle(v.description); compte[k] = (compte[k] || 0) + 1; });
      ordre = [...articlesCache].sort((a, b) =>
        (compte[cle(b.name)] || 0) - (compte[cle(a.name)] || 0) || String(a.name).localeCompare(String(b.name), "fr"));
    }

    const ligneDe = (a) => panier.find((l) => l.article.id === a.id) || null;

    function carte(a) {
      const prix = Number(a.unitPrice) || 0;
      const reste = suiviStock(a) ? Number(a.stock) : null;
      const bloque = prix <= 0 || (reste !== null && reste <= 0);
      const l = ligneDe(a);
      const sousTitre = prix <= 0 ? "Prix à fixer dans le catalogue"
        : reste !== null && reste <= 0 ? "Rupture de stock"
        : reste !== null ? `Stock : ${reste}` : "";
      return `<button type="button" data-carte-article="${echapperHtml(a.id)}" ${bloque ? "disabled" : ""}
        class="relative text-left min-h-[104px] rounded-2xl border-2 p-4 flex flex-col justify-between gap-2 transition active:scale-95 touch-manipulation select-none
               ${bloque ? "border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed"
                 : l ? "border-primary bg-primary/5 dark:bg-[#1f3532]"
                 : "border-[#cfe7e3] dark:border-gray-600 bg-white dark:bg-[#1f3532] hover:border-primary"}">
        <span class="font-bold text-[#0d1b19] dark:text-white leading-snug line-clamp-2">${echapperHtml(a.name)}</span>
        <span>
          <span class="flex items-center gap-2 text-base font-bold text-primary">${prix > 0 ? formatPrice(prix) : "—"}${l ? `<span class="rounded-lg bg-primary px-2 py-0.5 text-xs font-extrabold text-white">× ${l.quantite}</span>` : ""}</span>
          ${sousTitre ? `<span class="block text-xs text-gray-500 dark:text-gray-400">${sousTitre}</span>` : ""}
        </span>
      </button>`;
    }

    function afficherTotal() {
      const total = totalPanier();
      zoneTotal.classList.toggle("hidden", !panier.length);
      zoneTotal.classList.toggle("flex", panier.length > 0);
      if (!panier.length) return;
      if (!enCredit()) {
        zoneTotal.innerHTML = `<span>Total <strong>${fcfa(total)} F</strong></span>`;
        return;
      }
      const avance = Math.min(Number(champAvance.value) || 0, total);
      zoneTotal.innerHTML =
        `<span>Total <strong>${fcfa(total)} F</strong></span>` +
        `<span>− Avance <strong>${fcfa(avance)} F</strong></span>` +
        `<span>Reste à crédit <strong class="text-red-700 dark:text-red-400">${fcfa(total - avance)} F</strong></span>`;
    }

    function afficher() {
      if (chargement && !ordre.length) {
        // Cartes d'attente, à la place des anciens champs
        grille.innerHTML = Array.from({ length: 4 }, () =>
          `<div class="min-h-[104px] rounded-2xl border-2 border-gray-100 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 animate-pulse"></div>`).join("");
        zonePanier.classList.add("hidden");
        return;
      }
      const filtre = cle(recherche.value);
      const liste = ordre.filter((a) => !filtre || cle(a.name).includes(filtre));
      grille.innerHTML = liste.length
        ? liste.map(carte).join("")
        : `<p class="col-span-full text-sm text-gray-500 dark:text-gray-400">Aucun article ne correspond. Ajoutez-le au catalogue avec le lien ci-dessous.</p>`;
      zonePanier.classList.toggle("hidden", !panier.length);
      zonePanier.innerHTML = panier.map((l) => {
        const prix = Number(l.article.unitPrice) || 0;
        return `<div class="flex items-center justify-between gap-3 px-4 py-2.5" data-ligne="${echapperHtml(l.article.id)}">
          <span class="min-w-0 text-sm text-[#0d1b19] dark:text-gray-100"><strong>${echapperHtml(l.article.name)}</strong> × ${l.quantite} = ${formatPrice(prix * l.quantite)}</span>
          <span class="flex items-center gap-2 shrink-0">
            <button type="button" data-moins class="size-8 rounded-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 font-bold" aria-label="Une unité de moins">−</button>
            <button type="button" data-plus class="size-8 rounded-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 font-bold" aria-label="Une unité de plus">+</button>
            <button type="button" data-retirer class="ml-1 text-xs font-medium text-gray-500 hover:text-red-600 hover:underline">Retirer</button>
          </span></div>`;
      }).join("");
      // Plusieurs articles : pas de justificatif dans le formulaire
      const plusieurs = panier.length > 1;
      blocJustificatif?.classList.toggle("hidden", plusieurs);
      noteJustificatif.classList.toggle("hidden", !plusieurs);
      afficherTotal();
    }

    // Les champs cachés portent le premier article : getFormData les lit à l'envoi
    function reporterChoix() {
      erreur.classList.add("hidden");
      if (!panier.length) {
        if (articleSelect) articleSelect.value = "";
        qteInput.value = "";
        montantInput.value = "";
        return;
      }
      const { article: a, quantite } = panier[0];
      if (articleSelect) articleSelect.value = a.name;
      qteInput.value = String(quantite);
      montantInput.value = String((Number(a.unitPrice) || 0) * quantite);
      typeInput.value = a.type === "services" ? "services" : "produits";
      moyenInput.value = paiement;
    }

    const maxPour = (a) => (suiviStock(a) ? Number(a.stock) : Infinity);
    function changerQuantite(a, delta) {
      const l = ligneDe(a);
      if (!l) return;
      const q = l.quantite + delta;
      if (q < 1) panier = panier.filter((x) => x !== l);
      else if (q > maxPour(a)) {
        erreur.textContent = `Il ne reste que ${maxPour(a)} unité(s) de « ${a.name} » en stock.`;
        erreur.classList.remove("hidden");
        return;
      } else l.quantite = q;
      reporterChoix();
      afficher();
    }

    // Grille ou champs d'origine. Les champs cachés perdent leur « required » :
    // un champ obligatoire invisible bloquerait l'envoi sans rien dire.
    function appliquer() {
      actif = !manuel && (chargement || articlesCache.length > 0);
      blocCartes.classList.toggle("hidden", !actif);
      blocPaiement.classList.toggle("hidden", !actif);
      blocPaiement.classList.toggle("flex", actif);
      blocArticle.classList.toggle("hidden", actif);
      ligneMoyen.classList.toggle("hidden", actif);
      ligneQuantite.classList.toggle("hidden", actif);
      lienGrille.classList.toggle("hidden", actif || articlesCache.length === 0);
      lienGrille.classList.toggle("inline-flex", !actif && articlesCache.length > 0);
      [moyenInput, typeInput, qteInput, montantInput].forEach((c) => { c.required = !actif; });
      if (actif) {
        if (articleSelect) articleSelect.required = false;
        if (firstInput) firstInput.required = false;
        if (autreInput) { autreInput.required = false; autreWrapper?.classList.add("hidden"); }
        majPaiement();
        reporterChoix();
      } else {
        majCredit();
      }
    }

    // Le catalogue a été (re)chargé : setModeList* vient de remettre les champs d'origine
    apresChangementListe = async () => {
      chargement = false;
      if (!manuel && articlesCache.length) { await trier(); garderCatalogue(); afficher(); }
      else if (!articlesCache.length) { ordre = []; garderCatalogue(); }
      appliquer();
    };

    blocPaiement.addEventListener("click", (e) => {
      const b = e.target.closest("[data-paiement]");
      if (!b) return;
      paiement = b.dataset.paiement;
      if (paiement !== "credit") ecrire(CLE_PAIEMENT, paiement);
      majPaiement();
    });
    grille.addEventListener("click", (e) => {
      const b = e.target.closest("[data-carte-article]");
      if (!b || b.disabled) return;
      const a = ordre.find((x) => String(x.id) === b.dataset.carteArticle);
      if (!a) return;
      if (ligneDe(a)) return changerQuantite(a, 1);
      panier.push({ article: a, quantite: 1 });
      if (navigator.vibrate) navigator.vibrate(15);
      reporterChoix();
      afficher();
    });
    zonePanier.addEventListener("click", (e) => {
      const l = e.target.closest("[data-ligne]");
      if (!l) return;
      const a = ordre.find((x) => String(x.id) === l.dataset.ligne) || panier.find((x) => String(x.article.id) === l.dataset.ligne)?.article;
      if (!a) return;
      if (e.target.closest("[data-plus]")) changerQuantite(a, 1);
      else if (e.target.closest("[data-moins]")) changerQuantite(a, -1);
      else if (e.target.closest("[data-retirer]")) { panier = panier.filter((x) => x.article.id !== a.id); reporterChoix(); afficher(); }
    });
    blocCartes.querySelector("[data-cartes-ajouter]").addEventListener("click", ouvrirAjoutCatalogue);

    // ── Fenêtre « Ajouter au catalogue » ──
    // L'article ajouté rejoint le catalogue partagé (gérant et agents) et
    // entre aussitôt dans le panier.
    function ouvrirAjoutCatalogue() {
      document.getElementById("ogo-ajout-catalogue")?.remove();
      const champAjout = "form-input w-full h-12 rounded-xl border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark px-4 text-base text-[#0d1b19] dark:text-white focus:ring-2 focus:ring-primary/50";
      const fond = document.createElement("div");
      fond.id = "ogo-ajout-catalogue";
      fond.className = "fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4";
      fond.innerHTML = `
        <form role="dialog" aria-modal="true" aria-labelledby="ogo-ajout-titre" novalidate
              class="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl">
          <div class="flex items-center justify-between gap-4 mb-1">
            <h3 id="ogo-ajout-titre" class="text-xl font-bold text-[#0d1b19] dark:text-white">Ajouter au catalogue</h3>
            <button type="button" data-fermer aria-label="Fermer" class="inline-flex items-center justify-center size-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200">
              <span class="material-symbols-outlined text-base">close</span>
            </button>
          </div>
          <p class="text-sm text-gray-500 dark:text-gray-400 mb-5">Il sera proposé à chaque vente, pour vous et vos agents.</p>
          <div class="inline-flex rounded-full bg-gray-100 dark:bg-gray-700 p-1 mb-5" data-type>
            <button type="button" data-valeur="produits" class="px-4 h-9 rounded-full text-sm font-bold">Produit</button>
            <button type="button" data-valeur="services" class="px-4 h-9 rounded-full text-sm font-bold">Service</button>
          </div>
          <label class="block mb-4"><span class="block text-sm font-semibold text-[#0d1b19] dark:text-gray-200 mb-2">Nom</span>
            <input name="nom" type="text" maxlength="120" placeholder="Ex. : Gâteau au chocolat" class="${champAjout}"></label>
          <label class="block mb-4"><span class="block text-sm font-semibold text-[#0d1b19] dark:text-gray-200 mb-2">Prix de vente (FCFA)</span>
            <input name="prix" type="number" min="1" step="1" inputmode="numeric" placeholder="Ex. : 4000" class="${champAjout}"></label>
          <label class="block mb-2" data-bloc-stock><span class="block text-sm font-semibold text-[#0d1b19] dark:text-gray-200 mb-2">Stock disponible <span class="font-normal text-gray-500">(facultatif)</span></span>
            <input name="stock" type="number" min="0" step="1" inputmode="numeric" placeholder="Laissez vide si vous ne suivez pas le stock" class="${champAjout}"></label>
          <p data-erreur class="hidden mt-3 text-sm font-medium text-red-600"></p>
          <div class="mt-6 flex justify-end gap-3">
            <button type="button" data-fermer class="px-5 h-12 rounded-xl text-sm font-bold bg-gray-200 dark:bg-gray-700 text-[#0d1b19] dark:text-gray-200 hover:bg-gray-300">Annuler</button>
            <button type="submit" data-valider class="px-5 h-12 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 disabled:opacity-60">Ajouter et choisir</button>
          </div>
          <div class="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700 text-sm space-y-2">
            <a href="module_articles.html" class="block text-primary font-medium hover:underline">Gérer tout le catalogue (prix d'achat, modifications…)</a>
          </div>
        </form>`;
      document.body.appendChild(fond);

      const f = fond.querySelector("form");
      const erreurAjout = fond.querySelector("[data-erreur]");
      const blocStock = fond.querySelector("[data-bloc-stock]");
      let type = "produits";
      const majType = () => {
        fond.querySelectorAll("[data-type] [data-valeur]").forEach((b) => styleChoix(b, b.dataset.valeur === type));
        blocStock.classList.toggle("hidden", type === "services"); // un service ne se stocke pas
      };
      majType();
      fond.querySelector("[data-type]").addEventListener("click", (e) => {
        const b = e.target.closest("[data-valeur]");
        if (b) { type = b.dataset.valeur; majType(); }
      });

      const fermer = () => { document.removeEventListener("keydown", surEchap); fond.remove(); };
      function surEchap(e) { if (e.key === "Escape") fermer(); }
      document.addEventListener("keydown", surEchap);
      fond.querySelectorAll("[data-fermer]").forEach((b) => b.addEventListener("click", fermer));
      fond.addEventListener("click", (e) => { if (e.target === fond) fermer(); });

      f.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nom = normalizeLabel(f.elements.nom.value);
        const prix = Number(f.elements.prix.value);
        const stockSaisi = f.elements.stock.value.trim();
        const montrer = (m) => { erreurAjout.textContent = m; erreurAjout.classList.remove("hidden"); };
        if (!nom) return montrer("Indiquez le nom.");
        if (!(prix > 0)) return montrer("Indiquez un prix de vente supérieur à 0.");
        if (findArticleByName(nom)) return montrer("Un article porte déjà ce nom dans le catalogue.");
        const stock = type === "produits" && stockSaisi !== "" ? Math.max(0, Math.floor(Number(stockSaisi))) : null;

        const bouton = fond.querySelector("[data-valider]");
        bouton.disabled = true;
        erreurAjout.classList.add("hidden");
        const resultat = await window.OGOUE.addArticle({ name: nom, type, unitPrice: prix, stock });
        if (!resultat.ok) {
          bouton.disabled = false;
          return montrer(resultat.status === 409 ? "Un article porte déjà ce nom dans le catalogue." : (resultat.error || "Ajout impossible. Réessayez."));
        }

        fermer();
        await loadArticles();
        buildArticleOptions();
        manuel = false;
        await apresChangementListe();
        const ajoute = ordre.find((a) => (resultat.article && a.id === resultat.article.id) || cle(a.name) === cle(nom));
        if (ajoute && !(suiviStock(ajoute) && Number(ajoute.stock) <= 0) && !ligneDe(ajoute)) {
          panier.push({ article: ajoute, quantite: 1 });
          reporterChoix();
          afficher();
        }
        window.OGOUE_FEEDBACK?.succes(`« ${echapperHtml(nom)} » ajouté au catalogue`);
      });

      f.elements.nom.focus();
    }
    lienGrille.addEventListener("click", () => { manuel = false; apresChangementListe(); });
    recherche.addEventListener("input", afficher);

    // ── Envoi ──
    // Contrôles propres à la grille et au crédit, puis : un seul article →
    // le gestionnaire habituel du formulaire ; plusieurs → une vente par article.
    form.addEventListener("submit", async (e) => {
      if (!actif) return;
      const bloquer = (texte, cible) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        erreur.textContent = texte;
        erreur.classList.remove("hidden");
        (cible || blocCartes).scrollIntoView({ behavior: "smooth", block: "center" });
      };
      if (!panier.length) return bloquer("Choisissez un article en appuyant sur sa carte.");
      if (enCredit() && (Number(champAvance.value) || 0) >= totalPanier()) {
        return bloquer("L'avance couvre tout : choisissez plutôt Cash ou Mobile Money.", blocCredit);
      }
      if (panier.length === 1) return; // envoi habituel (getFormData lit les champs cachés)

      e.preventDefault();
      e.stopImmediatePropagation();
      const base = getFormData();
      if (!base || !base.date) return;
      const bouton = form.querySelector('button[type="submit"]');
      window.OGOUE_FEEDBACK?.debut(bouton, "Enregistrement des ventes…");
      let faites = 0;
      for (const l of panier) {
        const prix = Number(l.article.unitPrice) || 0;
        const ok = await addVente({
          ...base,
          id: generateId(),
          description: l.article.name,
          article_id: l.article.id,
          type_vente: l.article.type === "services" ? "services" : "produits",
          quantite: l.quantite,
          montant: prix * l.quantite,
          justificatif: "",
          editer_recu: false,
          file: null,
        });
        if (!ok) break;
        faites += 1;
      }
      window.OGOUE_FEEDBACK?.fin(bouton);
      if (!faites) return; // addVente a déjà expliqué le refus
      if (base.moyen_paiement === "credit") await creditsClients.apresVente(base);
      window.OGOUE_FEEDBACK?.succes(faites === panier.length
        ? `${faites} ventes enregistrées · ${formatPrice(totalPanier())}`
        : `${faites} vente(s) sur ${panier.length} enregistrée(s) : vérifiez le tableau`);
      form.reset();
      setTodayAsDefaultDate();
      ventesCacheMois = null;
      ventesCacheAnnee = null;
      await renderCompactTable();
      await loadArticles();
      if (articlesCache.length) setModeListNotEmpty();
    }, true);

    const catalogueGarde = lireCatalogue();
    if (catalogueGarde && catalogueGarde.length) {
      ordre = catalogueGarde;
      // Les cartes doivent pouvoir servir avant la réponse : même liste que celle de l'envoi
      if (!articlesCache.length) {
        articlesCache = catalogueGarde.slice();
        buildArticleOptions(); // la liste cachée doit connaître l'article choisi
      }
    }
    afficher();
    appliquer();
    creditsClients.rafraichir();

    // Après un enregistrement (form.reset) : panier vide, paiement conservé
    form.addEventListener("reset", () => {
      panier = [];
      paiement = paiementHabituel();
      setTimeout(() => {
        champAvanceMoyen.value = "cash";
        if (actif) { majPaiement(); reporterChoix(); afficher(); } else majCredit();
      }, 0);
    });
  })();

  // =========================
  // ⚡ MODE RUSH
  // =========================
  // Pour les moments d'affluence : une carte par article du catalogue,
  // un appui = une vente (quantité 1, prix du catalogue, date du jour).
  // Des appuis rapides sur la même carte se regroupent en une seule vente :
  // deux appuis = quantité 2, trois = quantité 3… La vente part dès que
  // l'on cesse d'appuyer. Une erreur se corrige depuis le tableau des
  // ventes, comme le justificatif, qui se fait plus tard.
  (function modeRush() {
    const titre = form.parentElement.querySelector("h2");
    if (!titre) return;

    const CLE_PAIEMENT = "ogo_rush_paiement";
    const lire = (cle, defaut) => { try { return localStorage.getItem(cle) || defaut; } catch (e) { return defaut; } };
    const ecrire = (cle, val) => { try { localStorage.setItem(cle, val); } catch (e) {} };

    // ── Bascule Saisie normale / Mode rush, à côté du titre ──
    const entete = document.createElement("div");
    entete.className = "flex flex-wrap items-center justify-between gap-3 mb-6";
    titre.classList.remove("mb-6");
    titre.replaceWith(entete);
    entete.appendChild(titre);
    const bascule = document.createElement("div");
    bascule.className = "inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-1";
    bascule.innerHTML =
      `<button type="button" data-mode="normal" class="px-4 h-9 rounded-full text-sm font-bold">Saisie normale</button>` +
      `<button type="button" data-mode="rush" class="px-4 h-9 rounded-full text-sm font-bold inline-flex items-center gap-1"><span class="material-symbols-outlined text-base">bolt</span>Mode rush</button>`;
    entete.appendChild(bascule);

    // ── Zone du mode rush, sous le formulaire ──
    const zone = document.createElement("div");
    zone.className = "hidden";
    zone.innerHTML = `
      <div class="flex flex-wrap items-center gap-3 mb-4">
        <span class="text-sm font-medium text-gray-600 dark:text-gray-300">Paiement :</span>
        <div class="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-1" data-rush-paiement>
          <button type="button" data-paiement="cash" class="px-4 h-9 rounded-full text-sm font-bold">Cash</button>
          <button type="button" data-paiement="mobile_money" class="px-4 h-9 rounded-full text-sm font-bold">Mobile Money</button>
          <button type="button" data-paiement="credit" class="px-4 h-9 rounded-full text-sm font-bold" title="Le client paiera plus tard">Crédit</button>
        </div>
        <input type="text" data-rush-client maxlength="150" autocomplete="off" placeholder="Qui doit payer ? (nom du client)"
               class="hidden form-input w-full sm:w-64 h-10 rounded-full border-2 border-orange-300 bg-orange-50 dark:bg-orange-950/30 text-sm px-4 text-[#0d1b19] dark:text-white">
        <input type="search" data-rush-recherche placeholder="Rechercher un article"
               class="form-input ml-auto w-full sm:w-64 h-10 rounded-full border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark text-sm px-4 text-[#0d1b19] dark:text-white">
      </div>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">Un appui = une vente. Appuis rapides sur la même carte = une vente de plusieurs unités (2 appuis = quantité 2). Le reçu ou le justificatif s'ajoute plus tard, depuis le tableau des ventes.</p>
      <div data-rush-grille class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3"></div>
      <div data-rush-barre class="hidden sticky bottom-3 mt-4 z-10 items-center gap-3 rounded-2xl bg-[#0d1b19] text-white px-4 py-3 shadow-lg">
        <span class="material-symbols-outlined text-base animate-spin">progress_activity</span>
        <span data-rush-attente class="text-sm font-medium"></span>
      </div>
      <p data-rush-bilan class="mt-4 text-sm font-medium text-gray-600 dark:text-gray-300"></p>`;
    form.insertAdjacentElement("afterend", zone);

    const grille = zone.querySelector("[data-rush-grille]");
    const barre = zone.querySelector("[data-rush-barre]");
    const texteAttente = zone.querySelector("[data-rush-attente]");
    const bilan = zone.querySelector("[data-rush-bilan]");
    const recherche = zone.querySelector("[data-rush-recherche]");

    // Crédit : choisi vente par vente, jamais retenu ; sinon le dernier moyen utilisé
    const paiementHabituel = () => { const m = lire(CLE_PAIEMENT, "cash"); return m === "mobile_money" ? m : "cash"; };
    let paiement = paiementHabituel();
    let ordre = [];            // articles triés, figés pendant la session (les cartes ne bougent pas sous le doigt)
    const DELAI_REGROUPEMENT_MS = 700; // pause qui clôt une série d'appuis sur une carte
    const enAttente = [];      // ventes en cours de saisie ou d'envoi : { article, quantite, minuterie }
    const enCours = {};        // série d'appuis encore ouverte, par article
    const envoyes = {};        // ventes enregistrées pendant la session, par article
    let session = { nombre: 0, total: 0 };
    let chaine = Promise.resolve();
    let rafraichir = null;

    const styleBouton = (b, actif) => {
      b.classList.toggle("bg-white", actif);
      b.classList.toggle("dark:bg-gray-600", actif);
      b.classList.toggle("shadow-sm", actif);
      b.classList.toggle("text-[#0d1b19]", actif);
      b.classList.toggle("dark:text-white", actif);
      b.classList.toggle("text-gray-500", !actif);
    };

    function majPaiement() {
      zone.querySelectorAll("[data-paiement]").forEach((b) => styleBouton(b, b.dataset.paiement === paiement));
      zone.querySelector("[data-rush-client]").classList.toggle("hidden", paiement !== "credit");
    }
    zone.querySelector("[data-rush-paiement]").addEventListener("click", (e) => {
      const b = e.target.closest("[data-paiement]");
      if (!b) return;
      paiement = b.dataset.paiement;
      if (paiement !== "credit") ecrire(CLE_PAIEMENT, paiement);
      majPaiement();
    });

    const cle = (nom) => normalizeLabel(nom).toLowerCase();
    const attenteDe = (article) => enAttente.filter((p) => p.article.id === article.id).reduce((s, p) => s + p.quantite, 0);
    const suiviStock = (a) => a.stock !== null && a.stock !== undefined;
    const today = () => {
      const d = new Date();
      return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    };

    // Du plus vendu au moins vendu, d'après les ventes du mois en cours
    async function trier() {
      let ventes = [];
      try { ventes = await getVentesPeriodeCourante(); } catch (e) {}
      const compte = {};
      (ventes || []).forEach((v) => {
        const k = cle(v.description);
        compte[k] = (compte[k] || 0) + 1;
      });
      ordre = [...articlesCache].sort((a, b) =>
        (compte[cle(b.name)] || 0) - (compte[cle(a.name)] || 0) || String(a.name).localeCompare(String(b.name), "fr"));
    }

    function carte(a) {
      const prix = Number(a.unitPrice) || 0;
      const reste = suiviStock(a) ? Number(a.stock) - attenteDe(a) : null;
      const bloque = prix <= 0 || (reste !== null && reste <= 0);
      const n = (envoyes[a.id] || 0) + attenteDe(a);
      const sousTitre = prix <= 0
        ? "Prix à fixer dans le catalogue"
        : reste !== null && reste <= 0
          ? "Rupture de stock"
          : reste !== null ? `Stock : ${reste}` : "";
      return `<button type="button" data-rush-article="${echapperHtml(a.id)}" ${bloque ? "disabled" : ""}
        class="relative text-left min-h-[104px] rounded-2xl border-2 p-4 flex flex-col justify-between gap-2 transition active:scale-95 touch-manipulation select-none
               ${bloque ? "border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed" : "border-[#cfe7e3] dark:border-gray-600 bg-white dark:bg-[#1f3532] hover:border-primary"}">
        ${n ? `<span class="absolute -top-2 -right-2 min-w-7 h-7 px-2 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center">×${n}</span>` : ""}
        <span class="font-bold text-[#0d1b19] dark:text-white leading-snug line-clamp-2">${echapperHtml(a.name)}</span>
        <span>
          <span class="block text-base font-bold text-primary">${prix > 0 ? formatPrice(prix) : "—"}</span>
          ${sousTitre ? `<span class="block text-xs text-gray-500 dark:text-gray-400">${sousTitre}</span>` : ""}
        </span>
      </button>`;
    }

    function afficher() {
      if (!articlesCache.length) {
        grille.innerHTML = `<div class="col-span-full rounded-2xl border border-dashed border-gray-300 dark:border-gray-600 p-6 text-center text-sm text-gray-600 dark:text-gray-300">
          Le mode rush utilise votre catalogue. <a href="module_articles.html" class="font-bold text-primary hover:underline">Ajoutez vos articles et leurs prix</a> pour l'utiliser.</div>`;
        return;
      }
      const filtre = cle(recherche.value);
      const liste = ordre.filter((a) => !filtre || cle(a.name).includes(filtre));
      grille.innerHTML = liste.length
        ? liste.map(carte).join("")
        : `<p class="col-span-full text-sm text-gray-500 dark:text-gray-400">Aucun article ne correspond. Pour un article hors catalogue, passez en saisie normale.</p>`;
    }

    function majBarre() {
      barre.classList.toggle("hidden", !enAttente.length);
      barre.classList.toggle("flex", !!enAttente.length);
      const dernier = enAttente[enAttente.length - 1];
      texteAttente.textContent = enAttente.length
        ? `Enregistrement en cours : ${enAttente.length} vente${enAttente.length > 1 ? "s" : ""} · dernière : ${dernier.article.name}${dernier.quantite > 1 ? " ×" + dernier.quantite : ""}`
        : "";
      bilan.textContent = session.nombre
        ? `Depuis l'ouverture du mode rush : ${session.nombre} vente${session.nombre > 1 ? "s" : ""} · ${formatPrice(session.total)}`
        : "";
    }

    function envoyer(p) {
      const article = p.article;
      chaine = chaine.then(async () => {
        const prix = Number(article.unitPrice) || 0;
        const quantite = p.quantite;
        const montant = prix * quantite;
        const resultat = await addVente({
          id: generateId(),
          date: today(),
          description: article.name,
          article_id: article.id,
          moyen_paiement: p.paiement,
          type_vente: article.type === "services" ? "services" : "produits",
          quantite,
          montant,
          justificatif: "",
          editer_recu: false,
          client_nom: p.client || "",
          note: "",
        });
        if (resultat && p.paiement === "credit") creditsClients.apresVente({ client_nom: p.client });
        if (resultat) {
          envoyes[article.id] = (envoyes[article.id] || 0) + quantite;
          session.nombre += 1;
          session.total += montant;
          if (suiviStock(article)) article.stock = Number(article.stock) - quantite;
          // Même confirmation verte qu'en saisie normale
          window.OGOUE_FEEDBACK?.succes(`Vente enregistrée : ${echapperHtml(article.name)}${quantite > 1 ? " ×" + quantite : ""} · ${formatPrice(montant)}`);
        }
        const i = enAttente.indexOf(p);
        if (i >= 0) enAttente.splice(i, 1);
        afficher();
        majBarre();
        // Tableau des ventes du jour remis à jour (un seul rechargement si les appuis s'enchaînent)
        clearTimeout(rafraichir);
        rafraichir = setTimeout(() => {
          ventesCacheMois = null;
          ventesCacheAnnee = null;
          renderCompactTable();
        }, 300);
      });
    }

    // Clôt la série d'appuis d'un article et envoie la vente
    function cloturer(p) {
      clearTimeout(p.minuterie);
      if (enCours[p.article.id] === p) delete enCours[p.article.id];
      envoyer(p);
    }

    function appui(article) {
      let p = enCours[article.id];
      if (p) {
        p.quantite += 1;
        clearTimeout(p.minuterie);
      } else {
        // Crédit : impossible sans savoir qui doit payer
        const client = normalizeLabel(zone.querySelector("[data-rush-client]").value);
        if (paiement === "credit" && !client) {
          const champ = zone.querySelector("[data-rush-client]");
          champ.focus();
          champ.classList.add("ring-2", "ring-red-500");
          setTimeout(() => champ.classList.remove("ring-2", "ring-red-500"), 1500);
          window.OGOUE_FEEDBACK?.succes("Indiquez d'abord le nom du client qui prend à crédit");
          return;
        }
        // Moyen de paiement et client figés au moment de l'appui
        p = { article, quantite: 1, minuterie: null, paiement, client: paiement === "credit" ? client : "" };
        enCours[article.id] = p;
        enAttente.push(p);
      }
      p.minuterie = setTimeout(() => cloturer(p), DELAI_REGROUPEMENT_MS);
      if (navigator.vibrate) navigator.vibrate(15);
      afficher();
      majBarre();
    }

    // Page quittée ou mise en arrière-plan : les séries ouvertes partent tout de suite
    function toutCloturer() {
      Object.values(enCours).forEach(cloturer);
    }
    document.addEventListener("visibilitychange", () => { if (document.hidden) toutCloturer(); });
    window.addEventListener("pagehide", toutCloturer);

    grille.addEventListener("click", (e) => {
      const b = e.target.closest("[data-rush-article]");
      if (!b || b.disabled) return;
      const article = ordre.find((a) => String(a.id) === b.dataset.rushArticle);
      if (article) appui(article);
    });
    recherche.addEventListener("input", afficher);

    async function choisirMode(mode) {
      const rush = mode === "rush";
      bascule.querySelectorAll("[data-mode]").forEach((b) => styleBouton(b, b.dataset.mode === mode));
      form.classList.toggle("hidden", rush);
      zone.classList.toggle("hidden", !rush);
      if (rush) {
        if (!articlesCache.length) await loadArticles();
        await trier();
        afficher();
        majBarre();
      } else {
        toutCloturer();
      }
    }
    bascule.addEventListener("click", (e) => {
      const b = e.target.closest("[data-mode]");
      if (b) choisirMode(b.dataset.mode);
    });

    majPaiement();
    // La page s'ouvre toujours en saisie normale ; le mode rush se choisit à chaque fois
    choisirMode("normal");
  })();

  // Initialisation : charger et afficher les ventes de la période actuelle
  renderCompactTable();
})();
