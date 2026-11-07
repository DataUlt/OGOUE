// js/ogoue-state.js
// ============================================================
// CONNEXION À L'API BACKEND AVEC JWT AUTHENTICATION
// ============================================================

// URL de base du backend
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3001'
  : 'https://api.ogoue.com';

// ─────────────────────────────────────────────────
// 🔐 AUTHENTICATION HELPERS
// ─────────────────────────────────────────────────

/**
 * Récupère le token JWT du localStorage
 * @returns {string|null}
 */
function getToken() {
  return localStorage.getItem("authToken");
}

/**
 * Récupère l'utilisateur courant depuis localStorage
 * @returns {Object|null}
 */
function getCurrentUser() {
  const userStr = localStorage.getItem("user");
  return userStr ? JSON.parse(userStr) : null;
}

/**
 * Efface les chiffres que le tableau de bord garde pour s'afficher vite
 * (clés ogo_tdb_*, voir dashboard.js). À la déconnexion, rien de
 * l'activité ne doit rester dans le navigateur.
 */
function oublierChiffresMemorises() {
  try {
    Object.keys(localStorage)
      .filter((cle) => cle.startsWith("ogo_tdb_"))
      .forEach((cle) => localStorage.removeItem(cle));
  } catch (e) {
    // Stockage inaccessible : il n'y a alors rien à effacer.
  }
}

/**
 * Gère les réponses non autorisées (401)
 * Nettoie les données d'auth et redirige vers login
 */
function handleUnauthorized() {
  console.warn("❌ Token expiré ou invalide. Redirection vers login...");
  const user = getCurrentUser();
  console.warn("Utilisateur actuel:", user);
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  localStorage.removeItem("ogo_org");
  oublierChiffresMemorises();
  const MARKETING_BASE = (['localhost','127.0.0.1'].some(h => location.hostname.includes(h)))
    ? 'http://127.0.0.1:8080'
    : 'https://www.ogoue.com';
  
  // Délai de 5 secondes pour que l'utilisateur voie l'erreur
  console.warn('❌ Session expirée. Redirection vers la connexion dans 5 secondes...');
  setTimeout(() => {
    window.location.href = `${MARKETING_BASE}/login.html`;
  }, 5000);
}

// ─────────────────────────────────────────────────
// État global simplifié (cache mémoire)
// ─────────────────────────────────────────────────
const today = new Date();
const defaultState = {
  utilisateur: null,
  periodeCourante: { mois: today.getMonth() + 1, annee: today.getFullYear() },
  ventes: [],
  depenses: []
};

const appState = structuredClone(defaultState);

// ─────────────────────────────────────────────────
// 📤 ENVOI VERS L'API
// ─────────────────────────────────────────────────

/** Erreur d'API qui garde le corps de la réponse (code, limite…). */
function erreurApi(errorData, status) {
  const erreur = new Error(errorData?.error || `HTTP ${status}`);
  erreur.detail = errorData || null;
  return erreur;
}

/**
 * Un refus pour quota d'opérations ouvre la fenêtre dédiée plutôt qu'une
 * alerte brute. Renvoie true si l'erreur a été prise en charge.
 */
function signalerQuotaOperations(erreur) {
  if (erreur?.detail?.code !== "quota_operations" || !window.OGOUE_PLAN?.quotaAtteint) {
    return false;
  }
  window.OGOUE_PLAN.quotaAtteint({ ...erreur.detail, message: erreur.detail.error });
  return true;
}

/**
 * Envoie une nouvelle vente à l'API (authentifiée par JWT)
 * @param {Object} vente - { date, description, moyen_paiement, type_vente, quantite, montant, justificatif, client_nom, client_telephone, client_email, file }
 * @param {Function} onProgress - Callback optionnel pour le suivi de la progression (percent)
 * @returns {Promise<Object|null>}
 */
async function addVente(vente, onProgress) {
  const token = getToken();
  if (!token) {
    alert("Vous devez être connecté");
    handleUnauthorized();
    return null;
  }

  try {
    // Utiliser FormData pour supporter les fichiers
    const formData = new FormData();
    formData.append("saleDate", vente.date);
    formData.append("description", vente.description || "");
    formData.append("saleType", vente.type_vente || "produits");
    formData.append("paymentMethod", vente.moyen_paiement || "cash");
    formData.append("quantity", vente.quantite || 1);
    formData.append("amount", vente.montant || 0);
    formData.append("receiptName", vente.justificatif || "");
    // Le reçu n'est édité que sur demande explicite du gérant.
    formData.append("editerRecu", vente.editer_recu ? "true" : "false");
    // Client imprimé sur le reçu édité par OGOUE (facultatif)
    formData.append("clientName", vente.client_nom || "");
    formData.append("clientPhone", vente.client_telephone || "");
    formData.append("clientEmail", vente.client_email || "");
    // Commentaire libre du gérant sur cette vente (facultatif)
    formData.append("note", vente.note || "");
    // Article du catalogue : permet de décompter son stock (vide = hors catalogue)
    formData.append("articleId", vente.article_id || "");
    // Vente à crédit : date promise du solde (facultative)
    if (vente.credit_echeance) formData.append("creditEcheance", vente.credit_echeance);


    // Ajouter le fichier s'il existe
    if (vente.file) {
      formData.append("receipt", vente.file);
    }

    // Créer un XMLHttpRequest pour tracker la progression
    if (vente.file && onProgress) {
      // `await` : sans lui, un refus du serveur échapperait au catch
      // ci-dessous et n'y serait jamais expliqué à l'utilisateur.
      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Suivi de la progression
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            onProgress(percentComplete);
          }
        });

        xhr.addEventListener("load", async () => {
          if (xhr.status === 401) {
            handleUnauthorized();
            resolve(null);
            return;
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              console.log("✅ Vente ajoutée:", data);
              window.OGOUE_PLAN?.operationAjoutee?.();
              resolve(data);
            } catch (e) {
              reject(new Error("Erreur de parsing réponse"));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(erreurApi(errorData, xhr.status));
            } catch (e) {
              reject(new Error(`HTTP ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Erreur réseau"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Téléchargement annulé"));
        });

        xhr.open("POST", `${API_BASE_URL}/api/sales`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.send(formData);
      });
    } else {
      // Utiliser fetch si pas de fichier
      const response = await fetch(`${API_BASE_URL}/api/sales`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
        // La vente part au bout même si la page est quittée juste après (mode rush)
        keepalive: true
      });

      if (response.status === 401) {
        handleUnauthorized();
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erreur API addVente:", errorData);
        throw erreurApi(errorData, response.status);
      }

      const data = await response.json();
      console.log("✅ Vente ajoutée:", data);
      window.OGOUE_PLAN?.operationAjoutee?.();
      return data;
    }
  } catch (error) {
    console.error("❌ Erreur lors de l'ajout de vente:", error);
    // Raison du refus, à afficher dans le formulaire (stock, quota, etc.)
    window.OGOUE_DERNIERE_ERREUR_VENTE = error.message;
    if (!signalerQuotaOperations(error)) {
      alert(`Erreur lors de l'ajout de vente: ${error.message}`);
    }
    return null;
  }
}

/**
 * Envoie une nouvelle dépense à l'API (authentifiée par JWT)
 * @param {Object} depense - { date, categorie, moyen_paiement, montant, justificatif, file }
 * @param {Function} onProgress - Callback optionnel pour le suivi de la progression (percent)
 * @returns {Promise<Object|null>}
 */
async function addDepense(depense, onProgress) {
  const token = getToken();
  if (!token) {
    alert("Vous devez être connecté");
    handleUnauthorized();
    return null;
  }

  try {
    // Utiliser FormData pour supporter les fichiers
    const formData = new FormData();
    formData.append("expenseDate", depense.date);
    formData.append("category", depense.categorie || "");
    formData.append("paymentMethod", depense.moyen_paiement || "cash");
    formData.append("amount", depense.montant || 0);
    formData.append("receiptName", depense.justificatif || "");
    // Commentaire libre du gérant sur cette dépense (facultatif)
    formData.append("note", depense.note || "");
    // Dépense à crédit : date de remboursement estimée (facultative)
    if (depense.credit_echeance) formData.append("creditEcheance", depense.credit_echeance);
    
    // Ajouter le fichier s'il existe
    if (depense.file) {
      formData.append("receipt", depense.file);
    }

    // Créer un XMLHttpRequest pour tracker la progression
    if (depense.file && onProgress) {
      // `await` : sans lui, un refus du serveur échapperait au catch
      // ci-dessous et n'y serait jamais expliqué à l'utilisateur.
      return await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Suivi de la progression
        xhr.upload.addEventListener("progress", (e) => {
          if (e.lengthComputable) {
            const percentComplete = (e.loaded / e.total) * 100;
            onProgress(percentComplete);
          }
        });

        xhr.addEventListener("load", async () => {
          if (xhr.status === 401) {
            handleUnauthorized();
            resolve(null);
            return;
          }

          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const data = JSON.parse(xhr.responseText);
              console.log("✅ Dépense ajoutée:", data);
              window.OGOUE_PLAN?.operationAjoutee?.();
              resolve(data);
            } catch (e) {
              reject(new Error("Erreur de parsing réponse"));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(erreurApi(errorData, xhr.status));
            } catch (e) {
              reject(new Error(`HTTP ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener("error", () => {
          reject(new Error("Erreur réseau"));
        });

        xhr.addEventListener("abort", () => {
          reject(new Error("Téléchargement annulé"));
        });

        xhr.open("POST", `${API_BASE_URL}/api/expenses`);
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        xhr.send(formData);
      });
    } else {
      // Utiliser fetch si pas de fichier
      const response = await fetch(`${API_BASE_URL}/api/expenses`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (response.status === 401) {
        handleUnauthorized();
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erreur API addDepense:", errorData);
        throw erreurApi(errorData, response.status);
      }

      const data = await response.json();
      console.log("✅ Dépense ajoutée:", data);
      window.OGOUE_PLAN?.operationAjoutee?.();
      return data;
    }
  } catch (error) {
    console.error("❌ Erreur lors de l'ajout de dépense:", error);
    if (!signalerQuotaOperations(error)) {
      alert(`Erreur lors de l'ajout de dépense: ${error.message}`);
    }
    return null;
  }
}

// ─────────────────────────────────────────────────
// 📥 RÉCUPÉRATION DEPUIS L'API
// ─────────────────────────────────────────────────

// Le backend accepte soit month/year, soit startDate/endDate.
function paramsPeriode(mois, annee, plage) {
  if (plage && plage.startDate && plage.endDate) {
    return new URLSearchParams({ startDate: plage.startDate, endDate: plage.endDate });
  }
  return new URLSearchParams({ month: mois, year: annee });
}

/**
 * Récupère les ventes pour une période donnée (authentifiée par JWT)
 * orgId est déduit du token JWT côté backend
 * @param {number} mois - 1-12
 * @param {number} annee - ex: 2025
 * @param {{startDate: string, endDate: string}} [plage] - YYYY-MM-DD ;
 *   si fournie, elle remplace le mois : une période peut couvrir plusieurs mois
 * @returns {Promise<Array>}
 */
async function getVentesPourPeriode(mois, annee, plage) {
  const token = getToken();
  if (!token) {
    console.warn("Pas de token, redirection vers login");
    handleUnauthorized();
    return [];
  }

  try {
    const params = paramsPeriode(mois, annee, plage);

    const response = await fetch(`${API_BASE_URL}/api/sales?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      handleUnauthorized();
      return [];
    }

    if (!response.ok) {
      console.error(`Erreur API getVentesPourPeriode: ${response.status}`);
      return [];
    }

    const data = await response.json();
    // L'API retourne { sales: [...] }
    return Array.isArray(data.sales) ? data.sales : [];
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des ventes:", error);
    return [];
  }
}

/**
 * Récupère les dépenses pour une période donnée (authentifiée par JWT)
 * orgId est déduit du token JWT côté backend
 * @param {number} mois - 1-12
 * @param {number} annee - ex: 2025
 * @returns {Promise<Array>}
 */
async function getDepensesPourPeriode(mois, annee, plage) {
  const token = getToken();
  if (!token) {
    console.warn("Pas de token, redirection vers login");
    handleUnauthorized();
    return [];
  }

  try {
    const params = paramsPeriode(mois, annee, plage);

    const response = await fetch(`${API_BASE_URL}/api/expenses?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      handleUnauthorized();
      return [];
    }

    if (!response.ok) {
      console.error(`Erreur API getDepensesPourPeriode: ${response.status}`);
      return [];
    }

    const data = await response.json();
    // L'API retourne { expenses: [...] }
    return Array.isArray(data.expenses) ? data.expenses : [];
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des dépenses:", error);
    return [];
  }
}

/**
 * Récupère le résumé mensuel depuis l'API (authentifiée par JWT)
 * orgId est déduit du token JWT côté backend
 * @param {number} mois - 1-12
 * @param {number} annee - ex: 2025
 * @returns {Promise<Object>}
 */
async function getResumeMensuel(mois, annee) {
  const token = getToken();
  if (!token) {
    console.warn("Pas de token, redirection vers login");
    handleUnauthorized();
    return { totalVentes: 0, totalDepenses: 0, resultat: 0, ventesCount: 0, depensesCount: 0 };
  }

  try {
    const params = new URLSearchParams({
      month: mois,
      year: annee
    });

    const response = await fetch(`${API_BASE_URL}/api/summary/month?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      handleUnauthorized();
      return { totalVentes: 0, totalDepenses: 0, resultat: 0, ventesCount: 0, depensesCount: 0 };
    }

    if (!response.ok) {
      console.error(`Erreur API getResumeMensuel: ${response.status}`);
      return { totalVentes: 0, totalDepenses: 0, resultat: 0, ventesCount: 0, depensesCount: 0 };
    }

    const data = await response.json();
    return {
      totalVentes: data.totalSales || 0,
      totalDepenses: data.totalExpenses || 0,
      resultat: data.result || 0,
      ventesCount: data.salesCount || 0,
      depensesCount: data.expensesCount || 0
    };
  } catch (error) {
    console.error("❌ Erreur lors de la récupération du résumé:", error);
    return { totalVentes: 0, totalDepenses: 0, resultat: 0, ventesCount: 0, depensesCount: 0 };
  }
}

// ─────────────────────────────────────────────────
// Fonctions de gestion d'état local (pour période)
// ─────────────────────────────────────────────────

function setPeriodeCourante(mois, annee) {
  appState.periodeCourante = { mois, annee };
}

/**
 * Récupère les ventes pour une plage de dates (authentifiée par JWT)
 * @param {string} startDate - Format YYYY-MM-DD
 * @param {string} endDate - Format YYYY-MM-DD
 * @returns {Promise<Array>}
 */
async function getVentesPourPlage(startDate, endDate) {
  const token = getToken();
  if (!token) {
    console.warn("Pas de token, redirection vers login");
    handleUnauthorized();
    return [];
  }

  try {
    const params = new URLSearchParams({
      startDate: startDate,
      endDate: endDate
    });

    const response = await fetch(`${API_BASE_URL}/api/sales?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      handleUnauthorized();
      return [];
    }

    if (!response.ok) {
      console.error(`Erreur API getVentesPourPlage: ${response.status}`);
      return [];
    }

    const data = await response.json();
    // L'API retourne { sales: [...] }
    return Array.isArray(data.sales) ? data.sales : [];
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des ventes par plage:", error);
    return [];
  }
}

/**
 * Récupère les dépenses pour une plage de dates (authentifiée par JWT)
 * @param {string} startDate - Format YYYY-MM-DD
 * @param {string} endDate - Format YYYY-MM-DD
 * @returns {Promise<Array>}
 */
async function getDepensesPourPlage(startDate, endDate) {
  const token = getToken();
  if (!token) {
    console.warn("Pas de token, redirection vers login");
    handleUnauthorized();
    return [];
  }

  try {
    const params = new URLSearchParams({
      startDate: startDate,
      endDate: endDate
    });

    const response = await fetch(`${API_BASE_URL}/api/expenses?${params}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });

    if (response.status === 401) {
      handleUnauthorized();
      return [];
    }

    if (!response.ok) {
      console.error(`Erreur API getDepensesPourPlage: ${response.status}`);
      return [];
    }

    const data = await response.json();
    // L'API retourne { expenses: [...] }
    return Array.isArray(data.expenses) ? data.expenses : [];
  } catch (error) {
    console.error("❌ Erreur lors de la récupération des dépenses par plage:", error);
    return [];
  }
}

// ─────────────────────────────────────────────────
// 📦 CATALOGUE D'ARTICLES / SERVICES
// ─────────────────────────────────────────────────
// Le catalogue est partagé par toute l'organisation : c'est lui qui
// harmonise les libellés entre le gérant et ses agents, et qui évite
// de ressaisir le prix à chaque vente.

/**
 * Appel authentifié générique vers /api/articles
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function articlesRequest(path, options = {}) {
  const token = getToken();
  if (!token) {
    handleUnauthorized();
    return { ok: false, status: 401, data: null };
  }

  const response = await fetch(`${API_BASE_URL}/api/articles${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  if (response.status === 401) {
    handleUnauthorized();
    return { ok: false, status: 401, data: null };
  }

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  return { ok: response.ok, status: response.status, data };
}

/**
 * Récupère le catalogue de l'organisation
 * @returns {Promise<Array<{id, name, type, unitPrice}>>}
 */
async function getArticles() {
  try {
    const { ok, data } = await articlesRequest("");
    if (!ok) return [];
    return Array.isArray(data?.articles) ? data.articles : [];
  } catch (error) {
    console.error("❌ Erreur lors de la récupération du catalogue:", error);
    return [];
  }
}

/**
 * Rapport de stock d'une période : état des stocks et réapprovisionnement
 * @returns {Promise<{ok: boolean, articles: Array, error: string|null}>}
 */
async function getRapportStock(debut, fin) {
  try {
    const { ok, data } = await articlesRequest(`/rapport?debut=${encodeURIComponent(debut)}&fin=${encodeURIComponent(fin)}`);
    if (!ok) return { ok: false, articles: [], error: data?.error || "Rapport indisponible" };
    return { ok: true, articles: Array.isArray(data?.articles) ? data.articles : [], error: null };
  } catch (error) {
    console.error("❌ Erreur lors du rapport de stock:", error);
    return { ok: false, articles: [], error: "Rapport indisponible" };
  }
}

/**
 * Ajoute un article au catalogue
 * @returns {Promise<{ok: boolean, status: number, article: Object|null, error: string|null}>}
 */
async function addArticle({ name, type = "produits", unitPrice = 0, stock = null, costPrice = null, fabrique }) {
  try {
    const { ok, status, data } = await articlesRequest("", {
      method: "POST",
      body: JSON.stringify({ name, type, unitPrice, stock, costPrice, ...(fabrique !== undefined ? { fabrique } : {}) })
    });
    return {
      ok,
      status,
      article: ok ? data : null,
      error: ok ? null : (data?.error || "Erreur lors de l'ajout de l'article")
    };
  } catch (error) {
    console.error("❌ Erreur lors de l'ajout de l'article:", error);
    return { ok: false, status: 0, article: null, error: "Erreur réseau" };
  }
}

/**
 * Ajoute plusieurs articles d'un coup (étape de configuration)
 * Les noms déjà présents sont ignorés et renvoyés dans `ignored`.
 */
async function addArticlesBulk(articles) {
  try {
    const { ok, status, data } = await articlesRequest("/bulk", {
      method: "POST",
      body: JSON.stringify({ articles })
    });
    return {
      ok,
      status,
      created: data?.created || [],
      ignored: data?.ignored || [],
      error: ok ? null : (data?.error || "Erreur lors de l'enregistrement du catalogue")
    };
  } catch (error) {
    console.error("❌ Erreur lors de l'enregistrement du catalogue:", error);
    return { ok: false, status: 0, created: [], ignored: [], error: "Erreur réseau" };
  }
}

/** Modifie un article du catalogue */
async function updateArticle(id, changes) {
  try {
    const { ok, status, data } = await articlesRequest(`/${id}`, {
      method: "PUT",
      body: JSON.stringify(changes)
    });
    return {
      ok,
      status,
      article: ok ? data : null,
      error: ok ? null : (data?.error || "Erreur lors de la modification")
    };
  } catch (error) {
    console.error("❌ Erreur lors de la modification de l'article:", error);
    return { ok: false, status: 0, article: null, error: "Erreur réseau" };
  }
}

/** Retire un article du catalogue (suppression logique) */
async function deleteArticle(id) {
  try {
    const { ok, status, data } = await articlesRequest(`/${id}`, { method: "DELETE" });
    return { ok, status, error: ok ? null : (data?.error || "Erreur lors de la suppression") };
  } catch (error) {
    console.error("❌ Erreur lors de la suppression de l'article:", error);
    return { ok: false, status: 0, error: "Erreur réseau" };
  }
}

// ─────────────────────────────────────────────────
// 🏦 FINANCEMENT : offre de crédit et dossiers
// ─────────────────────────────────────────────────
// Les produits et les dossiers vivent dans la base des institutions.
// Le backend d'OGOUE sert d'intermédiaire : il retrouve la PME à partir
// du token, la cliente n'a jamais à connaître son identifiant.

/**
 * Appel authentifié générique vers /api/financing
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function financingRequest(path, options = {}) {
  const token = getToken();
  if (!token) {
    handleUnauthorized();
    return { ok: false, status: 401, data: null };
  }

  // Sur un envoi de fichier, laisser le navigateur poser lui-même le
  // Content-Type avec sa frontière multipart.
  const estFormData = options.body instanceof FormData;

  const response = await fetch(`${API_BASE_URL}/api/financing${path}`, {
    ...options,
    headers: {
      ...(estFormData ? {} : { "Content-Type": "application/json" }),
      "Authorization": `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  if (response.status === 401) {
    handleUnauthorized();
    return { ok: false, status: 401, data: null };
  }

  let data = null;
  try {
    data = await response.json();
  } catch (e) {
    data = null;
  }

  return { ok: response.ok, status: response.status, data };
}

/** Crédits proposés par les institutions partenaires */
async function getCreditProducts() {
  const { ok, data } = await financingRequest("/products");
  return ok && Array.isArray(data?.products) ? data.products : [];
}

/** Détail d'un crédit, avec la liste des pièces exigées */
async function getCreditProduct(id) {
  const { ok, data } = await financingRequest(`/products/${id}`);
  return ok ? data : null;
}

/** Dossiers de la PME connectée */
async function getApplications() {
  const { ok, data } = await financingRequest("/applications");
  return ok && Array.isArray(data?.applications) ? data.applications : [];
}

/** Détail d'un dossier : pièces fournies et historique d'avancement */
async function getApplication(id) {
  const { ok, data } = await financingRequest(`/applications/${id}`);
  return ok ? data : null;
}

/**
 * Ouvre un dossier en brouillon sur un crédit.
 * Un 409 signifie qu'un dossier est déjà en cours sur ce produit : on le
 * remonte tel quel pour que l'appelant puisse rediriger au lieu d'échouer.
 */
async function createApplication(payload) {
  const { ok, status, data } = await financingRequest("/applications", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  return {
    ok,
    status,
    application: ok ? data : null,
    error: ok ? null : (data?.error || "Erreur lors de la création du dossier")
  };
}

/** Modifie un dossier encore ouvert (montant, durée, objet) */
async function updateApplication(id, changes) {
  const { ok, status, data } = await financingRequest(`/applications/${id}`, {
    method: "PUT",
    body: JSON.stringify(changes)
  });
  return {
    ok,
    status,
    application: ok ? data : null,
    error: ok ? null : (data?.error || "Erreur lors de l'enregistrement")
  };
}

/**
 * Dépose le dossier auprès de l'institution.
 * En cas de pièces manquantes, l'API renvoie un 400 avec `missing` :
 * on le transmet pour pouvoir les signaler une par une.
 */
async function submitApplication(id) {
  const { ok, status, data } = await financingRequest(`/applications/${id}/submit`, {
    method: "POST"
  });
  return {
    ok,
    status,
    application: ok ? data : null,
    missing: data?.missing || [],
    error: ok ? null : (data?.error || "Erreur lors du dépôt du dossier")
  };
}

/**
 * Téléverse une pièce justificative.
 * @param {string} applicationId
 * @param {File} file
 * @param {{requiredDocumentId?: string, name?: string}} options
 */
async function uploadApplicationDocument(applicationId, file, options = {}) {
  const formData = new FormData();
  formData.append("file", file);
  if (options.requiredDocumentId) formData.append("requiredDocumentId", options.requiredDocumentId);
  if (options.name) formData.append("name", options.name);

  const { ok, status, data } = await financingRequest(`/applications/${applicationId}/documents`, {
    method: "POST",
    body: formData
  });
  return {
    ok,
    status,
    document: ok ? data : null,
    error: ok ? null : (data?.error || "Erreur lors du téléversement")
  };
}

/**
 * Demande un lien de téléchargement pour une pièce.
 * Le bucket est privé : le lien est signé et ne vaut que quelques
 * minutes, il ne doit donc jamais être mis en cache ni partagé.
 * @returns {Promise<string|null>}
 */
async function getApplicationDocumentUrl(applicationId, docId) {
  const { ok, data } = await financingRequest(`/applications/${applicationId}/documents/${docId}/url`);
  return ok ? data.url : null;
}

/** Retire une pièce d'un dossier encore ouvert */
async function deleteApplicationDocument(applicationId, docId) {
  const { ok, status, data } = await financingRequest(
    `/applications/${applicationId}/documents/${docId}`,
    { method: "DELETE" }
  );
  return { ok, status, error: ok ? null : (data?.error || "Erreur lors de la suppression") };
}

// ─────────────────────────────────────────────────
// Exposition sur window
// ─────────────────────────────────────────────────
/** Discussion d'un dossier : messages texte et pieces jointes */
async function getApplicationMessages(applicationId) {
  const { ok, data } = await financingRequest(`/applications/${applicationId}/messages`);
  return ok && Array.isArray(data?.messages) ? data.messages : [];
}

/**
 * Envoie un message au dossier : texte, fichier, ou les deux.
 * @param {string} applicationId
 * @param {{body?: string, file?: File}} contenu
 */
async function postApplicationMessage(applicationId, { body = "", file = null } = {}) {
  const formData = new FormData();
  if (body) formData.append("body", body);
  if (file) formData.append("file", file);
  const { ok, status, data } = await financingRequest(`/applications/${applicationId}/messages`, {
    method: "POST",
    body: formData
  });
  return {
    ok,
    status,
    message: ok ? data?.message : null,
    error: ok ? null : (data?.error || "Message non envoyé")
  };
}

/** Lien temporaire (5 minutes) vers la piece jointe d'un message */
async function getMessageAttachmentUrl(applicationId, messageId) {
  const { ok, data } = await financingRequest(`/applications/${applicationId}/messages/${messageId}/attachment`);
  return ok ? data.url : null;
}

// ─────────────────────────────────────────────────
// Messages non lus : enregistrés sur le serveur, donc partagés entre appareils
// ─────────────────────────────────────────────────

/** Marque le dossier comme consulté par la PME */
async function marquerDossierLu(applicationId) {
  await financingRequest(`/applications/${applicationId}/seen`, { method: "POST" });
}

/** Nombre d'éléments non lus par dossier (messages et décisions de l'institution) */
async function nonLusParDossier() {
  const { ok, data } = await financingRequest("/unread");
  return ok && data && data.parDossier ? data.parDossier : {};
}


// ===== Crédits clients =====
// Ce que les clients doivent : ventes à crédit et règlements (avances,
// paiements), toutes dates (GET /api/credits). Le calcul par client est
// le même que côté serveur (backend/src/utils/credits.js).
async function creditsRequest(chemin, options = {}) {
  const token = getToken();
  if (!token) { handleUnauthorized(); return { ok: false, status: 401, data: null }; }
  const reponse = await fetch(`${API_BASE_URL}/api/credits${chemin}`, {
    ...options,
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}`, ...(options.headers || {}) }
  });
  if (reponse.status === 401) { handleUnauthorized(); return { ok: false, status: 401, data: null }; }
  const data = await reponse.json().catch(() => ({}));
  return { ok: reponse.ok, status: reponse.status, data };
}

async function getCredits() {
  try {
    const { ok, status, data } = await creditsRequest("");
    return {
      ok, status,
      ventes: ok ? (data.ventes || []) : [],
      reglements: ok ? (data.reglements || []) : [],
      error: ok ? null : (data?.error || "Crédits indisponibles")
    };
  } catch (e) {
    console.error("❌ Crédits clients :", e);
    return { ok: false, status: 0, ventes: [], reglements: [], error: "Erreur réseau" };
  }
}

/** Avance (à la vente) ou paiement (ensuite) : { clientNom, clientTelephone, montant, moyen, nature } */
async function enregistrerReglement(reglement) {
  try {
    const { ok, data } = await creditsRequest("/reglements", { method: "POST", body: JSON.stringify(reglement) });
    return { ok, reste: data?.reste, error: ok ? null : (data?.error || "Paiement non enregistré") };
  } catch (e) { return { ok: false, error: "Erreur réseau" }; }
}

async function annulerReglement(id) {
  try {
    const { ok, data } = await creditsRequest(`/reglements/${encodeURIComponent(id)}`, { method: "DELETE" });
    return { ok, error: ok ? null : (data?.error || "Annulation impossible") };
  } catch (e) { return { ok: false, error: "Erreur réseau" }; }
}

// Même client malgré les majuscules, accents ou espaces en trop
function cleClient(nom) {
  return String(nom || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().trim().replace(/\s+/g, " ");
}

const DELAI_CREDIT_PAR_DEFAUT_JOURS = 30; // sans date promise : dû 30 jours après la vente

/**
 * Regroupe par client : ce qu'il doit, ses retards et sa prochaine échéance.
 * Les règlements s'imputent aux ventes les plus anciennes d'abord : la
 * première vente encore impayée dit depuis quand le client est en retard.
 * @returns {{ clients: Array, du: number, enRetard: number, nbEnRetard: number }}
 */
function resumerCredits(ventes, reglements, aujourdhui) {
  const jour = aujourdhui || (() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); })();
  const plusJours = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const ecart = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);

  const parCle = new Map();
  const fiche = (nom) => {
    const k = cleClient(nom);
    if (!parCle.has(k)) parCle.set(k, { cle: k, nom: String(nom || "").trim() || "Client sans nom", telephone: "", ventes: [], reglements: [] });
    return parCle.get(k);
  };
  (ventes || []).forEach((v) => {
    const f = fiche(v.client_nom);
    if (v.client_telephone) f.telephone = v.client_telephone;
    f.ventes.push(v);
  });
  (reglements || []).forEach((r) => {
    const f = fiche(r.client_nom);
    if (r.client_telephone && !f.telephone) f.telephone = r.client_telephone;
    f.reglements.push(r);
  });

  const parVente = {}; // id de vente → { reste, soldeLe, soldeMoyen, client }
  const clients = [...parCle.values()].map((f) => {
    f.ventes.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    const vendu = f.ventes.reduce((s, v) => s + (Number(v.montant) || 0), 0);
    const verse = f.reglements.reduce((s, r) => s + (Number(r.montant) || 0), 0);
    // Imputation, règlement par règlement dans l'ordre des dates : un paiement
    // fait pour une vente précise (sale_id) la règle d'abord ; le reste va aux
    // ventes les plus anciennes. On garde le jour et le moyen du règlement
    // qui solde chaque vente.
    f.ventes.forEach((v) => { v.reste = Number(v.montant) || 0; v.soldeLe = null; v.soldeMoyen = null; });
    const imputer = (v, r, dispo) => {
      const couvert = Math.min(dispo, v.reste);
      v.reste -= couvert;
      if (couvert > 0 && v.reste <= 0) { v.soldeLe = String(r.regle_le).slice(0, 10); v.soldeMoyen = r.moyen; }
      return dispo - couvert;
    };
    [...f.reglements].sort((a, b) => String(a.regle_le).localeCompare(String(b.regle_le))).forEach((r) => {
      let dispo = Number(r.montant) || 0;
      const cible = r.sale_id ? f.ventes.find((v) => v.id === r.sale_id) : null;
      if (cible && cible.reste > 0) dispo = imputer(cible, r, dispo);
      for (const v of f.ventes) { if (dispo <= 0) break; if (v.reste > 0) dispo = imputer(v, r, dispo); }
    });
    let premierRetard = null, prochaine = null;
    f.ventes.forEach((v) => {
      parVente[v.id] = { reste: Math.max(0, v.reste), soldeLe: v.soldeLe, soldeMoyen: v.soldeMoyen, client: f.nom, telephone: f.telephone };
      if (v.reste <= 0) return;
      const echeance = v.echeance || plusJours(v.date, DELAI_CREDIT_PAR_DEFAUT_JOURS);
      if (echeance < jour) { if (!premierRetard || echeance < premierRetard) premierRetard = echeance; }
      else if (!prochaine || echeance < prochaine) prochaine = echeance;
    });
    const du = Math.max(0, vendu - verse);
    const historique = [
      ...f.ventes.map((v) => ({ type: "vente", date: v.date, libelle: v.description, quantite: v.quantite, montant: Number(v.montant) || 0, note: v.note, id: v.id })),
      ...f.reglements.map((r) => ({ type: r.nature === "avance" ? "avance" : "paiement", date: String(r.regle_le).slice(0, 10), moyen: r.moyen, montant: Number(r.montant) || 0, par: r.par, id: r.id }))
    ].sort((a, b) => a.date.localeCompare(b.date) || (a.type === "vente" ? -1 : 1));
    return {
      cle: f.cle, nom: f.nom, telephone: f.telephone,
      nbVentes: f.ventes.length, vendu, verse, du, historique,
      enRetard: du > 0 && !!premierRetard,
      joursRetard: du > 0 && premierRetard ? ecart(premierRetard, jour) : 0,
      prochaineEcheance: du > 0 && !premierRetard ? prochaine : null,
      derniereActivite: historique.length ? historique[historique.length - 1].date : ""
    };
  });

  const actifs = clients.filter((c) => c.du > 0);
  const retard = actifs.filter((c) => c.enRetard);
  return {
    clients: clients.sort((a, b) => (b.enRetard - a.enRetard) || (b.joursRetard - a.joursRetard) || (b.du - a.du)),
    parVente,
    du: actifs.reduce((s, c) => s + c.du, 0),
    nbClients: actifs.length,
    enRetard: retard.reduce((s, c) => s + c.du, 0),
    nbEnRetard: retard.length
  };
}


// Un client ne peut pas avoir payé plus que ce qu'il a acheté à crédit : le
// surplus (vente supprimée après coup) n'est pas compté comme argent entré.
// Même règle que backend/src/utils/credits.js (reglementsPlafonnes).
function reglementsPlafonnes(ventes, reglements) {
  const vendu = {};
  (ventes || []).forEach((v) => { const k = cleClient(v.client_nom); vendu[k] = (vendu[k] || 0) + (Number(v.montant) || 0); });
  const pris = {};
  return [...(reglements || [])]
    .sort((a, b) => String(a.regle_le).localeCompare(String(b.regle_le)))
    .map((r) => {
      const k = r.client_cle || cleClient(r.client_nom);
      const montant = Math.min(Number(r.montant) || 0, Math.max(0, (vendu[k] || 0) - (pris[k] || 0)));
      pris[k] = (pris[k] || 0) + montant;
      return { ...r, montant };
    })
    .filter((r) => r.montant > 0);
}

// ===== Dépenses à crédit =====
// Une dépense à crédit (achat payé plus tard) se paie depuis le tableau des
// dépenses : son moyen de paiement passe à Cash ou Mobile Money.
async function reglerDepense(id, moyen) {
  const token = getToken();
  if (!token) { handleUnauthorized(); return { ok: false, error: "Non connecté" }; }
  try {
    const reponse = await fetch(`${API_BASE_URL}/api/expenses/${encodeURIComponent(id)}/reglement`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ moyen })
    });
    if (reponse.status === 401) { handleUnauthorized(); return { ok: false, error: "Session expirée" }; }
    const data = await reponse.json().catch(() => ({}));
    return { ok: reponse.ok, error: reponse.ok ? null : (data.error || "Paiement non enregistré") };
  } catch (e) { return { ok: false, error: "Erreur réseau" }; }
}

// Dépenses qui sont ou ont été à crédit, toutes dates (tableau de bord)
async function getDepensesCredit() {
  const token = getToken();
  if (!token) return { ok: false, depenses: [] };
  try {
    const reponse = await fetch(`${API_BASE_URL}/api/expenses/credits`, { headers: { "Authorization": `Bearer ${token}` } });
    const data = await reponse.json().catch(() => ({}));
    return { ok: reponse.ok, depenses: reponse.ok ? (data.depenses || []) : [] };
  } catch (e) { return { ok: false, depenses: [] }; }
}

window.OGOUE = {
  reglerDepense,
  getDepensesCredit,
  getCredits,
  enregistrerReglement,
  annulerReglement,
  resumerCredits,
  reglementsPlafonnes,
  cleClient,
  appState,
  getToken,
  getCurrentUser,
  handleUnauthorized,
  setPeriodeCourante,
  addVente,
  addDepense,
  getVentesPourPeriode,
  getDepensesPourPeriode,
  getVentesPourPlage,
  getDepensesPourPlage,
  getResumeMensuel,
  getArticles,
  getRapportStock,
  addArticle,
  addArticlesBulk,
  updateArticle,
  deleteArticle,
  getCreditProducts,
  getCreditProduct,
  getApplications,
  getApplication,
  createApplication,
  updateApplication,
  submitApplication,
  uploadApplicationDocument,
  getApplicationDocumentUrl,
  deleteApplicationDocument,
  getApplicationMessages,
  postApplicationMessage,
  getMessageAttachmentUrl,
  marquerDossierLu,
  nonLusParDossier
};
