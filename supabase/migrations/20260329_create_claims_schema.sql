-- Ensure claim_status enum exists
do $$
begin
  if not exists (select 1 from pg_type where typname = 'claim_status') then
    create type claim_status as enum ('pending','approved','rejected');
  end if;
end$$;

-- card_claims table
create table if not exists public.card_claims (
  id uuid primary key default gen_random_uuid(),
  lawyer_id uuid references public.lawyers(id) on delete cascade,
  claimed_names text[] not null,
  preferred_name text,
  bar_registration_number text,
  notes text,
  status claim_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- Align columns if table pre-existed
alter table public.card_claims
  add column if not exists claimed_names text[],
  add column if not exists preferred_name text,
  add column if not exists bar_registration_number text,
  add column if not exists notes text,
  add column if not exists status claim_status not null default 'pending',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists lawyer_id uuid;

-- case_claims table
create table if not exists public.case_claims (
  id uuid primary key default gen_random_uuid(),
  lawyer_id uuid references public.lawyers(id) on delete cascade,
  case_id uuid references public.cases(id) on delete cascade,
  case_number text,
  role text check (role in ('complainant','respondent')),
  vakaalatnama_url text,
  client_name text,
  notes text,
  status claim_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- Align columns if table pre-existed
alter table public.case_claims
  add column if not exists case_number text,
  add column if not exists role text,
  add column if not exists vakaalatnama_url text,
  add column if not exists client_name text,
  add column if not exists notes text,
  add column if not exists status claim_status not null default 'pending',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists lawyer_id uuid,
  add column if not exists case_id uuid;

-- Helpful indexes
create index if not exists idx_card_claims_status_created on public.card_claims(status, created_at desc);
create index if not exists idx_case_claims_status_created on public.case_claims(status, created_at desc);
create index if not exists idx_case_claims_case_number on public.case_claims(case_number);

-- Enable RLS
alter table public.card_claims enable row level security;
alter table public.case_claims enable row level security;

-- Basic policies for quick start (adjust as needed)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='card_claims' and policyname='card_claims_read') then
    create policy card_claims_read on public.card_claims for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='card_claims' and policyname='card_claims_insert') then
    create policy card_claims_insert on public.card_claims for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='card_claims' and policyname='card_claims_update_status') then
    create policy card_claims_update_status on public.card_claims for update to authenticated using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='case_claims' and policyname='case_claims_read') then
    create policy case_claims_read on public.case_claims for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='case_claims' and policyname='case_claims_insert') then
    create policy case_claims_insert on public.case_claims for insert to authenticated with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='case_claims' and policyname='case_claims_update_status') then
    create policy case_claims_update_status on public.case_claims for update to authenticated using (true) with check (true);
  end if;
end$$;

-- Storage bucket for Vakaalatnama uploads
insert into storage.buckets (id, name, public)
select 'vakaalatnamas', 'vakaalatnamas', false
where not exists (select 1 from storage.buckets where id = 'vakaalatnamas');

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='vakaalatnamas_read') then
    create policy vakaalatnamas_read
    on storage.objects for select to authenticated
    using (bucket_id = 'vakaalatnamas');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='vakaalatnamas_insert') then
    create policy vakaalatnamas_insert
    on storage.objects for insert to authenticated
    with check (bucket_id = 'vakaalatnamas');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='vakaalatnamas_update') then
    create policy vakaalatnamas_update
    on storage.objects for update to authenticated
    using (bucket_id = 'vakaalatnamas');
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='vakaalatnamas_delete') then
    create policy vakaalatnamas_delete
    on storage.objects for delete to authenticated
    using (bucket_id = 'vakaalatnamas');
  end if;
end$$;

