-- 021_admin_import_cases_json_skip_sync.sql
-- Variant of admin_import_cases_json that can skip expensive reference sync per batch.

BEGIN;

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
    lawyer_name,
    lawyer_side,
    judge_name,
    judges,
    petitioner_lawyers,
    respondent_lawyers,
    filing_date,
    judgment_date,
    total_hearings,
    status,
    outcome,
    petitioner_name,
    respondent_name,
    summary,
    data_source,
    verified
  )
  SELECT
    x.case_number,
    COALESCE(x.case_title, 'Untitled case'),
    COALESCE(x.case_type, 'Complaint'),
    COALESCE(x.court_name, 'Unknown Court'),
    COALESCE(x.lawyer_name, 'Unknown Lawyer'),
    x.lawyer_side,
    COALESCE(x.judge_name, 'Unknown Judge'),
    COALESCE(x.judges, '[]'::jsonb),
    COALESCE(x.petitioner_lawyers, '[]'::jsonb),
    COALESCE(x.respondent_lawyers, '[]'::jsonb),
    x.filing_date,
    x.judgment_date,
    COALESCE(x.total_hearings, 0),
    COALESCE(x.status, 'pending'),
    x.outcome,
    x.petitioner_name,
    x.respondent_name,
    x.summary,
    COALESCE(x.data_source, 'csv_import'),
    COALESCE(x.verified, false)
  FROM (
    -- Deduplicate incoming rows by case_number within this batch
    SELECT DISTINCT ON (r.case_number)
      r.*
    FROM jsonb_to_recordset(p_rows) AS r(
    case_number text,
    case_title text,
    case_type text,
    court_name text,
    lawyer_name text,
    lawyer_side text,
    judge_name text,
    judges jsonb,
    petitioner_lawyers jsonb,
    respondent_lawyers jsonb,
    filing_date date,
    judgment_date date,
    total_hearings integer,
    status text,
    outcome text,
    petitioner_name text,
    respondent_name text,
    summary text,
    data_source text,
    verified boolean
    )
    WHERE r.case_number IS NOT NULL
    ORDER BY r.case_number
  ) x
  WHERE r.case_number IS NOT NULL
  ON CONFLICT (case_number) DO UPDATE
    SET case_title = EXCLUDED.case_title,
        case_type = EXCLUDED.case_type,
        court_name = EXCLUDED.court_name,
        lawyer_name = EXCLUDED.lawyer_name,
        lawyer_side = EXCLUDED.lawyer_side,
        judge_name = EXCLUDED.judge_name,
        judges = EXCLUDED.judges,
        petitioner_lawyers = EXCLUDED.petitioner_lawyers,
        respondent_lawyers = EXCLUDED.respondent_lawyers,
        filing_date = EXCLUDED.filing_date,
        judgment_date = EXCLUDED.judgment_date,
        total_hearings = EXCLUDED.total_hearings,
        status = EXCLUDED.status,
        outcome = EXCLUDED.outcome,
        petitioner_name = EXCLUDED.petitioner_name,
        respondent_name = EXCLUDED.respondent_name,
        summary = EXCLUDED.summary,
        data_source = EXCLUDED.data_source,
        verified = EXCLUDED.verified,
        updated_at = now();

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  IF NOT p_skip_sync THEN
    IF EXISTS (
      SELECT 1 FROM pg_proc WHERE proname = 'sync_reference_tables_from_cases'
    ) THEN
      PERFORM public.sync_reference_tables_from_cases(false);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'processed', v_inserted,
    'skipped_sync', p_skip_sync
  );
END;
$$;

-- Compatibility wrapper for PostgREST param-order mismatch (bool, jsonb, bool)
CREATE OR REPLACE FUNCTION public.admin_import_cases_json_skip_sync(
  p_replace_existing boolean,
  p_rows jsonb,
  p_skip_sync boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  -- Call the canonical overload explicitly using positional args
  -- (jsonb, boolean, boolean) to avoid ambiguity with this wrapper overload.
  SELECT public.admin_import_cases_json_skip_sync(
    p_rows,
    COALESCE(p_replace_existing, false),
    COALESCE(p_skip_sync, true)
  );
$$;

GRANT EXECUTE ON FUNCTION public.admin_import_cases_json_skip_sync(jsonb, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_cases_json_skip_sync(boolean, jsonb, boolean) TO authenticated;

COMMIT;

