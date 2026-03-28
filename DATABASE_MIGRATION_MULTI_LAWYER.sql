-- =====================================================
-- DATABASE MIGRATION: Multi-Lawyer Support
-- =====================================================
-- This migration adds support for multiple lawyers per case
-- Run this in your Supabase SQL Editor

-- =====================================================
-- STEP 1: CREATE CASE_LAWYERS JUNCTION TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS case_lawyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  lawyer_id UUID NOT NULL REFERENCES lawyers(id) ON DELETE CASCADE,
  lawyer_name TEXT NOT NULL,
  representation_side TEXT NOT NULL CHECK (representation_side IN ('Petitioner', 'Respondent', 'Plaintiff', 'Defendant', 'Complainant', 'Accused')),
  lawyer_role TEXT DEFAULT 'Counsel' CHECK (lawyer_role IN ('Lead Counsel', 'Senior Advocate', 'Counsel', 'Junior Counsel', 'Assistant')),
  created_at TIMESTAMPTZ DEFAULT now(),
  
  -- Prevent duplicate lawyer assignments to same case
  UNIQUE(case_id, lawyer_id)
);

-- Create indexes for performance
CREATE INDEX idx_case_lawyers_case_id ON case_lawyers(case_id);
CREATE INDEX idx_case_lawyers_lawyer_id ON case_lawyers(lawyer_id);
CREATE INDEX idx_case_lawyers_side ON case_lawyers(representation_side);

-- Enable RLS
ALTER TABLE case_lawyers ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Public read access
CREATE POLICY "Allow public read access to case_lawyers"
  ON case_lawyers FOR SELECT
  USING (true);

-- RLS Policy: Only admins can insert/update
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
-- STEP 2: MIGRATE EXISTING DATA
-- =====================================================

-- Copy existing single lawyer data to junction table
INSERT INTO case_lawyers (case_id, lawyer_id, lawyer_name, representation_side, lawyer_role)
SELECT 
  id as case_id,
  lawyer_id,
  lawyer_name,
  CASE 
    WHEN lawyer_side IN ('Petitioner', 'Plaintiff', 'Complainant') THEN lawyer_side
    WHEN lawyer_side IN ('Respondent', 'Defendant', 'Accused') THEN lawyer_side
    ELSE 'Petitioner' -- Default fallback
  END as representation_side,
  'Lead Counsel' as lawyer_role
FROM cases
WHERE lawyer_id IS NOT NULL
ON CONFLICT (case_id, lawyer_id) DO NOTHING;

-- =====================================================
-- STEP 3: UPDATE CASES TABLE STRUCTURE
-- =====================================================

-- We'll keep lawyer_id and lawyer_name for backward compatibility
-- but they will now represent the "primary" lawyer
-- Add comment to clarify
COMMENT ON COLUMN cases.lawyer_id IS 'Primary lawyer (deprecated - use case_lawyers table)';
COMMENT ON COLUMN cases.lawyer_name IS 'Primary lawyer name (deprecated - use case_lawyers table)';

-- =====================================================
-- STEP 4: DROP AND RECREATE ANALYTICS FUNCTIONS
-- =====================================================

-- Drop existing functions
DROP FUNCTION IF EXISTS calculate_lawyer_analytics(UUID);
DROP FUNCTION IF EXISTS calculate_lawyer_ranks();
DROP FUNCTION IF EXISTS calculate_judge_analytics(UUID);
DROP FUNCTION IF EXISTS calculate_court_analytics(UUID);

-- =====================================================
-- NEW: Calculate Lawyer Analytics with Multi-Lawyer Support
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_lawyer_analytics(p_lawyer_id UUID)
RETURNS TABLE(
  total_cases BIGINT,
  won_cases BIGINT,
  lost_cases BIGINT,
  settled_cases BIGINT,
  dismissed_cases BIGINT,
  win_rate NUMERIC,
  loss_rate NUMERIC,
  settlement_rate NUMERIC,
  dismiss_rate NUMERIC,
  avg_case_duration NUMERIC,
  avg_hearings NUMERIC,
  total_petitioner_cases BIGINT,
  total_respondent_cases BIGINT,
  case_type_stats JSONB,
  court_stats JSONB,
  yearly_stats JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH lawyer_cases AS (
    SELECT 
      c.*,
      cl.representation_side,
      cl.lawyer_role
    FROM cases c
    INNER JOIN case_lawyers cl ON c.id = cl.case_id
    WHERE cl.lawyer_id = p_lawyer_id
  ),
  aggregated AS (
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN outcome = 'Won' THEN 1 END) as won,
      COUNT(CASE WHEN outcome = 'Lost' THEN 1 END) as lost,
      COUNT(CASE WHEN outcome = 'Settled' THEN 1 END) as settled,
      COUNT(CASE WHEN outcome = 'Dismissed' THEN 1 END) as dismissed,
      ROUND(AVG(duration_days), 1) as avg_duration,
      ROUND(AVG(total_hearings), 1) as avg_hearings,
      COUNT(CASE WHEN representation_side IN ('Petitioner', 'Plaintiff', 'Complainant') THEN 1 END) as petitioner,
      COUNT(CASE WHEN representation_side IN ('Respondent', 'Defendant', 'Accused') THEN 1 END) as respondent
    FROM lawyer_cases
  ),
  case_types AS (
    SELECT jsonb_object_agg(
      case_type,
      jsonb_build_object(
        'count', count,
        'won', won,
        'win_rate', ROUND(won * 100.0 / NULLIF(count, 0), 1)
      )
    ) as stats
    FROM (
      SELECT 
        case_type,
        COUNT(*) as count,
        COUNT(CASE WHEN outcome = 'Won' THEN 1 END) as won
      FROM lawyer_cases
      GROUP BY case_type
    ) t
  ),
  court_breakdown AS (
    SELECT jsonb_object_agg(
      court_name,
      jsonb_build_object(
        'count', count,
        'avg_duration', ROUND(avg_duration, 0)
      )
    ) as stats
    FROM (
      SELECT 
        court_name,
        COUNT(*) as count,
        AVG(duration_days) as avg_duration
      FROM lawyer_cases
      GROUP BY court_name
    ) t
  ),
  yearly AS (
    SELECT jsonb_object_agg(
      year,
      jsonb_build_object(
        'cases', count,
        'won', won,
        'win_rate', ROUND(won * 100.0 / NULLIF(count, 0), 1)
      )
    ) as stats
    FROM (
      SELECT 
        EXTRACT(YEAR FROM filing_date)::TEXT as year,
        COUNT(*) as count,
        COUNT(CASE WHEN outcome = 'Won' THEN 1 END) as won
      FROM lawyer_cases
      WHERE filing_date IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM filing_date)
      ORDER BY year DESC
    ) t
  )
  SELECT
    a.total,
    a.won,
    a.lost,
    a.settled,
    a.dismissed,
    ROUND(a.won * 100.0 / NULLIF(a.total, 0), 1),
    ROUND(a.lost * 100.0 / NULLIF(a.total, 0), 1),
    ROUND(a.settled * 100.0 / NULLIF(a.total, 0), 1),
    ROUND(a.dismissed * 100.0 / NULLIF(a.total, 0), 1),
    a.avg_duration,
    a.avg_hearings,
    a.petitioner,
    a.respondent,
    COALESCE(ct.stats, '{}'::jsonb),
    COALESCE(cb.stats, '{}'::jsonb),
    COALESCE(y.stats, '{}'::jsonb)
  FROM aggregated a
  CROSS JOIN case_types ct
  CROSS JOIN court_breakdown cb
  CROSS JOIN yearly y;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- NEW: Calculate Lawyer Ranks with Multi-Lawyer Support
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_lawyer_ranks()
RETURNS void AS $$
BEGIN
  WITH lawyer_stats AS (
    SELECT 
      l.id,
      COUNT(DISTINCT cl.case_id) as total_cases,
      COUNT(DISTINCT CASE WHEN c.outcome = 'Won' THEN cl.case_id END) as won_cases,
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
      -- Ranking formula: weighted score
      (
        (won_cases * 10) + -- Win weight
        (total_cases * 5) + -- Volume weight
        (CASE WHEN avg_duration > 0 THEN (1000 / avg_duration) ELSE 0 END * 2) + -- Speed weight (inverted)
        (CASE WHEN avg_hearings > 0 THEN (50 / avg_hearings) ELSE 0 END * 2) -- Efficiency weight (inverted)
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
    WHERE total_cases > 0 -- Only rank lawyers with cases
  ) r
  INNER JOIN ranked rs ON r.id = rs.id
  WHERE l.id = r.id;
  
  RAISE NOTICE 'Lawyer ranks updated successfully';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- NEW: Calculate Judge Analytics (Updated)
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_judge_analytics(p_judge_id UUID)
RETURNS TABLE(
  total_cases BIGINT,
  disposed_cases BIGINT,
  pending_cases BIGINT,
  dismissed_cases BIGINT,
  disposal_rate NUMERIC,
  dismiss_rate NUMERIC,
  avg_case_duration NUMERIC,
  avg_hearings NUMERIC,
  case_type_stats JSONB,
  yearly_stats JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH judge_cases AS (
    SELECT * FROM cases WHERE judge_id = p_judge_id
  ),
  aggregated AS (
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'disposed' THEN 1 END) as disposed,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      COUNT(CASE WHEN outcome = 'Dismissed' THEN 1 END) as dismissed,
      ROUND(AVG(duration_days), 1) as avg_duration,
      ROUND(AVG(total_hearings), 1) as avg_hearings
    FROM judge_cases
  ),
  case_types AS (
    SELECT jsonb_object_agg(
      case_type,
      jsonb_build_object(
        'count', count,
        'disposal_rate', ROUND(disposed * 100.0 / NULLIF(count, 0), 1)
      )
    ) as stats
    FROM (
      SELECT 
        case_type,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'disposed' THEN 1 END) as disposed
      FROM judge_cases
      GROUP BY case_type
    ) t
  ),
  yearly AS (
    SELECT jsonb_object_agg(
      year,
      jsonb_build_object(
        'cases', count,
        'disposed', disposed,
        'disposal_rate', ROUND(disposed * 100.0 / NULLIF(count, 0), 1)
      )
    ) as stats
    FROM (
      SELECT 
        EXTRACT(YEAR FROM filing_date)::TEXT as year,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'disposed' THEN 1 END) as disposed
      FROM judge_cases
      WHERE filing_date IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM filing_date)
      ORDER BY year DESC
    ) t
  )
  SELECT
    a.total,
    a.disposed,
    a.pending,
    a.dismissed,
    ROUND(a.disposed * 100.0 / NULLIF(a.total, 0), 1),
    ROUND(a.dismissed * 100.0 / NULLIF(a.total, 0), 1),
    a.avg_duration,
    a.avg_hearings,
    COALESCE(ct.stats, '{}'::jsonb),
    COALESCE(y.stats, '{}'::jsonb)
  FROM aggregated a
  CROSS JOIN case_types ct
  CROSS JOIN yearly y;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- NEW: Calculate Court Analytics (Updated)
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_court_analytics(p_court_id UUID)
RETURNS TABLE(
  total_cases BIGINT,
  disposed_cases BIGINT,
  pending_cases BIGINT,
  disposal_rate NUMERIC,
  avg_case_duration NUMERIC,
  avg_hearings NUMERIC,
  case_type_stats JSONB,
  yearly_stats JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH court_cases AS (
    SELECT * FROM cases WHERE court_id = p_court_id
  ),
  aggregated AS (
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN status = 'disposed' THEN 1 END) as disposed,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
      ROUND(AVG(duration_days), 1) as avg_duration,
      ROUND(AVG(total_hearings), 1) as avg_hearings
    FROM court_cases
  ),
  case_types AS (
    SELECT jsonb_object_agg(
      case_type,
      jsonb_build_object(
        'count', count,
        'disposal_rate', ROUND(disposed * 100.0 / NULLIF(count, 0), 1)
      )
    ) as stats
    FROM (
      SELECT 
        case_type,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'disposed' THEN 1 END) as disposed
      FROM court_cases
      GROUP BY case_type
    ) t
  ),
  yearly AS (
    SELECT jsonb_object_agg(
      year,
      jsonb_build_object(
        'cases', count,
        'disposed', disposed,
        'disposal_rate', ROUND(disposed * 100.0 / NULLIF(count, 0), 1)
      )
    ) as stats
    FROM (
      SELECT 
        EXTRACT(YEAR FROM filing_date)::TEXT as year,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'disposed' THEN 1 END) as disposed
      FROM court_cases
      WHERE filing_date IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM filing_date)
      ORDER BY year DESC
    ) t
  )
  SELECT
    a.total,
    a.disposed,
    a.pending,
    ROUND(a.disposed * 100.0 / NULLIF(a.total, 0), 1),
    a.avg_duration,
    a.avg_hearings,
    COALESCE(ct.stats, '{}'::jsonb),
    COALESCE(y.stats, '{}'::jsonb)
  FROM aggregated a
  CROSS JOIN case_types ct
  CROSS JOIN yearly y;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 5: RECALCULATE ALL RANKINGS
-- =====================================================

SELECT calculate_lawyer_ranks();
SELECT calculate_judge_ranks();
SELECT calculate_court_ranks();

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check case_lawyers distribution
SELECT 
  'Total case-lawyer relationships' as metric,
  COUNT(*) as value
FROM case_lawyers
UNION ALL
SELECT 
  'Cases with multiple lawyers',
  COUNT(DISTINCT case_id)
FROM (
  SELECT case_id
  FROM case_lawyers
  GROUP BY case_id
  HAVING COUNT(*) > 1
) t
UNION ALL
SELECT 
  'Petitioner side representations',
  COUNT(*)
FROM case_lawyers
WHERE representation_side IN ('Petitioner', 'Plaintiff', 'Complainant')
UNION ALL
SELECT 
  'Respondent side representations',
  COUNT(*)
FROM case_lawyers
WHERE representation_side IN ('Respondent', 'Defendant', 'Accused');

-- Check lawyer stats with new schema
SELECT 
  l.name,
  l.rank,
  COUNT(DISTINCT cl.case_id) as total_cases,
  COUNT(DISTINCT CASE WHEN c.outcome = 'Won' THEN cl.case_id END) as won_cases,
  ROUND(
    COUNT(DISTINCT CASE WHEN c.outcome = 'Won' THEN cl.case_id END) * 100.0 / 
    NULLIF(COUNT(DISTINCT cl.case_id), 0), 
    1
  ) as win_rate
FROM lawyers l
LEFT JOIN case_lawyers cl ON l.id = cl.lawyer_id
LEFT JOIN cases c ON cl.case_id = c.id
WHERE l.is_verified = true
GROUP BY l.id, l.name, l.rank
ORDER BY l.rank NULLS LAST
LIMIT 10;

RAISE NOTICE '✅ Migration complete! Multi-lawyer support enabled.';
