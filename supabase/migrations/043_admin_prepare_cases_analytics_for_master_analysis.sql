BEGIN;

CREATE OR REPLACE FUNCTION public.name_pool_key(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
WITH cleaned AS (
  SELECT public.canonical_person_name(p_name) AS cleaned_name
),
tokens AS (
  SELECT
    cleaned_name,
    regexp_split_to_array(cleaned_name, '\\s+') AS toks
  FROM cleaned
)
SELECT
  CASE
    WHEN cleaned_name IS NULL OR btrim(cleaned_name) = '' THEN ''
    WHEN array_length(toks, 1) IS NULL OR array_length(toks, 1) < 2 THEN cleaned_name
    ELSE
      array_to_string(toks[1:array_length(toks, 1)-1], ' ')
      || '|'
      || left(toks[array_length(toks, 1)], 1)
  END
FROM tokens;
$$;

CREATE OR REPLACE FUNCTION public.admin_prepare_cases_analytics_for_master_analysis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Ensure cases_analytics exists (schemas should match public.cases).
  IF to_regclass('public.cases_analytics') IS NULL THEN
    EXECUTE 'CREATE TABLE public.cases_analytics (LIKE public.cases INCLUDING ALL);';
  END IF;

  -- Step 1: backfill missing rows (by case_number).
  INSERT INTO public.cases_analytics
  SELECT *
  FROM public.cases c
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.cases_analytics ca
    WHERE ca.case_number = c.case_number
  );
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Step 2: merge pool of names inside cases_analytics to avoid de-merge later.
  -- We standardize lawyer and judge slot strings to a representative "cleaned" name per pool_key.

  -- Lawyers pool
  CREATE TEMP TABLE tmp_lawyer_pool ON COMMIT DROP AS
  WITH slots AS (
    SELECT NULLIF(btrim(petitioner_lawyer_1), '') AS raw_name FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(petitioner_lawyer_2), '') FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(petitioner_lawyer_3), '') FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(petitioner_lawyer_4), '') FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(petitioner_lawyer_5), '') FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(respondent_lawyer_1), '') FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(respondent_lawyer_2), '') FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(respondent_lawyer_3), '') FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(respondent_lawyer_4), '') FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(respondent_lawyer_5), '') FROM public.cases_analytics
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

  -- Standardize lawyer slot columns in cases_analytics
  UPDATE public.cases_analytics ca
  SET petitioner_lawyer_1 = lp.rep_name
  FROM tmp_lawyer_pool lp
  WHERE ca.petitioner_lawyer_1 IS NOT NULL
    AND btrim(ca.petitioner_lawyer_1) <> ''
    AND lp.pool_key = public.name_pool_key(ca.petitioner_lawyer_1);

  UPDATE public.cases_analytics ca
  SET petitioner_lawyer_2 = lp.rep_name
  FROM tmp_lawyer_pool lp
  WHERE ca.petitioner_lawyer_2 IS NOT NULL
    AND btrim(ca.petitioner_lawyer_2) <> ''
    AND lp.pool_key = public.name_pool_key(ca.petitioner_lawyer_2);

  UPDATE public.cases_analytics ca
  SET petitioner_lawyer_3 = lp.rep_name
  FROM tmp_lawyer_pool lp
  WHERE ca.petitioner_lawyer_3 IS NOT NULL
    AND btrim(ca.petitioner_lawyer_3) <> ''
    AND lp.pool_key = public.name_pool_key(ca.petitioner_lawyer_3);

  UPDATE public.cases_analytics ca
  SET petitioner_lawyer_4 = lp.rep_name
  FROM tmp_lawyer_pool lp
  WHERE ca.petitioner_lawyer_4 IS NOT NULL
    AND btrim(ca.petitioner_lawyer_4) <> ''
    AND lp.pool_key = public.name_pool_key(ca.petitioner_lawyer_4);

  UPDATE public.cases_analytics ca
  SET petitioner_lawyer_5 = lp.rep_name
  FROM tmp_lawyer_pool lp
  WHERE ca.petitioner_lawyer_5 IS NOT NULL
    AND btrim(ca.petitioner_lawyer_5) <> ''
    AND lp.pool_key = public.name_pool_key(ca.petitioner_lawyer_5);

  UPDATE public.cases_analytics ca
  SET respondent_lawyer_1 = lp.rep_name
  FROM tmp_lawyer_pool lp
  WHERE ca.respondent_lawyer_1 IS NOT NULL
    AND btrim(ca.respondent_lawyer_1) <> ''
    AND lp.pool_key = public.name_pool_key(ca.respondent_lawyer_1);

  UPDATE public.cases_analytics ca
  SET respondent_lawyer_2 = lp.rep_name
  FROM tmp_lawyer_pool lp
  WHERE ca.respondent_lawyer_2 IS NOT NULL
    AND btrim(ca.respondent_lawyer_2) <> ''
    AND lp.pool_key = public.name_pool_key(ca.respondent_lawyer_2);

  UPDATE public.cases_analytics ca
  SET respondent_lawyer_3 = lp.rep_name
  FROM tmp_lawyer_pool lp
  WHERE ca.respondent_lawyer_3 IS NOT NULL
    AND btrim(ca.respondent_lawyer_3) <> ''
    AND lp.pool_key = public.name_pool_key(ca.respondent_lawyer_3);

  UPDATE public.cases_analytics ca
  SET respondent_lawyer_4 = lp.rep_name
  FROM tmp_lawyer_pool lp
  WHERE ca.respondent_lawyer_4 IS NOT NULL
    AND btrim(ca.respondent_lawyer_4) <> ''
    AND lp.pool_key = public.name_pool_key(ca.respondent_lawyer_4);

  UPDATE public.cases_analytics ca
  SET respondent_lawyer_5 = lp.rep_name
  FROM tmp_lawyer_pool lp
  WHERE ca.respondent_lawyer_5 IS NOT NULL
    AND btrim(ca.respondent_lawyer_5) <> ''
    AND lp.pool_key = public.name_pool_key(ca.respondent_lawyer_5);

  -- Judges pool
  CREATE TEMP TABLE tmp_judge_pool ON COMMIT DROP AS
  WITH slots AS (
    SELECT NULLIF(btrim(judge_1), '') AS raw_name FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(judge_2), '') FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(judge_3), '') FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(judge_4), '') FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(judge_5), '') FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(judge_6), '') FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(judge_7), '') FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(judge_8), '') FROM public.cases_analytics
    UNION ALL SELECT NULLIF(btrim(judge_9), '') FROM public.cases_analytics
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

  -- Standardize judge slot columns in cases_analytics
  UPDATE public.cases_analytics ca
  SET judge_1 = jp.rep_name
  FROM tmp_judge_pool jp
  WHERE ca.judge_1 IS NOT NULL
    AND btrim(ca.judge_1) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_1);

  UPDATE public.cases_analytics ca
  SET judge_2 = jp.rep_name
  FROM tmp_judge_pool jp
  WHERE ca.judge_2 IS NOT NULL
    AND btrim(ca.judge_2) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_2);

  UPDATE public.cases_analytics ca
  SET judge_3 = jp.rep_name
  FROM tmp_judge_pool jp
  WHERE ca.judge_3 IS NOT NULL
    AND btrim(ca.judge_3) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_3);

  UPDATE public.cases_analytics ca
  SET judge_4 = jp.rep_name
  FROM tmp_judge_pool jp
  WHERE ca.judge_4 IS NOT NULL
    AND btrim(ca.judge_4) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_4);

  UPDATE public.cases_analytics ca
  SET judge_5 = jp.rep_name
  FROM tmp_judge_pool jp
  WHERE ca.judge_5 IS NOT NULL
    AND btrim(ca.judge_5) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_5);

  UPDATE public.cases_analytics ca
  SET judge_6 = jp.rep_name
  FROM tmp_judge_pool jp
  WHERE ca.judge_6 IS NOT NULL
    AND btrim(ca.judge_6) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_6);

  UPDATE public.cases_analytics ca
  SET judge_7 = jp.rep_name
  FROM tmp_judge_pool jp
  WHERE ca.judge_7 IS NOT NULL
    AND btrim(ca.judge_7) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_7);

  UPDATE public.cases_analytics ca
  SET judge_8 = jp.rep_name
  FROM tmp_judge_pool jp
  WHERE ca.judge_8 IS NOT NULL
    AND btrim(ca.judge_8) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_8);

  UPDATE public.cases_analytics ca
  SET judge_9 = jp.rep_name
  FROM tmp_judge_pool jp
  WHERE ca.judge_9 IS NOT NULL
    AND btrim(ca.judge_9) <> ''
    AND jp.pool_key = public.name_pool_key(ca.judge_9);

  -- Copy standardized slots back to public.cases so existing master rebuild logic keeps working.
  UPDATE public.cases c
  SET
    judge_1 = ca.judge_1,
    judge_2 = ca.judge_2,
    judge_3 = ca.judge_3,
    judge_4 = ca.judge_4,
    judge_5 = ca.judge_5,
    judge_6 = ca.judge_6,
    judge_7 = ca.judge_7,
    judge_8 = ca.judge_8,
    judge_9 = ca.judge_9,
    petitioner_lawyer_1 = ca.petitioner_lawyer_1,
    petitioner_lawyer_2 = ca.petitioner_lawyer_2,
    petitioner_lawyer_3 = ca.petitioner_lawyer_3,
    petitioner_lawyer_4 = ca.petitioner_lawyer_4,
    petitioner_lawyer_5 = ca.petitioner_lawyer_5,
    respondent_lawyer_1 = ca.respondent_lawyer_1,
    respondent_lawyer_2 = ca.respondent_lawyer_2,
    respondent_lawyer_3 = ca.respondent_lawyer_3,
    respondent_lawyer_4 = ca.respondent_lawyer_4,
    respondent_lawyer_5 = ca.respondent_lawyer_5
  FROM public.cases_analytics ca
  WHERE ca.case_number = c.case_number;

  RETURN jsonb_build_object(
    'ok', true,
    'cases_analytics_inserted', v_inserted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_prepare_cases_analytics_for_master_analysis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_prepare_cases_analytics_for_master_analysis() TO authenticated;

COMMIT;

