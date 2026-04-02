BEGIN;

ALTER TABLE public.ai_threads
  ADD COLUMN IF NOT EXISTS worker_state text,
  ADD COLUMN IF NOT EXISTS worker_last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS worker_claimed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS worker_processed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS worker_current_batch_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS worker_popup_id text,
  ADD COLUMN IF NOT EXISTS worker_error text;

COMMIT;
