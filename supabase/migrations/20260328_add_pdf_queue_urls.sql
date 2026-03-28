-- Add dual URL columns for OneDrive/SharePoint bulk URL import
ALTER TABLE public.pdf_queue
ADD COLUMN IF NOT EXISTS public_viewer_url text NULL,
ADD COLUMN IF NOT EXISTS direct_download_url text NULL;

-- Optional helpful index for workers scanning pending rows with URLs
CREATE INDEX IF NOT EXISTS idx_pdf_queue_urls_status ON public.pdf_queue (status, created_at);

