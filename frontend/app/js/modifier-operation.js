// Modification d'une vente ou d'une dépense, pendant 24 h après l'enregistrement.
// Fenêtre centrée, mise en page reprise du formulaire d'enregistrement.
// Le serveur fait foi : ce module ne sert qu'à afficher le bouton et à envoyer les champs modifiables.
(function () {
  const FENETRE_MS = 24 * 60 * 60 * 1000;

  /** Vrai si l'opération a été enregistrée il y a moins de 24 h (horloge du téléphone, indicatif). */
  function estModifiable(createdAt) {
    if (!createdAt) return false;
    const texte = String(createdAt);
    const date = new Date(/([zZ]|[+-]\d{2}:?\d{2})$/.test(texte) ? texte : texte + "Z");
    if (Number.isNaN(date.getTime())) return false;
    return Date.now() - date.getTime() <= FENETRE_MS;
  }

  function echapper(valeur) {
    return String(valeur ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // Mêmes classes que les champs du formulaire d'enregistrement
  const CLASSE_CHAMP =
    "form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-[#0d1b19] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-background-light dark:bg-background-dark h-14 px-4 text-base disabled:opacity-60 disabled:cursor-not-allowed";
  const CLASSE_TITRE = "text-base font-medium leading-normal pb-2 text-[#0d1b19] dark:text-gray-200";

  function controleHtml(c) {
    const attrs = c.disabled ? " disabled" : "";
    if (c.type === "select") {
      const options = c.options
        .map((o) => `<option value="${echapper(o.value)}"${String(o.value) === String(c.value) ? " selected" : ""}>${echapper(o.label)}</option>`)
        .join("");
      return `<select name="${c.name}" class="${CLASSE_CHAMP}"${attrs}>${options}</select>`;
    }
    if (c.type === "textarea") {
      return `<textarea name="${c.name}" rows="3" maxlength="1000" class="${CLASSE_CHAMP} h-auto py-3"${attrs}>${echapper(c.value)}</textarea>`;
    }
    const step = c.type === "number" ? ' step="1" min="0"' : "";
    return `<input name="${c.name}" type="${c.type}" value="${echapper(c.value)}"${step} class="${CLASSE_CHAMP}"${attrs}>`;
  }

  function champHtml(c) {
    const largeur = c.pleine ? "md:col-span-2" : "";
    const masque = c.visibleSi ? " hidden" : "";
    const data = c.visibleSi ? ` data-visible-si="${echapper(c.visibleSi.champ)}" data-visible-valeur="${echapper(c.visibleSi.valeur)}"` : "";
    const aide = c.aide ? `<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">${echapper(c.aide)}</p>` : "";
    return `<label class="flex flex-col ${largeur}${masque}"${data}><p class="${CLASSE_TITRE}">${echapper(c.label)}</p>${controleHtml(c)}${aide}</label>`;
  }

  /**
   * ouvrir({ titre, url, token, champs, transformer, onSaved })
   * champs : [{ name, label, type, value, options, disabled, aide, pleine, visibleSi:{champ,valeur} }]
   * name = clé de l'API (PATCH JSON). transformer(corps, form) peut ajuster le corps avant envoi.
   */
  function ouvrir({ titre, url, token, champs, transformer, onSaved }) {
    document.getElementById("ogo-modal-modifier")?.remove();

    const fond = document.createElement("div");
    fond.id = "ogo-modal-modifier";
    fond.className = "fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4";
    fond.innerHTML = `
      <form role="dialog" aria-modal="true" aria-labelledby="ogo-modifier-titre"
            class="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-gray-800 p-6 shadow-2xl outline-none">
        <div class="flex items-center justify-between gap-4 mb-6">
          <h3 id="ogo-modifier-titre" class="text-xl font-bold text-[#0d1b19] dark:text-white">${echapper(titre)}</h3>
          <button type="button" data-annuler aria-label="Fermer"
                  class="inline-flex items-center justify-center size-8 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200">
            <span class="material-symbols-outlined text-base">close</span>
          </button>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">${champs.map(champHtml).join("")}</div>
        <label class="mt-6 flex flex-col">
          <p class="${CLASSE_TITRE}">Raison de la modification <span class="text-red-500">*</span></p>
          <input name="reason" type="text" maxlength="120" required placeholder="Ex. : erreur de montant" class="${CLASSE_CHAMP}">
          <p data-compteur class="mt-1 text-sm text-gray-500 dark:text-gray-400">0 / 120 · 6 caractères minimum</p>
        </label>
        <p data-erreur class="hidden mt-4 text-sm text-red-600"></p>
        <div class="mt-8 flex justify-end gap-3">
          <button type="button" data-annuler class="px-6 py-3 rounded-lg text-sm font-bold bg-gray-200 dark:bg-gray-700 text-[#0d1b19] dark:text-gray-200 hover:bg-gray-300">Annuler</button>
          <button type="submit" data-valider class="px-6 py-3 rounded-lg text-sm font-bold bg-primary text-[#0d1b19] hover:bg-primary/80">Enregistrer les modifications</button>
        </div>
      </form>`;
    document.body.appendChild(fond);

    const form = fond.querySelector("form");
    const erreur = fond.querySelector("[data-erreur]");
    const bouton = fond.querySelector("[data-valider]");

    // Affichage conditionnel (ex. libellé libre si « Autres » est choisi)
    function majVisibilite() {
      form.querySelectorAll("[data-visible-si]").forEach((bloc) => {
        const source = form.elements[bloc.dataset.visibleSi];
        bloc.classList.toggle("hidden", !source || String(source.value) !== bloc.dataset.visibleValeur);
      });
    }
    form.addEventListener("change", majVisibilite);
    const champRaison = form.elements.reason;
    const compteur = fond.querySelector("[data-compteur]");
    champRaison.addEventListener("input", () => {
      const n = champRaison.value.trim().length;
      compteur.textContent = n + " / 120 · 6 caractères minimum";
      compteur.classList.toggle("text-red-600", n > 0 && n < 6);
    });
    majVisibilite();

    function fermer() {
      document.removeEventListener("keydown", surEchap);
      fond.remove();
    }
    function surEchap(e) {
      if (e.key === "Escape") fermer();
    }
    document.addEventListener("keydown", surEchap);
    fond.querySelectorAll("[data-annuler]").forEach((b) => b.addEventListener("click", fermer));
    fond.addEventListener("click", (e) => { if (e.target === fond) fermer(); });

    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      const raison = champRaison.value.trim();
      if (raison.length < 6 || raison.length > 120) {
        erreur.textContent = "Indiquez la raison de la modification (entre 6 et 120 caractères).";
        erreur.classList.remove("hidden");
        champRaison.focus();
        return;
      }
      let corps = {};
      for (const c of champs) {
        if (c.disabled) continue; // les champs figés ne sont pas renvoyés
        const el = form.elements[c.name];
        if (!el) continue;
        let valeur = el.value;
        if (c.type === "number") valeur = valeur === "" ? undefined : Number(valeur);
        if (valeur !== undefined) corps[c.name] = valeur;
      }
      if (transformer) corps = transformer(corps, form);
      corps.reason = raison;
      bouton.disabled = true;
      bouton.classList.add("opacity-60", "cursor-wait");
      erreur.classList.add("hidden");
      try {
        const reponse = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(corps),
        });
        const donnees = await reponse.json().catch(() => ({}));
        if (!reponse.ok) throw new Error(donnees.error || "Modification impossible");
        fermer();
        if (onSaved) await onSaved();
        window.OGOUE_FEEDBACK?.succes("Modification enregistrée");
      } catch (err) {
        erreur.textContent = err.message;
        erreur.classList.remove("hidden");
        bouton.disabled = false;
        bouton.classList.remove("opacity-60", "cursor-wait");
      }
    });

    form.querySelector("input:not([disabled]), select:not([disabled]), textarea:not([disabled])")?.focus();
  }

  window.OGOUE_MODIFIER = { estModifiable: estModifiable, ouvrir: ouvrir, FENETRE_MS: FENETRE_MS };
})();
