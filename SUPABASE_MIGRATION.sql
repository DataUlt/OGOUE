-- ============================================================
-- OGOUE Supabase Migration
-- Exécutez ce script dans l'SQL Editor de votre dashboard Supabase
-- ============================================================

-- 1. Créer le schéma app (optionnel, public suffit sinon)
CREATE SCHEMA IF NOT EXISTS app;

-- 2. Créer la table organizations
CREATE TABLE IF NOT EXISTS app.organizations (
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
CREATE TABLE IF NOT EXISTS app.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(20) DEFAULT 'manager',
  organization_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- 4. Créer la table sales
CREATE TABLE IF NOT EXISTS app.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS app.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES app.organizations(id) ON DELETE CASCADE,
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
CREATE INDEX idx_users_email ON app.users(email);
CREATE INDEX idx_users_organization ON app.users(organization_id);
CREATE INDEX idx_sales_organization ON app.sales(organization_id);
CREATE INDEX idx_sales_date ON app.sales(sale_date);
CREATE INDEX idx_expenses_organization ON app.expenses(organization_id);
CREATE INDEX idx_expenses_date ON app.expenses(expense_date);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY (optionnel mais recommandé)
-- ============================================================
ALTER TABLE app.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.expenses ENABLE ROW LEVEL SECURITY;

-- Politique : les utilisateurs ne voient que leur organisation
CREATE POLICY "users_can_view_own_organization" ON app.organizations
  FOR SELECT USING (id IN (SELECT organization_id FROM app.users WHERE auth_id = auth.uid()));

CREATE POLICY "users_can_view_own_sales" ON app.sales
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM app.users WHERE auth_id = auth.uid()));

CREATE POLICY "users_can_create_own_sales" ON app.sales
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM app.users WHERE auth_id = auth.uid()));

CREATE POLICY "users_can_view_own_expenses" ON app.expenses
  FOR SELECT USING (organization_id IN (SELECT organization_id FROM app.users WHERE auth_id = auth.uid()));

CREATE POLICY "users_can_create_own_expenses" ON app.expenses
  FOR INSERT WITH CHECK (organization_id IN (SELECT organization_id FROM app.users WHERE auth_id = auth.uid()));

-- ============================================================
-- FIN DU SCRIPT
-- ============================================================
