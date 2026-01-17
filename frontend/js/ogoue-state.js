// Global OGOUE State Management
window.OGOUE = window.OGOUE || {};

// Auth state
window.OGOUE.authState = {
    user: null,
    token: null,
    isAuthenticated: false
};

// Initialize auth from session
window.OGOUE.initAuth = function() {
    const token = sessionStorage.getItem('supabaseToken');
    if (token) {
        window.OGOUE.authState.token = token;
        window.OGOUE.authState.isAuthenticated = true;
    } else {
        window.location.href = 'localhost:8080/login.html';
    }
};

// Handle unauthorized
window.OGOUE.handleUnauthorized = function() {
    sessionStorage.removeItem('supabaseToken');
    window.location.href = 'localhost:8080/login.html';
};

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    window.OGOUE.initAuth();
});
