-- 009_merge_similar_names_and_harden_sync.sql
-- Merge similar lawyer/judge names into one card and prevent future duplicates
-- by using canonicalized name matching in sync + trigger logic.

BEGIN;

CREATE OR REPLACE FUNCTION public.canonical_person_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        lower(coalesce(p_name, '')),
        '\m(advocate|adv|mr|mrs|ms|miss|dr|justice|hon|hon''ble|shri|smt)\M\.?',
        '',
        'gi'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.sync_reference_tables_from_cases(p_cleanup_demo boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.courts (name)
  SELECT DISTINCT btrim(c.court_name)
  FROM public.cases c
  WHERE c.court_name IS NOT NULL AND btrim(c.court_name) <> ''
  ON CONFLICT (name) DO NOTHING;

  -- Insert judges by canonical name so minor variations collapse into one row.
  INSERT INTO public.judges (name)
  SELECT s.display_name
  FROM (
    SELECT
      public.canonical_person_name(c.judge_name) AS canonical_name,
      MIN(btrim(c.judge_name)) AS display_name
    FROM public.cases c
    WHERE c.judge_name IS NOT NULL AND btrim(c.judge_name) <> ''
    GROUP BY public.canonical_person_name(c.judge_name)
  ) s
  WHERE s.canonical_name <> ''
    AND NOT EXISTS (
      SELECT 1
      FROM public.judges j
      WHERE public.canonical_person_name(j.name) = s.canonical_name
    );

  -- Insert lawyers by canonical name; synthetic email uses canonical hash.
  INSERT INTO public.lawyers (name, email, is_verified, is_admin)
  SELECT
    s.display_name,
    'import+' || md5(s.canonical_name) || '@judge-my-lawyer.local' AS email,
    false,
    false
  FROM (
    SELECT
      public.canonical_person_name(c.lawyer_name) AS canonical_name,
      MIN(btrim(c.lawyer_name)) AS display_name
    FROM public.cases c
    WHERE c.lawyer_name IS NOT NULL AND btrim(c.lawyer_name) <> ''
    GROUP BY public.canonical_person_name(c.lawyer_name)
  ) s
  WHERE s.canonical_name <> ''
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name;

  UPDATE public.cases c
  SET court_id = co.id
  FROM public.courts co
  WHERE co.name = btrim(c.court_name)
    AND c.court_name IS NOT NULL
    AND btrim(c.court_name) <> ''
    AND c.court_id IS DISTINCT FROM co.id;

  UPDATE public.cases c
  SET
    judge_id = (
      SELECT j1.id
      FROM public.judges j1
      WHERE public.canonical_person_name(j1.name) = public.canonical_person_name(c.judge_name)
      ORDER BY j1.created_at ASC NULLS LAST, j1.id ASC
      LIMIT 1
    ),
    judge_name = (
      SELECT j1.name
      FROM public.judges j1
      WHERE public.canonical_person_name(j1.name) = public.canonical_person_name(c.judge_name)
      ORDER BY j1.created_at ASC NULLS LAST, j1.id ASC
      LIMIT 1
    )
  WHERE c.judge_name IS NOT NULL
    AND btrim(c.judge_name) <> ''
    AND EXISTS (
      SELECT 1
      FROM public.judges jx
      WHERE public.canonical_person_name(jx.name) = public.canonical_person_name(c.judge_name)
    );

  UPDATE public.cases c
  SET
    lawyer_id = (
      SELECT l1.id
      FROM public.lawyers l1
      WHERE public.canonical_person_name(l1.name) = public.canonical_person_name(c.lawyer_name)
      ORDER BY (l1.user_id IS NOT NULL) DESC, l1.created_at ASC NULLS LAST, l1.id ASC
      LIMIT 1
    ),
    lawyer_name = (
      SELECT l1.name
      FROM public.lawyers l1
      WHERE public.canonical_person_name(l1.name) = public.canonical_person_name(c.lawyer_name)
      ORDER BY (l1.user_id IS NOT NULL) DESC, l1.created_at ASC NULLS LAST, l1.id ASC
      LIMIT 1
    )
  WHERE c.lawyer_name IS NOT NULL
    AND btrim(c.lawyer_name) <> ''
    AND EXISTS (
      SELECT 1
      FROM public.lawyers lx
      WHERE public.canonical_person_name(lx.name) = public.canonical_person_name(c.lawyer_name)
    );

  -- Merge duplicate judges by canonical name.
  WITH ranked_judges AS (
    SELECT
      j.id,
      public.canonical_person_name(j.name) AS canonical_name,
      first_value(j.id) OVER (
        PARTITION BY public.canonical_person_name(j.name)
        ORDER BY j.created_at ASC NULLS LAST, j.id ASC
      ) AS keep_id,
      row_number() OVER (
        PARTITION BY public.canonical_person_name(j.name)
        ORDER BY j.created_at ASC NULLS LAST, j.id ASC
      ) AS rn
    FROM public.judges j
    WHERE public.canonical_person_name(j.name) <> ''
  )
  UPDATE public.cases c
  SET judge_id = r.keep_id
  FROM ranked_judges r
  WHERE c.judge_id = r.id
    AND r.rn > 1;

  WITH ranked_judges AS (
    SELECT
      j.id,
      row_number() OVER (
        PARTITION BY public.canonical_person_name(j.name)
        ORDER BY j.created_at ASC NULLS LAST, j.id ASC
      ) AS rn
    FROM public.judges j
    WHERE public.canonical_person_name(j.name) <> ''
  )
  DELETE FROM public.judges j
  USING ranked_judges r
  WHERE j.id = r.id
    AND r.rn > 1
    AND NOT EXISTS (SELECT 1 FROM public.cases c WHERE c.judge_id = j.id);

  -- Merge duplicate lawyers by canonical name.
  WITH ranked_lawyers AS (
    SELECT
      l.id,
      public.canonical_person_name(l.name) AS canonical_name,
      first_value(l.id) OVER (
        PARTITION BY public.canonical_person_name(l.name)
        ORDER BY (l.user_id IS NOT NULL) DESC, l.created_at ASC NULLS LAST, l.id ASC
      ) AS keep_id,
      row_number() OVER (
        PARTITION BY public.canonical_person_name(l.name)
        ORDER BY (l.user_id IS NOT NULL) DESC, l.created_at ASC NULLS LAST, l.id ASC
      ) AS rn
    FROM public.lawyers l
    WHERE public.canonical_person_name(l.name) <> ''
  )
  UPDATE public.cases c
  SET lawyer_id = r.keep_id
  FROM ranked_lawyers r
  WHERE c.lawyer_id = r.id
    AND r.rn > 1;

  WITH ranked_lawyers AS (
    SELECT
      l.id,
      row_number() OVER (
        PARTITION BY public.canonical_person_name(l.name)
        ORDER BY (l.user_id IS NOT NULL) DESC, l.created_at ASC NULLS LAST, l.id ASC
      ) AS rn
    FROM public.lawyers l
    WHERE public.canonical_person_name(l.name) <> ''
  )
  DELETE FROM public.lawyers l
  USING ranked_lawyers r
  WHERE l.id = r.id
    AND r.rn > 1
    AND l.user_id IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.cases c WHERE c.lawyer_id = l.id)
    AND NOT EXISTS (SELECT 1 FROM public.saved_lawyers sl WHERE sl.lawyer_id = l.id)
    AND NOT EXISTS (SELECT 1 FROM public.consultation_requests cr WHERE cr.lawyer_id = l.id)
    AND NOT EXISTS (SELECT 1 FROM public.card_claims cc WHERE cc.lawyer_id = l.id OR cc.reviewed_by = l.id)
    AND NOT EXISTS (SELECT 1 FROM public.case_claims ccl WHERE ccl.lawyer_id = l.id OR ccl.reviewed_by = l.id);

  IF p_cleanup_demo THEN
    DELETE FROM public.courts
    WHERE id NOT IN (
      SELECT DISTINCT court_id FROM public.cases WHERE court_id IS NOT NULL
    );
  END IF;
END;
$$;

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

DROP TRIGGER IF EXISTS trg_cases_sync_reference_tables ON public.cases;

CREATE TRIGGER trg_cases_sync_reference_tables
BEFORE INSERT OR UPDATE OF court_name, judge_name, lawyer_name
ON public.cases
FOR EACH ROW
EXECUTE FUNCTION public.sync_reference_tables_from_cases_trigger();

-- Run once now to merge existing duplicates and relink cases.
SELECT public.sync_reference_tables_from_cases(false);

COMMIT;
