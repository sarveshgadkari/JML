-- =====================================================
-- FIX: Add missing total_cases column to lawyers table
-- =====================================================
-- Run this BEFORE running the main migration

-- Add total_cases column to lawyers table
ALTER TABLE lawyers 
ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0;

-- Add comment
COMMENT ON COLUMN lawyers.total_cases IS 'Cached count of total cases (updated by ranking function)';

-- Now you can proceed with the main migration!
RAISE NOTICE '✅ Fixed: total_cases column added to lawyers table';
