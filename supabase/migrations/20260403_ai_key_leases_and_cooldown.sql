-- Enforce strict AI key leasing so a key can only be used by one thread at a time.

ALTER TABLE public.ai_keys
  ADD COLUMN IF NOT EXISTS assigned_thread_id uuid NULL REFERENCES public.ai_threads(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz NULL;

UPDATE public.ai_keys k
SET assigned_thread_id = t.id,
    assigned_at = COALESCE(k.assigned_at, now()),
    status = 'IN_USE',
    updated_at = now()
FROM public.ai_threads t
WHERE t.assigned_key_id = k.id
  AND t.assigned_key_id IS NOT NULL;

ALTER TABLE public.ai_keys
  DROP CONSTRAINT IF EXISTS ai_keys_status_check;

ALTER TABLE public.ai_keys
  ADD CONSTRAINT ai_keys_status_check CHECK (status IN ('ACTIVE', 'IN_USE', 'COOLDOWN'));

CREATE INDEX IF NOT EXISTS idx_ai_keys_provider_status_lease
  ON public.ai_keys (provider, status, cooldown_until, assigned_thread_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_keys_assigned_thread_id
  ON public.ai_keys (assigned_thread_id)
  WHERE assigned_thread_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_ai_key_for_thread(
  p_provider text,
  p_thread_id uuid,
  p_exclude_key_id uuid DEFAULT NULL
)
RETURNS public.ai_keys
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_row public.ai_keys;
BEGIN
  WITH candidate AS (
    SELECT k.id
    FROM public.ai_keys k
    WHERE k.provider = p_provider
      AND k.status = 'ACTIVE'
      AND k.assigned_thread_id IS NULL
      AND (k.cooldown_until IS NULL OR k.cooldown_until <= now())
      AND (p_exclude_key_id IS NULL OR k.id <> p_exclude_key_id)
    ORDER BY k.daily_usage_count ASC, k.updated_at ASC, k.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT 1
  )
  UPDATE public.ai_keys k
  SET status = 'IN_USE',
      assigned_thread_id = p_thread_id,
      assigned_at = now(),
      updated_at = now()
  FROM candidate c
  WHERE k.id = c.id
  RETURNING k.* INTO claimed_row;

  RETURN claimed_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_ai_key_for_thread(
  p_thread_id uuid,
  p_cooldown_until timestamptz DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  released_count integer := 0;
  normalized_cooldown timestamptz := NULL;
BEGIN
  IF p_cooldown_until IS NOT NULL AND p_cooldown_until > now() THEN
    normalized_cooldown := p_cooldown_until;
  END IF;

  UPDATE public.ai_keys
  SET status = CASE WHEN normalized_cooldown IS NULL THEN 'ACTIVE' ELSE 'COOLDOWN' END,
      cooldown_until = normalized_cooldown,
      assigned_thread_id = NULL,
      assigned_at = NULL,
      updated_at = now()
  WHERE assigned_thread_id = p_thread_id;

  GET DIAGNOSTICS released_count = ROW_COUNT;
  RETURN released_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_ai_key_for_thread(text, uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_ai_key_for_thread(uuid, timestamptz) TO authenticated;
