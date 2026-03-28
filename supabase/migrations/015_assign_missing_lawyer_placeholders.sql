-- 015_assign_missing_lawyer_placeholders.sql
-- Assign cases with missing lawyer to dedicated placeholder lawyer cards.

BEGIN;

CREATE OR REPLACE FUNCTION public.default_lawyer_placeholder_name(p_side text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN lower(coalesce(p_side, '')) LIKE '%respondent%'
      OR lower(coalesce(p_side, '')) LIKE '%defendant%'
      OR lower(coalesce(p_side, '')) LIKE '%accused%'
    THEN 'Respondent without a Lawyer'
    ELSE 'Complainant without a lawyer'
  END
$$;

-- Ensure both placeholder lawyer cards always exist.
INSERT INTO public.lawyers (name, email, is_verified, is_admin)
VALUES
  ('Complainant without a lawyer', 'import+' || md5('complainant without a lawyer') || '@judge-my-lawyer.local', false, false),
  ('Respondent without a Lawyer', 'import+' || md5('respondent without a lawyer') || '@judge-my-lawyer.local', false, false)
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name;

-- Backfill missing lawyer_name values on existing cases.
UPDATE public.cases c
SET lawyer_name = public.default_lawyer_placeholder_name(c.lawyer_side)
WHERE c.lawyer_name IS NULL
   OR btrim(c.lawyer_name) = ''
   OR lower(btrim(c.lawyer_name)) IN ('unknown', 'unknown lawyer', 'na', 'n/a', 'not available');

-- Re-link lawyer_id from (possibly newly filled) lawyer_name.
UPDATE public.cases c
SET lawyer_id = l.id
FROM public.lawyers l
WHERE public.canonical_person_name(l.name) = public.canonical_person_name(c.lawyer_name)
  AND c.lawyer_name IS NOT NULL
  AND btrim(c.lawyer_name) <> ''
  AND c.lawyer_id IS DISTINCT FROM l.id;

CREATE OR REPLACE FUNCTION public.sync_reference_tables_from_cases_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_court_id uuid;
  v_judge_id uuid;
  v_lawyer_id uuid;
  v_name text;
  v_canonical text;
BEGIN
  IF NEW.court_name IS NOT NULL AND btrim(NEW.court_name) <> '' THEN
    v_name := btrim(NEW.court_name);
    INSERT INTO public.courts (name)
    VALUES (v_name)
    ON CONFLICT (name) DO UPDATE
      SET name = EXCLUDED.name
    RETURNING id INTO v_court_id;
    NEW.court_id := v_court_id;
  END IF;

  IF NEW.judge_name IS NOT NULL AND btrim(NEW.judge_name) <> '' THEN
    v_name := btrim(NEW.judge_name);
    v_canonical := public.canonical_person_name(v_name);

    SELECT j.id INTO v_judge_id
    FROM public.judges j
    WHERE public.canonical_person_name(j.name) = v_canonical
    ORDER BY j.created_at ASC NULLS LAST, j.id ASC
    LIMIT 1;

    IF v_judge_id IS NULL THEN
      INSERT INTO public.judges (name)
      VALUES (v_name)
      RETURNING id INTO v_judge_id;
    END IF;

    NEW.judge_id := v_judge_id;
  END IF;

  IF NEW.lawyer_name IS NULL
     OR btrim(NEW.lawyer_name) = ''
     OR lower(btrim(NEW.lawyer_name)) IN ('unknown', 'unknown lawyer', 'na', 'n/a', 'not available') THEN
    NEW.lawyer_name := public.default_lawyer_placeholder_name(NEW.lawyer_side);
  END IF;

  IF NEW.lawyer_name IS NOT NULL AND btrim(NEW.lawyer_name) <> '' THEN
    v_name := btrim(NEW.lawyer_name);
    v_canonical := public.canonical_person_name(v_name);

    SELECT l.id INTO v_lawyer_id
    FROM public.lawyers l
    WHERE public.canonical_person_name(l.name) = v_canonical
    ORDER BY (l.user_id IS NOT NULL) DESC, l.created_at ASC NULLS LAST, l.id ASC
    LIMIT 1;

    IF v_lawyer_id IS NULL THEN
      INSERT INTO public.lawyers (name, email, is_verified, is_admin)
      VALUES (
        v_name,
        'import+' || md5(v_canonical) || '@judge-my-lawyer.local',
        false,
        false
      )
      ON CONFLICT (email) DO UPDATE
        SET name = EXCLUDED.name
      RETURNING id INTO v_lawyer_id;
    END IF;

    NEW.lawyer_id := v_lawyer_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-run sync so placeholder lawyer ids are fully linked.
SELECT public.sync_reference_tables_from_cases(false);

COMMIT;
