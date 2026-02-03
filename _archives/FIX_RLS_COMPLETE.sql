-- ============================================================
-- MIGRATION COMPLÈTE: Corriger RLS sur deletion_audit
-- ============================================================
-- 
-- ÉTAPES:
-- 1. Copier ce fichier entier
-- 2. Aller sur https://app.supabase.com → SQL Editor
-- 3. Coller et exécuter
-- 4. Redémarrer le backend
--
-- ============================================================

-- ✅ ÉTAPE 1: Désactiver RLS (la sécurité est gérée au niveau du code)
ALTER TABLE public.deletion_audit DISABLE ROW LEVEL SECURITY;

-- ✅ ÉTAPE 2: Supprimer toutes les anciennes politiques
DROP POLICY IF EXISTS "managers_can_view_deletion_audit" ON public.deletion_audit;

-- ============================================================
-- EXPLANATION:
-- ============================================================
-- Avant: RLS bloquait les agents d'insérer des enregistrements
-- Après: Les contrôleurs du backend vérifient les rôles
--        - logDeletion() → agents peuvent appeler
--        - getDeletionHistoryList() → seuls managers peuvent lire
--        - deleteDeletionRecord() → seuls managers peuvent supprimer
-- ============================================================
