-- Ensure one API key can be assigned to only one thread at a time.
-- Multiple NULLs are allowed; non-NULL assigned_key_id must be unique.

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_threads_assigned_key_id
  ON public.ai_threads(assigned_key_id)
  WHERE assigned_key_id IS NOT NULL;

COMMIT;

