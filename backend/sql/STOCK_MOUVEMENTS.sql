-- Coût d'achat et historique des mouvements de stock.
-- A EXECUTER UNE FOIS dans Supabase > SQL Editor, sur le projet PRINCIPAL (PFE - OGOUE),
-- après STOCK_ARTICLES.sql.
--
-- cost_price : coût d'achat unitaire (distinct du prix de vente unit_price).
--              NULL = non renseigné ; la valeur du stock est alors estimée à 0.
-- stock_movements : chaque variation de stock est tracée. delta > 0 = entrée,
--              delta < 0 = sortie (vente) ou correction. Le stock de départ d'une
--              période se retrouve en partant du stock actuel et en retirant les
--              mouvements postérieurs à la période.

ALTER TABLE public.articles
    ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) NULL
        CHECK (cost_price IS NULL OR cost_price >= 0);

CREATE TABLE IF NOT EXISTS public.stock_movements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
    sale_id UUID NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    delta NUMERIC(12, 2) NOT NULL,
    motif VARCHAR(20) NOT NULL CHECK (motif IN ('initial', 'entree', 'vente', 'correction')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_article_date
    ON public.stock_movements (article_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_movements_sale
    ON public.stock_movements (sale_id) WHERE sale_id IS NOT NULL;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';
