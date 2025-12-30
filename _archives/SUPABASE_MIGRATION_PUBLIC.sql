-- ============================================================
-- OGOUE Supabase Migration - PUBLIC SCHEMA VERSION
-- Exécutez ce script dans l'SQL Editor de votre dashboard Supabase
-- ============================================================

-- 1. Créer les tables dans le schéma public

-- 2. Créer la table organizations
DROP TABLE IF EXISTS organizations CASCADE;
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  rccm_number VARCHAR(50),
  nif_number VARCHAR(50),
  activity VARCHAR(100),
  activity_description TEXT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 3. Créer la table users (lié à Supabase auth)
DROP TABLE IF EXISTS users CASCADE;
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(20) DEFAULT 'manager',
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 4. Créer la table sales
DROP TABLE IF EXISTS sales CASCADE;
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sale_date DATE NOT NULL,
  description VARCHAR(200) NOT NULL,
  sale_type VARCHAR(50),
  payment_method VARCHAR(50),
  quantity NUMERIC(10, 2) DEFAULT 1,
  amount NUMERIC(15, 2) NOT NULL,
  receipt_name VARCHAR(200),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 5. Créer la table expenses
DROP TABLE IF EXISTS expenses CASCADE;
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  expense_date DATE NOT NULL,
  category VARCHAR(100) NOT NULL,
  payment_method VARCHAR(50),
  amount NUMERIC(15, 2) NOT NULL,
  receipt_name VARCHAR(200),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- ============================================================
-- INDEXES (pour performance)
-- ============================================================
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization ON users(organization_id);
CREATE INDEX idx_sales_organization ON sales(organization_id);
CREATE INDEX idx_sales_date ON sales(sale_date);
CREATE INDEX idx_expenses_organization ON expenses(organization_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY (optionnel mais recommandé)
-- ============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Politique : les utilisateurs ne voient que leur organisation
CREATE POLICY "users_can_view_own_organization" ON organizations
  FOR SELECT USING (id IN (SELECT organization_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "users_can_view_own_sales" ON sales
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "users_can_create_own_sales" ON sales
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "users_can_view_own_expenses" ON expenses
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM users WHERE auth_id = auth.uid()));

CREATE POLICY "users_can_create_own_expenses" ON expenses
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM users WHERE auth_id = auth.uid()));

-- ============================================================
-- FIN DU SCRIPT
-- ============================================================
