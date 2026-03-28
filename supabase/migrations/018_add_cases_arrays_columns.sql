-- 018_add_cases_arrays_columns.sql
-- Add multi-judge / multi-lawyer JSONB columns to master cases table.

BEGIN;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS judges jsonb;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS petitioner_lawyers jsonb;

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS respondent_lawyers jsonb;

COMMIT;

