-- 023_ensure_unique_index_case_number_skip_sync.sql
-- Ensure `public.cases(case_number)` is unique so ON CONFLICT (case_number) works.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'cases'
      AND column_name = 'case_number'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_cases_case_number ON public.cases(case_number);
  END IF;
END;
$$;

COMMIT;

