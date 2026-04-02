-- 030_make_case_import_partial_upsert.sql
-- Make Excel/JSON case import support partial updates by case/complaint number.
-- Existing values are preserved unless the incoming row provides a non-null/non-empty replacement.

BEGIN;

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
    first_hearing_date,
    last_hearing_date,
    case_duration_days,
    avg_gap_between_hearings_days,
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
    COALESCE(x.filing_date, x.first_hearing_date),
    x.judgment_date,
    x.total_hearings,
    x.first_hearing_date,
    x.last_hearing_date,
    x.case_duration_days,
    x.avg_gap_between_hearings_days,
    COALESCE(x.status, 'pending'),
    x.outcome,
    x.summary,
    COALESCE(x.data_source, 'csv_import'),
    COALESCE(x.verified, false)
  FROM (
    SELECT DISTINCT ON (r.case_number)
      NULLIF(btrim(r.case_number), '') AS case_number,
      NULLIF(btrim(r.case_title), '') AS case_title,
      NULLIF(btrim(r.case_type), '') AS case_type,
      NULLIF(btrim(r.court_name), '') AS court_name,
      NULLIF(btrim(r.petitioner_name), '') AS petitioner_name,
      NULLIF(btrim(r.respondent_name), '') AS respondent_name,
      NULLIF(btrim(r.judge_1), '') AS judge_1,
      NULLIF(btrim(r.judge_2), '') AS judge_2,
      NULLIF(btrim(r.judge_3), '') AS judge_3,
      NULLIF(btrim(r.judge_4), '') AS judge_4,
      NULLIF(btrim(r.judge_5), '') AS judge_5,
      NULLIF(btrim(r.judge_6), '') AS judge_6,
      NULLIF(btrim(r.judge_7), '') AS judge_7,
      NULLIF(btrim(r.judge_8), '') AS judge_8,
      NULLIF(btrim(r.judge_9), '') AS judge_9,
      NULLIF(btrim(r.petitioner_lawyer_1), '') AS petitioner_lawyer_1,
      NULLIF(btrim(r.petitioner_lawyer_2), '') AS petitioner_lawyer_2,
      NULLIF(btrim(r.petitioner_lawyer_3), '') AS petitioner_lawyer_3,
      NULLIF(btrim(r.petitioner_lawyer_4), '') AS petitioner_lawyer_4,
      NULLIF(btrim(r.petitioner_lawyer_5), '') AS petitioner_lawyer_5,
      NULLIF(btrim(r.respondent_lawyer_1), '') AS respondent_lawyer_1,
      NULLIF(btrim(r.respondent_lawyer_2), '') AS respondent_lawyer_2,
      NULLIF(btrim(r.respondent_lawyer_3), '') AS respondent_lawyer_3,
      NULLIF(btrim(r.respondent_lawyer_4), '') AS respondent_lawyer_4,
      NULLIF(btrim(r.respondent_lawyer_5), '') AS respondent_lawyer_5,
      r.filing_date,
      r.judgment_date,
      r.total_hearings,
      r.first_hearing_date,
      r.last_hearing_date,
      r.case_duration_days,
      r.avg_gap_between_hearings_days,
      NULLIF(btrim(r.status), '') AS status,
      NULLIF(btrim(r.outcome), '') AS outcome,
      NULLIF(btrim(r.summary), '') AS summary,
      NULLIF(btrim(r.data_source), '') AS data_source,
      r.verified
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
      first_hearing_date date,
      last_hearing_date date,
      case_duration_days integer,
      avg_gap_between_hearings_days numeric,
      status text,
      outcome text,
      summary text,
      data_source text,
      verified boolean
    )
    WHERE NULLIF(btrim(r.case_number), '') IS NOT NULL
    ORDER BY r.case_number
  ) x
  ON CONFLICT (case_number) DO UPDATE
    SET case_title = COALESCE(EXCLUDED.case_title, public.cases.case_title),
        case_type = COALESCE(EXCLUDED.case_type, public.cases.case_type),
        court_name = COALESCE(EXCLUDED.court_name, public.cases.court_name),
        petitioner_name = COALESCE(EXCLUDED.petitioner_name, public.cases.petitioner_name),
        respondent_name = COALESCE(EXCLUDED.respondent_name, public.cases.respondent_name),
        judge_1 = COALESCE(EXCLUDED.judge_1, public.cases.judge_1),
        judge_2 = COALESCE(EXCLUDED.judge_2, public.cases.judge_2),
        judge_3 = COALESCE(EXCLUDED.judge_3, public.cases.judge_3),
        judge_4 = COALESCE(EXCLUDED.judge_4, public.cases.judge_4),
        judge_5 = COALESCE(EXCLUDED.judge_5, public.cases.judge_5),
        judge_6 = COALESCE(EXCLUDED.judge_6, public.cases.judge_6),
        judge_7 = COALESCE(EXCLUDED.judge_7, public.cases.judge_7),
        judge_8 = COALESCE(EXCLUDED.judge_8, public.cases.judge_8),
        judge_9 = COALESCE(EXCLUDED.judge_9, public.cases.judge_9),
        petitioner_lawyer_1 = COALESCE(EXCLUDED.petitioner_lawyer_1, public.cases.petitioner_lawyer_1),
        petitioner_lawyer_2 = COALESCE(EXCLUDED.petitioner_lawyer_2, public.cases.petitioner_lawyer_2),
        petitioner_lawyer_3 = COALESCE(EXCLUDED.petitioner_lawyer_3, public.cases.petitioner_lawyer_3),
        petitioner_lawyer_4 = COALESCE(EXCLUDED.petitioner_lawyer_4, public.cases.petitioner_lawyer_4),
        petitioner_lawyer_5 = COALESCE(EXCLUDED.petitioner_lawyer_5, public.cases.petitioner_lawyer_5),
        respondent_lawyer_1 = COALESCE(EXCLUDED.respondent_lawyer_1, public.cases.respondent_lawyer_1),
        respondent_lawyer_2 = COALESCE(EXCLUDED.respondent_lawyer_2, public.cases.respondent_lawyer_2),
        respondent_lawyer_3 = COALESCE(EXCLUDED.respondent_lawyer_3, public.cases.respondent_lawyer_3),
        respondent_lawyer_4 = COALESCE(EXCLUDED.respondent_lawyer_4, public.cases.respondent_lawyer_4),
        respondent_lawyer_5 = COALESCE(EXCLUDED.respondent_lawyer_5, public.cases.respondent_lawyer_5),
        filing_date = COALESCE(EXCLUDED.filing_date, EXCLUDED.first_hearing_date, public.cases.filing_date, public.cases.first_hearing_date),
        judgment_date = COALESCE(EXCLUDED.judgment_date, public.cases.judgment_date),
        total_hearings = COALESCE(EXCLUDED.total_hearings, public.cases.total_hearings),
        first_hearing_date = COALESCE(EXCLUDED.first_hearing_date, public.cases.first_hearing_date),
        last_hearing_date = COALESCE(EXCLUDED.last_hearing_date, public.cases.last_hearing_date),
        case_duration_days = COALESCE(EXCLUDED.case_duration_days, public.cases.case_duration_days),
        avg_gap_between_hearings_days = COALESCE(EXCLUDED.avg_gap_between_hearings_days, public.cases.avg_gap_between_hearings_days),
        status = COALESCE(EXCLUDED.status, public.cases.status),
        outcome = COALESCE(EXCLUDED.outcome, public.cases.outcome),
        summary = COALESCE(EXCLUDED.summary, public.cases.summary),
        data_source = COALESCE(EXCLUDED.data_source, public.cases.data_source),
        verified = COALESCE(EXCLUDED.verified, public.cases.verified),
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

