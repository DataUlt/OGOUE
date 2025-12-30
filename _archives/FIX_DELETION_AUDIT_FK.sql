-- ============================================================
-- FIX: Enlever la contrainte FK trop stricte
-- ============================================================
-- La contrainte FK vers users.id causait une erreur car on passait
-- l'ID Supabase Auth au lieu de l'ID de la table users
-- Solution: Stocker simplement le user_id sans contrainte FK

ALTER TABLE public.deletion_audit 
DROP CONSTRAINT IF EXISTS deletion_audit_deleted_by_user_id_fkey;

-- Exécutez ce script directement dans Supabase SQL Editor:
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql
