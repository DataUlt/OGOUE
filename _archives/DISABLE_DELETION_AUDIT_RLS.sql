-- ============================================================
-- Désactiver RLS sur deletion_audit et gérer la sécurité au niveau du code
-- ============================================================

-- Désactiver RLS
ALTER TABLE public.deletion_audit DISABLE ROW LEVEL SECURITY;

-- Supprimer toutes les politiques existantes
DROP POLICY IF EXISTS "managers_can_view_deletion_audit" ON public.deletion_audit;
DROP POLICY IF EXISTS "all_users_can_insert_deletion_audit" ON public.deletion_audit;
DROP POLICY IF EXISTS "managers_can_delete_deletion_audit" ON public.deletion_audit;
DROP POLICY IF EXISTS "agents_can_insert_deletion_audit" ON public.deletion_audit;
DROP POLICY IF EXISTS "managers_can_insert_and_view_deletion_audit" ON public.deletion_audit;
DROP POLICY IF EXISTS "managers_can_manage_deletion_audit" ON public.deletion_audit;

-- La sécurité est gérée au niveau du contrôleur (audit.controller.js)
-- Chaque fonction vérifie que l'utilisateur a le rôle approprié
