-- 007_auto_sync_reference_tables_from_cases.sql
-- Keeps courts/judges/lawyers populated from the master `cases` table.
-- Also updates `cases.court_id`, `cases.judge_id`, `cases.lawyer_id` automatically.

BEGIN;

CREATE OR REPLACE FUNCTION public.sync_reference_tables_from_cases(p_cleanup_demo boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Populate courts from case denormalized names
  INSERT INTO public.courts (name)
  SELECT DISTINCT btrim(c.court_name)
  FROM public.cases c
  WHERE c.court_name IS NOT NULL AND btrim(c.court_name) <> ''
  ON CONFLICT (name) DO NOTHING;

  -- Populate judges from case denormalized names
  INSERT INTO public.judges (name)
  SELECT DISTINCT btrim(c.judge_name)
  FROM public.cases c
  WHERE c.judge_name IS NOT NULL AND btrim(c.judge_name) <> '';

  -- Populate lawyers from case denormalized names.
  -- Imported records use deterministic synthetic emails to satisfy NOT NULL + UNIQUE.
  INSERT INTO public.lawyers (name, email, is_verified, is_admin)
  SELECT
    x.name,
    x.email,
    false AS is_verified,
    false AS is_admin
  FROM (
    SELECT
      MIN(btrim(c.lawyer_name)) AS name,
      'import+' || md5(lower(btrim(c.lawyer_name))) || '@judge-my-lawyer.local' AS email
    FROM public.cases c
    WHERE c.lawyer_name IS NOT NULL AND btrim(c.lawyer_name) <> ''
    GROUP BY 'import+' || md5(lower(btrim(c.lawyer_name))) || '@judge-my-lawyer.local'
  ) x
  ON CONFLICT (email) DO UPDATE
    SET name = EXCLUDED.name;

  -- Backfill foreign keys in master table
  UPDATE public.cases c
  SET court_id = co.id
  FROM public.courts co
  WHERE co.name = btrim(c.court_name)
    AND c.court_name IS NOT NULL
    AND btrim(c.court_name) <> ''
    AND c.court_id IS DISTINCT FROM co.id;

  UPDATE public.cases c
  SET judge_id = j.id
  FROM public.judges j
  WHERE j.name = btrim(c.judge_name)
    AND c.judge_name IS NOT NULL
    AND btrim(c.judge_name) <> ''
    AND c.judge_id IS DISTINCT FROM j.id;

  UPDATE public.cases c
  SET lawyer_id = l.id
  FROM public.lawyers l
  WHERE l.email = 'import+' || md5(lower(btrim(c.lawyer_name))) || '@judge-my-lawyer.local'
    AND c.lawyer_name IS NOT NULL
    AND btrim(c.lawyer_name) <> ''
    AND c.lawyer_id IS DISTINCT FROM l.id;

  -- Optional cleanup for older demo seed rows not linked from current cases.
  IF p_cleanup_demo THEN
    DELETE FROM public.courts
    WHERE id NOT IN (
      SELECT DISTINCT court_id FROM public.cases WHERE court_id IS NOT NULL
    );

    DELETE FROM public.judges
    WHERE id NOT IN (
      SELECT DISTINCT judge_id FROM public.cases WHERE judge_id IS NOT NULL
    );

    DELETE FROM public.lawyers l
    WHERE l.user_id IS NULL
      AND l.email LIKE 'import+%@judge-my-lawyer.local'
      AND l.id NOT IN (
        SELECT DISTINCT lawyer_id FROM public.cases WHERE lawyer_id IS NOT NULL
      )
      AND NOT EXISTS (SELECT 1 FROM public.saved_lawyers sl WHERE sl.lawyer_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM public.consultation_requests cr WHERE cr.lawyer_id = l.id)
      AND NOT EXISTS (SELECT 1 FROM public.card_claims cc WHERE cc.lawyer_id = l.id OR cc.reviewed_by = l.id)
      AND NOT EXISTS (SELECT 1 FROM public.case_claims ccl WHERE ccl.lawyer_id = l.id OR ccl.reviewed_by = l.id);
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
    SELECT id INTO v_judge_id
    FROM public.judges
    WHERE name = v_name
    ORDER BY created_at ASC
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
    INSERT INTO public.lawyers (name, email, is_verified, is_admin)
    VALUES (
      v_name,
      'import+' || md5(lower(v_name)) || '@judge-my-lawyer.local',
      false,
      false
    )
    ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name
    RETURNING id INTO v_lawyer_id;
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

-- One-time bootstrap: delete stale demo-like rows and repopulate from current cases.
SELECT public.sync_reference_tables_from_cases(true);

COMMIT;
