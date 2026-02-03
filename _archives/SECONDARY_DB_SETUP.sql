-- PFE-OGOUE-FINANCEMENT Database Schema
-- This script sets up the users and pmes tables in the secondary Supabase instance

-- ============================================
-- 1. CREATE USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'pme', -- 'pme', 'admin', etc.
  full_name VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

-- ============================================
-- 2. CREATE PMES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.pmes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  rccm_number VARCHAR(100),
  nif_number VARCHAR(100),
  sector VARCHAR(255),
  activity_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT fk_pmes_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- ============================================
-- 3. CREATE INDEXES
-- ============================================
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_is_active ON public.users(is_active);
CREATE INDEX idx_pmes_user_id ON public.pmes(user_id);
CREATE INDEX idx_pmes_company_name ON public.pmes(company_name);

-- ============================================
-- 4. CREATE UPDATED_AT TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION update_users_updated_at();

CREATE OR REPLACE FUNCTION update_pmes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_pmes_updated_at
BEFORE UPDATE ON public.pmes
FOR EACH ROW
EXECUTE FUNCTION update_pmes_updated_at();

-- ============================================
-- 5. ENABLE ROW LEVEL SECURITY (Optional but recommended)
-- ============================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pmes ENABLE ROW LEVEL SECURITY;

-- Allow service role to bypass RLS
-- Note: Service Role Key has full access by default, so RLS policies are mainly for public/authenticated users

-- ============================================
-- 6. VERIFY TABLES
-- ============================================
-- Run these queries to verify:
-- SELECT COUNT(*) as user_count FROM public.users;
-- SELECT COUNT(*) as pmes_count FROM public.pmes;
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
