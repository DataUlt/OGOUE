-- Migration: Add file storage columns to sales and expenses tables
-- This allows storing Supabase Storage URLs and paths for uploaded justificatifs

-- Add columns to expenses table
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_url TEXT NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_storage_path TEXT NULL;

-- Add columns to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS receipt_url TEXT NULL;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS receipt_storage_path TEXT NULL;

-- Create index on storage path for faster lookups
CREATE INDEX IF NOT EXISTS idx_expenses_storage_path ON expenses(receipt_storage_path);
CREATE INDEX IF NOT EXISTS idx_sales_storage_path ON sales(receipt_storage_path);
