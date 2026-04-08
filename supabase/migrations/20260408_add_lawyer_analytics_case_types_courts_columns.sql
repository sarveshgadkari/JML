BEGIN;

ALTER TABLE public.lawyer_analytics
  ADD COLUMN IF NOT EXISTS case_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS courts text[] NOT NULL DEFAULT ARRAY[]::text[];

COMMIT;
