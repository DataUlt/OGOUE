-- Discussion d'un dossier de financement entre la PME et l'institution.
-- Messages texte et/ou piece jointe (fichier dans le bucket prive « dossiers-financement »).
-- A EXECUTER UNE FOIS dans Supabase > SQL Editor, sur le projet SECONDAIRE
-- (celui des dossiers : zfzjvjpzszayrwsnblao). Avant de deployer le code des messages.

CREATE TABLE IF NOT EXISTS application_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    author_role VARCHAR(20) NOT NULL CHECK (author_role IN ('pme', 'institution')),
    author_name TEXT,
    body TEXT,
    attachment_name TEXT,
    attachment_path TEXT,
    attachment_size INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Un message vide n'a pas de sens : il faut du texte ou une piece jointe
    CONSTRAINT message_non_vide CHECK (body IS NOT NULL OR attachment_path IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_application_messages_dossier
    ON application_messages(application_id, created_at);

-- Meme regle que les autres tables de dossiers : acces uniquement par les backends (service_role)
ALTER TABLE application_messages ENABLE ROW LEVEL SECURITY;
