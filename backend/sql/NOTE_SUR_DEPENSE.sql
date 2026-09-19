-- ============================================================
-- Commentaire libre sur une depense
-- ------------------------------------------------------------
-- Pendant de sales.note, pour les memes raisons : une depense ne se
-- resume pas toujours a son montant. Acompte verse a un fournisseur,
-- achat pour le compte d'un client a refacturer, depense partagee
-- entre deux mois : autant de precisions que le gerant doit pouvoir
-- noter, faute de quoi il n'en garde aucune trace.
--
-- Volontairement un texte libre et facultatif, non structure : c'est
-- un pense-bete, pas une donnee sur laquelle l'application calcule
-- quoi que ce soit.
--
-- A executer dans Supabase : Dashboard > SQL Editor > New query
-- ============================================================

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS note TEXT;

COMMENT ON COLUMN public.expenses.note IS
    'Commentaire libre saisi par le gerant, facultatif. Ex. : acompte fournisseur, solde a regler.';

-- Le cache de schema de PostgREST doit connaitre la nouvelle colonne,
-- sans quoi l'insertion echoue avec PGRST204.
NOTIFY pgrst, 'reload schema';
