// js/credits-fournisseurs.js — page « Crédits », côté « Je dois »
// La bascule On me doit / Je dois en haut de la page, et la liste de ce
// que l'entreprise doit : les dépenses enregistrées avec le moyen de
// paiement « Crédit » (GET /api/expenses/credits). « Payer » fait passer la
// dépense au moyen utilisé, comme dans la page Dépenses.
(function () {
  if (!window.OGOUE?.getDepensesCredit) return;
  const { getDepensesCredit, reglerDepense } = window.OGOUE;

  const el = (id) => document.getElementById(id);
  const MOYENS = { cash: "Cash", mobile_money: "Mobile Money" };
  const echapper = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const fcfa = (n) => (Number(n) || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  const dateCourte = (iso) => new Date(String(iso).slice(0, 10) + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const aujourdhui = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const joursEntre = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
  // Le commentaire porte le nom du fournisseur ; sans commentaire, la catégorie
  const titre = (d) => String(d.note || "").trim() || d.categorie || "Dépense";

  // ── Bascule, sur le modèle Saisie normale / Mode rush ──
  const VUES = {
    clients: { titre: "Crédits clients", sousTitre: "Ce que vos clients vous doivent." },
    fournisseurs: { titre: "Mes dettes", sousTitre: "Ce qu'il vous reste à payer : achats, factures, impôts… enregistrés à crédit." },
  };
  const bascule = el("creditsBascule");
  let charge = false;
  function choisirVue(vue) {
    bascule.querySelectorAll("[data-vue]").forEach((b) => {
      const on = b.dataset.vue === vue;
      ["bg-white", "dark:bg-gray-600", "shadow-sm", "text-[#0d1b19]", "dark:text-white"].forEach((k) => b.classList.toggle(k, on));
      b.classList.toggle("text-gray-500", !on);
    });
    el("vueClients").classList.toggle("hidden", vue !== "clients");
    el("vueFournisseurs").classList.toggle("hidden", vue !== "fournisseurs");
    el("creditsTitre").textContent = VUES[vue].titre;
    el("creditsSousTitre").textContent = VUES[vue].sousTitre;
    // Garder la vue dans l'adresse : un rechargement ou un lien y revient
    try { history.replaceState(null, "", location.pathname + location.search + (vue === "fournisseurs" ? "#fournisseurs" : "")); } catch (e) {}
    if (vue === "fournisseurs" && !charge) charger();
  }
  bascule.addEventListener("click", (e) => {
    const b = e.target.closest("[data-vue]");
    if (b) choisirVue(b.dataset.vue);
  });

  // ── Dettes ──
  const liste = el("dettesListe");
  const message = el("dettesMessage");
  const recherche = el("dettesRecherche");
  let depenses = [];

  function etat(d, auj) {
    if (!d.echeance) return { enRetard: false, jours: 0 };
    const jours = joursEntre(String(d.echeance).slice(0, 10), auj);
    return { enRetard: jours > 0, jours };
  }

  function badge(d, e) {
    if (e.enRetard) return `<span class="inline-block rounded-md bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300 px-2 py-0.5 text-xs font-bold">En retard · ${e.jours} j</span>`;
    if (d.echeance) return `<span class="inline-block rounded-md bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:text-gray-200">À payer le ${dateCourte(d.echeance)}</span>`;
    return `<span class="inline-block rounded-md bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-semibold text-gray-500 dark:text-gray-300">Sans date</span>`;
  }

  const boutonPayer = '<button type="button" data-payer-ouvrir class="h-10 px-5 rounded-full bg-primary text-white text-sm font-bold hover:bg-primary/90">Payer</button>';

  function carte(d, auj) {
    const e = etat(d, auj);
    const note = String(d.note || "").trim();
    return `<div class="rounded-[22px] bg-white dark:bg-[#182c29] shadow-sm p-5 flex flex-wrap items-center gap-4 ${e.enRetard ? "border-2 border-red-200 dark:border-red-900/60" : "border border-transparent"}" data-dette="${echapper(d.id)}">
      <span class="size-12 shrink-0 rounded-full flex items-center justify-center ${e.enRetard ? "bg-[#5a2e0e] text-white" : "bg-gray-200 dark:bg-gray-700 text-[#0d1b19] dark:text-white"}"><span class="material-symbols-outlined">receipt_long</span></span>
      <span class="min-w-0 flex-1">
        <span class="block font-bold text-[#0d1b19] dark:text-white truncate">${echapper(titre(d))}</span>
        <span class="block text-sm text-gray-500 dark:text-gray-400">${note && d.categorie ? `${echapper(d.categorie)} · ` : ""}acheté le ${dateCourte(d.date)}</span>
      </span>
      <span class="text-right shrink-0">
        <span class="block text-xs text-gray-500 dark:text-gray-400">À payer</span>
        <span class="block text-xl font-black ${e.enRetard ? "text-red-700 dark:text-red-400" : "text-[#0d1b19] dark:text-white"}">${fcfa(d.montant)} F</span>
        ${badge(d, e)}
      </span>
      <span class="w-full sm:w-auto flex flex-wrap items-center justify-end gap-2" data-payer-zone>${boutonPayer}</span>
    </div>`;
  }

  function afficher() {
    const auj = aujourdhui();
    const filtre = window.OGOUE.cleClient ? window.OGOUE.cleClient(recherche.value) : recherche.value.toLowerCase();
    const cle = (d) => (window.OGOUE.cleClient ? window.OGOUE.cleClient(`${d.note || ""} ${d.categorie || ""}`) : `${d.note || ""} ${d.categorie || ""}`.toLowerCase());
    const dues = depenses.filter((d) => d.moyen_paiement === "credit");
    const payees = depenses.filter((d) => d.moyen_paiement !== "credit" && d.regle_le);

    const total = dues.reduce((s, d) => s + d.montant, 0);
    const retard = dues.filter((d) => etat(d, auj).enRetard);
    el("dettesTotal").textContent = fcfa(total);
    el("dettesNb").textContent = dues.length
      ? `${dues.length} dette${dues.length > 1 ? "s" : ""} à payer`
      : "Vous ne devez rien en ce moment.";
    el("dettesRetardBloc").classList.toggle("hidden", !retard.length);
    el("dettesRetard").textContent = `${fcfa(retard.reduce((s, d) => s + d.montant, 0))} F`;
    el("dettesNbRetard").textContent = `${retard.length} dette${retard.length > 1 ? "s" : ""}`;

    // En retard d'abord (le plus ancien en tête), puis par date de remboursement, les « sans date » à la fin
    const visibles = dues.filter((d) => !filtre || cle(d).includes(filtre)).sort((a, b) => {
      const ea = etat(a, auj), eb = etat(b, auj);
      return (eb.enRetard - ea.enRetard) || (eb.jours - ea.jours)
        || String(a.echeance || "9999").localeCompare(String(b.echeance || "9999"))
        || String(a.date).localeCompare(String(b.date));
    });
    liste.innerHTML = visibles.map((d) => carte(d, auj)).join("");
    message.classList.toggle("hidden", visibles.length > 0);
    message.textContent = dues.length && recherche.value ? "Aucune dette ne correspond." : "Aucune dette en cours.";

    const payeesVisibles = payees.filter((d) => !filtre || cle(d).includes(filtre))
      .sort((a, b) => String(b.regle_le).localeCompare(String(a.regle_le)));
    el("dettesPayeesBloc").classList.toggle("hidden", !payeesVisibles.length);
    el("dettesNbPayees").textContent = payeesVisibles.length;
    el("dettesPayees").innerHTML = payeesVisibles.map((d) => `
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white dark:bg-[#182c29] px-4 py-3 text-sm">
        <span class="font-semibold text-[#0d1b19] dark:text-white">${echapper(titre(d))} · ${fcfa(d.montant)} F</span>
        <span class="text-gray-500 dark:text-gray-400">payé le ${dateCourte(d.regle_le)} en ${MOYENS[d.moyen_paiement] || echapper(d.moyen_paiement)}</span>
      </div>`).join("");
  }

  async function charger() {
    charge = true;
    const r = await getDepensesCredit();
    if (!r.ok) {
      charge = false; // on retentera au prochain passage sur cet onglet
      el("dettesTotal").textContent = "—";
      message.classList.remove("hidden");
      message.textContent = "Impossible de charger vos dettes. Si le problème continue, la mise à jour des dépenses à crédit n'est peut-être pas encore activée sur ce compte.";
      return;
    }
    depenses = r.depenses.map((d) => ({ ...d, montant: Number(d.montant) || 0 }));
    afficher();
  }

  liste.addEventListener("click", async (e) => {
    const zone = e.target.closest("[data-payer-zone]");
    if (!zone) return;
    if (e.target.closest("[data-payer-ouvrir]")) {
      zone.innerHTML =
        '<span class="text-sm text-gray-500 dark:text-gray-400">Payé en :</span>' +
        Object.entries(MOYENS).map(([m, l]) => `<button type="button" data-moyen="${m}" class="h-10 px-4 rounded-full bg-[#0d1b19] dark:bg-gray-600 text-white text-sm font-bold">${l}</button>`).join("") +
        '<button type="button" data-renoncer class="h-10 px-2 text-sm text-gray-500 hover:underline">Annuler</button>';
      return;
    }
    if (e.target.closest("[data-renoncer]")) { zone.innerHTML = boutonPayer; return; }
    const moyen = e.target.closest("[data-moyen]")?.dataset.moyen;
    if (!moyen) return;
    const id = zone.closest("[data-dette]").dataset.dette;
    const d = depenses.find((x) => String(x.id) === id);
    zone.querySelectorAll("button").forEach((b) => { b.disabled = true; });
    const r = await reglerDepense(id, moyen);
    if (!r.ok) { alert(r.error); zone.querySelectorAll("button").forEach((b) => { b.disabled = false; }); return; }
    window.OGOUE_FEEDBACK?.succes(`Dette payée · ${echapper(d ? titre(d) : "")} · ${fcfa(d?.montant)} F`);
    await charger();
  });

  recherche.addEventListener("input", afficher);
  choisirVue(location.hash === "#fournisseurs" ? "fournisseurs" : "clients");
})();
