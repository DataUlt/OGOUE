-- Remplir les created_by existants avec l'organization_id (le manager)
-- Pour les ventes
UPDATE public.sales 
SET created_by = organization_id 
WHERE created_by IS NULL;

-- Pour les dépenses
UPDATE public.expenses 
SET created_by = organization_id 
WHERE created_by IS NULL;
