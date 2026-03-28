-- Migration: helper SQL to normalize data from public.cases into lookup/join tables
-- Run this after `cases` table is populated.

-- Insert courts
INSERT INTO public.courts (name)
SELECT DISTINCT court FROM public.cases WHERE court IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- Insert judges
WITH j AS (
  SELECT complaint_number, jsonb_array_elements_text(judges) AS judge_name FROM public.cases WHERE judges IS NOT NULL
)
INSERT INTO public.judges (name)
SELECT DISTINCT judge_name FROM j
ON CONFLICT (name) DO NOTHING;

-- Insert lawyers
WITH p AS (
  SELECT complaint_number, jsonb_array_elements_text(petitioner_lawyers) AS lawyer_name FROM public.cases WHERE petitioner_lawyers IS NOT NULL
), r AS (
  SELECT complaint_number, jsonb_array_elements_text(respondent_lawyers) AS lawyer_name FROM public.cases WHERE respondent_lawyers IS NOT NULL
)
INSERT INTO public.lawyers (name, role)
SELECT DISTINCT lawyer_name, 'petitioner' FROM p
ON CONFLICT (name, role) DO NOTHING;

INSERT INTO public.lawyers (name, role)
SELECT DISTINCT lawyer_name, 'respondent' FROM r
ON CONFLICT (name, role) DO NOTHING;

-- Link case_judges
WITH j AS (
  SELECT complaint_number, jsonb_array_elements_text(judges) AS judge_name, generate_series(1, jsonb_array_length(judges)) AS pos FROM public.cases WHERE judges IS NOT NULL
)
INSERT INTO public.case_judges (complaint_number, judge_id, position)
SELECT j.complaint_number, jj.id, j.pos
FROM j
JOIN public.judges jj ON jj.name = j.judge_name
ON CONFLICT DO NOTHING;

-- Link case_lawyers
WITH p AS (
  SELECT complaint_number, jsonb_array_elements_text(petitioner_lawyers) AS lawyer_name, generate_series(1, jsonb_array_length(petitioner_lawyers)) AS pos FROM public.cases WHERE petitioner_lawyers IS NOT NULL
), r AS (
  SELECT complaint_number, jsonb_array_elements_text(respondent_lawyers) AS lawyer_name, generate_series(1, jsonb_array_length(respondent_lawyers)) AS pos FROM public.cases WHERE respondent_lawyers IS NOT NULL
)
INSERT INTO public.case_lawyers (complaint_number, lawyer_id, role, position)
SELECT p.complaint_number, l.id, 'petitioner', p.pos FROM p JOIN public.lawyers l ON l.name = p.lawyer_name
ON CONFLICT DO NOTHING;

INSERT INTO public.case_lawyers (complaint_number, lawyer_id, role, position)
SELECT r.complaint_number, l.id, 'respondent', r.pos FROM r JOIN public.lawyers l ON l.name = r.lawyer_name
ON CONFLICT DO NOTHING;

-- Insert summaries
WITH s AS (
  SELECT complaint_number, jsonb_array_elements_text(summaries) AS summary_text, generate_series(1, jsonb_array_length(summaries)) AS idx FROM public.cases WHERE summaries IS NOT NULL
)
INSERT INTO public.summaries (complaint_number, idx, text)
SELECT complaint_number, idx, summary_text FROM s
ON CONFLICT DO NOTHING;
