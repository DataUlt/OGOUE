// js/credits.js — page « Crédits clients »
// Qui doit combien, depuis quand, et l'enregistrement de ce que le client
// verse (tout ou une partie). Les données viennent de GET /api/credits ;
// le regroupement par client est fait par OGOUE.resumerCredits.
(function () {
  // Agent : il encaisse les crédits clients, mais n'a pas la navigation du
  // gérant (tableau de bord, financement) : l'en-tête le ramène à sa comptabilité
  (function adapterPourAgent() {
    let u = null;
    try { u = JSON.parse(localStorage.getItem("user") || "null"); } catch (e) {}
    if (!u || u.role !== "agent") return;
    document.querySelectorAll('header a[href^="module_tableau_bord"], header a[href^="module_scoring"], #mobile-menu a[href^="module_tableau_bord"], #mobile-menu a[href^="module_scoring"]').forEach((a) => {
      if (a.querySelector("img")) a.href = "module_agent_dashboard.html"; else a.remove();
    });
    document.querySelectorAll('header a[href^="module_ventes"], #mobile-menu a[href^="module_ventes"]').forEach((a) => { a.href = "module_agent_dashboard.html"; });
  })();

  if (!window.OGOUE?.getCredits) return;
  const { getCredits, enregistrerReglement, annulerReglement, resumerCredits } = window.OGOUE;

  const el = (id) => document.getElementById(id);
  const liste = el("creditsListe");
  const message = el("creditsMessage");
  const recherche = el("creditsRecherche");
  let resume = null;
  let ouvert = null;               // client déplié (une fiche à la fois)
  const moyens = {};               // moyen choisi par client, gardé entre deux affichages
  const MOYENS = { cash: "Cash", mobile_money: "Mobile Money" };

  const echapper = (v) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  const fcfa = (n) => (Number(n) || 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 });
  const dateCourte = (iso) => new Date(iso + "T12:00:00").toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
  const initiale = (nom) => (String(nom).trim().charAt(0) || "?").toUpperCase();
  const accord = (c) => (/^(mme|madame|mlle)\b/i.test(c.nom) ? "Elle" : "Il");

  // Numéro pour WhatsApp : indicatif déjà présent conservé, sinon Gabon (241,
  // le 0 initial se garde : 077 00 00 01 → 241077000001)
  function numeroWhatsApp(tel) {
    const n = String(tel || "").replace(/[^\d+]/g, "");
    if (!n) return "";
    if (n.startsWith("+")) return n.slice(1);
    if (n.startsWith("00")) return n.slice(2);
    if (n.startsWith("241")) return n;
    return "241" + n;
  }
  function lienRappel(c) {
    const entreprise = (() => { try { return JSON.parse(localStorage.getItem("ogo_org") || "null")?.name || ""; } catch (e) { return ""; } })();
    const texte = `Bonjour ${c.nom}, petit rappel : il reste ${fcfa(c.du)} FCFA à régler${entreprise ? ` chez ${entreprise}` : ""}. Merci beaucoup !`;
    const numero = numeroWhatsApp(c.telephone);
    return `https://wa.me/${numero}?text=${encodeURIComponent(texte)}`;
  }

  function badge(c) {
    if (c.enRetard) return `<span class="inline-block rounded-md px-2 py-0.5 text-xs font-bold ${c === ouvertClient() ? "bg-red-700 text-white" : "bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300"}">En retard · ${c.joursRetard} j</span>`;
    if (c.prochaineEcheance) return `<span class="inline-block rounded-md bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:text-gray-200">Paiera le ${dateCourte(c.prochaineEcheance)}</span>`;
    return "";
  }
  const ouvertClient = () => resume?.clients.find((c) => c.cle === ouvert) || null;

  function ligneHistorique(h) {
    if (h.type === "vente") {
      return `<div class="flex justify-between gap-3 py-2.5 border-b border-gray-200/70 dark:border-gray-700">
        <span class="text-sm text-[#0d1b19] dark:text-gray-100">${dateCourte(h.date)} · ${echapper(h.libelle)}${Number(h.quantite) > 1 ? ` × ${echapper(h.quantite)}` : ""}</span>
        <span class="text-sm font-bold whitespace-nowrap">${fcfa(h.montant)} F</span></div>`;
    }
    return `<div class="flex justify-between gap-3 py-2.5 border-b border-gray-200/70 dark:border-gray-700">
      <span class="text-sm text-[#0d1b19] dark:text-gray-100">${dateCourte(h.date)} · ${h.type === "avance" ? "Avance" : "Paiement"} · ${MOYENS[h.moyen] || echapper(h.moyen)}
        <button type="button" data-annuler="${echapper(h.id)}" class="ml-2 text-xs text-gray-400 hover:text-red-600 hover:underline">Annuler</button></span>
      <span class="text-sm font-bold text-green-700 dark:text-green-400 whitespace-nowrap">− ${fcfa(h.montant)} F</span></div>`;
  }

  function carte(c) {
    const deplie = c.cle === ouvert;
    const moyen = moyens[c.cle] || "cash";
    const tete = `
      <button type="button" data-deplier="${echapper(c.cle)}" class="w-full flex items-center gap-4 text-left ${deplie ? "" : "p-5"}">
        <span class="size-12 shrink-0 rounded-full flex items-center justify-center text-lg font-black ${c.enRetard ? "bg-[#0B2A5B] text-white" : "bg-gray-200 dark:bg-gray-700 text-[#0d1b19] dark:text-white"}">${echapper(initiale(c.nom))}</span>
        <span class="min-w-0 flex-1">
          <span class="block font-bold text-[#0d1b19] dark:text-white truncate">${echapper(c.nom)}</span>
          <span class="block text-sm text-gray-500 dark:text-gray-400">${c.telephone ? `${echapper(c.telephone)} · ` : ""}${c.nbVentes} vente${c.nbVentes > 1 ? "s" : ""} à crédit</span>
        </span>
        <span class="text-right shrink-0">
          <span class="block text-xs text-gray-500 dark:text-gray-400">Doit</span>
          <span class="block text-xl font-black ${c.enRetard && deplie ? "text-red-700 dark:text-red-400" : "text-[#0d1b19] dark:text-white"}">${fcfa(c.du)} F</span>
          ${badge(c)}
        </span>
        ${deplie ? "" : `<span class="material-symbols-outlined text-gray-400">chevron_right</span>`}
      </button>`;
    if (!deplie) {
      return `<div class="rounded-[22px] bg-white dark:bg-[#182c29] border border-transparent hover:border-[#cfe7e3] dark:hover:border-gray-600 shadow-sm" data-client="${echapperHtml(c.cle)}">${tete}</div>`;
    }
    return `<div class="rounded-[22px] bg-white dark:bg-[#182c29] border-2 border-[#0B2A5B] dark:border-primary shadow-sm p-5" data-client="${echapperHtml(c.cle)}">
      ${tete}
      <div class="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div class="rounded-2xl bg-gray-50 dark:bg-gray-800/60 p-4">
          <p class="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-1">Historique</p>
          ${c.historique.map(ligneHistorique).join("")}
          <div class="flex justify-between gap-3 pt-3">
            <span class="font-bold text-[#0d1b19] dark:text-white">Reste à payer</span>
            <span class="font-black text-red-700 dark:text-red-400">${fcfa(c.du)} F</span>
          </div>
          ${c.telephone
            ? `<a href="${lienRappel(c)}" target="_blank" rel="noopener" class="mt-4 flex items-center justify-center h-12 rounded-full border border-green-300 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-bold hover:bg-green-100">Lui rappeler sur WhatsApp</a>`
            : `<p class="mt-4 text-center text-xs text-gray-500 dark:text-gray-400">Pas de téléphone noté : ajoutez-le à sa prochaine vente pour pouvoir lui écrire sur WhatsApp.</p>`}
        </div>
        <form class="rounded-2xl bg-gray-50 dark:bg-gray-800/60 p-4" data-payer="${echapperHtml(c.cle)}" novalidate>
          <p class="text-sm font-semibold text-gray-500 dark:text-gray-400">${accord(c)} a payé ?</p>
          <label class="block mt-3"><span class="block font-semibold text-[#0d1b19] dark:text-white mb-2">Combien ?</span>
            <input name="montant" type="number" min="1" max="${c.du}" step="1" inputmode="numeric" value="${c.du}"
                   class="form-input w-full h-12 rounded-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-background-dark px-5 text-base text-[#0d1b19] dark:text-white"></label>
          <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Tout ou une partie : le reste restera dû.</p>
          <div class="mt-4 inline-flex rounded-full bg-gray-200/70 dark:bg-gray-700 p-1" data-moyens>
            ${["cash", "mobile_money"].map((m) => `<button type="button" data-moyen="${m}" class="px-5 h-10 rounded-full text-sm font-bold ${m === moyen ? "bg-white dark:bg-gray-600 shadow-sm text-[#0d1b19] dark:text-white" : "text-gray-500"}">${MOYENS[m]}</button>`).join("")}
          </div>
          <p data-erreur class="hidden mt-3 text-sm font-medium text-red-600"></p>
          <button type="submit" class="mt-4 w-full h-12 rounded-full bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-60">Enregistrer le paiement</button>
        </form>
      </div>
    </div>`;
  }
  const echapperHtml = echapper;

  function afficher() {
    if (!resume) return;
    el("creditsTotal").textContent = fcfa(resume.du);
    el("creditsNbClients").textContent = resume.nbClients
      ? `${resume.nbClients} client${resume.nbClients > 1 ? "s" : ""}`
      : "Personne ne vous doit d'argent en ce moment.";
    el("creditsRetardBloc").classList.toggle("hidden", !resume.nbEnRetard);
    el("creditsRetard").textContent = `${fcfa(resume.enRetard)} F`;
    el("creditsNbRetard").textContent = `${resume.nbEnRetard} client${resume.nbEnRetard > 1 ? "s" : ""}`;

    const filtre = window.OGOUE.cleClient(recherche.value);
    const chiffres = recherche.value.replace(/\D/g, "");
    const correspond = (c) => !filtre || c.cle.includes(filtre) || (chiffres && String(c.telephone).replace(/\D/g, "").includes(chiffres));
    const dus = resume.clients.filter((c) => c.du > 0 && correspond(c));
    const soldes = resume.clients.filter((c) => c.du <= 0 && correspond(c))
      .sort((a, b) => b.derniereActivite.localeCompare(a.derniereActivite));

    liste.innerHTML = dus.map(carte).join("");
    message.classList.toggle("hidden", dus.length > 0);
    message.textContent = resume.clients.length && recherche.value ? "Aucun client ne correspond." : "Aucun crédit en cours.";

    el("creditsSoldesBloc").classList.toggle("hidden", !soldes.length);
    el("creditsNbSoldes").textContent = soldes.length;
    el("creditsSoldes").innerHTML = soldes.map((c) => `
      <div class="flex items-center justify-between gap-3 rounded-xl bg-white dark:bg-[#182c29] px-4 py-3 text-sm">
        <span class="font-semibold text-[#0d1b19] dark:text-white">${echapper(c.nom)}</span>
        <span class="text-gray-500 dark:text-gray-400">${fcfa(c.vendu)} F vendus à crédit · tout réglé</span>
      </div>`).join("");
  }

  async function charger() {
    const r = await getCredits();
    if (!r.ok) {
      message.classList.remove("hidden");
      message.textContent = r.status === 503
        ? "Le suivi des crédits n'est pas encore activé sur ce compte."
        : "Impossible de charger les crédits. Réessayez dans un instant.";
      return;
    }
    resume = resumerCredits(r.ventes, r.reglements);
    window.OGOUE_badgeCredits?.afficher({ clients: resume.nbClients });
    afficher();
  }

  liste.addEventListener("click", async (e) => {
    const deplier = e.target.closest("[data-deplier]");
    if (deplier) {
      ouvert = ouvert === deplier.dataset.deplier ? null : deplier.dataset.deplier;
      afficher();
      return;
    }
    const m = e.target.closest("[data-moyen]");
    if (m) {
      moyens[m.closest("[data-payer]").dataset.payer] = m.dataset.moyen;
      m.parentElement.querySelectorAll("[data-moyen]").forEach((b) => {
        const on = b === m;
        ["bg-white", "dark:bg-gray-600", "shadow-sm", "text-[#0d1b19]", "dark:text-white"].forEach((k) => b.classList.toggle(k, on));
        b.classList.toggle("text-gray-500", !on);
      });
      return;
    }
    const annuler = e.target.closest("[data-annuler]");
    if (annuler) {
      if (!confirm("Annuler ce règlement ? La somme redeviendra due.")) return;
      const r = await annulerReglement(annuler.dataset.annuler);
      if (!r.ok) return alert(r.error);
      await charger();
    }
  });

  liste.addEventListener("submit", async (e) => {
    const f = e.target.closest("[data-payer]");
    if (!f) return;
    e.preventDefault();
    const c = resume.clients.find((x) => x.cle === f.dataset.payer);
    const erreur = f.querySelector("[data-erreur]");
    const montant = Number(f.elements.montant.value);
    const montrer = (t) => { erreur.textContent = t; erreur.classList.remove("hidden"); };
    if (!(montant > 0)) return montrer("Indiquez la somme reçue.");
    if (montant > c.du) return montrer(`${c.nom} ne doit que ${fcfa(c.du)} F.`);
    const bouton = f.querySelector("button[type=submit]");
    bouton.disabled = true;
    const r = await enregistrerReglement({ clientNom: c.nom, clientTelephone: c.telephone || null, montant, moyen: moyens[c.cle] || "cash", nature: "paiement" });
    if (!r.ok) { bouton.disabled = false; return montrer(r.error); }
    window.OGOUE_FEEDBACK?.succes(montant >= c.du
      ? `${echapper(c.nom)} a tout réglé · ${fcfa(montant)} F`
      : `Paiement de ${fcfa(montant)} F enregistré · reste ${fcfa(c.du - montant)} F`);
    if (montant >= c.du) ouvert = null;
    await charger();
  });

  recherche.addEventListener("input", afficher);
  charger();
})();
