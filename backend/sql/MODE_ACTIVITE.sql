-- ============================================================
-- Mode d'activité de l'entreprise : revente, fabrication, ou les deux
-- ------------------------------------------------------------
-- Choisi par le gérant dans « Ma boutique ». Sert au compte de résultat
-- SYSCOHADA :
--   revente      : ventes de produits = ventes de marchandises (TA),
--                  achats = achats de marchandises (RA)
--   fabrication  : ventes de produits = produits fabriqués (TB),
--                  achats = matières premières (RC)
--   les_deux     : chaque produit du catalogue dit s'il est revendu tel
--                  quel ou fabriqué (articles.fabrique) ; les achats de
--                  matières premières ont leur propre catégorie de dépense
-- Les services vont toujours en services vendus (TC).
-- NULL (pas encore répondu) se traite comme « revente ».
--
-- Relançable sans risque.
-- À exécuter dans Supabase : Dashboard > SQL Editor > New query
-- ============================================================

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS mode_activite VARCHAR(20) NULL;

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_mode_activite_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_mode_activite_check
    CHECK (mode_activite IS NULL OR mode_activite IN ('revente', 'fabrication', 'les_deux'));

-- Produit fabriqué par l'entreprise (TRUE) ou revendu tel quel (FALSE / NULL)
ALTER TABLE articles ADD COLUMN IF NOT EXISTS fabrique BOOLEAN NULL;
