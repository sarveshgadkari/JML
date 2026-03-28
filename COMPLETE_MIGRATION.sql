-- =====================================================
-- JUDGE MY LAWYER - COMPLETE MIGRATION
-- =====================================================
-- Just copy this entire file and run it in Supabase SQL Editor
-- =====================================================

DO $$
BEGIN
  -- =====================================================
  -- PART 1: Add Missing Columns
  -- =====================================================
  
  ALTER TABLE lawyers ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0;
  ALTER TABLE judges ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0;
  ALTER TABLE courts ADD COLUMN IF NOT EXISTS total_cases INTEGER DEFAULT 0;
  
  RAISE NOTICE '✅ Step 1/5: Missing columns added';
  
  -- =====================================================
  -- PART 2: Create Multi-Lawyer Support
  -- =====================================================
  
  -- Create case_lawyers junction table
  CREATE TABLE IF NOT EXISTS case_lawyers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    lawyer_id UUID NOT NULL REFERENCES lawyers(id) ON DELETE CASCADE,
    lawyer_name TEXT NOT NULL,
    representation_side TEXT NOT NULL CHECK (representation_side IN ('Petitioner', 'Respondent', 'Plaintiff', 'Defendant', 'Complainant', 'Accused')),
    lawyer_role TEXT DEFAULT 'Counsel' CHECK (lawyer_role IN ('Lead Counsel', 'Senior Advocate', 'Counsel', 'Junior Counsel', 'Assistant')),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(case_id, lawyer_id)
  );
  
  -- Create indexes
  CREATE INDEX IF NOT EXISTS idx_case_lawyers_case_id ON case_lawyers(case_id);
  CREATE INDEX IF NOT EXISTS idx_case_lawyers_lawyer_id ON case_lawyers(lawyer_id);
  CREATE INDEX IF NOT EXISTS idx_case_lawyers_side ON case_lawyers(representation_side);
  
  -- Enable RLS
  ALTER TABLE case_lawyers ENABLE ROW LEVEL SECURITY;
  
  RAISE NOTICE '✅ Step 2/5: case_lawyers table created';
  
  -- =====================================================
  -- PART 3: Update Outcome Values
  -- =====================================================
  
  -- Drop existing constraint FIRST
  ALTER TABLE cases DROP CONSTRAINT IF EXISTS cases_outcome_check;
  
  -- Migrate existing outcome data BEFORE adding new constraint
  UPDATE cases
  SET outcome = CASE 
    WHEN outcome = 'Won' THEN 'In favor of Complainant'
    WHEN outcome = 'Lost' THEN 'In favor of Respondent'
    WHEN outcome = 'Settled' THEN 'Settled'
    WHEN outcome = 'Dismissed' THEN 'Dismissed'
    WHEN outcome IS NULL THEN NULL
    ELSE outcome
  END;
  
  -- Now add new constraint with legal outcome values
  ALTER TABLE cases 
  ADD CONSTRAINT cases_outcome_check 
  CHECK (outcome IN (
    'In favor of Complainant',
    'In favor of Respondent',
    'Settled',
    'Dismissed',
    'Partially Granted',
    'Withdrawn'
  ) OR outcome IS NULL);
  
  RAISE NOTICE '✅ Step 3/5: Outcome values updated to legal standards';
  
  -- =====================================================
  -- PART 4: Migrate Existing Case Data
  -- =====================================================
  
  -- Migrate existing cases to case_lawyers table
  INSERT INTO case_lawyers (case_id, lawyer_id, lawyer_name, representation_side, lawyer_role)
  SELECT 
    id as case_id,
    lawyer_id,
    lawyer_name,
    CASE 
      WHEN lawyer_side IN ('Petitioner', 'Plaintiff', 'Complainant') THEN lawyer_side
      WHEN lawyer_side IN ('Respondent', 'Defendant', 'Accused') THEN lawyer_side
      ELSE 'Petitioner'
    END as representation_side,
    'Lead Counsel' as lawyer_role
  FROM cases
  WHERE lawyer_id IS NOT NULL
  ON CONFLICT (case_id, lawyer_id) DO NOTHING;
  
  RAISE NOTICE '✅ Step 4/5: Existing data migrated to case_lawyers';
  
  RAISE NOTICE '✅ Step 5/5: Analytics functions will be created next';
  
END $$;

-- =====================================================
-- RLS Policies (must be outside DO block)
-- =====================================================

DROP POLICY IF EXISTS "Allow public read access to case_lawyers" ON case_lawyers;
CREATE POLICY "Allow public read access to case_lawyers"
  ON case_lawyers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Only admins can modify case_lawyers" ON case_lawyers;
CREATE POLICY "Only admins can modify case_lawyers"
  ON case_lawyers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM lawyers
      WHERE lawyers.id = auth.uid()
      AND lawyers.is_admin = true
    )
  );

-- =====================================================
-- PART 5: Update Analytics Functions
-- =====================================================

-- Drop old functions
DROP FUNCTION IF EXISTS calculate_lawyer_ranks();
DROP FUNCTION IF EXISTS calculate_judge_ranks();
DROP FUNCTION IF EXISTS calculate_court_ranks();

-- Create updated lawyer ranking function
CREATE OR REPLACE FUNCTION calculate_lawyer_ranks()
RETURNS void AS $$
BEGIN
  WITH lawyer_stats AS (
    SELECT 
      l.id,
      COUNT(DISTINCT cl.case_id) as total_cases,
      COUNT(DISTINCT CASE 
        WHEN (
          cl.representation_side IN ('Petitioner', 'Plaintiff', 'Complainant') 
          AND c.outcome = 'In favor of Complainant'
        ) OR (
          cl.representation_side IN ('Respondent', 'Defendant', 'Accused') 
          AND (c.outcome = 'In favor of Respondent' OR c.outcome = 'Dismissed' OR c.outcome = 'Withdrawn')
        ) THEN cl.case_id 
      END) as won_cases,
      COALESCE(AVG(c.duration_days), 0) as avg_duration,
      COALESCE(AVG(c.total_hearings), 0) as avg_hearings
    FROM lawyers l
    LEFT JOIN case_lawyers cl ON l.id = cl.lawyer_id
    LEFT JOIN cases c ON cl.case_id = c.id
    WHERE l.is_verified = true
    GROUP BY l.id
  ),
  ranked AS (
    SELECT 
      id,
      total_cases,
      won_cases,
      avg_duration,
      avg_hearings,
      (
        (won_cases * 10) +
        (total_cases * 5) +
        (CASE WHEN avg_duration > 0 THEN (1000 / avg_duration) ELSE 0 END * 2) +
        (CASE WHEN avg_hearings > 0 THEN (50 / avg_hearings) ELSE 0 END * 2)
      ) as score
    FROM lawyer_stats
  )
  UPDATE lawyers l
  SET 
    rank = r.rank_position,
    total_cases = rs.total_cases,
    updated_at = now()
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY score DESC, total_cases DESC) as rank_position
    FROM ranked
    WHERE total_cases > 0
  ) r
  INNER JOIN ranked rs ON r.id = rs.id
  WHERE l.id = r.id;
  
  RAISE NOTICE 'Lawyer ranks calculated successfully';
END;
$$ LANGUAGE plpgsql;

-- Create updated judge ranking function
CREATE OR REPLACE FUNCTION calculate_judge_ranks()
RETURNS void AS $$
BEGIN
  WITH judge_stats AS (
    SELECT 
      j.id,
      COUNT(c.id) as total_cases,
      COUNT(CASE WHEN c.status = 'disposed' THEN 1 END) as disposed_cases,
      COALESCE(AVG(CASE WHEN c.status = 'disposed' THEN c.duration_days END), 0) as avg_duration
    FROM judges j
    LEFT JOIN cases c ON j.id = c.judge_id
    GROUP BY j.id
  ),
  ranked AS (
    SELECT 
      id,
      total_cases,
      disposed_cases,
      avg_duration,
      (
        (disposed_cases * 10) +
        (total_cases * 5) +
        (CASE WHEN avg_duration > 0 THEN (500 / avg_duration) ELSE 0 END * 3)
      ) as score
    FROM judge_stats
  )
  UPDATE judges j
  SET 
    rank = r.rank_position,
    total_cases = rs.total_cases,
    updated_at = now()
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY score DESC, total_cases DESC) as rank_position
    FROM ranked
    WHERE total_cases > 0
  ) r
  INNER JOIN ranked rs ON r.id = rs.id
  WHERE j.id = r.id;
  
  RAISE NOTICE 'Judge ranks calculated successfully';
END;
$$ LANGUAGE plpgsql;

-- Create updated court ranking function
CREATE OR REPLACE FUNCTION calculate_court_ranks()
RETURNS void AS $$
BEGIN
  WITH court_stats AS (
    SELECT 
      c.id,
      COUNT(cs.id) as total_cases,
      COUNT(CASE WHEN cs.status = 'disposed' THEN 1 END) as disposed_cases,
      COALESCE(AVG(CASE WHEN cs.status = 'disposed' THEN cs.duration_days END), 0) as avg_duration
    FROM courts c
    LEFT JOIN cases cs ON c.id = cs.court_id
    GROUP BY c.id
  ),
  ranked AS (
    SELECT 
      id,
      total_cases,
      disposed_cases,
      avg_duration,
      (
        (disposed_cases * 10) +
        (total_cases * 5) +
        (CASE WHEN avg_duration > 0 THEN (500 / avg_duration) ELSE 0 END * 3)
      ) as score
    FROM court_stats
  )
  UPDATE courts ct
  SET 
    rank = r.rank_position,
    total_cases = rs.total_cases,
    updated_at = now()
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY score DESC, total_cases DESC) as rank_position
    FROM ranked
    WHERE total_cases > 0
  ) r
  INNER JOIN ranked rs ON r.id = rs.id
  WHERE ct.id = r.id;
  
  RAISE NOTICE 'Court ranks calculated successfully';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PART 6: Recalculate All Rankings
-- =====================================================

SELECT calculate_lawyer_ranks();
SELECT calculate_judge_ranks();
SELECT calculate_court_ranks();

-- =====================================================
-- VERIFICATION
-- =====================================================

SELECT 
  'Total case-lawyer relationships' as metric,
  COUNT(*)::TEXT as value
FROM case_lawyers

UNION ALL

SELECT 
  'Cases migrated',
  COUNT(DISTINCT case_id)::TEXT
FROM case_lawyers

UNION ALL

SELECT 
  'Petitioner representations',
  COUNT(*)::TEXT
FROM case_lawyers
WHERE representation_side IN ('Petitioner', 'Plaintiff', 'Complainant')

UNION ALL

SELECT 
  'Respondent representations',
  COUNT(*)::TEXT
FROM case_lawyers
WHERE representation_side IN ('Respondent', 'Defendant', 'Accused')

UNION ALL

SELECT 
  'Ranked lawyers',
  COUNT(*)::TEXT
FROM lawyers
WHERE rank IS NOT NULL

UNION ALL

SELECT 
  'Ranked judges',
  COUNT(*)::TEXT
FROM judges
WHERE rank IS NOT NULL

UNION ALL

SELECT 
  'Ranked courts',
  COUNT(*)::TEXT
FROM courts
WHERE rank IS NOT NULL;

-- Done!
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION COMPLETE!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Multi-lawyer support: ENABLED';
  RAISE NOTICE 'Legal outcome values: UPDATED';
  RAISE NOTICE 'Analytics functions: UPDATED';
  RAISE NOTICE 'Rankings: RECALCULATED';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next step: Redeploy your Edge Function';
  RAISE NOTICE '========================================';
END $$;