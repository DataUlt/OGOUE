/**
 * API Configuration
 * Détecte automatiquement l'URL de base API selon l'environnement
 * 
 * DEV: http://localhost:3001
 * PROD: https://api.ogoue.com (configuré via env var)
 */

const getApiBaseUrl = () => {
  // En développement local
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3001';
  }
  
  // En production - utiliser l'URL Render
  // Cette URL est définie lors du déploiement sur Render
  return 'https://api.ogoue.com';
};

export const API_BASE_URL = getApiBaseUrl();

// Log pour debug
console.log(`[API Config] Mode: ${window.location.hostname === 'localhost' ? 'DEV' : 'PROD'}, API URL: ${API_BASE_URL}`);
