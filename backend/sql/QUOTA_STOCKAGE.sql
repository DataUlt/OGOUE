-- ============================================================
-- Quota de stockage des justificatifs
-- ------------------------------------------------------------
-- La page tarifs annonce 2 Go pour Boutique et 10 Go pour Entreprise.
-- Rien ne mesurait la consommation : les justificatifs etaient ouverts
-- ou fermes, sans plafond intermediaire.
--
-- La taille de chaque fichier est desormais enregistree au moment du
-- depot, et la somme par organisation sert de compteur.
--
-- Les lignes anterieures a cette migration comptent pour zero : leur
-- taille n'est pas recuperable depuis la base. Le compteur demarre donc
-- sous-evalue, ce qui joue en faveur du client et non contre lui.
--
-- A executer dans Supabase : Dashboard > SQL Editor > New query
-- ============================================================

ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS receipt_size_bytes BIGINT;
ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS receipt_size_bytes BIGINT;

COMMENT ON COLUMN public.sales.receipt_size_bytes IS
    'Taille du justificatif televerse, en octets. NULL pour les lignes anterieures au comptage.';
COMMENT ON COLUMN public.expenses.receipt_size_bytes IS
    'Taille du justificatif televerse, en octets. NULL pour les lignes anterieures au comptage.';


-- ------------------------------------------------------------
-- Compteur par organisation
-- ------------------------------------------------------------
-- PostgREST n'expose pas les agregats simplement, et ramener toutes les
-- tailles pour les additionner cote Node ferait grossir la reponse a
-- chaque televersement. La somme est donc calculee en base, en une
-- instruction, et appelee par RPC.
CREATE OR REPLACE FUNCTION public.stockage_utilise(org UUID)
RETURNS BIGINT AS $$
    SELECT COALESCE(
        (SELECT SUM(receipt_size_bytes) FROM public.sales    WHERE organization_id = org), 0
    ) + COALESCE(
        (SELECT SUM(receipt_size_bytes) FROM public.expenses WHERE organization_id = org), 0
    );
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION public.stockage_utilise(UUID) IS
    'Octets occupes par les justificatifs d''une organisation, ventes et depenses confondues.';

-- La somme filtre sur organization_id et lit receipt_size_bytes : sans
-- index, chaque televersement declencherait deux parcours complets.
CREATE INDEX IF NOT EXISTS idx_sales_org_taille
    ON public.sales (organization_id) INCLUDE (receipt_size_bytes)
    WHERE receipt_size_bytes IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_org_taille
    ON public.expenses (organization_id) INCLUDE (receipt_size_bytes)
    WHERE receipt_size_bytes IS NOT NULL;

NOTIFY pgrst, 'reload schema';


-- ------------------------------------------------------------
-- VERIFICATION
-- ------------------------------------------------------------
-- SELECT o.name,
--        public.stockage_utilise(o.id) AS octets,
--        ROUND(public.stockage_utilise(o.id) / 1048576.0, 1) AS mo
-- FROM public.organizations o
-- ORDER BY octets DESC;
