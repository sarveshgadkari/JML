-- Reclaim stale PROCESSING jobs before claiming fresh PENDING work
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
      error_log = COALESCE(q.error_log || ' | ', '') || 'Reclaimed stale job after 5 minutes',
      updated_at = now()
  WHERE q.status = 'PROCESSING'
    AND q.updated_at < (now() - interval '5 minutes');

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
