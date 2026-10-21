-- Dernière consultation d'un dossier, côté PME ou côté institution.
-- Permet de savoir ce qui est non lu, quel que soit l'appareil utilisé.
-- A EXECUTER UNE FOIS dans Supabase > SQL Editor, sur le projet SECONDAIRE
-- (celui des dossiers : zfzjvjpzszayrwsnblao).

CREATE TABLE IF NOT EXISTS application_reads (
    cote VARCHAR(20) NOT NULL CHECK (cote IN ('pme', 'institution')),
    application_id UUID NOT NULL REFERENCES loan_applications(id) ON DELETE CASCADE,
    vu_le TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (cote, application_id)
);

-- Acces uniquement par les backends (service_role), comme les autres tables de dossiers
ALTER TABLE application_reads ENABLE ROW LEVEL SECURITY;
