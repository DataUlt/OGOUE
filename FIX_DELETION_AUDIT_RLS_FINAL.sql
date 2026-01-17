-- ============================================================
-- FIX: Corriger les RLS policies pour deletion_audit
-- Erreur: "new row violates row-level security policy for table deletion_audit"
-- 
-- PROBLÈME: Les politiques actuelles essaient de vérifier auth.uid()
-- mais le backend utilise un client Supabase avec service key
-- qui ne dispose pas d'auth.uid() en contexte RLS
-- 
-- SOLUTION: Utiliser une politique RLS permissive pour INSERT
-- (l'autorisation est gérée au niveau du code backend)
-- ============================================================

-- 1. Désactiver temporairement RLS pour identifier le problème
-- (Uncomment si besoin de debug)
-- ALTER TABLE public.deletion_audit DISABLE ROW LEVEL SECURITY;

-- 2. Supprimer les policies existantes
DROP POLICY IF EXISTS "managers_can_view_deletion_audit" ON public.deletion_audit;
DROP POLICY IF EXISTS "users_can_insert_deletion_audit" ON public.deletion_audit;
DROP POLICY IF EXISTS "managers_can_delete_deletion_audit" ON public.deletion_audit;

-- ============================================================
-- 3. POLICY INSERT: Permettre l'insertion (validation au backend)
-- ============================================================
CREATE POLICY "users_can_insert_deletion_audit" ON public.deletion_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- 4. POLICY SELECT: Seuls les managers peuvent lire l'historique
-- ============================================================
CREATE POLICY "managers_can_view_deletion_audit" ON public.deletion_audit
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND role = 'manager'
    )
  );

-- ============================================================
-- 5. POLICY DELETE: Seuls les managers peuvent supprimer des enregistrements d'audit
-- ============================================================
CREATE POLICY "managers_can_delete_deletion_audit" ON public.deletion_audit
  FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid() AND role = 'manager'
    )
  );

-- ============================================================
-- 6. S'assurer que RLS est bien activé
-- ============================================================
ALTER TABLE public.deletion_audit ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Vérification: Lister toutes les policies
-- ============================================================
-- SELECT schemaname, tablename, policyname, permissive, roles, qual, with_check
-- FROM pg_policies 
-- WHERE tablename = 'deletion_audit'
-- ORDER BY policyname;
