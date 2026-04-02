BEGIN;

DROP FUNCTION IF EXISTS public.admin_sync_reference_tables_from_cases_wide();

CREATE OR REPLACE FUNCTION public.admin_sync_reference_tables_from_cases_wide(
  p_offset integer DEFAULT 0,
  p_batch_size integer DEFAULT 1000
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_batch_size integer := GREATEST(1, LEAST(COALESCE(p_batch_size, 1000), 5000));
  v_lawyers_inserted integer := 0;
  v_judges_inserted integer := 0;
  v_courts_inserted integer := 0;
  v_processed integer := 0;
  v_has_more boolean := false;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  PERFORM set_config('statement_timeout', '600000', true);

  CREATE TEMP TABLE IF NOT EXISTS tmp_sync_case_batch (
    court_name text,
    judge_1 text, judge_2 text, judge_3 text, judge_4 text, judge_5 text, judge_6 text, judge_7 text, judge_8 text, judge_9 text,
    petitioner_lawyer_1 text, petitioner_lawyer_2 text, petitioner_lawyer_3 text, petitioner_lawyer_4 text, petitioner_lawyer_5 text,
    respondent_lawyer_1 text, respondent_lawyer_2 text, respondent_lawyer_3 text, respondent_lawyer_4 text, respondent_lawyer_5 text
  ) ON COMMIT DROP;

  TRUNCATE TABLE tmp_sync_case_batch;

  INSERT INTO tmp_sync_case_batch
  SELECT
    c.court_name,
    c.judge_1, c.judge_2, c.judge_3, c.judge_4, c.judge_5, c.judge_6, c.judge_7, c.judge_8, c.judge_9,
    c.petitioner_lawyer_1, c.petitioner_lawyer_2, c.petitioner_lawyer_3, c.petitioner_lawyer_4, c.petitioner_lawyer_5,
    c.respondent_lawyer_1, c.respondent_lawyer_2, c.respondent_lawyer_3, c.respondent_lawyer_4, c.respondent_lawyer_5
  FROM public.cases c
  WHERE c.case_number IS NOT NULL AND btrim(c.case_number) <> ''
  ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST, c.id DESC
  OFFSET v_offset
  LIMIT v_batch_size;

  SELECT COUNT(*)::int INTO v_processed FROM tmp_sync_case_batch;

  WITH source_names AS (
    SELECT DISTINCT btrim(c.court_name) AS name
    FROM tmp_sync_case_batch c
    WHERE c.court_name IS NOT NULL AND btrim(c.court_name) <> ''
  ),
  inserted AS (
    INSERT INTO public.courts (name)
    SELECT s.name
    FROM source_names s
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.courts co
      WHERE lower(btrim(co.name)) = lower(s.name)
    )
    RETURNING 1
  )
  SELECT COUNT(*)::int INTO v_courts_inserted FROM inserted;

  WITH judge_source AS (
    SELECT DISTINCT public.canonical_person_name(j.name) AS canonical_name, MIN(j.name) AS display_name
    FROM (
      SELECT NULLIF(btrim(c.judge_1), '') AS name FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.judge_2), '') FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.judge_3), '') FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.judge_4), '') FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.judge_5), '') FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.judge_6), '') FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.judge_7), '') FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.judge_8), '') FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.judge_9), '') FROM tmp_sync_case_batch c
    ) j
    WHERE j.name IS NOT NULL AND j.name <> ''
    GROUP BY public.canonical_person_name(j.name)
  ),
  inserted AS (
    INSERT INTO public.judges (name)
    SELECT js.display_name
    FROM judge_source js
    WHERE js.canonical_name <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM public.judges j
        WHERE public.canonical_person_name(j.name) = js.canonical_name
      )
    RETURNING 1
  )
  SELECT COUNT(*)::int INTO v_judges_inserted FROM inserted;

  WITH lawyer_source AS (
    SELECT public.canonical_person_name(l.name) AS canonical_name, MIN(l.name) AS display_name
    FROM (
      SELECT NULLIF(btrim(c.petitioner_lawyer_1), '') AS name FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.petitioner_lawyer_2), '') FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.petitioner_lawyer_3), '') FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.petitioner_lawyer_4), '') FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.petitioner_lawyer_5), '') FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.respondent_lawyer_1), '') FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.respondent_lawyer_2), '') FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.respondent_lawyer_3), '') FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.respondent_lawyer_4), '') FROM tmp_sync_case_batch c
      UNION ALL SELECT NULLIF(btrim(c.respondent_lawyer_5), '') FROM tmp_sync_case_batch c
      UNION ALL
      SELECT CASE
        WHEN COALESCE(NULLIF(btrim(c.petitioner_lawyer_1), ''), NULLIF(btrim(c.petitioner_lawyer_2), ''), NULLIF(btrim(c.petitioner_lawyer_3), ''), NULLIF(btrim(c.petitioner_lawyer_4), ''), NULLIF(btrim(c.petitioner_lawyer_5), '')) IS NULL
        THEN COALESCE(NULLIF(btrim(c.court_name), ''), 'Unknown Court') || ' Complainant without a lawyer'
        ELSE NULL
      END
      FROM tmp_sync_case_batch c
      UNION ALL
      SELECT CASE
        WHEN COALESCE(NULLIF(btrim(c.respondent_lawyer_1), ''), NULLIF(btrim(c.respondent_lawyer_2), ''), NULLIF(btrim(c.respondent_lawyer_3), ''), NULLIF(btrim(c.respondent_lawyer_4), ''), NULLIF(btrim(c.respondent_lawyer_5), '')) IS NULL
        THEN COALESCE(NULLIF(btrim(c.court_name), ''), 'Unknown Court') || ' Respondent without a lawyer'
        ELSE NULL
      END
      FROM tmp_sync_case_batch c
    ) l
    WHERE l.name IS NOT NULL AND l.name <> ''
    GROUP BY public.canonical_person_name(l.name)
  ),
  inserted AS (
    INSERT INTO public.lawyers (name, email, is_verified, is_admin)
    SELECT
      ls.display_name,
      'import+' || md5(ls.canonical_name) || '@judge-my-lawyer.local',
      false,
      false
    FROM lawyer_source ls
    WHERE ls.canonical_name <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM public.lawyers l
        WHERE public.canonical_person_name(l.name) = ls.canonical_name
      )
    RETURNING 1
  )
  SELECT COUNT(*)::int INTO v_lawyers_inserted FROM inserted;

  SELECT EXISTS (
    SELECT 1
    FROM public.cases c
    WHERE c.case_number IS NOT NULL AND btrim(c.case_number) <> ''
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST, c.id DESC
    OFFSET (v_offset + v_batch_size)
    LIMIT 1
  ) INTO v_has_more;

  RETURN jsonb_build_object(
    'ok', true,
    'processed', v_processed,
    'has_more', v_has_more,
    'next_offset', v_offset + v_batch_size,
    'lawyers', v_lawyers_inserted,
    'judges', v_judges_inserted,
    'courts', v_courts_inserted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_sync_reference_tables_from_cases_wide(integer, integer) TO authenticated;

COMMIT;
