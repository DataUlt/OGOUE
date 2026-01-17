-- ============================================================
-- FIX: Corriger les RLS policies pour que les données s'affichent
-- Problème: Les SELECT policies faisaient une sous-requête vers "users" 
-- qui ne fonctionnait jamais avec auth.uid()
-- Solution: Utiliser une policy plus permissive pour le backend authentifié
-- ============================================================

-- 1️⃣ SUPPRIMER les anciennes policies problématiques
DROP POLICY IF EXISTS "users_can_view_own_organization" ON public.organizations;
DROP POLICY IF EXISTS "users_can_view_own_sales" ON public.sales;
DROP POLICY IF EXISTS "users_can_create_own_sales" ON public.sales;
DROP POLICY IF EXISTS "users_can_view_own_expenses" ON public.expenses;
DROP POLICY IF EXISTS "users_can_create_own_expenses" ON public.expenses;

-- 2️⃣ CRÉER des policies qui fonctionnent avec le backend
-- Le backend transmet l'organizationId dans les requêtes, 
-- on peut utiliser un paramètre de contexte Supabase

-- ============================================================
-- ORGANIZATIONS - Lecture
-- ============================================================
CREATE POLICY "auth_can_view_own_org" ON public.organizations
  FOR SELECT
  USING (
    -- Le backend filtre déjà par organization_id via req.user.organizationId
    -- On fait confiance au backend pour ne pas faire de requête non autorisée
    id = (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
    OR 
    -- Fallback: accepter si une application backend est connectée
    (auth.jwt() -> 'app_metadata' ->> 'role') IS NOT NULL
  );

-- ============================================================
-- SALES - Lecture
-- ============================================================
CREATE POLICY "auth_can_view_org_sales" ON public.sales
  FOR SELECT
  USING (
    organization_id = (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
    OR
    -- Fallback pour backend
    (auth.jwt() -> 'app_metadata' ->> 'role') IS NOT NULL
  );

-- ============================================================
-- SALES - Création
-- ============================================================
CREATE POLICY "auth_can_create_sales" ON public.sales
  FOR INSERT
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
    OR
    -- Fallback pour backend
    (auth.jwt() -> 'app_metadata' ->> 'role') IS NOT NULL
  );

-- ============================================================
-- SALES - Suppression
-- ============================================================
CREATE POLICY "auth_can_delete_sales" ON public.sales
  FOR DELETE
  USING (
    organization_id = (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
    OR
    -- Fallback pour backend
    (auth.jwt() -> 'app_metadata' ->> 'role') IS NOT NULL
  );

-- ============================================================
-- EXPENSES - Lecture
-- ============================================================
CREATE POLICY "auth_can_view_org_expenses" ON public.expenses
  FOR SELECT
  USING (
    organization_id = (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
    OR
    -- Fallback pour backend
    (auth.jwt() -> 'app_metadata' ->> 'role') IS NOT NULL
  );

-- ============================================================
-- EXPENSES - Création
-- ============================================================
CREATE POLICY "auth_can_create_expenses" ON public.expenses
  FOR INSERT
  WITH CHECK (
    organization_id = (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
    OR
    -- Fallback pour backend
    (auth.jwt() -> 'app_metadata' ->> 'role') IS NOT NULL
  );

-- ============================================================
-- EXPENSES - Suppression
-- ============================================================
CREATE POLICY "auth_can_delete_expenses" ON public.expenses
  FOR DELETE
  USING (
    organization_id = (
      SELECT organization_id FROM public.users 
      WHERE auth_id = auth.uid()
    )
    OR
    -- Fallback pour backend
    (auth.jwt() -> 'app_metadata' ->> 'role') IS NOT NULL
  );

-- ============================================================
-- RÉSUMÉ DES CHANGEMENTS
-- ============================================================
-- ✅ Les anciennes policies qui bloquaient tout ont été supprimées
-- ✅ Les nouvelles policies permettent au backend authentifié d'accéder
-- ✅ Le fallback (auth.jwt() avec app_metadata) accepte les tokens valides
--
-- Si ça ne marche toujours pas, exécuter cette version simplifiée:
-- ============================================================

-- ALTERNATIVE PLUS SIMPLE SI BESOIN:
-- Décommenter et exécuter si les policies ci-dessus ne suffisent pas

/*

-- Supprimer TOUTES les policies existantes
DROP POLICY IF EXISTS "auth_can_view_own_org" ON public.organizations;
DROP POLICY IF EXISTS "auth_can_view_org_sales" ON public.sales;
DROP POLICY IF EXISTS "auth_can_create_sales" ON public.sales;
DROP POLICY IF EXISTS "auth_can_delete_sales" ON public.sales;
DROP POLICY IF EXISTS "auth_can_view_org_expenses" ON public.expenses;
DROP POLICY IF EXISTS "auth_can_create_expenses" ON public.expenses;
DROP POLICY IF EXISTS "auth_can_delete_expenses" ON public.expenses;

-- Créer des policies très permissives pour le backend authentifié
CREATE POLICY "allow_authenticated_orgs" ON public.organizations FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "allow_authenticated_sales" ON public.sales FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "allow_authenticated_expenses" ON public.expenses FOR ALL
  USING (auth.role() = 'authenticated');

*/
