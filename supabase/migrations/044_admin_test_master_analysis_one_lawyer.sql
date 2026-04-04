BEGIN;

-- Test-only helper: rebuild analytics for one lawyer (fast, deterministic).
-- Intended to be called from the Admin UI to validate chart_* logic end-to-end
-- without running a full master analysis over all lawyers.
CREATE OR REPLACE FUNCTION public.admin_test_master_analysis_one_lawyer(p_lawyer_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_key text;
  v_lawyer_id uuid;
  v_total_cases int := 0;
  v_prep jsonb;
  v_hits jsonb;
  v_charts jsonb;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Allow this diagnostic RPC to run longer.
  PERFORM set_config('statement_timeout', '600000', true); -- 10 minutes

  IF p_lawyer_name IS NULL OR btrim(p_lawyer_name) = '' THEN
    RAISE EXCEPTION 'p_lawyer_name is required';
  END IF;

  -- Lightweight prep for a single lawyer:
  -- - ensure cases_analytics exists
  -- - backfill missing rows by case_number
  -- - standardize only slots that match this lawyer key (avoid full-table merge pools)
  IF to_regclass('public.cases_analytics') IS NULL THEN
    EXECUTE 'CREATE TABLE public.cases_analytics (LIKE public.cases INCLUDING ALL);';
    EXECUTE 'INSERT INTO public.cases_analytics SELECT * FROM public.cases;';
    v_prep := jsonb_build_object('created_cases_analytics', true, 'inserted_rows', (SELECT COUNT(*) FROM public.cases));
  ELSE
    INSERT INTO public.cases_analytics
    SELECT *
    FROM public.cases c
    WHERE NOT EXISTS (
      SELECT 1 FROM public.cases_analytics ca WHERE ca.case_number = c.case_number
    );
    v_prep := jsonb_build_object('created_cases_analytics', false, 'inserted_rows', (SELECT COUNT(*) FROM public.cases c WHERE NOT EXISTS (SELECT 1 FROM public.cases_analytics ca WHERE ca.case_number = c.case_number)));
  END IF;

  v_key := public.canonical_person_name(p_lawyer_name);
  IF v_key IS NULL OR btrim(v_key) = '' THEN
    RAISE EXCEPTION 'Could not canonicalize lawyer name';
  END IF;

  -- Choose the preferred lawyer card for this canonical key.
  SELECT l.id
  INTO v_lawyer_id
  FROM public.lawyers l
  WHERE public.canonical_person_name(l.name) = v_key
  ORDER BY (l.user_id IS NOT NULL) DESC, l.created_at ASC NULLS LAST, l.id ASC
  LIMIT 1;

  IF v_lawyer_id IS NULL THEN
    -- Create a card if missing (Step 3 behavior).
    INSERT INTO public.lawyers (name, email, is_verified, is_admin)
    VALUES (
      btrim(p_lawyer_name),
      'import+' || md5(v_key) || '@judge-my-lawyer.local',
      false,
      false
    )
    ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name
    RETURNING id INTO v_lawyer_id;
  END IF;

  -- Standardize only this lawyer's slot occurrences inside cases_analytics (and mirror into cases).
  UPDATE public.cases_analytics ca
  SET
    petitioner_lawyer_1 = CASE WHEN public.canonical_person_name(ca.petitioner_lawyer_1) = v_key THEN btrim(p_lawyer_name) ELSE ca.petitioner_lawyer_1 END,
    petitioner_lawyer_2 = CASE WHEN public.canonical_person_name(ca.petitioner_lawyer_2) = v_key THEN btrim(p_lawyer_name) ELSE ca.petitioner_lawyer_2 END,
    petitioner_lawyer_3 = CASE WHEN public.canonical_person_name(ca.petitioner_lawyer_3) = v_key THEN btrim(p_lawyer_name) ELSE ca.petitioner_lawyer_3 END,
    petitioner_lawyer_4 = CASE WHEN public.canonical_person_name(ca.petitioner_lawyer_4) = v_key THEN btrim(p_lawyer_name) ELSE ca.petitioner_lawyer_4 END,
    petitioner_lawyer_5 = CASE WHEN public.canonical_person_name(ca.petitioner_lawyer_5) = v_key THEN btrim(p_lawyer_name) ELSE ca.petitioner_lawyer_5 END,
    respondent_lawyer_1 = CASE WHEN public.canonical_person_name(ca.respondent_lawyer_1) = v_key THEN btrim(p_lawyer_name) ELSE ca.respondent_lawyer_1 END,
    respondent_lawyer_2 = CASE WHEN public.canonical_person_name(ca.respondent_lawyer_2) = v_key THEN btrim(p_lawyer_name) ELSE ca.respondent_lawyer_2 END,
    respondent_lawyer_3 = CASE WHEN public.canonical_person_name(ca.respondent_lawyer_3) = v_key THEN btrim(p_lawyer_name) ELSE ca.respondent_lawyer_3 END,
    respondent_lawyer_4 = CASE WHEN public.canonical_person_name(ca.respondent_lawyer_4) = v_key THEN btrim(p_lawyer_name) ELSE ca.respondent_lawyer_4 END,
    respondent_lawyer_5 = CASE WHEN public.canonical_person_name(ca.respondent_lawyer_5) = v_key THEN btrim(p_lawyer_name) ELSE ca.respondent_lawyer_5 END
  WHERE
    public.canonical_person_name(ca.petitioner_lawyer_1) = v_key OR
    public.canonical_person_name(ca.petitioner_lawyer_2) = v_key OR
    public.canonical_person_name(ca.petitioner_lawyer_3) = v_key OR
    public.canonical_person_name(ca.petitioner_lawyer_4) = v_key OR
    public.canonical_person_name(ca.petitioner_lawyer_5) = v_key OR
    public.canonical_person_name(ca.respondent_lawyer_1) = v_key OR
    public.canonical_person_name(ca.respondent_lawyer_2) = v_key OR
    public.canonical_person_name(ca.respondent_lawyer_3) = v_key OR
    public.canonical_person_name(ca.respondent_lawyer_4) = v_key OR
    public.canonical_person_name(ca.respondent_lawyer_5) = v_key;

  UPDATE public.cases c
  SET
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
    AND (
      public.canonical_person_name(ca.petitioner_lawyer_1) = v_key OR
      public.canonical_person_name(ca.petitioner_lawyer_2) = v_key OR
      public.canonical_person_name(ca.petitioner_lawyer_3) = v_key OR
      public.canonical_person_name(ca.petitioner_lawyer_4) = v_key OR
      public.canonical_person_name(ca.petitioner_lawyer_5) = v_key OR
      public.canonical_person_name(ca.respondent_lawyer_1) = v_key OR
      public.canonical_person_name(ca.respondent_lawyer_2) = v_key OR
      public.canonical_person_name(ca.respondent_lawyer_3) = v_key OR
      public.canonical_person_name(ca.respondent_lawyer_4) = v_key OR
      public.canonical_person_name(ca.respondent_lawyer_5) = v_key
    );

  -- Rebuild lawyer_analytics for this one lawyer from cases_analytics (wide slot logic).
  WITH
  hits AS (
    SELECT DISTINCT
      c.case_number,
      hit.side,
      public.normalize_case_outcome(c.outcome, c.status, c.summary) AS norm_outcome,
      CASE
        WHEN COALESCE(c.filing_date, c.first_hearing_date) IS NOT NULL AND c.judgment_date IS NOT NULL
          THEN GREATEST(0, (c.judgment_date::date - COALESCE(c.filing_date, c.first_hearing_date)::date))::numeric
        ELSE NULL
      END AS duration_days
    FROM public.cases_analytics c
    JOIN LATERAL (
      SELECT side
      FROM (VALUES
        ('Petitioner'::text, c.petitioner_lawyer_1),
        ('Petitioner'::text, c.petitioner_lawyer_2),
        ('Petitioner'::text, c.petitioner_lawyer_3),
        ('Petitioner'::text, c.petitioner_lawyer_4),
        ('Petitioner'::text, c.petitioner_lawyer_5),
        ('Respondent'::text,  c.respondent_lawyer_1),
        ('Respondent'::text,  c.respondent_lawyer_2),
        ('Respondent'::text,  c.respondent_lawyer_3),
        ('Respondent'::text,  c.respondent_lawyer_4),
        ('Respondent'::text,  c.respondent_lawyer_5)
      ) v(side, raw_name)
      WHERE raw_name IS NOT NULL
        AND btrim(raw_name) <> ''
        AND public.canonical_person_name(raw_name) = v_key
      LIMIT 1
    ) hit ON true
    WHERE c.case_number IS NOT NULL AND btrim(c.case_number) <> ''
  ),
  agg AS (
    SELECT
      COUNT(*) FILTER (WHERE norm_outcome IN ('in favor of complainant','in favor of respondent','settled'))::int AS total_cases,
      COUNT(*) FILTER (
        WHERE (norm_outcome = 'in favor of complainant' AND side = 'Petitioner')
           OR (norm_outcome = 'in favor of respondent'  AND side = 'Respondent')
      )::int AS won_cases,
      COUNT(*) FILTER (
        WHERE (norm_outcome = 'in favor of complainant' AND side = 'Respondent')
           OR (norm_outcome = 'in favor of respondent'  AND side = 'Petitioner')
      )::int AS lost_cases,
      COUNT(*) FILTER (WHERE norm_outcome = 'settled')::int AS settled_cases,
      COUNT(*) FILTER (WHERE lower(coalesce(norm_outcome, '')) = 'withdrawn')::int AS withdrawn_cases,
      -- Status buckets require the raw status; we approximate via normalized outcome only here.
      0::int AS dismissed_cases,
      0::int AS partially_granted_cases,
      COALESCE(SUM(duration_days) FILTER (WHERE norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND duration_days IS NOT NULL), 0) AS duration_sum_days,
      COALESCE(COUNT(duration_days) FILTER (WHERE norm_outcome IN ('in favor of complainant','in favor of respondent','settled') AND duration_days IS NOT NULL), 0)::int AS duration_count
    FROM hits
  )
  INSERT INTO public.lawyer_analytics AS la (
    lawyer_id, lawyer_name,
    total_cases, won_cases, lost_cases, settled_cases,
    dismissed_cases, withdrawn_cases, partially_granted_cases,
    win_rate, loss_rate, settlement_rate,
    avg_case_duration_days, duration_sum_days, duration_count,
    updated_at
  )
  SELECT
    v_lawyer_id,
    (SELECT name FROM public.lawyers WHERE id = v_lawyer_id),
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
    total_cases = EXCLUDED.total_cases,
    won_cases = EXCLUDED.won_cases,
    lost_cases = EXCLUDED.lost_cases,
    settled_cases = EXCLUDED.settled_cases,
    dismissed_cases = EXCLUDED.dismissed_cases,
    withdrawn_cases = EXCLUDED.withdrawn_cases,
    partially_granted_cases = EXCLUDED.partially_granted_cases,
    win_rate = EXCLUDED.win_rate,
    loss_rate = EXCLUDED.loss_rate,
    settlement_rate = EXCLUDED.settlement_rate,
    avg_case_duration_days = EXCLUDED.avg_case_duration_days,
    duration_sum_days = EXCLUDED.duration_sum_days,
    duration_count = EXCLUDED.duration_count,
    updated_at = now();

  -- Refresh chart_* columns for this one lawyer (single-lawyer scan, avoids full unnest).
  WITH
  lawyer_cases AS (
    SELECT DISTINCT
      c.case_number,
      side_hit.side,
      public.normalize_case_outcome(c.outcome, c.status, c.summary) AS norm_outcome,
      c.total_hearings::int AS total_hearings,
      COALESCE(NULLIF(btrim(c.petitioner_name), ''), '(Unknown)') AS petitioner_name,
      COALESCE(NULLIF(btrim(c.respondent_name), ''), '(Unknown)') AS respondent_name,
      ARRAY[
        NULLIF(btrim(c.petitioner_lawyer_1), ''), NULLIF(btrim(c.petitioner_lawyer_2), ''),
        NULLIF(btrim(c.petitioner_lawyer_3), ''), NULLIF(btrim(c.petitioner_lawyer_4), ''),
        NULLIF(btrim(c.petitioner_lawyer_5), '')
      ]::text[] AS petitioner_lawyers,
      ARRAY[
        NULLIF(btrim(c.respondent_lawyer_1), ''), NULLIF(btrim(c.respondent_lawyer_2), ''),
        NULLIF(btrim(c.respondent_lawyer_3), ''), NULLIF(btrim(c.respondent_lawyer_4), ''),
        NULLIF(btrim(c.respondent_lawyer_5), '')
      ]::text[] AS respondent_lawyers,
      ARRAY[
        NULLIF(btrim(c.judge_1), ''), NULLIF(btrim(c.judge_2), ''), NULLIF(btrim(c.judge_3), ''),
        NULLIF(btrim(c.judge_4), ''), NULLIF(btrim(c.judge_5), ''), NULLIF(btrim(c.judge_6), ''),
        NULLIF(btrim(c.judge_7), ''), NULLIF(btrim(c.judge_8), ''), NULLIF(btrim(c.judge_9), '')
      ]::text[] AS judges
    FROM public.cases_analytics c
    JOIN LATERAL (
      SELECT side
      FROM (VALUES
        ('Petitioner'::text, c.petitioner_lawyer_1),
        ('Petitioner'::text, c.petitioner_lawyer_2),
        ('Petitioner'::text, c.petitioner_lawyer_3),
        ('Petitioner'::text, c.petitioner_lawyer_4),
        ('Petitioner'::text, c.petitioner_lawyer_5),
        ('Respondent'::text,  c.respondent_lawyer_1),
        ('Respondent'::text,  c.respondent_lawyer_2),
        ('Respondent'::text,  c.respondent_lawyer_3),
        ('Respondent'::text,  c.respondent_lawyer_4),
        ('Respondent'::text,  c.respondent_lawyer_5)
      ) v(side, raw_name)
      WHERE raw_name IS NOT NULL
        AND btrim(raw_name) <> ''
        AND public.canonical_person_name(raw_name) = v_key
      LIMIT 1
    ) side_hit ON true
    WHERE c.case_number IS NOT NULL AND btrim(c.case_number) <> ''
  ),
  rep AS (
    SELECT
      COUNT(*) FILTER (WHERE side = 'Petitioner')::int AS rep_c,
      COUNT(*) FILTER (WHERE side = 'Respondent')::int AS rep_r
    FROM lawyer_cases
  ),
  hear AS (
    SELECT
      COUNT(*) FILTER (WHERE COALESCE(total_hearings,0) BETWEEN 1 AND 5)::int AS h1,
      COUNT(*) FILTER (WHERE COALESCE(total_hearings,0) BETWEEN 6 AND 10)::int AS h2,
      COUNT(*) FILTER (WHERE COALESCE(total_hearings,0) BETWEEN 11 AND 15)::int AS h3,
      COUNT(*) FILTER (WHERE COALESCE(total_hearings,0) >= 16)::int AS h4
    FROM lawyer_cases
  ),
  top_party AS (
    SELECT
      opp_party,
      COUNT(*)::int AS cnt
    FROM (
      SELECT
        CASE WHEN side = 'Petitioner' THEN respondent_name ELSE petitioner_name END AS opp_party
      FROM lawyer_cases
    ) x
    WHERE opp_party IS NOT NULL AND btrim(opp_party) <> ''
    GROUP BY opp_party
  ),
  top_party_ranked AS (
    SELECT *, row_number() OVER (ORDER BY cnt DESC, opp_party) AS rn
    FROM top_party
  ),
  top_party_pivot AS (
    SELECT
      MAX(opp_party) FILTER (WHERE rn=1) AS n1, MAX(cnt) FILTER (WHERE rn=1) AS c1,
      MAX(opp_party) FILTER (WHERE rn=2) AS n2, MAX(cnt) FILTER (WHERE rn=2) AS c2,
      MAX(opp_party) FILTER (WHERE rn=3) AS n3, MAX(cnt) FILTER (WHERE rn=3) AS c3,
      MAX(opp_party) FILTER (WHERE rn=4) AS n4, MAX(cnt) FILTER (WHERE rn=4) AS c4,
      MAX(opp_party) FILTER (WHERE rn=5) AS n5, MAX(cnt) FILTER (WHERE rn=5) AS c5
    FROM top_party_ranked
    WHERE rn <= 5
  ),
  opp_lawyers_exp AS (
    SELECT NULLIF(btrim(o.nm), '') AS nm
    FROM lawyer_cases lc
    CROSS JOIN LATERAL unnest(
      CASE WHEN lc.side='Petitioner' THEN lc.respondent_lawyers ELSE lc.petitioner_lawyers END
    ) o(nm)
    WHERE o.nm IS NOT NULL AND btrim(o.nm) <> ''
  ),
  opp_lawyers AS (
    SELECT nm, COUNT(*)::int AS cnt
    FROM opp_lawyers_exp
    GROUP BY nm
  ),
  opp_lawyers_ranked AS (
    SELECT *, row_number() OVER (ORDER BY cnt DESC, nm) AS rn FROM opp_lawyers
  ),
  opp_lawyers_pivot AS (
    SELECT
      MAX(nm) FILTER (WHERE rn=1) AS ol1, MAX(cnt) FILTER (WHERE rn=1) AS oc1,
      MAX(nm) FILTER (WHERE rn=2) AS ol2, MAX(cnt) FILTER (WHERE rn=2) AS oc2,
      MAX(nm) FILTER (WHERE rn=3) AS ol3, MAX(cnt) FILTER (WHERE rn=3) AS oc3,
      MAX(nm) FILTER (WHERE rn=4) AS ol4, MAX(cnt) FILTER (WHERE rn=4) AS oc4,
      MAX(nm) FILTER (WHERE rn=5) AS ol5, MAX(cnt) FILTER (WHERE rn=5) AS oc5
    FROM opp_lawyers_ranked
    WHERE rn <= 5
  ),
  judges_exp AS (
    SELECT NULLIF(btrim(j.nm), '') AS nm
    FROM lawyer_cases lc
    CROSS JOIN LATERAL unnest(lc.judges) j(nm)
    WHERE j.nm IS NOT NULL AND btrim(j.nm) <> ''
  ),
  judges_cnt AS (
    SELECT nm, COUNT(*)::int AS cnt FROM judges_exp GROUP BY nm
  ),
  judges_ranked AS (
    SELECT *, row_number() OVER (ORDER BY cnt DESC, nm) AS rn FROM judges_cnt
  ),
  judges_pivot AS (
    SELECT
      MAX(nm) FILTER (WHERE rn=1) AS j1, MAX(cnt) FILTER (WHERE rn=1) AS jc1,
      MAX(nm) FILTER (WHERE rn=2) AS j2, MAX(cnt) FILTER (WHERE rn=2) AS jc2,
      MAX(nm) FILTER (WHERE rn=3) AS j3, MAX(cnt) FILTER (WHERE rn=3) AS jc3,
      MAX(nm) FILTER (WHERE rn=4) AS j4, MAX(cnt) FILTER (WHERE rn=4) AS jc4,
      MAX(nm) FILTER (WHERE rn=5) AS j5, MAX(cnt) FILTER (WHERE rn=5) AS jc5
    FROM judges_ranked
    WHERE rn <= 5
  )
  UPDATE public.lawyer_analytics la
  SET
    chart_rep_complainant_cases = rep.rep_c,
    chart_rep_respondent_cases = rep.rep_r,
    chart_hearings_1_5 = hear.h1,
    chart_hearings_6_10 = hear.h2,
    chart_hearings_11_15 = hear.h3,
    chart_hearings_16_plus = hear.h4,
    chart_top_party_1_name = tp.n1,
    chart_top_party_1_cases = COALESCE(tp.c1,0),
    chart_top_party_2_name = tp.n2,
    chart_top_party_2_cases = COALESCE(tp.c2,0),
    chart_top_party_3_name = tp.n3,
    chart_top_party_3_cases = COALESCE(tp.c3,0),
    chart_top_party_4_name = tp.n4,
    chart_top_party_4_cases = COALESCE(tp.c4,0),
    chart_top_party_5_name = tp.n5,
    chart_top_party_5_cases = COALESCE(tp.c5,0),
    chart_top_opp_lawyer_1_name = ol.ol1,
    chart_top_opp_lawyer_1_cases = COALESCE(ol.oc1,0),
    chart_top_opp_lawyer_2_name = ol.ol2,
    chart_top_opp_lawyer_2_cases = COALESCE(ol.oc2,0),
    chart_top_opp_lawyer_3_name = ol.ol3,
    chart_top_opp_lawyer_3_cases = COALESCE(ol.oc3,0),
    chart_top_opp_lawyer_4_name = ol.ol4,
    chart_top_opp_lawyer_4_cases = COALESCE(ol.oc4,0),
    chart_top_opp_lawyer_5_name = ol.ol5,
    chart_top_opp_lawyer_5_cases = COALESCE(ol.oc5,0),
    chart_top_judge_1_name = jp.j1,
    chart_top_judge_1_cases = COALESCE(jp.jc1,0),
    chart_top_judge_2_name = jp.j2,
    chart_top_judge_2_cases = COALESCE(jp.jc2,0),
    chart_top_judge_3_name = jp.j3,
    chart_top_judge_3_cases = COALESCE(jp.jc3,0),
    chart_top_judge_4_name = jp.j4,
    chart_top_judge_4_cases = COALESCE(jp.jc4,0),
    chart_top_judge_5_name = jp.j5,
    chart_top_judge_5_cases = COALESCE(jp.jc5,0),
    updated_at = now()
  FROM rep, hear, top_party_pivot tp, opp_lawyers_pivot ol, judges_pivot jp
  WHERE la.lawyer_id = v_lawyer_id;

  SELECT total_cases INTO v_total_cases FROM public.lawyer_analytics WHERE lawyer_id = v_lawyer_id;

  -- Slot hit counts in cases_analytics (diagnostic: proves whether the lawyer appears in raw slot columns).
  SELECT jsonb_build_object(
    'p1', COUNT(*) FILTER (WHERE public.canonical_person_name(c.petitioner_lawyer_1) = v_key),
    'p2', COUNT(*) FILTER (WHERE public.canonical_person_name(c.petitioner_lawyer_2) = v_key),
    'p3', COUNT(*) FILTER (WHERE public.canonical_person_name(c.petitioner_lawyer_3) = v_key),
    'p4', COUNT(*) FILTER (WHERE public.canonical_person_name(c.petitioner_lawyer_4) = v_key),
    'p5', COUNT(*) FILTER (WHERE public.canonical_person_name(c.petitioner_lawyer_5) = v_key),
    'r1', COUNT(*) FILTER (WHERE public.canonical_person_name(c.respondent_lawyer_1) = v_key),
    'r2', COUNT(*) FILTER (WHERE public.canonical_person_name(c.respondent_lawyer_2) = v_key),
    'r3', COUNT(*) FILTER (WHERE public.canonical_person_name(c.respondent_lawyer_3) = v_key),
    'r4', COUNT(*) FILTER (WHERE public.canonical_person_name(c.respondent_lawyer_4) = v_key),
    'r5', COUNT(*) FILTER (WHERE public.canonical_person_name(c.respondent_lawyer_5) = v_key)
  )
  INTO v_hits
  FROM public.cases_analytics c;

  -- Snapshot of computed chart_* columns for this lawyer
  SELECT to_jsonb(la) - 'updated_at' - 'lawyer_name'
  INTO v_charts
  FROM public.lawyer_analytics la
  WHERE la.lawyer_id = v_lawyer_id;

  RETURN jsonb_build_object(
    'ok', true,
    'lawyer_id', v_lawyer_id,
    'canonical_key', v_key,
    'prep', v_prep,
    'slot_hits', v_hits,
    'total_cases', COALESCE(v_total_cases, 0),
    'lawyer_analytics_row', v_charts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_test_master_analysis_one_lawyer(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_test_master_analysis_one_lawyer(text) TO authenticated;

COMMIT;

