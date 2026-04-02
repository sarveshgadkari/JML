-- Fix key-pool rollout by creating ai_keys and backfilling from existing ai_threads.api_key_secret
-- This preserves the existing key/model storage (ai_threads) and enables the new key-pool features.

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
ADD COLUMN IF NOT EXISTS assigned_key_id uuid NULL,
ADD COLUMN IF NOT EXISTS rpd_limit integer NOT NULL DEFAULT 100;

-- Add FK if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ai_threads_assigned_key_id_fkey'
  ) THEN
    ALTER TABLE public.ai_threads
    ADD CONSTRAINT ai_threads_assigned_key_id_fkey
    FOREIGN KEY (assigned_key_id) REFERENCES public.ai_keys(id) ON DELETE SET NULL;
  END IF;
END$$;

-- Ensure current_batch_size is initialized for existing threads
UPDATE public.ai_threads
SET current_batch_size = COALESCE(current_batch_size, batch_size),
    consecutive_errors = COALESCE(consecutive_errors, 0),
    rpd_limit = COALESCE(rpd_limit, 100)
WHERE current_batch_size IS NULL
   OR consecutive_errors IS NULL
   OR rpd_limit IS NULL;

-- Backfill ai_keys from existing threads (provider + api_key_secret)
INSERT INTO public.ai_keys (provider, key_value, status, cooldown_until, daily_usage_count)
SELECT DISTINCT
  t.provider,
  t.api_key_secret,
  'ACTIVE'::varchar,
  NULL::timestamptz,
  0::integer
FROM public.ai_threads t
WHERE t.api_key_secret IS NOT NULL
  AND length(trim(t.api_key_secret)) > 0
ON CONFLICT DO NOTHING;

-- Assign each thread to its corresponding ai_keys row (same provider + key)
UPDATE public.ai_threads t
SET assigned_key_id = k.id
FROM public.ai_keys k
WHERE t.assigned_key_id IS NULL
  AND k.provider = t.provider
  AND k.key_value = t.api_key_secret;

-- updated_at trigger for ai_keys if your generic trigger function exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_row_updated_at' AND pg_function_is_visible(oid)) THEN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ai_keys_updated_at') THEN
      CREATE TRIGGER trg_ai_keys_updated_at
      BEFORE UPDATE ON public.ai_keys
      FOR EACH ROW
      EXECUTE FUNCTION public.set_row_updated_at();
    END IF;
  END IF;
END$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_keys TO authenticated;
