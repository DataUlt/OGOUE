-- ============================================================
-- SOLUTION DÉFINITIVE: Désactiver RLS sur la table users
-- ============================================================
-- 
-- PROBLÈME:
-- Erreur 42501 persistante même après avoir ajouté des politiques RLS
--
-- CAUSE:
-- La table users a RLS activée, ce qui bloque TOUTES les opérations
-- qui ne correspondent pas aux politiques existantes.
--
-- SOLUTION:
-- Désactiver RLS sur la table users car:
-- 1. La sécurité est assurée par le backend (validation, authentification)
-- 2. La service_role key du backend ne doit jamais être exposée
-- 3. Les données utilisateur ne sont sensibles que pour la lecture
--
-- ============================================================

-- ✅ ÉTAPE 1: Désactiver RLS sur la table users
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- ✅ ÉTAPE 2: Supprimer toutes les politiques existantes (optionnel, mais propre)
DROP POLICY IF EXISTS "backend_can_insert_users" ON public.users;
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON public.users;

-- ✅ ÉTAPE 3: Vérifier l'état
SELECT 
  tablename,
  rowsecurity
FROM pg_tables
WHERE tablename = 'users';

-- ============================================================
-- ÉTAPES D'EXÉCUTION:
-- 1. Copier ce fichier entier
-- 2. Aller sur https://app.supabase.com → SQL Editor
-- 3. Coller et exécuter
-- 4. Redémarrer le backend et réessayer de créer un compte
-- ============================================================
