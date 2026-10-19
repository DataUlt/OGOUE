-- Canal d'acquisition : comment le client nous a connu (saisi à l'inscription).
-- À exécuter UNE FOIS dans Supabase > SQL Editor, AVANT de déployer le backend
-- (sinon l'inscription échoue : la colonne n'existe pas encore).
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS acquisition_source text;
