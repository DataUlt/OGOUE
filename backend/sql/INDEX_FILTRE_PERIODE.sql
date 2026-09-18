-- ============================================================
-- Index de lecture pour le filtrage par organisation et periode
-- ------------------------------------------------------------
-- Le tableau de bord et le resume interrogent les ventes et les
-- depenses de la meme facon : organization_id en egalite, puis une
-- plage sur la date, puis un tri decroissant sur cette meme date.
-- Sans index, PostgreSQL parcourt toute la table a chaque filtre.
--
-- L'ordre des colonnes reproduit exactement cette interrogation :
-- c'est la seule combinaison qui permet a la base de filtrer et de
-- trier en une seule lecture de l'index.
--
-- Purement additif : aucune donnee n'est modifiee ni supprimee, et
-- l'operation est reversible (voir DROP en fin de fichier).
--
-- Note pour plus tard : CREATE INDEX pose un verrou en ecriture le
-- temps de la construction. Sur les volumes actuels c'est une affaire
-- de millisecondes. Sur une grosse table en production, utiliser
-- CREATE INDEX CONCURRENTLY a la place : plus lent, mais sans bloquer
-- l'enregistrement des ventes pendant ce temps.
--
-- A executer dans Supabase : Dashboard > SQL Editor > New query
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sales_org_date
    ON sales (organization_id, sale_date DESC);

CREATE INDEX IF NOT EXISTS idx_expenses_org_date
    ON expenses (organization_id, expense_date DESC);

-- ------------------------------------------------------------
-- Verification : doit retourner deux lignes
-- ------------------------------------------------------------
-- SELECT tablename, indexname
-- FROM pg_indexes
-- WHERE indexname IN ('idx_sales_org_date', 'idx_expenses_org_date');

-- ------------------------------------------------------------
-- Retour arriere
-- ------------------------------------------------------------
-- DROP INDEX IF EXISTS idx_sales_org_date;
-- DROP INDEX IF EXISTS idx_expenses_org_date;
