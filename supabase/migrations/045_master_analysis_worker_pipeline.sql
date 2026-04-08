BEGIN;

SET search_path = public, extensions, pg_temp;

ALTER TABLE public.lawyer_analytics
  ADD COLUMN IF NOT EXISTS case_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS courts text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE OR REPLACE FUNCTION public.admin_worker_scope_case_numbers(
  p_scope text DEFAULT 'all',
  p_case_numbers text[] DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS TABLE(case_number text)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_scope text := lower(btrim(coalesce(p_scope, 'all')));
  v_entity_type text := lower(btrim(coalesce(p_entity_type, '')));
  v_target_key text;
  v_target_name text;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF v_scope = 'full' THEN
    v_scope := 'all';
  END IF;

  IF v_scope = 'all' THEN
    RETURN QUERY
    SELECT DISTINCT ca.case_number
    FROM public.cases_analytics ca
    WHERE ca.case_number IS NOT NULL
      AND btrim(ca.case_number) <> '';
    RETURN;
  END IF;

  IF v_scope = 'case_numbers' THEN
    RETURN QUERY
    SELECT DISTINCT btrim(x.cn) AS case_number
    FROM unnest(coalesce(p_case_numbers, ARRAY[]::text[])) AS x(cn)
    JOIN public.cases_analytics ca
      ON ca.case_number = btrim(x.cn)
    WHERE x.cn IS NOT NULL
      AND btrim(x.cn) <> '';
    RETURN;
  END IF;

  IF v_scope = 'entity_id' THEN
    IF p_entity_id IS NULL THEN
      RAISE EXCEPTION 'p_entity_id is required when p_scope=entity_id';
    END IF;
    IF v_entity_type NOT IN ('lawyer', 'judge', 'court') THEN
      RAISE EXCEPTION 'p_entity_type must be lawyer|judge|court when p_scope=entity_id';
    END IF;

    IF v_entity_type = 'lawyer' THEN
      SELECT public.canonical_person_name(l.name)
      INTO v_target_key
      FROM public.lawyers l
      WHERE l.id = p_entity_id;

      RETURN QUERY
      SELECT DISTINCT ca.case_number
      FROM public.cases_analytics ca
      WHERE ca.case_number IS NOT NULL
        AND btrim(ca.case_number) <> ''
        AND v_target_key IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM unnest(ARRAY[
            ca.petitioner_lawyer_1, ca.petitioner_lawyer_2, ca.petitioner_lawyer_3, ca.petitioner_lawyer_4, ca.petitioner_lawyer_5,
            ca.respondent_lawyer_1, ca.respondent_lawyer_2, ca.respondent_lawyer_3, ca.respondent_lawyer_4, ca.respondent_lawyer_5
          ]) AS s(raw_name)
          WHERE public.canonical_person_name(s.raw_name) = v_target_key
        );
      RETURN;
    END IF;

    IF v_entity_type = 'judge' THEN
      SELECT public.canonical_person_name(j.name)
      INTO v_target_key
      FROM public.judges j
      WHERE j.id = p_entity_id;

      RETURN QUERY
      SELECT DISTINCT ca.case_number
      FROM public.cases_analytics ca
      WHERE ca.case_number IS NOT NULL
        AND btrim(ca.case_number) <> ''
        AND v_target_key IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM unnest(ARRAY[
            ca.judge_1, ca.judge_2, ca.judge_3, ca.judge_4, ca.judge_5, ca.judge_6, ca.judge_7, ca.judge_8, ca.judge_9
          ]) AS s(raw_name)
          WHERE public.canonical_person_name(s.raw_name) = v_target_key
        );
      RETURN;
    END IF;

    SELECT btrim(co.name)
    INTO v_target_name
    FROM public.courts co
    WHERE co.id = p_entity_id;

    RETURN QUERY
    SELECT DISTINCT ca.case_number
    FROM public.cases_analytics ca
    WHERE ca.case_number IS NOT NULL
      AND btrim(ca.case_number) <> ''
      AND v_target_name IS NOT NULL
      AND (
        ca.court_id = p_entity_id
        OR lower(btrim(coalesce(ca.court_name, ''))) = lower(v_target_name)
      );
    RETURN;
  END IF;

  RAISE EXCEPTION 'Unsupported p_scope: %', p_scope;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_worker_scope_contract(
  p_scope text DEFAULT 'all',
  p_case_numbers text[] DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_scope text := lower(btrim(coalesce(p_scope, 'all')));
  v_entity_type text := lower(btrim(coalesce(p_entity_type, '')));
  v_count integer := 0;
  v_sample text[];
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF v_scope = 'full' THEN
    v_scope := 'all';
  END IF;

  SELECT COUNT(*)::int,
         COALESCE(array_agg(s.case_number ORDER BY s.case_number) FILTER (WHERE rn <= 5), ARRAY[]::text[])
  INTO v_count, v_sample
  FROM (
    SELECT c.case_number, row_number() OVER (ORDER BY c.case_number) AS rn
    FROM public.admin_worker_scope_case_numbers(v_scope, p_case_numbers, v_entity_type, p_entity_id) c
  ) s;

  RETURN jsonb_build_object(
    'scope', v_scope,
    'entity_type', NULLIF(v_entity_type, ''),
    'entity_id', p_entity_id,
    'requested_case_numbers_count', COALESCE(array_length(p_case_numbers, 1), 0),
    'resolved_case_numbers_count', COALESCE(v_count, 0),
    'resolved_case_numbers_sample', COALESCE(v_sample, ARRAY[]::text[])
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cases_analytics_sync(
  p_scope text DEFAULT 'all',
  p_case_numbers text[] DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_scope text := lower(btrim(coalesce(p_scope, 'all')));
  v_scope_info jsonb;
  v_inserted integer := 0;
  v_deleted integer := 0;
  v_scope_count integer := 0;
  v_scope_sample text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF to_regclass('public.cases_analytics') IS NULL THEN
    EXECUTE 'CREATE TABLE public.cases_analytics (LIKE public.cases INCLUDING ALL)';
  END IF;

  CREATE TEMP TABLE tmp_scope_case_numbers ON COMMIT DROP AS
  SELECT c.case_number
  FROM public.admin_worker_scope_case_numbers(v_scope, p_case_numbers, p_entity_type, p_entity_id) c;

  SELECT
    COUNT(*)::int,
    COALESCE(array_agg(s.case_number ORDER BY s.case_number) FILTER (WHERE rn <= 5), ARRAY[]::text[])
  INTO v_scope_count, v_scope_sample
  FROM (
    SELECT case_number, row_number() OVER (ORDER BY case_number) AS rn
    FROM tmp_scope_case_numbers
  ) s;

  v_scope_info := jsonb_build_object(
    'scope', v_scope,
    'entity_type', NULLIF(lower(btrim(coalesce(p_entity_type, ''))), ''),
    'entity_id', p_entity_id,
    'requested_case_numbers_count', COALESCE(array_length(p_case_numbers, 1), 0),
    'resolved_case_numbers_count', COALESCE(v_scope_count, 0),
    'resolved_case_numbers_sample', COALESCE(v_scope_sample, ARRAY[]::text[])
  );

  IF v_scope IN ('all', 'full') THEN
    INSERT INTO public.cases_analytics
    SELECT c.*
    FROM public.cases c
    WHERE c.case_number IS NOT NULL
      AND btrim(c.case_number) <> ''
      AND NOT EXISTS (
        SELECT 1
        FROM public.cases_analytics ca
        WHERE ca.case_number = c.case_number
      );
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  ELSE
    DELETE FROM public.cases_analytics ca
    WHERE ca.case_number IN (SELECT sc.case_number FROM tmp_scope_case_numbers sc);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    INSERT INTO public.cases_analytics
    SELECT x.*
    FROM (
      SELECT DISTINCT ON (c.case_number) c.*
      FROM public.cases c
      JOIN tmp_scope_case_numbers sc ON sc.case_number = c.case_number
      ORDER BY c.case_number, c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST, c.id DESC
    ) x;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'status', 'ok',
    'worker', 'admin_cases_analytics_sync',
    'scope', v_scope_info,
    'deleted_cases_analytics_rows', v_deleted,
    'inserted_cases_analytics_rows', v_inserted
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cases_analytics_standardize_names(
  p_scope text DEFAULT 'all',
  p_case_numbers text[] DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_scope_info jsonb;
  v_lawyer_updates integer := 0;
  v_judge_updates integer := 0;
  v_step_count integer := 0;
  v_scope_count integer := 0;
  v_scope_sample text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF to_regclass('public.cases_analytics') IS NULL THEN
    RAISE EXCEPTION 'public.cases_analytics does not exist. Run admin_cases_analytics_sync first.';
  END IF;

  CREATE TEMP TABLE tmp_scope_case_numbers ON COMMIT DROP AS
  SELECT c.case_number
  FROM public.admin_worker_scope_case_numbers(p_scope, p_case_numbers, p_entity_type, p_entity_id) c;

  SELECT
    COUNT(*)::int,
    COALESCE(array_agg(s.case_number ORDER BY s.case_number) FILTER (WHERE rn <= 5), ARRAY[]::text[])
  INTO v_scope_count, v_scope_sample
  FROM (
    SELECT case_number, row_number() OVER (ORDER BY case_number) AS rn
    FROM tmp_scope_case_numbers
  ) s;

  v_scope_info := jsonb_build_object(
    'scope', lower(btrim(coalesce(p_scope, 'all'))),
    'entity_type', NULLIF(lower(btrim(coalesce(p_entity_type, ''))), ''),
    'entity_id', p_entity_id,
    'requested_case_numbers_count', COALESCE(array_length(p_case_numbers, 1), 0),
    'resolved_case_numbers_count', COALESCE(v_scope_count, 0),
    'resolved_case_numbers_sample', COALESCE(v_scope_sample, ARRAY[]::text[])
  );

  CREATE TEMP TABLE tmp_lawyer_pool ON COMMIT DROP AS
  WITH slots AS (
    SELECT NULLIF(btrim(ca.petitioner_lawyer_1), '') AS raw_name FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.petitioner_lawyer_2), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.petitioner_lawyer_3), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.petitioner_lawyer_4), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.petitioner_lawyer_5), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.respondent_lawyer_1), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.respondent_lawyer_2), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.respondent_lawyer_3), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.respondent_lawyer_4), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.respondent_lawyer_5), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
  ),
  cleaned AS (
    SELECT
      raw_name,
      public.canonical_person_name(raw_name) AS cleaned_name,
      regexp_split_to_array(public.canonical_person_name(raw_name), '\\s+') AS toks
    FROM slots
    WHERE raw_name IS NOT NULL AND btrim(raw_name) <> ''
  ),
  scored AS (
    SELECT
      cleaned_name,
      public.name_pool_key(raw_name) AS pool_key,
      char_length(toks[array_length(toks, 1)]) AS last_len
    FROM cleaned
  )
  SELECT DISTINCT ON (pool_key)
    pool_key,
    cleaned_name AS rep_name
  FROM scored
  WHERE pool_key IS NOT NULL AND pool_key <> ''
  ORDER BY pool_key, last_len DESC, cleaned_name ASC;

  UPDATE public.cases_analytics ca
  SET petitioner_lawyer_1 = lp.rep_name
  FROM tmp_lawyer_pool lp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.petitioner_lawyer_1 IS NOT NULL
    AND btrim(ca.petitioner_lawyer_1) <> ''
    AND lp.pool_key = public.name_pool_key(ca.petitioner_lawyer_1);
  GET DIAGNOSTICS v_lawyer_updates = ROW_COUNT;

  UPDATE public.cases_analytics ca
  SET petitioner_lawyer_2 = lp.rep_name
  FROM tmp_lawyer_pool lp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.petitioner_lawyer_2 IS NOT NULL
    AND btrim(ca.petitioner_lawyer_2) <> ''
    AND lp.pool_key = public.name_pool_key(ca.petitioner_lawyer_2);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_lawyer_updates := v_lawyer_updates + v_step_count;

  UPDATE public.cases_analytics ca
  SET petitioner_lawyer_3 = lp.rep_name
  FROM tmp_lawyer_pool lp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.petitioner_lawyer_3 IS NOT NULL
    AND btrim(ca.petitioner_lawyer_3) <> ''
    AND lp.pool_key = public.name_pool_key(ca.petitioner_lawyer_3);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_lawyer_updates := v_lawyer_updates + v_step_count;

  UPDATE public.cases_analytics ca
  SET petitioner_lawyer_4 = lp.rep_name
  FROM tmp_lawyer_pool lp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.petitioner_lawyer_4 IS NOT NULL
    AND btrim(ca.petitioner_lawyer_4) <> ''
    AND lp.pool_key = public.name_pool_key(ca.petitioner_lawyer_4);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_lawyer_updates := v_lawyer_updates + v_step_count;

  UPDATE public.cases_analytics ca
  SET petitioner_lawyer_5 = lp.rep_name
  FROM tmp_lawyer_pool lp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.petitioner_lawyer_5 IS NOT NULL
    AND btrim(ca.petitioner_lawyer_5) <> ''
    AND lp.pool_key = public.name_pool_key(ca.petitioner_lawyer_5);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_lawyer_updates := v_lawyer_updates + v_step_count;

  UPDATE public.cases_analytics ca
  SET respondent_lawyer_1 = lp.rep_name
  FROM tmp_lawyer_pool lp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.respondent_lawyer_1 IS NOT NULL
    AND btrim(ca.respondent_lawyer_1) <> ''
    AND lp.pool_key = public.name_pool_key(ca.respondent_lawyer_1);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_lawyer_updates := v_lawyer_updates + v_step_count;

  UPDATE public.cases_analytics ca
  SET respondent_lawyer_2 = lp.rep_name
  FROM tmp_lawyer_pool lp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.respondent_lawyer_2 IS NOT NULL
    AND btrim(ca.respondent_lawyer_2) <> ''
    AND lp.pool_key = public.name_pool_key(ca.respondent_lawyer_2);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_lawyer_updates := v_lawyer_updates + v_step_count;

  UPDATE public.cases_analytics ca
  SET respondent_lawyer_3 = lp.rep_name
  FROM tmp_lawyer_pool lp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.respondent_lawyer_3 IS NOT NULL
    AND btrim(ca.respondent_lawyer_3) <> ''
    AND lp.pool_key = public.name_pool_key(ca.respondent_lawyer_3);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_lawyer_updates := v_lawyer_updates + v_step_count;

  UPDATE public.cases_analytics ca
  SET respondent_lawyer_4 = lp.rep_name
  FROM tmp_lawyer_pool lp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.respondent_lawyer_4 IS NOT NULL
    AND btrim(ca.respondent_lawyer_4) <> ''
    AND lp.pool_key = public.name_pool_key(ca.respondent_lawyer_4);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_lawyer_updates := v_lawyer_updates + v_step_count;

  UPDATE public.cases_analytics ca
  SET respondent_lawyer_5 = lp.rep_name
  FROM tmp_lawyer_pool lp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.respondent_lawyer_5 IS NOT NULL
    AND btrim(ca.respondent_lawyer_5) <> ''
    AND lp.pool_key = public.name_pool_key(ca.respondent_lawyer_5);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_lawyer_updates := v_lawyer_updates + v_step_count;

  CREATE TEMP TABLE tmp_judge_pool ON COMMIT DROP AS
  WITH slots AS (
    SELECT NULLIF(btrim(ca.judge_1), '') AS raw_name FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.judge_2), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.judge_3), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.judge_4), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.judge_5), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.judge_6), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.judge_7), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.judge_8), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    UNION ALL SELECT NULLIF(btrim(ca.judge_9), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
  ),
  cleaned AS (
    SELECT
      raw_name,
      public.canonical_person_name(raw_name) AS cleaned_name,
      regexp_split_to_array(public.canonical_person_name(raw_name), '\\s+') AS toks
    FROM slots
    WHERE raw_name IS NOT NULL AND btrim(raw_name) <> ''
  ),
  scored AS (
    SELECT
      cleaned_name,
      public.name_pool_key(raw_name) AS pool_key,
      char_length(toks[array_length(toks, 1)]) AS last_len
    FROM cleaned
  )
  SELECT DISTINCT ON (pool_key)
    pool_key,
    cleaned_name AS rep_name
  FROM scored
  WHERE pool_key IS NOT NULL AND pool_key <> ''
  ORDER BY pool_key, last_len DESC, cleaned_name ASC;

  UPDATE public.cases_analytics ca
  SET judge_1 = jp.rep_name
  FROM tmp_judge_pool jp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.judge_1 IS NOT NULL
    AND btrim(ca.judge_1) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_1);
  GET DIAGNOSTICS v_judge_updates = ROW_COUNT;

  UPDATE public.cases_analytics ca
  SET judge_2 = jp.rep_name
  FROM tmp_judge_pool jp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.judge_2 IS NOT NULL
    AND btrim(ca.judge_2) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_2);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_judge_updates := v_judge_updates + v_step_count;

  UPDATE public.cases_analytics ca
  SET judge_3 = jp.rep_name
  FROM tmp_judge_pool jp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.judge_3 IS NOT NULL
    AND btrim(ca.judge_3) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_3);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_judge_updates := v_judge_updates + v_step_count;

  UPDATE public.cases_analytics ca
  SET judge_4 = jp.rep_name
  FROM tmp_judge_pool jp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.judge_4 IS NOT NULL
    AND btrim(ca.judge_4) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_4);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_judge_updates := v_judge_updates + v_step_count;

  UPDATE public.cases_analytics ca
  SET judge_5 = jp.rep_name
  FROM tmp_judge_pool jp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.judge_5 IS NOT NULL
    AND btrim(ca.judge_5) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_5);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_judge_updates := v_judge_updates + v_step_count;

  UPDATE public.cases_analytics ca
  SET judge_6 = jp.rep_name
  FROM tmp_judge_pool jp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.judge_6 IS NOT NULL
    AND btrim(ca.judge_6) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_6);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_judge_updates := v_judge_updates + v_step_count;

  UPDATE public.cases_analytics ca
  SET judge_7 = jp.rep_name
  FROM tmp_judge_pool jp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.judge_7 IS NOT NULL
    AND btrim(ca.judge_7) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_7);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_judge_updates := v_judge_updates + v_step_count;

  UPDATE public.cases_analytics ca
  SET judge_8 = jp.rep_name
  FROM tmp_judge_pool jp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.judge_8 IS NOT NULL
    AND btrim(ca.judge_8) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_8);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_judge_updates := v_judge_updates + v_step_count;

  UPDATE public.cases_analytics ca
  SET judge_9 = jp.rep_name
  FROM tmp_judge_pool jp, tmp_scope_case_numbers sc
  WHERE sc.case_number = ca.case_number
    AND ca.judge_9 IS NOT NULL
    AND btrim(ca.judge_9) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_9);
  GET DIAGNOSTICS v_step_count = ROW_COUNT;
  v_judge_updates := v_judge_updates + v_step_count;

  RETURN jsonb_build_object(
    'status', 'ok',
    'worker', 'admin_cases_analytics_standardize_names',
    'scope', v_scope_info,
    'lawyer_slot_updates', v_lawyer_updates,
    'judge_slot_updates', v_judge_updates
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cases_analytics_sync_entities(
  p_scope text DEFAULT 'all',
  p_case_numbers text[] DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_scope_info jsonb;
  v_lawyers_inserted integer := 0;
  v_judges_inserted integer := 0;
  v_courts_inserted integer := 0;
  v_scope_count integer := 0;
  v_scope_sample text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF to_regclass('public.cases_analytics') IS NULL THEN
    RAISE EXCEPTION 'public.cases_analytics does not exist. Run admin_cases_analytics_sync first.';
  END IF;

  CREATE TEMP TABLE tmp_scope_case_numbers ON COMMIT DROP AS
  SELECT c.case_number
  FROM public.admin_worker_scope_case_numbers(p_scope, p_case_numbers, p_entity_type, p_entity_id) c;

  SELECT
    COUNT(*)::int,
    COALESCE(array_agg(s.case_number ORDER BY s.case_number) FILTER (WHERE rn <= 5), ARRAY[]::text[])
  INTO v_scope_count, v_scope_sample
  FROM (
    SELECT case_number, row_number() OVER (ORDER BY case_number) AS rn
    FROM tmp_scope_case_numbers
  ) s;

  v_scope_info := jsonb_build_object(
    'scope', lower(btrim(coalesce(p_scope, 'all'))),
    'entity_type', NULLIF(lower(btrim(coalesce(p_entity_type, ''))), ''),
    'entity_id', p_entity_id,
    'requested_case_numbers_count', COALESCE(array_length(p_case_numbers, 1), 0),
    'resolved_case_numbers_count', COALESCE(v_scope_count, 0),
    'resolved_case_numbers_sample', COALESCE(v_scope_sample, ARRAY[]::text[])
  );

  WITH source_names AS (
    SELECT DISTINCT btrim(ca.court_name) AS name
    FROM public.cases_analytics ca
    JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
    WHERE ca.court_name IS NOT NULL AND btrim(ca.court_name) <> ''
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
      SELECT NULLIF(btrim(ca.judge_1), '') AS name FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.judge_2), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.judge_3), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.judge_4), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.judge_5), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.judge_6), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.judge_7), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.judge_8), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.judge_9), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
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
      SELECT NULLIF(btrim(ca.petitioner_lawyer_1), '') AS name FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.petitioner_lawyer_2), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.petitioner_lawyer_3), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.petitioner_lawyer_4), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.petitioner_lawyer_5), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.respondent_lawyer_1), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.respondent_lawyer_2), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.respondent_lawyer_3), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.respondent_lawyer_4), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL SELECT NULLIF(btrim(ca.respondent_lawyer_5), '') FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL
      SELECT CASE
        WHEN COALESCE(NULLIF(btrim(ca.petitioner_lawyer_1), ''), NULLIF(btrim(ca.petitioner_lawyer_2), ''), NULLIF(btrim(ca.petitioner_lawyer_3), ''), NULLIF(btrim(ca.petitioner_lawyer_4), ''), NULLIF(btrim(ca.petitioner_lawyer_5), '')) IS NULL
        THEN COALESCE(NULLIF(btrim(ca.court_name), ''), 'Unknown Court') || ' Complainant without a lawyer'
        ELSE NULL
      END
      FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
      UNION ALL
      SELECT CASE
        WHEN COALESCE(NULLIF(btrim(ca.respondent_lawyer_1), ''), NULLIF(btrim(ca.respondent_lawyer_2), ''), NULLIF(btrim(ca.respondent_lawyer_3), ''), NULLIF(btrim(ca.respondent_lawyer_4), ''), NULLIF(btrim(ca.respondent_lawyer_5), '')) IS NULL
        THEN COALESCE(NULLIF(btrim(ca.court_name), ''), 'Unknown Court') || ' Respondent without a lawyer'
        ELSE NULL
      END
      FROM public.cases_analytics ca JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
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

  RETURN jsonb_build_object(
    'status', 'ok',
    'worker', 'admin_cases_analytics_sync_entities',
    'scope', v_scope_info,
    'inserted_lawyers', v_lawyers_inserted,
    'inserted_judges', v_judges_inserted,
    'inserted_courts', v_courts_inserted
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cases_analytics_rebuild_analytics_4tables(
  p_scope text DEFAULT 'all',
  p_case_numbers text[] DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_scope_info jsonb;
  v_touched_lawyers uuid[] := ARRAY[]::uuid[];
  v_touched_judges uuid[] := ARRAY[]::uuid[];
  v_touched_courts uuid[] := ARRAY[]::uuid[];
  v_rebuild_case_count integer := 0;
  v_lawyer_rows integer := 0;
  v_judge_rows integer := 0;
  v_court_rows integer := 0;
  v_pair_rows integer := 0;
  v_scope_count integer := 0;
  v_scope_sample text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF to_regclass('public.cases_analytics') IS NULL THEN
    RAISE EXCEPTION 'public.cases_analytics does not exist. Run admin_cases_analytics_sync first.';
  END IF;

  PERFORM set_config('statement_timeout', '600000', true);

  CREATE TEMP TABLE tmp_scope_case_numbers ON COMMIT DROP AS
  SELECT c.case_number
  FROM public.admin_worker_scope_case_numbers(p_scope, p_case_numbers, p_entity_type, p_entity_id) c;

  SELECT
    COUNT(*)::int,
    COALESCE(array_agg(s.case_number ORDER BY s.case_number) FILTER (WHERE rn <= 5), ARRAY[]::text[])
  INTO v_scope_count, v_scope_sample
  FROM (
    SELECT case_number, row_number() OVER (ORDER BY case_number) AS rn
    FROM tmp_scope_case_numbers
  ) s;

  v_scope_info := jsonb_build_object(
    'scope', lower(btrim(coalesce(p_scope, 'all'))),
    'entity_type', NULLIF(lower(btrim(coalesce(p_entity_type, ''))), ''),
    'entity_id', p_entity_id,
    'requested_case_numbers_count', COALESCE(array_length(p_case_numbers, 1), 0),
    'resolved_case_numbers_count', COALESCE(v_scope_count, 0),
    'resolved_case_numbers_sample', COALESCE(v_scope_sample, ARRAY[]::text[])
  );

  IF NOT EXISTS (SELECT 1 FROM tmp_scope_case_numbers) THEN
    RETURN jsonb_build_object(
      'status', 'ok',
      'worker', 'admin_cases_analytics_rebuild_analytics_4tables',
      'scope', v_scope_info,
      'touched', jsonb_build_object('lawyer_ids', ARRAY[]::uuid[], 'judge_ids', ARRAY[]::uuid[], 'court_ids', ARRAY[]::uuid[]),
      'rebuild_case_numbers_count', 0,
      'lawyer_rows', 0,
      'judge_rows', 0,
      'court_rows', 0,
      'lawyer_judge_rows', 0
    );
  END IF;

  CREATE TEMP TABLE tmp_scope_cases ON COMMIT DROP AS
  SELECT DISTINCT ON (ca.case_number)
    ca.id AS case_id,
    ca.case_number,
    ca.court_id,
    ca.court_name,
    ca.status,
    public.normalize_case_outcome(ca.outcome, ca.status, ca.summary) AS norm_outcome,
    CASE
      WHEN COALESCE(ca.filing_date, ca.first_hearing_date) IS NOT NULL AND ca.judgment_date IS NOT NULL
      THEN (ca.judgment_date - COALESCE(ca.filing_date, ca.first_hearing_date))::numeric
      ELSE NULL
    END AS duration_days,
    ca.judge_1, ca.judge_2, ca.judge_3, ca.judge_4, ca.judge_5, ca.judge_6, ca.judge_7, ca.judge_8, ca.judge_9,
    ca.petitioner_lawyer_1, ca.petitioner_lawyer_2, ca.petitioner_lawyer_3, ca.petitioner_lawyer_4, ca.petitioner_lawyer_5,
    ca.respondent_lawyer_1, ca.respondent_lawyer_2, ca.respondent_lawyer_3, ca.respondent_lawyer_4, ca.respondent_lawyer_5,
    ca.updated_at,
    ca.created_at
  FROM public.cases_analytics ca
  JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
  ORDER BY ca.case_number, ca.updated_at DESC NULLS LAST, ca.created_at DESC NULLS LAST, ca.id DESC;

  SELECT COALESCE(array_agg(DISTINCT l.id), ARRAY[]::uuid[])
  INTO v_touched_lawyers
  FROM tmp_scope_cases c
  JOIN public.lawyers l
    ON public.canonical_person_name(l.name) IN (
      public.canonical_person_name(c.petitioner_lawyer_1),
      public.canonical_person_name(c.petitioner_lawyer_2),
      public.canonical_person_name(c.petitioner_lawyer_3),
      public.canonical_person_name(c.petitioner_lawyer_4),
      public.canonical_person_name(c.petitioner_lawyer_5),
      public.canonical_person_name(c.respondent_lawyer_1),
      public.canonical_person_name(c.respondent_lawyer_2),
      public.canonical_person_name(c.respondent_lawyer_3),
      public.canonical_person_name(c.respondent_lawyer_4),
      public.canonical_person_name(c.respondent_lawyer_5)
    );

  SELECT COALESCE(array_agg(DISTINCT j.id), ARRAY[]::uuid[])
  INTO v_touched_judges
  FROM tmp_scope_cases c
  JOIN public.judges j
    ON public.canonical_person_name(j.name) IN (
      public.canonical_person_name(c.judge_1),
      public.canonical_person_name(c.judge_2),
      public.canonical_person_name(c.judge_3),
      public.canonical_person_name(c.judge_4),
      public.canonical_person_name(c.judge_5),
      public.canonical_person_name(c.judge_6),
      public.canonical_person_name(c.judge_7),
      public.canonical_person_name(c.judge_8),
      public.canonical_person_name(c.judge_9)
    );

  SELECT COALESCE(array_agg(DISTINCT co.id), ARRAY[]::uuid[])
  INTO v_touched_courts
  FROM tmp_scope_cases c
  JOIN public.courts co
    ON co.id = c.court_id
    OR lower(btrim(co.name)) = lower(btrim(coalesce(c.court_name, '')));

  CREATE TEMP TABLE tmp_rebuild_case_numbers ON COMMIT DROP AS
  SELECT DISTINCT ca.case_number
  FROM public.cases_analytics ca
  WHERE ca.case_number IS NOT NULL
    AND btrim(ca.case_number) <> ''
    AND (
      EXISTS (
        SELECT 1
        FROM public.lawyers l
        WHERE l.id = ANY(v_touched_lawyers)
          AND public.canonical_person_name(l.name) IN (
            public.canonical_person_name(ca.petitioner_lawyer_1),
            public.canonical_person_name(ca.petitioner_lawyer_2),
            public.canonical_person_name(ca.petitioner_lawyer_3),
            public.canonical_person_name(ca.petitioner_lawyer_4),
            public.canonical_person_name(ca.petitioner_lawyer_5),
            public.canonical_person_name(ca.respondent_lawyer_1),
            public.canonical_person_name(ca.respondent_lawyer_2),
            public.canonical_person_name(ca.respondent_lawyer_3),
            public.canonical_person_name(ca.respondent_lawyer_4),
            public.canonical_person_name(ca.respondent_lawyer_5)
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.judges j
        WHERE j.id = ANY(v_touched_judges)
          AND public.canonical_person_name(j.name) IN (
            public.canonical_person_name(ca.judge_1),
            public.canonical_person_name(ca.judge_2),
            public.canonical_person_name(ca.judge_3),
            public.canonical_person_name(ca.judge_4),
            public.canonical_person_name(ca.judge_5),
            public.canonical_person_name(ca.judge_6),
            public.canonical_person_name(ca.judge_7),
            public.canonical_person_name(ca.judge_8),
            public.canonical_person_name(ca.judge_9)
          )
      )
      OR EXISTS (
        SELECT 1
        FROM public.courts co
        WHERE co.id = ANY(v_touched_courts)
          AND (
            co.id = ca.court_id
            OR lower(btrim(co.name)) = lower(btrim(coalesce(ca.court_name, '')))
          )
      )
    );

  SELECT COUNT(*)::int INTO v_rebuild_case_count FROM tmp_rebuild_case_numbers;

  DELETE FROM public.lawyer_analytics WHERE lawyer_id = ANY(v_touched_lawyers);
  DELETE FROM public.judge_analytics WHERE judge_id = ANY(v_touched_judges);
  DELETE FROM public.court_analytics WHERE court_id = ANY(v_touched_courts);
  DELETE FROM public.lawyer_judge_analytics
  WHERE lawyer_id = ANY(v_touched_lawyers)
     OR judge_id = ANY(v_touched_judges);

  CREATE TEMP TABLE tmp_batch_cases (
    case_id uuid,
    case_number text,
    case_type text,
    court_id uuid,
    court_name text,
    status text,
    norm_outcome text,
    duration_days numeric,
    judge_1 text, judge_2 text, judge_3 text, judge_4 text, judge_5 text,
    judge_6 text, judge_7 text, judge_8 text, judge_9 text,
    petitioner_lawyer_1 text, petitioner_lawyer_2 text, petitioner_lawyer_3 text, petitioner_lawyer_4 text, petitioner_lawyer_5 text,
    respondent_lawyer_1 text, respondent_lawyer_2 text, respondent_lawyer_3 text, respondent_lawyer_4 text, respondent_lawyer_5 text
  ) ON COMMIT DROP;

  INSERT INTO tmp_batch_cases
  SELECT
    x.case_id,
    x.case_number,
    x.case_type,
    x.court_id,
    x.court_name,
    x.status,
    x.norm_outcome,
    x.duration_days,
    x.judge_1, x.judge_2, x.judge_3, x.judge_4, x.judge_5, x.judge_6, x.judge_7, x.judge_8, x.judge_9,
    x.petitioner_lawyer_1, x.petitioner_lawyer_2, x.petitioner_lawyer_3, x.petitioner_lawyer_4, x.petitioner_lawyer_5,
    x.respondent_lawyer_1, x.respondent_lawyer_2, x.respondent_lawyer_3, x.respondent_lawyer_4, x.respondent_lawyer_5
  FROM (
    SELECT DISTINCT ON (ca.case_number)
      ca.id AS case_id,
      ca.case_number,
      ca.case_type,
      ca.court_id,
      ca.court_name,
      ca.status,
      public.normalize_case_outcome(ca.outcome, ca.status, ca.summary) AS norm_outcome,
      CASE
        WHEN COALESCE(ca.filing_date, ca.first_hearing_date) IS NOT NULL AND ca.judgment_date IS NOT NULL
          THEN (ca.judgment_date - COALESCE(ca.filing_date, ca.first_hearing_date))::numeric
        ELSE NULL
      END AS duration_days,
      ca.judge_1, ca.judge_2, ca.judge_3, ca.judge_4, ca.judge_5, ca.judge_6, ca.judge_7, ca.judge_8, ca.judge_9,
      ca.petitioner_lawyer_1, ca.petitioner_lawyer_2, ca.petitioner_lawyer_3, ca.petitioner_lawyer_4, ca.petitioner_lawyer_5,
      ca.respondent_lawyer_1, ca.respondent_lawyer_2, ca.respondent_lawyer_3, ca.respondent_lawyer_4, ca.respondent_lawyer_5,
      ca.updated_at,
      ca.created_at
    FROM public.cases_analytics ca
    JOIN tmp_rebuild_case_numbers rc ON rc.case_number = ca.case_number
    ORDER BY ca.case_number, ca.updated_at DESC NULLS LAST, ca.created_at DESC NULLS LAST, ca.id DESC
  ) x;

  WITH batch_cases AS (
    SELECT
      case_type,
      court_name,
      status,
      norm_outcome,
      duration_days,
      ARRAY[
        NULLIF(btrim(petitioner_lawyer_1), ''),
        NULLIF(btrim(petitioner_lawyer_2), ''),
        NULLIF(btrim(petitioner_lawyer_3), ''),
        NULLIF(btrim(petitioner_lawyer_4), ''),
        NULLIF(btrim(petitioner_lawyer_5), '')
      ]::text[] AS petitioner_lawyers,
      ARRAY[
        NULLIF(btrim(respondent_lawyer_1), ''),
        NULLIF(btrim(respondent_lawyer_2), ''),
        NULLIF(btrim(respondent_lawyer_3), ''),
        NULLIF(btrim(respondent_lawyer_4), ''),
        NULLIF(btrim(respondent_lawyer_5), '')
      ]::text[] AS respondent_lawyers
    FROM tmp_batch_cases
  ),
  lawyer_instances AS (
    SELECT
      bc.case_type,
      bc.court_name,
      bc.status,
      bc.norm_outcome,
      bc.duration_days,
      'Petitioner'::text AS side,
      unnest(CASE
        WHEN array_remove(bc.petitioner_lawyers, NULL) <> '{}'::text[] THEN array_remove(bc.petitioner_lawyers, NULL)
        ELSE ARRAY['Complainant without a lawyer']::text[]
      END) AS lawyer_name
    FROM batch_cases bc
    UNION ALL
    SELECT
      bc.case_type,
      bc.court_name,
      bc.status,
      bc.norm_outcome,
      bc.duration_days,
      'Respondent'::text AS side,
      unnest(CASE
        WHEN array_remove(bc.respondent_lawyers, NULL) <> '{}'::text[] THEN array_remove(bc.respondent_lawyers, NULL)
        ELSE ARRAY['Respondent without a Lawyer']::text[]
      END) AS lawyer_name
    FROM batch_cases bc
  ),
  mapped AS (
    SELECT
      li.side,
      l.id AS lawyer_id,
      l.name AS lawyer_name,
      li.case_type,
      li.court_name,
      li.status,
      li.norm_outcome,
      li.duration_days
    FROM lawyer_instances li
    JOIN LATERAL (
      SELECT l1.*
      FROM public.lawyers l1
      WHERE public.canonical_person_name(l1.name) = public.canonical_person_name(li.lawyer_name)
      ORDER BY (l1.user_id IS NOT NULL) DESC, l1.created_at ASC NULLS LAST, l1.id ASC
      LIMIT 1
    ) l ON true
    WHERE l.id = ANY(v_touched_lawyers)
  ),
  agg AS (
    SELECT
      m.lawyer_id,
      MAX(m.lawyer_name) AS lawyer_name,
      COUNT(*) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled'))::int AS total_cases,
      COUNT(*) FILTER (
        WHERE (m.norm_outcome = 'in favor of complainant' AND m.side = 'Petitioner')
           OR (m.norm_outcome = 'in favor of respondent' AND m.side = 'Respondent')
      )::int AS won_cases,
      COUNT(*) FILTER (
        WHERE (m.norm_outcome = 'in favor of complainant' AND m.side = 'Respondent')
           OR (m.norm_outcome = 'in favor of respondent' AND m.side = 'Petitioner')
      )::int AS lost_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'settled')::int AS settled_cases,
      COUNT(*) FILTER (WHERE lower(coalesce(m.status, '')) ~ '(dismiss|rejected)')::int AS dismissed_cases,
      COUNT(*) FILTER (WHERE lower(coalesce(m.status, '')) ~ '(withdraw)')::int AS withdrawn_cases,
      COUNT(*) FILTER (WHERE lower(coalesce(m.status, '')) ~ '(partial|partly|in\\s+part)')::int AS partially_granted_cases,
      COALESCE(
        array_agg(DISTINCT NULLIF(btrim(m.case_type), ''))
          FILTER (WHERE NULLIF(btrim(m.case_type), '') IS NOT NULL),
        ARRAY[]::text[]
      ) AS case_types,
      COALESCE(
        array_agg(
          DISTINCT CASE
            WHEN NULLIF(btrim(m.court_name), '') IS NULL THEN 'Unknown Court'
            ELSE btrim(m.court_name)
          END
        ),
        ARRAY[]::text[]
      ) AS courts,
      COALESCE(SUM(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0) AS duration_sum_days,
      COALESCE(COUNT(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0)::int AS duration_count
    FROM mapped m
    GROUP BY m.lawyer_id
  )
  INSERT INTO public.lawyer_analytics (
    lawyer_id, lawyer_name,
    total_cases, won_cases, lost_cases, settled_cases,
    dismissed_cases, withdrawn_cases, partially_granted_cases,
    case_types, courts,
    win_rate, loss_rate, settlement_rate,
    avg_case_duration_days, duration_sum_days, duration_count,
    updated_at
  )
  SELECT
    a.lawyer_id,
    a.lawyer_name,
    a.total_cases,
    a.won_cases,
    a.lost_cases,
    a.settled_cases,
    a.dismissed_cases,
    a.withdrawn_cases,
    a.partially_granted_cases,
    a.case_types,
    a.courts,
    COALESCE(ROUND(a.won_cases * 100.0 / NULLIF(a.total_cases, 0), 2), 0),
    COALESCE(ROUND(a.lost_cases * 100.0 / NULLIF(a.total_cases, 0), 2), 0),
    COALESCE(ROUND(a.settled_cases * 100.0 / NULLIF(a.total_cases, 0), 2), 0),
    CASE WHEN a.duration_count > 0 THEN ROUND(a.duration_sum_days / a.duration_count, 2) ELSE 0 END,
    a.duration_sum_days,
    a.duration_count,
    now()
  FROM agg a
  ON CONFLICT (lawyer_id) DO UPDATE
  SET
    lawyer_name = EXCLUDED.lawyer_name,
    total_cases = EXCLUDED.total_cases,
    won_cases = EXCLUDED.won_cases,
    lost_cases = EXCLUDED.lost_cases,
    settled_cases = EXCLUDED.settled_cases,
    dismissed_cases = EXCLUDED.dismissed_cases,
    withdrawn_cases = EXCLUDED.withdrawn_cases,
    partially_granted_cases = EXCLUDED.partially_granted_cases,
    case_types = EXCLUDED.case_types,
    courts = EXCLUDED.courts,
    duration_sum_days = EXCLUDED.duration_sum_days,
    duration_count = EXCLUDED.duration_count,
    win_rate = EXCLUDED.win_rate,
    loss_rate = EXCLUDED.loss_rate,
    settlement_rate = EXCLUDED.settlement_rate,
    avg_case_duration_days = EXCLUDED.avg_case_duration_days,
    updated_at = now();
  GET DIAGNOSTICS v_lawyer_rows = ROW_COUNT;

  WITH batch_cases AS (
    SELECT
      status,
      norm_outcome,
      duration_days,
      ARRAY[
        NULLIF(btrim(judge_1), ''),
        NULLIF(btrim(judge_2), ''),
        NULLIF(btrim(judge_3), ''),
        NULLIF(btrim(judge_4), ''),
        NULLIF(btrim(judge_5), ''),
        NULLIF(btrim(judge_6), ''),
        NULLIF(btrim(judge_7), ''),
        NULLIF(btrim(judge_8), ''),
        NULLIF(btrim(judge_9), '')
      ]::text[] AS judges
    FROM tmp_batch_cases
  ),
  judge_instances AS (
    SELECT
      bc.status,
      bc.norm_outcome,
      bc.duration_days,
      unnest(CASE
        WHEN array_remove(bc.judges, NULL) <> '{}'::text[] THEN array_remove(bc.judges, NULL)
        ELSE ARRAY['Unknown Judge']::text[]
      END) AS judge_name
    FROM batch_cases bc
  ),
  mapped AS (
    SELECT
      j.id AS judge_id,
      j.name AS judge_name,
      ji.status,
      ji.norm_outcome,
      ji.duration_days
    FROM judge_instances ji
    JOIN LATERAL (
      SELECT j1.*
      FROM public.judges j1
      WHERE public.canonical_person_name(j1.name) = public.canonical_person_name(ji.judge_name)
      ORDER BY j1.created_at ASC NULLS LAST, j1.id ASC
      LIMIT 1
    ) j ON true
    WHERE j.id = ANY(v_touched_judges)
  ),
  agg AS (
    SELECT
      m.judge_id,
      MAX(m.judge_name) AS judge_name,
      COUNT(*) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled'))::int AS total_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'in favor of complainant')::int AS favor_complainant_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'in favor of respondent')::int AS favor_respondent_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'settled')::int AS settled_cases,
      COUNT(*) FILTER (WHERE lower(coalesce(m.status, '')) ~ '(dismiss|rejected)')::int AS dismissed_cases,
      COUNT(*) FILTER (WHERE lower(coalesce(m.status, '')) ~ '(withdraw)')::int AS withdrawn_cases,
      COUNT(*) FILTER (WHERE lower(coalesce(m.status, '')) ~ '(partial|partly|in\\s+part)')::int AS partially_granted_cases,
      COALESCE(SUM(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0) AS duration_sum_days,
      COALESCE(COUNT(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0)::int AS duration_count
    FROM mapped m
    GROUP BY m.judge_id
  )
  INSERT INTO public.judge_analytics (
    judge_id, judge_name,
    total_cases, favor_complainant_cases, favor_respondent_cases,
    settled_cases, dismissed_cases, withdrawn_cases, partially_granted_cases,
    favor_complainant_rate, favor_respondent_rate, settlement_rate,
    avg_case_duration_days, duration_sum_days, duration_count,
    updated_at
  )
  SELECT
    a.judge_id,
    a.judge_name,
    a.total_cases,
    a.favor_complainant_cases,
    a.favor_respondent_cases,
    a.settled_cases,
    a.dismissed_cases,
    a.withdrawn_cases,
    a.partially_granted_cases,
    COALESCE(ROUND(a.favor_complainant_cases * 100.0 / NULLIF(a.total_cases, 0), 2), 0),
    COALESCE(ROUND(a.favor_respondent_cases * 100.0 / NULLIF(a.total_cases, 0), 2), 0),
    COALESCE(ROUND(a.settled_cases * 100.0 / NULLIF(a.total_cases, 0), 2), 0),
    CASE WHEN a.duration_count > 0 THEN ROUND(a.duration_sum_days / a.duration_count, 2) ELSE 0 END,
    a.duration_sum_days,
    a.duration_count,
    now()
  FROM agg a
  ON CONFLICT (judge_id) DO UPDATE
  SET
    judge_name = EXCLUDED.judge_name,
    total_cases = EXCLUDED.total_cases,
    favor_complainant_cases = EXCLUDED.favor_complainant_cases,
    favor_respondent_cases = EXCLUDED.favor_respondent_cases,
    settled_cases = EXCLUDED.settled_cases,
    dismissed_cases = EXCLUDED.dismissed_cases,
    withdrawn_cases = EXCLUDED.withdrawn_cases,
    partially_granted_cases = EXCLUDED.partially_granted_cases,
    duration_sum_days = EXCLUDED.duration_sum_days,
    duration_count = EXCLUDED.duration_count,
    favor_complainant_rate = EXCLUDED.favor_complainant_rate,
    favor_respondent_rate = EXCLUDED.favor_respondent_rate,
    settlement_rate = EXCLUDED.settlement_rate,
    avg_case_duration_days = EXCLUDED.avg_case_duration_days,
    updated_at = now();
  GET DIAGNOSTICS v_judge_rows = ROW_COUNT;

  WITH batch_cases AS (
    SELECT
      court_id,
      court_name,
      status,
      norm_outcome,
      duration_days
    FROM tmp_batch_cases
  ),
  mapped AS (
    SELECT
      co.id AS court_id,
      co.name AS court_name,
      bc.status,
      bc.norm_outcome,
      bc.duration_days
    FROM batch_cases bc
    JOIN public.courts co
      ON co.id = bc.court_id
       OR (bc.court_id IS NULL AND co.name = btrim(bc.court_name))
    WHERE co.id = ANY(v_touched_courts)
  ),
  agg AS (
    SELECT
      m.court_id,
      MAX(m.court_name) AS court_name,
      COUNT(*) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled'))::int AS total_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'in favor of complainant')::int AS favor_complainant_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'in favor of respondent')::int AS favor_respondent_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'settled')::int AS settled_cases,
      COUNT(*) FILTER (WHERE lower(coalesce(m.status, '')) ~ '(dismiss|rejected)')::int AS dismissed_cases,
      COUNT(*) FILTER (WHERE lower(coalesce(m.status, '')) ~ '(withdraw)')::int AS withdrawn_cases,
      COUNT(*) FILTER (WHERE lower(coalesce(m.status, '')) ~ '(partial|partly|in\\s+part)')::int AS partially_granted_cases,
      COALESCE(SUM(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0) AS duration_sum_days,
      COALESCE(COUNT(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0)::int AS duration_count
    FROM mapped m
    GROUP BY m.court_id
  )
  INSERT INTO public.court_analytics (
    court_id, court_name,
    total_cases, favor_complainant_cases, favor_respondent_cases,
    settled_cases, dismissed_cases, withdrawn_cases, partially_granted_cases,
    settlement_rate,
    avg_case_duration_days, duration_sum_days, duration_count,
    updated_at
  )
  SELECT
    a.court_id,
    a.court_name,
    a.total_cases,
    a.favor_complainant_cases,
    a.favor_respondent_cases,
    a.settled_cases,
    a.dismissed_cases,
    a.withdrawn_cases,
    a.partially_granted_cases,
    COALESCE(ROUND(a.settled_cases * 100.0 / NULLIF(a.total_cases, 0), 2), 0),
    CASE WHEN a.duration_count > 0 THEN ROUND(a.duration_sum_days / a.duration_count, 2) ELSE 0 END,
    a.duration_sum_days,
    a.duration_count,
    now()
  FROM agg a
  ON CONFLICT (court_id) DO UPDATE
  SET
    court_name = EXCLUDED.court_name,
    total_cases = EXCLUDED.total_cases,
    favor_complainant_cases = EXCLUDED.favor_complainant_cases,
    favor_respondent_cases = EXCLUDED.favor_respondent_cases,
    settled_cases = EXCLUDED.settled_cases,
    dismissed_cases = EXCLUDED.dismissed_cases,
    withdrawn_cases = EXCLUDED.withdrawn_cases,
    partially_granted_cases = EXCLUDED.partially_granted_cases,
    duration_sum_days = EXCLUDED.duration_sum_days,
    duration_count = EXCLUDED.duration_count,
    settlement_rate = EXCLUDED.settlement_rate,
    avg_case_duration_days = EXCLUDED.avg_case_duration_days,
    updated_at = now();
  GET DIAGNOSTICS v_court_rows = ROW_COUNT;

  WITH batch_cases AS (
    SELECT
      status,
      norm_outcome,
      duration_days,
      ARRAY[
        NULLIF(btrim(judge_1), ''),
        NULLIF(btrim(judge_2), ''),
        NULLIF(btrim(judge_3), ''),
        NULLIF(btrim(judge_4), ''),
        NULLIF(btrim(judge_5), ''),
        NULLIF(btrim(judge_6), ''),
        NULLIF(btrim(judge_7), ''),
        NULLIF(btrim(judge_8), ''),
        NULLIF(btrim(judge_9), '')
      ]::text[] AS judges,
      ARRAY[
        NULLIF(btrim(petitioner_lawyer_1), ''),
        NULLIF(btrim(petitioner_lawyer_2), ''),
        NULLIF(btrim(petitioner_lawyer_3), ''),
        NULLIF(btrim(petitioner_lawyer_4), ''),
        NULLIF(btrim(petitioner_lawyer_5), '')
      ]::text[] AS petitioner_lawyers,
      ARRAY[
        NULLIF(btrim(respondent_lawyer_1), ''),
        NULLIF(btrim(respondent_lawyer_2), ''),
        NULLIF(btrim(respondent_lawyer_3), ''),
        NULLIF(btrim(respondent_lawyer_4), ''),
        NULLIF(btrim(respondent_lawyer_5), '')
      ]::text[] AS respondent_lawyers
    FROM tmp_batch_cases
  ),
  lawyer_rows AS (
    SELECT
      bc.status,
      bc.norm_outcome,
      bc.duration_days,
      'Petitioner'::text AS side,
      unnest(CASE
        WHEN array_remove(bc.petitioner_lawyers, NULL) <> '{}'::text[] THEN array_remove(bc.petitioner_lawyers, NULL)
        ELSE ARRAY['Complainant without a lawyer']::text[]
      END) AS lawyer_name,
      bc.judges
    FROM batch_cases bc
    UNION ALL
    SELECT
      bc.status,
      bc.norm_outcome,
      bc.duration_days,
      'Respondent'::text AS side,
      unnest(CASE
        WHEN array_remove(bc.respondent_lawyers, NULL) <> '{}'::text[] THEN array_remove(bc.respondent_lawyers, NULL)
        ELSE ARRAY['Respondent without a Lawyer']::text[]
      END) AS lawyer_name,
      bc.judges
    FROM batch_cases bc
  ),
  expanded AS (
    SELECT
      lr.status,
      lr.norm_outcome,
      lr.duration_days,
      lr.side,
      lr.lawyer_name,
      unnest(CASE
        WHEN array_remove(lr.judges, NULL) <> '{}'::text[] THEN array_remove(lr.judges, NULL)
        ELSE ARRAY['Unknown Judge']::text[]
      END) AS judge_name
    FROM lawyer_rows lr
  ),
  mapped AS (
    SELECT
      l.id AS lawyer_id,
      l.name AS lawyer_name,
      j.id AS judge_id,
      j.name AS judge_name,
      e.side,
      e.status,
      e.norm_outcome,
      e.duration_days
    FROM expanded e
    JOIN LATERAL (
      SELECT l1.*
      FROM public.lawyers l1
      WHERE public.canonical_person_name(l1.name) = public.canonical_person_name(e.lawyer_name)
      ORDER BY (l1.user_id IS NOT NULL) DESC, l1.created_at ASC NULLS LAST, l1.id ASC
      LIMIT 1
    ) l ON true
    JOIN LATERAL (
      SELECT j1.*
      FROM public.judges j1
      WHERE public.canonical_person_name(j1.name) = public.canonical_person_name(e.judge_name)
      ORDER BY j1.created_at ASC NULLS LAST, j1.id ASC
      LIMIT 1
    ) j ON true
    WHERE l.id = ANY(v_touched_lawyers) OR j.id = ANY(v_touched_judges)
  ),
  agg AS (
    SELECT
      m.lawyer_id,
      m.judge_id,
      MAX(m.lawyer_name) AS lawyer_name,
      MAX(m.judge_name) AS judge_name,
      COUNT(*) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled'))::int AS total_cases,
      COUNT(*) FILTER (
        WHERE (m.norm_outcome = 'in favor of complainant' AND m.side = 'Petitioner')
           OR (m.norm_outcome = 'in favor of respondent' AND m.side = 'Respondent')
      )::int AS won_cases,
      COUNT(*) FILTER (
        WHERE (m.norm_outcome = 'in favor of complainant' AND m.side = 'Respondent')
           OR (m.norm_outcome = 'in favor of respondent' AND m.side = 'Petitioner')
      )::int AS lost_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'settled')::int AS settled_cases,
      COALESCE(SUM(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0) AS duration_sum_days,
      COALESCE(COUNT(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0)::int AS duration_count
    FROM mapped m
    GROUP BY m.lawyer_id, m.judge_id
  )
  INSERT INTO public.lawyer_judge_analytics (
    lawyer_id, judge_id, lawyer_name, judge_name,
    total_cases, won_cases, lost_cases, settled_cases,
    win_rate, avg_case_duration_days, duration_sum_days, duration_count,
    updated_at
  )
  SELECT
    a.lawyer_id,
    a.judge_id,
    a.lawyer_name,
    a.judge_name,
    a.total_cases,
    a.won_cases,
    a.lost_cases,
    a.settled_cases,
    COALESCE(ROUND(a.won_cases * 100.0 / NULLIF(a.total_cases, 0), 2), 0),
    CASE WHEN a.duration_count > 0 THEN ROUND(a.duration_sum_days / a.duration_count, 2) ELSE 0 END,
    a.duration_sum_days,
    a.duration_count,
    now()
  FROM agg a
  ON CONFLICT (lawyer_id, judge_id) DO UPDATE
  SET
    lawyer_name = EXCLUDED.lawyer_name,
    judge_name = EXCLUDED.judge_name,
    total_cases = EXCLUDED.total_cases,
    won_cases = EXCLUDED.won_cases,
    lost_cases = EXCLUDED.lost_cases,
    settled_cases = EXCLUDED.settled_cases,
    duration_sum_days = EXCLUDED.duration_sum_days,
    duration_count = EXCLUDED.duration_count,
    win_rate = EXCLUDED.win_rate,
    avg_case_duration_days = EXCLUDED.avg_case_duration_days,
    updated_at = now();
  GET DIAGNOSTICS v_pair_rows = ROW_COUNT;

  RETURN jsonb_build_object(
    'status', 'ok',
    'worker', 'admin_cases_analytics_rebuild_analytics_4tables',
    'scope', v_scope_info,
    'touched', jsonb_build_object(
      'lawyer_ids', v_touched_lawyers,
      'judge_ids', v_touched_judges,
      'court_ids', v_touched_courts
    ),
    'rebuild_case_numbers_count', v_rebuild_case_count,
    'lawyer_rows', v_lawyer_rows,
    'judge_rows', v_judge_rows,
    'court_rows', v_court_rows,
    'lawyer_judge_rows', v_pair_rows
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cases_analytics_rebuild_lawyer_analytics(
  p_scope text DEFAULT 'all',
  p_case_numbers text[] DEFAULT NULL,
  p_entity_type text DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_scope_info jsonb;
  v_scope_count integer := 0;
  v_scope_sample text[] := ARRAY[]::text[];
  v_rebuild_case_count integer := 0;
  v_touched_lawyers uuid[] := ARRAY[]::uuid[];
  v_target_lawyer_id uuid := NULL;
  v_target_lawyer_name text := NULL;
  v_target_lawyer_key text := NULL;
  v_chunk_size integer := 50;
  v_offset integer := 0;
  v_chunk_rows integer := 0;
  v_processed_chunks integer := 0;
  v_total_cases integer := 0;
  v_won_cases integer := 0;
  v_lost_cases integer := 0;
  v_settled_cases integer := 0;
  v_dismissed_cases integer := 0;
  v_withdrawn_cases integer := 0;
  v_partially_granted_cases integer := 0;
  v_duration_sum_days numeric := 0;
  v_duration_count integer := 0;
  v_chunk_total_cases integer := 0;
  v_chunk_won_cases integer := 0;
  v_chunk_lost_cases integer := 0;
  v_chunk_settled_cases integer := 0;
  v_chunk_dismissed_cases integer := 0;
  v_chunk_withdrawn_cases integer := 0;
  v_chunk_partially_granted_cases integer := 0;
  v_chunk_duration_sum_days numeric := 0;
  v_chunk_duration_count integer := 0;
  v_lawyer_rows integer := 0;
  v_case_types text[] := ARRAY[]::text[];
  v_courts text[] := ARRAY[]::text[];
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF to_regclass('public.cases_analytics') IS NULL THEN
    RAISE EXCEPTION 'public.cases_analytics does not exist. Run admin_cases_analytics_sync first.';
  END IF;

  PERFORM set_config('statement_timeout', '600000', true);

  CREATE TEMP TABLE tmp_scope_case_numbers ON COMMIT DROP AS
  SELECT c.case_number
  FROM public.admin_worker_scope_case_numbers(p_scope, p_case_numbers, p_entity_type, p_entity_id) c;

  SELECT
    COUNT(*)::int,
    COALESCE(array_agg(s.case_number ORDER BY s.case_number) FILTER (WHERE rn <= 5), ARRAY[]::text[])
  INTO v_scope_count, v_scope_sample
  FROM (
    SELECT case_number, row_number() OVER (ORDER BY case_number) AS rn
    FROM tmp_scope_case_numbers
  ) s;

  v_scope_info := jsonb_build_object(
    'scope', lower(btrim(coalesce(p_scope, 'all'))),
    'entity_type', NULLIF(lower(btrim(coalesce(p_entity_type, ''))), ''),
    'entity_id', p_entity_id,
    'requested_case_numbers_count', COALESCE(array_length(p_case_numbers, 1), 0),
    'resolved_case_numbers_count', COALESCE(v_scope_count, 0),
    'resolved_case_numbers_sample', COALESCE(v_scope_sample, ARRAY[]::text[])
  );

  IF lower(btrim(coalesce(p_scope, 'all'))) = 'entity_id'
     AND lower(btrim(coalesce(p_entity_type, ''))) = 'lawyer'
     AND p_entity_id IS NOT NULL THEN
    v_target_lawyer_id := p_entity_id;
    v_touched_lawyers := ARRAY[v_target_lawyer_id];
  END IF;

  CREATE TEMP TABLE tmp_scope_cases ON COMMIT DROP AS
  SELECT DISTINCT ON (ca.case_number)
    ca.id AS case_id,
    ca.case_number,
    ca.case_type,
    ca.court_name,
    ca.status,
    public.normalize_case_outcome(ca.outcome, ca.status, ca.summary) AS norm_outcome,
    CASE
      WHEN COALESCE(ca.filing_date, ca.first_hearing_date) IS NOT NULL AND ca.judgment_date IS NOT NULL
      THEN (ca.judgment_date - COALESCE(ca.filing_date, ca.first_hearing_date))::numeric
      ELSE NULL
    END AS duration_days,
    ca.petitioner_lawyer_1, ca.petitioner_lawyer_2, ca.petitioner_lawyer_3, ca.petitioner_lawyer_4, ca.petitioner_lawyer_5,
    ca.respondent_lawyer_1, ca.respondent_lawyer_2, ca.respondent_lawyer_3, ca.respondent_lawyer_4, ca.respondent_lawyer_5
  FROM public.cases_analytics ca
  JOIN tmp_scope_case_numbers sc ON sc.case_number = ca.case_number
  ORDER BY ca.case_number, ca.updated_at DESC NULLS LAST, ca.created_at DESC NULLS LAST, ca.id DESC;

  SELECT COUNT(*)::int INTO v_rebuild_case_count FROM tmp_scope_cases;

  IF array_length(v_touched_lawyers, 1) IS NULL THEN
    SELECT COALESCE(array_agg(DISTINCT l.id), ARRAY[]::uuid[])
    INTO v_touched_lawyers
    FROM tmp_scope_cases c
    JOIN public.lawyers l
      ON public.canonical_person_name(l.name) IN (
        public.canonical_person_name(c.petitioner_lawyer_1),
        public.canonical_person_name(c.petitioner_lawyer_2),
        public.canonical_person_name(c.petitioner_lawyer_3),
        public.canonical_person_name(c.petitioner_lawyer_4),
        public.canonical_person_name(c.petitioner_lawyer_5),
        public.canonical_person_name(c.respondent_lawyer_1),
        public.canonical_person_name(c.respondent_lawyer_2),
        public.canonical_person_name(c.respondent_lawyer_3),
        public.canonical_person_name(c.respondent_lawyer_4),
        public.canonical_person_name(c.respondent_lawyer_5)
      );
  END IF;

  DELETE FROM public.lawyer_analytics
  WHERE lawyer_id = ANY(v_touched_lawyers);

  IF v_target_lawyer_id IS NOT NULL THEN
    SELECT l.name, public.canonical_person_name(l.name)
    INTO v_target_lawyer_name, v_target_lawyer_key
    FROM public.lawyers l
    WHERE l.id = v_target_lawyer_id;

    IF coalesce(v_target_lawyer_key, '') = '' THEN
      RETURN jsonb_build_object(
        'status', 'ok',
        'worker', 'admin_cases_analytics_rebuild_lawyer_analytics',
        'scope', v_scope_info,
        'touched', jsonb_build_object('lawyer_ids', v_touched_lawyers),
        'rebuild_case_numbers_count', v_rebuild_case_count,
        'lawyer_rows', 0
      );
    END IF;

    LOOP
      WITH chunk_cases AS (
        SELECT *
        FROM tmp_scope_cases
        ORDER BY case_number
        LIMIT v_chunk_size
        OFFSET v_offset
      ),
      per_case AS (
        SELECT
          c.status,
          c.norm_outcome,
          c.duration_days,
          (
            CASE WHEN public.canonical_person_name(c.petitioner_lawyer_1) = v_target_lawyer_key THEN 1 ELSE 0 END +
            CASE WHEN public.canonical_person_name(c.petitioner_lawyer_2) = v_target_lawyer_key THEN 1 ELSE 0 END +
            CASE WHEN public.canonical_person_name(c.petitioner_lawyer_3) = v_target_lawyer_key THEN 1 ELSE 0 END +
            CASE WHEN public.canonical_person_name(c.petitioner_lawyer_4) = v_target_lawyer_key THEN 1 ELSE 0 END +
            CASE WHEN public.canonical_person_name(c.petitioner_lawyer_5) = v_target_lawyer_key THEN 1 ELSE 0 END
          )::int AS petitioner_hits,
          (
            CASE WHEN public.canonical_person_name(c.respondent_lawyer_1) = v_target_lawyer_key THEN 1 ELSE 0 END +
            CASE WHEN public.canonical_person_name(c.respondent_lawyer_2) = v_target_lawyer_key THEN 1 ELSE 0 END +
            CASE WHEN public.canonical_person_name(c.respondent_lawyer_3) = v_target_lawyer_key THEN 1 ELSE 0 END +
            CASE WHEN public.canonical_person_name(c.respondent_lawyer_4) = v_target_lawyer_key THEN 1 ELSE 0 END +
            CASE WHEN public.canonical_person_name(c.respondent_lawyer_5) = v_target_lawyer_key THEN 1 ELSE 0 END
          )::int AS respondent_hits
        FROM chunk_cases c
      ),
      expanded AS (
        SELECT status, norm_outcome, duration_days, 'Petitioner'::text AS side, petitioner_hits AS hits
        FROM per_case
        WHERE petitioner_hits > 0
        UNION ALL
        SELECT status, norm_outcome, duration_days, 'Respondent'::text AS side, respondent_hits AS hits
        FROM per_case
        WHERE respondent_hits > 0
      )
      SELECT
        (SELECT COUNT(*)::int FROM chunk_cases),
        COALESCE(SUM(hits) FILTER (WHERE norm_outcome IN ('in favor of complainant','in favor of respondent','settled')), 0)::int,
        COALESCE(SUM(hits) FILTER (
          WHERE (norm_outcome = 'in favor of complainant' AND side = 'Petitioner')
             OR (norm_outcome = 'in favor of respondent' AND side = 'Respondent')
        ), 0)::int,
        COALESCE(SUM(hits) FILTER (
          WHERE (norm_outcome = 'in favor of complainant' AND side = 'Respondent')
             OR (norm_outcome = 'in favor of respondent' AND side = 'Petitioner')
        ), 0)::int,
        COALESCE(SUM(hits) FILTER (WHERE norm_outcome = 'settled'), 0)::int,
        COALESCE(SUM(hits) FILTER (WHERE lower(coalesce(status, '')) ~ '(dismiss|rejected)'), 0)::int,
        COALESCE(SUM(hits) FILTER (WHERE lower(coalesce(status, '')) ~ '(withdraw)'), 0)::int,
        COALESCE(SUM(hits) FILTER (WHERE lower(coalesce(status, '')) ~ '(partial|partly|in\\s+part)'), 0)::int,
        COALESCE(SUM(duration_days * hits) FILTER (WHERE norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND duration_days IS NOT NULL), 0),
        COALESCE(SUM(hits) FILTER (WHERE norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND duration_days IS NOT NULL), 0)::int
      INTO
        v_chunk_rows,
        v_chunk_total_cases,
        v_chunk_won_cases,
        v_chunk_lost_cases,
        v_chunk_settled_cases,
        v_chunk_dismissed_cases,
        v_chunk_withdrawn_cases,
        v_chunk_partially_granted_cases,
        v_chunk_duration_sum_days,
        v_chunk_duration_count
      FROM expanded;

      EXIT WHEN v_chunk_rows = 0;

      v_total_cases := v_total_cases + v_chunk_total_cases;
      v_won_cases := v_won_cases + v_chunk_won_cases;
      v_lost_cases := v_lost_cases + v_chunk_lost_cases;
      v_settled_cases := v_settled_cases + v_chunk_settled_cases;
      v_dismissed_cases := v_dismissed_cases + v_chunk_dismissed_cases;
      v_withdrawn_cases := v_withdrawn_cases + v_chunk_withdrawn_cases;
      v_partially_granted_cases := v_partially_granted_cases + v_chunk_partially_granted_cases;
      v_duration_sum_days := v_duration_sum_days + v_chunk_duration_sum_days;
      v_duration_count := v_duration_count + v_chunk_duration_count;

      v_processed_chunks := v_processed_chunks + 1;
      v_offset := v_offset + v_chunk_size;
    END LOOP;

    SELECT
      COALESCE(
        array_agg(DISTINCT NULLIF(btrim(c.case_type), ''))
          FILTER (WHERE NULLIF(btrim(c.case_type), '') IS NOT NULL),
        ARRAY[]::text[]
      ),
      COALESCE(
        array_agg(
          DISTINCT CASE
            WHEN NULLIF(btrim(c.court_name), '') IS NULL THEN 'Unknown Court'
            ELSE btrim(c.court_name)
          END
        ),
        ARRAY[]::text[]
      )
    INTO v_case_types, v_courts
    FROM tmp_scope_cases c
    WHERE
      public.canonical_person_name(c.petitioner_lawyer_1) = v_target_lawyer_key OR
      public.canonical_person_name(c.petitioner_lawyer_2) = v_target_lawyer_key OR
      public.canonical_person_name(c.petitioner_lawyer_3) = v_target_lawyer_key OR
      public.canonical_person_name(c.petitioner_lawyer_4) = v_target_lawyer_key OR
      public.canonical_person_name(c.petitioner_lawyer_5) = v_target_lawyer_key OR
      public.canonical_person_name(c.respondent_lawyer_1) = v_target_lawyer_key OR
      public.canonical_person_name(c.respondent_lawyer_2) = v_target_lawyer_key OR
      public.canonical_person_name(c.respondent_lawyer_3) = v_target_lawyer_key OR
      public.canonical_person_name(c.respondent_lawyer_4) = v_target_lawyer_key OR
      public.canonical_person_name(c.respondent_lawyer_5) = v_target_lawyer_key;

    INSERT INTO public.lawyer_analytics (
      lawyer_id, lawyer_name,
      total_cases, won_cases, lost_cases, settled_cases,
      dismissed_cases, withdrawn_cases, partially_granted_cases,
      case_types, courts,
      win_rate, loss_rate, settlement_rate,
      avg_case_duration_days, duration_sum_days, duration_count,
      updated_at
    )
    VALUES (
      v_target_lawyer_id,
      coalesce(v_target_lawyer_name, 'Unknown Lawyer'),
      v_total_cases,
      v_won_cases,
      v_lost_cases,
      v_settled_cases,
      v_dismissed_cases,
      v_withdrawn_cases,
      v_partially_granted_cases,
      v_case_types,
      v_courts,
      COALESCE(ROUND(v_won_cases * 100.0 / NULLIF(v_total_cases, 0), 2), 0),
      COALESCE(ROUND(v_lost_cases * 100.0 / NULLIF(v_total_cases, 0), 2), 0),
      COALESCE(ROUND(v_settled_cases * 100.0 / NULLIF(v_total_cases, 0), 2), 0),
      CASE WHEN v_duration_count > 0 THEN ROUND(v_duration_sum_days / v_duration_count, 2) ELSE 0 END,
      v_duration_sum_days,
      v_duration_count,
      now()
    )
    ON CONFLICT (lawyer_id) DO UPDATE
    SET
      lawyer_name = EXCLUDED.lawyer_name,
      total_cases = EXCLUDED.total_cases,
      won_cases = EXCLUDED.won_cases,
      lost_cases = EXCLUDED.lost_cases,
      settled_cases = EXCLUDED.settled_cases,
      dismissed_cases = EXCLUDED.dismissed_cases,
      withdrawn_cases = EXCLUDED.withdrawn_cases,
      partially_granted_cases = EXCLUDED.partially_granted_cases,
      case_types = EXCLUDED.case_types,
      courts = EXCLUDED.courts,
      duration_sum_days = EXCLUDED.duration_sum_days,
      duration_count = EXCLUDED.duration_count,
      win_rate = EXCLUDED.win_rate,
      loss_rate = EXCLUDED.loss_rate,
      settlement_rate = EXCLUDED.settlement_rate,
      avg_case_duration_days = EXCLUDED.avg_case_duration_days,
      updated_at = now();
    GET DIAGNOSTICS v_lawyer_rows = ROW_COUNT;

    RETURN jsonb_build_object(
      'status', 'ok',
      'worker', 'admin_cases_analytics_rebuild_lawyer_analytics',
      'scope', v_scope_info,
      'touched', jsonb_build_object('lawyer_ids', v_touched_lawyers),
      'rebuild_case_numbers_count', v_rebuild_case_count,
      'lawyer_rows', v_lawyer_rows,
      'chunk_size', v_chunk_size,
      'processed_chunks', v_processed_chunks
    );
  END IF;

  CREATE TEMP TABLE tmp_batch_cases ON COMMIT DROP AS
  SELECT * FROM tmp_scope_cases;

  WITH batch_cases AS (
    SELECT
      case_type,
      court_name,
      status,
      norm_outcome,
      duration_days,
      ARRAY[
        NULLIF(btrim(petitioner_lawyer_1), ''),
        NULLIF(btrim(petitioner_lawyer_2), ''),
        NULLIF(btrim(petitioner_lawyer_3), ''),
        NULLIF(btrim(petitioner_lawyer_4), ''),
        NULLIF(btrim(petitioner_lawyer_5), '')
      ]::text[] AS petitioner_lawyers,
      ARRAY[
        NULLIF(btrim(respondent_lawyer_1), ''),
        NULLIF(btrim(respondent_lawyer_2), ''),
        NULLIF(btrim(respondent_lawyer_3), ''),
        NULLIF(btrim(respondent_lawyer_4), ''),
        NULLIF(btrim(respondent_lawyer_5), '')
      ]::text[] AS respondent_lawyers
    FROM tmp_batch_cases
  ),
  lawyer_instances AS (
    SELECT
      bc.case_type,
      bc.court_name,
      bc.status,
      bc.norm_outcome,
      bc.duration_days,
      'Petitioner'::text AS side,
      unnest(
        CASE
          WHEN array_remove(bc.petitioner_lawyers, NULL) <> '{}'::text[] THEN array_remove(bc.petitioner_lawyers, NULL)
          ELSE ARRAY['Complainant without a lawyer']::text[]
        END
      ) AS lawyer_name
    FROM batch_cases bc
    UNION ALL
    SELECT
      bc.case_type,
      bc.court_name,
      bc.status,
      bc.norm_outcome,
      bc.duration_days,
      'Respondent'::text AS side,
      unnest(
        CASE
          WHEN array_remove(bc.respondent_lawyers, NULL) <> '{}'::text[] THEN array_remove(bc.respondent_lawyers, NULL)
          ELSE ARRAY['Respondent without a Lawyer']::text[]
        END
      ) AS lawyer_name
    FROM batch_cases bc
  ),
  mapped AS (
    SELECT
      li.side,
      l.id AS lawyer_id,
      l.name AS lawyer_name,
      li.case_type,
      li.court_name,
      li.status,
      li.norm_outcome,
      li.duration_days
    FROM lawyer_instances li
    JOIN LATERAL (
      SELECT l1.*
      FROM public.lawyers l1
      WHERE public.canonical_person_name(l1.name) = public.canonical_person_name(li.lawyer_name)
      ORDER BY (l1.user_id IS NOT NULL) DESC, l1.created_at ASC NULLS LAST, l1.id ASC
      LIMIT 1
    ) l ON true
    WHERE l.id = ANY(v_touched_lawyers)
  ),
  agg AS (
    SELECT
      m.lawyer_id,
      MAX(m.lawyer_name) AS lawyer_name,
      COUNT(*) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled'))::int AS total_cases,
      COUNT(*) FILTER (
        WHERE (m.norm_outcome = 'in favor of complainant' AND m.side = 'Petitioner')
           OR (m.norm_outcome = 'in favor of respondent' AND m.side = 'Respondent')
      )::int AS won_cases,
      COUNT(*) FILTER (
        WHERE (m.norm_outcome = 'in favor of complainant' AND m.side = 'Respondent')
           OR (m.norm_outcome = 'in favor of respondent' AND m.side = 'Petitioner')
      )::int AS lost_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'settled')::int AS settled_cases,
      COUNT(*) FILTER (WHERE lower(coalesce(m.status, '')) ~ '(dismiss|rejected)')::int AS dismissed_cases,
      COUNT(*) FILTER (WHERE lower(coalesce(m.status, '')) ~ '(withdraw)')::int AS withdrawn_cases,
      COUNT(*) FILTER (WHERE lower(coalesce(m.status, '')) ~ '(partial|partly|in\\s+part)')::int AS partially_granted_cases,
      COALESCE(
        array_agg(DISTINCT NULLIF(btrim(m.case_type), ''))
          FILTER (WHERE NULLIF(btrim(m.case_type), '') IS NOT NULL),
        ARRAY[]::text[]
      ) AS case_types,
      COALESCE(
        array_agg(
          DISTINCT CASE
            WHEN NULLIF(btrim(m.court_name), '') IS NULL THEN 'Unknown Court'
            ELSE btrim(m.court_name)
          END
        ),
        ARRAY[]::text[]
      ) AS courts,
      COALESCE(SUM(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0) AS duration_sum_days,
      COALESCE(COUNT(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0)::int AS duration_count
    FROM mapped m
    GROUP BY m.lawyer_id
  )
  INSERT INTO public.lawyer_analytics (
    lawyer_id, lawyer_name,
    total_cases, won_cases, lost_cases, settled_cases,
    dismissed_cases, withdrawn_cases, partially_granted_cases,
    case_types, courts,
    win_rate, loss_rate, settlement_rate,
    avg_case_duration_days, duration_sum_days, duration_count,
    updated_at
  )
  SELECT
    a.lawyer_id,
    a.lawyer_name,
    a.total_cases,
    a.won_cases,
    a.lost_cases,
    a.settled_cases,
    a.dismissed_cases,
    a.withdrawn_cases,
    a.partially_granted_cases,
    a.case_types,
    a.courts,
    COALESCE(ROUND(a.won_cases * 100.0 / NULLIF(a.total_cases, 0), 2), 0),
    COALESCE(ROUND(a.lost_cases * 100.0 / NULLIF(a.total_cases, 0), 2), 0),
    COALESCE(ROUND(a.settled_cases * 100.0 / NULLIF(a.total_cases, 0), 2), 0),
    CASE WHEN a.duration_count > 0 THEN ROUND(a.duration_sum_days / a.duration_count, 2) ELSE 0 END,
    a.duration_sum_days,
    a.duration_count,
    now()
  FROM agg a
  ON CONFLICT (lawyer_id) DO UPDATE
  SET
    lawyer_name = EXCLUDED.lawyer_name,
    total_cases = EXCLUDED.total_cases,
    won_cases = EXCLUDED.won_cases,
    lost_cases = EXCLUDED.lost_cases,
    settled_cases = EXCLUDED.settled_cases,
    dismissed_cases = EXCLUDED.dismissed_cases,
    withdrawn_cases = EXCLUDED.withdrawn_cases,
    partially_granted_cases = EXCLUDED.partially_granted_cases,
    case_types = EXCLUDED.case_types,
    courts = EXCLUDED.courts,
    duration_sum_days = EXCLUDED.duration_sum_days,
    duration_count = EXCLUDED.duration_count,
    win_rate = EXCLUDED.win_rate,
    loss_rate = EXCLUDED.loss_rate,
    settlement_rate = EXCLUDED.settlement_rate,
    avg_case_duration_days = EXCLUDED.avg_case_duration_days,
    updated_at = now();
  GET DIAGNOSTICS v_lawyer_rows = ROW_COUNT;

  RETURN jsonb_build_object(
    'status', 'ok',
    'worker', 'admin_cases_analytics_rebuild_lawyer_analytics',
    'scope', v_scope_info,
    'touched', jsonb_build_object('lawyer_ids', v_touched_lawyers),
    'rebuild_case_numbers_count', v_rebuild_case_count,
    'lawyer_rows', v_lawyer_rows
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_worker_scope_case_numbers(text, text[], text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_worker_scope_contract(text, text[], text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_cases_analytics_sync(text, text[], text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_cases_analytics_standardize_names(text, text[], text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_cases_analytics_sync_entities(text, text[], text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_cases_analytics_rebuild_lawyer_analytics(text, text[], text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_cases_analytics_rebuild_analytics_4tables(text, text[], text, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.admin_worker_scope_case_numbers(text, text[], text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_worker_scope_contract(text, text[], text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cases_analytics_sync(text, text[], text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cases_analytics_standardize_names(text, text[], text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cases_analytics_sync_entities(text, text[], text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cases_analytics_rebuild_lawyer_analytics(text, text[], text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_cases_analytics_rebuild_analytics_4tables(text, text[], text, uuid) TO authenticated;

COMMIT;
