-- Precomputed chart columns on lawyer_analytics (Lawyer profile charts).
-- Refreshed by admin_refresh_lawyer_analytics_charts() — aligns with table-analysis lawyer matching (canonical_person_name + synthetic self-rep labels).

BEGIN;

SET search_path = public, extensions, pg_temp;

ALTER TABLE public.lawyer_analytics
  ADD COLUMN IF NOT EXISTS chart_rep_complainant_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_rep_respondent_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_hearings_1_5 integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_hearings_6_10 integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_hearings_11_15 integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_hearings_16_plus integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_party_1_name text,
  ADD COLUMN IF NOT EXISTS chart_top_party_1_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_party_2_name text,
  ADD COLUMN IF NOT EXISTS chart_top_party_2_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_party_3_name text,
  ADD COLUMN IF NOT EXISTS chart_top_party_3_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_party_4_name text,
  ADD COLUMN IF NOT EXISTS chart_top_party_4_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_party_5_name text,
  ADD COLUMN IF NOT EXISTS chart_top_party_5_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_opp_lawyer_1_name text,
  ADD COLUMN IF NOT EXISTS chart_top_opp_lawyer_1_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_opp_lawyer_2_name text,
  ADD COLUMN IF NOT EXISTS chart_top_opp_lawyer_2_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_opp_lawyer_3_name text,
  ADD COLUMN IF NOT EXISTS chart_top_opp_lawyer_3_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_opp_lawyer_4_name text,
  ADD COLUMN IF NOT EXISTS chart_top_opp_lawyer_4_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_opp_lawyer_5_name text,
  ADD COLUMN IF NOT EXISTS chart_top_opp_lawyer_5_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_judge_1_name text,
  ADD COLUMN IF NOT EXISTS chart_top_judge_1_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_judge_2_name text,
  ADD COLUMN IF NOT EXISTS chart_top_judge_2_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_judge_3_name text,
  ADD COLUMN IF NOT EXISTS chart_top_judge_3_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_judge_4_name text,
  ADD COLUMN IF NOT EXISTS chart_top_judge_4_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_top_judge_5_name text,
  ADD COLUMN IF NOT EXISTS chart_top_judge_5_cases integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_settle_1_kind text,
  ADD COLUMN IF NOT EXISTS chart_settle_1_name text,
  ADD COLUMN IF NOT EXISTS chart_settle_1_pct numeric,
  ADD COLUMN IF NOT EXISTS chart_settle_1_n integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_settle_2_kind text,
  ADD COLUMN IF NOT EXISTS chart_settle_2_name text,
  ADD COLUMN IF NOT EXISTS chart_settle_2_pct numeric,
  ADD COLUMN IF NOT EXISTS chart_settle_2_n integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_settle_3_kind text,
  ADD COLUMN IF NOT EXISTS chart_settle_3_name text,
  ADD COLUMN IF NOT EXISTS chart_settle_3_pct numeric,
  ADD COLUMN IF NOT EXISTS chart_settle_3_n integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_settle_4_kind text,
  ADD COLUMN IF NOT EXISTS chart_settle_4_name text,
  ADD COLUMN IF NOT EXISTS chart_settle_4_pct numeric,
  ADD COLUMN IF NOT EXISTS chart_settle_4_n integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS chart_settle_5_kind text,
  ADD COLUMN IF NOT EXISTS chart_settle_5_name text,
  ADD COLUMN IF NOT EXISTS chart_settle_5_pct numeric,
  ADD COLUMN IF NOT EXISTS chart_settle_5_n integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.lawyer_analytics.chart_settle_1_kind IS 'opponent_lawyer | judge — top settlement-rate contexts (min 3 cases).';

CREATE OR REPLACE FUNCTION public.admin_refresh_lawyer_analytics_charts(p_lawyer_ids uuid[] DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_ids uuid[];
  v_updated integer := 0;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_admin_user') THEN
    IF NOT public.is_admin_user() THEN
      RAISE EXCEPTION 'Admin access required';
    END IF;
  END IF;

  IF p_lawyer_ids IS NULL OR array_length(p_lawyer_ids, 1) IS NULL THEN
    SELECT COALESCE(array_agg(la.lawyer_id), ARRAY[]::uuid[])
    INTO v_ids
    FROM public.lawyer_analytics la;
  ELSE
    v_ids := p_lawyer_ids;
  END IF;

  IF COALESCE(array_length(v_ids, 1), 0) = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.lawyer_analytics la
  SET
    chart_rep_complainant_cases = COALESCE(f.chart_rep_complainant_cases, 0),
    chart_rep_respondent_cases = COALESCE(f.chart_rep_respondent_cases, 0),
    chart_hearings_1_5 = COALESCE(f.chart_hearings_1_5, 0),
    chart_hearings_6_10 = COALESCE(f.chart_hearings_6_10, 0),
    chart_hearings_11_15 = COALESCE(f.chart_hearings_11_15, 0),
    chart_hearings_16_plus = COALESCE(f.chart_hearings_16_plus, 0),
    chart_top_party_1_name = f.chart_top_party_1_name,
    chart_top_party_1_cases = COALESCE(f.chart_top_party_1_cases, 0),
    chart_top_party_2_name = f.chart_top_party_2_name,
    chart_top_party_2_cases = COALESCE(f.chart_top_party_2_cases, 0),
    chart_top_party_3_name = f.chart_top_party_3_name,
    chart_top_party_3_cases = COALESCE(f.chart_top_party_3_cases, 0),
    chart_top_party_4_name = f.chart_top_party_4_name,
    chart_top_party_4_cases = COALESCE(f.chart_top_party_4_cases, 0),
    chart_top_party_5_name = f.chart_top_party_5_name,
    chart_top_party_5_cases = COALESCE(f.chart_top_party_5_cases, 0),
    chart_top_opp_lawyer_1_name = f.chart_top_opp_lawyer_1_name,
    chart_top_opp_lawyer_1_cases = COALESCE(f.chart_top_opp_lawyer_1_cases, 0),
    chart_top_opp_lawyer_2_name = f.chart_top_opp_lawyer_2_name,
    chart_top_opp_lawyer_2_cases = COALESCE(f.chart_top_opp_lawyer_2_cases, 0),
    chart_top_opp_lawyer_3_name = f.chart_top_opp_lawyer_3_name,
    chart_top_opp_lawyer_3_cases = COALESCE(f.chart_top_opp_lawyer_3_cases, 0),
    chart_top_opp_lawyer_4_name = f.chart_top_opp_lawyer_4_name,
    chart_top_opp_lawyer_4_cases = COALESCE(f.chart_top_opp_lawyer_4_cases, 0),
    chart_top_opp_lawyer_5_name = f.chart_top_opp_lawyer_5_name,
    chart_top_opp_lawyer_5_cases = COALESCE(f.chart_top_opp_lawyer_5_cases, 0),
    chart_top_judge_1_name = f.chart_top_judge_1_name,
    chart_top_judge_1_cases = COALESCE(f.chart_top_judge_1_cases, 0),
    chart_top_judge_2_name = f.chart_top_judge_2_name,
    chart_top_judge_2_cases = COALESCE(f.chart_top_judge_2_cases, 0),
    chart_top_judge_3_name = f.chart_top_judge_3_name,
    chart_top_judge_3_cases = COALESCE(f.chart_top_judge_3_cases, 0),
    chart_top_judge_4_name = f.chart_top_judge_4_name,
    chart_top_judge_4_cases = COALESCE(f.chart_top_judge_4_cases, 0),
    chart_top_judge_5_name = f.chart_top_judge_5_name,
    chart_top_judge_5_cases = COALESCE(f.chart_top_judge_5_cases, 0),
    chart_settle_1_kind = f.chart_settle_1_kind,
    chart_settle_1_name = f.chart_settle_1_name,
    chart_settle_1_pct = f.chart_settle_1_pct,
    chart_settle_1_n = COALESCE(f.chart_settle_1_n, 0),
    chart_settle_2_kind = f.chart_settle_2_kind,
    chart_settle_2_name = f.chart_settle_2_name,
    chart_settle_2_pct = f.chart_settle_2_pct,
    chart_settle_2_n = COALESCE(f.chart_settle_2_n, 0),
    chart_settle_3_kind = f.chart_settle_3_kind,
    chart_settle_3_name = f.chart_settle_3_name,
    chart_settle_3_pct = f.chart_settle_3_pct,
    chart_settle_3_n = COALESCE(f.chart_settle_3_n, 0),
    chart_settle_4_kind = f.chart_settle_4_kind,
    chart_settle_4_name = f.chart_settle_4_name,
    chart_settle_4_pct = f.chart_settle_4_pct,
    chart_settle_4_n = COALESCE(f.chart_settle_4_n, 0),
    chart_settle_5_kind = f.chart_settle_5_kind,
    chart_settle_5_name = f.chart_settle_5_name,
    chart_settle_5_pct = f.chart_settle_5_pct,
    chart_settle_5_n = COALESCE(f.chart_settle_5_n, 0),
    updated_at = NOW()
  FROM (
    WITH
    cases_base AS (
      SELECT
        c.case_number,
        NULLIF(btrim(c.petitioner_name), '') AS petitioner_name,
        NULLIF(btrim(c.respondent_name), '') AS respondent_name,
        c.total_hearings::integer AS total_hearings,
        public.normalize_case_outcome(c.outcome, c.status, c.summary) AS norm_outcome,
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
      FROM public.cases c
      WHERE c.case_number IS NOT NULL AND btrim(c.case_number) <> ''
    ),
    slots AS (
      SELECT
        cb.case_number,
        'Petitioner'::text AS side,
        unnest(
          CASE
            WHEN array_remove(cb.petitioner_lawyers, NULL) <> '{}'::text[] THEN array_remove(cb.petitioner_lawyers, NULL)
            ELSE ARRAY['Complainant without a lawyer']::text[]
          END
        ) AS slot_lawyer_name
      FROM cases_base cb
      UNION ALL
      SELECT
        cb.case_number,
        'Respondent'::text AS side,
        unnest(
          CASE
            WHEN array_remove(cb.respondent_lawyers, NULL) <> '{}'::text[] THEN array_remove(cb.respondent_lawyers, NULL)
            ELSE ARRAY['Respondent without a Lawyer']::text[]
          END
        ) AS slot_lawyer_name
      FROM cases_base cb
    ),
    mapped AS (
      SELECT DISTINCT ON (l.id, cb.case_number)
        l.id AS lawyer_id,
        s.case_number,
        s.side,
        cb.norm_outcome,
        cb.total_hearings,
        cb.petitioner_name,
        cb.respondent_name,
        cb.petitioner_lawyers,
        cb.respondent_lawyers,
        cb.judges
      FROM slots s
      JOIN public.lawyers l
        ON public.canonical_person_name(l.name) = public.canonical_person_name(s.slot_lawyer_name)
      JOIN cases_base cb ON cb.case_number = s.case_number
      WHERE l.id = ANY(v_ids)
      ORDER BY l.id, cb.case_number, CASE WHEN s.side = 'Petitioner' THEN 0 ELSE 1 END
    ),
    lawyer_case AS (
      SELECT
        m.lawyer_id,
        m.case_number,
        m.side,
        m.norm_outcome,
        m.total_hearings,
        CASE
          WHEN m.side = 'Petitioner' THEN COALESCE(NULLIF(m.respondent_name, ''), '(Unknown)')
          ELSE COALESCE(NULLIF(m.petitioner_name, ''), '(Unknown)')
        END AS opp_party,
        CASE
          WHEN m.side = 'Petitioner' THEN
            CASE
              WHEN array_remove(m.respondent_lawyers, NULL) <> '{}'::text[] THEN array_remove(m.respondent_lawyers, NULL)
              ELSE ARRAY['Respondent without a Lawyer']::text[]
            END
          ELSE
            CASE
              WHEN array_remove(m.petitioner_lawyers, NULL) <> '{}'::text[] THEN array_remove(m.petitioner_lawyers, NULL)
              ELSE ARRAY['Complainant without a lawyer']::text[]
            END
        END AS opp_lawyer_arr,
        array_remove(m.judges, NULL) AS judges_arr
      FROM mapped m
    ),
    rep AS (
      SELECT
        lawyer_id,
        COUNT(*) FILTER (WHERE side = 'Petitioner')::integer AS chart_rep_complainant_cases,
        COUNT(*) FILTER (WHERE side = 'Respondent')::integer AS chart_rep_respondent_cases
      FROM lawyer_case
      GROUP BY lawyer_id
    ),
    hear AS (
      SELECT
        lawyer_id,
        COUNT(*) FILTER (
          WHERE COALESCE(total_hearings, 0) > 0 AND total_hearings >= 1 AND total_hearings <= 5
        )::integer AS chart_hearings_1_5,
        COUNT(*) FILTER (
          WHERE COALESCE(total_hearings, 0) > 0 AND total_hearings >= 6 AND total_hearings <= 10
        )::integer AS chart_hearings_6_10,
        COUNT(*) FILTER (
          WHERE COALESCE(total_hearings, 0) > 0 AND total_hearings >= 11 AND total_hearings <= 15
        )::integer AS chart_hearings_11_15,
        COUNT(*) FILTER (
          WHERE COALESCE(total_hearings, 0) >= 16
        )::integer AS chart_hearings_16_plus
      FROM lawyer_case
      GROUP BY lawyer_id
    ),
    party_counts AS (
      SELECT lawyer_id, opp_party, COUNT(*)::integer AS cnt
      FROM lawyer_case
      GROUP BY lawyer_id, opp_party
    ),
    party_ranked AS (
      SELECT
        *,
        row_number() OVER (PARTITION BY lawyer_id ORDER BY cnt DESC, opp_party) AS rn
      FROM party_counts
    ),
    party_pivot AS (
      SELECT
        lawyer_id,
        MAX(opp_party) FILTER (WHERE rn = 1) AS chart_top_party_1_name,
        MAX(cnt) FILTER (WHERE rn = 1) AS chart_top_party_1_cases,
        MAX(opp_party) FILTER (WHERE rn = 2) AS chart_top_party_2_name,
        MAX(cnt) FILTER (WHERE rn = 2) AS chart_top_party_2_cases,
        MAX(opp_party) FILTER (WHERE rn = 3) AS chart_top_party_3_name,
        MAX(cnt) FILTER (WHERE rn = 3) AS chart_top_party_3_cases,
        MAX(opp_party) FILTER (WHERE rn = 4) AS chart_top_party_4_name,
        MAX(cnt) FILTER (WHERE rn = 4) AS chart_top_party_4_cases,
        MAX(opp_party) FILTER (WHERE rn = 5) AS chart_top_party_5_name,
        MAX(cnt) FILTER (WHERE rn = 5) AS chart_top_party_5_cases
      FROM party_ranked
      WHERE rn <= 5
      GROUP BY lawyer_id
    ),
    ol_exp AS (
      SELECT lc.lawyer_id, NULLIF(btrim(unnest(lc.opp_lawyer_arr)), '') AS nm
      FROM lawyer_case lc
    ),
    ol_counts AS (
      SELECT lawyer_id, nm, COUNT(*)::integer AS cnt
      FROM ol_exp
      WHERE nm IS NOT NULL
      GROUP BY lawyer_id, nm
    ),
    ol_ranked AS (
      SELECT
        *,
        row_number() OVER (PARTITION BY lawyer_id ORDER BY cnt DESC, nm) AS rn
      FROM ol_counts
    ),
    ol_pivot AS (
      SELECT
        lawyer_id,
        MAX(nm) FILTER (WHERE rn = 1) AS chart_top_opp_lawyer_1_name,
        MAX(cnt) FILTER (WHERE rn = 1) AS chart_top_opp_lawyer_1_cases,
        MAX(nm) FILTER (WHERE rn = 2) AS chart_top_opp_lawyer_2_name,
        MAX(cnt) FILTER (WHERE rn = 2) AS chart_top_opp_lawyer_2_cases,
        MAX(nm) FILTER (WHERE rn = 3) AS chart_top_opp_lawyer_3_name,
        MAX(cnt) FILTER (WHERE rn = 3) AS chart_top_opp_lawyer_3_cases,
        MAX(nm) FILTER (WHERE rn = 4) AS chart_top_opp_lawyer_4_name,
        MAX(cnt) FILTER (WHERE rn = 4) AS chart_top_opp_lawyer_4_cases,
        MAX(nm) FILTER (WHERE rn = 5) AS chart_top_opp_lawyer_5_name,
        MAX(cnt) FILTER (WHERE rn = 5) AS chart_top_opp_lawyer_5_cases
      FROM ol_ranked
      WHERE rn <= 5
      GROUP BY lawyer_id
    ),
    j_exp AS (
      SELECT lc.lawyer_id, NULLIF(btrim(ju.j), '') AS nm
      FROM lawyer_case lc
      CROSS JOIN LATERAL unnest(COALESCE(lc.judges_arr, ARRAY[]::text[])) AS ju(j)
    ),
    j_counts AS (
      SELECT lawyer_id, nm, COUNT(*)::integer AS cnt
      FROM j_exp
      WHERE nm IS NOT NULL
      GROUP BY lawyer_id, nm
    ),
    j_ranked AS (
      SELECT
        *,
        row_number() OVER (PARTITION BY lawyer_id ORDER BY cnt DESC, nm) AS rn
      FROM j_counts
    ),
    j_pivot AS (
      SELECT
        lawyer_id,
        MAX(nm) FILTER (WHERE rn = 1) AS chart_top_judge_1_name,
        MAX(cnt) FILTER (WHERE rn = 1) AS chart_top_judge_1_cases,
        MAX(nm) FILTER (WHERE rn = 2) AS chart_top_judge_2_name,
        MAX(cnt) FILTER (WHERE rn = 2) AS chart_top_judge_2_cases,
        MAX(nm) FILTER (WHERE rn = 3) AS chart_top_judge_3_name,
        MAX(cnt) FILTER (WHERE rn = 3) AS chart_top_judge_3_cases,
        MAX(nm) FILTER (WHERE rn = 4) AS chart_top_judge_4_name,
        MAX(cnt) FILTER (WHERE rn = 4) AS chart_top_judge_4_cases,
        MAX(nm) FILTER (WHERE rn = 5) AS chart_top_judge_5_name,
        MAX(cnt) FILTER (WHERE rn = 5) AS chart_top_judge_5_cases
      FROM j_ranked
      WHERE rn <= 5
      GROUP BY lawyer_id
    ),
    ol_set AS (
      SELECT
        lc.lawyer_id,
        'opponent_lawyer'::text AS kind,
        NULLIF(btrim(ol.nm), '') AS entity,
        COUNT(*)::integer AS tot,
        COUNT(*) FILTER (WHERE lc.norm_outcome = 'settled')::integer AS st
      FROM lawyer_case lc
      CROSS JOIN LATERAL unnest(lc.opp_lawyer_arr) AS ol(nm)
      WHERE NULLIF(btrim(ol.nm), '') IS NOT NULL
      GROUP BY lc.lawyer_id, NULLIF(btrim(ol.nm), '')
      HAVING COUNT(*) >= 3
    ),
    j_set AS (
      SELECT
        lc.lawyer_id,
        'judge'::text AS kind,
        NULLIF(btrim(ju.nm), '') AS entity,
        COUNT(*)::integer AS tot,
        COUNT(*) FILTER (WHERE lc.norm_outcome = 'settled')::integer AS st
      FROM lawyer_case lc
      CROSS JOIN LATERAL unnest(COALESCE(lc.judges_arr, ARRAY[]::text[])) AS ju(nm)
      WHERE NULLIF(btrim(ju.nm), '') IS NOT NULL
      GROUP BY lc.lawyer_id, NULLIF(btrim(ju.nm), '')
      HAVING COUNT(*) >= 3
    ),
    set_combo AS (
      SELECT
        u.lawyer_id,
        u.kind,
        u.entity,
        u.tot,
        ROUND((100.0 * u.st::numeric / NULLIF(u.tot, 0)), 1) AS pct
      FROM (
        SELECT lawyer_id, kind, entity, tot, st FROM ol_set
        UNION ALL
        SELECT lawyer_id, kind, entity, tot, st FROM j_set
      ) u
    ),
    set_ranked AS (
      SELECT
        *,
        row_number() OVER (PARTITION BY lawyer_id ORDER BY pct DESC NULLS LAST, tot DESC, entity) AS rn
      FROM set_combo
    ),
    set_pivot AS (
      SELECT
        lawyer_id,
        MAX(kind) FILTER (WHERE rn = 1) AS chart_settle_1_kind,
        MAX(entity) FILTER (WHERE rn = 1) AS chart_settle_1_name,
        MAX(pct) FILTER (WHERE rn = 1) AS chart_settle_1_pct,
        MAX(tot) FILTER (WHERE rn = 1) AS chart_settle_1_n,
        MAX(kind) FILTER (WHERE rn = 2) AS chart_settle_2_kind,
        MAX(entity) FILTER (WHERE rn = 2) AS chart_settle_2_name,
        MAX(pct) FILTER (WHERE rn = 2) AS chart_settle_2_pct,
        MAX(tot) FILTER (WHERE rn = 2) AS chart_settle_2_n,
        MAX(kind) FILTER (WHERE rn = 3) AS chart_settle_3_kind,
        MAX(entity) FILTER (WHERE rn = 3) AS chart_settle_3_name,
        MAX(pct) FILTER (WHERE rn = 3) AS chart_settle_3_pct,
        MAX(tot) FILTER (WHERE rn = 3) AS chart_settle_3_n,
        MAX(kind) FILTER (WHERE rn = 4) AS chart_settle_4_kind,
        MAX(entity) FILTER (WHERE rn = 4) AS chart_settle_4_name,
        MAX(pct) FILTER (WHERE rn = 4) AS chart_settle_4_pct,
        MAX(tot) FILTER (WHERE rn = 4) AS chart_settle_4_n,
        MAX(kind) FILTER (WHERE rn = 5) AS chart_settle_5_kind,
        MAX(entity) FILTER (WHERE rn = 5) AS chart_settle_5_name,
        MAX(pct) FILTER (WHERE rn = 5) AS chart_settle_5_pct,
        MAX(tot) FILTER (WHERE rn = 5) AS chart_settle_5_n
      FROM set_ranked
      WHERE rn <= 5
      GROUP BY lawyer_id
    ),
    targets AS (
      SELECT unnest(v_ids) AS lawyer_id
    )
    SELECT
      t.lawyer_id,
      COALESCE(rep.chart_rep_complainant_cases, 0) AS chart_rep_complainant_cases,
      COALESCE(rep.chart_rep_respondent_cases, 0) AS chart_rep_respondent_cases,
      COALESCE(h.chart_hearings_1_5, 0) AS chart_hearings_1_5,
      COALESCE(h.chart_hearings_6_10, 0) AS chart_hearings_6_10,
      COALESCE(h.chart_hearings_11_15, 0) AS chart_hearings_11_15,
      COALESCE(h.chart_hearings_16_plus, 0) AS chart_hearings_16_plus,
      pp.chart_top_party_1_name,
      COALESCE(pp.chart_top_party_1_cases, 0) AS chart_top_party_1_cases,
      pp.chart_top_party_2_name,
      COALESCE(pp.chart_top_party_2_cases, 0) AS chart_top_party_2_cases,
      pp.chart_top_party_3_name,
      COALESCE(pp.chart_top_party_3_cases, 0) AS chart_top_party_3_cases,
      pp.chart_top_party_4_name,
      COALESCE(pp.chart_top_party_4_cases, 0) AS chart_top_party_4_cases,
      pp.chart_top_party_5_name,
      COALESCE(pp.chart_top_party_5_cases, 0) AS chart_top_party_5_cases,
      op.chart_top_opp_lawyer_1_name,
      COALESCE(op.chart_top_opp_lawyer_1_cases, 0) AS chart_top_opp_lawyer_1_cases,
      op.chart_top_opp_lawyer_2_name,
      COALESCE(op.chart_top_opp_lawyer_2_cases, 0) AS chart_top_opp_lawyer_2_cases,
      op.chart_top_opp_lawyer_3_name,
      COALESCE(op.chart_top_opp_lawyer_3_cases, 0) AS chart_top_opp_lawyer_3_cases,
      op.chart_top_opp_lawyer_4_name,
      COALESCE(op.chart_top_opp_lawyer_4_cases, 0) AS chart_top_opp_lawyer_4_cases,
      op.chart_top_opp_lawyer_5_name,
      COALESCE(op.chart_top_opp_lawyer_5_cases, 0) AS chart_top_opp_lawyer_5_cases,
      jp.chart_top_judge_1_name,
      COALESCE(jp.chart_top_judge_1_cases, 0) AS chart_top_judge_1_cases,
      jp.chart_top_judge_2_name,
      COALESCE(jp.chart_top_judge_2_cases, 0) AS chart_top_judge_2_cases,
      jp.chart_top_judge_3_name,
      COALESCE(jp.chart_top_judge_3_cases, 0) AS chart_top_judge_3_cases,
      jp.chart_top_judge_4_name,
      COALESCE(jp.chart_top_judge_4_cases, 0) AS chart_top_judge_4_cases,
      jp.chart_top_judge_5_name,
      COALESCE(jp.chart_top_judge_5_cases, 0) AS chart_top_judge_5_cases,
      sp.chart_settle_1_kind,
      sp.chart_settle_1_name,
      sp.chart_settle_1_pct,
      COALESCE(sp.chart_settle_1_n, 0) AS chart_settle_1_n,
      sp.chart_settle_2_kind,
      sp.chart_settle_2_name,
      sp.chart_settle_2_pct,
      COALESCE(sp.chart_settle_2_n, 0) AS chart_settle_2_n,
      sp.chart_settle_3_kind,
      sp.chart_settle_3_name,
      sp.chart_settle_3_pct,
      COALESCE(sp.chart_settle_3_n, 0) AS chart_settle_3_n,
      sp.chart_settle_4_kind,
      sp.chart_settle_4_name,
      sp.chart_settle_4_pct,
      COALESCE(sp.chart_settle_4_n, 0) AS chart_settle_4_n,
      sp.chart_settle_5_kind,
      sp.chart_settle_5_name,
      sp.chart_settle_5_pct,
      COALESCE(sp.chart_settle_5_n, 0) AS chart_settle_5_n
    FROM targets t
    LEFT JOIN rep ON rep.lawyer_id = t.lawyer_id
    LEFT JOIN hear h ON h.lawyer_id = t.lawyer_id
    LEFT JOIN party_pivot pp ON pp.lawyer_id = t.lawyer_id
    LEFT JOIN ol_pivot op ON op.lawyer_id = t.lawyer_id
    LEFT JOIN j_pivot jp ON jp.lawyer_id = t.lawyer_id
    LEFT JOIN set_pivot sp ON sp.lawyer_id = t.lawyer_id
  ) f
  WHERE la.lawyer_id = f.lawyer_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_refresh_lawyer_analytics_charts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_refresh_lawyer_analytics_charts(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_rebuild_lawyer_analytics_wide()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  CREATE TEMP TABLE tmp_canon_lawyers ON COMMIT DROP AS
  SELECT
    l.id AS lawyer_id,
    l.name AS lawyer_name,
    lower(regexp_replace(regexp_replace(btrim(l.name), '[\u2018\u2019\u201C\u201D]', '''', 'g'), '\s+', ' ', 'g')) AS key_name
  FROM public.lawyers l
  WHERE l.name IS NOT NULL AND btrim(l.name) <> '';
  CREATE INDEX ON tmp_canon_lawyers(key_name);

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
  PERFORM public.admin_refresh_lawyer_analytics_charts(NULL);
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_rebuild_lawyer_analytics_wide() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_rebuild_lawyer_analytics_wide() TO authenticated;

COMMIT;
