-- ============================================================
-- Dépenses à crédit (achat payé plus tard)
-- ------------------------------------------------------------
-- Une dépense à crédit porte payment_method = 'credit'. Elle compte dans
-- les charges du mois dès sa date (compte de résultat). Le fournisseur
-- se note dans le commentaire.
--
--   credit_echeance : date de remboursement estimée (facultative)
--   credit_regle_le : jour où la dette a été payée. Le moyen de paiement
--                     passe alors de 'credit' à celui utilisé (cash,
--                     mobile_money) ; cette date place la sortie d'argent
--                     au bon jour dans la trésorerie.
--
-- Relançable sans risque.
-- À exécuter dans Supabase : Dashboard > SQL Editor > New query
-- ============================================================

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS credit_echeance DATE NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS credit_regle_le TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_credit
    ON expenses(organization_id, expense_date)
    WHERE payment_method = 'credit' OR credit_regle_le IS NOT NULL;

-- ------------------------------------------------------------
-- Facultatif : si vous aviez lancé FOURNISSEURS.sql (page Fournisseurs,
-- abandonnée), ces lignes retirent ce qu'il avait créé. À lancer seulement
-- si vous n'avez rien saisi d'important dans la page Fournisseurs.
-- ------------------------------------------------------------
-- DROP TABLE IF EXISTS fournisseur_paiements;
-- ALTER TABLE expenses DROP COLUMN IF EXISTS fournisseur_id;
-- DROP TABLE IF EXISTS fournisseurs;
