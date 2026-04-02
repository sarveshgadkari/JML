-- AI key pool + dynamic thread orchestration support

CREATE TABLE IF NOT EXISTS public.ai_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar NOT NULL,
  key_value text NOT NULL,
  status varchar NOT NULL DEFAULT 'ACTIVE',
  cooldown_until timestamptz NULL,
  daily_usage_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_keys_status_check CHECK (status IN ('ACTIVE', 'COOLDOWN'))
);

CREATE INDEX IF NOT EXISTS idx_ai_keys_provider_status ON public.ai_keys (provider, status, cooldown_until);

ALTER TABLE public.ai_threads
ADD COLUMN IF NOT EXISTS current_batch_size integer,
ADD COLUMN IF NOT EXISTS consecutive_errors integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS assigned_key_id uuid NULL REFERENCES public.ai_keys(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS rpd_limit integer NOT NULL DEFAULT 100;

UPDATE public.ai_threads
SET current_batch_size = COALESCE(current_batch_size, batch_size),
    consecutive_errors = COALESCE(consecutive_errors, 0),
    rpd_limit = COALESCE(rpd_limit, 100)
WHERE current_batch_size IS NULL
   OR consecutive_errors IS NULL
   OR rpd_limit IS NULL;

ALTER TABLE public.ai_threads
ALTER COLUMN current_batch_size SET DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ai_keys_updated_at'
  ) THEN
    CREATE TRIGGER trg_ai_keys_updated_at
    BEFORE UPDATE ON public.ai_keys
    FOR EACH ROW
    EXECUTE FUNCTION public.set_row_updated_at();
  END IF;
END$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_keys TO authenticated;
