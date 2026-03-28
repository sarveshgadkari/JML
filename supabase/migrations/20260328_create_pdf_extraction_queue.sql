-- PDF Judgment Extraction Engine schema and RPCs
-- 1) Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_status') THEN
    CREATE TYPE public.queue_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
  END IF;
END$$;

-- 2) ai_threads (worker configuration)
CREATE TABLE IF NOT EXISTS public.ai_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar NOT NULL,
  provider varchar NOT NULL, -- e.g., 'anthropic' | 'openai' | 'google'
  model varchar NOT NULL, -- e.g., 'claude-3-opus' | 'gpt-4-turbo'
  api_key_secret varchar NOT NULL,
  batch_size integer NOT NULL DEFAULT 5,
  system_prompt text,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) pdf_queue (single central queue)
CREATE TABLE IF NOT EXISTS public.pdf_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_url text NOT NULL, -- Supabase Storage path or https URL
  status public.queue_status NOT NULL DEFAULT 'PENDING',
  claimed_by uuid NULL REFERENCES public.ai_threads(id) ON DELETE SET NULL,
  claimed_at timestamptz NULL,
  extracted_data jsonb NULL,
  error_log text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_pdf_queue_status_created_at ON public.pdf_queue (status, created_at);
CREATE INDEX IF NOT EXISTS idx_pdf_queue_claimed_by ON public.pdf_queue (claimed_by);

-- 3b) updated_at trigger (generic)
CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ai_threads_updated_at'
  ) THEN
    CREATE TRIGGER trg_ai_threads_updated_at
    BEFORE UPDATE ON public.ai_threads
    FOR EACH ROW
    EXECUTE FUNCTION public.set_row_updated_at();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_pdf_queue_updated_at'
  ) THEN
    CREATE TRIGGER trg_pdf_queue_updated_at
    BEFORE UPDATE ON public.pdf_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.set_row_updated_at();
  END IF;
END$$;

-- 4) Claim batch RPC
-- Atomically claims up to p_batch_size oldest PENDING PDFs for the given thread.
CREATE OR REPLACE FUNCTION public.claim_pdf_batch(p_thread_id uuid, p_batch_size int)
RETURNS TABLE(id uuid, file_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
BEGIN
  -- Optional: ensure thread exists and is active
  IF NOT EXISTS (SELECT 1 FROM public.ai_threads t WHERE t.id = p_thread_id AND t.is_active = true) THEN
    RAISE EXCEPTION 'Thread % not found or inactive', p_thread_id;
  END IF;

  WITH sel AS (
    SELECT q.id
    FROM public.pdf_queue q
    WHERE q.status = 'PENDING'
    ORDER BY q.created_at ASC
    LIMIT GREATEST(1, COALESCE(p_batch_size, 1))
    FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE public.pdf_queue q
    SET status = 'PROCESSING',
        claimed_by = p_thread_id,
        claimed_at = now()
    WHERE q.id IN (SELECT id FROM sel)
    RETURNING q.id, q.file_url
  )
  SELECT id, file_url FROM upd;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pdf_batch(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pdf_batch(uuid, int) TO anon;

-- 5) Release stalled jobs RPC
CREATE OR REPLACE FUNCTION public.release_stalled_pdfs(timeout_minutes int)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE public.pdf_queue q
  SET status = 'PENDING',
      claimed_by = NULL,
      claimed_at = NULL
  WHERE q.status = 'PROCESSING'
    AND q.claimed_at IS NOT NULL
    AND q.claimed_at < (now() - make_interval(mins => GREATEST(1, COALESCE(timeout_minutes, 30))));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_stalled_pdfs(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_stalled_pdfs(int) TO anon;

-- 6) Finalize extraction RPC: write data into main cases table and mark queue row completed
-- This ensures AI outputs are persisted in the primary analytics source (cases).
-- Minimal mapping from JSON to `public.cases` (best-effort). Expects keys:
-- case_number, court, bench, parties.petitioner, parties.respondent, dates.filed, dates.judgment, disposition
CREATE OR REPLACE FUNCTION public.finalize_pdf_extraction(
  p_queue_id uuid,
  p_payload jsonb,
  p_replace_existing boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_case_number text;
  v_court text;
  v_bench text;
  v_pet text;
  v_resp text;
  v_filed text;
  v_judgment text;
  v_dispo text;
  v_exists boolean;
BEGIN
  IF p_queue_id IS NULL THEN
    RAISE EXCEPTION 'p_queue_id is required';
  END IF;

  -- Basic extraction from payload
  v_case_number := NULLIF(TRIM(BOTH FROM COALESCE((p_payload->>'case_number'), '')), '');
  v_court := NULLIF(TRIM(BOTH FROM COALESCE((p_payload->>'court'), '')), '');
  v_bench := NULLIF(TRIM(BOTH FROM COALESCE((p_payload->>'bench'), '')), '');
  v_pet := NULLIF(TRIM(BOTH FROM COALESCE((p_payload->'parties'->>'petitioner'), '')), '');
  v_resp := NULLIF(TRIM(BOTH FROM COALESCE((p_payload->'parties'->>'respondent'), '')), '');
  v_filed := NULLIF(TRIM(BOTH FROM COALESCE((p_payload->'dates'->>'filed'), '')), '');
  v_judgment := NULLIF(TRIM(BOTH FROM COALESCE((p_payload->'dates'->>'judgment'), '')), '');
  v_dispo := NULLIF(TRIM(BOTH FROM COALESCE((p_payload->>'disposition'), '')), '');

  IF v_case_number IS NULL THEN
    RAISE EXCEPTION 'Payload missing case_number';
  END IF;

  -- Upsert into public.cases by case_number (unique index expected)
  SELECT EXISTS(SELECT 1 FROM public.cases c WHERE c.case_number = v_case_number) INTO v_exists;

  IF v_exists AND NOT p_replace_existing THEN
    -- Update minimal fields if present, but do not overwrite non-null with null
    UPDATE public.cases c
    SET court_name = COALESCE(v_court, c.court_name),
        case_title = COALESCE(c.case_title, CONCAT('Case ', v_case_number)),
        petitioner_name = COALESCE(v_pet, c.petitioner_name),
        respondent_name = COALESCE(v_resp, c.respondent_name),
        filing_date = COALESCE(NULLIF(v_filed, '')::date, c.filing_date),
        judgment_date = COALESCE(NULLIF(v_judgment, '')::date, c.judgment_date),
        outcome = COALESCE(v_dispo, c.outcome),
        summary = COALESCE(c.summary, 'pdf_extraction'),
        updated_at = now()
    WHERE c.case_number = v_case_number;
  ELSE
    INSERT INTO public.cases (
      case_number, court_name, case_title, petitioner_name, respondent_name,
      filing_date, judgment_date, outcome, summary, data_source, verified, updated_at
    ) VALUES (
      v_case_number,
      v_court,
      CONCAT('Case ', v_case_number),
      v_pet,
      v_resp,
      NULLIF(v_filed, '')::date,
      NULLIF(v_judgment, '')::date,
      v_dispo,
      'pdf_extraction',
      'pdf_ai',
      false,
      now()
    )
    ON CONFLICT (case_number) DO UPDATE
    SET court_name = EXCLUDED.court_name,
        case_title = COALESCE(public.cases.case_title, EXCLUDED.case_title),
        petitioner_name = COALESCE(EXCLUDED.petitioner_name, public.cases.petitioner_name),
        respondent_name = COALESCE(EXCLUDED.respondent_name, public.cases.respondent_name),
        filing_date = COALESCE(EXCLUDED.filing_date, public.cases.filing_date),
        judgment_date = COALESCE(EXCLUDED.judgment_date, public.cases.judgment_date),
        outcome = COALESCE(EXCLUDED.outcome, public.cases.outcome),
        updated_at = now();
  END IF;

  -- Mark queue row completed and persist payload
  UPDATE public.pdf_queue q
  SET status = 'COMPLETED',
      extracted_data = p_payload,
      error_log = NULL,
      updated_at = now()
  WHERE q.id = p_queue_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.finalize_pdf_extraction(uuid, jsonb, boolean) TO authenticated;

-- Basic privileges for app roles
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_threads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pdf_queue TO authenticated;

