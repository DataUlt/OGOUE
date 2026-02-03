-- ============================================================
-- Table d'Audit des Suppressions
-- Enregistre toutes les suppressions avec justification
-- ============================================================

CREATE TABLE IF NOT EXISTS public.deletion_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Informations sur le record supprimé
  deleted_record_type VARCHAR(50) NOT NULL, -- 'expense', 'sale', etc.
  deleted_record_id UUID NOT NULL,
  deleted_record_data JSONB NOT NULL, -- Sauvegarde complète du record supprimé
  
  -- Informations sur la suppression
  deleted_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  deletion_reason TEXT NOT NULL, -- Justification obligatoire
  deleted_at TIMESTAMP DEFAULT now(),
  
  -- Métadonnées
  created_at TIMESTAMP DEFAULT now()
);

-- Index pour performance
CREATE INDEX idx_deletion_audit_organization ON public.deletion_audit(organization_id);
CREATE INDEX idx_deletion_audit_deleted_by ON public.deletion_audit(deleted_by_user_id);
CREATE INDEX idx_deletion_audit_type ON public.deletion_audit(deleted_record_type);
CREATE INDEX idx_deletion_audit_date ON public.deletion_audit(deleted_at);

-- Row Level Security
ALTER TABLE public.deletion_audit ENABLE ROW LEVEL SECURITY;

-- Politique : seuls les gérants de l'organisation peuvent voir l'historique
CREATE POLICY "managers_can_view_deletion_audit" ON public.deletion_audit
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND role = 'manager'
    )
  );

-- ============================================================
-- Fonction trigger pour archiver avant suppression (optionnel)
-- ============================================================
-- Cette fonction pourrait archiver automatiquement les enregistrements
-- avant qu'ils ne soient supprimés directement via Supabase
