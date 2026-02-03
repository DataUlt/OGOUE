/**
 * Configuration globale de l'API OGOUE
 * À utiliser dans tous les appels API du frontend
 */

// Détermine l'URL de l'API selon l'environnement
function getAPIBaseURL() {
    // En production sur Render
    if (window.location.hostname === 'www.ogoue.com' || 
        window.location.hostname === 'ogoue.com') {
        return 'https://api.ogoue.com';
    }
    
    // En local pour le développement
    if (window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3001'; // ou le port de votre backend local
    }
    
    // En préproduction sur Render (preview)
    if (window.location.hostname.includes('onrender.com')) {
        return 'https://api.ogoue.com';
    }
    
    // Par défaut
    return 'https://api.ogoue.com';
}

// Objet de configuration global
const CONFIG = {
    API_BASE_URL: getAPIBaseURL(),
    APP_NAME: 'OGOUE',
    APP_VERSION: '1.0.0',
    TIMEOUT: 30000, // 30 secondes
    
    // Endpoints API
    ENDPOINTS: {
        AUTH: {
            LOGIN: '/api/auth/login',
            REGISTER: '/api/auth/register',
            LOGOUT: '/api/auth/logout',
            REFRESH: '/api/auth/refresh',
            ME: '/api/auth/me',
            FORGOT_PASSWORD: '/api/auth/forgot-password',
            RESET_PASSWORD: '/api/auth/reset-password'
        },
        AGENTS: '/api/agents',
        DEPENSES: '/api/depenses',
        VENTES: '/api/ventes',
        DASHBOARD: '/api/dashboard',
        AUDIT: '/api/audit'
    }
};

/**
 * Classe utilitaire pour les requêtes API
 */
class APIClient {
    constructor(baseURL = CONFIG.API_BASE_URL) {
        this.baseURL = baseURL;
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }

    /**
     * Obtient le token d'authentification
     */
    getAuthToken() {
        return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    }

    /**
     * Ajoute le token aux en-têtes
     */
    getHeaders() {
        const headers = { ...this.defaultHeaders };
        const token = this.getAuthToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    /**
     * Effectue une requête GET
     */
    async get(endpoint, options = {}) {
        return this.request(endpoint, 'GET', null, options);
    }

    /**
     * Effectue une requête POST
     */
    async post(endpoint, data, options = {}) {
        return this.request(endpoint, 'POST', data, options);
    }

    /**
     * Effectue une requête PUT
     */
    async put(endpoint, data, options = {}) {
        return this.request(endpoint, 'PUT', data, options);
    }

    /**
     * Effectue une requête DELETE
     */
    async delete(endpoint, options = {}) {
        return this.request(endpoint, 'DELETE', null, options);
    }

    /**
     * Requête générique
     */
    async request(endpoint, method = 'GET', data = null, options = {}) {
        const url = this.baseURL + endpoint;
        const config = {
            method,
            headers: this.getHeaders(),
            ...options
        };

        if (data) {
            config.body = JSON.stringify(data);
        }

        try {
            const response = await Promise.race([
                fetch(url, config),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timeout')), CONFIG.TIMEOUT)
                )
            ]);

            // Gestion des erreurs HTTP
            if (!response.ok) {
                if (response.status === 401) {
                    // Token expiré ou invalide
                    localStorage.removeItem('authToken');
                    sessionStorage.removeItem('authToken');
                    window.location.href = '/app/login.html';
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Parsing de la réponse
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }
            return response.text();

        } catch (error) {
            console.error(`API Error (${method} ${endpoint}):`, error);
            throw error;
        }
    }
}

// Instance globale du client API
const api = new APIClient(CONFIG.API_BASE_URL);

// Exporter pour les environnements module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { CONFIG, APIClient, api };
}
