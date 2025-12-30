-- ============================================================
-- Enable INSERT for agents on deletion_audit table
-- Permet aux agents de créer des enregistrements d'audit
-- ============================================================

-- Supprimer l'ancienne politique SELECT
DROP POLICY IF EXISTS "managers_can_view_deletion_audit" ON public.deletion_audit;

-- Nouvelle politique: Managers peuvent voir et manager
CREATE POLICY "managers_can_manage_deletion_audit" ON public.deletion_audit
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND role = 'manager'
    )
  );

-- Nouvelle politique: Managers peuvent supprimer
CREATE POLICY "managers_can_delete_deletion_audit" ON public.deletion_audit
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND role = 'manager'
    )
  );

-- Politique: Tous les utilisateurs authentifiés peuvent insérer
-- (agents et managers) dans leur propre organisation
CREATE POLICY "all_users_can_insert_deletion_audit" ON public.deletion_audit
  FOR INSERT WITH CHECK (
    -- Vérifier que l'organization_id correspond à celle de l'utilisateur/agent
    (
      -- Cas 1: Manager insérant (utilisateur dans la table users)
      organization_id IN (
        SELECT organization_id FROM public.users 
        WHERE auth_id = auth.uid()
      )
    )
    OR
    (
      -- Cas 2: Agent insérant (utilisateur dans la table agents)
      organization_id IN (
        SELECT a.organization_id FROM public.agents a
        JOIN public.users u ON a.user_id = u.id
        WHERE u.auth_id = auth.uid()
      )
    )
  );
