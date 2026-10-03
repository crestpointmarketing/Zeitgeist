-- Apply after schema.sql. Counts survive deletion of conversations and accounts.
create table if not exists public.api_usage (
  scope text not null,
  feature text not null,
  window_start timestamptz not null,
  used integer not null default 0,
  primary key (scope, feature, window_start)
);
create table if not exists public.api_leases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  expires_at timestamptz not null
);
create index if not exists api_leases_user_idx on public.api_leases(user_id);
alter table public.api_usage enable row level security;
alter table public.api_leases enable row level security;
revoke all on public.api_usage, public.api_leases from public, anon, authenticated;

create or replace function public.reserve_api_usage(feature text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  now_at timestamptz := clock_timestamp();
  day_at timestamptz := date_trunc('day', now_at at time zone 'UTC') at time zone 'UTC';
  minute_at timestamptz := date_trunc('minute', now_at);
  daily_cap integer;
  minute_cap integer;
  global_cap integer;
  lease uuid;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  case feature
    when 'analysis' then daily_cap := 10; minute_cap := 3; global_cap := 200;
    when 'chat' then daily_cap := 50; minute_cap := 6; global_cap := 1000;
    when 'stock' then daily_cap := 60; minute_cap := 20; global_cap := 2000;
    else raise exception 'Invalid feature';
  end case;
  -- Serializes check + increment across all app instances, not just one process.
  perform pg_advisory_xact_lock(732019846);
  delete from public.api_leases where expires_at <= now_at;
  delete from public.api_usage where window_start < day_at - interval '2 days';
  if (select count(*) from public.api_leases where user_id = uid) >= 2 then
    return jsonb_build_object('allowed', false);
  end if;
  if coalesce((select used from public.api_usage u where u.scope = uid::text and u.feature = reserve_api_usage.feature || ':day' and u.window_start = day_at), 0) >= daily_cap
    or coalesce((select used from public.api_usage u where u.scope = uid::text and u.feature = reserve_api_usage.feature || ':minute' and u.window_start = minute_at), 0) >= minute_cap
    or coalesce((select used from public.api_usage u where u.scope = 'global' and u.feature = reserve_api_usage.feature || ':day' and u.window_start = day_at), 0) >= global_cap then
    return jsonb_build_object('allowed', false);
  end if;
  insert into public.api_usage as u (scope, feature, window_start, used) values
    (uid::text, feature || ':day', day_at, 1),
    (uid::text, feature || ':minute', minute_at, 1),
    ('global', feature || ':day', day_at, 1)
  on conflict on constraint api_usage_pkey do update set used = u.used + 1;
  insert into public.api_leases(user_id, expires_at)
    values (uid, now_at + interval '180 seconds') returning id into lease;
  return jsonb_build_object('allowed', true, 'lease_id', lease);
end $$;

create or replace function public.release_api_usage(lease_id uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.api_leases where id = lease_id and user_id = auth.uid();
$$;
revoke all on function public.reserve_api_usage(text) from public, anon;
revoke all on function public.release_api_usage(uuid) from public, anon;
grant execute on function public.reserve_api_usage(text) to authenticated;
grant execute on function public.release_api_usage(uuid) to authenticated;
