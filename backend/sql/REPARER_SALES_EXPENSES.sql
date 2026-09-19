-- ============================================================
-- Reparation des colonnes manquantes sur sales et expenses
-- ------------------------------------------------------------
-- SYMPTOMES
--   Erreur listSales:   column sales.receipt_url does not exist     (42703)
--   Erreur listExpenses: column expenses.receipt_url does not exist (42703)
--   Erreur createSale:  Could not find the 'client_email' column
--                       of 'sales' in the schema cache              (PGRST204)
--
-- CAUSE
-- Les tables ont ete recreees a partir de la seule migration de base.
-- Elles ont donc perdu toutes les colonnes ajoutees ensuite, par :
--   _archives/ADD_CREATED_BY_COLUMNS.sql   -> created_by
--   _archives/ADD_FILE_STORAGE_COLUMNS.sql -> receipt_url, receipt_storage_path
--   sql/RECUS_DE_VENTE.sql                 -> receipt_number, receipt_doc_path,
--                                             table receipt_counters, fonction
--                                             next_receipt_number
--   sql/RECU_CLIENT.sql                    -> client_name, client_phone, client_email
--
-- Ce fichier rejoue ces quatre migrations dans l'ordre, sous une forme
-- entierement idempotente : il peut etre execute sans risque, que les
-- colonnes soient deja presentes ou non. Aucune donnee n'est supprimee.
--
-- A executer dans Supabase : Dashboard > SQL Editor > New query
-- ============================================================


-- ------------------------------------------------------------
-- ETAT DES LIEUX (facultatif, a lancer seul avant)
-- ------------------------------------------------------------
-- SELECT table_name, column_name, data_type
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name IN ('sales', 'expenses')
-- ORDER BY table_name, ordinal_position;


-- ------------------------------------------------------------
-- 1. Auteur de la saisie
-- ------------------------------------------------------------
ALTER TABLE public.sales    ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS created_by UUID;

CREATE INDEX IF NOT EXISTS idx_sales_created_by    ON public.sales(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON public.expenses(created_by);


-- ------------------------------------------------------------
-- 2. Justificatif televerse par le gerant
-- ------------------------------------------------------------
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS receipt_url          TEXT,
    ADD COLUMN IF NOT EXISTS receipt_storage_path TEXT;

ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS receipt_url          TEXT,
    ADD COLUMN IF NOT EXISTS receipt_storage_path TEXT;

CREATE INDEX IF NOT EXISTS idx_sales_storage_path    ON public.sales(receipt_storage_path);
CREATE INDEX IF NOT EXISTS idx_expenses_storage_path ON public.expenses(receipt_storage_path);


-- ------------------------------------------------------------
-- 3. Recu emis par OGOUE
-- ------------------------------------------------------------
-- Distinct du justificatif ci-dessus : l'un est emis par nous, l'autre
-- est recu d'un tiers. Les confondre viderait le score de tracabilite
-- de son sens.
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS receipt_number   VARCHAR(30),
    ADD COLUMN IF NOT EXISTS receipt_doc_path TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_sales_receipt_number
    ON public.sales (organization_id, receipt_number)
    WHERE receipt_number IS NOT NULL;

-- Un compteur par organisation et par annee : numerotation continue,
-- sans trou, repartant a 1 chaque annee.
CREATE TABLE IF NOT EXISTS public.receipt_counters (
    organization_id UUID    NOT NULL,
    year            INTEGER NOT NULL,
    last_number     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (organization_id, year)
);

ALTER TABLE public.receipt_counters ENABLE ROW LEVEL SECURITY;

-- Attribution atomique : deux ventes enregistrees au meme instant ne
-- doivent jamais obtenir le meme numero. INSERT ... ON CONFLICT DO
-- UPDATE ... RETURNING tient en une seule instruction, PostgreSQL
-- serialise les acces concurrents sur la ligne.
CREATE OR REPLACE FUNCTION public.next_receipt_number(org UUID, yr INTEGER)
RETURNS INTEGER AS $$
DECLARE
    numero INTEGER;
BEGIN
    INSERT INTO public.receipt_counters (organization_id, year, last_number)
    VALUES (org, yr, 1)
    ON CONFLICT (organization_id, year)
    DO UPDATE SET last_number = public.receipt_counters.last_number + 1
    RETURNING last_number INTO numero;

    RETURN numero;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------
-- 4. Client de la vente
-- ------------------------------------------------------------
-- Toutes facultatives : une vente au comptoir n'a pas toujours de
-- client nomme.
ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS client_name  TEXT,
    ADD COLUMN IF NOT EXISTS client_phone TEXT,
    ADD COLUMN IF NOT EXISTS client_email TEXT;


-- ------------------------------------------------------------
-- 5. Rafraichir le cache de schema de PostgREST
-- ------------------------------------------------------------
-- L'erreur PGRST204 vient de ce cache, pas de la base. Supabase le
-- recharge seul, mais avec un delai : ce signal evite d'attendre.
NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- VERIFICATION
-- ------------------------------------------------------------
-- Doit retourner 11 lignes (8 pour sales, 3 pour expenses).
--
-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND (
--     (table_name = 'sales' AND column_name IN (
--       'created_by','receipt_url','receipt_storage_path','receipt_number',
--       'receipt_doc_path','client_name','client_phone','client_email'))
--     OR
--     (table_name = 'expenses' AND column_name IN (
--       'created_by','receipt_url','receipt_storage_path'))
--   )
-- ORDER BY table_name, column_name;
