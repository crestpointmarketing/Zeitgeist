-- Apply after 20261002_api_usage.sql. All writes are server-only.
create table public.market_snapshots (
  id uuid primary key default gen_random_uuid(),
  payload jsonb not null,
  expires_at timestamptz not null default now() + interval '24 hours'
);
create index market_snapshots_expiry on public.market_snapshots(expires_at);

create table public.generation_jobs (
  key text primary key,
  fingerprint text not null,
  conversation_id uuid references public.conversations(id) on delete cascade,
  lease_id uuid,
  expires_at timestamptz not null,
  result jsonb
);
create index generation_jobs_expiry on public.generation_jobs(expires_at);
alter table public.market_snapshots enable row level security;
alter table public.generation_jobs enable row level security;
revoke all on public.market_snapshots, public.generation_jobs from public, anon, authenticated;
grant all on public.market_snapshots, public.generation_jobs to service_role;

alter table public.messages add column client_message_id text;
create unique index messages_request_unique on public.messages(conversation_id, role, client_message_id);

create function public.claim_generation(p_key text, p_fingerprint text, p_conversation uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare job public.generation_jobs; token uuid;
begin
  -- Cleanup expired snapshots and abandoned/old analysis cache, never live leases.
  delete from public.market_snapshots where expires_at < now();
  delete from public.generation_jobs where conversation_id is null and expires_at < now() - interval '1 day';
  insert into public.generation_jobs(key, fingerprint, conversation_id, expires_at)
    values(p_key, p_fingerprint, p_conversation, now()) on conflict do nothing;
  select * into job from public.generation_jobs where key = p_key for update;
  if job.fingerprint <> p_fingerprint or job.conversation_id is distinct from p_conversation then
    return jsonb_build_object('state', 'conflict');
  end if;
  if job.result is not null and job.expires_at > now() then
    return jsonb_build_object('state', 'ready', 'result', job.result);
  end if;
  if job.lease_id is not null and job.expires_at > now() then
    return jsonb_build_object('state', 'pending');
  end if;
  token := gen_random_uuid();
  update public.generation_jobs set lease_id = token, expires_at = now() + interval '120 seconds', result = null where key = p_key;
  return jsonb_build_object('state', 'claimed', 'lease_id', token);
end $$;

create function public.finish_generation(p_key text, p_lease uuid, p_result jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.generation_jobs set result = p_result, lease_id = null,
    expires_at = case when p_result is null then now()
      when conversation_id is not null then 'infinity'::timestamptz else now() + interval '24 hours' end
    where key = p_key and lease_id = p_lease;
  return found;
end $$;
revoke all on function public.claim_generation(text,text,uuid) from public, anon, authenticated;
revoke all on function public.finish_generation(text,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.claim_generation(text,text,uuid) to service_role;
grant execute on function public.finish_generation(text,uuid,jsonb) to service_role;
