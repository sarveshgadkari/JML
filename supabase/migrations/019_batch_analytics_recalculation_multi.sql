-- 019_batch_analytics_recalculation_multi.sql
-- Recalculate analytics using multi-valued JSONB fields:
--   cases.petitioner_lawyers, cases.respondent_lawyers, cases.judges
-- Each listed lawyer/judge receives the win/loss/settled and duration based on the case outcome.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_recalculate_analytics_batch_multi(
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

  /* WITH batch_cases AS (
    SELECT
      c.id AS case_id,
      c.court_id,
      c.court_name,
      c.outcome,
      c.status,
      c.summary,
      c.filing_date,
      c.judgment_date,
      c.petitioner_lawyers,
      c.respondent_lawyers,
      c.judges
    FROM public.cases c
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
    LIMIT v_batch_size OFFSET v_offset
  )
  SELECT COUNT(*)::int INTO v_processed FROM batch_cases;

  -- =====================================================
  -- Lawyer analytics (aggregate over all listed lawyers)
  -- =====================================================
  WITH batch_cases AS (
    SELECT
      c.id AS case_id,
      c.court_id,
      c.court_name,
      public.normalize_case_outcome(c.outcome, c.status, c.summary) AS norm_outcome,
      CASE
        WHEN c.filing_date IS NOT NULL AND c.judgment_date IS NOT NULL THEN (c.judgment_date - c.filing_date)::numeric
        ELSE NULL
      END AS duration_days,
      c.petitioner_lawyers,
      c.respondent_lawyers
    FROM public.cases c
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
    LIMIT v_batch_size OFFSET v_offset
  ),
  lawyer_instances AS (
    -- petitioner side
    SELECT
      bc.case_id,
      bc.norm_outcome,
      bc.duration_days,
      'Petitioner'::text AS lawyer_side,
      trim(elem) AS lawyer_name
    FROM batch_cases bc
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN bc.petitioner_lawyers IS NOT NULL AND jsonb_array_length(bc.petitioner_lawyers) > 0 THEN bc.petitioner_lawyers
        ELSE to_jsonb(ARRAY['Complainant without a lawyer']::text[])
      END
    ) elem

    UNION ALL

    -- respondent side
    SELECT
      bc.case_id,
      bc.norm_outcome,
      bc.duration_days,
      'Respondent'::text AS lawyer_side,
      trim(elem) AS lawyer_name
    FROM batch_cases bc
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN bc.respondent_lawyers IS NOT NULL AND jsonb_array_length(bc.respondent_lawyers) > 0 THEN bc.respondent_lawyers
        ELSE to_jsonb(ARRAY['Respondent without a Lawyer']::text[])
      END
    ) elem
  ),
  mapped AS (
    SELECT
      li.lawyer_side,
      COALESCE(lm.lawyer_id, lp.lawyer_id) AS lawyer_id,
      COALESCE(lm.lawyer_name, lp.lawyer_name) AS lawyer_name,
      li.norm_outcome,
      li.duration_days
    FROM lawyer_instances li
    LEFT JOIN LATERAL (
      SELECT l.id AS lawyer_id, l.name AS lawyer_name
      FROM public.lawyers l
      WHERE public.canonical_person_name(l.name) = public.canonical_person_name(li.lawyer_name)
        AND btrim(li.lawyer_name) <> ''
      ORDER BY (l.user_id IS NOT NULL) DESC, l.created_at ASC NULLS LAST, l.id ASC
      LIMIT 1
    ) lm ON true
    LEFT JOIN LATERAL (
      SELECT l.id AS lawyer_id, l.name AS lawyer_name
      FROM public.lawyers l
      WHERE lower(l.name) = lower(
        CASE WHEN li.lawyer_side = 'Respondent' THEN 'Respondent without a Lawyer' ELSE 'Complainant without a lawyer' END
      )
      ORDER BY l.created_at ASC NULLS LAST, l.id ASC
      LIMIT 1
    ) lp ON true
    WHERE COALESCE(lm.lawyer_id, lp.lawyer_id) IS NOT NULL
  ),
  agg AS (
    SELECT
      m.lawyer_id,
      m.lawyer_name,
      COUNT(*) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled'))::int AS total_cases,
      COUNT(*) FILTER (
        WHERE (m.norm_outcome = 'in favor of complainant' AND m.lawyer_side = 'Petitioner')
           OR (m.norm_outcome = 'in favor of respondent' AND m.lawyer_side = 'Respondent')
      )::int AS won_cases,
      COUNT(*) FILTER (
        WHERE (m.norm_outcome = 'in favor of complainant' AND m.lawyer_side = 'Respondent')
           OR (m.norm_outcome = 'in favor of respondent' AND m.lawyer_side = 'Petitioner')
      )::int AS lost_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'settled')::int AS settled_cases,
      0::int AS dismissed_cases,
      0::int AS withdrawn_cases,
      0::int AS partially_granted_cases,
      COALESCE(SUM(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0) AS duration_sum_days,
      COALESCE(COUNT(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0)::int AS duration_count
    FROM mapped m
    GROUP BY m.lawyer_id, m.lawyer_name
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
        / NULLIF((public.lawyer_analytics.won_cases + EXCLUDED.won_cases)
                + (public.lawyer_analytics.lost_cases + EXCLUDED.lost_cases)
                + (public.lawyer_analytics.settled_cases + EXCLUDED.settled_cases), 0),
      2),
      0
    ),
    loss_rate = COALESCE(
      ROUND(
        (public.lawyer_analytics.lost_cases + EXCLUDED.lost_cases) * 100.0
        / NULLIF((public.lawyer_analytics.won_cases + EXCLUDED.won_cases)
                + (public.lawyer_analytics.lost_cases + EXCLUDED.lost_cases)
                + (public.lawyer_analytics.settled_cases + EXCLUDED.settled_cases), 0),
      2),
      0
    ),
    settlement_rate = COALESCE(
      ROUND(
        (public.lawyer_analytics.settled_cases + EXCLUDED.settled_cases) * 100.0
        / NULLIF((public.lawyer_analytics.won_cases + EXCLUDED.won_cases)
                + (public.lawyer_analytics.lost_cases + EXCLUDED.lost_cases)
                + (public.lawyer_analytics.settled_cases + EXCLUDED.settled_cases), 0),
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

  -- =====================================================
  -- Judge analytics (aggregate over all listed judges)
  -- =====================================================
  WITH batch_cases AS (
    SELECT
      c.id AS case_id,
      public.normalize_case_outcome(c.outcome, c.status, c.summary) AS norm_outcome,
      CASE
        WHEN c.filing_date IS NOT NULL AND c.judgment_date IS NOT NULL THEN (c.judgment_date - c.filing_date)::numeric
        ELSE NULL
      END AS duration_days,
      c.judges
    FROM public.cases c
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
    LIMIT v_batch_size OFFSET v_offset
  ),
  judge_instances AS (
    SELECT
      bc.case_id,
      bc.norm_outcome,
      bc.duration_days,
      trim(elem) AS judge_name
    FROM batch_cases bc
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN bc.judges IS NOT NULL AND jsonb_array_length(bc.judges) > 0 THEN bc.judges
        ELSE to_jsonb(ARRAY['Unknown Judge']::text[])
      END
    ) elem
  ),
  mapped AS (
    SELECT
      COALESCE(jm.judge_id, jp.judge_id) AS judge_id,
      COALESCE(jm.judge_name, jp.judge_name) AS judge_name,
      ji.norm_outcome,
      ji.duration_days
    FROM judge_instances ji
    LEFT JOIN LATERAL (
      SELECT j.id AS judge_id, j.name AS judge_name
      FROM public.judges j
      WHERE public.canonical_person_name(j.name) = public.canonical_person_name(ji.judge_name)
        AND btrim(ji.judge_name) <> ''
      ORDER BY j.created_at ASC NULLS LAST, j.id ASC
      LIMIT 1
    ) jm ON true
    LEFT JOIN LATERAL (
      SELECT j.id AS judge_id, j.name AS judge_name
      FROM public.judges j
      WHERE lower(j.name) = lower('Unknown Judge')
      ORDER BY j.created_at ASC NULLS LAST, j.id ASC
      LIMIT 1
    ) jp ON true
    WHERE COALESCE(jm.judge_id, jp.judge_id) IS NOT NULL
  ),
  agg AS (
    SELECT
      m.judge_id,
      m.judge_name,
      COUNT(*) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled'))::int AS total_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'in favor of complainant')::int AS favor_complainant_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'in favor of respondent')::int AS favor_respondent_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'settled')::int AS settled_cases,
      0::int AS dismissed_cases,
      0::int AS withdrawn_cases,
      0::int AS partially_granted_cases,
      COALESCE(SUM(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0) AS duration_sum_days,
      COALESCE(COUNT(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0)::int AS duration_count
    FROM mapped m
    GROUP BY m.judge_id, m.judge_name
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

  -- =====================================================
  -- Court analytics (one per case)
  -- =====================================================
  WITH batch_cases AS (
    SELECT
      c.id AS case_id,
      c.court_id,
      c.court_name,
      public.normalize_case_outcome(c.outcome, c.status, c.summary) AS norm_outcome,
      CASE
        WHEN c.filing_date IS NOT NULL AND c.judgment_date IS NOT NULL THEN (c.judgment_date - c.filing_date)::numeric
        ELSE NULL
      END AS duration_days
    FROM public.cases c
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
    LIMIT v_batch_size OFFSET v_offset
  ),
  mapped AS (
    SELECT
      co.id AS court_id,
      co.name AS court_name,
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
      m.court_name,
      COUNT(*) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled'))::int AS total_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'in favor of complainant')::int AS favor_complainant_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'in favor of respondent')::int AS favor_respondent_cases,
      COUNT(*) FILTER (WHERE m.norm_outcome = 'settled')::int AS settled_cases,
      0::int AS dismissed_cases,
      0::int AS withdrawn_cases,
      0::int AS partially_granted_cases,
      COALESCE(SUM(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0) AS duration_sum_days,
      COALESCE(COUNT(m.duration_days) FILTER (WHERE m.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND m.duration_days IS NOT NULL), 0)::int AS duration_count
    FROM mapped m
    GROUP BY m.court_id, m.court_name
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

  -- =====================================================
  -- Lawyer-vs-judge analytics (pairs of all listed lawyers x listed judges)
  -- =====================================================
  WITH batch_cases AS (
    SELECT
      c.id AS case_id,
      public.normalize_case_outcome(c.outcome, c.status, c.summary) AS norm_outcome,
      CASE
        WHEN c.filing_date IS NOT NULL AND c.judgment_date IS NOT NULL THEN (c.judgment_date - c.filing_date)::numeric
        ELSE NULL
      END AS duration_days,
      c.petitioner_lawyers,
      c.respondent_lawyers,
      c.judges
    FROM public.cases c
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
    LIMIT v_batch_size OFFSET v_offset
  ),
  mapped_lawyers AS (
    -- petitioner lawyers
    SELECT
      bc.case_id,
      'Petitioner'::text AS lawyer_side,
      lm.lawyer_id,
      lm.lawyer_name,
      bc.norm_outcome,
      bc.duration_days
    FROM batch_cases bc
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN bc.petitioner_lawyers IS NOT NULL AND jsonb_array_length(bc.petitioner_lawyers) > 0 THEN bc.petitioner_lawyers
        ELSE to_jsonb(ARRAY['Complainant without a lawyer']::text[])
      END
    ) elem
    LEFT JOIN LATERAL (
      SELECT l.id AS lawyer_id, l.name AS lawyer_name
      FROM public.lawyers l
      WHERE public.canonical_person_name(l.name) = public.canonical_person_name(trim(elem))
        AND btrim(trim(elem)) <> ''
      ORDER BY (l.user_id IS NOT NULL) DESC, l.created_at ASC NULLS LAST, l.id ASC
      LIMIT 1
    ) lm ON true

    UNION ALL

    -- respondent lawyers
    SELECT
      bc.case_id,
      'Respondent'::text AS lawyer_side,
      lm.lawyer_id,
      lm.lawyer_name,
      bc.norm_outcome,
      bc.duration_days
    FROM batch_cases bc
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN bc.respondent_lawyers IS NOT NULL AND jsonb_array_length(bc.respondent_lawyers) > 0 THEN bc.respondent_lawyers
        ELSE to_jsonb(ARRAY['Respondent without a Lawyer']::text[])
      END
    ) elem
    LEFT JOIN LATERAL (
      SELECT l.id AS lawyer_id, l.name AS lawyer_name
      FROM public.lawyers l
      WHERE public.canonical_person_name(l.name) = public.canonical_person_name(trim(elem))
        AND btrim(trim(elem)) <> ''
      ORDER BY (l.user_id IS NOT NULL) DESC, l.created_at ASC NULLS LAST, l.id ASC
      LIMIT 1
    ) lm ON true
  ),
  mapped_judges AS (
    SELECT
      bc.case_id,
      jm.judge_id,
      jm.judge_name
    FROM batch_cases bc
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN bc.judges IS NOT NULL AND jsonb_array_length(bc.judges) > 0 THEN bc.judges
        ELSE to_jsonb(ARRAY['Unknown Judge']::text[])
      END
    ) elem
    LEFT JOIN LATERAL (
      SELECT j.id AS judge_id, j.name AS judge_name
      FROM public.judges j
      WHERE public.canonical_person_name(j.name) = public.canonical_person_name(trim(elem))
        AND btrim(trim(elem)) <> ''
      ORDER BY j.created_at ASC NULLS LAST, j.id ASC
      LIMIT 1
    ) jm ON true
  ),
  pairs AS (
    SELECT
      ml.lawyer_id,
      ml.lawyer_name,
      mj.judge_id,
      mj.judge_name,
      ml.norm_outcome,
      ml.duration_days
    FROM mapped_lawyers ml
    JOIN mapped_judges mj
      ON mj.case_id = ml.case_id
    WHERE ml.lawyer_id IS NOT NULL
      AND mj.judge_id IS NOT NULL
  ),
  agg AS (
    SELECT
      p.lawyer_id,
      p.judge_id,
      MAX(p.lawyer_name) AS lawyer_name,
      MAX(p.judge_name) AS judge_name,
      COUNT(*) FILTER (WHERE p.norm_outcome IN ('in favor of complainant','in favor of respondent','settled'))::int AS total_cases,
      COUNT(*) FILTER (
        WHERE (p.norm_outcome = 'in favor of complainant' AND EXISTS (
          SELECT 1 FROM lawyer_analytics WHERE false
        ))
      )::int AS won_cases, -- placeholder overwritten below
      COUNT(*) FILTER (WHERE p.norm_outcome = 'settled')::int AS settled_cases,
      COALESCE(SUM(p.duration_days) FILTER (WHERE p.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND p.duration_days IS NOT NULL), 0) AS duration_sum_days,
      COALESCE(COUNT(p.duration_days) FILTER (WHERE p.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND p.duration_days IS NOT NULL), 0)::int AS duration_count
    FROM pairs p
    GROUP BY p.lawyer_id, p.judge_id
  )
  -- Use an alternate aggregation (no placeholder) for win/loss based on lawyer_side:
  -- Because pairs currently dropped lawyer_side, rebuild with correct logic.
  */

  -- Recompute lawyer-vs-judge with explicit win/loss mapping using lawyer_side:
  WITH batch_cases AS (
    SELECT
      c.id AS case_id,
      public.normalize_case_outcome(c.outcome, c.status, c.summary) AS norm_outcome,
      CASE
        WHEN c.filing_date IS NOT NULL AND c.judgment_date IS NOT NULL THEN (c.judgment_date - c.filing_date)::numeric
        ELSE NULL
      END AS duration_days,
      c.petitioner_lawyers,
      c.respondent_lawyers,
      c.judges
    FROM public.cases c
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
    LIMIT v_batch_size OFFSET v_offset
  ),
  mapped_lawyers AS (
    SELECT
      bc.case_id,
      'Petitioner'::text AS lawyer_side,
      lm.lawyer_id,
      lm.lawyer_name,
      bc.norm_outcome,
      bc.duration_days
    FROM batch_cases bc
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN bc.petitioner_lawyers IS NOT NULL AND jsonb_array_length(bc.petitioner_lawyers) > 0 THEN bc.petitioner_lawyers
        ELSE to_jsonb(ARRAY['Complainant without a lawyer']::text[])
      END
    ) elem
    LEFT JOIN LATERAL (
      SELECT l.id AS lawyer_id, l.name AS lawyer_name
      FROM public.lawyers l
      WHERE public.canonical_person_name(l.name) = public.canonical_person_name(trim(elem))
        AND btrim(trim(elem)) <> ''
      ORDER BY (l.user_id IS NOT NULL) DESC, l.created_at ASC NULLS LAST, l.id ASC
      LIMIT 1
    ) lm ON true
    WHERE lm.lawyer_id IS NOT NULL

    UNION ALL

    SELECT
      bc.case_id,
      'Respondent'::text AS lawyer_side,
      lm.lawyer_id,
      lm.lawyer_name,
      bc.norm_outcome,
      bc.duration_days
    FROM batch_cases bc
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN bc.respondent_lawyers IS NOT NULL AND jsonb_array_length(bc.respondent_lawyers) > 0 THEN bc.respondent_lawyers
        ELSE to_jsonb(ARRAY['Respondent without a Lawyer']::text[])
      END
    ) elem
    LEFT JOIN LATERAL (
      SELECT l.id AS lawyer_id, l.name AS lawyer_name
      FROM public.lawyers l
      WHERE public.canonical_person_name(l.name) = public.canonical_person_name(trim(elem))
        AND btrim(trim(elem)) <> ''
      ORDER BY (l.user_id IS NOT NULL) DESC, l.created_at ASC NULLS LAST, l.id ASC
      LIMIT 1
    ) lm ON true
    WHERE lm.lawyer_id IS NOT NULL
  ),
  mapped_judges AS (
    SELECT
      bc.case_id,
      jm.judge_id,
      jm.judge_name
    FROM batch_cases bc
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE
        WHEN bc.judges IS NOT NULL AND jsonb_array_length(bc.judges) > 0 THEN bc.judges
        ELSE to_jsonb(ARRAY['Unknown Judge']::text[])
      END
    ) elem
    LEFT JOIN LATERAL (
      SELECT j.id AS judge_id, j.name AS judge_name
      FROM public.judges j
      WHERE public.canonical_person_name(j.name) = public.canonical_person_name(trim(elem))
        AND btrim(trim(elem)) <> ''
      ORDER BY j.created_at ASC NULLS LAST, j.id ASC
      LIMIT 1
    ) jm ON true
    WHERE jm.judge_id IS NOT NULL
  ),
  pair_rows AS (
    SELECT
      ml.lawyer_id,
      ml.lawyer_name,
      ml.lawyer_side,
      mj.judge_id,
      mj.judge_name,
      ml.norm_outcome,
      ml.duration_days
    FROM mapped_lawyers ml
    JOIN mapped_judges mj
      ON mj.case_id = ml.case_id
  ),
  agg AS (
    SELECT
      pr.lawyer_id,
      pr.judge_id,
      MAX(pr.lawyer_name) AS lawyer_name,
      MAX(pr.judge_name) AS judge_name,
      COUNT(*) FILTER (WHERE pr.norm_outcome IN ('in favor of complainant','in favor of respondent','settled'))::int AS total_cases,
      COUNT(*) FILTER (
        WHERE (pr.norm_outcome = 'in favor of complainant' AND pr.lawyer_side = 'Petitioner')
           OR (pr.norm_outcome = 'in favor of respondent' AND pr.lawyer_side = 'Respondent')
      )::int AS won_cases,
      COUNT(*) FILTER (
        WHERE (pr.norm_outcome = 'in favor of complainant' AND pr.lawyer_side = 'Respondent')
           OR (pr.norm_outcome = 'in favor of respondent' AND pr.lawyer_side = 'Petitioner')
      )::int AS lost_cases,
      COUNT(*) FILTER (WHERE pr.norm_outcome = 'settled')::int AS settled_cases,
      COALESCE(SUM(pr.duration_days) FILTER (WHERE pr.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND pr.duration_days IS NOT NULL), 0) AS duration_sum_days,
      COALESCE(COUNT(pr.duration_days) FILTER (WHERE pr.norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND pr.duration_days IS NOT NULL), 0)::int AS duration_count
    FROM pair_rows pr
    GROUP BY pr.lawyer_id, pr.judge_id
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

GRANT EXECUTE ON FUNCTION public.admin_recalculate_analytics_batch_multi(integer, integer, boolean) TO authenticated;

COMMIT;

