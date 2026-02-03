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
    const token = localStorage.getItem('authToken');
    if (token) {
        window.OGOUE.authState.token = token;
        window.OGOUE.authState.isAuthenticated = true;
    } else {
        // Redirect to login with proper URL
        const loginUrl = (['localhost','127.0.0.1'].some(h => location.hostname.includes(h)))
            ? 'http://127.0.0.1:8080/login.html'
            : 'https://www.ogoue.com/login.html';
        window.location.href = loginUrl;
    }
};

// Handle unauthorized
window.OGOUE.handleUnauthorized = function() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('ogo_org');
    // Redirect to login with proper URL
    const loginUrl = (['localhost','127.0.0.1'].some(h => location.hostname.includes(h)))
        ? 'http://127.0.0.1:8080/login.html'
        : 'https://www.ogoue.com/login.html';
    window.location.href = loginUrl;
};

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    window.OGOUE.initAuth();
});
