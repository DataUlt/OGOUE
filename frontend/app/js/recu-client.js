// js/recu-client.js
// ============================================================
// Établissement d'un reçu de vente, avec saisie du client
// ------------------------------------------------------------
// Le reçu peut être établi depuis deux écrans : le tableau des ventes
// et la liste des justificatifs manquants du score de traçabilité.
// La saisie du client vit donc ici plutôt que d'être recopiée dans
// chacun d'eux.
//
// Dépend de ogoue-state.js pour API_BASE_URL et getToken().
// ============================================================
(function () {
  /**
   * Demande les informations du client, puis établit le reçu.
   *
   * Les trois champs sont facultatifs : une vente au comptoir n'a pas
   * toujours d'acheteur nommé, et valider à vide produit un reçu sans
   * bloc client, qui reste un document valable.
   *
   * @param {Object} options
   * @param {string} options.venteId
   * @param {Function} [options.apresEtablissement] appelée avec {url, numero}
   */
  function demanderClientPuisEtablirRecu({ venteId, apresEtablissement }) {
    const ancien = document.getElementById("recu-client-modal");
    if (ancien) ancien.remove();

    const modal = document.createElement("div");
    modal.id = "recu-client-modal";
    modal.className =
      "fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[99999] p-4";
    modal.innerHTML = `
      <div class="bg-white dark:bg-card-dark rounded-xl w-full max-w-lg shadow-lg border border-[#e8ede8] dark:border-[#2a3a32]">
        <div class="p-6 border-b border-[#e8ede8] dark:border-[#2a3a32]">
          <h2 class="text-lg font-bold text-[#0d1b19] dark:text-white">Établir le reçu</h2>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Renseignez le client si vous disposez de ses informations.
            Laissez vide sinon : le reçu sera établi sans bloc client.
          </p>
        </div>
        <div class="p-6 space-y-4">
          <label class="flex flex-col">
            <span class="text-xs font-medium pb-1.5 text-[#0d1b19] dark:text-gray-200">Nom et prénom du client</span>
            <input id="modal-client-nom" type="text" autocomplete="off" placeholder="Ex : Jean OBAME"
                   class="form-input w-full rounded-lg text-[#0d1b19] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-white dark:bg-background-dark h-11 placeholder:text-gray-400 px-3 text-sm" />
          </label>
          <label class="flex flex-col">
            <span class="text-xs font-medium pb-1.5 text-[#0d1b19] dark:text-gray-200">Téléphone</span>
            <input id="modal-client-telephone" type="tel" autocomplete="off" placeholder="Ex : 077 00 00 00"
                   class="form-input w-full rounded-lg text-[#0d1b19] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-white dark:bg-background-dark h-11 placeholder:text-gray-400 px-3 text-sm" />
          </label>
          <label class="flex flex-col">
            <span class="text-xs font-medium pb-1.5 text-[#0d1b19] dark:text-gray-200">Adresse e-mail</span>
            <input id="modal-client-email" type="email" autocomplete="off" placeholder="Ex : client@exemple.com"
                   class="form-input w-full rounded-lg text-[#0d1b19] dark:text-white focus:outline-0 focus:ring-2 focus:ring-primary/50 border border-gray-300 dark:border-gray-600 bg-white dark:bg-background-dark h-11 placeholder:text-gray-400 px-3 text-sm" />
          </label>
        </div>
        <div class="flex justify-end gap-3 px-6 py-4 border-t border-[#e8ede8] dark:border-[#2a3a32]">
          <button type="button" id="modal-recu-annuler"
                  class="px-5 py-2.5 rounded-lg text-sm font-bold bg-gray-200 dark:bg-gray-700 text-[#0d1b19] dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600">
            Annuler
          </button>
          <button type="button" id="modal-recu-valider"
                  class="px-5 py-2.5 rounded-lg text-sm font-bold bg-primary text-[#0d1b19] hover:bg-primary/80">
            Établir le reçu
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    document.getElementById("modal-client-nom")?.focus();

    function surEchap(e) {
      if (e.key === "Escape") fermer();
    }

    function fermer() {
      modal.remove();
      document.removeEventListener("keydown", surEchap);
    }

    document.addEventListener("keydown", surEchap);

    // Clic sur le fond, en dehors de la carte
    modal.addEventListener("click", (e) => {
      if (e.target === modal) fermer();
    });

    document.getElementById("modal-recu-annuler")?.addEventListener("click", fermer);

    const valider = document.getElementById("modal-recu-valider");
    valider?.addEventListener("click", async () => {
      const corps = {
        clientName: (document.getElementById("modal-client-nom")?.value || "").trim(),
        clientPhone: (document.getElementById("modal-client-telephone")?.value || "").trim(),
        clientEmail: (document.getElementById("modal-client-email")?.value || "").trim(),
      };

      valider.disabled = true;
      valider.textContent = "Établissement…";

      try {
        const token = getToken();
        const reponse = await fetch(`${API_BASE_URL}/api/sales/${venteId}/recu`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(corps),
        });
        const data = await reponse.json();

        if (!reponse.ok) throw new Error(data.error || "Reçu indisponible");

        // Le document n'est délibérément PAS ouvert ici : établir un reçu
        // et le consulter sont deux gestes distincts. Le numéro apparaît
        // dans la colonne Justificatif, où un clic l'ouvre à la demande.
        fermer();

        if (typeof apresEtablissement === "function") {
          await apresEtablissement(data);
        }
      } catch (erreur) {
        console.error("Erreur reçu:", erreur);
        alert("Le reçu n'a pas pu être établi : " + erreur.message);
        valider.disabled = false;
        valider.textContent = "Établir le reçu";
      }
    });
  }

  window.OGOUE_RECU = { demanderClientPuisEtablirRecu };
})();
