-- 006_reset_public_and_create_cases_table.sql
-- WARNING: This migration will DROP the entire public schema and recreate it.
-- Run only if you have a backup or you intend to fully reset the database.

BEGIN;

-- Drop and recreate the public schema (removes all tables, views, functions in public)
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Restore default grants for the public schema
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- Create the master import table that will hold your uploaded CSV rows.
-- This table is intentionally simple: it stores key parsed fields and a `raw_data` JSONB
-- column you can use to store the original CSV row contents for later normalization.
CREATE TABLE public.cases (
  complaint_number text PRIMARY KEY,
  title text,
  case_type text,
  court_name text,
  judges jsonb,
  petitioner_lawyers jsonb,
  respondent_lawyers jsonb,
  filing_date date,
  judgment_date date,
  status text,
  outcome text,
  hearings integer,
  summaries jsonb,
  raw_data jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cases_court_name ON public.cases (court_name);
CREATE INDEX IF NOT EXISTS idx_cases_filing_date ON public.cases (filing_date);

COMMIT;

-- NOTE: After running this migration you can upload your CSV into `public.cases` using
-- Supabase Studio (SQL editor / Table editor) or via a script that upserts rows into
-- the `public.cases` table. If you want, I can also add a small SQL import helper
-- or a Supabase Function to accept a CSV file.
