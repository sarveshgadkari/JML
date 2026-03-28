-- 016_admin_outcome_analysis_tool.sql
-- Add lightweight admin analysis RPC for outcome quality/proportion checks.

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_outcome_analysis()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total bigint := 0;
  v_classified bigint := 0;
  v_comp bigint := 0;
  v_resp bigint := 0;
  v_settled bigint := 0;
  v_dismissed bigint := 0;
  v_withdrawn bigint := 0;
  v_partial bigint := 0;
  v_unknown bigint := 0;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  WITH x AS (
    SELECT public.normalize_case_outcome(c.outcome, c.status, c.summary) AS o
    FROM public.cases c
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE o IS NOT NULL),
    COUNT(*) FILTER (WHERE o = 'in favor of complainant'),
    COUNT(*) FILTER (WHERE o IN ('in favor of respondent')),
    COUNT(*) FILTER (WHERE o = 'settled'),
    COUNT(*) FILTER (WHERE o = 'dismissed'),
    COUNT(*) FILTER (WHERE o = 'withdrawn'),
    COUNT(*) FILTER (WHERE o = 'partially granted'),
    COUNT(*) FILTER (WHERE o IS NULL)
  INTO v_total, v_classified, v_comp, v_resp, v_settled, v_dismissed, v_withdrawn, v_partial, v_unknown
  FROM x;

  RETURN jsonb_build_object(
    'ok', true,
    'total_cases', v_total,
    'classified_cases', v_classified,
    'unknown_cases', v_unknown,
    'outcomes', jsonb_build_object(
      'in_favor_of_complainant', v_comp,
      'in_favor_of_respondent', v_resp,
      'settled', v_settled,
      'dismissed', v_dismissed,
      'withdrawn', v_withdrawn,
      'partially_granted', v_partial
    ),
    'three_outcome_base', jsonb_build_object(
      'count', (v_comp + v_resp + v_settled),
      'complainant_pct', ROUND((v_comp * 100.0) / NULLIF((v_comp + v_resp + v_settled), 0), 2),
      'respondent_pct', ROUND((v_resp * 100.0) / NULLIF((v_comp + v_resp + v_settled), 0), 2),
      'settled_pct', ROUND((v_settled * 100.0) / NULLIF((v_comp + v_resp + v_settled), 0), 2)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_outcome_analysis() TO authenticated;

COMMIT;
