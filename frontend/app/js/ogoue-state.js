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

/**
 * Envoie une nouvelle vente à l'API (authentifiée par JWT)
 * @param {Object} vente - { date, description, moyen_paiement, type_vente, quantite, montant, justificatif, file }
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
    
    // Ajouter le fichier s'il existe
    if (vente.file) {
      formData.append("receipt", vente.file);
    }

    // Créer un XMLHttpRequest pour tracker la progression
    if (vente.file && onProgress) {
      return new Promise((resolve, reject) => {
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
              resolve(data);
            } catch (e) {
              reject(new Error("Erreur de parsing réponse"));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.error || `HTTP ${xhr.status}`));
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
        body: formData
      });

      if (response.status === 401) {
        handleUnauthorized();
        return null;
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Erreur API addVente:", errorData);
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Vente ajoutée:", data);
      return data;
    }
  } catch (error) {
    console.error("❌ Erreur lors de l'ajout de vente:", error);
    alert(`Erreur lors de l'ajout de vente: ${error.message}`);
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
    
    // Ajouter le fichier s'il existe
    if (depense.file) {
      formData.append("receipt", depense.file);
    }

    // Créer un XMLHttpRequest pour tracker la progression
    if (depense.file && onProgress) {
      return new Promise((resolve, reject) => {
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
              resolve(data);
            } catch (e) {
              reject(new Error("Erreur de parsing réponse"));
            }
          } else {
            try {
              const errorData = JSON.parse(xhr.responseText);
              reject(new Error(errorData.error || `HTTP ${xhr.status}`));
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
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log("✅ Dépense ajoutée:", data);
      return data;
    }
  } catch (error) {
    console.error("❌ Erreur lors de l'ajout de dépense:", error);
    alert(`Erreur lors de l'ajout de dépense: ${error.message}`);
    return null;
  }
}

// ─────────────────────────────────────────────────
// 📥 RÉCUPÉRATION DEPUIS L'API
// ─────────────────────────────────────────────────

/**
 * Récupère les ventes pour une période donnée (authentifiée par JWT)
 * orgId est déduit du token JWT côté backend
 * @param {number} mois - 1-12
 * @param {number} annee - ex: 2025
 * @returns {Promise<Array>}
 */
async function getVentesPourPeriode(mois, annee) {
  const token = getToken();
  if (!token) {
    console.warn("Pas de token, redirection vers login");
    handleUnauthorized();
    return [];
  }

  try {
    const params = new URLSearchParams({
      month: mois,
      year: annee
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
async function getDepensesPourPeriode(mois, annee) {
  const token = getToken();
  if (!token) {
    console.warn("Pas de token, redirection vers login");
    handleUnauthorized();
    return [];
  }

  try {
    const params = new URLSearchParams({
      month: mois,
      year: annee
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
 * Ajoute un article au catalogue
 * @returns {Promise<{ok: boolean, status: number, article: Object|null, error: string|null}>}
 */
async function addArticle({ name, type = "produits", unitPrice = 0 }) {
  try {
    const { ok, status, data } = await articlesRequest("", {
      method: "POST",
      body: JSON.stringify({ name, type, unitPrice })
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
window.OGOUE = {
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
  deleteApplicationDocument
};
