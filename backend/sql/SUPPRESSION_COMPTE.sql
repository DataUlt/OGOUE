-- ============================================================
-- Suppression de compte demandee par le gerant
-- ------------------------------------------------------------
-- Le bouton « Supprimer mon compte » ne detruit rien sur le moment :
-- il ferme le compte (plus aucune connexion, agents compris) et
-- programme l'effacement 30 jours plus tard. Une tache du serveur
-- (utils/purge-comptes.js) efface ensuite les donnees.
--
-- RESTAURER un compte pendant les 30 jours (le client a change d'avis) :
--   UPDATE organizations
--   SET suppression_demandee_le = NULL, suppression_prevue_le = NULL
--   WHERE id = '<id de l''organisation>';
--
-- Relancable sans risque.
-- A executer dans Supabase : Dashboard > SQL Editor > New query
-- ============================================================

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS suppression_demandee_le TIMESTAMPTZ NULL;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS suppression_prevue_le TIMESTAMPTZ NULL;

-- La tache d'effacement ne lit que les comptes dont la date est passee
CREATE INDEX IF NOT EXISTS idx_organizations_suppression_prevue
    ON organizations(suppression_prevue_le)
    WHERE suppression_prevue_le IS NOT NULL;
