-- Migration: create a judgments view that exposes imported cases as one row per (case, judge)
-- This view maps the importer master table `public.cases` (complaint_number PK) together with
-- `public.case_judges` and `public.judges` so frontend code that expects a `judgments` relation
-- can query normalized rows for charts and analytics.

-- Create or replace view to be idempotent
CREATE OR REPLACE VIEW public.judgments AS
SELECT
  c.complaint_number::text AS id,
  c.complaint_number,
  c.case_title::text AS title,
  c.case_type::text,
  c.court::text AS court_name,
  co.id AS court_id,
  cj.judge_id,
  j.name::text AS judge_name,
  c.filing_date,
  c.judgement_date AS judgment_date,
  c.status,
  c.outcome,
  c.total_hearings AS hearings,
  c.summaries,
  c.raw_data
FROM public.cases c
LEFT JOIN public.case_judges cj ON cj.complaint_number = c.complaint_number
LEFT JOIN public.judges j ON j.id = cj.judge_id
LEFT JOIN public.courts co ON co.name = c.court;

-- Create indexes to help common queries (created on source tables)
CREATE INDEX IF NOT EXISTS idx_cases_complaint_number ON public.cases(complaint_number);
CREATE INDEX IF NOT EXISTS idx_case_judges_complaint_number ON public.case_judges(complaint_number);
CREATE INDEX IF NOT EXISTS idx_case_judges_judge_id ON public.case_judges(judge_id);

-- Note: This is a view (not materialized). If you need faster reads for very large datasets,
-- consider creating a materialized view and refreshing it after import.
