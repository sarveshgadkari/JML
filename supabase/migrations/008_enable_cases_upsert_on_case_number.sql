-- 008_enable_cases_upsert_on_case_number.sql
-- Ensures repeated uploads can update existing rows by case_number.

BEGIN;

-- Remove duplicates safely, keeping the most recently updated row per case_number.
WITH ranked AS (
  SELECT
    id,
    case_number,
    row_number() OVER (
      PARTITION BY case_number
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.cases
  WHERE case_number IS NOT NULL
)
DELETE FROM public.cases c
USING ranked r
WHERE c.id = r.id
  AND r.rn > 1;

-- Enforce uniqueness for ON CONFLICT upsert support.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cases_case_number ON public.cases(case_number);

COMMIT;
