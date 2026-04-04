BEGIN;

-- Extend canonicalization to collapse extra tokens in extracted names.
CREATE OR REPLACE FUNCTION public.canonical_person_name(p_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT btrim(
    regexp_replace(
      regexp_replace(
        lower(coalesce(p_name, '')),
        '\m(advocate|adv|mr|mrs|ms|miss|dr|justice|hon|hon''ble|shri|smt|ld|chairperson|maharera)\M\.?',
        '',
        'gi'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

-- Reference-backed initial-to-full resolution:
-- If the normalized input ends with a 1-letter token (e.g. "abir p"),
-- attempt to find the best matching existing card (lawyer/judge) whose last token starts with that initial.
CREATE OR REPLACE FUNCTION public.canonical_person_name_with_initial_resolution(
  p_name text,
  p_role text
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_cleaned text;
  v_tokens text[];
  v_n integer;
  v_base text;
  v_initial text;
  v_match_key text;
BEGIN
  v_cleaned := public.canonical_person_name(p_name);
  IF v_cleaned IS NULL OR btrim(v_cleaned) = '' THEN
    RETURN v_cleaned;
  END IF;

  v_tokens := regexp_split_to_array(v_cleaned, '\s+');
  v_n := array_length(v_tokens, 1);

  IF v_n IS NULL OR v_n < 2 THEN
    RETURN v_cleaned;
  END IF;

  IF char_length(v_tokens[v_n]) = 1 THEN
    v_base := array_to_string(v_tokens[1:v_n-1], ' ');
    v_initial := v_tokens[v_n];

    IF p_role = 'lawyer' THEN
      SELECT public.canonical_person_name(l.name)
        INTO v_match_key
      FROM public.lawyers l
      WHERE public.canonical_person_name(l.name) <> ''
        AND public.canonical_person_name(l.name) LIKE (v_base || ' ' || v_initial || '%')
      ORDER BY
        length(
          split_part(
            public.canonical_person_name(l.name),
            ' ',
            array_length(regexp_split_to_array(public.canonical_person_name(l.name), '\s+'), 1)
          )
        ) DESC,
        l.created_at ASC NULLS LAST,
        l.id ASC
      LIMIT 1;
    ELSIF p_role = 'judge' THEN
      SELECT public.canonical_person_name(j.name)
        INTO v_match_key
      FROM public.judges j
      WHERE public.canonical_person_name(j.name) <> ''
        AND public.canonical_person_name(j.name) LIKE (v_base || ' ' || v_initial || '%')
      ORDER BY
        length(
          split_part(
            public.canonical_person_name(j.name),
            ' ',
            array_length(regexp_split_to_array(public.canonical_person_name(j.name), '\s+'), 1)
          )
        ) DESC,
        j.created_at ASC NULLS LAST,
        j.id ASC
      LIMIT 1;
    END IF;
  END IF;

  RETURN COALESCE(v_match_key, v_cleaned);
END;
$$;

COMMIT;

