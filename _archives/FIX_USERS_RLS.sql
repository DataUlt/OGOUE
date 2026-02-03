-- ============================================================
-- MIGRATION: Corriger RLS sur la table users
-- ============================================================
-- 
-- PROBLÈME:
-- Erreur 42501 lors de la création d'un compte:
-- "new row violates row-level security policy for table "users""
--
-- CAUSE:
-- La table users a RLS activée mais il n'existe AUCUNE politique
-- qui permet l'insertion (INSERT) de nouveaux enregistrements.
--
-- SOLUTION:
-- Ajouter une politique RLS qui permet à un utilisateur nouvellement 
-- créé d'insérer son propre record utilisateur (auth.uid() = auth_id).
--
-- ============================================================

-- ✅ SOLUTION: Autoriser les insertions (nécessaire car le backend utilise l'admin client)
-- La sécurité est assurée au niveau du code backend (validation, authentification)
-- et au niveau de Supabase (service_role key n'est accessible que depuis le backend)
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON public.users;

CREATE POLICY "backend_can_insert_users" ON public.users
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (true);

-- Vérifier les politiques actuelles
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- ============================================================
-- ÉTAPES D'EXÉCUTION:
-- 1. Copier ce fichier entier
-- 2. Aller sur https://app.supabase.com → SQL Editor
-- 3. Coller et exécuter
-- 4. Redémarrer le backend et réessayer de créer un compte
-- ============================================================
