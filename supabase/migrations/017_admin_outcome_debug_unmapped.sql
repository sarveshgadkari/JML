-- 017_admin_outcome_debug_unmapped.sql
-- Debug tool: show raw outcome distribution and top unmapped outcomes.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_outcome_debug(p_limit integer DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_limit integer := GREATEST(1, LEAST(COALESCE(p_limit, 50), 200));
  v_non_null bigint := 0;
  v_norm_non_null bigint := 0;
  v_top_raw jsonb := '[]'::jsonb;
  v_top_unmapped jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE c.outcome IS NOT NULL AND btrim(c.outcome) <> ''),
    COUNT(*) FILTER (WHERE public.normalize_case_outcome(c.outcome, c.status, c.summary) IS NOT NULL)
  INTO v_non_null, v_norm_non_null
  FROM public.cases c;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('raw_outcome', raw_outcome, 'count', cnt)), '[]'::jsonb)
  INTO v_top_raw
  FROM (
    SELECT lower(btrim(c.outcome)) AS raw_outcome, COUNT(*) AS cnt
    FROM public.cases c
    WHERE c.outcome IS NOT NULL AND btrim(c.outcome) <> ''
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT v_limit
  ) t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('raw_outcome', raw_outcome, 'count', cnt)), '[]'::jsonb)
  INTO v_top_unmapped
  FROM (
    SELECT lower(btrim(c.outcome)) AS raw_outcome, COUNT(*) AS cnt
    FROM public.cases c
    WHERE c.outcome IS NOT NULL
      AND btrim(c.outcome) <> ''
      AND public.normalize_case_outcome(c.outcome, c.status, c.summary) IS NULL
    GROUP BY 1
    ORDER BY cnt DESC
    LIMIT v_limit
  ) u;

  RETURN jsonb_build_object(
    'ok', true,
    'non_null_outcome_rows', v_non_null,
    'normalized_non_null_rows', v_norm_non_null,
    'top_raw_outcomes', v_top_raw,
    'top_unmapped_raw_outcomes', v_top_unmapped
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_outcome_debug(integer) TO authenticated;

COMMIT;

