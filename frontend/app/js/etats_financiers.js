// js/etats_financiers.js

document.addEventListener("DOMContentLoaded", function () {
    const btn = document.getElementById("dateFilterButton");
    const panel = document.getElementById("dateFilterPanel");
    const labelSpan = document.getElementById("dateFilterLabel");
    const calendarGrid = document.getElementById("calendarGrid");
    const monthSelect = document.getElementById("monthSelect");
    const yearInput = document.getElementById("yearInput");
    const prevMonthBtn = document.getElementById("prevMonth");
    const nextMonthBtn = document.getElementById("nextMonth");
    const resetBtn = document.getElementById("resetRange");
    const closeBtn = document.getElementById("closeCalendar");

    if (!btn || !panel || !monthSelect || !yearInput) return;

    let current = new Date();
    let startDate = null;
    let endDate = null;

    // Choix direct du mois et de l'année, en plus des flèches
    const selecteurs = window.OGOUE_PERIODE?.installerSelecteursMoisAnnee({
        selectMois: monthSelect,
        champAnnee: yearInput,
        lireVue: () => current,
        ecrireVue: (annee, mois) => {
            current = new Date(annee, mois, 1);
            renderCalendar();
        }
    });

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
        selecteurs?.synchroniser();

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

    // Périodes rapides (filtre-periode.js) : imposer une période au calendrier
    window.OGOUE_FILTRE_DATES = {
        definir(debut, fin) {
            startDate = debut;
            endDate = fin;
            current = new Date(Number(fin.slice(0, 4)), Number(fin.slice(5, 7)) - 1, 1);
            panel.classList.add("hidden");
            updateLabel();
            renderCalendar();
        }
    };

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
    /**
     * Plage à demander à l'API. Sans elle, seul le mois de la date de
     * début était chargé : une période 01/2024 → 12/2026 ne renvoyait
     * que janvier 2024.
     */
    function plagePeriode() {
        if (!startDate) return undefined;
        return { startDate, endDate: endDate || startDate };
    }

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

    // ── Les états financiers sont calculés par le serveur ─────────
    //
    // Le compte de résultat et le tableau de flux sont le produit vendu,
    // pas un simple affichage des ventes. Les calculer ici les aurait
    // laissés accessibles à une formule qui ne les inclut pas, puisque
    // les données brutes, elles, appartiennent au client.
    //
    // L'appel est mutualisé : le compte de résultat et le tableau de flux
    // viennent de la même réponse, et l'impression les demande tous les
    // deux à la suite. Un cache par plage évite trois allers-retours.
    const _cacheEtats = new Map();

    async function chargerEtats(startDateISO, endDateISO) {
        const cle = `${startDateISO || ""}|${endDateISO || ""}`;
        if (_cacheEtats.has(cle)) return _cacheEtats.get(cle);

        const API_BASE_URL = (['localhost', '127.0.0.1'].some(h => location.hostname.includes(h)))
            ? 'http://localhost:3001'
            : (/^192\.168\./.test(location.hostname) ? 'http://' + location.hostname + ':3001' : 'https://api.ogoue.com');

        const params = new URLSearchParams();
        if (startDateISO) params.set("startDate", startDateISO);
        if (endDateISO) params.set("endDate", endDateISO);

        const reponse = await fetch(`${API_BASE_URL}/api/etats-financiers?${params}`, {
            headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` }
        });

        if (reponse.status === 402) {
            // Formule insuffisante : la fenêtre de montée en formule dit
            // déjà quoi faire, inutile d'empiler une alerte par-dessus.
            window.OGOUE_PLAN?.fenetreMontee("etatsFinanciers");
            throw new Error("formule_insuffisante");
        }
        if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);

        const donnees = await reponse.json();
        _cacheEtats.set(cle, donnees);
        return donnees;
    }

    // Le serveur n'envoie que les documents que la formule ouvre : une
    // clé absente n'est pas une panne, c'est un verrou. On le dit avec la
    // fenêtre de montée en formule plutôt qu'avec un « undefined » qui
    // casserait le rendu plus bas.
    async function generateCompteDeResultat(startDateISO, endDateISO) {
        const { compteResultat } = await chargerEtats(startDateISO, endDateISO);
        if (!compteResultat) {
            window.OGOUE_PLAN?.fenetreMontee("compteResultat");
            throw new Error("formule_insuffisante");
        }
        return compteResultat;
    }

    async function generateTableauDeFlux(startDateISO, endDateISO) {
        const { tableauFlux } = await chargerEtats(startDateISO, endDateISO);
        if (!tableauFlux) {
            window.OGOUE_PLAN?.fenetreMontee("tableauFlux");
            throw new Error("formule_insuffisante");
        }
        return tableauFlux;
    }

    // ── Plan comptable SYSCOHADA révisé ───────────────────────────
    // Les catégories de dépenses restent celles que voit le client ; chacune
    // est rangée ici sur sa ligne du compte de résultat (référence SYSCOHADA).
    // Retraits, remboursements d'emprunt et achats de matériel font sortir de
    // l'argent mais ne sont pas des charges : ils restent hors du résultat.
    const HORS_RESULTAT = ["retrait personnel", "remboursement d'emprunt", "matériel / équipement"];
    const LIGNE_SYSCOHADA = {
        "achats / stocks": "RA",
        "matières premières": "RC",
        "électricité": "RE", "eau": "RE",
        "transport & logistique": "RG",
        "loyer": "RH", "entretien & maintenance": "RH", "marketing": "RH", "internet & télécom": "RH",
        "impôts & taxes": "RI",
        "salaires": "RK",
        "intérêts d'emprunt": "RM", "intérêt des emprunts": "RM",
        "amendes & pénalités": "RP", "amendes": "RP",
        "impôt sur le bénéfice": "RS", "impôts sur les bénéfices": "RS"
    };
    // Une catégorie inconnue (créée par le client, ou « Autres ») : autres charges
    const ligneSyscohada = (categorie) => {
        const cle = String(categorie || "").trim().toLowerCase();
        return HORS_RESULTAT.includes(cle) ? null : (LIGNE_SYSCOHADA[cle] || "RJ");
    };
    const LIGNES_EXPLOITATION = ["RA", "RC", "RE", "RG", "RH", "RI", "RJ", "RK"];
    const ORDRE_CATEGORIES = [
        "Achats / Stocks", "Salaires", "Loyer", "Marketing", "Électricité",
        "Eau", "Internet & Télécom", "Transport & Logistique", "Impôts & Taxes", "Entretien & Maintenance"
    ];

    // Revente ou fabrication, choisi dans « Ma boutique » (js/mode-activite.js)
    let _modeActivite = null;
    async function lireModeActivite() {
        if (_modeActivite) return _modeActivite;
        try {
            const API_BASE_URL = (['localhost', '127.0.0.1'].some(h => location.hostname.includes(h)))
                ? 'http://localhost:3001' : (/^192\.168\./.test(location.hostname) ? 'http://' + location.hostname + ':3001' : 'https://api.ogoue.com');
            const r = await fetch(`${API_BASE_URL}/api/organization`, { headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` } });
            const org = r.ok ? await r.json() : null;
            _modeActivite = ["fabrication", "les_deux"].includes(org?.modeActivite) ? org.modeActivite : "revente";
        } catch (e) { _modeActivite = "revente"; }
        return _modeActivite;
    }

    // Entreprise « les deux » : noms (et identifiants) des produits fabriqués,
    // pour reconnaître les ventes de produits fabriqués (TB)
    async function lireProduitsFabriques() {
        const articles = window.OGOUE?.getArticles ? await window.OGOUE.getArticles().catch(() => []) : [];
        const s = new Set();
        articles.filter((a) => a.fabrique && a.type !== "services").forEach((a) => {
            s.add(String(a.name || "").trim().toLowerCase());
            s.add("id:" + a.id);
        });
        return s;
    }

    /**
     * Range les montants du serveur sur les lignes SYSCOHADA.
     * @param data   compteResultat renvoyé par /api/etats-financiers
     * @param ventes ventes de la période (pour séparer marchandises et services), ou null
     * @param mode   "revente" (TA, RA), "fabrication" (TB, RC) ou "les_deux"
     * @param fabriques produits fabriqués (lireProduitsFabriques), pour « les_deux »
     */
    function calculerSyscohada(data, ventes, mode = "revente", fabriques = null) {
        const fabrication = mode === "fabrication";
        const L = {};
        const detail = {};
        const hors = [];
        Object.entries(data.depensesByCategory || {}).forEach(([cat, montant]) => {
            const m = Number(montant) || 0;
            if (!m) return;
            let ligne = ligneSyscohada(cat);
            if (!ligne) { hors.push({ label: cat, amount: m }); return; }
            // Une entreprise qui fabrique achète des matières premières
            if (ligne === "RA" && fabrication) ligne = "RC";
            L[ligne] = (L[ligne] || 0) + m;
            (detail[ligne] = detail[ligne] || []).push({ label: cat === "Autres" ? "Autres charges" : cat, amount: m });
        });
        // Ventes : « services » en 706, le reste en ventes de marchandises (701)
        const totalVentes = Number(data.totalVentes) || 0;
        const services = Array.isArray(ventes)
            ? ventes.filter((v) => (v.type_vente || v.saleType) === "services").reduce((s, v) => s + (Number(v.montant) || 0), 0)
            : 0;
        L.TC = Math.min(services, totalVentes);
        if (mode === "les_deux" && Array.isArray(ventes) && fabriques) {
            // Chaque vente selon son produit : fabriqué (TB) ou revendu (TA)
            const fabriquee = (v) => fabriques.has(String(v.description || "").trim().toLowerCase())
                || (v.article_id && fabriques.has("id:" + v.article_id));
            const tb = ventes.filter((v) => (v.type_vente || v.saleType) !== "services" && fabriquee(v))
                .reduce((s, v) => s + (Number(v.montant) || 0), 0);
            L.TB = Math.min(tb, totalVentes - L.TC);
            L.TA = totalVentes - L.TC - L.TB;
        } else {
            L[fabrication ? "TB" : "TA"] = totalVentes - L.TC;
        }

        const v = (k) => L[k] || 0;
        const S = {};
        S.XA = v("TA") - v("RA") - v("RB");
        S.XB = v("TA") + v("TB") + v("TC") + v("TD");
        S.XC = S.XA + v("TB") + v("TC") + v("TD") + v("TE") + v("TF") + v("TG") + v("TH") + v("TI")
            - (v("RC") + v("RD") + v("RE") + v("RF") + v("RG") + v("RH") + v("RI") + v("RJ"));
        S.XD = S.XC - v("RK");
        S.XE = S.XD + v("TJ") - v("RL");
        S.XF = v("TK") + v("TL") + v("TM") - v("RM") - v("RN");
        S.XG = S.XE + S.XF;
        S.XH = v("TN") + v("TO") - v("RO") - v("RP");
        S.XI = S.XG + S.XH - v("RQ") - v("RS");

        const totalCharges = Object.keys(L).filter((k) => k[0] === "R").reduce((s, k) => s + L[k], 0);
        return { L, S, detail, hors, mode, totalProduits: totalVentes, totalCharges, resultat: totalVentes - totalCharges };
    }

    /**
     * Crée le HTML pour le Compte de Résultat avec synchronisation ligne par ligne
     * (vue simple, celle que les clients connaissent)
     */
    function renderCompteDeResultat(data, ventes = null, mode = "revente") {
        const calcul = calculerSyscohada(data, ventes, mode);

        // Charges d'exploitation : catégories habituelles d'abord, puis celles du client
        const chargesExploitationItems = LIGNES_EXPLOITATION
            .flatMap((ligne) => calcul.detail[ligne] || [])
            .sort((a, b) => {
                const ia = ORDRE_CATEGORIES.indexOf(a.label), ib = ORDRE_CATEGORIES.indexOf(b.label);
                return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
            });
        const chargesExploitation = chargesExploitationItems.reduce((s, x) => s + x.amount, 0);

        const chargesFinancieres = calcul.L.RM || 0;
        const chargesExceptionnelles = calcul.L.RP || 0;
        const impotsBenefices = calcul.L.RS || 0;
        const totalCharges = calcul.totalCharges;
        const totalProduits = calcul.totalProduits;
        const resultat = calcul.resultat;

        const isBenefice = resultat >= 0;
        const resultLabel = isBenefice ? "Bénéfice" : "Perte";
        const resultAmount = Math.abs(resultat);
        // Les deux colonnes s'équilibrent : produits + perte = charges + bénéfice
        const totalGeneral = Math.max(totalProduits, totalCharges);

        // Construire les lignes synchronisées
        const maxExploitationItems = Math.max(chargesExploitationItems.length, 1);
        
        return `
            <div id="compte-resultat" class="mt-4">
                <style>
                    /* Forcer une hauteur minimale uniforme par ligne (Charge ↔ Produit) */
                    #compte-resultat .grid.grid-cols-2 > div { min-height: 48px; display: flex; align-items: center; }
                    /* Le libellé est long, le montant court : on cesse de partager
                       la ligne en deux moitiés égales. minmax(0,...) autorise les
                       cellules à se réduire au lieu de déborder l'une sur l'autre. */
                    #compte-resultat .grid.grid-cols-2 { grid-template-columns: minmax(0, 1.7fr) minmax(0, 1fr); }
                    #compte-resultat .grid.grid-cols-2 > div:last-child { justify-content: flex-end; }
                    /* Sur téléphone, les deux colonnes Charges et Produits sont
                       empilées : chacune dispose de toute la largeur, et on
                       resserre les marges pour laisser respirer le texte. */
                    @media (max-width: 767px) {
                        #compte-resultat { font-size: 0.8125rem; }
                        #compte-resultat .px-4 { padding-left: 0.625rem; padding-right: 0.625rem; }
                    }
                    /* Les fonds pastel restent clairs en mode sombre alors que le texte
                       passe en clair par héritage : on force un texte foncé lisible.
                       Les montants colorés (text-green-600 / text-red-600) gardent leur
                       couleur, une classe posée sur l'élément l'emportant sur l'héritage. */
                    #compte-resultat .bg-orange-100,
                    #compte-resultat .bg-orange-200,
                    #compte-resultat .bg-teal-100,
                    #compte-resultat .bg-teal-200 { color: #1f2937; }
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
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- COLONNE GAUCHE: CHARGES -->
                    <div class="border border-orange-300">
                        <div class="bg-orange-700 text-white px-4 py-3 font-bold text-center">Charges</div>
                        <div class="text-sm">
                            <div class="grid grid-cols-2 bg-orange-100"><div class="px-4 py-2 font-semibold">Charges d'exploitation</div><div class="px-4 py-2 text-right whitespace-nowrap"></div></div>
                            ${chargesExploitationItems.map(item => `<div class="grid grid-cols-2"><div class="px-4 py-2">${item.label}</div><div class="px-4 py-2 text-right whitespace-nowrap">${item.amount.toFixed(2).replace('.', ',')} FCFA</div></div>`).join('')}
                            <div class="grid grid-cols-2 bg-orange-200 font-semibold"><div class="px-4 py-2">Total charges d'exploitation</div><div class="px-4 py-2 text-right whitespace-nowrap">${chargesExploitation.toFixed(2).replace('.', ',')} FCFA</div></div>
                            
                            <div class="grid grid-cols-2 bg-orange-100"><div class="px-4 py-2 font-semibold">Charges financières</div><div class="px-4 py-2 text-right whitespace-nowrap"></div></div>
                            ${chargesFinancieres > 0 ? `<div class="grid grid-cols-2"><div class="px-4 py-2">Intérêts d'emprunt</div><div class="px-4 py-2 text-right whitespace-nowrap">${chargesFinancieres.toFixed(2).replace('.', ',')} FCFA</div></div>` : ''}
                            <div class="grid grid-cols-2 bg-orange-200 font-semibold"><div class="px-4 py-2">Total charges financières</div><div class="px-4 py-2 text-right whitespace-nowrap">${chargesFinancieres.toFixed(2).replace('.', ',')} FCFA</div></div>
                            
                            <div class="grid grid-cols-2 bg-orange-100"><div class="px-4 py-2 font-semibold">Charges exceptionnelles</div><div class="px-4 py-2 text-right whitespace-nowrap"></div></div>
                            ${chargesExceptionnelles > 0 ? `<div class="grid grid-cols-2"><div class="px-4 py-2">Amendes et pénalités</div><div class="px-4 py-2 text-right whitespace-nowrap">${chargesExceptionnelles.toFixed(2).replace('.', ',')} FCFA</div></div>` : ''}
                            <div class="grid grid-cols-2 bg-orange-200 font-semibold"><div class="px-4 py-2">Total charges exceptionnelles</div><div class="px-4 py-2 text-right whitespace-nowrap">${chargesExceptionnelles.toFixed(2).replace('.', ',')} FCFA</div></div>
                            
                            ${impotsBenefices > 0 ? `<div class="grid grid-cols-2 bg-orange-100"><div class="px-4 py-2 font-semibold">Impôts sur les bénéfices</div><div class="px-4 py-2 text-right whitespace-nowrap">${impotsBenefices.toFixed(2).replace('.', ',')} FCFA</div></div>` : ''}
                            
                            <div class="grid grid-cols-2 bg-orange-800 text-white font-bold"><div class="px-4 py-2">Total des charges</div><div class="px-4 py-2 text-right whitespace-nowrap">${totalCharges.toFixed(2).replace('.', ',')} FCFA</div></div>
                            
                            ${isBenefice ? `<div class="grid grid-cols-2 bg-orange-100"><div class="px-4 py-2 font-semibold">${resultLabel}</div><div class="px-4 py-2 text-right font-semibold text-green-600">${resultAmount.toFixed(2).replace('.', ',')} FCFA</div></div>` : ''}
                            
                            <div class="grid grid-cols-2 bg-orange-900 text-white font-bold"><div class="px-4 py-2">Total général</div><div class="px-4 py-2 text-right whitespace-nowrap">${totalGeneral.toFixed(2).replace('.', ',')} FCFA</div></div>
                        </div>
                    </div>

                    <!-- COLONNE DROITE: PRODUITS -->
                    <div class="border border-teal-300">
                        <div class="bg-teal-700 text-white px-4 py-3 font-bold text-center">Produits</div>
                        <div class="text-sm">
                            <div class="grid grid-cols-2 bg-teal-100"><div class="px-4 py-2 font-semibold">Produits d'exploitation</div><div class="px-4 py-2 text-right whitespace-nowrap"></div></div>
                            <div class="grid grid-cols-2"><div class="px-4 py-2">Ventes de produits/services</div><div class="px-4 py-2 text-right whitespace-nowrap">${totalProduits.toFixed(2).replace('.', ',')} FCFA</div></div>
                            ${Array(Math.max(0, chargesExploitationItems.length - 1)).fill(0).map(() => `<div class="grid grid-cols-2"><div class="px-4 py-5"></div><div class="px-4 py-5 text-right"></div></div>`).join('')}
                            <div class="grid grid-cols-2 bg-teal-200 font-semibold"><div class="px-4 py-2">Total produits d'exploitation</div><div class="px-4 py-2 text-right whitespace-nowrap">${totalProduits.toFixed(2).replace('.', ',')} FCFA</div></div>
                            
                            <div class="grid grid-cols-2 bg-teal-100"><div class="px-4 py-2 font-semibold">Produits financiers</div><div class="px-4 py-2 text-right whitespace-nowrap"></div></div>
                            ${chargesFinancieres > 0 ? `<div class="grid grid-cols-2"><div class="px-4 py-2"></div><div class="px-4 py-2 text-right whitespace-nowrap"></div></div>` : ''}
                            <div class="grid grid-cols-2 bg-teal-200 font-semibold"><div class="px-4 py-2">Total produits financiers</div><div class="px-4 py-2 text-right whitespace-nowrap">0.00 FCFA</div></div>
                            
                            <div class="grid grid-cols-2 bg-teal-100"><div class="px-4 py-2 font-semibold">Produits exceptionnels</div><div class="px-4 py-2 text-right whitespace-nowrap"></div></div>
                            ${chargesExceptionnelles > 0 ? `<div class="grid grid-cols-2"><div class="px-4 py-2"></div><div class="px-4 py-2 text-right whitespace-nowrap"></div></div>` : ''}
                            <div class="grid grid-cols-2 bg-teal-200 font-semibold"><div class="px-4 py-2">Total produits exceptionnels</div><div class="px-4 py-2 text-right whitespace-nowrap">0.00 FCFA</div></div>
                            
                            ${!isBenefice ? `<div class="grid grid-cols-2 bg-teal-100"><div class="px-4 py-2 font-semibold">${resultLabel}</div><div class="px-4 py-2 text-right font-semibold text-red-600">${resultAmount.toFixed(2).replace('.', ',')} FCFA</div></div>` : ''}
                            
                            <div class="grid grid-cols-2 bg-teal-800 text-white font-bold"><div class="px-4 py-2">Total des produits</div><div class="px-4 py-2 text-right whitespace-nowrap">${totalProduits.toFixed(2).replace('.', ',')} FCFA</div></div>

                            <div class="grid grid-cols-2 bg-teal-900 text-white font-bold"><div class="px-4 py-2">Total général</div><div class="px-4 py-2 text-right whitespace-nowrap">${totalGeneral.toFixed(2).replace('.', ',')} FCFA</div></div>
                        </div>
                    </div>
                </div>
                ${noteHorsResultat(calcul.hors)}
            </div>
        `;
    }

    // Sorties d'argent qui ne sont pas des charges : dites, mais pas comptées
    function noteHorsResultat(hors) {
        if (!hors.length) return "";
        const liste = hors.map((h) => `${echapperHtml(h.label)} : ${Math.round(h.amount).toLocaleString("fr-FR")} FCFA`).join(" · ");
        return `<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">Non compris dans les charges (sorties d'argent qui ne sont pas des charges) : ${liste}. Ils figurent dans le tableau de flux de trésorerie.</p>`;
    }

    // ── Compte de résultat au format SYSCOHADA révisé (tableau en liste) ──
    const LIGNES_COMPTE = [
        ["TA", "Ventes de marchandises", "+"],
        ["RA", "Achats de marchandises", "-"],
        ["RB", "Variation de stocks de marchandises", "-"],
        ["XA", "MARGE COMMERCIALE (somme TA à RB)"],
        ["TB", "Ventes de produits fabriqués", "+"],
        ["TC", "Travaux, services vendus", "+"],
        ["TD", "Produits accessoires", "+"],
        ["XB", "CHIFFRE D'AFFAIRES (A + B + C + D)"],
        ["TE", "Production stockée (ou déstockage)", "+"],
        ["TF", "Production immobilisée", "+"],
        ["TG", "Subventions d'exploitation", "+"],
        ["TH", "Autres produits", "+"],
        ["TI", "Transferts de charges d'exploitation", "+"],
        ["RC", "Achats de matières premières et fournitures liées", "-"],
        ["RD", "Variation de stocks de matières premières et fournitures liées", "-"],
        ["RE", "Autres achats", "-"],
        ["RF", "Variation de stocks d'autres approvisionnements", "-"],
        ["RG", "Transports", "-"],
        ["RH", "Services extérieurs", "-"],
        ["RI", "Impôts et taxes", "-"],
        ["RJ", "Autres charges", "-"],
        ["XC", "VALEUR AJOUTÉE (XB + RA + RB) + (somme TE à RJ)"],
        ["RK", "Charges de personnel", "-"],
        ["XD", "EXCÉDENT BRUT D'EXPLOITATION (XC + RK)"],
        ["TJ", "Reprises d'amortissements, provisions et dépréciations", "+"],
        ["RL", "Dotations aux amortissements, aux provisions et dépréciations", "-"],
        ["XE", "RÉSULTAT D'EXPLOITATION (XD + TJ + RL)"],
        ["TK", "Revenus financiers et assimilés", "+"],
        ["TL", "Reprises de provisions et dépréciations financières", "+"],
        ["TM", "Transferts de charges financières", "+"],
        ["RM", "Frais financiers et charges assimilées", "-"],
        ["RN", "Dotations aux provisions et aux dépréciations financières", "-"],
        ["XF", "RÉSULTAT FINANCIER (somme TK à RN)"],
        ["XG", "RÉSULTAT DES ACTIVITÉS ORDINAIRES (XE + XF)"],
        ["TN", "Produits des cessions d'immobilisations", "+"],
        ["TO", "Autres produits HAO", "+"],
        ["RO", "Valeur comptable des cessions d'immobilisations", "-"],
        ["RP", "Autres charges HAO", "-"],
        ["XH", "RÉSULTAT HORS ACTIVITÉS ORDINAIRES (somme TN à RP)"],
        ["RQ", "Participation des travailleurs", "-"],
        ["RS", "Impôts sur le résultat", "-"],
        ["XI", "RÉSULTAT NET (XG + XH + RQ + RS)"]
    ];

    /**
     * @param cur   calculerSyscohada de la période
     * @param prev  calculerSyscohada de la période précédente, ou null
     * @param meta  { periode, periodePrec }
     */
    function renderCompteSyscohada(cur, prev, meta) {
        const org = (() => { try { return JSON.parse(localStorage.getItem("ogo_org") || "null") || {}; } catch (e) { return {}; } })();
        const montant = (calcul, ref, signe) => {
            if (!calcul) return "";
            const brut = ref[0] === "X" ? calcul.S[ref] : (calcul.L[ref] || 0);
            const val = signe === "-" ? -brut : brut;
            if (!val) return "-";
            return (val < 0 ? "−" : "") + Math.round(Math.abs(val)).toLocaleString("fr-FR");
        };
        const td = "padding:5px 8px;border:1px solid #cbd5e1;font-size:12px";
        const lignes = LIGNES_COMPTE.map(([ref, libelle, signe]) => {
            const solde = ref[0] === "X";
            const fond = ref === "XI" ? "background:#0B2A5B;color:#fff;" : solde ? "background:#e2e8f0;" : "";
            const gras = solde ? "font-weight:700;" : "";
            return `<tr style="${fond}${gras}">
                <td class="cs-ref" style="${td};text-align:center;width:44px">${ref}</td>
                <td style="${td}">${libelle}</td>
                <td class="cs-signe" style="${td};text-align:center;width:28px">${signe || ""}</td>
                <td style="${td};text-align:right;white-space:nowrap">${montant(cur, ref, signe)}</td>
                <td style="${td};text-align:right;white-space:nowrap">${montant(prev, ref, signe)}</td>
            </tr>`;
        }).join("");
        const enTete = (texte, classe = "") => `<th class="${classe}" style="${td};background:#0B2A5B;color:#fff;text-align:center">${texte}</th>`;
        const champ = (libelle, valeur) => valeur ? `<div><span style="color:#64748b">${libelle} :</span> <strong>${echapperHtml(valeur)}</strong></div>` : "";
        const remarques = [
            "Établi à partir des opérations enregistrées dans OGOUE. Document non certifié par un expert-comptable.",
            "Ventes et dépenses comptées à leur date, payées ou non (ventes et achats à crédit compris).",
            cur.mode === "les_deux"
                ? "Activité mixte : chaque produit est classé selon le catalogue, fabriqué (TB) ou revendu (TA) ; matières premières en RC, achats de marchandises en RA."
                : cur.mode === "fabrication"
                ? "Activité de fabrication : ventes de produits en produits fabriqués (TB), achats en matières premières (RC)."
                : "Activité de revente : ventes de produits en marchandises (TA), achats en marchandises (RA). Modifiable dans « Ma boutique ».",
            "Stocks non valorisés : les variations de stocks (RB, RD, RF) ne sont pas calculées.",
            "Amortissements non calculés : les achats de matériel ne sont pas des charges de la période."
        ];
        if (cur.hors.length) {
            remarques.push("Hors compte de résultat : " + cur.hors.map((h) => `${echapperHtml(h.label)} ${Math.round(h.amount).toLocaleString("fr-FR")} FCFA`).join(", ") + ".");
        }
        if (!prev) remarques.push("Période précédente non disponible.");
        // Téléphone : sans la colonne des signes, texte et marges réduits, les
        // libellés passent à la ligne. Le tableau tient dans l'écran sans défiler.
        const styleMobile = `<style>@media (max-width: 640px) {
            #compte-syscohada .cs-table { min-width: 0 !important; }
            #compte-syscohada .cs-signe { display: none; }
            #compte-syscohada td, #compte-syscohada th { padding: 4px 5px !important; font-size: 11px !important; }
            #compte-syscohada .cs-ref { width: 28px !important; }
            #compte-syscohada .cs-dates { font-size: 9.5px; font-weight: 400; }
        }</style>`;
        return `<div id="compte-syscohada" style="color:#0f172a;background:#fff;padding:4px">${styleMobile}
            <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 24px;font-size:12px;margin-bottom:10px">
                <div>${champ("Entreprise", org.name)}${champ("RCCM", org.rccm)}${champ("NIF", org.nif)}</div>
                <div style="text-align:right"><div><strong>COMPTE DE RÉSULTAT — SYSCOHADA révisé</strong></div>
                    <div>Période : ${meta.periode}</div><div style="color:#64748b">Montants en FCFA</div></div>
            </div>
            <div style="overflow-x:auto"><table class="cs-table" style="width:100%;border-collapse:collapse;min-width:520px">
                <thead><tr>${enTete("REF", "cs-ref")}${enTete("LIBELLÉS")}${enTete("", "cs-signe")}${enTete(`PÉRIODE<br><span class="cs-dates">${meta.periode}</span>`)}${enTete(`PÉRIODE PRÉCÉDENTE<br><span class="cs-dates">${meta.periodePrec || "—"}</span>`)}</tr></thead>
                <tbody>${lignes}</tbody>
            </table></div>
            <ul style="margin:10px 0 0 16px;padding:0;font-size:11px;color:#475569;list-style:disc">${remarques.map((r) => `<li>${r}</li>`).join("")}</ul>
        </div>`;
    }

    // Période de même longueur, juste avant
    function periodePrecedente(debut, fin) {
        if (!debut) return null;
        const d = new Date(debut + "T12:00:00"), f = new Date((fin || debut) + "T12:00:00");
        const jours = Math.round((f - d) / 86400000) + 1;
        const finPrec = new Date(d); finPrec.setDate(finPrec.getDate() - 1);
        const debutPrec = new Date(finPrec); debutPrec.setDate(debutPrec.getDate() - jours + 1);
        return { debut: getLocalDateString(debutPrec), fin: getLocalDateString(finPrec) };
    }

    /**
     * Les deux présentations du compte de résultat : la vue simple (écran)
     * et le format SYSCOHADA (impression), avec la période précédente.
     */
    async function construireComptes(debut, fin, ventes) {
        const [compte, mode] = await Promise.all([generateCompteDeResultat(debut, fin), lireModeActivite()]);
        const fabriques = mode === "les_deux" ? await lireProduitsFabriques() : null;
        const cur = calculerSyscohada(compte, ventes, mode, fabriques);
        let prev = null;
        const p = periodePrecedente(debut, fin);
        if (p) {
            try {
                const [etatsPrec, ventesPrec] = await Promise.all([
                    chargerEtats(p.debut, p.fin),
                    window.OGOUE.getVentesPourPlage ? window.OGOUE.getVentesPourPlage(p.debut, p.fin) : null
                ]);
                // Période coupée par la limite d'historique de la formule : chiffres partiels, on ne les montre pas
                if (etatsPrec.compteResultat && !etatsPrec.periode?.tronque) prev = calculerSyscohada(etatsPrec.compteResultat, ventesPrec, mode, fabriques);
            } catch (e) { prev = null; }
        }
        const libelle = (a, b) => (a ? `${formatDateFR(a)} au ${formatDateFR(b || a)}` : "toutes les opérations");
        return {
            simple: renderCompteDeResultat(compte, ventes, mode),
            syscohada: renderCompteSyscohada(cur, prev, { periode: libelle(debut, fin), periodePrec: p && prev ? libelle(p.debut, p.fin) : "" })
        };
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
                            <td class="px-4 py-3 font-semibold">Flux Entrants (argent encaissé)</td>
                            <td class="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400">${data.fluxEntrants.toFixed(2)} FCFA</td>
                        </tr>
        `;
        
        // Détails des moyens de paiement entrants
        const LIBELLES_MOYENS = { cash: "Cash", mobile_money: "Mobile Money" };
        const libelleMoyen = (m) => LIBELLES_MOYENS[m] || m;
        Object.entries(data.ventesByPayment).forEach(([method, amount]) => {
            html += `
                        <tr class="border-b border-[#cfe7e3] dark:border-gray-700">
                            <td class="px-4 py-3">&nbsp;&nbsp;Ventes payées en ${libelleMoyen(method)}</td>
                            <td class="px-4 py-3 text-right">${amount.toFixed(2)} FCFA</td>
                        </tr>
            `;
        });
        // Crédits clients réglés pendant la période (l'argent arrive à ce moment-là)
        Object.entries(data.creditsEncaissesByPayment || {}).forEach(([method, amount]) => {
            html += `
                        <tr class="border-b border-[#cfe7e3] dark:border-gray-700">
                            <td class="px-4 py-3">&nbsp;&nbsp;Crédits clients encaissés en ${libelleMoyen(method)}</td>
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
                            <td class="px-4 py-3">&nbsp;&nbsp;Dépenses payées en ${libelleMoyen(method)}</td>
                            <td class="px-4 py-3 text-right">${amount.toFixed(2)} FCFA</td>
                        </tr>
            `;
        });
        // Dépenses à crédit payées pendant la période (l'argent sort à ce moment-là)
        Object.entries(data.dettesPayeesByPayment || {}).forEach(([method, amount]) => {
            html += `
                        <tr class="border-b border-[#cfe7e3] dark:border-gray-700">
                            <td class="px-4 py-3">&nbsp;&nbsp;Dettes payées en ${libelleMoyen(method)}</td>
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

        // Crédits clients : vendus mais pas encore encaissés, hors flux
        if (data.ventesACredit || data.creancesFinPeriode) {
            html += `
            <div class="mt-4 overflow-x-auto rounded-lg border border-orange-200 dark:border-orange-900/50">
                <table class="w-full text-sm">
                    <tbody>
                        <tr class="border-b border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/20">
                            <td class="px-4 py-3 font-semibold" colspan="2">Crédits clients (pas encore de l'argent en caisse)</td>
                        </tr>
                        <tr class="border-b border-orange-200 dark:border-orange-900/50">
                            <td class="px-4 py-3">&nbsp;&nbsp;Vendu à crédit sur la période</td>
                            <td class="px-4 py-3 text-right">${(data.ventesACredit || 0).toFixed(2)} FCFA</td>
                        </tr>
                        <tr>
                            <td class="px-4 py-3 font-semibold">Créances clients en fin de période</td>
                            <td class="px-4 py-3 text-right font-semibold text-orange-600 dark:text-orange-400">${(data.creancesFinPeriode || 0).toFixed(2)} FCFA</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Une vente à crédit compte dans le chiffre d'affaires dès la vente (compte de résultat). Elle n'entre dans la trésorerie que le jour où le client la règle.</p>
            `;
        }

        // Dépenses à crédit : achetées mais pas encore payées, hors flux
        if (data.achatsACredit || data.dettesFinPeriode) {
            html += `
            <div class="mt-4 overflow-x-auto rounded-lg border border-orange-200 dark:border-orange-900/50">
                <table class="w-full text-sm">
                    <tbody>
                        <tr class="border-b border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-950/20">
                            <td class="px-4 py-3 font-semibold" colspan="2">Dépenses à crédit (pas encore de l'argent sorti)</td>
                        </tr>
                        <tr class="border-b border-orange-200 dark:border-orange-900/50">
                            <td class="px-4 py-3">&nbsp;&nbsp;Acheté à crédit sur la période</td>
                            <td class="px-4 py-3 text-right">${(data.achatsACredit || 0).toFixed(2)} FCFA</td>
                        </tr>
                        <tr>
                            <td class="px-4 py-3 font-semibold">Dettes restant à payer en fin de période</td>
                            <td class="px-4 py-3 text-right font-semibold text-orange-600 dark:text-orange-400">${(data.dettesFinPeriode || 0).toFixed(2)} FCFA</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">Une dépense à crédit compte dans vos charges dès sa date (compte de résultat). Elle ne sort de la trésorerie que le jour où vous la payez.</p>
            `;
        }
        
        return html;
    }

    /**
     * Branche les boutons de suppression d'un historique.
     *
     * Reprend le mecanisme de module_ventes : la suppression passe par
     * DeletionAuditManager, qui demande un motif et l'enregistre dans la
     * piste d'audit avant d'appeler l'API. La ligne disparait ensuite en
     * fondu, sans recharger tout l'ecran.
     *
     * @param {HTMLElement} conteneur
     * @param {"vente"|"depense"} nature
     */
    async function brancherSuppressions(conteneur, nature) {
        // API_BASE_URL vient de ogoue-state.js, charge avant ce fichier.
        // Le repli evite une panne silencieuse si l'ordre venait a changer.
        const base = typeof API_BASE_URL !== "undefined"
            ? API_BASE_URL
            : (["localhost", "127.0.0.1"].includes(window.location.hostname)
                ? "http://localhost:3001"
                : (/^192\.168\./.test(location.hostname) ? "http://" + location.hostname + ":3001" : "https://api.ogoue.com"));

        const config = {
            vente: {
                selecteur: ".supprimer-vente",
                ligne: (id) => `tr[data-vente-id="${id}"]`,
                url: (id) => `${base}/api/sales/${id}`,
                titre: "Supprimer cette vente ?",
                type: "sale",
                cle: "ventes",
                cleHtml: "ventesHtml",
                intitule: "Historique des Ventes",
                rendu: renderHistoriqueVentes,
            },
            depense: {
                selecteur: ".supprimer-depense",
                ligne: (id) => `tr[data-depense-id="${id}"]`,
                url: (id) => `${base}/api/expenses/${id}`,
                titre: "Supprimer cette dépense ?",
                type: "expense",
                cle: "depenses",
                cleHtml: "depensesHtml",
                intitule: "Historique des Dépenses",
                rendu: renderHistoriqueDepenses,
            },
        }[nature];

        const boutons = conteneur.querySelectorAll(config.selecteur);
        if (boutons.length === 0) return;

        const { default: DeletionAuditManager } = await import("./deletion-audit.js");

        boutons.forEach((bouton) => {
            bouton.addEventListener("click", async () => {
                const id = bouton.getAttribute("data-id");

                const resultat = await DeletionAuditManager.deleteWithAudit(config.url(id), {
                    title: config.titre,
                    message: "Vous êtes sur le point de supprimer cet enregistrement. Veuillez expliquer le motif de cette suppression.",
                    recordType: config.type,
                    recordId: id,
                });

                if (!resultat.success) {
                    console.error("❌ Erreur suppression:", resultat.error);
                    alert(`Erreur: ${resultat.error}`);
                    return;
                }

                const ligne = conteneur.querySelector(config.ligne(id));
                if (ligne) {
                    ligne.style.transition = "opacity 0.3s ease";
                    ligne.style.opacity = "0";
                    setTimeout(() => ligne.remove(), 300);
                }

                // Garder en phase les donnees qui alimentent l'export Excel et
                // l'impression : sans cela, une ligne supprimee y reparaitrait.
                const donnees = window.etatFinanciersData;
                if (donnees && Array.isArray(donnees[config.cle])) {
                    donnees[config.cle] = donnees[config.cle].filter((e) => String(e.id) !== String(id));

                    const restants = donnees[config.cle];
                    donnees[config.cleHtml] = `<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-sm p-5">
                    <h3 class="text-lg font-bold mb-2">${config.intitule} (${restants.length})</h3>
                    ${config.rendu(restants)}
                </div>`;

                    const titre = conteneur.querySelector("h3");
                    if (titre) {
                        titre.textContent = titre.textContent.replace(/\(\d+\)/, `(${restants.length})`);
                    }
                }
            });
        });
    }

    /**
     * Crée le HTML pour l'Historique des Ventes
     *
     * @param {Array} ventes
     * @param {boolean} avecActions - ajoute la colonne de suppression.
     *   Volontairement optionnel : la même fonction sert à l'impression,
     *   où un bouton n'aurait aucun sens sur le papier.
     */
    /**
     * Neutralise le texte saisi par l'utilisateur avant insertion dans du
     * HTML. Les tableaux sont assemblés en chaînes : sans cela, un
     * commentaire contenant « < » casserait la mise en page, et un
     * `<img onerror=…>` s'exécuterait dans le navigateur du gérant.
     */
    function echapperHtml(valeur) {
        return String(valeur ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /** Cellule « Commentaire » : tronquée à l'écran, complète au survol. */
    function celluleCommentaire(note) {
        if (!note) return '<td class="px-4 py-3 text-xs">-</td>';
        const t = echapperHtml(note);
        // Un clic ouvre le texte entier (commentaire-complet.js) : le
        // survol seul ne servait a rien sur telephone.
        return `<td class="px-4 py-3 text-xs"><button type="button" class="commentaire-complet block max-w-[16rem] truncate text-left underline decoration-dotted underline-offset-2 hover:text-primary" title="Lire le commentaire" data-commentaire="${t}">${t}</button></td>`;
    }

    const API_JUSTIF = (['localhost', '127.0.0.1'].some(h => location.hostname.includes(h)))
        ? 'http://localhost:3001'
        : (/^192\.168\./.test(location.hostname) ? 'http://' + location.hostname + ':3001' : 'https://api.ogoue.com');

    /**
     * Cellule « Justificatif » d'une ligne d'historique.
     *
     * Une vente peut etre couverte de deux facons : un fichier joint par
     * le gerant, ou le recu numerote qu'OGOUE edite lui-meme. Cet ecran
     * ne connaissait que la premiere, et affichait « - » sur une vente
     * parfaitement justifiee — alors que module_ventes, lui, montrait le
     * recu. Les deux tableaux disent desormais la meme chose.
     *
     * Aucune URL n'est posee dans le tableau : le bucket est prive, les
     * liens se signent a la demande au clic.
     */
    function celluleJustificatifHtml(ligne, genre) {
        if (ligne.justificatif) {
            return `<span class="font-medium text-primary cursor-pointer hover:underline justificatif-link inline-flex items-center gap-1"
                          title="Ouvrir le justificatif joint"
                          data-file="${echapperHtml(ligne.justificatif)}" data-justif-id="${echapperHtml(ligne.id)}" data-justif-genre="${genre}" data-justif-quoi="fichier">
                      <span class="material-symbols-outlined text-[14px] flex-shrink-0">attach_file</span>${echapperHtml(ligne.justificatif)}
                    </span>`;
        }
        if (genre === "vente" && ligne.numeroRecu) {
            return `<span class="font-medium text-primary cursor-pointer hover:underline justificatif-link inline-flex items-center gap-1 whitespace-nowrap"
                          title="Ouvrir le reçu ${echapperHtml(ligne.numeroRecu)}"
                          data-file="${echapperHtml(ligne.numeroRecu)}" data-justif-id="${echapperHtml(ligne.id)}" data-justif-genre="vente" data-justif-quoi="recu">
                      <span class="material-symbols-outlined text-[14px]">description</span>${echapperHtml(ligne.numeroRecu)}
                    </span>`;
        }
        return "-";
    }

    /** Ouvre au clic le document de la ligne, par un lien signe. */
    function brancherJustificatifs(conteneur) {
        conteneur.querySelectorAll('.justificatif-link').forEach(link => {
            link.addEventListener('click', async () => {
                const nom = link.getAttribute('data-file');
                const id = link.getAttribute('data-justif-id');
                const genre = link.getAttribute('data-justif-genre');
                const quoi = link.getAttribute('data-justif-quoi');

                const chemin = quoi === 'recu'
                    ? `/api/sales/${id}/recu`
                    : `/api/${genre === 'vente' ? 'sales' : 'expenses'}/${id}/justificatif`;

                const libelle = link.innerHTML;
                link.innerHTML = '<span class="material-symbols-outlined text-[14px]">hourglass_top</span> …';
                try {
                    const reponse = await fetch(`${API_JUSTIF}${chemin}`, {
                        headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }
                    });
                    const data = await reponse.json();
                    if (!reponse.ok) throw new Error(data.error || "Document indisponible");
                    // Le reçu est un PDF fabriqué par OGOUE : il s'ouvre
                    // dans un onglet, comme dans module_ventes. Le fichier
                    // joint garde son aperçu, qui sait afficher une image.
                    if (quoi === 'recu') window.open(data.url, '_blank', 'noopener');
                    else openJustificatifModal(nom, data.url);
                } catch (erreur) {
                    console.error('Erreur justificatif:', erreur);
                    alert("Le document n'a pas pu être ouvert : " + erreur.message);
                } finally {
                    link.innerHTML = libelle;
                }
            });
        });
    }

    // État des ventes à crédit (id → { reste, soldeLe, soldeMoyen, client }),
    // chargé avec l'historique des ventes depuis les crédits clients
    let creditsVentes = {};
    async function chargerCreditsVentes() {
        if (!window.OGOUE?.getCredits) return;
        const r = await window.OGOUE.getCredits();
        if (r.ok) creditsVentes = window.OGOUE.resumerCredits(r.ventes, r.reglements).parVente || {};
    }
    const etatCreditVente = (v) => {
        if ((v.moyen_paiement || v.moyenPaiement) !== "credit") return "comptant";
        const info = creditsVentes[v.id];
        return info && info.reste <= 0 ? "regle" : "credit";
    };
    function celluleMoyenVente(v, avecActions) {
        const moyenBrut = v.moyen_paiement || v.moyenPaiement || "";
        const libelles = { cash: "Cash", mobile_money: "Mobile Money" };
        if (moyenBrut !== "credit") return echapperHtml(libelles[moyenBrut] || moyenBrut || "-");
        const info = creditsVentes[v.id];
        if (info && info.reste <= 0) {
            return `${echapperHtml(libelles[info.soldeMoyen] || "Réglé")}<span class="block text-[11px] text-gray-500 dark:text-gray-400">crédit réglé le ${formatDateFR(info.soldeLe)}</span>`;
        }
        let html = "Crédit";
        if (info && info.reste < (parseFloat(v.montant) || 0)) html += `<span class="block text-[11px] text-gray-500 dark:text-gray-400">reste ${info.reste.toLocaleString("fr-FR")} FCFA</span>`;
        if (avecActions && info) {
            html += `<span class="payer-vente mt-1 flex flex-wrap items-center gap-1" data-id="${echapperHtml(v.id)}">
                <button type="button" class="payer-ouvrir h-7 px-3 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary/90">Payer</button></span>`;
        }
        return html;
    }

    // « Payer » une vente à crédit : un paiement du client pour ce qui reste dû sur cette vente
    function brancherPaiementsVentes(conteneur) {
        if (conteneur.dataset.payerVentesBranche) return;
        conteneur.dataset.payerVentesBranche = "1";
        conteneur.addEventListener("click", async (e) => {
            const zone = e.target.closest(".payer-vente");
            if (!zone) return;
            if (e.target.closest(".payer-ouvrir")) {
                zone.innerHTML =
                    '<span class="text-[11px] text-gray-500">Payé en :</span>' +
                    '<button type="button" data-moyen="cash" class="h-7 px-2.5 rounded-full bg-[#0d1b19] text-white text-xs font-bold">Cash</button>' +
                    '<button type="button" data-moyen="mobile_money" class="h-7 px-2.5 rounded-full bg-[#0d1b19] text-white text-xs font-bold">Mobile Money</button>' +
                    '<button type="button" data-renoncer class="h-7 px-1 text-xs text-gray-500 hover:underline">Annuler</button>';
                return;
            }
            if (e.target.closest("[data-renoncer]")) {
                zone.innerHTML = '<button type="button" class="payer-ouvrir h-7 px-3 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary/90">Payer</button>';
                return;
            }
            const moyen = e.target.closest("[data-moyen]")?.dataset.moyen;
            if (!moyen) return;
            const id = zone.dataset.id;
            const info = creditsVentes[id];
            if (!info || !(info.reste > 0)) return;
            zone.querySelectorAll("button").forEach((b) => { b.disabled = true; });
            const r = await window.OGOUE.enregistrerReglement({ venteId: id, montant: info.reste, moyen, nature: "paiement" });
            if (!r.ok) { alert(r.error); zone.querySelectorAll("button").forEach((b) => { b.disabled = false; }); return; }
            await chargerCreditsVentes();
            // Toutes les lignes à crédit du même client peuvent avoir changé : on les redessine
            const donnees = window.etatFinanciersData;
            conteneur.querySelectorAll("tr[data-vente-id]").forEach((tr) => {
                const v = (donnees?.ventes || []).find((x) => String(x.id) === tr.dataset.venteId);
                if (!v || (v.moyen_paiement || v.moyenPaiement) !== "credit") return;
                tr.dataset.etatCredit = etatCreditVente(v);
                const cellule = tr.querySelector("[data-moyen-cellule]");
                if (cellule) cellule.innerHTML = celluleMoyenVente(v, true);
            });
            if (donnees && Array.isArray(donnees.ventes)) {
                donnees.ventesHtml = `<h3>Historique des Ventes (${donnees.ventes.length})</h3>${renderHistoriqueVentes(donnees.ventes)}`;
            }
            try { sessionStorage.removeItem("ogo_credits_retard"); } catch (err) {}
            window.OGOUE_badgeCredits?.rafraichir();
            window.OGOUE_FEEDBACK?.succes(`Crédit réglé · ${echapperHtml(info.client)} · ${info.reste.toLocaleString("fr-FR")} FCFA`);
            appliquerFiltreDepenses(conteneur);
        });
    }

    function renderHistoriqueVentes(ventes, avecActions = false) {
        if (ventes.length === 0) {
            return '<p class="mt-4 text-sm text-gray-500 dark:text-gray-400">Aucune vente pour cette période.</p>';
        }

        let html = `
            <div class="mt-4 overflow-x-auto rounded-lg border border-[#cfe7e3] dark:border-gray-700">
                <table data-cartes class="w-full text-sm">
                    <thead>
                        <tr class="bg-background-light dark:bg-background-dark border-b border-[#cfe7e3] dark:border-gray-700">
                            <th data-carte="meta" class="px-4 py-3 text-left font-semibold">Date</th>
                            <th data-carte="meta" class="px-4 py-3 text-left font-semibold">Heure</th>
                            <th data-carte="titre" class="px-4 py-3 text-left font-semibold">Produit</th>
                            <th data-carte="meta-lib" data-carte-lib="Qté" class="px-4 py-3 text-center font-semibold">Quantité</th>
                            <th data-carte="montant" class="px-4 py-3 text-right font-semibold">Montant</th>
                            <th data-carte="meta" class="px-4 py-3 text-left font-semibold">Moyen Paiement</th>
                            <th data-carte="meta" class="px-4 py-3 text-left font-semibold">Type</th>
                            <th class="px-4 py-3 text-left font-semibold">Créé par</th>
                            <th class="px-4 py-3 text-left font-semibold">Justificatif</th>
                            <th class="px-4 py-3 text-left font-semibold">Commentaire</th>
                            ${avecActions ? '<th data-carte="actions" class="px-4 py-3 text-center font-semibold">Action</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
        `;

        ventes.forEach(v => {
            const rawDate = v.date || v.saleDate || v.sale_date || "";
            const localDate = rawDate ? getLocalDateString(new Date(rawDate)) : "";
            const heure = v.created_at ? formatHeureGabon(new Date(v.created_at)) : "-";
            const produit = echapperHtml(v.description || "-");
            const quantite = v.quantite || 1;
            const montantNum = parseFloat(v.montant) || 0;
            const paiement = celluleMoyenVente(v, avecActions);
            const type = v.type_vente === "produits" ? "Produits" : v.type_vente === "services" ? "Service" : echapperHtml(v.type_vente || "-");
            const creePar = echapperHtml(v.created_by_name || "-");
            const justificatifHtml = celluleJustificatifHtml(v, "vente");

            html += `
                        <tr class="border-b border-[#cfe7e3] dark:border-gray-700" data-vente-id="${v.id}" data-etat-credit="${etatCreditVente(v)}">
                            <td class="px-4 py-3">${formatDateFR(localDate)}</td>
                            <td class="px-4 py-3">${heure}</td>
                            <td class="px-4 py-3">${produit}</td>
                            <td class="px-4 py-3 text-center">${quantite}</td>
                            <td class="px-4 py-3 text-right font-semibold">${montantNum.toFixed(2).replace('.', ',')} FCFA</td>
                            <td class="px-4 py-3" data-moyen-cellule>${paiement}</td>
                            <td class="px-4 py-3">${type}</td>
                            <td class="px-4 py-3">${creePar}</td>
                            <td class="px-4 py-3 text-xs">${justificatifHtml}</td>
                            ${celluleCommentaire(v.note)}
                            ${avecActions ? `
                            <td class="px-4 py-3 text-center">
                                <button type="button" class="supprimer-vente text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xl"
                                        title="Supprimer" aria-label="Supprimer cette vente" data-id="${v.id}">🗑️</button>
                            </td>` : ''}
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
     *
     * @param {Array} depenses
     * @param {boolean} avecActions - voir renderHistoriqueVentes.
     */
    // Moyen de paiement d'une dépense ; à crédit : date de remboursement prévue
    // et, quand les actions sont permises, le bouton « Payer » ; déjà payée :
    // le jour du paiement.
    function celluleMoyenDepense(d, avecActions) {
        const moyenBrut = d.moyen_paiement || d.moyenPaiement || "";
        const libellesMoyens = { cash: "Cash", mobile_money: "Mobile Money", credit: "Crédit" };
        let html = echapperHtml(libellesMoyens[moyenBrut] || moyenBrut || "-");
        if (moyenBrut === "credit") {
            if (d.credit_echeance) html += `<span class="block text-[11px] text-gray-500 dark:text-gray-400">à rembourser le ${formatDateFR(d.credit_echeance)}</span>`;
            if (avecActions && d.peut_agir !== false) {
                html += `<span class="payer-dette mt-1 flex flex-wrap items-center gap-1" data-id="${echapperHtml(d.id)}">
                    <button type="button" class="payer-ouvrir h-7 px-3 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary/90">Payer</button></span>`;
            }
        } else if (d.credit_regle_le) {
            html += `<span class="block text-[11px] text-gray-500 dark:text-gray-400">crédit payé le ${formatDateFR(getLocalDateString(new Date(d.credit_regle_le)))}</span>`;
        }
        return html;
    }

    /**
     * Bouton « Payer » des dépenses à crédit, comme dans la page Dépenses :
     * le moyen de paiement passe à Cash ou Mobile Money. La ligne, l'export
     * Excel et l'impression sont mis à jour sans recharger.
     */
    function brancherPaiementsDettes(conteneur) {
        if (conteneur.dataset.payerBranche) return;
        conteneur.dataset.payerBranche = "1";
        conteneur.addEventListener("click", async (e) => {
            const zone = e.target.closest(".payer-dette");
            if (!zone) return;
            if (e.target.closest(".payer-ouvrir")) {
                zone.innerHTML =
                    '<span class="text-[11px] text-gray-500">Payé en :</span>' +
                    '<button type="button" data-moyen="cash" class="h-7 px-2.5 rounded-full bg-[#0d1b19] text-white text-xs font-bold">Cash</button>' +
                    '<button type="button" data-moyen="mobile_money" class="h-7 px-2.5 rounded-full bg-[#0d1b19] text-white text-xs font-bold">Mobile Money</button>' +
                    '<button type="button" data-renoncer class="h-7 px-1 text-xs text-gray-500 hover:underline">Annuler</button>';
                return;
            }
            if (e.target.closest("[data-renoncer]")) {
                zone.innerHTML = '<button type="button" class="payer-ouvrir h-7 px-3 rounded-full bg-primary text-white text-xs font-bold hover:bg-primary/90">Payer</button>';
                return;
            }
            const moyen = e.target.closest("[data-moyen]")?.dataset.moyen;
            if (!moyen) return;
            const id = zone.dataset.id;
            zone.querySelectorAll("button").forEach((b) => { b.disabled = true; });
            const r = await window.OGOUE.reglerDepense(id, moyen);
            if (!r.ok) { alert(r.error); zone.querySelectorAll("button").forEach((b) => { b.disabled = false; }); return; }

            // Données en mémoire (export Excel, impression) et cellule de la ligne
            const maintenant = new Date().toISOString();
            const donnees = window.etatFinanciersData;
            let depense = null;
            (donnees?.depenses || []).forEach((d) => {
                if (String(d.id) === String(id)) { d.moyen_paiement = moyen; d.credit_regle_le = maintenant; depense = d; }
            });
            const ligneTr = zone.closest("tr[data-etat-credit]");
            if (ligneTr) ligneTr.dataset.etatCredit = "regle";
            const cellule = zone.closest("[data-moyen-cellule]");
            if (cellule) cellule.innerHTML = celluleMoyenDepense(depense || { moyen_paiement: moyen, credit_regle_le: maintenant }, true);
            if (donnees && Array.isArray(donnees.depenses)) {
                donnees.depensesHtml = `<h3>Historique des Dépenses (${donnees.depenses.length})</h3>${renderHistoriqueDepenses(donnees.depenses)}`;
            }
            window.OGOUE_FEEDBACK?.succes(`Dette payée en ${moyen === "cash" ? "Cash" : "Mobile Money"}`);
            appliquerFiltreDepenses(conteneur);
        });
    }

    const etatCreditDepense = (d) => ((d.moyen_paiement || d.moyenPaiement) === "credit" ? "credit" : d.credit_regle_le ? "regle" : "comptant");

    /**
     * Filtre de l'historique des dépenses : Tout / Crédit (encore à payer) /
     * Réglé (crédits déjà payés). Il agit sur les lignes affichées ; une
     * dette payée pendant qu'un filtre est actif change de groupe aussitôt.
     */
    const FILTRES_DEPENSES = [["tout", "Tout"], ["credit", "Crédit"], ["regle", "Réglé"]];
    function filtreDepensesHtml(nature = "depense") {
        return `<div class="mb-3 inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-1" data-filtre-credit data-nature="${nature}">${FILTRES_DEPENSES.map(([v, t], i) =>
            `<button type="button" data-filtre="${v}" class="px-4 h-9 rounded-full text-sm font-bold ${i === 0 ? "bg-white dark:bg-gray-600 shadow-sm text-[#0d1b19] dark:text-white" : "text-gray-500"}">${t} <span data-nb class="font-semibold opacity-70"></span></button>`).join("")}</div>`;
    }
    function appliquerFiltreDepenses(conteneur) {
        const zone = conteneur.querySelector("[data-filtre-credit]");
        if (!zone) return;
        const choisi = zone.dataset.choisi || "tout";
        const lignes = [...conteneur.querySelectorAll("tr[data-etat-credit]")];
        const nombre = { tout: lignes.length, credit: 0, regle: 0 };
        lignes.forEach((l) => {
            // « Réglé » = tout ce qui est payé : comptant (Cash, Mobile Money)
            // comme crédit soldé ensuite. « Crédit » = encore dû.
            const etat = l.dataset.etatCredit === "comptant" ? "regle" : l.dataset.etatCredit;
            if (etat in nombre) nombre[etat] += 1;
            l.style.display = choisi === "tout" || etat === choisi ? "" : "none";
        });
        zone.querySelectorAll("[data-filtre]").forEach((b) => {
            const on = b.dataset.filtre === choisi;
            ["bg-white", "dark:bg-gray-600", "shadow-sm", "text-[#0d1b19]", "dark:text-white"].forEach((k) => b.classList.toggle(k, on));
            b.classList.toggle("text-gray-500", !on);
            b.querySelector("[data-nb]").textContent = `(${nombre[b.dataset.filtre]})`;
        });
        const vide = conteneur.querySelector("[data-filtre-vide]");
        const visibles = choisi === "tout" ? lignes.length : nombre[choisi];
        if (vide) {
            vide.classList.toggle("hidden", visibles > 0);
            const vente = zone.dataset.nature === "vente";
            vide.textContent = choisi === "credit"
                ? (vente ? "Aucune vente à crédit en attente de paiement sur la période." : "Aucune dépense à crédit à payer sur la période.")
                : (vente ? "Aucune vente payée sur la période." : "Aucune dépense payée sur la période.");
        }
    }
    function brancherFiltreDepenses(conteneur) {
        const zone = conteneur.querySelector("[data-filtre-credit]");
        if (!zone) return;
        zone.addEventListener("click", (e) => {
            const b = e.target.closest("[data-filtre]");
            if (!b) return;
            zone.dataset.choisi = b.dataset.filtre;
            appliquerFiltreDepenses(conteneur);
        });
        appliquerFiltreDepenses(conteneur);
    }

    function renderHistoriqueDepenses(depenses, avecActions = false) {
        if (depenses.length === 0) {
            return '<p class="mt-4 text-sm text-gray-500 dark:text-gray-400">Aucune dépense pour cette période.</p>';
        }

        let html = `
            <div class="mt-4 overflow-x-auto rounded-lg border border-[#cfe7e3] dark:border-gray-700">
                <table data-cartes class="w-full text-sm">
                    <thead>
                        <tr class="bg-background-light dark:bg-background-dark border-b border-[#cfe7e3] dark:border-gray-700">
                            <th data-carte="meta" class="px-4 py-3 text-left font-semibold">Date</th>
                            <th data-carte="meta" class="px-4 py-3 text-left font-semibold">Heure</th>
                            <th data-carte="titre" class="px-4 py-3 text-left font-semibold">Catégorie</th>
                            <th data-carte="montant" class="px-4 py-3 text-right font-semibold">Montant</th>
                            <th data-carte="meta" class="px-4 py-3 text-left font-semibold">Moyen Paiement</th>
                            <th class="px-4 py-3 text-left font-semibold">Créé par</th>
                            <th class="px-4 py-3 text-left font-semibold">Justificatif</th>
                            <th class="px-4 py-3 text-left font-semibold">Commentaire</th>
                            ${avecActions ? '<th data-carte="actions" class="px-4 py-3 text-center font-semibold">Action</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
        `;

        depenses.forEach(d => {
            const rawDate = d.date || d.expenseDate || "";
            const localDate = rawDate ? getLocalDateString(new Date(rawDate)) : "";
            const heure = d.created_at ? formatHeureGabon(new Date(d.created_at)) : "-";
            const categorie = echapperHtml(d.categorie || d.category || "-");
            const montantNum = parseFloat(d.montant) || 0;
            const paiement = celluleMoyenDepense(d, avecActions);
            const creePar = echapperHtml(d.created_by_name || "-");
            const justificatifHtml = celluleJustificatifHtml(d, "depense");

            html += `
                        <tr class="border-b border-[#cfe7e3] dark:border-gray-700" data-depense-id="${d.id}" data-etat-credit="${etatCreditDepense(d)}">
                            <td class="px-4 py-3">${formatDateFR(localDate)}</td>
                            <td class="px-4 py-3">${heure}</td>
                            <td class="px-4 py-3">${categorie}</td>
                            <td class="px-4 py-3 text-right font-semibold">${montantNum.toFixed(2).replace('.', ',')} FCFA</td>
                            <td class="px-4 py-3" data-moyen-cellule>${paiement}</td>
                            <td class="px-4 py-3">${creePar}</td>
                            <td class="px-4 py-3 text-xs">${justificatifHtml}</td>
                            ${celluleCommentaire(d.note)}
                            ${avecActions ? `
                            <td class="px-4 py-3 text-center">
                                <button type="button" class="supprimer-depense text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 text-xl"
                                        title="Supprimer" aria-label="Supprimer cette dépense" data-id="${d.id}">🗑️</button>
                            </td>` : ''}
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
     * Zone ou s'affiche l'apercu genere, placee la ou on l'attend.
     *
     * Sur telephone, les cartes sont empilees : un apercu ajoute en bas de
     * page tombait sous toutes les autres cartes, hors de vue, et rien ne
     * disait qu'il fallait descendre. Il s'insere donc juste sous la carte
     * cliquee. Sur grand ecran, les cartes sont cote a cote : l'apercu
     * reste sous la grille, ou il prend toute la largeur. Dans les deux
     * cas, l'ecran defile jusqu'a lui.
     *
     * La zone garde le meme id, sur lequel s'appuient l'export et
     * l'impression.
     *
     * @param {string} idBouton - bouton « Générer l'aperçu » clique
     */
    function conteneurResultats(idBouton) {
        let zone = document.getElementById("etatFinanciersResults");
        if (!zone) {
            zone = document.createElement("div");
            zone.id = "etatFinanciersResults";
        }

        const carte = document.getElementById(idBouton)?.closest(".grid > div");
        const grille = carte?.parentElement;
        const empilees = grille
            && getComputedStyle(grille).gridTemplateColumns.trim().split(/\s+/).length === 1;

        if (empilees) {
            // Dans la grille, l'espacement vient deja de son « gap ».
            zone.className = "col-span-full scroll-mt-24";
            carte.after(zone);
        } else {
            zone.className = "mt-8 scroll-mt-24";
            // Le conteneur « .container » a été remplacé par la colonne de 1120 px : on cherche le bloc de contenu
            (document.querySelector("main .max-w-7xl") || document.querySelector("main")).appendChild(zone);
        }

        // Apres que l'appelant y a pose son contenu.
        setTimeout(() => zone.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
        return zone;
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
                window.OGOUE.getVentesPourPeriode(month, year, plagePeriode()),
                window.OGOUE.getDepensesPourPeriode(month, year, plagePeriode())
            ]);

            console.log("📊 Ventes reçues:", ventes);
            console.log("💰 Dépenses reçues:", depenses);

            const ventesFiltered = filterByDateRange(ventes);
            const depensesFiltered = filterByDateRange(depenses);

            console.log("✅ Ventes filtrées:", ventesFiltered);
            console.log("✅ Dépenses filtrées:", depensesFiltered);

            const comptes = await construireComptes(startDate, endDate, ventesFiltered);

            // Créer ou récupérer le conteneur de résultat
            const resultsContainer = conteneurResultats("generateCompteBtn");

            // Vue simple à l'écran ; le format SYSCOHADA est celui qu'on imprime
            const bouton = (vue, texte, actif) => `<button type="button" data-vue-compte="${vue}" class="h-9 px-4 rounded-full text-sm font-bold ${actif ? "bg-white dark:bg-gray-600 shadow-sm text-[#0d1b19] dark:text-white" : "text-gray-500"}">${texte}</button>`;
            resultsContainer.innerHTML = `<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-sm p-5">
                    <div class="flex flex-wrap items-center justify-between gap-3 mb-2">
                        <h3 class="text-lg font-bold">Compte de Résultat</h3>
                        <div class="inline-flex rounded-full bg-gray-100 dark:bg-gray-800 p-1" data-vues-compte>
                            ${bouton("simple", "Vue simple", true)}${bouton("syscohada", "Format SYSCOHADA", false)}
                        </div>
                    </div>
                    <div data-compte-vue="simple">${comptes.simple}</div>
                    <div data-compte-vue="syscohada" class="hidden">${comptes.syscohada}
                        <p class="mt-3 text-xs text-gray-500 dark:text-gray-400">C'est ce format qui est imprimé avec « Imprimer tout ».</p></div>
                </div>`;
            resultsContainer.querySelector("[data-vues-compte]").addEventListener("click", (e) => {
                const b = e.target.closest("[data-vue-compte]");
                if (!b) return;
                resultsContainer.querySelectorAll("[data-vue-compte]").forEach((x) => {
                    const on = x === b;
                    ["bg-white", "dark:bg-gray-600", "shadow-sm", "text-[#0d1b19]", "dark:text-white"].forEach((k) => x.classList.toggle(k, on));
                    x.classList.toggle("text-gray-500", !on);
                });
                resultsContainer.querySelectorAll("[data-compte-vue]").forEach((z) => z.classList.toggle("hidden", z.dataset.compteVue !== b.dataset.vueCompte));
            });

            // Sauvegarder les données/rendus pour l'impression sélective
            window.etatFinanciersData = window.etatFinanciersData || {};
            window.etatFinanciersData.ventes = ventesFiltered;
            window.etatFinanciersData.depenses = depensesFiltered;
            window.etatFinanciersData.compteHtml = `<h3>Compte de Résultat</h3>${comptes.syscohada}`;

            panel.classList.add("hidden");
        } catch (error) {
            console.error("❌ Erreur lors de la génération du compte de résultat:", error);
            alert("Erreur lors du chargement des données: " + (error && error.message ? error.message : error));
            const resultsContainer = conteneurResultats("generateCompteBtn");
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
                window.OGOUE.getVentesPourPeriode(month, year, plagePeriode()),
                window.OGOUE.getDepensesPourPeriode(month, year, plagePeriode())
            ]);

            const ventesFiltered = filterByDateRange(ventes);
            const depensesFiltered = filterByDateRange(depenses);
            const tableauFlux = await generateTableauDeFlux(startDate, endDate);

            const resultsContainer = conteneurResultats("generateFluxBtn");

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
            const resultsContainer = conteneurResultats("generateFluxBtn");
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
            const ventes = await window.OGOUE.getVentesPourPeriode(month, year, plagePeriode());
            const ventesFiltered = filterByDateRange(ventes);
            await chargerCreditsVentes();

            const resultsContainer = conteneurResultats("generateVentesBtn");

            const ventesHtml = `<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-sm p-5">
                    <h3 class="text-lg font-bold mb-2">Historique des Ventes (${ventesFiltered.length})</h3>
                    ${filtreDepensesHtml("vente")}
                    ${renderHistoriqueVentes(ventesFiltered, true)}
                    <p data-filtre-vide class="hidden py-4 text-center text-sm text-gray-500 dark:text-gray-400"></p>
                </div>`;
            resultsContainer.innerHTML = ventesHtml;
            brancherFiltreDepenses(resultsContainer);
            brancherPaiementsVentes(resultsContainer);

            brancherJustificatifs(resultsContainer);

            brancherSuppressions(resultsContainer, "vente");

            window.etatFinanciersData = window.etatFinanciersData || {};
            window.etatFinanciersData.ventes = ventesFiltered;
            // Version SANS la colonne Action : c'est elle qui part à
            // l'impression, et un bouton n'a aucun sens sur le papier.
            window.etatFinanciersData.ventesHtml = `<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-sm p-5">
                    <h3 class="text-lg font-bold mb-2">Historique des Ventes (${ventesFiltered.length})</h3>
                    ${renderHistoriqueVentes(ventesFiltered)}
                </div>`;

            panel.classList.add("hidden");
        } catch (error) {
            console.error("Erreur lors de la génération de l'historique ventes:", error);
            alert("Erreur lors du chargement des données: " + (error && error.message ? error.message : error));
            const resultsContainer = conteneurResultats("generateVentesBtn");
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
            const depenses = await window.OGOUE.getDepensesPourPeriode(month, year, plagePeriode());
            const depensesFiltered = filterByDateRange(depenses);

            const resultsContainer = conteneurResultats("generateDepensesBtn");

            const depensesHtml = `<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-sm p-5">
                    <h3 class="text-lg font-bold mb-2">Historique des Dépenses (${depensesFiltered.length})</h3>
                    ${filtreDepensesHtml()}
                    ${renderHistoriqueDepenses(depensesFiltered, true)}
                    <p data-filtre-vide class="hidden py-4 text-center text-sm text-gray-500 dark:text-gray-400"></p>
                </div>`;
            resultsContainer.innerHTML = depensesHtml;
            brancherFiltreDepenses(resultsContainer);

            brancherJustificatifs(resultsContainer);

            brancherSuppressions(resultsContainer, "depense");
            brancherPaiementsDettes(resultsContainer);

            window.etatFinanciersData = window.etatFinanciersData || {};
            window.etatFinanciersData.depenses = depensesFiltered;
            // Version SANS la colonne Action, destinée à l'impression.
            window.etatFinanciersData.depensesHtml = `<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-sm p-5">
                    <h3 class="text-lg font-bold mb-2">Historique des Dépenses (${depensesFiltered.length})</h3>
                    ${renderHistoriqueDepenses(depensesFiltered)}
                </div>`;

            panel.classList.add("hidden");
        } catch (error) {
            console.error("Erreur lors de la génération de l'historique dépenses:", error);
            alert("Erreur lors du chargement des données: " + (error && error.message ? error.message : error));
            const resultsContainer = conteneurResultats("generateDepensesBtn");
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
     * Bouton "Exporter Excel" - exporte les données avec la plage de dates sélectionnée
     */
    async function handleExportExcel() {
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

            console.log(`📥 Export Excel pour la période: ${startDate} au ${endDate}`);

            // Récupérer les ventes et dépenses pour la plage de dates sélectionnée
            const ventes = await window.OGOUE.getVentesPourPlage?.(startDate, endDate) || [];
            const depenses = await window.OGOUE.getDepensesPourPlage?.(startDate, endDate) || [];

            console.log(`📊 Données récupérées: ${ventes.length} ventes, ${depenses.length} dépenses`);

            // Créer le modal
            const existing = document.getElementById('exportSelectorModal');
            if (existing) return;

            const modal = document.createElement('div');
            modal.id = 'exportSelectorModal';
            modal.style = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);z-index:9999;';

            const box = document.createElement('div');
            box.style = 'background:white;border-radius:12px;padding:24px;max-width:400px;box-shadow:0 20px 25px rgba(0,0,0,0.15);';

            const title = document.createElement('h2');
            title.textContent = 'Exporter en Excel';
            title.style = 'font-size:20px;font-weight:bold;margin-bottom:16px;color:#0d1b19;';

            const description = document.createElement('p');
            description.textContent = 'Cochez les sections à inclure. Elles formeront un onglet chacune dans le même classeur.';
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
                    alert('Sélectionnez au moins une section');
                    return;
                }

                try {
                    // Les montants restent des NOMBRES, jamais du texte :
                    // c'est tout l'intérêt du classeur sur le CSV, l'utilisateur
                    // peut sommer et filtrer sans retoucher les colonnes.
                    const nombre = (valeur) => {
                        const n = parseFloat(valeur);
                        return Number.isFinite(n) ? n : 0;
                    };

                    const feuilles = [];

                    if (selected.includes('ventes')) {
                        feuilles.push({
                            nom: "Ventes",
                            lignes: [
                                ["Date", "Description", "Type", "Moyen de paiement", "Montant", "Justificatif", "Commentaire"],
                                ...ventes.map(v => [
                                    v.saleDate || v.date || "",
                                    v.description || "",
                                    v.saleType || v.type_vente || "",
                                    v.paymentMethod || v.moyen_paiement || "",
                                    nombre(v.amount ?? v.montant),
                                    v.receiptName || v.justificatif || "",
                                    v.note || ""
                                ])
                            ]
                        });
                    }

                    if (selected.includes('depenses')) {
                        feuilles.push({
                            nom: "Dépenses",
                            lignes: [
                                ["Date", "Catégorie", "Description", "Moyen de paiement", "Crédit payé le", "Montant", "Justificatif", "Commentaire"],
                                ...depenses.map(d => [
                                    d.date || "",
                                    d.category || d.categorie || "",
                                    d.description || "",
                                    ({ cash: "Cash", mobile_money: "Mobile Money", credit: "Crédit (à payer)" })[d.moyen_paiement] || d.moyen_paiement || "",
                                    // Dépense achetée à crédit puis payée : le jour du paiement
                                    d.credit_regle_le ? getLocalDateString(new Date(d.credit_regle_le)) : "",
                                    nombre(d.amount ?? d.montant),
                                    d.receiptName || d.justificatif || "",
                                    d.note || ""
                                ])
                            ]
                        });
                    }

                    if (selected.includes('flux')) {
                        const allOperations = [
                            ...ventes.map(v => ({
                                Date: v.saleDate || v.date || "",
                                Type: "Vente",
                                Description: v.description || "",
                                Montant: nombre(v.amount ?? v.montant),
                                Catégorie: v.saleType || v.type_vente || ""
                            })),
                            ...depenses.map(d => ({
                                Date: d.date || "",
                                Type: "Dépense",
                                Description: d.description || "",
                                Montant: -nombre(d.amount ?? d.montant),
                                Catégorie: d.category || d.categorie || ""
                            }))
                        ].sort((a, b) => new Date(a.Date) - new Date(b.Date));

                        feuilles.push({
                            nom: "Flux de trésorerie",
                            lignes: [
                                ["Date", "Type", "Description", "Montant", "Catégorie"],
                                ...allOperations.map(op => [op.Date, op.Type, op.Description, op.Montant, op.Catégorie])
                            ]
                        });
                    }

                    const { telechargerClasseur } = await import("./xlsx-export.js");
                    const periode = `${startDate}_${endDate}`;
                    telechargerClasseur(`OGOUE_Etats_financiers_${periode}.xlsx`, feuilles);

                    alert(`✅ Classeur Excel téléchargé (${feuilles.length} feuille(s)).`);
                    modal.remove();
                } catch (error) {
                    console.error("Erreur export Excel:", error);
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
            console.error("Erreur export Excel:", error);
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
                    window.OGOUE.getVentesPourPeriode(month, year, plagePeriode()),
                    window.OGOUE.getDepensesPourPeriode(month, year, plagePeriode())
                ]);

                // Filtrer par dates
                const ventesFiltered = filterByDateRange(ventes);
                const depensesFiltered = filterByDateRange(depenses);

                // Générer les HTML
                const comptes = await construireComptes(startDate, endDate, ventesFiltered);
                const fluxData = await generateTableauDeFlux(startDate, endDate);

                // Stocker les données et HTML pour impression
                window.etatFinanciersData = window.etatFinanciersData || {};
                window.etatFinanciersData.ventes = ventesFiltered;
                window.etatFinanciersData.depenses = depensesFiltered;
                window.etatFinanciersData.compteHtml = `<h3>Compte de Résultat</h3>${comptes.syscohada}`;
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

    // ── État des stocks (document à imprimer) ──────────────────────
    // Stock théorique = stock initial + entrées − sorties, d'après les
    // mouvements enregistrés. Le stock compté est saisi par le gérant lors de
    // l'inventaire physique ; l'écart et la valeur en découlent. Ce comptage
    // n'est pas enregistré : il sert au document du jour.
    const fmtNb = (n) => Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });
    const fmtF = (n) => Math.round(Number(n) || 0).toLocaleString("fr-FR");
    const signe = (n) => (n > 0 ? "+" : n < 0 ? "−" : "") + fmtNb(Math.abs(n));
    const S = {
        carte: "color:#0f172a;background:#fff;font-family:inherit",
        h2: "margin:22px 0 8px;font-size:15px;font-weight:700;color:#0B2A5B",
        table: "width:100%;border-collapse:collapse;font-size:12.5px",
        th: "padding:7px 8px;background:#0B2A5B;color:#fff;font-weight:600;text-align:right;border:1px solid #0B2A5B",
        thG: "padding:7px 8px;background:#0B2A5B;color:#fff;font-weight:600;text-align:left;border:1px solid #0B2A5B",
        td: "padding:6px 8px;border:1px solid #cbd5e1;text-align:right;white-space:nowrap",
        tdG: "padding:6px 8px;border:1px solid #cbd5e1;text-align:left"
    };

    // Les quatre colonnes de la partie 1 expliquées, en haut du document
    const LEXIQUE_STOCKS = (() => {
        const carte = (num, titre, sousTitre, texte, exemple) => `<div style="flex:1 1 180px;border:1px solid #cbd5e1;border-radius:12px;padding:10px 12px;background:#fff">
            <div style="font-weight:700;font-size:13px;color:#0B2A5B">${num}. ${titre}</div>
            <div style="font-size:12px;color:#0088CC;font-weight:600;margin-bottom:4px">${sousTitre}</div>
            <div style="font-size:12px;line-height:1.5;color:#334155">${texte}</div>
            <div style="font-size:11.5px;line-height:1.5;color:#64748b;margin-top:4px">${exemple}</div></div>`;
        return `<div style="margin-top:18px;border-radius:14px;background:#f1f5f9;padding:12px">
            <div style="font-weight:700;font-size:13px;margin-bottom:8px">Comment lire ce document</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px">
                ${carte(1, "Stock initial", "Ce que vous possédez au départ",
                    "La quantité en magasin au début de la période. Pour une nouvelle activité, il peut être de zéro ; sinon, c'est en général le stock final de la période précédente.",
                    "Ex. : le 1er octobre, vous commencez avec 20 sacs de riz.")}
                ${carte(2, "Entrées", "Ce que vous ajoutez au stock",
                    "Tout ce qui entre pendant la période : achats auprès des fournisseurs, mais aussi retours de clients ou transferts entrants.",
                    "Ex. : 10 sacs d'un fournisseur + 5 d'un autre = 15 sacs.")}
                ${carte(3, "Sorties", "Ce que vous retirez du stock",
                    "Tout ce qui quitte le stock : les ventes, mais aussi les produits abîmés, perdus ou pris pour votre usage personnel (« Sortie de stock » dans le catalogue).",
                    "Ex. : 12 vendus + 1 abîmé + 1 pris pour vous = 14 sacs.")}
                ${carte(4, "Stock théorique", "Ce que vous devriez avoir",
                    "Ce qui devrait rester en magasin d'après toutes les opérations enregistrées dans OGOUE. On le compare ensuite au stock réellement compté.",
                    "<strong style=\"color:#0B2A5B\">Stock initial + Entrées − Sorties = Stock théorique</strong>")}
            </div></div>`;
    })();

    function calculerEtatStocks(articles, comptes) {
        return articles.map((a) => {
            const sorties = Math.max(0, a.stockDepart + a.entrees - a.stock);
            const compte = comptes[a.id] === undefined || comptes[a.id] === "" ? a.stock : Number(comptes[a.id]);
            const ecart = compte - a.stock;
            return { ...a, sorties, theorique: a.stock, compte, ecart, valeurComptee: a.coutAchat === null ? null : compte * a.coutAchat };
        });
    }

    // Parties 3 et 4, et chiffres du haut : recalculés à chaque saisie du comptage
    function partiesCalculees(lignes, meta) {
        const valorises = lignes.filter((l) => l.valeurComptee !== null);
        const total = valorises.reduce((s, l) => s + l.valeurComptee, 0);
        const sansCout = lignes.filter((l) => l.valeurComptee === null);
        const valo = `<table style="${S.table}"><thead><tr><th style="${S.thG}">Produit</th><th style="${S.th}">Quantité comptée</th><th style="${S.th}">Coût unitaire</th><th style="${S.th}">Valeur</th></tr></thead><tbody>${
            lignes.map((l) => `<tr><td style="${S.tdG}">${echapperHtml(l.name)}</td><td style="${S.td}">${fmtNb(l.compte)}</td><td style="${S.td}">${l.coutAchat === null ? "non renseigné" : fmtF(l.coutAchat)}</td><td style="${S.td}">${l.valeurComptee === null ? "—" : fmtF(l.valeurComptee)}</td></tr>`).join("")
        }<tr style="font-weight:700;background:#e2e8f0"><td style="${S.tdG}" colspan="3">TOTAL</td><td style="${S.td}">${fmtF(total)} FCFA</td></tr></tbody></table>`;

        const MOTIFS_SORTIE = { abime: "abîmé", usage_personnel: "usage personnel", perte: "perte ou vol" };
        const sortiesHorsVentes = lignes.filter((l) => l.sortiesMotifs && Object.keys(l.sortiesMotifs).length).map((l) =>
            `<li><strong>${echapperHtml(l.name)}</strong> : sorties hors ventes, ${Object.entries(l.sortiesMotifs).map(([m, q]) => `${fmtNb(q)} ${MOTIFS_SORTIE[m] || m}`).join(", ")}.</li>`).join("");
        const alertes = lignes.map((l) => {
            const nom = echapperHtml(l.name);
            const unites = (n) => `${fmtNb(Math.abs(n))} unité${Math.abs(n) > 1 ? "s" : ""}`;
            if (l.ecart < 0) return `<li><strong>${nom}</strong> : écart négatif de ${unites(l.ecart)} (manquant).</li>`;
            if (l.ecart > 0) return `<li><strong>${nom}</strong> : écart positif de ${unites(l.ecart)} (surplus).</li>`;
            if (l.compte <= 0) return `<li><strong>${nom}</strong> : stock épuisé, à réapprovisionner.</li>`;
            return `<li><strong>${nom}</strong> : stock conforme.</li>`;
        }).join("");
        const nbEcarts = lignes.filter((l) => l.ecart !== 0).length;
        const conclusion = `Au ${meta.situation}, la valeur du stock physique recensé est estimée à <strong>${fmtF(total)} FCFA</strong>.` +
            (nbEcarts ? ` Des écarts ont été constatés sur ${nbEcarts} référence${nbEcarts > 1 ? "s" : ""} et doivent être vérifiés.` : " Aucun écart n'a été constaté entre le stock théorique et le stock compté.") +
            (sansCout.length ? ` ${sansCout.length} référence${sansCout.length > 1 ? "s n'ont" : " n'a"} pas de coût d'achat renseigné et ne sont pas valorisées.` : "");
        return { total, valo, alertes: `<ul style="margin:0 0 10px 18px;padding:0;font-size:13px;line-height:1.7;list-style:disc">${alertes}${sortiesHorsVentes}</ul><p style="margin:0;font-size:13px">${conclusion}</p>` };
    }

    /**
     * Document complet. interactif : la colonne « Stock compté » est un champ
     * de saisie (écran) ; sinon le chiffre saisi est écrit (impression).
     */
    function documentEtatStocks(lignes, meta, interactif) {
        const p = partiesCalculees(lignes, meta);
        const champ = (l) => interactif
            ? `<input type="number" min="0" step="any" inputmode="decimal" data-compte="${echapperHtml(l.id)}" value="${l.compte}" style="width:80px;padding:4px 6px;border:1px solid #94a3b8;border-radius:6px;text-align:right;font:inherit;color:#0f172a;background:#fff">`
            : fmtNb(l.compte);
        const couleurEcart = (n) => (n < 0 ? "#b91c1c" : n > 0 ? "#047857" : "#0f172a");
        const ligneInfo = (libelle, valeur) => valeur ? `<div><span style="color:#64748b">${libelle} :</span> <strong>${echapperHtml(valeur)}</strong></div>` : "";
        return `<div data-etat-stocks style="${S.carte}">
            <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px 24px;align-items:flex-start">
                <div>
                    <div style="font-size:13px;font-weight:800;letter-spacing:.08em;color:#0088CC">OGOUE</div>
                    <div style="font-size:22px;font-weight:800;color:#0B2A5B;margin-top:2px">ÉTAT DES STOCKS</div>
                    <div style="font-size:13px;color:#475569;margin-top:2px">Situation au ${meta.situation}</div>
                    <div style="font-size:13px;margin-top:10px;line-height:1.6">
                        ${ligneInfo("Entreprise", meta.entreprise)}${ligneInfo("Activité", meta.activite)}${ligneInfo("Période de suivi", meta.periode)}
                    </div>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                    <div style="border:1px solid #cbd5e1;border-radius:12px;padding:10px 14px;min-width:120px"><div style="font-size:11px;color:#64748b">Références suivies</div><div style="font-size:22px;font-weight:800">${lignes.length}</div></div>
                    <div style="border:1px solid #cbd5e1;border-radius:12px;padding:10px 14px;min-width:150px;background:#f1f5f9"><div style="font-size:11px;color:#64748b">Valeur du stock physique</div><div style="font-size:22px;font-weight:800"><span data-total-stock>${fmtF(p.total)}</span> <span style="font-size:12px;font-weight:600;color:#64748b">FCFA</span></div></div>
                </div>
            </div>

            ${LEXIQUE_STOCKS}

            <h2 style="${S.h2}">1. Situation détaillée des stocks</h2>
            <div style="overflow-x:auto"><table style="${S.table}"><thead><tr><th style="${S.thG}">Produit</th><th style="${S.th}">Stock initial</th><th style="${S.th}">Entrées</th><th style="${S.th}">Sorties</th><th style="${S.th}">Stock théorique</th></tr></thead><tbody>${
                lignes.map((l) => `<tr><td style="${S.tdG}">${echapperHtml(l.name)}</td><td style="${S.td}">${fmtNb(l.stockDepart)}</td><td style="${S.td}">${fmtNb(l.entrees)}</td><td style="${S.td}">${fmtNb(l.sorties)}</td><td style="${S.td};font-weight:700">${fmtNb(l.theorique)}</td></tr>`).join("")
            }</tbody></table></div>

            <h2 style="${S.h2}">2. Résultat de l'inventaire physique</h2>
            ${interactif ? `<p style="margin:0 0 8px;font-size:12.5px;color:#475569">Saisissez ce que vous avez compté sur place. Par défaut, le stock compté est égal au stock théorique.</p>` : ""}
            <div style="overflow-x:auto"><table style="${S.table}"><thead><tr><th style="${S.thG}">Produit</th><th style="${S.th}">Stock théorique</th><th style="${S.th}">Stock compté</th><th style="${S.th}">Écart</th></tr></thead><tbody>${
                lignes.map((l) => `<tr><td style="${S.tdG}">${echapperHtml(l.name)}</td><td style="${S.td}">${fmtNb(l.theorique)}</td><td style="${S.td}">${champ(l)}</td><td style="${S.td};font-weight:700;color:${couleurEcart(l.ecart)}" data-ecart="${echapperHtml(l.id)}">${signe(l.ecart)}</td></tr>`).join("")
            }</tbody></table></div>

            ${interactif ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;align-items:center;gap:10px">
                <button type="button" data-corriger-stock style="height:38px;padding:0 16px;border:0;border-radius:999px;background:#0088CC;color:#fff;font-weight:700;font-size:13px;cursor:pointer">Corriger le stock avec ce comptage</button>
                <span data-corriger-message style="font-size:12.5px;color:#475569">Le stock de l'application sera ajusté des écarts ci-dessus.</span></div>` : ""}

            <h2 style="${S.h2}">3. Valorisation du stock</h2>
            <div style="overflow-x:auto" data-partie-valo>${p.valo}</div>

            <h2 style="${S.h2}">4. Alertes et observations</h2>
            <div data-partie-alertes>${p.alertes}</div>

            <p style="margin:18px 0 0;padding-top:10px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b">Document de gestion généré à partir des mouvements et du comptage physique enregistrés dans OGOUE.</p>
        </div>`;
    }

    // Coordonnées de l'entreprise pour l'en-tête du document
    async function lireEntreprise() {
        let org = {};
        try { org = JSON.parse(localStorage.getItem("ogo_org") || "null") || {}; } catch (e) {}
        try {
            const API_BASE_URL = (['localhost', '127.0.0.1'].some(h => location.hostname.includes(h))) ? 'http://localhost:3001' : (/^192\.168\./.test(location.hostname) ? 'http://' + location.hostname + ':3001' : 'https://api.ogoue.com');
            const r = await fetch(`${API_BASE_URL}/api/organization`, { headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` } });
            if (r.ok) { const o = await r.json(); org = { ...org, name: o.name || org.name, activity: o.activity }; }
        } catch (e) {}
        return org;
    }

    /**
     * Bouton "Générer l'aperçu" - Inventaire du stock
     * Deux documents : l'état des stocks, et la liste de réapprovisionnement.
     */
    async function handleGenerateStock() {
        if (!window.OGOUE || typeof window.OGOUE.getRapportStock !== "function") {
            console.error("OGOUE state non chargé");
            return;
        }

        const aujourdHui = getLocalDateString(new Date());
        const plage = plagePeriode();
        const debut = plage ? plage.startDate : aujourdHui.slice(0, 8) + "01";
        const fin = plage ? plage.endDate : aujourdHui;

        try {
            const rapport = await window.OGOUE.getRapportStock(debut, fin);
            if (!rapport.ok) throw new Error(rapport.error || "Rapport indisponible");

            const articles = rapport.articles;
            const fcfa = (n) => `${Math.round(Number(n) || 0).toLocaleString("fr-FR")} FCFA`;
            const nombre = (n) => Number(n || 0).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

            const libelleFr = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
            const titrePeriode = `du ${libelleFr.format(new Date(debut + "T12:00:00"))} au ${libelleFr.format(new Date(fin + "T12:00:00"))}`;

            if (articles.length === 0) {
                const vide = `<p class="text-text-light-secondary dark:text-text-dark-secondary">Aucun article n'est suivi en stock. Renseignez une quantité disponible dans votre catalogue pour voir l'inventaire.</p>`;
                conteneurResultats("generateStockBtn").innerHTML = `<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-sm p-5">${vide}</div>`;
                panel.classList.add("hidden");
                return;
            }

            // 1. État des stocks : document en 4 parties, comptage saisi à l'écran
            const org = await lireEntreprise();
            const dateLongue = (iso) => libelleFr.format(new Date(iso + "T12:00:00")).replace(/^0?1 /, "1er ");
            const meta = {
                situation: dateLongue(fin),
                entreprise: org.name || "",
                activite: org.activity || "",
                periode: `Du ${dateLongue(debut)} au ${dateLongue(fin)}`
            };
            const comptes = {};

            // 2. Liste de réapprovisionnement : seulement ce qui manque
            const aCommander = articles.filter((a) => a.aCommander > 0);
            const totalCommande = aCommander.reduce((s, a) => s + (a.coutEstime || 0), 0);
            const lignesReappro = aCommander.map((a) => `<tr class="border-b border-gray-100 dark:border-gray-700">
                    <td class="py-3 pr-4 font-medium">${echapperHtml(a.name)}</td>
                    <td class="py-3 pr-4 text-right">${nombre(a.stock)}</td>
                    <td class="py-3 pr-4 text-right">${nombre(a.besoin30Jours)}</td>
                    <td class="py-3 pr-4 text-right font-semibold">${nombre(a.aCommander)}</td>
                    <td class="py-3 pr-4 text-right">${a.coutEstime === null ? "Coût inconnu" : fcfa(a.coutEstime)}</td>
                </tr>`).join("");

            const documentReappro = `<div class="bg-card-light dark:bg-card-dark rounded-xl shadow-sm p-5">
                    <h3 class="text-lg font-bold">Liste de réapprovisionnement</h3>
                    <p class="text-sm text-text-light-secondary dark:text-text-dark-secondary mb-4">Besoin pour 30 jours, au rythme des ventes de la période. Prête à envoyer à votre fournisseur.</p>
                    ${aCommander.length === 0
                        ? `<p class="text-text-light-secondary dark:text-text-dark-secondary">Rien à commander : vos stocks couvrent les 30 prochains jours.</p>`
                        : `<div class="overflow-x-auto">
                            <table class="w-full text-left text-sm">
                                <thead>
                                    <tr class="border-b border-black/10">
                                        <th class="py-2 pr-4 font-medium">Article</th>
                                        <th class="py-2 pr-4 font-medium text-right">Stock actuel</th>
                                        <th class="py-2 pr-4 font-medium text-right">Besoin pour 30 jours</th>
                                        <th class="py-2 pr-4 font-medium text-right">À commander</th>
                                        <th class="py-2 pr-4 font-medium text-right">Coût estimé</th>
                                    </tr>
                                </thead>
                                <tbody>${lignesReappro}</tbody>
                                <tfoot>
                                    <tr class="font-bold">
                                        <td class="pt-3 pr-4" colspan="4">Total estimé</td>
                                        <td class="pt-3 pr-4 text-right">${fcfa(totalCommande)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>`}
                </div>`;

            const resultsContainer = conteneurResultats("generateStockBtn");
            resultsContainer.innerHTML = `<div class="flex flex-col gap-6">
                    <div class="bg-card-light dark:bg-card-dark rounded-xl shadow-sm p-5">
                        <div class="flex justify-end mb-3">
                            <button type="button" data-imprimer-stocks class="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-[#0B2A5B] text-white text-sm font-bold hover:bg-[#0B2A5B]/90">
                                <span class="material-symbols-outlined text-base">print</span>Imprimer l'état des stocks</button>
                        </div>
                        <div data-zone-etat>${documentEtatStocks(calculerEtatStocks(articles, comptes), meta, true)}</div>
                    </div>
                    ${documentReappro}</div>`;
            panel.classList.add("hidden");

            // Comptage : écart, valorisation, alertes et total suivent la saisie
            const zoneEtat = resultsContainer.querySelector("[data-zone-etat]");
            zoneEtat.addEventListener("input", (e) => {
                const champ = e.target.closest("[data-compte]");
                if (!champ) return;
                comptes[champ.dataset.compte] = champ.value;
                const lignes = calculerEtatStocks(articles, comptes);
                lignes.forEach((l) => {
                    const c = zoneEtat.querySelector(`[data-ecart="${CSS.escape(String(l.id))}"]`);
                    if (c) { c.textContent = signe(l.ecart); c.style.color = l.ecart < 0 ? "#b91c1c" : l.ecart > 0 ? "#047857" : "#0f172a"; }
                });
                const p = partiesCalculees(lignes, meta);
                zoneEtat.querySelector("[data-partie-valo]").innerHTML = p.valo;
                zoneEtat.querySelector("[data-partie-alertes]").innerHTML = p.alertes;
                zoneEtat.querySelector("[data-total-stock]").textContent = fmtF(p.total);
            });
            // Corriger le stock : chaque écart devient un mouvement « inventaire »
            zoneEtat.addEventListener("click", async (e) => {
                const bouton = e.target.closest("[data-corriger-stock]");
                if (!bouton) return;
                const msg = zoneEtat.querySelector("[data-corriger-message]");
                const ecarts = calculerEtatStocks(articles, comptes).filter((l) => l.ecart !== 0).map((l) => ({ id: l.id, ecart: l.ecart, name: l.name }));
                if (!ecarts.length) { msg.textContent = "Aucun écart : le stock est déjà juste."; msg.style.color = "#047857"; return; }
                const liste = ecarts.map((x) => `• ${x.name} : ${signe(x.ecart)}`).join("\n");
                if (!confirm(`Ajuster le stock de ${ecarts.length} article${ecarts.length > 1 ? "s" : ""} ?\n\n${liste}`)) return;
                bouton.disabled = true;
                const r = await window.OGOUE.corrigerInventaire(ecarts.map(({ id, ecart }) => ({ id, ecart })));
                bouton.disabled = false;
                if (!r.ok) { msg.textContent = r.error; msg.style.color = "#b91c1c"; return; }
                msg.style.color = r.echecs.length ? "#b45309" : "#047857";
                msg.textContent = `Stock corrigé pour ${r.corriges.length} article${r.corriges.length > 1 ? "s" : ""}.` +
                    (r.echecs.length ? ` ${r.echecs.length} n'ont pas pu l'être (stock modifié entre-temps) : générez de nouveau l'aperçu.` : " Imprimez le document pour garder la trace du comptage.");
                bouton.style.display = "none";
            });

            resultsContainer.querySelector("[data-imprimer-stocks]").addEventListener("click", () => {
                const html = documentEtatStocks(calculerEtatStocks(articles, comptes), meta, false);
                const w = window.open("", "", "width=900,height=1000");
                if (!w) { alert("Autorisez les fenêtres pour imprimer."); return; }
                w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>État des stocks</title><style>body{font-family:Arial,sans-serif;margin:24px}@media print{body{margin:10mm}th{-webkit-print-color-adjust:exact;print-color-adjust:exact}tr{page-break-inside:avoid}}</style></head><body>${html}</body></html>`);
                w.document.close();
                setTimeout(() => { w.print(); w.close(); }, 400);
            });
        } catch (error) {
            console.error("Erreur lors de la génération de l'inventaire:", error);
            const resultsContainer = conteneurResultats("generateStockBtn");
            resultsContainer.innerHTML = `<div class="bg-card-light text-red-700 rounded-xl shadow-sm p-5">Erreur: ${error && error.message ? error.message : error}</div>`;
        }
    }

    // « Générer l'aperçu » : roue de chargement dans le bouton, puis écran
    // « … prêt » quand l'aperçu est affiché (rien si une erreur s'affiche)
    function avecChargement(bouton, action, titre) {
        return async (e) => {
            if (bouton.disabled) return;
            const F = window.OGOUE_CONNEXION;
            F?.attente(bouton, "Génération…");
            try { await action(e); } finally { F?.fin(bouton); }
            const zone = document.getElementById("etatFinanciersResults");
            const erreur = !zone || !zone.textContent.trim() || zone.querySelector(".text-red-700") || /^\s*Erreur/.test(zone.textContent);
            if (!erreur) F?.pret({ titre, texte: "Votre aperçu s'affiche ci-dessous." });
        };
    }

    // Attacher les événements aux boutons via IDs
    const generateCompteBtn = document.getElementById("generateCompteBtn");
    const generateFluxBtn = document.getElementById("generateFluxBtn");
    const generateVentesBtn = document.getElementById("generateVentesBtn");
    const generateDepensesBtn = document.getElementById("generateDepensesBtn");
    const exportPdfBtn = document.getElementById("exportPdfBtn");
    const printAllBtn = document.getElementById("printAllBtn");

    if (generateCompteBtn) {
        generateCompteBtn.addEventListener("click", avecChargement(generateCompteBtn, handleGenerateCompte, "Compte de résultat prêt"));
    }

    if (generateFluxBtn) {
        generateFluxBtn.addEventListener("click", avecChargement(generateFluxBtn, handleGenerateFlux, "Tableau de flux prêt"));
    }

    if (generateVentesBtn) {
        generateVentesBtn.addEventListener("click", avecChargement(generateVentesBtn, handleGenerateVentes, "Historique des ventes prêt"));
    }

    if (generateDepensesBtn) {
        generateDepensesBtn.addEventListener("click", avecChargement(generateDepensesBtn, handleGenerateDepenses, "Historique des dépenses prêt"));
    }

    const generateStockBtn = document.getElementById("generateStockBtn");
    if (generateStockBtn) {
        generateStockBtn.addEventListener("click", avecChargement(generateStockBtn, handleGenerateStock, "Inventaire du stock prêt"));
    }

    if (exportPdfBtn) {
        exportPdfBtn.addEventListener("click", handleExportPDF);
    }

    if (printAllBtn) {
        printAllBtn.addEventListener("click", handlePrintAll);
    }

    // Export Excel
    const exportExcelBtn = document.getElementById("exportExcelBtn");
    if (exportExcelBtn) {
        exportExcelBtn.addEventListener("click", handleExportExcel);
    }
});


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
