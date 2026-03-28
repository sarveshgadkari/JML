-- 025_update_admin_import_for_wide_cases.sql
-- Update admin_import_cases_json_skip_sync() to match the "wide" cases table schema:
-- - 9 judge columns (judge_1..judge_9)
-- - 5 lawyers per side (petitioner_lawyer_1..5, respondent_lawyer_1..5)
-- This removes dependency on non-existent columns like lawyer_name/judge_name arrays.

BEGIN;

-- Ensure case_number is unique for ON CONFLICT.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cases_case_number ON public.cases(case_number);

DROP FUNCTION IF EXISTS public.admin_import_cases_json_skip_sync(jsonb, boolean, boolean);

CREATE OR REPLACE FUNCTION public.admin_import_cases_json_skip_sync(
  p_rows jsonb,
  p_replace_existing boolean DEFAULT false,
  p_skip_sync boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted bigint := 0;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_rows IS NULL OR jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  IF p_replace_existing THEN
    DELETE FROM public.cases WHERE data_source = 'csv_import';
  END IF;

  INSERT INTO public.cases (
    case_number,
    case_title,
    case_type,
    court_name,
    petitioner_name,
    respondent_name,
    judge_1, judge_2, judge_3, judge_4, judge_5, judge_6, judge_7, judge_8, judge_9,
    petitioner_lawyer_1, petitioner_lawyer_2, petitioner_lawyer_3, petitioner_lawyer_4, petitioner_lawyer_5,
    respondent_lawyer_1, respondent_lawyer_2, respondent_lawyer_3, respondent_lawyer_4, respondent_lawyer_5,
    filing_date,
    judgment_date,
    total_hearings,
    status,
    outcome,
    summary,
    data_source,
    verified
  )
  SELECT
    x.case_number,
    COALESCE(x.case_title, 'Untitled case'),
    COALESCE(x.case_type, 'Complaint'),
    COALESCE(x.court_name, 'Unknown Court'),
    x.petitioner_name,
    x.respondent_name,
    x.judge_1, x.judge_2, x.judge_3, x.judge_4, x.judge_5, x.judge_6, x.judge_7, x.judge_8, x.judge_9,
    x.petitioner_lawyer_1, x.petitioner_lawyer_2, x.petitioner_lawyer_3, x.petitioner_lawyer_4, x.petitioner_lawyer_5,
    x.respondent_lawyer_1, x.respondent_lawyer_2, x.respondent_lawyer_3, x.respondent_lawyer_4, x.respondent_lawyer_5,
    x.filing_date,
    x.judgment_date,
    COALESCE(x.total_hearings, 0),
    COALESCE(x.status, 'pending'),
    x.outcome,
    x.summary,
    COALESCE(x.data_source, 'csv_import'),
    COALESCE(x.verified, false)
  FROM (
    -- Deduplicate within this batch by case_number
    SELECT DISTINCT ON (r.case_number) r.*
    FROM jsonb_to_recordset(p_rows) AS r(
      case_number text,
      case_title text,
      case_type text,
      court_name text,
      petitioner_name text,
      respondent_name text,
      judge_1 text, judge_2 text, judge_3 text, judge_4 text, judge_5 text, judge_6 text, judge_7 text, judge_8 text, judge_9 text,
      petitioner_lawyer_1 text, petitioner_lawyer_2 text, petitioner_lawyer_3 text, petitioner_lawyer_4 text, petitioner_lawyer_5 text,
      respondent_lawyer_1 text, respondent_lawyer_2 text, respondent_lawyer_3 text, respondent_lawyer_4 text, respondent_lawyer_5 text,
      filing_date date,
      judgment_date date,
      total_hearings integer,
      status text,
      outcome text,
      summary text,
      data_source text,
      verified boolean
    )
    WHERE r.case_number IS NOT NULL
    ORDER BY r.case_number
  ) x
  ON CONFLICT (case_number) DO UPDATE
    SET case_title = EXCLUDED.case_title,
        case_type = EXCLUDED.case_type,
        court_name = EXCLUDED.court_name,
        petitioner_name = EXCLUDED.petitioner_name,
        respondent_name = EXCLUDED.respondent_name,
        judge_1 = EXCLUDED.judge_1,
        judge_2 = EXCLUDED.judge_2,
        judge_3 = EXCLUDED.judge_3,
        judge_4 = EXCLUDED.judge_4,
        judge_5 = EXCLUDED.judge_5,
        judge_6 = EXCLUDED.judge_6,
        judge_7 = EXCLUDED.judge_7,
        judge_8 = EXCLUDED.judge_8,
        judge_9 = EXCLUDED.judge_9,
        petitioner_lawyer_1 = EXCLUDED.petitioner_lawyer_1,
        petitioner_lawyer_2 = EXCLUDED.petitioner_lawyer_2,
        petitioner_lawyer_3 = EXCLUDED.petitioner_lawyer_3,
        petitioner_lawyer_4 = EXCLUDED.petitioner_lawyer_4,
        petitioner_lawyer_5 = EXCLUDED.petitioner_lawyer_5,
        respondent_lawyer_1 = EXCLUDED.respondent_lawyer_1,
        respondent_lawyer_2 = EXCLUDED.respondent_lawyer_2,
        respondent_lawyer_3 = EXCLUDED.respondent_lawyer_3,
        respondent_lawyer_4 = EXCLUDED.respondent_lawyer_4,
        respondent_lawyer_5 = EXCLUDED.respondent_lawyer_5,
        filing_date = EXCLUDED.filing_date,
        judgment_date = EXCLUDED.judgment_date,
        total_hearings = EXCLUDED.total_hearings,
        status = EXCLUDED.status,
        outcome = EXCLUDED.outcome,
        summary = EXCLUDED.summary,
        data_source = EXCLUDED.data_source,
        verified = EXCLUDED.verified,
        updated_at = now();

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'processed', v_inserted,
    'skipped_sync', p_skip_sync
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_import_cases_json_skip_sync(jsonb, boolean, boolean) TO authenticated;

COMMIT;

