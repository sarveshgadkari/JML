BEGIN;

CREATE OR REPLACE FUNCTION public.admin_merge_duplicate_reference_cards()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_merged_lawyers integer := 0;
  v_merged_judges integer := 0;
BEGIN
  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  CREATE TEMP TABLE tmp_ranked_lawyers ON COMMIT DROP AS
  SELECT
    l.id,
    first_value(l.id) OVER (
      PARTITION BY public.canonical_person_name(l.name)
      ORDER BY (l.user_id IS NOT NULL) DESC, l.created_at ASC NULLS LAST, l.id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY public.canonical_person_name(l.name)
      ORDER BY (l.user_id IS NOT NULL) DESC, l.created_at ASC NULLS LAST, l.id ASC
    ) AS rn
  FROM public.lawyers l
  WHERE public.canonical_person_name(l.name) <> '';

  UPDATE public.saved_lawyers sl
  SET lawyer_id = rl.keep_id
  FROM tmp_ranked_lawyers rl
  WHERE sl.lawyer_id = rl.id
    AND rl.rn > 1
    AND sl.lawyer_id <> rl.keep_id;

  UPDATE public.consultation_requests cr
  SET lawyer_id = rl.keep_id
  FROM tmp_ranked_lawyers rl
  WHERE cr.lawyer_id = rl.id
    AND rl.rn > 1
    AND cr.lawyer_id <> rl.keep_id;

  UPDATE public.card_claims cc
  SET lawyer_id = rl.keep_id
  FROM tmp_ranked_lawyers rl
  WHERE cc.lawyer_id = rl.id
    AND rl.rn > 1
    AND cc.lawyer_id <> rl.keep_id;

  UPDATE public.card_claims cc
  SET reviewed_by = rl.keep_id
  FROM tmp_ranked_lawyers rl
  WHERE cc.reviewed_by = rl.id
    AND rl.rn > 1
    AND cc.reviewed_by <> rl.keep_id;

  UPDATE public.case_claims cc
  SET lawyer_id = rl.keep_id
  FROM tmp_ranked_lawyers rl
  WHERE cc.lawyer_id = rl.id
    AND rl.rn > 1
    AND cc.lawyer_id <> rl.keep_id;

  UPDATE public.case_claims cc
  SET reviewed_by = rl.keep_id
  FROM tmp_ranked_lawyers rl
  WHERE cc.reviewed_by = rl.id
    AND rl.rn > 1
    AND cc.reviewed_by <> rl.keep_id;

  UPDATE public.cases c
  SET lawyer_id = rl.keep_id
  FROM tmp_ranked_lawyers rl
  WHERE c.lawyer_id = rl.id
    AND rl.rn > 1
    AND c.lawyer_id <> rl.keep_id;

  DELETE FROM public.lawyers l
  USING tmp_ranked_lawyers rl
  WHERE l.id = rl.id
    AND rl.rn > 1;

  GET DIAGNOSTICS v_merged_lawyers = ROW_COUNT;

  CREATE TEMP TABLE tmp_ranked_judges ON COMMIT DROP AS
  SELECT
    j.id,
    first_value(j.id) OVER (
      PARTITION BY public.canonical_person_name(j.name)
      ORDER BY j.created_at ASC NULLS LAST, j.id ASC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY public.canonical_person_name(j.name)
      ORDER BY j.created_at ASC NULLS LAST, j.id ASC
    ) AS rn
  FROM public.judges j
  WHERE public.canonical_person_name(j.name) <> '';

  UPDATE public.cases c
  SET judge_id = rj.keep_id
  FROM tmp_ranked_judges rj
  WHERE c.judge_id = rj.id
    AND rj.rn > 1
    AND c.judge_id <> rj.keep_id;

  DELETE FROM public.judges j
  USING tmp_ranked_judges rj
  WHERE j.id = rj.id
    AND rj.rn > 1;

  GET DIAGNOSTICS v_merged_judges = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok', true,
    'merged_lawyers', v_merged_lawyers,
    'merged_judges', v_merged_judges
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_merge_duplicate_reference_cards() TO authenticated;

COMMIT;
