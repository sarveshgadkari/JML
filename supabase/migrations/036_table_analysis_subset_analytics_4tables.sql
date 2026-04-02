-- 036_table_analysis_subset_analytics_4tables.sql
-- Dedicated "Table Analysis" RPC for the worker queue.
-- It ONLY (re)calculates the 4 wide analytics tables:
-- - public.lawyer_analytics
-- - public.judge_analytics
-- - public.court_analytics
-- - public.lawyer_judge_analytics
-- and ONLY for the provided case_numbers subset.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_recalculate_analytics_for_case_numbers_wide(
  p_case_numbers text[],
  p_reset boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_processed integer := 0;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  PERFORM set_config('statement_timeout', '600000', true); -- 10 minutes (local)

  IF p_case_numbers IS NULL OR array_length(p_case_numbers, 1) IS NULL OR array_length(p_case_numbers, 1) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'processed', 0);
  END IF;

  IF p_reset THEN
    -- Full reset is destructive. Table Analysis is designed for incremental adds by default.
    TRUNCATE TABLE public.lawyer_analytics;
    TRUNCATE TABLE public.judge_analytics;
    TRUNCATE TABLE public.court_analytics;
    TRUNCATE TABLE public.lawyer_judge_analytics;
  END IF;

  -- Materialize only the requested cases once (avoid rescans).
  CREATE TEMP TABLE tmp_batch_cases (
    case_id uuid,
    case_number text,
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
    x.court_id,
    x.court_name,
    x.status,
    x.norm_outcome,
    x.duration_days,
    x.judge_1, x.judge_2, x.judge_3, x.judge_4, x.judge_5, x.judge_6, x.judge_7, x.judge_8, x.judge_9,
    x.petitioner_lawyer_1, x.petitioner_lawyer_2, x.petitioner_lawyer_3, x.petitioner_lawyer_4, x.petitioner_lawyer_5,
    x.respondent_lawyer_1, x.respondent_lawyer_2, x.respondent_lawyer_3, x.respondent_lawyer_4, x.respondent_lawyer_5
  FROM (
    SELECT DISTINCT ON (c.case_number)
      c.id AS case_id,
      c.case_number,
      c.court_id,
      c.court_name,
      c.status,
      public.normalize_case_outcome(c.outcome, c.status, c.summary) AS norm_outcome,
      CASE
        WHEN COALESCE(c.filing_date, c.first_hearing_date) IS NOT NULL AND c.judgment_date IS NOT NULL
          THEN (c.judgment_date - COALESCE(c.filing_date, c.first_hearing_date))::numeric
        ELSE NULL
      END AS duration_days,
      c.judge_1, c.judge_2, c.judge_3, c.judge_4, c.judge_5, c.judge_6, c.judge_7, c.judge_8, c.judge_9,
      c.petitioner_lawyer_1, c.petitioner_lawyer_2, c.petitioner_lawyer_3, c.petitioner_lawyer_4, c.petitioner_lawyer_5,
      c.respondent_lawyer_1, c.respondent_lawyer_2, c.respondent_lawyer_3, c.respondent_lawyer_4, c.respondent_lawyer_5,
      c.updated_at,
      c.created_at
    FROM public.cases c
    WHERE c.case_number IS NOT NULL
      AND btrim(c.case_number) <> ''
      AND c.case_number = ANY(p_case_numbers)
    ORDER BY
      c.case_number,
      c.updated_at DESC NULLS LAST,
      c.created_at DESC NULLS LAST,
      c.id DESC
  ) x;

  SELECT COUNT(*)::int INTO v_processed FROM tmp_batch_cases;

  -- ===========================
  -- 1) LAWYER ANALYTICS
  -- ===========================
  WITH batch_cases AS (
    SELECT
      case_id,
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
      bc.case_id,
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
      bc.case_id,
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
      COALESCE(SUM(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0) AS duration_sum_days,
      COALESCE(COUNT(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0)::int AS duration_count
    FROM mapped m
    GROUP BY m.lawyer_id
  )
  INSERT INTO public.lawyer_analytics (
    lawyer_id, lawyer_name,
    total_cases, won_cases, lost_cases, settled_cases,
    dismissed_cases, withdrawn_cases, partially_granted_cases,
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
    total_cases = public.lawyer_analytics.total_cases + EXCLUDED.total_cases,
    won_cases = public.lawyer_analytics.won_cases + EXCLUDED.won_cases,
    lost_cases = public.lawyer_analytics.lost_cases + EXCLUDED.lost_cases,
    settled_cases = public.lawyer_analytics.settled_cases + EXCLUDED.settled_cases,
    dismissed_cases = public.lawyer_analytics.dismissed_cases + EXCLUDED.dismissed_cases,
    withdrawn_cases = public.lawyer_analytics.withdrawn_cases + EXCLUDED.withdrawn_cases,
    partially_granted_cases = public.lawyer_analytics.partially_granted_cases + EXCLUDED.partially_granted_cases,
    duration_sum_days = public.lawyer_analytics.duration_sum_days + EXCLUDED.duration_sum_days,
    duration_count = public.lawyer_analytics.duration_count + EXCLUDED.duration_count,
    win_rate = COALESCE(
      ROUND(
        (public.lawyer_analytics.won_cases + EXCLUDED.won_cases) * 100.0
        / NULLIF(
            (public.lawyer_analytics.won_cases + EXCLUDED.won_cases)
          + (public.lawyer_analytics.lost_cases + EXCLUDED.lost_cases)
          + (public.lawyer_analytics.settled_cases + EXCLUDED.settled_cases),
        0),
      2),
      0
    ),
    loss_rate = COALESCE(
      ROUND(
        (public.lawyer_analytics.lost_cases + EXCLUDED.lost_cases) * 100.0
        / NULLIF(
            (public.lawyer_analytics.won_cases + EXCLUDED.won_cases)
          + (public.lawyer_analytics.lost_cases + EXCLUDED.lost_cases)
          + (public.lawyer_analytics.settled_cases + EXCLUDED.settled_cases),
        0),
      2),
      0
    ),
    settlement_rate = COALESCE(
      ROUND(
        (public.lawyer_analytics.settled_cases + EXCLUDED.settled_cases) * 100.0
        / NULLIF(
            (public.lawyer_analytics.won_cases + EXCLUDED.won_cases)
          + (public.lawyer_analytics.lost_cases + EXCLUDED.lost_cases)
          + (public.lawyer_analytics.settled_cases + EXCLUDED.settled_cases),
        0),
      2),
      0
    ),
    avg_case_duration_days = CASE
      WHEN (public.lawyer_analytics.duration_count + EXCLUDED.duration_count) > 0
      THEN ROUND(
        (public.lawyer_analytics.duration_sum_days + EXCLUDED.duration_sum_days)
        / (public.lawyer_analytics.duration_count + EXCLUDED.duration_count),
        2
      )
      ELSE 0
    END,
    updated_at = now();

  -- ===========================
  -- 2) JUDGE ANALYTICS
  -- ===========================
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
      unnest(
        CASE
          WHEN array_remove(bc.judges, NULL) <> '{}'::text[] THEN array_remove(bc.judges, NULL)
          ELSE ARRAY['Unknown Judge']::text[]
        END
      ) AS judge_name
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
    total_cases = public.judge_analytics.total_cases + EXCLUDED.total_cases,
    favor_complainant_cases = public.judge_analytics.favor_complainant_cases + EXCLUDED.favor_complainant_cases,
    favor_respondent_cases = public.judge_analytics.favor_respondent_cases + EXCLUDED.favor_respondent_cases,
    settled_cases = public.judge_analytics.settled_cases + EXCLUDED.settled_cases,
    dismissed_cases = public.judge_analytics.dismissed_cases + EXCLUDED.dismissed_cases,
    withdrawn_cases = public.judge_analytics.withdrawn_cases + EXCLUDED.withdrawn_cases,
    partially_granted_cases = public.judge_analytics.partially_granted_cases + EXCLUDED.partially_granted_cases,
    duration_sum_days = public.judge_analytics.duration_sum_days + EXCLUDED.duration_sum_days,
    duration_count = public.judge_analytics.duration_count + EXCLUDED.duration_count,
    favor_complainant_rate = COALESCE(
      ROUND(
        (public.judge_analytics.favor_complainant_cases + EXCLUDED.favor_complainant_cases) * 100.0
        / NULLIF(
            (public.judge_analytics.favor_complainant_cases + EXCLUDED.favor_complainant_cases)
          + (public.judge_analytics.favor_respondent_cases + EXCLUDED.favor_respondent_cases)
          + (public.judge_analytics.settled_cases + EXCLUDED.settled_cases),
        0),
      2),
      0
    ),
    favor_respondent_rate = COALESCE(
      ROUND(
        (public.judge_analytics.favor_respondent_cases + EXCLUDED.favor_respondent_cases) * 100.0
        / NULLIF(
            (public.judge_analytics.favor_complainant_cases + EXCLUDED.favor_complainant_cases)
          + (public.judge_analytics.favor_respondent_cases + EXCLUDED.favor_respondent_cases)
          + (public.judge_analytics.settled_cases + EXCLUDED.settled_cases),
        0),
      2),
      0
    ),
    settlement_rate = COALESCE(
      ROUND(
        (public.judge_analytics.settled_cases + EXCLUDED.settled_cases) * 100.0
        / NULLIF(
            (public.judge_analytics.favor_complainant_cases + EXCLUDED.favor_complainant_cases)
          + (public.judge_analytics.favor_respondent_cases + EXCLUDED.favor_respondent_cases)
          + (public.judge_analytics.settled_cases + EXCLUDED.settled_cases),
        0),
      2),
      0
    ),
    avg_case_duration_days = CASE
      WHEN (public.judge_analytics.duration_count + EXCLUDED.duration_count) > 0
      THEN ROUND(
        (public.judge_analytics.duration_sum_days + EXCLUDED.duration_sum_days)
        / (public.judge_analytics.duration_count + EXCLUDED.duration_count),
        2
      )
      ELSE 0
    END,
    updated_at = now();

  -- ===========================
  -- 3) COURT ANALYTICS
  -- ===========================
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
    total_cases = public.court_analytics.total_cases + EXCLUDED.total_cases,
    favor_complainant_cases = public.court_analytics.favor_complainant_cases + EXCLUDED.favor_complainant_cases,
    favor_respondent_cases = public.court_analytics.favor_respondent_cases + EXCLUDED.favor_respondent_cases,
    settled_cases = public.court_analytics.settled_cases + EXCLUDED.settled_cases,
    dismissed_cases = public.court_analytics.dismissed_cases + EXCLUDED.dismissed_cases,
    withdrawn_cases = public.court_analytics.withdrawn_cases + EXCLUDED.withdrawn_cases,
    partially_granted_cases = public.court_analytics.partially_granted_cases + EXCLUDED.partially_granted_cases,
    duration_sum_days = public.court_analytics.duration_sum_days + EXCLUDED.duration_sum_days,
    duration_count = public.court_analytics.duration_count + EXCLUDED.duration_count,
    settlement_rate = COALESCE(
      ROUND(
        (public.court_analytics.settled_cases + EXCLUDED.settled_cases) * 100.0
        / NULLIF(
            (public.court_analytics.favor_complainant_cases + EXCLUDED.favor_complainant_cases)
          + (public.court_analytics.favor_respondent_cases + EXCLUDED.favor_respondent_cases)
          + (public.court_analytics.settled_cases + EXCLUDED.settled_cases),
        0),
      2),
      0
    ),
    avg_case_duration_days = CASE
      WHEN (public.court_analytics.duration_count + EXCLUDED.duration_count) > 0
      THEN ROUND(
        (public.court_analytics.duration_sum_days + EXCLUDED.duration_sum_days)
        / (public.court_analytics.duration_count + EXCLUDED.duration_count),
        2
      )
      ELSE 0
    END,
    updated_at = now();

  -- ===========================
  -- 4) LAWYER vs JUDGE ANALYTICS
  -- ===========================
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
      unnest(
        CASE
          WHEN array_remove(bc.petitioner_lawyers, NULL) <> '{}'::text[] THEN array_remove(bc.petitioner_lawyers, NULL)
          ELSE ARRAY['Complainant without a lawyer']::text[]
        END
      ) AS lawyer_name,
      bc.judges
    FROM batch_cases bc
    UNION ALL
    SELECT
      bc.status,
      bc.norm_outcome,
      bc.duration_days,
      'Respondent'::text AS side,
      unnest(
        CASE
          WHEN array_remove(bc.respondent_lawyers, NULL) <> '{}'::text[] THEN array_remove(bc.respondent_lawyers, NULL)
          ELSE ARRAY['Respondent without a Lawyer']::text[]
        END
      ) AS lawyer_name,
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
      unnest(
        CASE
          WHEN array_remove(lr.judges, NULL) <> '{}'::text[] THEN array_remove(lr.judges, NULL)
          ELSE ARRAY['Unknown Judge']::text[]
        END
      ) AS judge_name
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
    total_cases = public.lawyer_judge_analytics.total_cases + EXCLUDED.total_cases,
    won_cases = public.lawyer_judge_analytics.won_cases + EXCLUDED.won_cases,
    lost_cases = public.lawyer_judge_analytics.lost_cases + EXCLUDED.lost_cases,
    settled_cases = public.lawyer_judge_analytics.settled_cases + EXCLUDED.settled_cases,
    duration_sum_days = public.lawyer_judge_analytics.duration_sum_days + EXCLUDED.duration_sum_days,
    duration_count = public.lawyer_judge_analytics.duration_count + EXCLUDED.duration_count,
    win_rate = COALESCE(
      ROUND(
        (public.lawyer_judge_analytics.won_cases + EXCLUDED.won_cases) * 100.0
        / NULLIF(
            (public.lawyer_judge_analytics.won_cases + EXCLUDED.won_cases)
          + (public.lawyer_judge_analytics.lost_cases + EXCLUDED.lost_cases)
          + (public.lawyer_judge_analytics.settled_cases + EXCLUDED.settled_cases),
        0),
      2),
      0
    ),
    avg_case_duration_days = CASE
      WHEN (public.lawyer_judge_analytics.duration_count + EXCLUDED.duration_count) > 0
      THEN ROUND(
        (public.lawyer_judge_analytics.duration_sum_days + EXCLUDED.duration_sum_days)
        / (public.lawyer_judge_analytics.duration_count + EXCLUDED.duration_count),
        2
      )
      ELSE 0
    END,
    updated_at = now();

  RETURN jsonb_build_object('ok', true, 'processed', v_processed);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_recalculate_analytics_for_case_numbers_wide(text[], boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_recalculate_analytics_for_case_numbers_wide(text[], boolean) TO authenticated;

-- Orchestrator for Table Analysis: only the 4 tables; no ranks, no full rebuilds.
CREATE OR REPLACE FUNCTION public.admin_run_table_analysis_wide(p_case_numbers text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  v_result := public.admin_recalculate_analytics_for_case_numbers_wide(p_case_numbers, false);
  RETURN jsonb_build_object('status', 'ok', 'analytics_4tables', v_result);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_run_table_analysis_wide(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_run_table_analysis_wide(text[]) TO authenticated;

COMMIT;

