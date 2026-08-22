-- ============================================================
-- Client d'une vente
-- ------------------------------------------------------------
-- Le reçu édité par OGOUE doit identifier les deux parties :
-- l'entreprise émettrice (déjà connue via organizations) et le
-- client. Ces trois colonnes portent ce second volet.
--
-- Toutes facultatives : une vente au comptoir n'a pas toujours de
-- client nommé, et les ventes enregistrées avant cette migration
-- n'en ont aucun.
--
-- À exécuter dans l'éditeur SQL de Supabase (base principale).
-- ============================================================

ALTER TABLE sales ADD COLUMN IF NOT EXISTS client_name  TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS client_email TEXT;

COMMENT ON COLUMN sales.client_name  IS 'Nom et prénom du client, imprimés sur le reçu de vente';
COMMENT ON COLUMN sales.client_phone IS 'Téléphone du client, imprimé sur le reçu de vente';
COMMENT ON COLUMN sales.client_email IS 'Adresse e-mail du client, imprimée sur le reçu de vente';
