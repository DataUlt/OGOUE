-- ============================================================
-- FIX: Ajouter les RLS policies manquantes pour deletion_audit
-- Erreur: "new row violates row-level security policy for table deletion_audit"
-- ============================================================

-- Supprimer les policies existantes pour recréer correctement
DROP POLICY IF EXISTS "managers_can_view_deletion_audit" ON public.deletion_audit;
DROP POLICY IF EXISTS "users_can_insert_deletion_audit" ON public.deletion_audit;
DROP POLICY IF EXISTS "managers_can_delete_deletion_audit" ON public.deletion_audit;

-- ============================================================
-- 1. POLICY INSERT : Tous les utilisateurs authentifiés peuvent insérer
--    (l'audit enregistre une suppression faite par quelqu'un)
-- ============================================================
CREATE POLICY "users_can_insert_deletion_audit" ON public.deletion_audit
  FOR INSERT
  WITH CHECK (
    -- L'utilisateur qui insère doit être authentifié et faire partie de cette org
    deleted_by_user_id IN (
      SELECT id FROM public.users 
      WHERE auth_id = auth.uid()
    )
    AND
    -- L'organisation doit être celle de l'utilisateur
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
  );

-- ============================================================
-- 2. POLICY SELECT : Seuls les managers peuvent lire l'historique
-- ============================================================
CREATE POLICY "managers_can_view_deletion_audit" ON public.deletion_audit
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND role = 'manager'
    )
  );

-- ============================================================
-- 3. POLICY DELETE : Seuls les managers peuvent supprimer des enregistrements d'audit
-- ============================================================
CREATE POLICY "managers_can_delete_deletion_audit" ON public.deletion_audit
  FOR DELETE USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND role = 'manager'
    )
  );

-- ============================================================
-- Vérification : Confirmer que les policies sont créées
-- ============================================================
-- SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
-- FROM pg_policies 
-- WHERE tablename = 'deletion_audit';
