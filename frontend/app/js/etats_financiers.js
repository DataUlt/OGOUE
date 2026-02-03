// js/etats_financiers.js

document.addEventListener("DOMContentLoaded", function () {
    const btn = document.getElementById("dateFilterButton");
    const panel = document.getElementById("dateFilterPanel");
    const labelSpan = document.getElementById("dateFilterLabel");
    const calendarGrid = document.getElementById("calendarGrid");
    const monthLabel = document.getElementById("monthLabel");
    const prevMonthBtn = document.getElementById("prevMonth");
    const nextMonthBtn = document.getElementById("nextMonth");
    const resetBtn = document.getElementById("resetRange");
    const closeBtn = document.getElementById("closeCalendar");

    if (!btn || !panel) return;

    const monthNames = [
        "janvier", "février", "mars", "avril", "mai", "juin",
        "juillet", "août", "septembre", "octobre", "novembre", "décembre"
    ];

    let current = new Date();
    let startDate = null;
    let endDate = null;

    function pad(n) {
        return n.toString().padStart(2, "0");
    }

    /**
     * Obtient la date locale au format YYYY-MM-DD (sans conversion UTC)
     */
    function getLocalDateString(date) {
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        return `${year}-${month}-${day}`;
    }

    function formatDateFR(isoStr) {
        if (!isoStr) return "";
        const [y, m, d] = isoStr.split("-");
        return `${d}/${m}/${y}`;
    }

    function formatHeureGabon(dateObj) {
        if (!dateObj || isNaN(dateObj.getTime())) return "-";
        // Ajouter 1 heure pour le fuseau horaire du Gabon (UTC+1)
        dateObj.setHours(dateObj.getHours() + 1);
        return dateObj.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    }

    function getDaysInMonth(year, monthIndex) {
        return new Date(year, monthIndex + 1, 0).getDate();
    }

    function renderCalendar() {
        const year = current.getFullYear();
        const month = current.getMonth();
        monthLabel.textContent = `${monthNames[month]} ${year}`;

        calendarGrid.innerHTML = "";

        const firstDay = new Date(year, month, 1).getDay(); // 0 = dimanche
        const offset = (firstDay + 6) % 7; // semaine qui commence le lundi

        // Cases vides avant le 1er du mois
        for (let i = 0; i < offset; i++) {
            const emptyCell = document.createElement("div");
            calendarGrid.appendChild(emptyCell);
        }

        const daysInMonth = getDaysInMonth(year, month);
        for (let day = 1; day <= daysInMonth; day++) {
            const btnDay = document.createElement("button");
            const isoDate = `${year}-${pad(month + 1)}-${pad(day)}`;

            btnDay.textContent = day;
            btnDay.dataset.date = isoDate;
            btnDay.type = "button";

            btnDay.className =
                "h-9 rounded-full flex items-center justify-center text-sm " +
                "hover:bg-background-light dark:hover:bg-background-dark " +
                "text-[#0d1b19] dark:text-gray-100";

            // Sélection visuelle si une plage est choisie
            if (startDate && !endDate && isoDate === startDate) {
                btnDay.classList.add("bg-primary", "text-[#0d1b19]");
            }

            if (startDate && endDate) {
                if (isoDate === startDate || isoDate === endDate) {
                    btnDay.classList.add("bg-primary", "text-[#0d1b19]");
                } else if (isoDate > startDate && isoDate < endDate) {
                    btnDay.classList.add(
                        "bg-primary/10",
                        "text-[#0d1b19]",
                        "dark:text-gray-100"
                    );
                }
            }

            btnDay.addEventListener("click", () => handleDayClick(isoDate));
            calendarGrid.appendChild(btnDay);
        }
    }

    function handleDayClick(isoDate) {
        if (!startDate || (startDate && endDate)) {
            // on (re)commence une nouvelle sélection
            startDate = isoDate;
            endDate = null;
        } else if (startDate && !endDate) {
            if (isoDate < startDate) {
                endDate = startDate;
                startDate = isoDate;
            } else if (isoDate === startDate) {
                // on annule la plage, ne garde qu'une date
                endDate = null;
            } else {
                endDate = isoDate;
            }
        }

        updateLabel();
        renderCalendar();
    }

    function updateLabel() {
        if (startDate && endDate) {
            labelSpan.textContent = `${formatDateFR(startDate)} - ${formatDateFR(endDate)}`;
        } else if (startDate) {
            labelSpan.textContent = formatDateFR(startDate);
        } else {
            labelSpan.textContent = "Choisir une date";
        }
    }

    function setTodayDefault() {
        const today = new Date();
        // Sélectionner du premier jour du mois jusqu'à aujourd'hui
        const year = today.getFullYear();
        const month = today.getMonth();
        
        // Premier jour du mois (LOCAL, pas UTC)
        const firstDay = new Date(year, month, 1);
        const isoFirst = getLocalDateString(firstDay);
        
        // Aujourd'hui (LOCAL, pas UTC)
        const isoToday = getLocalDateString(today);
        
        startDate = isoFirst;
        endDate = isoToday;
        current = new Date(year, month, 1);
        updateLabel();
        renderCalendar();
    }

    // Valeur par défaut : aujourd'hui
    setTodayDefault();

    // Ouverture / fermeture du panel
    btn.addEventListener("click", () => {
        panel.classList.toggle("hidden");
    });

    prevMonthBtn.addEventListener("click", () => {
        current.setMonth(current.getMonth() - 1);
        renderCalendar();
    });

    nextMonthBtn.addEventListener("click", () => {
        current.setMonth(current.getMonth() + 1);
        renderCalendar();
    });

    resetBtn.addEventListener("click", () => {
        setTodayDefault();
    });

    closeBtn.addEventListener("click", () => {
        panel.classList.add("hidden");
    });

    document.addEventListener("click", (e) => {
        if (!panel.contains(e.target) && !btn.contains(e.target)) {
            panel.classList.add("hidden");
        }
    });

    // ═════════════════════════════════════════════════════════════════════
    // 🎯 LOGIQUE DES ÉTATS FINANCIERS
    // ═════════════════════════════════════════════════════════════════════

    // Initialiser le stockage des données d'impression
    if (!window.etatFinanciersData) {
        window.etatFinanciersData = {};
    }

    /**
     * Filtre les données par plage de date (startDate, endDate)
     * Compare les parties date uniquement (YYYY-MM-DD) pour éviter les problèmes de fuseau
     */
    function filterByDateRange(items) {
        if (!startDate) return items;
        
        console.log(`🔎 Filtre par dates: ${startDate} à ${endDate || startDate}`);
        
        return items.filter(item => {
            const dateStr = item.date || item.saleDate || item.expenseDate;
            if (!dateStr) return false;

            // Convertir en objet Date puis obtenir la date locale YYYY-MM-DD
            const parsed = new Date(dateStr);
            const itemDatePart = getLocalDateString(parsed); // ex: "2025-12-21"

            // Comparer les dates (inclusives)
            const isAfterOrEqual = itemDatePart >= startDate;
            const isBeforeOrEqual = endDate ? itemDatePart <= endDate : itemDatePart === startDate;
            const isInRange = isAfterOrEqual && isBeforeOrEqual;

            if (items.length <= 20) {
                console.log(`  📅 ${dateStr} → local: ${itemDatePart} | inRange: ${isInRange}`);
            }

            return isInRange;
        });
    }

    /**
     * Génère le Compte de Résultat simplifié
     */
    function generateCompteDeResultat(ventes, depenses) {
        const totalVentes = ventes.reduce((sum, v) => {
            const montant = parseFloat(v.montant) || 0;
            return sum + montant;
        }, 0);
        
        // Regrouper les dépenses par catégorie
        const depensesByCategory = {};
        depenses.forEach(d => {
            const cat = d.categorie || "Autres";
            const montant = parseFloat(d.montant) || 0;
            depensesByCategory[cat] = (depensesByCategory[cat] || 0) + montant;
        });
        
        const totalDepenses = Object.values(depensesByCategory).reduce((sum, v) => sum + v, 0);
        const resultat = totalVentes - totalDepenses;
        
        console.log(`💰 Totaux: Ventes=${totalVentes}, Dépenses=${totalDepenses}, Résultat=${resultat}`);
        
        return {
            totalVentes,
            depensesByCategory,
            totalDepenses,
            resultat
        };
    }

    /**
     * Génère le Tableau de Flux de Trésorerie
     */
    function generateTableauDeFlux(ventes, depenses) {
        const fluxEntrants = ventes.reduce((sum, v) => sum + (parseFloat(v.montant) || 0), 0);
        const fluxSortants = depenses.reduce((sum, d) => sum + (parseFloat(d.montant) || 0), 0);
        const fluxNet = fluxEntrants - fluxSortants;
        
        // Regrouper par moyen de paiement
        const ventesByPayment = {};
        ventes.forEach(v => {
            const method = v.moyen_paiement || "cash";
            const montant = parseFloat(v.montant) || 0;
            ventesByPayment[method] = (ventesByPayment[method] || 0) + montant;
        });
        
        const depensesByPayment = {};
        depenses.forEach(d => {
            const method = d.moyen_paiement || "cash";
            const montant = parseFloat(d.montant) || 0;
            depensesByPayment[method] = (depensesByPayment[method] || 0) + montant;
        });
        
        return {
            fluxEntrants,
            fluxSortants,
            fluxNet,
            ventesByPayment,
            depensesByPayment
        };
    }

    /**
     * Crée le HTML pour le Compte de Résultat avec synchronisation ligne par ligne
     */
    function renderCompteDeResultat(data) {
        // Catégories d'exploitation
        const exploitationCategories = [
            "Achats / Stocks", "Salaires", "Loyer", "Marketing", "Électricité",
            "Eau", "Internet & Télécom", "Transport & Logistique", "Impôts & Taxes", "Entretien & Maintenance"
        ];

        // Calculer les montants
        let chargesExploitation = 0;
        const chargesExploitationItems = [];
        
        exploitationCategories.forEach(cat => {
            const amount = data.depensesByCategory[cat] || 0;
            if (amount > 0) {
                chargesExploitation += amount;
                chargesExploitationItems.push({ label: cat, amount });
            }
        });

        const chargesFinancieres = data.depensesByCategory["Intérêt des emprunts"] || 0;
        const chargesExceptionnelles = (data.depensesByCategory["Amendes"] || 0) + 
                                      (data.depensesByCategory["Autres"] || 0);
        const impotsBenefices = data.depensesByCategory["Impôts sur les bénéfices"] || 0;
        const totalCharges = data.totalDepenses;
        const totalProduits = data.totalVentes;
        const resultat = data.resultat;
        
        const isBenefice = resultat >= 0;
        const resultLabel = isBenefice ? "Bénéfice" : "Perte";
        const resultAmount = Math.abs(resultat);
        const totalGeneral = totalProduits;

        // Construire les lignes synchronisées
        const maxExploitationItems = Math.max(chargesExploitationItems.length, 1);
        
        return `
            <div id="compte-resultat" class="mt-4">
                <style>
                    /* Forcer une hauteur minimale uniforme par ligne (Charge ↔ Produit) */
                    #compte-resultat .grid.grid-cols-2 > div { min-height: 48px; display: flex; align-items: center; }
                    /* Styles pour impression */
                    @media print {
                        #compte-resultat { page-break-inside: avoid; }
                        #compte-resultat .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
                        #compte-resultat .border { border: 1px solid #fed7aa; }
                        #compte-resultat .border-orange-300 { border-color: #fed7aa; }
                        #compte-resultat .border-teal-300 { border-color: #99f6e4; }
                        #compte-resultat .bg-orange-100 { background-color: #ffedd5; }
                        #compte-resultat .bg-orange-200 { background-color: #fed7aa; }
                        #compte-resultat .bg-orange-700 { background-color: #b45309; color: white !important; }
                        #compte-resultat .bg-orange-800 { background-color: #7c2d12 !important; color: white !important; }
                        #compte-resultat .bg-orange-900 { background-color: #431407 !important; color: white !important; }
                        #compte-resultat .bg-teal-100 { background-color: #ccfbf1; }
                        #compte-resultat .bg-teal-200 { background-color: #99f6e4; }
                        #compte-resultat .bg-teal-700 { background-color: #0d9488; color: white !important; }
                        #compte-resultat .bg-teal-800 { background-color: #134e4a !important; color: white !important; }
                        #compte-resultat .bg-teal-900 { background-color: #0f2f2d !important; color: white !important; }
                        #compte-resultat .text-white { color: white !important; }
                        #compte-resultat .text-green-600 { color: #16a34a; }
                        #compte-resultat .text-red-600 { color: #dc2626; }
                        #compte-resultat .font-semibold { font-weight: 600; }
                        #compte-resultat .font-bold { font-weight: 700; }
                        #compte-resultat .px-4 { padding-left: 1rem; padding-right: 1rem; }
                        #compte-resultat .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
                        #compte-resultat .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
                        #compte-resultat .text-right { text-align: right; }
                        #compte-resultat .text-center { text-align: center; }
                        #compte-resultat .text-sm { font-size: 0.875rem; }
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                </style>
                <div class="grid grid-cols-2 gap-4">
                    <!-- COLONNE GAUCHE: CHARGES -->
                    <div class="border border-orange-300">
                        <div class="bg-orange-700 text-white px-4 py-3 font-bold text-center">Charges</div>
                        <div class="text-sm">
                            <div class="grid grid-cols-2 bg-orange-100"><div class="px-4 py-2 font-semibold">Charges d'exploitation</div><div class="px-4 py-2 text-right"></div></div>
                            ${chargesExploitationItems.map(item => `<div class="grid grid-cols-2"><div class="px-4 py-2">${item.label}</div><div class="px-4 py-2 text-right">${item.amount.toFixed(2).replace('.', ',')} FCFA</div></div>`).join('')}
                            <div class="grid grid-cols-2 bg-orange-200 font-semibold"><div class="px-4 py-2">Total charges d'exploitation</div><div class="px-4 py-2 text-right">${chargesExploitation.toFixed(2).replace('.', ',')} FCFA</div></div>
                            
                            <div class="grid grid-cols-2 bg-orange-100"><div class="px-4 py-2 font-semibold">Charges financières</div><div class="px-4 py-2 text-right"></div></div>
                            ${chargesFinancieres > 0 ? `<div class="grid grid-cols-2"><div class="px-4 py-2">Intérêts des emprunts</div><div class="px-4 py-2 text-right">${chargesFinancieres.toFixed(2).replace('.', ',')} FCFA</div></div>` : ''}
                            <div class="grid grid-cols-2 bg-orange-200 font-semibold"><div class="px-4 py-2">Total charges financières</div><div class="px-4 py-2 text-right">${chargesFinancieres.toFixed(2).replace('.', ',')} FCFA</div></div>
                            
                            <div class="grid grid-cols-2 bg-orange-100"><div class="px-4 py-2 font-semibold">Charges exceptionnelles</div><div class="px-4 py-2 text-right"></div></div>
                            ${chargesExceptionnelles > 0 ? `<div class="grid grid-cols-2"><div class="px-4 py-2">Amendes et autres charges</div><div class="px-4 py-2 text-right">${chargesExceptionnelles.toFixed(2).replace('.', ',')} FCFA</div></div>` : ''}
                            <div class="grid grid-cols-2 bg-orange-200 font-semibold"><div class="px-4 py-2">Total charges exceptionnelles</div><div class="px-4 py-2 text-right">${chargesExceptionnelles.toFixed(2).replace('.', ',')} FCFA</div></div>
                            
                            ${impotsBenefices > 0 ? `<div class="grid grid-cols-2 bg-orange-100"><div class="px-4 py-2 font-semibold">Impôts sur les bénéfices</div><div class="px-4 py-2 text-right">${impotsBenefices.toFixed(2).replace('.', ',')} FCFA</div></div>` : ''}
                            
                            <div class="grid grid-cols-2 bg-orange-800 text-white font-bold"><div class="px-4 py-2">Total des charges</div><div class="px-4 py-2 text-right">${totalCharges.toFixed(2).replace('.', ',')} FCFA</div></div>
                            
                            ${isBenefice ? `<div class="grid grid-cols-2 bg-orange-100"><div class="px-4 py-2 font-semibold">${resultLabel}</div><div class="px-4 py-2 text-right font-semibold text-green-600">${resultAmount.toFixed(2).replace('.', ',')} FCFA</div></div>` : ''}
                            
                            <div class="grid grid-cols-2 bg-orange-900 text-white font-bold"><div class="px-4 py-2">Total général</div><div class="px-4 py-2 text-right">${totalGeneral.toFixed(2).replace('.', ',')} FCFA</div></div>
                        </div>
                    </div>

                    <!-- COLONNE DROITE: PRODUITS -->
                    <div class="border border-teal-300">
                        <div class="bg-teal-700 text-white px-4 py-3 font-bold text-center">Produits</div>
                        <div class="text-sm">
                            <div class="grid grid-cols-2 bg-teal-100"><div class="px-4 py-2 font-semibold">Produits d'exploitation</div><div class="px-4 py-2 text-right"></div></div>
                            <div class="grid grid-cols-2"><div class="px-4 py-2">Ventes de produits/services</div><div class="px-4 py-2 text-right">${totalProduits.toFixed(2).replace('.', ',')} FCFA</div></div>
                            ${Array(Math.max(0, chargesExploitationItems.length - 1)).fill(0).map(() => `<div class="grid grid-cols-2"><div class="px-4 py-5"></div><div class="px-4 py-5 text-right"></div></div>`).join('')}
                            <div class="grid grid-cols-2 bg-teal-200 font-semibold"><div class="px-4 py-2">Total produits d'exploitation</div><div class="px-4 py-2 text-right">${totalProduits.toFixed(2).replace('.', ',')} FCFA</div></div>
                            
                            <div class="grid grid-cols-2 bg-teal-100"><div class="px-4 py-2 font-semibold">Produits financiers</div><div class="px-4 py-2 text-right"></div></div>
                            ${chargesFinancieres > 0 ? `<div class="grid grid-cols-2"><div class="px-4 py-2"></div><div class="px-4 py-2 text-right"></div></div>` : ''}
                            <div class="grid grid-cols-2 bg-teal-200 font-semibold"><div class="px-4 py-2">Total produits financiers</div><div class="px-4 py-2 text-right">0.00 FCFA</div></div>
                            
                            <div class="grid grid-cols-2 bg-teal-100"><div class="px-4 py-2 font-semibold">Produits exceptionnels</div><div class="px-4 py-2 text-right"></div></div>
                            ${chargesExceptionnelles > 0 ? `<div class="grid grid-cols-2"><div class="px-4 py-2"></div><div class="px-4 py-2 text-right"></div></div>` : ''}
                            <div class="grid grid-cols-2 bg-teal-200 font-semibold"><div class="px-4 py-2">Total produits exceptionnels</div><div class="px-4 py-2 text-right">0.00 FCFA</div></div>
                            
                            ${!isBenefice ? `<div class="grid grid-cols-2 bg-teal-100"><div class="px-4 py-2 font-semibold">${resultLabel}</div><div class="px-4 py-2 text-right font-semibold text-red-600">${resultAmount.toFixed(2).replace('.', ',')} FCFA</div></div>` : ''}
                            
                            <div class="grid grid-cols-2 bg-teal-800 text-white font-bold"><div class="px-4 py-2">Total des produits</div><div class="px-4 py-2 text-right">${totalProduits.toFixed(2).replace('.', ',')} FCFA</div></div>
                            
                            <div class="grid grid-cols-2 bg-teal-900 text-white font-bold"><div class="px-4 py-2">Total général</div><div class="px-4 py-2 text-right">${totalGeneral.toFixed(2).replace('.', ',')} FCFA</div></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Crée le HTML pour le Tableau de Flux
     */
    function renderTableauDeFlux(data) {
        let html = `
            <div class="mt-4 overflow-x-auto rounded-lg border border-[#cfe7e3] dark:border-gray-700">
                <table class="w-full text-sm">
                    <tbody>
                        <tr class="border-b border-[#cfe7e3] dark:border-gray-700 bg-background-light dark:bg-background-dark">
                            <td class="px-4 py-3 font-semibold">Flux Entrants (Ventes)</td>
                            <td class="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">${data.fluxEntrants.toFixed(2)} FCFA</td>
                        </tr>
        `;
        
        // Détails des moyens de paiement entrants
        Object.entries(data.ventesByPayment).forEach(([method, amount]) => {
            html += `
                        <tr class="border-b border-[#cfe7e3] dark:border-gray-700">
                            <td class="px-4 py-3">&nbsp;&nbsp;${method}</td>
                            <td class="px-4 py-3 text-right">${amount.toFixed(2)} FCFA</td>
                        </tr>
            `;
        });
        
        html += `
                        <tr class="border-b border-[#cfe7e3] dark:border-gray-700 bg-background-light dark:bg-background-dark">
                            <td class="px-4 py-3 font-semibold">Flux Sortants (Dépenses)</td>
                            <td class="px-4 py-3 text-right font-semibold text-red-600 dark:text-red-400">${data.fluxSortants.toFixed(2)} FCFA</td>
                        </tr>
        `;
        
        // Détails des moyens de paiement sortants
        Object.entries(data.depensesByPayment).forEach(([method, amount]) => {
            html += `
                        <tr class="border-b border-[#cfe7e3] dark:border-gray-700">
                            <td class="px-4 py-3">&nbsp;&nbsp;${method}</td>
                            <td class="px-4 py-3 text-right">${amount.toFixed(2)} FCFA</td>
                        </tr>
            `;
        });
        
        html += `
                        <tr class="border-b border-[#cfe7e3] dark:border-gray-700 ${data.fluxNet >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}">
                            <td class="px-4 py-3 font-bold">Flux Net</td>
                            <td class="px-4 py-3 text-right font-bold ${data.fluxNet >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}">
                                ${data.fluxNet.toFixed(2)} FCFA
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;
        
        return html;
    }

    /**
     * Crée le HTML pour l'Historique des Ventes
     */
    function renderHistoriqueVentes(ventes) {
        if (ventes.length === 0) {
            return '<p class="mt-4 text-sm text-gray-500 dark:text-gray-400">Aucune vente pour cette période.</p>';
        }
        
        let html = `
            <div class="mt-4 overflow-x-auto rounded-lg border border-[#cfe7e3] dark:border-gray-700">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="bg-background-light dark:bg-background-dark border-b border-[#cfe7e3] dark:border-gray-700">
                            <th class="px-4 py-3 text-left font-semibold">Date</th>
                            <th class="px-4 py-3 text-left font-semibold">Heure</th>
                            <th class="px-4 py-3 text-left font-semibold">Produit</th>
                            <th class="px-4 py-3 text-center font-semibold">Quantité</th>
                            <th class="px-4 py-3 text-right font-semibold">Montant</th>
                            <th class="px-4 py-3 text-left font-semibold">Moyen Paiement</th>
                            <th class="px-4 py-3 text-left font-semibold">Type</th>
                            <th class="px-4 py-3 text-left font-semibold">Créé par</th>
                            <th class="px-4 py-3 text-left font-semibold">Justificatif</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        ventes.forEach(v => {
            const rawDate = v.date || v.saleDate || v.sale_date || "";
            const localDate = rawDate ? getLocalDateString(new Date(rawDate)) : "";
            const heure = v.created_at ? formatHeureGabon(new Date(v.created_at)) : "-";
            const produit = v.description || "-";
            const quantite = v.quantite || 1;
            const montantNum = parseFloat(v.montant) || 0;
            const paiement = v.moyen_paiement || v.moyenPaiement || "-";
            const type = v.type_vente === "produits" ? "Produits" : v.type_vente === "services" ? "Service" : v.type_vente || "-";
            const creePar = v.created_by_name || "-";
            const justificatif = v.justificatif || v.receipt || "-";
            const justificatifUrl = v.justificatifUrl || v.receiptUrl || "";
            const justificatifHtml = justificatif !== "-"
              ? `<span class="font-medium text-primary cursor-pointer hover:underline justificatif-link" data-file="${justificatif}" data-url="${justificatifUrl}">${justificatif}</span>`
              : "-";

            html += `
                        <tr class="border-b border-[#cfe7e3] dark:border-gray-700">
                            <td class="px-4 py-3">${formatDateFR(localDate)}</td>
                            <td class="px-4 py-3">${heure}</td>
                            <td class="px-4 py-3">${produit}</td>
                            <td class="px-4 py-3 text-center">${quantite}</td>
                            <td class="px-4 py-3 text-right font-semibold">${montantNum.toFixed(2).replace('.', ',')} FCFA</td>
                            <td class="px-4 py-3">${paiement}</td>
                            <td class="px-4 py-3">${type}</td>
                            <td class="px-4 py-3">${creePar}</td>
                            <td class="px-4 py-3 text-xs">${justificatifHtml}</td>
                        </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        return html;
    }

    /**
     * Crée le HTML pour l'Historique des Dépenses
     */
    function renderHistoriqueDepenses(depenses) {
        if (depenses.length === 0) {
            return '<p class="mt-4 text-sm text-gray-500 dark:text-gray-400">Aucune dépense pour cette période.</p>';
        }
        
        let html = `
            <div class="mt-4 overflow-x-auto rounded-lg border border-[#cfe7e3] dark:border-gray-700">
                <table class="w-full text-sm">
                    <thead>
                        <tr class="bg-background-light dark:bg-background-dark border-b border-[#cfe7e3] dark:border-gray-700">
                            <th class="px-4 py-3 text-left font-semibold">Date</th>
                            <th class="px-4 py-3 text-left font-semibold">Heure</th>
                            <th class="px-4 py-3 text-left font-semibold">Catégorie</th>
                            <th class="px-4 py-3 text-right font-semibold">Montant</th>
                            <th class="px-4 py-3 text-left font-semibold">Moyen Paiement</th>
                            <th class="px-4 py-3 text-left font-semibold">Créé par</th>
                            <th class="px-4 py-3 text-left font-semibold">Justificatif</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        depenses.forEach(d => {
            const rawDate = d.date || d.expenseDate || "";
            const localDate = rawDate ? getLocalDateString(new Date(rawDate)) : "";
            const heure = d.created_at ? formatHeureGabon(new Date(d.created_at)) : "-";
            const categorie = d.categorie || d.category || "-";
            const montantNum = parseFloat(d.montant) || 0;
            const paiement = d.moyen_paiement || d.moyenPaiement || "-";
            const creePar = d.created_by_name || "-";
            const justificatif = d.justificatif || "-";
            const justificatifUrl = d.justificatifUrl || "";
            const justificatifHtml = justificatif !== "-"
              ? `<span class="font-medium text-primary cursor-pointer hover:underline justificatif-link" data-file="${justificatif}" data-url="${justificatifUrl}">${justificatif}</span>`
              : "-";

            html += `
                        <tr class="border-b border-[#cfe7e3] dark:border-gray-700">
                            <td class="px-4 py-3">${formatDateFR(localDate)}</td>
                            <td class="px-4 py-3">${heure}</td>
                            <td class="px-4 py-3">${categorie}</td>
                            <td class="px-4 py-3 text-right font-semibold">${montantNum.toFixed(2).replace('.', ',')} FCFA</td>
                            <td class="px-4 py-3">${paiement}</td>
                            <td class="px-4 py-3">${creePar}</td>
                            <td class="px-4 py-3 text-xs">${justificatifHtml}</td>
                        </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        return html;
    }

    /**
     * Bouton "Générer l'aperçu" - Compte de Résultat uniquement
     */
    async function handleGenerateCompte() {
        if (!window.OGOUE) {
            console.error("OGOUE state non chargé");
            return;
        }

        const today = new Date(startDate || new Date());
        const month = today.getMonth() + 1;
        const year = today.getFullYear();

        console.log(`🔍 DEBUG: Récupération données pour ${month}/${year}`);
        console.log(`📅 Plage de dates: ${startDate} à ${endDate || startDate}`);

        try {
            const [ventes, depenses] = await Promise.all([
                window.OGOUE.getVentesPourPeriode(month, year),
                window.OGOUE.getDepensesPourPeriode(month, year)
            ]);

            console.log("📊 Ventes reçues:", ventes);
            console.log("💰 Dépenses reçues:", depenses);

            const ventesFiltered = filterByDateRange(ventes);
            const depensesFiltered = filterByDateRange(depenses);

            console.log("✅ Ventes filtrées:", ventesFiltered);
            console.log("✅ Dépenses filtrées:", depensesFiltered);

            const compteResultat = generateCompteDeResultat(ventesFiltered, depensesFiltered);

            console.log("📈 Compte de Résultat généré:", compteResultat);

            // Créer ou récupérer le conteneur de résultat
            let resultsContainer = document.getElementById("etatFinanciersResults");
            if (!resultsContainer) {
                resultsContainer = document.createElement("div");
                resultsContainer.id = "etatFinanciersResults";
                resultsContainer.className = "mt-8";
                document.querySelector("main .container .max-w-7xl").appendChild(resultsContainer);
            }

            // REMPLACER le contenu (pas ajouter)
            const compteHtml = `<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-sm p-5">
                    <h3 class="text-lg font-bold mb-2">Compte de Résultat</h3>
                    ${renderCompteDeResultat(compteResultat)}
                </div>`;
            resultsContainer.innerHTML = compteHtml;

            // Sauvegarder les données/rendus pour l'impression sélective
            window.etatFinanciersData = window.etatFinanciersData || {};
            window.etatFinanciersData.ventes = ventesFiltered;
            window.etatFinanciersData.depenses = depensesFiltered;
            window.etatFinanciersData.compteHtml = compteHtml;

            panel.classList.add("hidden");
        } catch (error) {
            console.error("❌ Erreur lors de la génération du compte de résultat:", error);
            alert("Erreur lors du chargement des données: " + (error && error.message ? error.message : error));
            let resultsContainer = document.getElementById("etatFinanciersResults");
            if (!resultsContainer) {
                resultsContainer = document.createElement("div");
                resultsContainer.id = "etatFinanciersResults";
                resultsContainer.className = "mt-8";
                document.querySelector("main .container .max-w-7xl").appendChild(resultsContainer);
            }
            resultsContainer.innerHTML = `<div class="bg-card-light text-red-700 rounded-xl shadow-sm p-5">Erreur: ${error && error.message ? error.message : error}</div>`;
        }
    }

    /**
     * Bouton "Générer l'aperçu" - Tableau de Flux uniquement
     */
    async function handleGenerateFlux() {
        if (!window.OGOUE) {
            console.error("OGOUE state non chargé");
            return;
        }

        const today = new Date(startDate || new Date());
        const month = today.getMonth() + 1;
        const year = today.getFullYear();

        try {
            const [ventes, depenses] = await Promise.all([
                window.OGOUE.getVentesPourPeriode(month, year),
                window.OGOUE.getDepensesPourPeriode(month, year)
            ]);

            const ventesFiltered = filterByDateRange(ventes);
            const depensesFiltered = filterByDateRange(depenses);
            const tableauFlux = generateTableauDeFlux(ventesFiltered, depensesFiltered);

            let resultsContainer = document.getElementById("etatFinanciersResults");
            if (!resultsContainer) {
                resultsContainer = document.createElement("div");
                resultsContainer.id = "etatFinanciersResults";
                resultsContainer.className = "mt-8";
                document.querySelector("main .container .max-w-7xl").appendChild(resultsContainer);
            }

            const fluxHtml = `<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-sm p-5">
                    <h3 class="text-lg font-bold mb-2">Tableau de Flux de Trésorerie</h3>
                    ${renderTableauDeFlux(tableauFlux)}
                </div>`;
            resultsContainer.innerHTML = fluxHtml;

            window.etatFinanciersData = window.etatFinanciersData || {};
            window.etatFinanciersData.ventes = ventesFiltered;
            window.etatFinanciersData.depenses = depensesFiltered;
            window.etatFinanciersData.fluxHtml = fluxHtml;

            panel.classList.add("hidden");
        } catch (error) {
            console.error("Erreur lors de la génération du tableau de flux:", error);
            alert("Erreur lors du chargement des données: " + (error && error.message ? error.message : error));
            let resultsContainer = document.getElementById("etatFinanciersResults");
            if (!resultsContainer) {
                resultsContainer = document.createElement("div");
                resultsContainer.id = "etatFinanciersResults";
                resultsContainer.className = "mt-8";
                document.querySelector("main .container .max-w-7xl").appendChild(resultsContainer);
            }
            resultsContainer.innerHTML = `<div class="bg-card-light text-red-700 rounded-xl shadow-sm p-5">Erreur: ${error && error.message ? error.message : error}</div>`;
        }
    }

    /**
     * Bouton "Générer l'aperçu" - Historique des Ventes uniquement
     */
    async function handleGenerateVentes() {
        if (!window.OGOUE) {
            console.error("OGOUE state non chargé");
            return;
        }

        const today = new Date(startDate || new Date());
        const month = today.getMonth() + 1;
        const year = today.getFullYear();

        try {
            const ventes = await window.OGOUE.getVentesPourPeriode(month, year);
            const ventesFiltered = filterByDateRange(ventes);

            let resultsContainer = document.getElementById("etatFinanciersResults");
            if (!resultsContainer) {
                resultsContainer = document.createElement("div");
                resultsContainer.id = "etatFinanciersResults";
                resultsContainer.className = "mt-8";
                document.querySelector("main .container .max-w-7xl").appendChild(resultsContainer);
            }

            const ventesHtml = `<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-sm p-5">
                    <h3 class="text-lg font-bold mb-2">Historique des Ventes (${ventesFiltered.length})</h3>
                    ${renderHistoriqueVentes(ventesFiltered)}
                </div>`;
            resultsContainer.innerHTML = ventesHtml;

            // Ajouter les event listeners pour les justificatifs
            const justificatifLinks = resultsContainer.querySelectorAll('.justificatif-link');
            justificatifLinks.forEach(link => {
                link.addEventListener('click', () => {
                    const fileName = link.getAttribute('data-file');
                    const fileUrl = link.getAttribute('data-url');
                    openJustificatifModal(fileName, fileUrl);
                });
            });

            window.etatFinanciersData = window.etatFinanciersData || {};
            window.etatFinanciersData.ventes = ventesFiltered;
            window.etatFinanciersData.ventesHtml = ventesHtml;

            panel.classList.add("hidden");
        } catch (error) {
            console.error("Erreur lors de la génération de l'historique ventes:", error);
            alert("Erreur lors du chargement des données: " + (error && error.message ? error.message : error));
            let resultsContainer = document.getElementById("etatFinanciersResults");
            if (!resultsContainer) {
                resultsContainer = document.createElement("div");
                resultsContainer.id = "etatFinanciersResults";
                resultsContainer.className = "mt-8";
                document.querySelector("main .container .max-w-7xl").appendChild(resultsContainer);
            }
            resultsContainer.innerHTML = `<div class="bg-card-light text-red-700 rounded-xl shadow-sm p-5">Erreur: ${error && error.message ? error.message : error}</div>`;
        }
    }

    /**
     * Bouton "Générer l'aperçu" - Historique des Dépenses uniquement
     */
    async function handleGenerateDepenses() {
        if (!window.OGOUE) {
            console.error("OGOUE state non chargé");
            return;
        }

        const today = new Date(startDate || new Date());
        const month = today.getMonth() + 1;
        const year = today.getFullYear();

        try {
            const depenses = await window.OGOUE.getDepensesPourPeriode(month, year);
            const depensesFiltered = filterByDateRange(depenses);

            let resultsContainer = document.getElementById("etatFinanciersResults");
            if (!resultsContainer) {
                resultsContainer = document.createElement("div");
                resultsContainer.id = "etatFinanciersResults";
                resultsContainer.className = "mt-8";
                document.querySelector("main .container .max-w-7xl").appendChild(resultsContainer);
            }

            const depensesHtml = `<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-sm p-5">
                    <h3 class="text-lg font-bold mb-2">Historique des Dépenses (${depensesFiltered.length})</h3>
                    ${renderHistoriqueDepenses(depensesFiltered)}
                </div>`;
            resultsContainer.innerHTML = depensesHtml;

            // Ajouter les event listeners pour les justificatifs
            const justificatifLinks = resultsContainer.querySelectorAll('.justificatif-link');
            justificatifLinks.forEach(link => {
                link.addEventListener('click', () => {
                    const fileName = link.getAttribute('data-file');
                    const fileUrl = link.getAttribute('data-url');
                    openJustificatifModal(fileName, fileUrl);
                });
            });

            window.etatFinanciersData = window.etatFinanciersData || {};
            window.etatFinanciersData.depenses = depensesFiltered;
            window.etatFinanciersData.depensesHtml = depensesHtml;

            panel.classList.add("hidden");
        } catch (error) {
            console.error("Erreur lors de la génération de l'historique dépenses:", error);
            alert("Erreur lors du chargement des données: " + (error && error.message ? error.message : error));
            let resultsContainer = document.getElementById("etatFinanciersResults");
            if (!resultsContainer) {
                resultsContainer = document.createElement("div");
                resultsContainer.id = "etatFinanciersResults";
                resultsContainer.className = "mt-8";
                document.querySelector("main .container .max-w-7xl").appendChild(resultsContainer);
            }
            resultsContainer.innerHTML = `<div class="bg-card-light text-red-700 rounded-xl shadow-sm p-5">Erreur: ${error && error.message ? error.message : error}</div>`;
        }
    }

    /**
     * Génère un PDF avec l'aperçu actuellement affiché
     */
    function handleExportPDF() {
        const resultsContainer = document.getElementById("etatFinanciersResults");
        
        if (!resultsContainer || resultsContainer.innerHTML.trim() === "") {
            alert("Veuillez d'abord générer un aperçu.");
            return;
        }

        // Récupérer la plage de dates
        const dateRange = `${formatDateFR(startDate)}${endDate ? ' - ' + formatDateFR(endDate) : ''}`;

        // Créer une nouvelle fenêtre avec le contenu généré
        const newWindow = window.open('', '', 'width=900,height=1000');
        
        // Copier le contenu HTML généré
        const htmlContent = resultsContainer.innerHTML;

        newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>États Financiers - ${dateRange}</title>
                <style>
                    * { margin: 0; padding: 0; }
                    body { font-family: Arial, sans-serif; padding: 20px; color: #0d1b19; }
                    h1 { font-size: 24px; margin-bottom: 10px; }
                    h3 { font-size: 16px; margin-top: 30px; margin-bottom: 15px; border-bottom: 2px solid #13ecc8; padding-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
                    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
                    th { background-color: #f0f0f0; font-weight: bold; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    .amount { text-align: right; font-weight: bold; }
                    .total { background-color: #e0f2ef; font-weight: bold; }
                    .page-break { page-break-after: always; }
                </style>
            </head>
            <body>
                <h1>États Financiers</h1>
                <p>Période: ${dateRange}</p>
                <hr style="margin: 20px 0;">
                ${htmlContent}
            </body>
            </html>
        `);
        newWindow.document.close();

        // Lancer l'impression/export PDF
        setTimeout(() => {
            newWindow.print();
        }, 500);
    }

    /**
     * Bouton "Exporter CSV" - exporte les données avec la plage de dates sélectionnée
     */
    async function handleExportCSV() {
        try {
            if (!window.OGOUE) {
                alert("Erreur: données non disponibles");
                return;
            }

            // Récupérer les données
            const token = localStorage.getItem("authToken");
            if (!token) {
                alert("Vous devez être connecté");
                return;
            }

            // Vérifier qu'une plage de dates est sélectionnée
            if (!startDate || !endDate) {
                alert("Veuillez sélectionner une plage de dates");
                return;
            }

            console.log(`📥 Export CSV pour la période: ${startDate} au ${endDate}`);

            // Récupérer les ventes et dépenses pour la plage de dates sélectionnée
            const ventes = await window.OGOUE.getVentesPourPlage?.(startDate, endDate) || [];
            const depenses = await window.OGOUE.getDepensesPourPlage?.(startDate, endDate) || [];

            console.log(`📊 Données récupérées: ${ventes.length} ventes, ${depenses.length} dépenses`);

            // Créer le modal
            const existing = document.getElementById('csvSelectorModal');
            if (existing) return;

            const modal = document.createElement('div');
            modal.id = 'csvSelectorModal';
            modal.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);z-index:9999;';

            const box = document.createElement('div');
            box.style = 'background:white;border-radius:12px;padding:24px;max-width:400px;box-shadow:0 20px 25px rgba(0,0,0,0.15);';

            const title = document.createElement('h2');
            title.textContent = 'Exporter en CSV';
            title.style = 'font-size:20px;font-weight:bold;margin-bottom:16px;color:#0d1b19;';

            const description = document.createElement('p');
            description.textContent = 'Cochez les fichiers à télécharger puis cliquez sur Exporter.';
            description.style = 'font-size:14px;color:#666;margin-bottom:20px;';

            const checksContainer = document.createElement('div');
            checksContainer.style = 'display:flex;flex-direction:column;gap:12px;margin-bottom:20px;';

            const options = [
                { id: 'ventes', label: `Historique des Ventes (${ventes.length})`, checked: false },
                { id: 'depenses', label: `Historique des Dépenses (${depenses.length})`, checked: false },
                { id: 'flux', label: 'Tableau de Flux de Trésorerie', checked: false }
            ];

            const checkboxes = {};
            options.forEach(opt => {
                const label = document.createElement('label');
                label.style = 'display:flex;align-items:center;gap:8px;cursor:pointer;';
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = opt.checked;
                checkbox.style = 'width:18px;height:18px;cursor:pointer;';
                checkboxes[opt.id] = checkbox;
                
                const labelText = document.createElement('span');
                labelText.textContent = opt.label;
                labelText.style = 'font-size:14px;color:#333;';
                
                label.appendChild(checkbox);
                label.appendChild(labelText);
                checksContainer.appendChild(label);
            });

            const buttonsContainer = document.createElement('div');
            buttonsContainer.style = 'display:flex;gap:12px;justify-content:flex-end;';

            const cancelBtn = document.createElement('button');
            cancelBtn.textContent = 'Annuler';
            cancelBtn.style = 'padding:8px 16px;border:1px solid #ddd;border-radius:6px;cursor:pointer;background:#f5f5f5;';
            cancelBtn.addEventListener('click', () => modal.remove());

            const exportBtn = document.createElement('button');
            exportBtn.textContent = 'Exporter';
            exportBtn.style = 'padding:8px 16px;background:#13ecc8;color:white;border:none;border-radius:6px;cursor:pointer;font-weight:bold;';
            exportBtn.addEventListener('click', async () => {
                const selected = Object.keys(checkboxes).filter(key => checkboxes[key].checked);
                if (selected.length === 0) {
                    alert('Sélectionnez au moins un fichier');
                    return;
                }

                try {
                    // Ventes
                    if (selected.includes('ventes')) {
                        const csvVentes = generateCSV("VENTES", [
                            ["Date", "Description", "Type", "Moyen de paiement", "Montant", "Justificatif"],
                            ...ventes.map(v => [
                                v.saleDate || v.date || "",
                                v.description || "",
                                v.saleType || v.type_vente || "",
                                v.paymentMethod || v.moyen_paiement || "",
                                v.amount || v.montant || "",
                                v.receiptName || v.justificatif || ""
                            ])
                        ]);
                        downloadCSV(csvVentes, "OGOUE_Ventes.csv");
                    }

                    // Dépenses
                    if (selected.includes('depenses')) {
                        const csvDepenses = generateCSV("DEPENSES", [
                            ["Date", "Catégorie", "Description", "Montant", "Justificatif"],
                            ...depenses.map(d => [
                                d.date || "",
                                d.category || d.categorie || "",
                                d.description || "",
                                d.amount || d.montant || "",
                                d.receiptName || d.justificatif || ""
                            ])
                        ]);
                        downloadCSV(csvDepenses, "OGOUE_Depenses.csv");
                    }

                    // Flux
                    if (selected.includes('flux')) {
                        const allOperations = [
                            ...ventes.map(v => ({
                                Date: v.saleDate || v.date || "",
                                Type: "Vente",
                                Description: v.description || "",
                                Montant: v.amount || v.montant || 0,
                                Catégorie: v.saleType || ""
                            })),
                            ...depenses.map(d => ({
                                Date: d.date || "",
                                Type: "Dépense",
                                Description: d.description || "",
                                Montant: -(d.amount || d.montant || 0),
                                Catégorie: d.category || d.categorie || ""
                            }))
                        ].sort((a, b) => new Date(a.Date) - new Date(b.Date));

                        const csvFlux = generateCSV("FLUX", [
                            ["Date", "Type", "Description", "Montant", "Catégorie"],
                            ...allOperations.map(op => [op.Date, op.Type, op.Description, op.Montant, op.Catégorie])
                        ]);
                        downloadCSV(csvFlux, "OGOUE_Flux_Tresorerie.csv");
                    }

                    alert(`✅ ${selected.length} fichier(s) CSV téléchargé(s) !`);
                    modal.remove();
                } catch (error) {
                    console.error("Erreur export CSV:", error);
                    alert("❌ Erreur lors de l'export: " + error.message);
                }
            });

            buttonsContainer.appendChild(cancelBtn);
            buttonsContainer.appendChild(exportBtn);

            box.appendChild(title);
            box.appendChild(description);
            box.appendChild(checksContainer);
            box.appendChild(buttonsContainer);
            modal.appendChild(box);
            document.body.appendChild(modal);

            // Fermer en cliquant en dehors
            modal.addEventListener('click', (e) => {
                if (e.target === modal) modal.remove();
            });

        } catch (error) {
            console.error("Erreur export CSV:", error);
            alert("❌ Erreur lors de l'export: " + error.message);
        }
    }

    /**
     * Bouton "Imprimer tout" - lance l'impression avec mise en page CSS
     * Génère les données à la volée si elles ne sont pas disponibles
     */
    async function handlePrintAll() {
        // Vérifier si les données existent, sinon les générer
        if (!window.etatFinanciersData || Object.keys(window.etatFinanciersData).length === 0) {
            if (!window.OGOUE) {
                alert("Impossible de charger les données.");
                return;
            }

            try {
                const today = new Date(startDate || new Date());
                const month = today.getMonth() + 1;
                const year = today.getFullYear();

                console.log(`📥 Génération des données pour impression: ${month}/${year}`);

                // Récupérer les données
                const [ventes, depenses] = await Promise.all([
                    window.OGOUE.getVentesPourPeriode(month, year),
                    window.OGOUE.getDepensesPourPeriode(month, year)
                ]);

                // Filtrer par dates
                const ventesFiltered = filterByDateRange(ventes);
                const depensesFiltered = filterByDateRange(depenses);

                // Générer les HTML
                const compteData = generateCompteDeResultat(ventesFiltered, depensesFiltered);
                const fluxData = generateTableauDeFlux(ventesFiltered, depensesFiltered);

                // Stocker les données et HTML pour impression
                window.etatFinanciersData = window.etatFinanciersData || {};
                window.etatFinanciersData.ventes = ventesFiltered;
                window.etatFinanciersData.depenses = depensesFiltered;
                window.etatFinanciersData.compteHtml = `<h3>Compte de Résultat</h3>${renderCompteDeResultat(compteData)}`;
                window.etatFinanciersData.fluxHtml = `<h3>Tableau de Flux de Trésorerie</h3>${renderTableauDeFlux(fluxData)}`;
                window.etatFinanciersData.ventesHtml = `<h3>Historique des Ventes (${ventesFiltered.length})</h3>${renderHistoriqueVentes(ventesFiltered)}`;
                window.etatFinanciersData.depensesHtml = `<h3>Historique des Dépenses (${depensesFiltered.length})</h3>${renderHistoriqueDepenses(depensesFiltered)}`;

                console.log("✅ Données générées pour impression");
            } catch (error) {
                console.error("❌ Erreur lors de la génération des données d'impression:", error);
                alert("Erreur lors de la génération des données: " + (error && error.message ? error.message : error));
                return;
            }
        }

        // Construire le modal de sélection
        const existing = document.getElementById('printSelectorModal');
        if (existing) return;

        const modal = document.createElement('div');
        modal.id = 'printSelectorModal';
        modal.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);z-index:9999;';

        const box = document.createElement('div');
        box.style = 'background:#fff;padding:20px;border-radius:8px;max-width:540px;width:90%;box-shadow:0 8px 30px rgba(0,0,0,0.2);';

        const title = document.createElement('h3');
        title.textContent = "Imprimer - Choisissez les sections";
        title.style = 'margin:0 0 12px;font-size:18px;padding:0';
        box.appendChild(title);

        const info = document.createElement('p');
        info.textContent = 'Cochez les sections à imprimer puis cliquez sur Imprimer.';
        info.style = 'margin:0 0 12px;color:#444';
        box.appendChild(info);

        const list = document.createElement('div');
        list.style = 'display:flex;flex-direction:column;gap:8px;margin-bottom:12px;';

        const sections = [
            { id: 'compte', label: 'Compte de Résultat', key: 'compteHtml' },
            { id: 'flux', label: 'Tableau de Flux', key: 'fluxHtml' },
            { id: 'ventes', label: `Historique des Ventes (${(window.etatFinanciersData.ventes || []).length})`, key: 'ventesHtml' },
            { id: 'depenses', label: `Historique des Dépenses (${(window.etatFinanciersData.depenses || []).length})`, key: 'depensesHtml' }
        ];

        sections.forEach(s => {
            const row = document.createElement('label');
            row.style = 'display:flex;align-items:center;gap:10px;cursor:pointer';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.id = `print_opt_${s.id}`;
            cb.checked = false;
            cb.disabled = !window.etatFinanciersData[s.key];
            const span = document.createElement('span');
            span.textContent = s.label;
            row.appendChild(cb);
            row.appendChild(span);
            list.appendChild(row);
        });

        box.appendChild(list);

        const actions = document.createElement('div');
        actions.style = 'display:flex;justify-content:flex-end;gap:10px';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Annuler';
        cancelBtn.style = 'padding:8px 12px;border-radius:6px;border:1px solid #ccc;background:#fff;cursor:pointer';
        const printBtn = document.createElement('button');
        printBtn.textContent = 'Imprimer';
        printBtn.style = 'padding:8px 12px;border-radius:6px;border:0;background:#0d9488;color:#fff;cursor:pointer';

        actions.appendChild(cancelBtn);
        actions.appendChild(printBtn);
        box.appendChild(actions);
        modal.appendChild(box);
        document.body.appendChild(modal);

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });

        printBtn.addEventListener('click', () => {
            // Collecter sélection
            const chosen = [];
            sections.forEach(s => {
                const cb = document.getElementById(`print_opt_${s.id}`);
                if (cb && cb.checked && window.etatFinanciersData[s.key]) {
                    chosen.push(window.etatFinanciersData[s.key]);
                }
            });

            if (chosen.length === 0) {
                alert('Veuillez sélectionner au moins une section à imprimer.');
                return;
            }

            // Ouvrir nouvelle fenêtre et imprimer le contenu choisi
            const newWindow = window.open('', '', 'width=900,height=1000');
            const dateRange = `${formatDateFR(startDate)}${endDate ? ' - ' + formatDateFR(endDate) : ''}`;
            const htmlContent = chosen.join('<div style="height:12px"></div>');

            newWindow.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Impression - États Financiers</title><script src="https://cdn.tailwindcss.com?plugins=forms,container-queries"><\/script><style>*{margin:0;padding:0}body{font-family:Arial,sans-serif;padding:15px;color:#0d1b19;line-height:1.4}h1{margin:0 0 8px 0;font-size:20px;font-weight:bold}p{margin:0 0 8px 0;font-size:13px}hr{margin:8px 0;border:none;border-top:1px solid #ccc}h3{margin:12px 0 8px 0;font-size:14px;font-weight:bold}table{width:100%;border-collapse:collapse}th,td{padding:8px;border-bottom:1px solid #ddd}@media print{body{margin:0;padding:8px;font-size:12px}h1{margin:0 0 4px 0;font-size:16px}p{margin:0 0 4px 0;font-size:11px}hr{margin:4px 0}h3{margin:8px 0 4px 0}#compte-resultat{page-break-before:avoid}#compte-resultat .grid.grid-cols-2>div{min-height:auto}}</style></head><body><h1>États Financiers</h1><p>Période: ${dateRange}</p><hr>${htmlContent}</body></html>`);
            newWindow.document.close();
            setTimeout(() => { newWindow.print(); newWindow.close(); }, 500);

            // Nettoyage modal
            if (modal.parentNode) document.body.removeChild(modal);
        });
        
    }

    // Attacher les événements aux boutons via IDs
    const generateCompteBtn = document.getElementById("generateCompteBtn");
    const generateFluxBtn = document.getElementById("generateFluxBtn");
    const generateVentesBtn = document.getElementById("generateVentesBtn");
    const generateDepensesBtn = document.getElementById("generateDepensesBtn");
    const exportPdfBtn = document.getElementById("exportPdfBtn");
    const printAllBtn = document.getElementById("printAllBtn");

    if (generateCompteBtn) {
        generateCompteBtn.addEventListener("click", handleGenerateCompte);
    }

    if (generateFluxBtn) {
        generateFluxBtn.addEventListener("click", handleGenerateFlux);
    }

    if (generateVentesBtn) {
        generateVentesBtn.addEventListener("click", handleGenerateVentes);
    }

    if (generateDepensesBtn) {
        generateDepensesBtn.addEventListener("click", handleGenerateDepenses);
    }

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener("click", handleExportPDF);
    }

    if (printAllBtn) {
        printAllBtn.addEventListener("click", handlePrintAll);
    }

    // Export CSV
    const exportCsvBtn = document.getElementById("exportCsvBtn");
    if (exportCsvBtn) {
        exportCsvBtn.addEventListener("click", handleExportCSV);
    }
});

/**
 * Génère le contenu CSV
 */
function generateCSV(title, rows) {
    // Ajouter un titre
    const csvContent = [
        [title],
        ["Export du", new Date().toLocaleDateString("fr-FR")],
        [],
        ...rows
    ]
        .map(row => row.map(cell => {
            // Écapper les guillemets et entourer les cellules contenant des virgules
            const cellStr = String(cell || "");
            return cellStr.includes(",") || cellStr.includes('"') 
                ? `"${cellStr.replace(/"/g, '""')}"` 
                : cellStr;
        }).join(","))
        .join("\n");
    
    return csvContent;
}

/**
 * Télécharge un fichier CSV
 */
function downloadCSV(csvContent, filename) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Modal pour afficher et télécharger le justificatif
 */
function openJustificatifModal(fileName, fileUrl) {
    // Vérifier si un modal existe déjà et le supprimer
    const existingModal = document.getElementById('justificatif-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'justificatif-modal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-9999';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'bg-card-light dark:bg-card-dark rounded-xl max-w-md w-full mx-4 shadow-lg p-8 relative border border-[#e8ede8] dark:border-[#2a3a32]';
    
    const closeBtn = document.createElement('button');
    closeBtn.id = 'close-justificatif';
    closeBtn.className = 'absolute top-4 right-4 w-8 h-8 rounded-full bg-[#f0f0f0] dark:bg-[#2a3a32] flex items-center justify-center text-[#666] dark:text-[#999] hover:bg-[#e0e0e0] dark:hover:bg-[#3a4a42] transition-colors';
    closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
    closeBtn.type = 'button';
    
    const title = document.createElement('h2');
    title.className = 'text-lg font-bold text-text-light-primary dark:text-text-dark-primary mb-2 text-center font-display';
    title.textContent = 'Justificatif enregistré:';
    
    const fileName_elem = document.createElement('p');
    fileName_elem.className = 'text-sm text-text-light-secondary dark:text-text-dark-secondary text-center mb-6 break-words font-medium';
    fileName_elem.textContent = fileName;
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'flex gap-3 justify-center';
    
    if (fileUrl) {
        const viewUrl = fileUrl.includes('?') ? `${fileUrl}&download=` : `${fileUrl}?download=`;
        
        const consultBtn = document.createElement('a');
        consultBtn.href = viewUrl;
        consultBtn.target = '_blank';
        consultBtn.rel = 'noopener noreferrer';
        consultBtn.className = 'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors font-medium text-sm font-display border border-success/20 hover:border-success/40';
        consultBtn.innerHTML = '<span class="material-symbols-outlined" style="font-variation-settings: \'FILL\' 1;">visibility</span> Consulter';
        
        const downloadBtn = document.createElement('a');
        downloadBtn.href = fileUrl;
        downloadBtn.download = fileName;
        downloadBtn.className = 'inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-background-light hover:bg-primary/90 transition-colors font-medium text-sm font-display shadow-soft';
        downloadBtn.innerHTML = '<span class="material-symbols-outlined" style="font-variation-settings: \'FILL\' 1;">download</span> Télécharger';
        
        actionsDiv.appendChild(consultBtn);
        actionsDiv.appendChild(downloadBtn);
    } else {
        const noFileDiv = document.createElement('div');
        noFileDiv.className = 'p-4 bg-danger/10 dark:bg-danger/5 rounded-lg text-danger text-sm text-center border border-danger/20';
        noFileDiv.textContent = 'Fichier non disponible';
        actionsDiv.appendChild(noFileDiv);
    }
    
    modalContent.appendChild(closeBtn);
    modalContent.appendChild(title);
    modalContent.appendChild(fileName_elem);
    modalContent.appendChild(actionsDiv);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Fermer le modal au clic sur le bouton
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Fermer le modal au clic en dehors
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Fermer le modal au clic en dehors
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

/**
 * Ouvre un modal pour afficher le justificatif (PDF ou image)
 */
function openJustificatifModal(fileName, fileUrl) {
    console.log('📁 Ouverture modal : fileName="' + fileName + '", fileUrl="' + fileUrl + '"');
    
    // Vérifier si un modal existe déjà et le supprimer
    const existingModal = document.getElementById('justificatif-modal');
    if (existingModal) {
      existingModal.remove();
    }
    
    // Fermer les autres modals (comme le tableau d'export)
    const otherModals = document.querySelectorAll('[role="dialog"], .modal, [class*="modal"]');
    otherModals.forEach(m => {
      if (m && m.id !== 'justificatif-modal') {
        const closeBtn = m.querySelector('[aria-label="close"], .close, button:first-of-type');
        if (closeBtn) closeBtn.click();
      }
    });

    const modal = document.createElement('div');
    modal.id = 'justificatif-modal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[99999] p-1 sm:p-2';
    modal.style.position = 'fixed';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.zIndex = '99999';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'bg-card-light dark:bg-card-dark rounded-lg sm:rounded-xl w-[99vw] sm:w-[98vw] h-[99vh] sm:h-[98vh] shadow-lg overflow-hidden border border-[#e8ede8] dark:border-[#2a3a32] flex flex-col';
    modalContent.style.maxWidth = 'calc(100vw - 4px)';
    modalContent.style.maxHeight = 'calc(100vh - 4px)';
    
    const closeBtn = document.createElement('button');
    closeBtn.id = 'close-justificatif';
    closeBtn.className = 'absolute top-6 right-6 w-8 h-8 rounded-full bg-[#f0f0f0] dark:bg-[#2a3a32] flex items-center justify-center text-[#666] dark:text-[#999] hover:bg-[#e0e0e0] dark:hover:bg-[#3a4a42] transition-colors z-10';
    closeBtn.innerHTML = '<span class="material-symbols-outlined">close</span>';
    closeBtn.type = 'button';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'p-4 sm:p-6 border-b border-[#e8ede8] dark:border-[#2a3a32] flex justify-between items-start gap-2 flex-shrink-0';
    
    const titleDiv = document.createElement('div');
    titleDiv.className = 'flex flex-col';
    titleDiv.innerHTML = '<h2 class="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary">Aperçu du justificatif</h2><p class="text-xs text-text-light-secondary dark:text-text-dark-secondary">'+fileName+'</p>';
    
    headerDiv.appendChild(titleDiv);
    headerDiv.appendChild(closeBtn);
    
    const previewDiv = document.createElement('div');
    previewDiv.className = 'flex-1 overflow-auto flex items-center justify-center bg-white dark:bg-gray-800 relative';
    previewDiv.style.minHeight = '200px';
    
    // Déterminer le type de fichier et créer l'aperçu approprié
    const fileExtension = fileName.split('.').pop().toLowerCase();
    const isPDF = fileExtension === 'pdf';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExtension);
    
    if (fileUrl) {
      if (isPDF) {
        // Affichage avec Google Docs Viewer (simple et sans folklore)
        const googleViewerUrl = `https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`;
        const iframe = document.createElement('iframe');
        iframe.src = googleViewerUrl;
        iframe.className = 'w-full h-full';
        iframe.style.minHeight = '600px';
        iframe.style.border = 'none';
        previewDiv.appendChild(iframe);
      } else if (isImage) {
        // Pour les images, créer un img tag
        const img = document.createElement('img');
        img.src = fileUrl;
        img.alt = fileName;
        img.className = 'max-w-full max-h-full object-contain rounded-lg';
        img.style.maxHeight = 'calc(98vh - 80px)';
        img.onerror = () => {
          img.style.display = 'none';
          const errorDiv = document.createElement('div');
          errorDiv.className = 'text-center';
          errorDiv.innerHTML = `
            <span class="material-symbols-outlined text-6xl text-red-400 mb-4 block">image_not_supported</span>
            <p class="text-text-light-secondary dark:text-text-dark-secondary mb-4">Impossible de charger l'image</p>
            <p class="text-sm text-gray-500 dark:text-gray-500">L'URL du fichier pourrait être invalide ou le fichier supprimé</p>
          `;
          previewDiv.appendChild(errorDiv);
        };
        previewDiv.appendChild(img);
      } else {
        // Fichier non supporté pour l'aperçu
        const noPreviewDiv = document.createElement('div');
        noPreviewDiv.className = 'text-center';
        noPreviewDiv.innerHTML = `
          <span class="material-symbols-outlined text-6xl text-gray-400 dark:text-gray-600 mb-4 block">description</span>
          <p class="text-text-light-secondary dark:text-text-dark-secondary mb-4">Aperçu non disponible pour ce type de fichier</p>
          <p class="text-sm text-text-light-secondary dark:text-text-dark-secondary">Utilisez le bouton télécharger pour ouvrir le fichier</p>
        `;
        previewDiv.appendChild(noPreviewDiv);
      }
    } else {
      const noFileDiv = document.createElement('div');
      noFileDiv.className = 'text-center';
      noFileDiv.innerHTML = `
        <span class="material-symbols-outlined text-6xl text-gray-400 dark:text-gray-600 mb-4 block">warning</span>
        <p class="text-text-light-secondary dark:text-text-dark-secondary mb-4">URL du fichier non disponible</p>
        <p class="text-sm text-gray-500 dark:text-gray-500">Le fichier n'a pas d'URL de téléchargement associée</p>
      `;
      previewDiv.appendChild(noFileDiv);
    }
    
    const footerDiv = document.createElement('div');
    footerDiv.className = 'p-2 sm:p-3 border-t border-[#e8ede8] dark:border-[#2a3a32] flex gap-2 sm:gap-3 justify-center flex-shrink-0';
    
    if (fileUrl) {
        const downloadBtn = document.createElement('a');
        downloadBtn.href = fileUrl;
        downloadBtn.download = fileName;
        downloadBtn.className = 'inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-background-light hover:bg-primary/90 transition-colors font-medium text-sm font-display shadow-soft';
        downloadBtn.innerHTML = '<span class="material-symbols-outlined" style="font-variation-settings: \'FILL\' 1;">download</span> Télécharger';
        
        footerDiv.appendChild(downloadBtn);
    }
    
    modalContent.appendChild(headerDiv);
    modalContent.appendChild(previewDiv);
    modalContent.appendChild(footerDiv);
    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // Fermer le modal au clic sur le bouton
    closeBtn.addEventListener('click', () => {
        modal.remove();
    });
    
    // Fermer le modal au clic en dehors
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Ajouter les event listeners pour les justificatifs dans les tableaux
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('justificatif-link')) {
        e.preventDefault();
        const fileName = e.target.dataset.file;
        const fileUrl = e.target.dataset.url;
        if (fileName && fileUrl) {
            openJustificatifModal(fileName, fileUrl);
        }
    }
});
