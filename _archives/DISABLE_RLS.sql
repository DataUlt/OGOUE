-- ============================================================
-- DÉSACTIVER LES RLS POLICIES (temporaire pour tester)
-- Exécutez ce script dans l'SQL Editor de Supabase
-- ============================================================

-- Désactiver les RLS pour chaque table
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;

-- Ou supprimer les policies
DROP POLICY IF EXISTS "users_can_view_own_organization" ON organizations;
DROP POLICY IF EXISTS "users_can_view_own_sales" ON sales;
DROP POLICY IF EXISTS "users_can_create_own_sales" ON sales;
DROP POLICY IF EXISTS "users_can_view_own_expenses" ON expenses;
DROP POLICY IF EXISTS "users_can_create_own_expenses" ON expenses;

-- Vérifier que les RLS sont désactivées
SELECT schemaname, tablename, rowsecurity FROM pg_tables WHERE tablename IN ('organizations', 'users', 'sales', 'expenses');
