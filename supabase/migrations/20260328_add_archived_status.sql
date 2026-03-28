-- Add ARCHIVED status to queue_status enum for post-review archival
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'queue_status') THEN
    CREATE TYPE public.queue_status AS ENUM ('PENDING','PROCESSING','COMPLETED','FAILED','ARCHIVED');
  ELSIF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname='queue_status' AND e.enumlabel='ARCHIVED') THEN
    ALTER TYPE public.queue_status ADD VALUE 'ARCHIVED';
  END IF;
END$$;

