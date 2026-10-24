-- Gestion de stock par article / service.
-- A EXECUTER UNE FOIS dans Supabase > SQL Editor, sur le projet PRINCIPAL (PFE - OGOUE).
--
-- stock NULL  = l'article n'est pas suivi en stock (cas des services, ou d'un commerçant
--               qui ne tient pas de stock). C'est le défaut : rien ne change pour l'existant.
-- stock >= 0  = quantité disponible, décrémentée à chaque vente liée à l'article.
--
-- article_id relie une vente à l'article du catalogue. Il est nul pour les ventes
-- antérieures et pour les ventes « Autres (hors catalogue) ».

ALTER TABLE public.articles
    ADD COLUMN IF NOT EXISTS stock NUMERIC(12, 2) NULL
        CHECK (stock IS NULL OR stock >= 0);

ALTER TABLE public.sales
    ADD COLUMN IF NOT EXISTS article_id UUID NULL
        REFERENCES public.articles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_article
    ON public.sales (article_id)
    WHERE article_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';

-- VERIFICATION
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name IN ('articles', 'sales') AND column_name IN ('stock', 'article_id');
