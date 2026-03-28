-- Sample Data Generator for Judge My Lawyer
-- Run this script in Supabase SQL Editor after running the initial schema

-- This script generates realistic sample data for testing

-- =====================================================
-- GENERATE SAMPLE CASES
-- =====================================================

-- Generate 100 sample cases with different lawyers
DO $$
DECLARE
  court_ids UUID[];
  judge_ids UUID[];
  lawyer_ids UUID[];
  case_types TEXT[] := ARRAY['Criminal', 'Civil', 'Corporate', 'Family', 'Property', 'Labor'];
  outcomes TEXT[] := ARRAY['Won', 'Lost', 'Settled', 'Dismissed'];
  lawyer_sides TEXT[] := ARRAY['Plaintiff', 'Defendant', 'Petitioner', 'Respondent'];
  i INTEGER;
  random_court UUID;
  random_judge UUID;
  random_lawyer UUID;
  random_case_type TEXT;
  random_outcome TEXT;
  random_side TEXT;
  filing_date DATE;
  judgment_date DATE;
  random_hearings INTEGER;
BEGIN
  -- Get existing IDs
  SELECT ARRAY_AGG(id) INTO court_ids FROM courts;
  SELECT ARRAY_AGG(id) INTO judge_ids FROM judges;
  SELECT ARRAY_AGG(id) INTO lawyer_ids FROM lawyers WHERE is_verified = true;

  -- Generate 100 sample cases
  FOR i IN 1..100 LOOP
    -- Random selections
    random_court := court_ids[1 + floor(random() * array_length(court_ids, 1))::integer];
    random_judge := judge_ids[1 + floor(random() * array_length(judge_ids, 1))::integer];
    random_lawyer := lawyer_ids[1 + floor(random() * array_length(lawyer_ids, 1))::integer];
    random_case_type := case_types[1 + floor(random() * array_length(case_types, 1))::integer];
    random_outcome := outcomes[1 + floor(random() * array_length(outcomes, 1))::integer];
    random_side := lawyer_sides[1 + floor(random() * array_length(lawyer_sides, 1))::integer];
    
    -- Random dates (within last 3 years)
    filing_date := CURRENT_DATE - INTERVAL '1 day' * floor(random() * 1095)::integer;
    judgment_date := filing_date + INTERVAL '1 day' * (30 + floor(random() * 500)::integer);
    random_hearings := 3 + floor(random() * 20)::integer;

    INSERT INTO cases (
      case_number,
      case_title,
      case_type,
      court_id,
      court_name,
      lawyer_id,
      lawyer_name,
      lawyer_side,
      judge_id,
      judge_name,
      filing_date,
      judgment_date,
      first_hearing_date,
      last_hearing_date,
      total_hearings,
      status,
      outcome,
      petitioner_name,
      respondent_name,
      summary,
      verified
    )
    SELECT
      'CASE/' || LPAD(i::TEXT, 6, '0') || '/' || TO_CHAR(filing_date, 'YYYY'),
      CASE random_case_type
        WHEN 'Criminal' THEN 'State vs. ' || chr((65 + floor(random() * 26)::integer)) || '. ' || chr((65 + floor(random() * 26)::integer)) || '.'
        WHEN 'Civil' THEN 'XYZ Corp vs. ABC Ltd - Case ' || i::TEXT
        WHEN 'Corporate' THEN 'Company A vs. Company B - Case ' || i::TEXT
        WHEN 'Family' THEN 'Family Matter ' || i::TEXT
        WHEN 'Property' THEN 'Property Dispute ' || i::TEXT
        ELSE 'Labor Dispute ' || i::TEXT
      END,
      random_case_type,
      random_court,
      (SELECT name FROM courts WHERE id = random_court),
      random_lawyer,
      (SELECT name FROM lawyers WHERE id = random_lawyer),
      random_side,
      random_judge,
      (SELECT name FROM judges WHERE id = random_judge),
      filing_date,
      judgment_date,
      filing_date + INTERVAL '15 days',
      judgment_date - INTERVAL '7 days',
      random_hearings,
      'disposed',
      random_outcome,
      'Petitioner ' || chr((65 + floor(random() * 26)::integer)) || chr((65 + floor(random() * 26)::integer)),
      'Respondent ' || chr((65 + floor(random() * 26)::integer)) || chr((65 + floor(random() * 26)::integer)),
      'Sample case description for testing purposes. This case involves ' || random_case_type || ' matters.',
      true;
  END LOOP;

  RAISE NOTICE '100 sample cases generated successfully!';
END $$;