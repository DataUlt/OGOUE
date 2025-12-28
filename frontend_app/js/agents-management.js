// Frontend API pour la gestion des agents
const API_BASE_URL = "https://ogoue.onrender.com/api";

// Helper pour obtenir le token
function getToken() {
  return localStorage.getItem("authToken");
}

/**
 * Créer un nouvel agent
 */
export async function createAgent(firstName) {
  try {
    const token = getToken();
    if (!token) {
      throw new Error("Non authentifié - token manquant");
    }

    const response = await fetch(`${API_BASE_URL}/agents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ firstName })
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur création agent:', error);
    throw error;
  }
}

/**
 * Récupérer la liste des agents
 */
export async function listAgents() {
  try {
    const token = getToken();
    if (!token) {
      throw new Error("Non authentifié - token manquant");
    }

    const response = await fetch(`${API_BASE_URL}/agents`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur listage agents:', error);
    throw error;
  }
}

/**
 * Supprimer un agent
 */
export async function deleteAgent(agentId) {
  try {
    const token = getToken();
    if (!token) {
      throw new Error("Non authentifié - token manquant");
    }

    const response = await fetch(`${API_BASE_URL}/agents/${agentId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Erreur suppression agent:', error);
    throw error;
  }
}

/**
 * Copier le code d'accès dans le presse-papiers
 */
export function copyAccessCode(accessCode) {
  navigator.clipboard.writeText(accessCode).then(() => {
    console.log('Code copié !');
  }).catch(() => {
    alert('Impossible de copier le code');
  });
}
