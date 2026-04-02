-- 028_fix_master_analysis_wide.sql
-- Adds robust wide-table lawyer analytics rebuild and a single admin pipeline RPC

SET search_path = public, extensions, pg_temp;

-- 1) Function: admin_rebuild_lawyer_analytics_wide()
-- Recomputes lawyer_analytics by crediting ALL listed lawyers (petitioner 1..5, respondent 1..5)
-- and assigning wins/losses/settlements appropriately by side, plus durations.
CREATE OR REPLACE FUNCTION public.admin_rebuild_lawyer_analytics_wide()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  -- Materialize canonical lawyer names for reliable joins
  CREATE TEMP TABLE tmp_canon_lawyers ON COMMIT DROP AS
  SELECT
    l.id AS lawyer_id,
    l.name AS lawyer_name,
    lower(regexp_replace(regexp_replace(btrim(l.name), '[\u2018\u2019\u201C\u201D]', '''', 'g'), '\s+', ' ', 'g')) AS key_name
  FROM public.lawyers l
  WHERE l.name IS NOT NULL AND btrim(l.name) <> '';
  CREATE INDEX ON tmp_canon_lawyers(key_name);

  -- Materialize wide rows with side-specific lawyer entries
  CREATE TEMP TABLE tmp_wide_rows ON COMMIT DROP AS
  WITH wide AS (
    SELECT
      c.case_number,
      lower(coalesce(c.outcome,'')) AS outc,
      COALESCE(c.filing_date, c.first_hearing_date) AS filing_date,
      c.judgment_date,
      unnest(ARRAY[
        c.petitioner_lawyer_1, c.petitioner_lawyer_2, c.petitioner_lawyer_3,
        c.petitioner_lawyer_4, c.petitioner_lawyer_5
      ]) AS pet_lawyer,
      unnest(ARRAY[
        c.respondent_lawyer_1, c.respondent_lawyer_2, c.respondent_lawyer_3,
        c.respondent_lawyer_4, c.respondent_lawyer_5
      ]) AS res_lawyer
    FROM public.cases c
  ),
  pet_rows AS (
    SELECT
      lower(regexp_replace(regexp_replace(btrim(w.pet_lawyer), '[\u2018\u2019\u201C\u201D]', '''', 'g'), '\s+', ' ', 'g')) AS key_name,
      w.case_number,
      w.outc,
      w.filing_date,
      w.judgment_date,
      'Complainant'::text AS side
    FROM wide w
    WHERE w.pet_lawyer IS NOT NULL AND btrim(w.pet_lawyer) <> ''
  ),
  res_rows AS (
    SELECT
      lower(regexp_replace(regexp_replace(btrim(w.res_lawyer), '[\u2018\u2019\u201C\u201D]', '''', 'g'), '\s+', ' ', 'g')) AS key_name,
      w.case_number,
      w.outc,
      w.filing_date,
      w.judgment_date,
      'Respondent'::text AS side
    FROM wide w
    WHERE w.res_lawyer IS NOT NULL AND btrim(w.res_lawyer) <> ''
  ),
  all_rows AS (
    SELECT * FROM pet_rows
    UNION ALL
    SELECT * FROM res_rows
  )
  SELECT
    a.key_name,
    a.case_number,
    a.side,
    CASE
      WHEN a.outc ~ 'settled' THEN 'settled'
      WHEN a.outc ~ 'in favor of complainant' OR a.outc ~ 'complainant' THEN 'complainant'
      WHEN a.outc ~ 'in favor of respondent'  OR a.outc ~ 'respondent'  THEN 'respondent'
      ELSE 'other'
    END AS norm_outcome,
    CASE
      WHEN a.filing_date IS NOT NULL AND a.judgment_date IS NOT NULL
        THEN GREATEST(0, (a.judgment_date::date - a.filing_date::date))
      ELSE NULL
    END AS duration_days
  FROM all_rows a;
  CREATE INDEX ON tmp_wide_rows(key_name);
  CREATE INDEX ON tmp_wide_rows(case_number);

  -- Map to lawyers and aggregate
  CREATE TEMP TABLE tmp_lawyer_agg ON COMMIT DROP AS
  WITH mapped AS (
    SELECT
      cl.lawyer_id,
      cl.lawyer_name,
      w.case_number,
      w.side,
      w.norm_outcome,
      w.duration_days
    FROM tmp_wide_rows w
    JOIN tmp_canon_lawyers cl ON cl.key_name = w.key_name
  ),
  agg AS (
    SELECT
      m.lawyer_id,
      MIN(m.lawyer_name) AS lawyer_name,
      COUNT(DISTINCT m.case_number) AS total_cases,
      SUM(CASE WHEN m.side = 'Complainant' AND m.norm_outcome = 'complainant' THEN 1 ELSE 0 END) AS won_c,
      SUM(CASE WHEN m.side = 'Respondent'  AND m.norm_outcome = 'respondent'  THEN 1 ELSE 0 END) AS won_r,
      SUM(CASE WHEN m.side = 'Complainant' AND m.norm_outcome = 'respondent'  THEN 1 ELSE 0 END) AS lost_c,
      SUM(CASE WHEN m.side = 'Respondent'  AND m.norm_outcome = 'complainant' THEN 1 ELSE 0 END) AS lost_r,
      SUM(CASE WHEN m.norm_outcome = 'settled' THEN 1 ELSE 0 END) AS settled_cases,
      COUNT(m.duration_days) AS duration_count,
      COALESCE(SUM(m.duration_days), 0) AS duration_sum_days
    FROM mapped m
    GROUP BY m.lawyer_id
  )
  SELECT
    a.lawyer_id,
    a.lawyer_name,
    a.total_cases,
    (a.won_c + a.won_r) AS won_cases,
    (a.lost_c + a.lost_r) AS lost_cases,
    a.settled_cases,
    a.duration_count,
    a.duration_sum_days,
    CASE WHEN a.total_cases > 0 THEN ROUND((a.won_c + a.won_r)::numeric * 100.0 / a.total_cases, 2) ELSE 0 END AS win_rate,
    CASE WHEN a.total_cases > 0 THEN ROUND((a.lost_c + a.lost_r)::numeric * 100.0 / a.total_cases, 2) ELSE 0 END AS loss_rate,
    CASE WHEN a.total_cases > 0 THEN ROUND(a.settled_cases::numeric * 100.0 / a.total_cases, 2) ELSE 0 END AS settlement_rate,
    CASE WHEN a.duration_count > 0 THEN ROUND(a.duration_sum_days::numeric / a.duration_count, 2) ELSE 0 END AS avg_case_duration_days
  FROM agg a;

  -- Upsert into public.lawyer_analytics
  INSERT INTO public.lawyer_analytics AS la (
    lawyer_id, lawyer_name, total_cases, won_cases, lost_cases, settled_cases,
    duration_count, duration_sum_days, win_rate, loss_rate, settlement_rate, avg_case_duration_days, updated_at
  )
  SELECT
    t.lawyer_id, t.lawyer_name, t.total_cases, t.won_cases, t.lost_cases, t.settled_cases,
    t.duration_count, t.duration_sum_days, t.win_rate, t.loss_rate, t.settlement_rate, t.avg_case_duration_days, NOW()
  FROM tmp_lawyer_agg t
  ON CONFLICT (lawyer_id) DO UPDATE
  SET
    lawyer_name = EXCLUDED.lawyer_name,
    total_cases = EXCLUDED.total_cases,
    won_cases = EXCLUDED.won_cases,
    lost_cases = EXCLUDED.lost_cases,
    settled_cases = EXCLUDED.settled_cases,
    duration_count = EXCLUDED.duration_count,
    duration_sum_days = EXCLUDED.duration_sum_days,
    win_rate = EXCLUDED.win_rate,
    loss_rate = EXCLUDED.loss_rate,
    settlement_rate = EXCLUDED.settlement_rate,
    avg_case_duration_days = EXCLUDED.avg_case_duration_days,
    updated_at = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_rebuild_lawyer_analytics_wide() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_rebuild_lawyer_analytics_wide() TO authenticated;

-- 2) Orchestrator: runs batch analytics, then robust rebuild, then tri‑factor
CREATE OR REPLACE FUNCTION public.admin_run_master_analysis_wide(p_batch_size integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_off integer := 0;
  v_done integer := 0;
  v_total_processed integer := 0;
  v_rebuilt integer := 0;
  v_ranked integer := 0;
BEGIN
  PERFORM set_config('statement_timeout', '600000', true); -- 10 minutes

  -- First pass with reset=true
  LOOP
    v_done := public.admin_recalculate_analytics_batch_wide(p_batch_size, v_off, true);
    EXIT WHEN v_done = 0;
    v_total_processed := v_total_processed + v_done;
    v_off := v_off + p_batch_size;
    PERFORM pg_sleep(0.05);
  END LOOP;

  -- Subsequent passes (if any data remains) with reset=false (idempotent safety)
  v_off := 0;
  LOOP
    v_done := public.admin_recalculate_analytics_batch_wide(p_batch_size, v_off, false);
    EXIT WHEN v_done = 0;
    v_total_processed := v_total_processed + v_done;
    v_off := v_off + p_batch_size;
    PERFORM pg_sleep(0.05);
  END LOOP;

  -- Robust lawyer analytics rebuild to ensure all listed lawyers get credited
  v_rebuilt := public.admin_rebuild_lawyer_analytics_wide();

  -- Compute tri‑factor ranks on refreshed analytics
  v_ranked := public.admin_compute_tri_ranks_all(200);

  RETURN jsonb_build_object(
    'processed_cases', v_total_processed,
    'lawyer_rows_updated', v_rebuilt,
    'tri_factor_updated', v_ranked
  );
END;
$$;
REVOKE ALL ON FUNCTION public.admin_run_master_analysis_wide(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_run_master_analysis_wide(integer) TO authenticated;

