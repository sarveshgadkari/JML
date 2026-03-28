-- Migration: create cases/complaints table for MahaRERA imports
-- Run this in Supabase SQL editor or via psql against your Supabase Postgres.

CREATE TABLE IF NOT EXISTS public.cases (
  complaint_number text PRIMARY KEY,
  case_title text,
  case_type text,
  court text,
  judges jsonb,
  petitioner_lawyers jsonb,
  respondent_lawyers jsonb,
  filing_date date,
  judgement_date date,
  status text,
  outcome text,
  complainant text,
  respondent text,
  total_hearings integer,
  summaries jsonb,
  raw_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cases_court_idx ON public.cases (court);
