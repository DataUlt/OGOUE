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
      <div id="${modalId}" class="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
        <div class="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-8 border border-slate-200 dark:border-slate-700">
          <div class="flex items-center gap-3 mb-4">
            <span class="text-2xl">⚠️</span>
            <h2 class="text-xl font-bold text-slate-900 dark:text-white">
              ${title}
            </h2>
          </div>
          
          <p class="text-slate-600 dark:text-slate-300 mb-6 text-sm leading-relaxed">
            ${message}
          </p>

          <div class="mb-6">
            <label class="block text-sm font-semibold text-slate-900 dark:text-white mb-3">
              ✍️ Motif de la suppression
              <span class="text-red-500">*</span>
            </label>
            <textarea
              id="${modalId}-reason"
              class="w-full px-4 py-3 border-2 border-slate-300 dark:border-slate-600 rounded-lg
                     bg-white dark:bg-slate-700
                     text-slate-900 dark:text-white
                     placeholder-slate-400 dark:placeholder-slate-500
                     focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
                     resize-none font-sm"
              rows="4"
              placeholder="Expliquez pourquoi vous supprimez cet enregistrement (minimum 10 caractères)..."
            ></textarea>
            <p class="text-xs text-slate-500 dark:text-slate-400 mt-2">
              Minimum 10 caractères requis
            </p>
          </div>

          <div class="flex gap-3 justify-end">
            <button
              id="${modalId}-cancel"
              class="px-5 py-2.5 rounded-lg border-2 border-slate-300 dark:border-slate-600
                     text-slate-700 dark:text-slate-300
                     hover:bg-slate-100 dark:hover:bg-slate-700
                     transition-colors font-medium"
            >
              Annuler
            </button>
            <button
              id="${modalId}-confirm"
              class="px-5 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white
                     transition-colors font-medium
                     disabled:opacity-50 disabled:cursor-not-allowed"
              disabled
            >
              🗑️ Supprimer
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
      const charCount = reasonInput.value.trim().length;
      confirmBtn.disabled = charCount < 10;
      
      // Feedback visuel
      if (charCount === 0) {
        reasonInput.classList.remove('border-green-500', 'dark:border-green-500');
        reasonInput.classList.add('border-slate-300', 'dark:border-slate-600');
      } else if (charCount < 10) {
        reasonInput.classList.remove('border-green-500', 'dark:border-green-500');
        reasonInput.classList.add('border-yellow-400', 'dark:border-yellow-500');
      } else {
        reasonInput.classList.remove('border-slate-300', 'dark:border-slate-600', 'border-yellow-400', 'dark:border-yellow-500');
        reasonInput.classList.add('border-green-500', 'dark:border-green-500');
      }
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
