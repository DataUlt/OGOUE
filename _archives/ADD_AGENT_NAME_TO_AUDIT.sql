-- ============================================================
-- Ajouter colonne pour stocker le prénom de l'agent
-- ============================================================
ALTER TABLE public.deletion_audit 
ADD COLUMN deleted_user_first_name VARCHAR(100);

-- Index optionnel
CREATE INDEX idx_deletion_audit_deleted_user_name ON public.deletion_audit(deleted_user_first_name);
