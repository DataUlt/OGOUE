-- ============================================================
-- Suivi des crédits clients
-- ------------------------------------------------------------
-- Une vente à crédit garde payment_method = 'credit' : elle compte dans
-- le chiffre d'affaires dès la vente. Ce que le client verse ensuite
-- s'écrit dans credit_reglements, par client et non par vente : il peut
-- payer une partie, en plusieurs fois, ou plusieurs ventes d'un coup.
--
--   Dû par un client = ventes à crédit − avances − paiements
--
-- Le client est reconnu par son nom (client_name sur la vente,
-- client_nom ici), comparé sans majuscules, accents ni espaces doublés
-- (client_cle). La date promise (« il paiera le reste dans… ») est
-- portée par chaque vente : sales.credit_echeance.
--
-- Relançable sans risque.
-- À exécuter dans Supabase : Dashboard > SQL Editor > New query
-- ============================================================

ALTER TABLE sales ADD COLUMN IF NOT EXISTS credit_echeance DATE NULL;

CREATE TABLE IF NOT EXISTS credit_reglements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    client_nom VARCHAR(150) NOT NULL,
    client_cle VARCHAR(150) NOT NULL,
    client_telephone VARCHAR(50) NULL,
    montant NUMERIC(14, 2) NOT NULL CHECK (montant > 0),
    moyen VARCHAR(30) NOT NULL,                       -- cash | mobile_money
    nature VARCHAR(20) NOT NULL DEFAULT 'paiement',   -- avance (à la vente) | paiement (ensuite)
    regle_le TIMESTAMPTZ NOT NULL DEFAULT now(),
    cree_par UUID NULL,
    cree_par_nom VARCHAR(150) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Paiement fait pour une vente précise (bouton « Payer » du tableau des ventes) :
-- il règle d'abord cette vente. Sans vente, il règle les plus anciennes d'abord.
ALTER TABLE credit_reglements ADD COLUMN IF NOT EXISTS sale_id UUID NULL REFERENCES sales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_credit_reglements_client
    ON credit_reglements(organization_id, client_cle);
CREATE INDEX IF NOT EXISTS idx_credit_reglements_date
    ON credit_reglements(organization_id, regle_le);
CREATE INDEX IF NOT EXISTS idx_sales_credits
    ON sales(organization_id, sale_date)
    WHERE payment_method = 'credit';

-- Lu et écrit par le serveur seulement (clé de service), comme les autres tables
ALTER TABLE credit_reglements ENABLE ROW LEVEL SECURITY;
