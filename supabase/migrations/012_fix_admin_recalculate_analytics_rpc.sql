-- 012_fix_admin_recalculate_analytics_rpc.sql
-- Ensure admin_recalculate_analytics RPC exists with no-arg signature
-- and remains compatible with legacy callers that may pass one boolean.

BEGIN;

CREATE TABLE IF NOT EXISTS public.lawyer_analytics (
  lawyer_id uuid PRIMARY KEY REFERENCES public.lawyers(id) ON DELETE CASCADE,
  lawyer_name text NOT NULL,
  total_cases integer NOT NULL DEFAULT 0,
  won_cases integer NOT NULL DEFAULT 0,
  lost_cases integer NOT NULL DEFAULT 0,
  settled_cases integer NOT NULL DEFAULT 0,
  dismissed_cases integer NOT NULL DEFAULT 0,
  withdrawn_cases integer NOT NULL DEFAULT 0,
  partially_granted_cases integer NOT NULL DEFAULT 0,
  win_rate numeric(5,2) NOT NULL DEFAULT 0,
  loss_rate numeric(5,2) NOT NULL DEFAULT 0,
  settlement_rate numeric(5,2) NOT NULL DEFAULT 0,
  avg_case_duration_days numeric(10,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.judge_analytics (
  judge_id uuid PRIMARY KEY REFERENCES public.judges(id) ON DELETE CASCADE,
  judge_name text NOT NULL,
  total_cases integer NOT NULL DEFAULT 0,
  favor_complainant_cases integer NOT NULL DEFAULT 0,
  favor_respondent_cases integer NOT NULL DEFAULT 0,
  settled_cases integer NOT NULL DEFAULT 0,
  dismissed_cases integer NOT NULL DEFAULT 0,
  withdrawn_cases integer NOT NULL DEFAULT 0,
  partially_granted_cases integer NOT NULL DEFAULT 0,
  favor_complainant_rate numeric(5,2) NOT NULL DEFAULT 0,
  favor_respondent_rate numeric(5,2) NOT NULL DEFAULT 0,
  settlement_rate numeric(5,2) NOT NULL DEFAULT 0,
  avg_case_duration_days numeric(10,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.court_analytics (
  court_id uuid PRIMARY KEY REFERENCES public.courts(id) ON DELETE CASCADE,
  court_name text NOT NULL,
  total_cases integer NOT NULL DEFAULT 0,
  favor_complainant_cases integer NOT NULL DEFAULT 0,
  favor_respondent_cases integer NOT NULL DEFAULT 0,
  settled_cases integer NOT NULL DEFAULT 0,
  dismissed_cases integer NOT NULL DEFAULT 0,
  withdrawn_cases integer NOT NULL DEFAULT 0,
  partially_granted_cases integer NOT NULL DEFAULT 0,
  settlement_rate numeric(5,2) NOT NULL DEFAULT 0,
  avg_case_duration_days numeric(10,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lawyer_judge_analytics (
  lawyer_id uuid NOT NULL REFERENCES public.lawyers(id) ON DELETE CASCADE,
  judge_id uuid NOT NULL REFERENCES public.judges(id) ON DELETE CASCADE,
  lawyer_name text NOT NULL,
  judge_name text NOT NULL,
  total_cases integer NOT NULL DEFAULT 0,
  won_cases integer NOT NULL DEFAULT 0,
  lost_cases integer NOT NULL DEFAULT 0,
  settled_cases integer NOT NULL DEFAULT 0,
  win_rate numeric(5,2) NOT NULL DEFAULT 0,
  avg_case_duration_days numeric(10,2) NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lawyer_id, judge_id)
);

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
  outcome text := lower(coalesce(p_outcome, ''));
  is_respondent boolean := side like '%respondent%' or side like '%defendant%' or side like '%accused%';
BEGIN
  IF outcome = '' THEN RETURN 'unknown'; END IF;
  IF outcome = 'settled' THEN RETURN 'settled'; END IF;
  IF outcome = 'partially granted' THEN RETURN 'partial'; END IF;
  IF outcome = 'in favor of complainant' THEN
    RETURN CASE WHEN is_respondent THEN 'lost' ELSE 'won' END;
  END IF;
  IF outcome = 'in favor of respondent' OR outcome = 'dismissed' OR outcome = 'withdrawn' THEN
    RETURN CASE WHEN is_respondent THEN 'won' ELSE 'lost' END;
  END IF;
  RETURN 'unknown';
END;
$$;

DROP FUNCTION IF EXISTS public.admin_recalculate_analytics(boolean);

CREATE OR REPLACE FUNCTION public.admin_recalculate_analytics()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lawyers int := 0;
  v_judges int := 0;
  v_courts int := 0;
  v_pairs int := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin_user')
     AND NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  TRUNCATE TABLE public.lawyer_analytics;
  TRUNCATE TABLE public.judge_analytics;
  TRUNCATE TABLE public.court_analytics;
  TRUNCATE TABLE public.lawyer_judge_analytics;

  INSERT INTO public.lawyer_analytics (
    lawyer_id, lawyer_name, total_cases, won_cases, lost_cases, settled_cases,
    dismissed_cases, withdrawn_cases, partially_granted_cases,
    win_rate, loss_rate, settlement_rate, avg_case_duration_days, updated_at
  )
  SELECT
    l.id,
    l.name,
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE public.compute_lawyer_result(c.lawyer_side, c.outcome) = 'won')::int,
    COUNT(*) FILTER (WHERE public.compute_lawyer_result(c.lawyer_side, c.outcome) = 'lost')::int,
    COUNT(*) FILTER (WHERE public.compute_lawyer_result(c.lawyer_side, c.outcome) = 'settled')::int,
    COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'dismissed')::int,
    COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'withdrawn')::int,
    COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'partially granted')::int,
    ROUND((COUNT(*) FILTER (WHERE public.compute_lawyer_result(c.lawyer_side, c.outcome) = 'won') * 100.0) / NULLIF(COUNT(*), 0), 2),
    ROUND((COUNT(*) FILTER (WHERE public.compute_lawyer_result(c.lawyer_side, c.outcome) = 'lost') * 100.0) / NULLIF(COUNT(*), 0), 2),
    ROUND((COUNT(*) FILTER (WHERE public.compute_lawyer_result(c.lawyer_side, c.outcome) = 'settled') * 100.0) / NULLIF(COUNT(*), 0), 2),
    COALESCE(ROUND(AVG(CASE WHEN c.filing_date IS NOT NULL AND c.judgment_date IS NOT NULL THEN (c.judgment_date - c.filing_date)::numeric END), 2), 0),
    now()
  FROM public.cases c
  JOIN public.lawyers l ON c.lawyer_id = l.id
  GROUP BY l.id, l.name;
  GET DIAGNOSTICS v_lawyers = ROW_COUNT;

  INSERT INTO public.judge_analytics (
    judge_id, judge_name, total_cases, favor_complainant_cases, favor_respondent_cases,
    settled_cases, dismissed_cases, withdrawn_cases, partially_granted_cases,
    favor_complainant_rate, favor_respondent_rate, settlement_rate, avg_case_duration_days, updated_at
  )
  SELECT
    j.id,
    j.name,
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'in favor of complainant')::int,
    COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) IN ('in favor of respondent', 'dismissed', 'withdrawn'))::int,
    COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'settled')::int,
    COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'dismissed')::int,
    COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'withdrawn')::int,
    COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'partially granted')::int,
    ROUND((COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'in favor of complainant') * 100.0) / NULLIF(COUNT(*), 0), 2),
    ROUND((COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) IN ('in favor of respondent', 'dismissed', 'withdrawn')) * 100.0) / NULLIF(COUNT(*), 0), 2),
    ROUND((COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'settled') * 100.0) / NULLIF(COUNT(*), 0), 2),
    COALESCE(ROUND(AVG(CASE WHEN c.filing_date IS NOT NULL AND c.judgment_date IS NOT NULL THEN (c.judgment_date - c.filing_date)::numeric END), 2), 0),
    now()
  FROM public.cases c
  JOIN public.judges j ON c.judge_id = j.id
  GROUP BY j.id, j.name;
  GET DIAGNOSTICS v_judges = ROW_COUNT;

  INSERT INTO public.court_analytics (
    court_id, court_name, total_cases, favor_complainant_cases, favor_respondent_cases,
    settled_cases, dismissed_cases, withdrawn_cases, partially_granted_cases,
    settlement_rate, avg_case_duration_days, updated_at
  )
  SELECT
    co.id,
    co.name,
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'in favor of complainant')::int,
    COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) IN ('in favor of respondent', 'dismissed', 'withdrawn'))::int,
    COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'settled')::int,
    COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'dismissed')::int,
    COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'withdrawn')::int,
    COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'partially granted')::int,
    ROUND((COUNT(*) FILTER (WHERE lower(coalesce(c.outcome, '')) = 'settled') * 100.0) / NULLIF(COUNT(*), 0), 2),
    COALESCE(ROUND(AVG(CASE WHEN c.filing_date IS NOT NULL AND c.judgment_date IS NOT NULL THEN (c.judgment_date - c.filing_date)::numeric END), 2), 0),
    now()
  FROM public.cases c
  JOIN public.courts co ON c.court_id = co.id
  GROUP BY co.id, co.name;
  GET DIAGNOSTICS v_courts = ROW_COUNT;

  INSERT INTO public.lawyer_judge_analytics (
    lawyer_id, judge_id, lawyer_name, judge_name,
    total_cases, won_cases, lost_cases, settled_cases,
    win_rate, avg_case_duration_days, updated_at
  )
  SELECT
    l.id,
    j.id,
    l.name,
    j.name,
    COUNT(*)::int,
    COUNT(*) FILTER (WHERE public.compute_lawyer_result(c.lawyer_side, c.outcome) = 'won')::int,
    COUNT(*) FILTER (WHERE public.compute_lawyer_result(c.lawyer_side, c.outcome) = 'lost')::int,
    COUNT(*) FILTER (WHERE public.compute_lawyer_result(c.lawyer_side, c.outcome) = 'settled')::int,
    ROUND((COUNT(*) FILTER (WHERE public.compute_lawyer_result(c.lawyer_side, c.outcome) = 'won') * 100.0) / NULLIF(COUNT(*), 0), 2),
    COALESCE(ROUND(AVG(CASE WHEN c.filing_date IS NOT NULL AND c.judgment_date IS NOT NULL THEN (c.judgment_date - c.filing_date)::numeric END), 2), 0),
    now()
  FROM public.cases c
  JOIN public.lawyers l ON c.lawyer_id = l.id
  JOIN public.judges j ON c.judge_id = j.id
  GROUP BY l.id, l.name, j.id, j.name;
  GET DIAGNOSTICS v_pairs = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'lawyer_analytics_rows', v_lawyers,
    'judge_analytics_rows', v_judges,
    'court_analytics_rows', v_courts,
    'lawyer_judge_analytics_rows', v_pairs
  );
END;
$$;

-- Compatibility overload for callers that pass one boolean argument.
CREATE OR REPLACE FUNCTION public.admin_recalculate_analytics(p_rebuild boolean)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT public.admin_recalculate_analytics();
$$;

GRANT EXECUTE ON FUNCTION public.admin_recalculate_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recalculate_analytics(boolean) TO authenticated;

COMMIT;
