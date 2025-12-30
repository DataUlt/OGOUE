/**
 * Module de gestion des suppressions avec audit
 * Affiche une modal demandant la justification avant suppression
 */

export class DeletionAuditManager {
  constructor() {
    this.pendingDeletion = null;
  }

  /**
   * Affiche une modal de confirmation avec champ de justification
   * @param {Object} options
   * @param {string} options.title - Titre du dialog
   * @param {string} options.message - Message de confirmation
   * @param {string} options.recordType - Type d'enregistrement (expense, sale, etc.)
   * @param {string} options.recordId - ID de l'enregistrement
   * @param {Function} options.onConfirm - Callback onConfirm(reason)
   * @param {Function} options.onCancel - Callback onCancel()
   */
  static showDeletionModal(options) {
    const {
      title = "Confirmer la suppression",
      message = "Êtes-vous sûr de vouloir supprimer cet enregistrement ?",
      recordType = "unknown",
      recordId = null,
      onConfirm = () => {},
      onCancel = () => {},
    } = options;

    // Créer le HTML du modal
    const modalId = `deletion-modal-${Date.now()}`;
    const html = `
      <div id="${modalId}" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div class="bg-card-light dark:bg-card-dark rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 class="text-lg font-semibold text-text-light-primary dark:text-text-dark-primary mb-2">
            ⚠️ ${title}
          </h2>
          
          <p class="text-text-light-secondary dark:text-text-dark-secondary mb-4">
            ${message}
          </p>

          <div class="mb-4">
            <label class="block text-sm font-medium text-text-light-primary dark:text-text-dark-primary mb-2">
              Motif de la suppression (obligatoire)
            </label>
            <textarea
              id="${modalId}-reason"
              class="w-full px-3 py-2 border border-border-light dark:border-border-dark rounded-lg
                     bg-background-light dark:bg-background-dark
                     text-text-light-primary dark:text-text-dark-primary
                     placeholder-text-light-secondary dark:placeholder-text-dark-secondary
                     focus:outline-none focus:ring-2 focus:ring-primary
                     resize-none"
              rows="3"
              placeholder="Expliquez pourquoi vous supprimez cet enregistrement..."
            ></textarea>
          </div>

          <div class="flex gap-3 justify-end">
            <button
              id="${modalId}-cancel"
              class="px-4 py-2 rounded-lg border border-border-light dark:border-border-dark
                     text-text-light-primary dark:text-text-dark-primary
                     hover:bg-background-light dark:hover:bg-background-dark
                     transition-colors"
            >
              Annuler
            </button>
            <button
              id="${modalId}-confirm"
              class="px-4 py-2 rounded-lg bg-danger text-white
                     hover:bg-red-700 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
              disabled
            >
              Supprimer
            </button>
          </div>
        </div>
      </div>
    `;

    // Ajouter le modal au DOM
    const container = document.body;
    container.insertAdjacentHTML("beforeend", html);

    const modal = document.getElementById(modalId);
    const reasonInput = document.getElementById(`${modalId}-reason`);
    const confirmBtn = document.getElementById(`${modalId}-confirm`);
    const cancelBtn = document.getElementById(`${modalId}-cancel`);

    // Activer le bouton Supprimer seulement si le motif a au moins 10 caractères
    reasonInput.addEventListener("input", () => {
      confirmBtn.disabled = reasonInput.value.trim().length < 10;
    });

    // Gérer les clics
    confirmBtn.addEventListener("click", () => {
      const reason = reasonInput.value.trim();
      if (reason.length >= 10) {
        modal.remove();
        onConfirm(reason);
      }
    });

    cancelBtn.addEventListener("click", () => {
      modal.remove();
      onCancel();
    });

    // Fermer avec Escape
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        modal.remove();
        document.removeEventListener("keydown", handleEscape);
        onCancel();
      }
    };
    document.addEventListener("keydown", handleEscape);
  }

  /**
   * Supprime un enregistrement après confirmation
   * @param {string} endpoint - URL de l'API (ex: /api/expenses/123)
   * @param {Object} options - Options du modal
   */
  static async deleteWithAudit(endpoint, options = {}) {
    return new Promise((resolve) => {
      this.showDeletionModal({
        ...options,
        onConfirm: async (reason) => {
          try {
            const response = await fetch(endpoint, {
              method: "DELETE",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${localStorage.getItem("token")}`,
              },
              body: JSON.stringify({ reason }),
            });

            if (!response.ok) {
              const error = await response.json();
              throw new Error(error.error || "Erreur de suppression");
            }

            resolve({ success: true, message: "Suppression réussie" });
          } catch (error) {
            console.error("❌ Erreur suppression:", error);
            resolve({ success: false, error: error.message });
          }
        },
        onCancel: () => {
          resolve({ success: false, error: "Suppression annulée par l'utilisateur" });
        },
      });
    });
  }
}

export default DeletionAuditManager;
