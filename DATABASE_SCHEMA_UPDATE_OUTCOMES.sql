-- =====================================================
-- UPDATE: Change Outcome Values to Legal Standards
-- =====================================================
-- Run this to update outcome column to use proper legal terminology

-- =====================================================
-- STEP 1: Update cases table outcome constraint
-- =====================================================

-- Drop existing constraint
ALTER TABLE cases 
DROP CONSTRAINT IF EXISTS cases_outcome_check;

-- Add new constraint with correct legal outcomes
ALTER TABLE cases 
ADD CONSTRAINT cases_outcome_check 
CHECK (outcome IN (
  'In favor of Complainant',  -- Petitioner/Plaintiff wins
  'In favor of Respondent',   -- Respondent/Defendant wins
  'Settled',                  -- Both parties agreed
  'Dismissed',                -- Case dismissed (Respondent wins)
  'Partially Granted',        -- Mixed outcome
  'Withdrawn'                 -- Petitioner withdrew
));

-- =====================================================
-- STEP 2: Migrate existing data
-- =====================================================

-- Update existing "Won" and "Lost" to proper outcomes
-- NOTE: This assumes "Won" means "In favor of Complainant"
--       Adjust if your data uses different logic

UPDATE cases
SET outcome = CASE 
  WHEN outcome = 'Won' THEN 'In favor of Complainant'
  WHEN outcome = 'Lost' THEN 'In favor of Respondent'
  WHEN outcome = 'Settled' THEN 'Settled'
  WHEN outcome = 'Dismissed' THEN 'Dismissed'
  ELSE outcome
END
WHERE outcome IN ('Won', 'Lost', 'Settled', 'Dismissed');

-- =====================================================
-- STEP 3: Update analytics function to calculate win/loss correctly
-- =====================================================

-- Drop existing function
DROP FUNCTION IF EXISTS calculate_lawyer_analytics_with_outcomes(UUID);

-- Create new function that calculates wins based on representation side
CREATE OR REPLACE FUNCTION calculate_lawyer_analytics_with_outcomes(p_lawyer_id UUID)
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
      cl.lawyer_role,
      -- Calculate if this lawyer won based on their side and outcome
      CASE 
        -- Petitioner side cases
        WHEN cl.representation_side IN ('Petitioner', 'Plaintiff', 'Complainant') THEN
          CASE 
            WHEN c.outcome = 'In favor of Complainant' THEN 'Won'
            WHEN c.outcome = 'In favor of Respondent' THEN 'Lost'
            WHEN c.outcome = 'Dismissed' THEN 'Lost'  -- Dismissed favors respondent
            WHEN c.outcome = 'Settled' THEN 'Settled'
            WHEN c.outcome = 'Partially Granted' THEN 'Partial Win'
            WHEN c.outcome = 'Withdrawn' THEN 'Withdrawn'
            ELSE 'Unknown'
          END
        -- Respondent side cases
        WHEN cl.representation_side IN ('Respondent', 'Defendant', 'Accused') THEN
          CASE 
            WHEN c.outcome = 'In favor of Complainant' THEN 'Lost'
            WHEN c.outcome = 'In favor of Respondent' THEN 'Won'
            WHEN c.outcome = 'Dismissed' THEN 'Won'  -- Dismissed favors respondent
            WHEN c.outcome = 'Settled' THEN 'Settled'
            WHEN c.outcome = 'Partially Granted' THEN 'Partial Loss'
            WHEN c.outcome = 'Withdrawn' THEN 'Won'  -- Withdrawal favors respondent
            ELSE 'Unknown'
          END
        ELSE 'Unknown'
      END as lawyer_outcome
    FROM cases c
    INNER JOIN case_lawyers cl ON c.id = cl.case_id
    WHERE cl.lawyer_id = p_lawyer_id
  ),
  aggregated AS (
    SELECT
      COUNT(*) as total,
      COUNT(CASE WHEN lawyer_outcome = 'Won' THEN 1 END) as won,
      COUNT(CASE WHEN lawyer_outcome = 'Lost' THEN 1 END) as lost,
      COUNT(CASE WHEN lawyer_outcome = 'Settled' THEN 1 END) as settled,
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
        COUNT(CASE WHEN lawyer_outcome = 'Won' THEN 1 END) as won
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
        COUNT(CASE WHEN lawyer_outcome = 'Won' THEN 1 END) as won
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
-- STEP 4: Add helper view for easier querying
-- =====================================================

CREATE OR REPLACE VIEW lawyer_case_outcomes AS
SELECT 
  cl.lawyer_id,
  cl.lawyer_name,
  cl.representation_side,
  c.case_number,
  c.case_title,
  c.outcome as case_outcome,
  -- Calculate lawyer's outcome based on their side
  CASE 
    WHEN cl.representation_side IN ('Petitioner', 'Plaintiff', 'Complainant') THEN
      CASE 
        WHEN c.outcome = 'In favor of Complainant' THEN 'Won'
        WHEN c.outcome = 'In favor of Respondent' THEN 'Lost'
        WHEN c.outcome = 'Dismissed' THEN 'Lost'
        WHEN c.outcome = 'Settled' THEN 'Settled'
        WHEN c.outcome = 'Partially Granted' THEN 'Partial Win'
        WHEN c.outcome = 'Withdrawn' THEN 'Withdrawn'
        ELSE 'Unknown'
      END
    WHEN cl.representation_side IN ('Respondent', 'Defendant', 'Accused') THEN
      CASE 
        WHEN c.outcome = 'In favor of Complainant' THEN 'Lost'
        WHEN c.outcome = 'In favor of Respondent' THEN 'Won'
        WHEN c.outcome = 'Dismissed' THEN 'Won'
        WHEN c.outcome = 'Settled' THEN 'Settled'
        WHEN c.outcome = 'Partially Granted' THEN 'Partial Loss'
        WHEN c.outcome = 'Withdrawn' THEN 'Won'
        ELSE 'Unknown'
      END
    ELSE 'Unknown'
  END as lawyer_outcome
FROM case_lawyers cl
INNER JOIN cases c ON cl.case_id = c.id;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check outcome distribution
SELECT 
  outcome,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM cases
WHERE outcome IS NOT NULL
GROUP BY outcome
ORDER BY count DESC;

-- Check lawyer win rates with new logic
SELECT 
  lawyer_name,
  representation_side,
  lawyer_outcome,
  COUNT(*) as cases
FROM lawyer_case_outcomes
GROUP BY lawyer_name, representation_side, lawyer_outcome
ORDER BY lawyer_name, representation_side, lawyer_outcome;

RAISE NOTICE '✅ Outcome values updated to legal standards!';
RAISE NOTICE 'Outcomes now: In favor of Complainant | In favor of Respondent | Settled | Dismissed';
