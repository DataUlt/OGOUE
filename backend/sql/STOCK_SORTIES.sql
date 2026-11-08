-- ============================================================
-- Mouvements de stock : motifs autorisés
-- ------------------------------------------------------------
-- 1. « modification » : la modification d'une vente (quantité, article)
--    enregistre ce motif depuis le début, mais il n'était pas dans la
--    liste : l'insertion était refusée et le mouvement perdu, ce qui
--    faussait le stock initial et les entrées/sorties des rapports.
-- 2. Sorties de stock hors ventes, saisies dans le catalogue :
--    « abime » (produit abîmé), « usage_personnel », « perte » (perte, vol).
-- 3. « inventaire » : correction du stock après un comptage physique
--    (état des stocks, bouton « Corriger le stock avec ce comptage »).
--
-- Relançable sans risque.
-- À exécuter dans Supabase : Dashboard > SQL Editor > New query
-- ============================================================

-- Retire l'ancienne règle sur « motif », quel que soit le nom que
-- Postgres lui a donné à la création de la table
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.stock_movements'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%motif%'
  LOOP
    EXECUTE format('ALTER TABLE public.stock_movements DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_motif_check
    CHECK (motif IN ('initial', 'entree', 'vente', 'correction', 'modification', 'abime', 'usage_personnel', 'perte', 'inventaire'));
