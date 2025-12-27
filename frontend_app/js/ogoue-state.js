// js/ogoue-state.js
// ============================================================
// CONNEXION À L'API BACKEND AVEC JWT AUTHENTICATION
// ============================================================

// URL de base du backend
const API_BASE_URL = "https://api.ogoue.com";

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
  localStorage.removeItem("authToken");
  localStorage.removeItem("user");
  window.location.href = "https://www.ogoue.com/login.html";
}

// ─────────────────────────────────────────────────
// État global simplifié (cache mémoire)
// ─────────────────────────────────────────────────
const defaultState = {
  utilisateur: null,
  periodeCourante: { mois: 12, annee: 2025 },
  ventes: [],
  depenses: []
};

const appState = structuredClone(defaultState);

// ─────────────────────────────────────────────────
// 📤 ENVOI VERS L'API
// ─────────────────────────────────────────────────

/**
 * Envoie une nouvelle vente à l'API (authentifiée par JWT)
 * @param {Object} vente - { date, description, moyen_paiement, type_vente, quantite, montant, justificatif }
 * @returns {Promise<Object|null>}
 */
async function addVente(vente) {
  const token = getToken();
  if (!token) {
    alert("Vous devez être connecté");
    handleUnauthorized();
    return null;
  }

  try {
    // Préparer le payload pour l'API
    const payload = {
      saleDate: vente.date,
      description: vente.description || "",
      saleType: vente.type_vente || "produits",
      paymentMethod: vente.moyen_paiement || "cash",
      quantity: vente.quantite || 1,
      amount: vente.montant || 0,
      receiptName: vente.justificatif || ""
    };

    const response = await fetch(`${API_BASE_URL}/api/sales`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
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
  } catch (error) {
    console.error("❌ Erreur lors de l'ajout de vente:", error);
    alert(`Erreur lors de l'ajout de vente: ${error.message}`);
    return null;
  }
}

/**
 * Envoie une nouvelle dépense à l'API (authentifiée par JWT)
 * @param {Object} depense - { date, categorie, moyen_paiement, montant, justificatif }
 * @returns {Promise<Object|null>}
 */
async function addDepense(depense) {
  const token = getToken();
  if (!token) {
    alert("Vous devez être connecté");
    handleUnauthorized();
    return null;
  }

  try {
    const payload = {
      expenseDate: depense.date,
      category: depense.categorie || "",
      paymentMethod: depense.moyen_paiement || "cash",
      amount: depense.montant || 0,
      receiptName: depense.justificatif || ""
    };

    const response = await fetch(`${API_BASE_URL}/api/expenses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify(payload)
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
  getResumeMensuel
};
