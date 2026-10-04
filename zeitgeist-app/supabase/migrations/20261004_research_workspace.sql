-- Additive migration. Apply once after forward_validation; preserve historical records.
begin;
create table public.watchlist_items (
 user_id uuid not null references auth.users(id) on delete cascade,
 ticker text not null check(ticker ~ '^[A-Z]{1,5}$'),
 daily_enabled boolean not null default false,
 created_at timestamptz not null default now(),
 primary key(user_id,ticker)
);
-- One-time import. Future reads never re-import removed legacy preferences.
insert into public.watchlist_items(user_id,ticker)
select distinct u.id,s.value from auth.users u
cross join lateral jsonb_array_elements_text(case when jsonb_typeof(u.raw_user_meta_data->'watchlist')='array' then u.raw_user_meta_data->'watchlist' else '[]'::jsonb end) with ordinality s(value,n)
where s.value ~ '^[A-Z]{1,5}$' and s.n<=30 on conflict do nothing;

create table public.research_jobs (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('model','daily','portfolio','comparison')),
 input jsonb not null, dedupe_key text not null,
 status text not null default 'queued' check(status in ('queued','running','succeeded','failed','cancelled')),
 stage integer not null default 0, checkpoint jsonb not null default '{}'::jsonb,
 result jsonb, error text, attempts integer not null default 0,
 lease uuid, lease_until timestamptz, available_at timestamptz not null default now(),
 created_at timestamptz not null default now(), started_at timestamptz, finished_at timestamptz,
 read_at timestamptz, duration_ms integer,
 unique(user_id,dedupe_key)
);
create index research_queue_idx on public.research_jobs(status,available_at,created_at);
create index research_owner_idx on public.research_jobs(user_id,created_at desc);
create table public.research_service_health (
 id boolean primary key default true check(id), last_started_at timestamptz, last_completed_at timestamptz,
 last_dispatch_at timestamptz, last_dispatch_request_id bigint, summary jsonb
);
insert into public.research_service_health(id) values(true);
alter table public.watchlist_items enable row level security;
alter table public.research_jobs enable row level security;
alter table public.research_service_health enable row level security;
revoke all on public.watchlist_items, public.research_jobs, public.research_service_health from public,anon,authenticated;
grant select on public.watchlist_items to authenticated;
-- Checkpoints may contain large provider histories: never exposed to browser clients.
grant select(id,user_id,kind,input,status,stage,result,error,attempts,created_at,started_at,finished_at,read_at,duration_ms) on public.research_jobs to authenticated;
grant all on public.watchlist_items,public.research_jobs,public.research_service_health to service_role;
create policy own_watchlist on public.watchlist_items for select to authenticated using(user_id=auth.uid());
create policy own_research_jobs on public.research_jobs for select to authenticated using(user_id=auth.uid());

create function public.change_watchlist(p_ticker text,p_action text,p_daily boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid();
begin
 if uid is null or p_ticker !~ '^[A-Z]{1,5}$' then raise exception 'Invalid account or symbol'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,42));
 if p_action='remove' then
  delete from public.watchlist_items where user_id=uid and ticker=p_ticker;
  update public.research_jobs set status='cancelled',finished_at=now() where user_id=uid and kind='daily' and input->>'ticker'=p_ticker and input->>'scheduled'='true' and status='queued';
 elsif p_action='add' then
  if not exists(select 1 from public.watchlist_items where user_id=uid and ticker=p_ticker) and (select count(*) from public.watchlist_items where user_id=uid)>=30 then raise exception 'Watchlist limit reached'; end if;
  insert into public.watchlist_items(user_id,ticker) values(uid,p_ticker) on conflict do nothing;
 elsif p_action='daily' then
  if not exists(select 1 from public.watchlist_items where user_id=uid and ticker=p_ticker) then raise exception 'Stock not in watchlist'; end if;
  if p_daily and (select count(*) from public.watchlist_items where user_id=uid and daily_enabled and ticker<>p_ticker)>=5 then raise exception 'Daily research supports up to five stocks'; end if;
  update public.watchlist_items set daily_enabled=p_daily where user_id=uid and ticker=p_ticker;
  if not p_daily then update public.research_jobs set status='cancelled',finished_at=now() where user_id=uid and kind='daily' and input->>'ticker'=p_ticker and input->>'scheduled'='true' and status='queued'; end if;
 else raise exception 'Invalid action'; end if;
end $$;
revoke all on function public.change_watchlist(text,text,boolean) from public,anon;
grant execute on function public.change_watchlist(text,text,boolean) to authenticated;

create function public.enqueue_research(p_user uuid,p_kind text,p_input jsonb,p_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare found_id uuid;
begin
 perform pg_advisory_xact_lock(732019847);
 select id into found_id from public.research_jobs where user_id=p_user and dedupe_key=p_key;
 if found_id is not null then return found_id; end if;
 if (select count(*) from public.research_jobs where user_id=p_user and status in ('queued','running'))>=12 or
    (select count(*) from public.research_jobs where status in ('queued','running'))>=200 then raise exception 'Research queue is full'; end if;
 -- Bound abuse even for exempt demo accounts; this is queue protection, not AI quota.
 if (select count(*) from public.research_jobs where user_id=p_user and created_at>now()-interval '1 day')>=100 then raise exception 'Daily task limit reached'; end if;
 insert into public.research_jobs(user_id,kind,input,dedupe_key) values(p_user,p_kind,p_input,p_key) returning id into found_id;
 return found_id;
end $$;

create function public.claim_research_job() returns jsonb
language plpgsql security definer set search_path='' as $$
declare job public.research_jobs;
begin
 perform pg_advisory_xact_lock(732019847);
 -- Exactly one active queue worker across all web instances; provider has its own hard process deadline.
 if exists(select 1 from public.research_jobs where status='running' and lease_until>now()) then return null; end if;
 update public.research_jobs set status=case when attempts>=3 then 'failed' else 'queued' end,
  error='The worker was interrupted. Retry is available.', finished_at=case when attempts>=3 then now() else null end,
  lease=null,lease_until=null where status='running' and lease_until<=now();
 select * into job from public.research_jobs where status='queued' and available_at<=now() order by available_at,created_at for update skip locked limit 1;
 if job.id is null then return null; end if;
 update public.research_jobs set status='running',lease=gen_random_uuid(),lease_until=now()+interval '90 seconds',
  started_at=coalesce(started_at,now()),attempts=attempts+1,error=null where id=job.id returning * into job;
 update public.research_service_health set last_started_at=now() where id;
 return to_jsonb(job);
end $$;

create function public.finish_research_job(p_id uuid,p_lease uuid,p_status text,p_stage integer,p_checkpoint jsonb,p_result jsonb,p_error text,p_duration integer)
returns boolean language plpgsql security definer set search_path='' as $$
declare changed integer;
begin
 if p_status not in ('queued','succeeded','failed') then raise exception 'Invalid state'; end if;
 update public.research_jobs set status=p_status,stage=p_stage,checkpoint=p_checkpoint,result=p_result,error=left(p_error,300),
  attempts=case when p_stage>stage then 0 else attempts end,
  available_at=now()+case when p_error is null then interval '0 seconds' else interval '1 minute' end,
  lease=null,lease_until=null,finished_at=case when p_status in ('succeeded','failed') then now() else null end,
  duration_ms=coalesce(duration_ms,0)+greatest(0,p_duration)
 where id=p_id and lease=p_lease and status='running' and lease_until>now();
 get diagnostics changed=row_count;
 update public.research_service_health set last_completed_at=now(),summary=jsonb_build_object('state',p_status,'committed',changed=1) where id;
 return changed=1;
end $$;

create function public.change_research_job(p_id uuid,p_action text)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); job public.research_jobs;
begin
 if uid is null then raise exception 'Authentication required'; end if;
 perform pg_advisory_xact_lock(732019847);
 select * into job from public.research_jobs where id=p_id and user_id=uid for update;
 if job.id is null then raise exception 'Task not found'; end if;
 if p_action='cancel' and job.status='queued' then
  update public.research_jobs set status='cancelled',finished_at=now() where id=p_id;
 elsif p_action='retry' and job.status in ('failed','cancelled') then
  if (select count(*) from public.research_jobs where user_id=uid and status in ('queued','running'))>=12 or
     (select count(*) from public.research_jobs where status in ('queued','running'))>=200 then raise exception 'Research queue is full'; end if;
  update public.research_jobs set status='queued',attempts=0,error=null,finished_at=null,read_at=null,available_at=now() where id=p_id;
 elsif p_action='read' then update public.research_jobs set read_at=now() where id=p_id;
 else raise exception 'This task cannot be changed in its current state'; end if;
end $$;
revoke all on function public.change_research_job(uuid,text) from public,anon;
grant execute on function public.change_research_job(uuid,text) to authenticated;

-- Delegates to the existing shared per-account/global usage limiter. Only service_role
-- may select an account. Browser callers cannot impersonate another user.
create function public.reserve_background_usage(p_user uuid,p_feature text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old_sub text:=current_setting('request.jwt.claim.sub',true); answer jsonb; exempt boolean;
begin
 select coalesce((raw_app_meta_data->>'quota_exempt')='true',false) into exempt from auth.users where id=p_user and (banned_until is null or banned_until<now());
 if exempt is null then raise exception 'Account unavailable'; end if;
 if exempt then return '{"allowed":true}'::jsonb; end if;
 perform set_config('request.jwt.claim.sub',p_user::text,true);
 answer:=public.reserve_api_usage(p_feature);
 perform set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
 return answer;
end $$;
create function public.release_background_usage(p_user uuid,p_lease uuid) returns void
language sql security definer set search_path='' as $$delete from public.api_leases where user_id=p_user and id=p_lease;$$;

do $$ declare signature text; begin
 foreach signature in array array['enqueue_research(uuid,text,jsonb,text)','claim_research_job()','finish_research_job(uuid,uuid,text,integer,jsonb,jsonb,text,integer)','reserve_background_usage(uuid,text)','release_background_usage(uuid,uuid)'] loop
  execute 'revoke all on function public.'||signature||' from public,anon,authenticated';
  execute 'grant execute on function public.'||signature||' to service_role';
 end loop;
end $$;
commit;
