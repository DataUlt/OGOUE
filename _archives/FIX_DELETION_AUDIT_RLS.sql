-- ============================================================
-- Fix RLS Policies for deletion_audit Table
-- Permet aux agents et managers d'insérer des enregistrements
-- ============================================================

-- Policy 1: Agents peuvent insérer leur propre audit
CREATE POLICY "agents_can_insert_deletion_audit" ON public.deletion_audit
  FOR INSERT WITH CHECK (
    -- Vérifier que l'organization_id correspond à celle de l'utilisateur
    organization_id IN (
      SELECT organization_id FROM public.agents 
      WHERE id = (
        SELECT id FROM public.agents 
        WHERE created_by = auth.uid() OR user_id = auth.uid()
        LIMIT 1
      )
    )
    OR
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

-- Policy 2: Managers peuvent insérer et voir l'historique
CREATE POLICY "managers_can_insert_and_view_deletion_audit" ON public.deletion_audit
  FOR ALL USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND role = 'manager'
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND role = 'manager'
    )
  );

-- Ajouter DELETE policy pour les managers
CREATE POLICY "managers_can_delete_deletion_audit" ON public.deletion_audit
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND role = 'manager'
    )
  );
