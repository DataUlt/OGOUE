-- Dernière connexion de chaque agent.
-- À exécuter UNE FOIS dans Supabase > SQL Editor, AVANT de déployer le backend
-- (sinon la liste des agents échoue : la colonne n'existe pas encore).
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
