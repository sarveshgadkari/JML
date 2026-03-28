-- 010_admin_dashboard_ops.sql
-- RPC helpers for admin dashboard data reset/import without edge API dependency.

BEGIN;

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.lawyers l
    WHERE l.user_id = auth.uid()
      AND l.is_admin = true
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_data(p_delete_cases boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deleted_cases bigint := 0;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Claims and client-side tables
  DELETE FROM public.saved_lawyers;
  DELETE FROM public.consultation_requests;
  DELETE FROM public.card_claims;
  DELETE FROM public.case_claims;
  DELETE FROM public.clients;

  IF p_delete_cases THEN
    DELETE FROM public.cases;
    GET DIAGNOSTICS v_deleted_cases = ROW_COUNT;
  END IF;

  -- Keep signed-in admin lawyer profile, remove import-generated lawyers.
  DELETE FROM public.lawyers
  WHERE (user_id IS NULL OR user_id <> v_uid)
    AND NOT EXISTS (SELECT 1 FROM public.cases c WHERE c.lawyer_id = public.lawyers.id);

  -- Rebuild references from current cases if retained.
  DELETE FROM public.judges
  WHERE NOT EXISTS (SELECT 1 FROM public.cases c WHERE c.judge_id = public.judges.id);

  DELETE FROM public.courts
  WHERE NOT EXISTS (SELECT 1 FROM public.cases c WHERE c.court_id = public.courts.id);

  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'sync_reference_tables_from_cases'
  ) THEN
    PERFORM public.sync_reference_tables_from_cases(false);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'deleted_cases', v_deleted_cases
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_import_cases_json(
  p_rows jsonb,
  p_replace_existing boolean DEFAULT false
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
    r.case_number,
    COALESCE(r.case_title, 'Untitled case'),
    COALESCE(r.case_type, 'Complaint'),
    COALESCE(r.court_name, 'Unknown Court'),
    COALESCE(r.lawyer_name, 'Unknown Lawyer'),
    r.lawyer_side,
    COALESCE(r.judge_name, 'Unknown Judge'),
    COALESCE(r.judges, '[]'::jsonb),
    COALESCE(r.petitioner_lawyers, '[]'::jsonb),
    COALESCE(r.respondent_lawyers, '[]'::jsonb),
    r.filing_date,
    r.judgment_date,
    COALESCE(r.total_hearings, 0),
    COALESCE(r.status, 'pending'),
    r.outcome,
    r.petitioner_name,
    r.respondent_name,
    r.summary,
    COALESCE(r.data_source, 'csv_import'),
    COALESCE(r.verified, false)
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

  -- Also create reference rows for additional lawyers/judges found inside
  -- the multi-valued JSONB arrays (used by analytics).
  -- These are idempotent via ON CONFLICT.
  INSERT INTO public.judges (name)
  SELECT DISTINCT btrim(elem) AS name
  FROM public.cases c
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.judges, '[]'::jsonb)) AS elem
  WHERE c.data_source = 'csv_import'
    AND elem IS NOT NULL
    AND btrim(elem) <> ''
  ON CONFLICT (name) DO NOTHING;

  INSERT INTO public.lawyers (name, email, is_verified, is_admin)
  SELECT
    btrim(s.name) AS name,
    'import+' || md5(lower(btrim(s.name))) || '@judge-my-lawyer.local' AS email,
    false AS is_verified,
    false AS is_admin
  FROM (
    SELECT DISTINCT btrim(elem) AS name
    FROM public.cases c
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.petitioner_lawyers, '[]'::jsonb)) AS elem
    WHERE c.data_source = 'csv_import'
      AND elem IS NOT NULL
      AND btrim(elem) <> ''
    UNION
    SELECT DISTINCT btrim(elem) AS name
    FROM public.cases c
    CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(c.respondent_lawyers, '[]'::jsonb)) AS elem
    WHERE c.data_source = 'csv_import'
      AND elem IS NOT NULL
      AND btrim(elem) <> ''
  ) s
  WHERE s.name IS NOT NULL
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name;

  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'sync_reference_tables_from_cases'
  ) THEN
    PERFORM public.sync_reference_tables_from_cases(false);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'processed', v_inserted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_data(boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_import_cases_json(jsonb, boolean) TO authenticated;

COMMIT;
