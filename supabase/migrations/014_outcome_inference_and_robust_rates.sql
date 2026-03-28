-- 014_outcome_inference_and_robust_rates.sql
-- Improve outcome inference for real-world text values and recompute analytics correctly.

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_case_outcome(
  p_outcome text,
  p_status text DEFAULT NULL,
  p_summary text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := lower(trim(coalesce(p_outcome, '')));
  s text := lower(trim(coalesce(p_status, '')));
  m text := lower(trim(coalesce(p_summary, '')));
  blob text;
  t text;
BEGIN
  -- Strict rule: if `outcome` is not explicitly mentioned, do not count it.
  IF v = '' THEN
    RETURN NULL;
  END IF;
  blob := v;

  IF blob = '' THEN
    RETURN NULL;
  END IF;

  -- Canonicalize to improve matching across punctuation/extra words ("in favour of the respondent", etc.)
  t := regexp_replace(blob, '[^a-z0-9]+', ' ', 'g');
  t := regexp_replace(t, '\s+', ' ', 'g');
  t := btrim(t);

  IF t ~ 'in favou?r of( the)? respondent' OR t ~ 'in favou?r of( the)? defendant' OR t LIKE '%respondent won%' OR t LIKE '%against complainant%' THEN
    RETURN 'in favor of respondent';
  END IF;
  IF t ~ 'in favou?r of( the)? complainant' OR t ~ 'in favou?r of( the)? petitioner' OR t ~ 'in favou?r of( the)? plaintiff' OR t LIKE '%petitioner won%' OR t LIKE '%plaintiff won%' OR t LIKE '%against respondent%' THEN
    RETURN 'in favor of complainant';
  END IF;

  IF t LIKE '%settl%' OR t LIKE '%compromise%' OR t LIKE '%mutual%' OR t LIKE '%consent terms%' THEN
    RETURN 'settled';
  END IF;

  IF t LIKE '%withdraw%' OR t LIKE '%not press%' THEN
    RETURN 'withdrawn';
  END IF;

  IF t LIKE '%dismiss%' OR t LIKE '%rejected%' OR t LIKE '%not maintainable%' THEN
    RETURN 'dismissed';
  END IF;

  IF t LIKE '%partial%' OR t LIKE '%partly%' OR t LIKE '%in part%' OR t LIKE '%part granted%' THEN
    RETURN 'partially granted';
  END IF;

  IF t LIKE '%allowed%' OR t LIKE '%decreed%' THEN
    RETURN 'in favor of complainant';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_lawyer_result(
  p_side text,
  p_outcome text
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  side text := lower(coalesce(p_side, ''));
  outcome text := public.normalize_case_outcome(p_outcome, NULL, NULL);
  is_respondent boolean := side like '%respondent%' or side like '%defendant%' or side like '%accused%';
BEGIN
  IF outcome IS NULL THEN RETURN 'unknown'; END IF;
  IF outcome = 'settled' THEN RETURN 'settled'; END IF;
  IF outcome = 'partially granted' THEN RETURN 'unknown'; END IF;
  IF outcome = 'in favor of complainant' THEN
    RETURN CASE WHEN is_respondent THEN 'lost' ELSE 'won' END;
  END IF;
  IF outcome = 'in favor of respondent' THEN
    RETURN CASE WHEN is_respondent THEN 'won' ELSE 'lost' END;
  END IF;
  RETURN 'unknown';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_recalculate_analytics_batch(
  p_batch_size integer DEFAULT 500,
  p_offset integer DEFAULT 0,
  p_reset boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch_size integer := GREATEST(1, LEAST(COALESCE(p_batch_size, 500), 2000));
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_processed integer := 0;
  v_has_more boolean := false;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_reset THEN
    TRUNCATE TABLE public.lawyer_analytics;
    TRUNCATE TABLE public.judge_analytics;
    TRUNCATE TABLE public.court_analytics;
    TRUNCATE TABLE public.lawyer_judge_analytics;
  END IF;

  WITH batch AS (
    SELECT
      c.lawyer_id,
      c.judge_id,
      c.court_id,
      c.lawyer_side,
      c.outcome,
      c.status,
      c.summary,
      c.filing_date,
      c.judgment_date,
      public.normalize_case_outcome(c.outcome, c.status, c.summary) AS norm_outcome
    FROM public.cases c
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
    LIMIT v_batch_size OFFSET v_offset
  )
  SELECT COUNT(*)::int INTO v_processed FROM batch;

  WITH batch AS (
    SELECT
      c.lawyer_id,
      c.judge_id,
      c.court_id,
      c.lawyer_side,
      c.outcome,
      c.status,
      c.summary,
      c.filing_date,
      c.judgment_date,
      public.normalize_case_outcome(c.outcome, c.status, c.summary) AS norm_outcome
    FROM public.cases c
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
    LIMIT v_batch_size OFFSET v_offset
  )
  INSERT INTO public.lawyer_analytics (
    lawyer_id, lawyer_name, total_cases, won_cases, lost_cases, settled_cases,
    dismissed_cases, withdrawn_cases, partially_granted_cases,
    win_rate, loss_rate, settlement_rate,
    avg_case_duration_days, duration_sum_days, duration_count, updated_at
  )
  SELECT
    l.id,
    l.name,
    COUNT(*) FILTER (WHERE b.norm_outcome IN ('in favor of complainant', 'in favor of respondent', 'settled'))::int,
    COUNT(*) FILTER (WHERE public.compute_lawyer_result(b.lawyer_side, b.norm_outcome) = 'won')::int,
    COUNT(*) FILTER (WHERE public.compute_lawyer_result(b.lawyer_side, b.norm_outcome) = 'lost')::int,
    COUNT(*) FILTER (WHERE public.compute_lawyer_result(b.lawyer_side, b.norm_outcome) = 'settled')::int,
    COUNT(*) FILTER (WHERE b.norm_outcome = 'dismissed')::int,
    COUNT(*) FILTER (WHERE b.norm_outcome = 'withdrawn')::int,
    COUNT(*) FILTER (WHERE b.norm_outcome = 'partially granted')::int,
    0, 0, 0,
    0,
    COALESCE(SUM(CASE WHEN b.filing_date IS NOT NULL AND b.judgment_date IS NOT NULL THEN (b.judgment_date - b.filing_date)::numeric END), 0),
    COUNT(*) FILTER (WHERE b.filing_date IS NOT NULL AND b.judgment_date IS NOT NULL)::int,
    now()
  FROM batch b
  JOIN public.lawyers l ON b.lawyer_id = l.id
  GROUP BY l.id, l.name
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
    win_rate = COALESCE(ROUND(((public.lawyer_analytics.won_cases + EXCLUDED.won_cases) * 100.0) / NULLIF((public.lawyer_analytics.won_cases + EXCLUDED.won_cases + public.lawyer_analytics.lost_cases + EXCLUDED.lost_cases + public.lawyer_analytics.settled_cases + EXCLUDED.settled_cases), 0), 2), 0),
    loss_rate = COALESCE(ROUND(((public.lawyer_analytics.lost_cases + EXCLUDED.lost_cases) * 100.0) / NULLIF((public.lawyer_analytics.won_cases + EXCLUDED.won_cases + public.lawyer_analytics.lost_cases + EXCLUDED.lost_cases + public.lawyer_analytics.settled_cases + EXCLUDED.settled_cases), 0), 2), 0),
    settlement_rate = COALESCE(ROUND(((public.lawyer_analytics.settled_cases + EXCLUDED.settled_cases) * 100.0) / NULLIF((public.lawyer_analytics.won_cases + EXCLUDED.won_cases + public.lawyer_analytics.lost_cases + EXCLUDED.lost_cases + public.lawyer_analytics.settled_cases + EXCLUDED.settled_cases), 0), 2), 0),
    avg_case_duration_days = CASE
      WHEN (public.lawyer_analytics.duration_count + EXCLUDED.duration_count) > 0
      THEN ROUND((public.lawyer_analytics.duration_sum_days + EXCLUDED.duration_sum_days) / (public.lawyer_analytics.duration_count + EXCLUDED.duration_count), 2)
      ELSE 0
    END,
    updated_at = now();

  WITH batch AS (
    SELECT
      c.judge_id,
      c.outcome,
      c.status,
      c.summary,
      c.filing_date,
      c.judgment_date,
      public.normalize_case_outcome(c.outcome, c.status, c.summary) AS norm_outcome
    FROM public.cases c
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
    LIMIT v_batch_size OFFSET v_offset
  )
  INSERT INTO public.judge_analytics (
    judge_id, judge_name, total_cases, favor_complainant_cases, favor_respondent_cases,
    settled_cases, dismissed_cases, withdrawn_cases, partially_granted_cases,
    favor_complainant_rate, favor_respondent_rate, settlement_rate,
    avg_case_duration_days, duration_sum_days, duration_count, updated_at
  )
  SELECT
    j.id,
    j.name,
    COUNT(*) FILTER (WHERE b.norm_outcome IN ('in favor of complainant', 'in favor of respondent', 'settled'))::int,
    COUNT(*) FILTER (WHERE b.norm_outcome = 'in favor of complainant')::int,
    COUNT(*) FILTER (WHERE b.norm_outcome IN ('in favor of respondent', 'dismissed', 'withdrawn'))::int,
    COUNT(*) FILTER (WHERE b.norm_outcome = 'settled')::int,
    COUNT(*) FILTER (WHERE b.norm_outcome = 'dismissed')::int,
    COUNT(*) FILTER (WHERE b.norm_outcome = 'withdrawn')::int,
    COUNT(*) FILTER (WHERE b.norm_outcome = 'partially granted')::int,
    0, 0, 0,
    0,
    COALESCE(SUM(CASE WHEN b.filing_date IS NOT NULL AND b.judgment_date IS NOT NULL THEN (b.judgment_date - b.filing_date)::numeric END), 0),
    COUNT(*) FILTER (WHERE b.filing_date IS NOT NULL AND b.judgment_date IS NOT NULL)::int,
    now()
  FROM batch b
  JOIN public.judges j ON b.judge_id = j.id
  GROUP BY j.id, j.name
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
    favor_complainant_rate = COALESCE(ROUND(((public.judge_analytics.favor_complainant_cases + EXCLUDED.favor_complainant_cases) * 100.0) / NULLIF((public.judge_analytics.favor_complainant_cases + EXCLUDED.favor_complainant_cases + public.judge_analytics.favor_respondent_cases + EXCLUDED.favor_respondent_cases + public.judge_analytics.settled_cases + EXCLUDED.settled_cases), 0), 2), 0),
    favor_respondent_rate = COALESCE(ROUND(((public.judge_analytics.favor_respondent_cases + EXCLUDED.favor_respondent_cases) * 100.0) / NULLIF((public.judge_analytics.favor_complainant_cases + EXCLUDED.favor_complainant_cases + public.judge_analytics.favor_respondent_cases + EXCLUDED.favor_respondent_cases + public.judge_analytics.settled_cases + EXCLUDED.settled_cases), 0), 2), 0),
    settlement_rate = COALESCE(ROUND(((public.judge_analytics.settled_cases + EXCLUDED.settled_cases) * 100.0) / NULLIF((public.judge_analytics.favor_complainant_cases + EXCLUDED.favor_complainant_cases + public.judge_analytics.favor_respondent_cases + EXCLUDED.favor_respondent_cases + public.judge_analytics.settled_cases + EXCLUDED.settled_cases), 0), 2), 0),
    avg_case_duration_days = CASE
      WHEN (public.judge_analytics.duration_count + EXCLUDED.duration_count) > 0
      THEN ROUND((public.judge_analytics.duration_sum_days + EXCLUDED.duration_sum_days) / (public.judge_analytics.duration_count + EXCLUDED.duration_count), 2)
      ELSE 0
    END,
    updated_at = now();

  WITH batch AS (
    SELECT
      c.court_id,
      c.outcome,
      c.status,
      c.summary,
      c.filing_date,
      c.judgment_date,
      public.normalize_case_outcome(c.outcome, c.status, c.summary) AS norm_outcome
    FROM public.cases c
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
    LIMIT v_batch_size OFFSET v_offset
  )
  INSERT INTO public.court_analytics (
    court_id, court_name, total_cases, favor_complainant_cases, favor_respondent_cases,
    settled_cases, dismissed_cases, withdrawn_cases, partially_granted_cases,
    settlement_rate, avg_case_duration_days, duration_sum_days, duration_count, updated_at
  )
  SELECT
    co.id,
    co.name,
    COUNT(*) FILTER (WHERE b.norm_outcome IN ('in favor of complainant', 'in favor of respondent', 'settled'))::int,
    COUNT(*) FILTER (WHERE b.norm_outcome = 'in favor of complainant')::int,
    COUNT(*) FILTER (WHERE b.norm_outcome IN ('in favor of respondent', 'dismissed', 'withdrawn'))::int,
    COUNT(*) FILTER (WHERE b.norm_outcome = 'settled')::int,
    COUNT(*) FILTER (WHERE b.norm_outcome = 'dismissed')::int,
    COUNT(*) FILTER (WHERE b.norm_outcome = 'withdrawn')::int,
    COUNT(*) FILTER (WHERE b.norm_outcome = 'partially granted')::int,
    0, 0, 0, 0,
    now()
  FROM batch b
  JOIN public.courts co ON b.court_id = co.id
  GROUP BY co.id, co.name
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
    settlement_rate = COALESCE(ROUND(((public.court_analytics.settled_cases + EXCLUDED.settled_cases) * 100.0) / NULLIF((public.court_analytics.favor_complainant_cases + EXCLUDED.favor_complainant_cases + public.court_analytics.favor_respondent_cases + EXCLUDED.favor_respondent_cases + public.court_analytics.settled_cases + EXCLUDED.settled_cases), 0), 2), 0),
    avg_case_duration_days = CASE
      WHEN (public.court_analytics.duration_count + EXCLUDED.duration_count) > 0
      THEN ROUND((public.court_analytics.duration_sum_days + EXCLUDED.duration_sum_days) / (public.court_analytics.duration_count + EXCLUDED.duration_count), 2)
      ELSE 0
    END,
    updated_at = now();

  WITH batch AS (
    SELECT
      c.lawyer_id,
      c.judge_id,
      c.lawyer_side,
      c.outcome,
      c.status,
      c.summary,
      c.filing_date,
      c.judgment_date,
      public.normalize_case_outcome(c.outcome, c.status, c.summary) AS norm_outcome
    FROM public.cases c
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
    LIMIT v_batch_size OFFSET v_offset
  )
  INSERT INTO public.lawyer_judge_analytics (
    lawyer_id, judge_id, lawyer_name, judge_name, total_cases, won_cases, lost_cases,
    settled_cases, win_rate, avg_case_duration_days, duration_sum_days, duration_count, updated_at
  )
  SELECT
    l.id,
    j.id,
    l.name,
    j.name,
    COUNT(*) FILTER (WHERE b.norm_outcome IN ('in favor of complainant', 'in favor of respondent', 'settled'))::int,
    COUNT(*) FILTER (WHERE public.compute_lawyer_result(b.lawyer_side, b.norm_outcome) = 'won')::int,
    COUNT(*) FILTER (WHERE public.compute_lawyer_result(b.lawyer_side, b.norm_outcome) = 'lost')::int,
    COUNT(*) FILTER (WHERE public.compute_lawyer_result(b.lawyer_side, b.norm_outcome) = 'settled')::int,
    0, 0,
    COALESCE(SUM(CASE WHEN b.filing_date IS NOT NULL AND b.judgment_date IS NOT NULL THEN (b.judgment_date - b.filing_date)::numeric END), 0),
    COUNT(*) FILTER (WHERE b.filing_date IS NOT NULL AND b.judgment_date IS NOT NULL)::int,
    now()
  FROM batch b
  JOIN public.lawyers l ON b.lawyer_id = l.id
  JOIN public.judges j ON b.judge_id = j.id
  GROUP BY l.id, l.name, j.id, j.name
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
    win_rate = COALESCE(ROUND(((public.lawyer_judge_analytics.won_cases + EXCLUDED.won_cases) * 100.0) / NULLIF((public.lawyer_judge_analytics.won_cases + EXCLUDED.won_cases + public.lawyer_judge_analytics.lost_cases + EXCLUDED.lost_cases + public.lawyer_judge_analytics.settled_cases + EXCLUDED.settled_cases), 0), 2), 0),
    avg_case_duration_days = CASE
      WHEN (public.lawyer_judge_analytics.duration_count + EXCLUDED.duration_count) > 0
      THEN ROUND((public.lawyer_judge_analytics.duration_sum_days + EXCLUDED.duration_sum_days) / (public.lawyer_judge_analytics.duration_count + EXCLUDED.duration_count), 2)
      ELSE 0
    END,
    updated_at = now();

  SELECT EXISTS (
    SELECT 1
    FROM public.cases c
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
    LIMIT 1 OFFSET (v_offset + v_batch_size)
  ) INTO v_has_more;

  RETURN jsonb_build_object(
    'ok', true,
    'processed', v_processed,
    'has_more', v_has_more,
    'next_offset', v_offset + v_batch_size
  );
END;
$$;

COMMIT;
