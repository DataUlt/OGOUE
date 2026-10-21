-- Numéro WhatsApp du gérant (facultatif), saisi à l'inscription.
-- À exécuter UNE FOIS dans Supabase > SQL Editor, AVANT de déployer le backend
-- (sinon l'inscription échoue : la colonne n'existe pas encore).
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp text;
