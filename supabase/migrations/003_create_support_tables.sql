-- Migration: create supporting lookup and join tables for cases

CREATE TABLE IF NOT EXISTS public.courts (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.judges (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.lawyers (
  id serial PRIMARY KEY,
  name text NOT NULL,
  role text,
  UNIQUE(name, role)
);

CREATE TABLE IF NOT EXISTS public.case_judges (
  id serial PRIMARY KEY,
  complaint_number text REFERENCES public.cases(complaint_number) ON DELETE CASCADE,
  judge_id integer REFERENCES public.judges(id) ON DELETE CASCADE,
  position integer
);

CREATE TABLE IF NOT EXISTS public.case_lawyers (
  id serial PRIMARY KEY,
  complaint_number text REFERENCES public.cases(complaint_number) ON DELETE CASCADE,
  lawyer_id integer REFERENCES public.lawyers(id) ON DELETE CASCADE,
  role text,
  position integer
);

CREATE TABLE IF NOT EXISTS public.summaries (
  id serial PRIMARY KEY,
  complaint_number text REFERENCES public.cases(complaint_number) ON DELETE CASCADE,
  idx integer,
  text text
);

CREATE INDEX IF NOT EXISTS idx_case_judges_complaint ON public.case_judges(complaint_number);
CREATE INDEX IF NOT EXISTS idx_case_lawyers_complaint ON public.case_lawyers(complaint_number);
CREATE INDEX IF NOT EXISTS idx_summaries_complaint ON public.summaries(complaint_number);
