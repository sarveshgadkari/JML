-- Normalize queue policy: failed rows should remain retryable in PENDING
UPDATE public.pdf_queue
SET status = 'PENDING',
    claimed_by = NULL,
    claimed_at = NULL,
    error_log = COALESCE(error_log || ' | ', '') || 'Normalized from FAILED to PENDING for retry',
    updated_at = now()
WHERE status = 'FAILED';
