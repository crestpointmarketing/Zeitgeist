begin;
create table public.forecast_intervals (
 record_id uuid primary key references public.forecast_records(id) on delete cascade,
 state text not null check(state in ('ready','insufficient','withheld')),
 samples integer not null check(samples>=0), nominal_coverage integer not null check(nominal_coverage=80),
 lower_return_pct double precision,upper_return_pct double precision,sample_ids jsonb not null,
 created_at timestamptz not null default now(),
 check((state='ready' and samples>=30 and lower_return_pct is not null and upper_return_pct is not null and lower_return_pct<=upper_return_pct)
 or (state<>'ready' and lower_return_pct is null and upper_return_pct is null))
);
alter table public.forecast_intervals enable row level security;
revoke all on public.forecast_intervals from public,anon,authenticated,service_role;
grant select on public.forecast_intervals to authenticated;
grant select,insert on public.forecast_intervals to service_role;
create policy own_intervals on public.forecast_intervals for select to authenticated using(exists(select 1 from public.forecast_records r where r.id=record_id and r.user_id=auth.uid()));
alter table public.conversations add column research_context_job uuid references public.research_jobs(id) on delete set null;
commit;
