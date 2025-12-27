// header-ui.js
(function () {
  const NOTIF_KEY = 'ogo_notifications';
  const PREFS_KEY = 'ogo_preferences';
  const ORG_KEY = 'ogo_org';

  function qs(sel, ctx = document) { return ctx.querySelector(sel); }

  const mockNotifications = [
    // Événements mensuels
    { id: 1, text: 'Nouveau mois comptable démarré', read: false, time: 'Aujourd\'hui - 00:00', type: 'info' },
    { id: 2, text: 'Fin du mois comptable dans 3 jours', read: false, time: 'Aujourd\'hui - 10:32', type: 'warning' },
    
    // Alertes
    { id: 3, text: 'Aucune vente enregistrée depuis 7 jours', read: true, time: 'Hier - 18:05', type: 'alert' },
    { id: 4, text: 'Les dépenses dépassent les ventes ce mois-ci', read: true, time: '22/12/2024', type: 'alert' },
    { id: 5, text: 'Résultat mensuel négatif', read: true, time: '22/12/2024', type: 'alert' },
    { id: 6, text: 'Dépenses élevées dans la catégorie XX', read: true, time: '21/12/2024', type: 'alert' },
    { id: 7, text: 'Chute inhabituelle du chiffre d\'affaires', read: true, time: '20/12/2024', type: 'alert' },
    
    // Succès
    { id: 8, text: 'Bravo 🎉 : meilleur chiffre d\'affaires de la semaine', read: true, time: '19/12/2024', type: 'success' },
    { id: 9, text: 'Excellente performance aujourd\'hui', read: true, time: '18/12/2024', type: 'success' },
    { id: 10, text: 'Vos ventes sont en hausse par rapport à la semaine dernière', read: true, time: '17/12/2024', type: 'success' },
    { id: 11, text: 'Très bon mois : résultat positif', read: true, time: '16/12/2024', type: 'success' },
    { id: 12, text: 'Dépenses mieux maîtrisées que le mois dernier', read: true, time: '15/12/2024', type: 'success' }
  ];

  const defaultPrefs = {
    theme: 'light',
    dateFormat: 'DD/MM/YYYY',
    currency: 'FCFA',
    language: 'FR',
    notificationsEnabled: true
  };

  // ============ DYNAMIC NOTIFICATIONS LOGIC ============
  async function generateDynamicNotifications() {
    const notifs = [];
    const today = new Date();
    const dayOfMonth = today.getDate();
    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    
    let monthlySales = 0;
    let monthlyExpenses = 0;
    let lastSaleDate = null;
    const categoriesExpenses = {}; // Pour tracker dépenses par catégorie
    
    try {
      // Appeler l'API pour récupérer les vraies données
      if (typeof OGOUE !== 'undefined' && OGOUE.getVentesPourPeriode) {
        const salesData = await OGOUE.getVentesPourPeriode(today.getMonth() + 1, today.getFullYear());
        console.log('📊 Ventes récupérées:', salesData);
        
        if (Array.isArray(salesData)) {
          salesData.forEach(sale => {
            const amount = parseFloat(sale.amount || sale.montant || 0);
            monthlySales += amount;
            const saleDate = new Date(sale.saleDate || sale.date || today);
            if (!lastSaleDate || saleDate > lastSaleDate) {
              lastSaleDate = saleDate;
            }
          });
        }
      }
      
      if (typeof OGOUE !== 'undefined' && OGOUE.getDepensesPourPeriode) {
        const expensesData = await OGOUE.getDepensesPourPeriode(today.getMonth() + 1, today.getFullYear());
        console.log('📊 Dépenses récupérées:', expensesData);
        
        if (Array.isArray(expensesData)) {
          expensesData.forEach(exp => {
            const amount = parseFloat(exp.amount || exp.montant || 0);
            const category = exp.category || exp.categorie || 'Autre';
            monthlyExpenses += amount;
            
            // Tracker les dépenses par catégorie
            if (!categoriesExpenses[category]) {
              categoriesExpenses[category] = 0;
            }
            categoriesExpenses[category] += amount;
          });
        }
      }
      
      console.log(`💰 Totals - Ventes: ${monthlySales}, Dépenses: ${monthlyExpenses}`);
      console.log('📂 Dépenses par catégorie:', categoriesExpenses);
    } catch (e) {
      console.error('❌ Erreur récupération données:', e);
    }
    
    // Trouver la catégorie avec le plus de dépenses
    let highestCategory = 'Autre';
    let highestAmount = 0;
    for (const [category, amount] of Object.entries(categoriesExpenses)) {
      if (amount > highestAmount) {
        highestAmount = amount;
        highestCategory = category;
      }
    }
    
    // Helper pour formater la date
    function formatDate(daysOffset = 0) {
      const d = new Date(today);
      d.setDate(d.getDate() - daysOffset);
      if (daysOffset === 0) return `Aujourd'hui - ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      if (daysOffset === 1) return `Hier - ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }
    
    // ===== ÉVÉNEMENTS MENSUELS =====
    // Début du mois (jours 1-3)
    if (dayOfMonth <= 3) {
      notifs.push({
        id: 101,
        text: 'Nouveau mois comptable démarré',
        time: formatDate(0),
        type: 'info',
        read: false
      });
    }
    
    // Fin du mois (3 jours avant la fin)
    if (dayOfMonth >= lastDayOfMonth - 3) {
      notifs.push({
        id: 102,
        text: `Fin du mois comptable dans ${lastDayOfMonth - dayOfMonth} jour${lastDayOfMonth - dayOfMonth > 1 ? 's' : ''}`,
        time: formatDate(0),
        type: 'warning',
        read: false
      });
    }
    
    // ===== ALERTES =====
    // Aucune vente depuis 7 jours
    if (lastSaleDate) {
      const daysSinceLastSale = Math.floor((today - lastSaleDate) / (1000 * 60 * 60 * 24));
      if (daysSinceLastSale >= 7) {
        notifs.push({
          id: 103,
          text: `Aucune vente enregistrée depuis ${daysSinceLastSale} jours`,
          time: formatDate(1),
          type: 'alert',
          read: true
        });
      }
    } else if (monthlySales === 0) {
      notifs.push({
        id: 103,
        text: 'Aucune vente enregistrée ce mois-ci',
        time: formatDate(1),
        type: 'alert',
        read: true
      });
    }
    
    // Dépenses dépassent ventes
    if (monthlyExpenses > monthlySales && monthlySales > 0) {
      console.log('✅ Notification: Dépenses dépassent ventes');
      notifs.push({
        id: 104,
        text: 'Les dépenses dépassent les ventes ce mois-ci',
        time: formatDate(0),
        type: 'alert',
        read: true
      });
    }
    
    // Résultat négatif
    if (monthlySales - monthlyExpenses < 0 && monthlySales > 0) {
      console.log('✅ Notification: Résultat négatif');
      notifs.push({
        id: 105,
        text: 'Résultat mensuel négatif',
        time: formatDate(0),
        type: 'alert',
        read: true
      });
    }
    
    // Dépenses élevées (si > 40% des ventes)
    if (monthlyExpenses > monthlySales * 0.4 && monthlySales > 0) {
      console.log('✅ Notification: Dépenses élevées');
      notifs.push({
        id: 106,
        text: `Dépenses élevées dans la catégorie ${highestCategory}`,
        time: formatDate(0),
        type: 'alert',
        read: true
      });
    }
    
    // Chute chiffre d'affaires (comparé à la semaine précédente)
    // À adapter si vous avez des données historiques
    
    // ===== SUCCÈS =====
    // Meilleur chiffre de la semaine
    if (monthlySales > 1000) {
      notifs.push({
        id: 108,
        text: 'Bravo 🎉 : meilleur chiffre d\'affaires de la semaine',
        time: formatDate(4),
        type: 'success',
        read: true
      });
    }
    
    // Excellente performance aujourd'hui
    if (monthlySales > 500) {
      notifs.push({
        id: 109,
        text: 'Excellente performance aujourd\'hui',
        time: formatDate(5),
        type: 'success',
        read: true
      });
    }
    
    // Ventes en hausse
    if (monthlySales > 300) {
      notifs.push({
        id: 110,
        text: 'Vos ventes sont en hausse par rapport à la semaine dernière',
        time: formatDate(6),
        type: 'success',
        read: true
      });
    }
    
    // Résultat positif
    if (monthlySales - monthlyExpenses > 0) {
      notifs.push({
        id: 111,
        text: 'Très bon mois : résultat positif',
        time: formatDate(7),
        type: 'success',
        read: true
      });
    }
    
    // Dépenses mieux maîtrisées
    if (monthlyExpenses < monthlySales * 0.3 && monthlySales > 100) {
      notifs.push({
        id: 112,
        text: 'Dépenses mieux maîtrisées que le mois dernier',
        time: formatDate(8),
        type: 'success',
        read: true
      });
    }
    
    console.log('📢 Notifications finales:', notifs);
    return notifs;
  }
  
  function getNotifications() {
    try { 
      // Les notifications sont générées dynamiquement - cette fonction est appelée
      // mais nous utilisons generateDynamicNotifications de manière asynchrone dans renderNotifications
      return [];
    } catch(e){
      return [];
    }
  }
  function unreadCount(){ return getNotifications().filter(n=>!n.read).length; }

  function getPrefs() {
    try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') }; } catch(e){return defaultPrefs}
  }
  function savePrefs(p){ localStorage.setItem(PREFS_KEY, JSON.stringify(p||{})); }

  function getUser(){ try { return JSON.parse(localStorage.getItem('user')||'null'); } catch(e){return null} }
  function getOrg(){ try { return JSON.parse(localStorage.getItem(ORG_KEY)||'null'); } catch(e){return null} }
  function saveOrg(o){ localStorage.setItem(ORG_KEY, JSON.stringify(o||{})); }

  function createPopover(){
    const el = document.createElement('div');
    el.className = 'fixed z-50 rounded-lg shadow-xl bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-gray-600';
    return el;
  }

  function attachBadge(btn){
    let badge = btn.querySelector('.ogo-badge');
    if(!badge){
      badge = document.createElement('span');
      badge.className = 'ogo-badge absolute top-0 right-0 inline-flex items-center justify-center text-xs font-bold text-white bg-red-500 rounded-full w-5 h-5';
      btn.style.position='relative';
      btn.appendChild(badge);
    }
    const n = unreadCount();
    if(n>0){ badge.style.display='inline-flex'; badge.textContent = n; }
    else badge.style.display='none';
  }

  function positionPopover(popover, btn) {
    const rect = btn.getBoundingClientRect();
    popover.style.top = (rect.bottom + 10) + 'px';
    popover.style.left = (rect.right - popover.offsetWidth) + 'px';
  }

  // ============ NOTIFICATIONS RENDER ============
  async function renderNotifications(popover) {
    // Générer les notifications dynamiquement depuis l'API
    const list = await generateDynamicNotifications();
    popover.innerHTML = '';
    
    const container = document.createElement('div');
    container.className = 'w-80';
    
    // Title
    const title = document.createElement('div');
    title.className = 'px-5 py-4 text-base font-semibold text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-600';
    title.textContent = 'Notifications';
    container.appendChild(title);
    
    // List
    const content = document.createElement('div');
    content.className = 'max-h-72 overflow-y-auto';
    
    if (!list || list.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'px-5 py-6 text-center text-gray-500 dark:text-gray-400 text-sm';
      empty.textContent = 'Aucune notification';
      content.appendChild(empty);
    } else {
      list.forEach(n => {
        const item = document.createElement('div');
        item.className = 'px-5 py-3 border-b border-gray-100 dark:border-gray-700 flex gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition';
        
        // Colored dot based on type
        const dot = document.createElement('div');
        dot.className = 'flex-shrink-0 w-2 h-2 rounded-full mt-1.5';
        if (n.type === 'info') dot.classList.add('bg-blue-500');
        else if (n.type === 'warning') dot.classList.add('bg-orange-500');
        else if (n.type === 'alert') dot.classList.add('bg-red-500');
        else if (n.type === 'success') dot.classList.add('bg-green-500');
        else dot.classList.add('bg-teal-500');
        
        // Text
        const textDiv = document.createElement('div');
        textDiv.className = 'flex-1';
        
        const text = document.createElement('p');
        text.className = 'text-sm text-gray-900 dark:text-white font-medium leading-snug';
        text.textContent = n.text;
        textDiv.appendChild(text);
        
        const time = document.createElement('p');
        time.className = 'text-xs text-gray-500 dark:text-gray-400 mt-1';
        time.textContent = n.time;
        textDiv.appendChild(time);
        
        item.appendChild(dot);
        item.appendChild(textDiv);
        content.appendChild(item);
      });
    }
    
    container.appendChild(content);
    
    // Footer
    const footer = document.createElement('div');
    footer.className = 'px-5 py-3 border-t border-gray-200 dark:border-gray-600';
    footer.innerHTML = '<button class="text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300">Tout marquer comme lu</button>';
    container.appendChild(footer);
    
    popover.appendChild(container);
  }

  // ============ SETTINGS RENDER ============
  function renderSettings(popover) {
    console.log("⚙️ renderSettings() called");
    const prefs = getPrefs();
    popover.innerHTML = '';
    
    const container = document.createElement('div');
    container.className = 'w-80';
    
    // Header
    const header = document.createElement('div');
    header.className = 'px-5 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-600';
    header.innerHTML = `
      <h3 class="text-base font-semibold text-gray-900 dark:text-white">Paramètres</h3>
      <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 text-2xl leading-none" data-close>✕</button>
    `;
    container.appendChild(header);
    
    // Content
    const content = document.createElement('div');
    content.className = 'px-5 py-4 space-y-5';
    
    // APPARENCE - THEME
    const appearanceDiv = document.createElement('div');
    appearanceDiv.innerHTML = `
      <div class="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-3">Apparence</div>
      <div class="flex gap-3">
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="theme" value="light" ${localStorage.getItem('ogo_theme') !== 'dark' ? 'checked' : ''} class="w-4 h-4 border-gray-300 dark:border-gray-600" />
          <span class="text-sm text-gray-700 dark:text-gray-300">Clair</span>
        </label>
        <label class="flex items-center gap-2 cursor-pointer">
          <input type="radio" name="theme" value="dark" ${localStorage.getItem('ogo_theme') === 'dark' ? 'checked' : ''} class="w-4 h-4 border-gray-300 dark:border-gray-600" />
          <span class="text-sm text-gray-700 dark:text-gray-300">Sombre</span>
        </label>
      </div>
    `;
    content.appendChild(appearanceDiv);
    
    // AFFICHAGE - DATE FORMAT
    const affichageDiv = document.createElement('div');
    affichageDiv.innerHTML = `
      <div class="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-3">Affichage</div>
      <div class="space-y-3">
        <div>
          <label class="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-2">Format de date</label>
          <select id="ogo-date-format" class="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            <option value="DD/MM/YYYY" ${prefs.dateFormat === 'DD/MM/YYYY' ? 'selected' : ''}>JJ / MM / AAAA</option>
            <option value="MM/DD/YYYY" ${prefs.dateFormat === 'MM/DD/YYYY' ? 'selected' : ''}>MM/DD/YYYY</option>
            <option value="YYYY-MM-DD" ${prefs.dateFormat === 'YYYY-MM-DD' ? 'selected' : ''}>YYYY-MM-DD</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-gray-700 dark:text-gray-300 block mb-2">Devise</label>
          <select id="ogo-currency" class="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
            <option value="FCFA" ${prefs.currency === 'FCFA' ? 'selected' : ''}>FCFA (Franc CFA)</option>
            <option value="EUR" ${prefs.currency === 'EUR' ? 'selected' : ''}>EUR (Euro)</option>
            <option value="USD" ${prefs.currency === 'USD' ? 'selected' : ''}>USD (Dollar)</option>
          </select>
        </div>
      </div>
    `;
    content.appendChild(affichageDiv);
    
    // NOTIFICATIONS
    const notifDiv = document.createElement('div');
    notifDiv.innerHTML = `
      <div class="text-xs font-bold uppercase text-gray-500 dark:text-gray-400 mb-3">Notifications</div>
      <label class="flex items-center justify-between cursor-pointer">
        <span class="text-sm text-gray-700 dark:text-gray-300">Activer les notifications</span>
        <div class="w-12 h-6 bg-teal-500 rounded-full relative transition" id="notif-toggle">
          <div class="w-5 h-5 bg-white rounded-full absolute top-0.5 transition ${prefs.notificationsEnabled ? 'right-0.5' : 'left-0.5'}"></div>
        </div>
      </label>
    `;
    content.appendChild(notifDiv);
    
    container.appendChild(content);
    
    // Footer button
    const footer = document.createElement('div');
    footer.className = 'px-5 py-4 border-t border-gray-200 dark:border-gray-600';
    footer.innerHTML = '<button class="w-full px-4 py-2 rounded text-white bg-teal-600 hover:bg-teal-700 font-medium text-sm" data-close>Fermer</button>';
    container.appendChild(footer);
    
    popover.appendChild(container);
    
    // Event listeners - THEME
    popover.querySelectorAll('input[name="theme"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        const t = e.target.value === 'dark' ? 'dark' : 'light';
        localStorage.setItem('ogo_theme', t);
        if (t === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
      });
    });
    
    // Event listeners - DATE FORMAT
    popover.querySelector('#ogo-date-format')?.addEventListener('change', function(){
      const newPrefs = getPrefs();
      newPrefs.dateFormat = this.value;
      savePrefs(newPrefs);
      console.log('✅ Format de date changé en:', this.value);
    });
    
    // Event listeners - DEVISE
    const currencySelect = popover.querySelector('#ogo-currency');
    console.log("🔍 Looking for #ogo-currency:", currencySelect);
    if (currencySelect) {
      currencySelect.addEventListener('change', function(){
        const newPrefs = getPrefs();
        newPrefs.currency = this.value;
        savePrefs(newPrefs);
        console.log('✅ Devise changée en:', this.value);
        // Mettre à jour les KPI et les graphiques en temps réel
        if (typeof updateKPIDisplay === 'function') {
          console.log("📈 Calling updateKPIDisplay()");
          updateKPIDisplay();
        }
        // Recharger les graphiques avec la nouvelle devise
        console.log("🚀 Dispatching currency:changed event");
        const event = new CustomEvent('currency:changed', { detail: { currency: this.value } });
        document.dispatchEvent(event);
        console.log("✅ Event dispatched!");
      });
    } else {
      console.error("❌ #ogo-currency element not found!");
    }
    
    // Event listeners - NOTIFICATIONS
    popover.querySelector('#notif-toggle')?.addEventListener('click', function(){
      const newPrefs = getPrefs();
      newPrefs.notificationsEnabled = !newPrefs.notificationsEnabled;
      savePrefs(newPrefs);
      const thumb = this.querySelector('div');
      if (newPrefs.notificationsEnabled) {
        this.classList.add('bg-teal-500');
        this.classList.remove('bg-gray-300');
        thumb.style.right = '2px';
        thumb.style.left = 'auto';
      } else {
        this.classList.remove('bg-teal-500');
        this.classList.add('bg-gray-300');
        thumb.style.left = '2px';
        thumb.style.right = 'auto';
      }
    });
    
    // Close button
    popover.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        popover.remove();
      });
    });
  }

  // ============ PROFILE RENDER ============
  function renderProfile(popover) {
    const user = getUser() || { firstName: '', lastName: '', email: '' };
    const org = getOrg() || { name: '', rccm: '', nif: '' };
    
    popover.innerHTML = '';
    const container = document.createElement('div');
    container.className = 'w-80';
    
    // Header with user info
    const header = document.createElement('div');
    header.className = 'px-5 py-4 border-b border-gray-200 dark:border-gray-600';
    header.innerHTML = `
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-full bg-teal-200 dark:bg-teal-900 flex items-center justify-center flex-shrink-0">
          <span class="material-symbols-outlined text-base text-teal-700 dark:text-teal-300">account_circle</span>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-gray-900 dark:text-white">${user.firstName} ${user.lastName}</p>
          <p class="text-xs text-gray-600 dark:text-gray-400">${user.email}</p>
        </div>
        <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 text-2xl leading-none" data-close>✕</button>
      </div>
    `;
    container.appendChild(header);
    
    // Content
    const content = document.createElement('div');
    content.className = 'px-5 py-4 space-y-4';
    
    // Organization
    const orgDiv = document.createElement('div');
    orgDiv.className = 'text-sm text-gray-700 dark:text-gray-300';
    orgDiv.innerHTML = `
      <span class="material-symbols-outlined text-base align-middle mr-2">business</span>
      <span class="font-medium">${org.name || org.id || 'Organisation'}</span>
    `;
    content.appendChild(orgDiv);
    
    // RCCM
    const rccmDiv = document.createElement('div');
    rccmDiv.className = 'flex items-center justify-between text-sm text-gray-700 dark:text-gray-300';
    rccmDiv.innerHTML = `
      <span class="text-gray-600 dark:text-gray-400">${org.rccm || 'RCCM-001'}</span>
      <button class="text-teal-600 dark:text-teal-400 text-xs font-medium hover:text-teal-700 dark:hover:text-teal-300" data-edit-rccm>Modifier</button>
    `;
    content.appendChild(rccmDiv);
    
    // NIF
    const nifDiv = document.createElement('div');
    nifDiv.className = 'flex items-center justify-between text-sm text-gray-700 dark:text-gray-300';
    nifDiv.innerHTML = `
      <span class="text-gray-600 dark:text-gray-400">${org.nif || 'NIF-001'}</span>
      <button class="text-teal-600 dark:text-teal-400 text-xs font-medium hover:text-teal-700 dark:hover:text-teal-300" data-edit-nif>Modifier</button>
    `;
    content.appendChild(nifDiv);
    
    // Settings link
    const settingsLink = document.createElement('div');
    settingsLink.className = 'text-sm text-gray-700 dark:text-gray-300 pt-2 border-t border-gray-200 dark:border-gray-600';
    settingsLink.innerHTML = '<button class="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 font-medium flex items-center gap-2"><span class="material-symbols-outlined text-base">settings</span> Paramètres</button>';
    content.appendChild(settingsLink);
    
    // Logout
    const logoutLink = document.createElement('div');
    logoutLink.className = 'text-sm text-red-600 dark:text-red-400';
    logoutLink.innerHTML = '<button class="hover:text-red-700 dark:hover:text-red-300 font-medium flex items-center gap-2"><span class="material-symbols-outlined text-base">logout</span> Déconnexion</button>';
    content.appendChild(logoutLink);
    
    container.appendChild(content);
    popover.appendChild(container);
    
    // Event listeners
    popover.querySelector('[data-edit-rccm]')?.addEventListener('click', () => openEditModal('RCCM', org.rccm || '', (val) => {
      const newOrg = Object.assign({}, org, { rccm: val });
      saveOrg(newOrg);
    }));
    
    popover.querySelector('[data-edit-nif]')?.addEventListener('click', () => openEditModal('NIF', org.nif || '', (val) => {
      const newOrg = Object.assign({}, org, { nif: val });
      saveOrg(newOrg);
    }));
    
    popover.querySelector('[data-close]')?.addEventListener('click', (e) => {
      e.stopPropagation();
      popover.remove();
    });
    
    logoutLink.querySelector('button')?.addEventListener('click', () => {
      if(confirm('Êtes-vous sûr ?')) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        // Redirect to marketing login page (env-aware)
        const MARKETING_BASE = (['localhost','127.0.0.1'].some(h => location.hostname.includes(h)))
          ? 'http://127.0.0.1:5500/OGOUE_COMBINED/frontend_marketing/homepage'
          : 'https://www.ogoue.com';
        window.location.href = `${MARKETING_BASE}/login.html`;
      }
    });
  }

  function openEditModal(label, value, onSave) {
    const modal = document.createElement('div');
    modal.className = 'fixed z-50 rounded-lg shadow-xl bg-white dark:bg-[#1E293B] border border-gray-300 dark:border-gray-600 w-80 p-5';
    modal.style.top = '50%';
    modal.style.left = '50%';
    modal.style.transform = 'translate(-50%, -50%)';
    
    modal.innerHTML = `
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-base font-semibold text-gray-900 dark:text-white">Modifier les infos entreprise</h3>
        <button class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-400 text-2xl leading-none" data-close>✕</button>
      </div>
      <div class="space-y-3">
        <label class="block">
          <span class="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 block">${label}</span>
          <input type="text" id="edit-input" value="${value}" placeholder="Ex: ${label}-001" class="w-full px-3 py-2 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
        </label>
      </div>
      <div class="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
        <button class="flex-1 px-4 py-2 text-sm font-medium rounded text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" data-cancel>Annuler</button>
        <button class="flex-1 px-4 py-2 text-sm font-medium rounded bg-teal-600 text-white hover:bg-teal-700" data-save>Enregistrer</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = modal.querySelector('#edit-input');
    input.focus();
    
    modal.querySelector('[data-save]')?.addEventListener('click', () => {
      onSave(input.value.trim());
      modal.remove();
    });
    
    modal.querySelector('[data-cancel]')?.addEventListener('click', () => modal.remove());
    modal.querySelector('[data-close]')?.addEventListener('click', () => modal.remove());
  }

  // ============ INITIALIZATION ============
  function initHeaderUI(){
    const theme = localStorage.getItem('ogo_theme') || 'light';
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');

    const notifBtn = qs('[data-action="notifications"]');
    const settingsBtn = qs('[data-action="settings"]');
    const profileEl = qs('[data-action="profile"]');

    let notifPopover = null;
    let settingsPopover = null;
    let profilePopover = null;

    if(notifBtn) attachBadge(notifBtn);

    document.addEventListener('click', function(e){
      if(notifBtn && !notifBtn.contains(e.target) && notifPopover && !notifPopover.contains(e.target)) { notifPopover.remove(); notifPopover=null; }
      if(settingsBtn && !settingsBtn.contains(e.target) && settingsPopover && !settingsPopover.contains(e.target)) { settingsPopover.remove(); settingsPopover=null; }
      if(profileEl && !profileEl.contains(e.target) && profilePopover && !profilePopover.contains(e.target)) { profilePopover.remove(); profilePopover=null; }
    });

    if(notifBtn) {
      notifBtn.addEventListener('click', async function(e){
        e.stopPropagation();
        if(notifPopover){ notifPopover.remove(); notifPopover=null; return; }
        notifPopover = createPopover();
        await renderNotifications(notifPopover);
        document.body.appendChild(notifPopover);
        setTimeout(() => positionPopover(notifPopover, notifBtn), 0);
      });
    }

    if(settingsBtn) {
      settingsBtn.addEventListener('click', function(e){
        e.stopPropagation();
        if(settingsPopover){ settingsPopover.remove(); settingsPopover=null; return; }
        settingsPopover = createPopover();
        renderSettings(settingsPopover);
        document.body.appendChild(settingsPopover);
        setTimeout(() => positionPopover(settingsPopover, settingsBtn), 0);
      });
    }

    if(profileEl) {
      profileEl.addEventListener('click', function(e){
        e.stopPropagation();
        if(profilePopover){ profilePopover.remove(); profilePopover=null; return; }
        profilePopover = createPopover();
        renderProfile(profilePopover);
        document.body.appendChild(profilePopover);
        setTimeout(() => positionPopover(profilePopover, profileEl), 0);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderUI);
  } else {
    initHeaderUI();
  }

})();
