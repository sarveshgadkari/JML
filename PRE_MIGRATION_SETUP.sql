-- =====================================================
-- PRE-MIGRATION SETUP
-- =====================================================
-- Run this FIRST before running DATABASE_MIGRATION_MULTI_LAWYER.sql
-- This adds any missing columns that the ranking functions expect

-- =====================================================
-- STEP 1: Add missing columns to lawyers table
-- =====================================================

ALTER TABLE lawyers 
ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0;

COMMENT ON COLUMN lawyers.total_cases IS 'Cached count of total cases (updated by ranking function)';

-- =====================================================
-- STEP 2: Add missing columns to judges table (if needed)
-- =====================================================

ALTER TABLE judges 
ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0;

COMMENT ON COLUMN judges.total_cases IS 'Cached count of total cases (updated by ranking function)';

-- =====================================================
-- STEP 3: Add missing columns to courts table (if needed)
-- =====================================================

ALTER TABLE courts 
ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0;

COMMENT ON COLUMN courts.total_cases IS 'Cached count of total cases (updated by ranking function)';

-- =====================================================
-- VERIFICATION
-- =====================================================

-- Check that columns were added
SELECT 
  'lawyers' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'lawyers'
AND column_name = 'total_cases'

UNION ALL

SELECT 
  'judges' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'judges'
AND column_name = 'total_cases'

UNION ALL

SELECT 
  'courts' as table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'courts'
AND column_name = 'total_cases';

-- If you see 3 rows (one for each table), you're ready to proceed!
RAISE NOTICE '✅ Pre-migration setup complete! You can now run DATABASE_MIGRATION_MULTI_LAWYER.sql';
