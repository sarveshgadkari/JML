-- Queue of extracted cases that should be included in the next "table analysis" run.
-- Workers only append to this queue; the admin manually triggers the analysis run and
-- clears only the items processed in that run.

BEGIN;

CREATE TABLE IF NOT EXISTS public.table_analysis_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number text NOT NULL,
  added_by_thread_id uuid NULL,
  inserted_at timestamptz NOT NULL DEFAULT now()
);

-- Avoid unbounded duplicates while workers are running.
-- If you want to keep duplicates, remove this unique index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_table_analysis_queue_case_number
  ON public.table_analysis_queue(case_number);

CREATE INDEX IF NOT EXISTS idx_table_analysis_queue_inserted_at
  ON public.table_analysis_queue(inserted_at);

COMMIT;

