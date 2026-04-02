-- Exact reclaim tracking + duplicate completed file suppression
ALTER TABLE public.pdf_queue
ADD COLUMN IF NOT EXISTS reclaimed_count integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_reclaimed_at timestamptz NULL;

CREATE OR REPLACE FUNCTION public.claim_pdf_batch(p_thread_id uuid, p_batch_size int)
RETURNS TABLE(queue_id uuid, file_url text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.ai_threads t
    WHERE t.id = p_thread_id
      AND t.is_active = true
  ) THEN
    RAISE EXCEPTION 'Thread % not found or inactive', p_thread_id;
  END IF;

  UPDATE public.pdf_queue q
  SET status = 'PENDING',
      claimed_by = NULL,
      claimed_at = NULL,
      reclaimed_count = COALESCE(q.reclaimed_count, 0) + 1,
      last_reclaimed_at = now(),
      error_log = COALESCE(q.error_log || ' | ', '') || 'Reclaimed stale job after 5 minutes',
      updated_at = now()
  WHERE q.status = 'PROCESSING'
    AND q.updated_at < (now() - interval '5 minutes');

  WITH duplicate_matches AS (
    SELECT
      pending.id AS queue_id,
      (
        SELECT completed.extracted_data
        FROM public.pdf_queue completed
        WHERE completed.status = 'COMPLETED'
          AND completed.id <> pending.id
          AND (
            (pending.file_url IS NOT NULL AND completed.file_url = pending.file_url)
            OR (pending.direct_download_url IS NOT NULL AND completed.direct_download_url = pending.direct_download_url)
            OR (pending.public_viewer_url IS NOT NULL AND completed.public_viewer_url = pending.public_viewer_url)
          )
        ORDER BY completed.updated_at DESC NULLS LAST, completed.created_at DESC
        LIMIT 1
      ) AS extracted_data
    FROM public.pdf_queue pending
    WHERE pending.status = 'PENDING'
  )
  UPDATE public.pdf_queue q
  SET status = 'COMPLETED',
      claimed_by = NULL,
      claimed_at = NULL,
      extracted_data = dm.extracted_data,
      error_log = COALESCE(q.error_log || ' | ', '') || 'Skipped duplicate; already processed',
      updated_at = now()
  FROM duplicate_matches dm
  WHERE q.id = dm.queue_id
    AND dm.extracted_data IS NOT NULL;

  RETURN QUERY
  WITH sel AS (
    SELECT q.id AS qid
    FROM public.pdf_queue q
    WHERE q.status = 'PENDING'
    ORDER BY q.created_at ASC
    LIMIT GREATEST(1, COALESCE(p_batch_size, 1))
    FOR UPDATE SKIP LOCKED
  ), upd AS (
    UPDATE public.pdf_queue q
    SET status = 'PROCESSING',
        claimed_by = p_thread_id,
        claimed_at = now(),
        updated_at = now()
    WHERE q.id IN (SELECT s.qid FROM sel s)
    RETURNING q.id AS queue_id, q.file_url
  )
  SELECT u.queue_id, u.file_url FROM upd u;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pdf_batch(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_pdf_batch(uuid, int) TO anon;
