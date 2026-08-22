-- ============================================================
-- Reçus de vente — base PRINCIPALE (OGOUE)
-- ------------------------------------------------------------
-- À exécuter sur le projet Supabase mqbenehogdrmywhbxjhz.
--   Dashboard > SQL Editor > New query
--
-- Chaque vente enregistrée reçoit désormais un reçu produit par
-- l'application. Ce document est distinct du justificatif que le
-- gérant téléverse : l'un est émis par nous, l'autre est reçu d'un
-- tiers. Les mélanger viderait le score de traçabilité de son sens.
-- ============================================================

-- ── Le reçu attaché à une vente ────────────────────────────
ALTER TABLE sales
    ADD COLUMN IF NOT EXISTS receipt_number   VARCHAR(30),
    ADD COLUMN IF NOT EXISTS receipt_doc_path TEXT;

COMMENT ON COLUMN sales.receipt_number IS
    'Numéro du reçu émis par OGOUE, ex. REC-2026-000123. Distinct de receipt_name, qui désigne le justificatif téléversé.';
COMMENT ON COLUMN sales.receipt_doc_path IS
    'Chemin du PDF dans le bucket privé "recus". Servi uniquement par URL signée.';

-- Un numéro ne peut pas être attribué deux fois dans une organisation.
-- L'index partiel laisse cohabiter les ventes anterieures, sans reçu.
CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_receipt_number
    ON sales (organization_id, receipt_number)
    WHERE receipt_number IS NOT NULL;

-- ── Compteur de numérotation ───────────────────────────────
-- Un compteur par organisation et par année : la numérotation doit
-- être continue et sans trou, et repartir à 1 chaque année.
CREATE TABLE IF NOT EXISTS receipt_counters (
    organization_id UUID    NOT NULL,
    year            INTEGER NOT NULL,
    last_number     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (organization_id, year)
);

ALTER TABLE receipt_counters ENABLE ROW LEVEL SECURITY;

-- ── Attribution atomique d'un numéro ───────────────────────
-- Deux ventes enregistrées au même instant ne doivent jamais obtenir
-- le même numéro. INSERT ... ON CONFLICT DO UPDATE ... RETURNING est
-- exécuté en une seule instruction : PostgreSQL sérialise les accès
-- concurrents sur la ligne, aucune transaction applicative n'est
-- nécessaire.
CREATE OR REPLACE FUNCTION next_receipt_number(org UUID, yr INTEGER)
RETURNS INTEGER AS $$
DECLARE
    numero INTEGER;
BEGIN
    INSERT INTO receipt_counters (organization_id, year, last_number)
    VALUES (org, yr, 1)
    ON CONFLICT (organization_id, year)
    DO UPDATE SET last_number = receipt_counters.last_number + 1
    RETURNING last_number INTO numero;

    RETURN numero;
END;
$$ LANGUAGE plpgsql;
