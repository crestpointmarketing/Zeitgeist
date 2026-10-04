-- Additive migration. Apply once after generation_cache; no historical backfill.
begin;
create table public.forecast_records (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 ticker text not null check (ticker ~ '^[A-Z]{1,5}$'),
 model_id text not null,
 model_version text not null,
 code_revision text not null,
 as_of date not null,
 target_date date not null check (target_date > as_of),
 next_open timestamptz not null,
 target_close timestamptz not null check (target_close > next_open),
 generated_at timestamptz not null,
 recorded_at timestamptz not null default clock_timestamp(),
 prospective boolean not null default false,
 qualified boolean not null,
 last_close double precision not null check (last_close > 0 and last_close < 'Infinity'::float8),
 predicted_return_pct double precision check (predicted_return_pct > -100 and predicted_return_pct < 'Infinity'::float8),
 drift_return_pct double precision not null check (drift_return_pct > -100 and drift_return_pct < 'Infinity'::float8),
 data_hash text not null,
 input_payload jsonb not null,
 report_payload jsonb not null,
 check (qualified = (predicted_return_pct is not null)),
 unique (user_id, ticker, model_id, model_version, as_of)
);
create index forecast_records_account_time on public.forecast_records(user_id, recorded_at desc);

create table public.forecast_checks (
 record_id uuid primary key references public.forecast_records(id) on delete cascade,
 state text not null default 'pending' check (state in ('pending','settled','late')),
 attempts integer not null default 0,
 next_check_at timestamptz not null,
 checked_at timestamptz,
 reason text,
 outcome jsonb
);
create index forecast_checks_due on public.forecast_checks(next_check_at) where state='pending';

create function public.initialize_forecast_record() returns trigger language plpgsql set search_path='' as $$
begin
 new.recorded_at := clock_timestamp();
 new.prospective := new.recorded_at < new.next_open and new.generated_at <= new.recorded_at
   and new.generated_at > new.recorded_at - interval '2 hours';
 return new;
end $$;
create trigger freeze_forecast_time before insert on public.forecast_records
 for each row execute function public.initialize_forecast_record();
create function public.initialize_forecast_check() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.forecast_checks(record_id,state,next_check_at)
 values(new.id,case when new.prospective then 'pending' else 'late' end,new.target_close + interval '20 minutes');
 return new;
end $$;
create trigger schedule_forecast_check after insert on public.forecast_records
 for each row execute function public.initialize_forecast_check();

alter table public.forecast_records enable row level security;
alter table public.forecast_checks enable row level security;
revoke all on public.forecast_records,public.forecast_checks from public,anon,authenticated,service_role;
grant select on public.forecast_records,public.forecast_checks to authenticated;
grant select,insert on public.forecast_records to service_role;
grant select,insert,update on public.forecast_checks to service_role;
create policy forecast_records_owner on public.forecast_records for select to authenticated using (user_id=(select auth.uid()));
create policy forecast_checks_owner on public.forecast_checks for select to authenticated
 using (exists(select 1 from public.forecast_records r where r.id=record_id and r.user_id=(select auth.uid())));

create table public.forecast_reconciliation (
 id boolean primary key default true check(id), lease uuid, expires_at timestamptz not null default '-infinity',
 last_completed_at timestamptz, summary jsonb
);
insert into public.forecast_reconciliation(id) values(true);
alter table public.forecast_reconciliation enable row level security;
revoke all on public.forecast_reconciliation from public,anon,authenticated;
grant all on public.forecast_reconciliation to service_role;
create function public.claim_forecast_reconciliation() returns uuid language plpgsql security definer set search_path='' as $$
declare token uuid := gen_random_uuid();
begin
 update public.forecast_reconciliation set lease=token,expires_at=clock_timestamp()+interval '90 seconds'
 where id=true and expires_at<clock_timestamp();
 if not found then return null; end if;
 return token;
end $$;
create function public.finish_forecast_reconciliation(p_lease uuid,p_summary jsonb) returns void language sql security definer set search_path='' as $$
 update public.forecast_reconciliation set lease=null,expires_at=clock_timestamp(),last_completed_at=clock_timestamp(),summary=p_summary
 where id=true and lease=p_lease;
$$;
revoke all on function public.initialize_forecast_record(),public.initialize_forecast_check(),public.claim_forecast_reconciliation(),public.finish_forecast_reconciliation(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.claim_forecast_reconciliation(),public.finish_forecast_reconciliation(uuid,jsonb) to service_role;
commit;
