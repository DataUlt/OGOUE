-- ============================================================
-- Commentaire libre sur une vente
-- ------------------------------------------------------------
-- Une vente ne se resume pas toujours a ses chiffres. Le cas qui a
-- motive ce champ : un client emporte l'article en ne versant qu'une
-- avance, et revient completer plus tard. Le montant enregistre est
-- celui de la vente, mais le gerant doit pouvoir noter ce qui reste
-- du, sans quoi il n'en garde aucune trace.
--
-- Volontairement un texte libre et facultatif, non structure : il
-- s'agit d'un pense-bete pour le gerant, pas d'une donnee sur laquelle
-- l'application calcule quoi que ce soit. Un champ "reste a payer"
-- chiffre serait un autre sujet, avec ses propres regles.
--
-- A executer dans Supabase : Dashboard > SQL Editor > New query
-- ============================================================

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS note TEXT;

COMMENT ON COLUMN public.sales.note IS
    'Commentaire libre saisi par le gerant, facultatif. Ex. : avance versee, solde a percevoir.';

-- Le cache de schema de PostgREST doit connaitre la nouvelle colonne,
-- sans quoi l'insertion echoue avec PGRST204.
NOTIFY pgrst, 'reload schema';
