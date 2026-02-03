console.log('dashboard.js loaded');

// Format currency in French format
function formatCurrency(amount) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Get current month and year
function getCurrentMonthYear() {
  const today = new Date();
  return {
    month: today.getMonth() + 1,
    year: today.getFullYear()
  };
}

// Load dashboard data
async function loadDashboardData() {
  try {
    const { month, year } = getCurrentMonthYear();
    const token = localStorage.getItem('authToken');
    
    if (!token) {
      console.log('No auth token found, redirecting to login');
      return;
    }

    const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://127.0.0.1:3001'
      : 'https://api.ogoue.com';

    console.log(`Fetching summary for month=${month}, year=${year}`);
    
    const response = await fetch(`${API_URL}/api/summary/month?month=${month}&year=${year}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Error loading dashboard data:', response.status, response.statusText);
      const error = await response.text();
      console.error('Response body:', error);
      return;
    }

    const data = await response.json();
    console.log('Dashboard data loaded:', JSON.stringify(data, null, 2));

    // Update UI elements with the correct IDs
    const chiffresAffairesEl = document.getElementById('kpi-chiffre-affaires');
    const depensesEl = document.getElementById('kpi-depenses');
    const resultatNetEl = document.getElementById('kpi-resultat');

    if (chiffresAffairesEl) {
      chiffresAffairesEl.textContent = formatCurrency(data.totalSales || 0);
      console.log('Updated Chiffre d\'Affaires:', formatCurrency(data.totalSales || 0));
    }
    if (depensesEl) {
      depensesEl.textContent = formatCurrency(data.totalExpenses || 0);
      console.log('Updated Dépenses:', formatCurrency(data.totalExpenses || 0));
    }
    if (resultatNetEl) {
      resultatNetEl.textContent = formatCurrency(data.result || 0);
      console.log('Updated Résultat Net:', formatCurrency(data.result || 0));
    }

  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
}

// Initialize dashboard
(function() {
  console.log('Dashboard initialization started');
  
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadDashboardData);
  } else {
    loadDashboardData();
  }
})();
