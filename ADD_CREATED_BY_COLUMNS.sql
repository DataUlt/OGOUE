-- Ajouter la colonne created_by à la table sales
ALTER TABLE public.sales
ADD COLUMN IF NOT EXISTS created_by UUID;

-- Ajouter la colonne created_by à la table expenses
ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS created_by UUID;

-- Indexer la colonne created_by pour les performances
CREATE INDEX IF NOT EXISTS idx_sales_created_by ON public.sales(created_by);
CREATE INDEX IF NOT EXISTS idx_expenses_created_by ON public.expenses(created_by);

-- Mettre à jour les enregistrements existants avec le created_by de l'organization
-- Pour les ventes: utiliser l'id de l'organization (manager par défaut)
UPDATE public.sales SET created_by = organization_id WHERE created_by IS NULL;

-- Pour les dépenses: utiliser l'id de l'organization (manager par défaut)
UPDATE public.expenses SET created_by = organization_id WHERE created_by IS NULL;

-- Ajouter les foreign keys (optionnel mais recommandé)
ALTER TABLE public.sales
ADD CONSTRAINT fk_sales_created_by 
FOREIGN KEY (created_by) 
REFERENCES public.users(id) 
ON DELETE SET NULL;

ALTER TABLE public.expenses
ADD CONSTRAINT fk_expenses_created_by 
FOREIGN KEY (created_by) 
REFERENCES public.users(id) 
ON DELETE SET NULL;
