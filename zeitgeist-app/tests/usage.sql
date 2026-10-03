-- Run ONLY in a disposable test database after schema.sql and the usage migration.
-- All fixtures and grants are rolled back.
begin;
truncate public.api_usage, public.api_leases;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000002');
insert into public.conversations(id,user_id) values ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002');
grant select, delete on public.conversations, public.messages to authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
declare a jsonb; b jsonb;
begin
  a := public.reserve_api_usage('chat'); b := public.reserve_api_usage('chat');
  assert (a->>'allowed')::boolean and (b->>'allowed')::boolean, 'first two requests must be admitted';
  assert not (public.reserve_api_usage('chat')->>'allowed')::boolean, 'third concurrent request must be denied';
  perform public.release_api_usage((a->>'lease_id')::uuid);
  perform public.release_api_usage((b->>'lease_id')::uuid);
  for i in 1..4 loop
    a := public.reserve_api_usage('chat');
    assert (a->>'allowed')::boolean, 'requests through minute cap must pass';
    perform public.release_api_usage((a->>'lease_id')::uuid);
  end loop;
  assert not (public.reserve_api_usage('chat')->>'allowed')::boolean, 'minute cap must survive lease release';
  begin
    delete from public.api_usage;
    raise exception 'usage rows were writable';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
truncate public.api_usage, public.api_leases;
insert into public.api_usage values ('00000000-0000-4000-8000-000000000002','chat:day',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',49);
set local role authenticated;
do $$
declare a jsonb;
begin
  a := public.reserve_api_usage('chat');
  assert (a->>'allowed')::boolean, '50th request must pass';
  perform public.release_api_usage((a->>'lease_id')::uuid);
  delete from public.conversations where id = '00000000-0000-4000-8000-000000000003';
  assert not (public.reserve_api_usage('chat')->>'allowed')::boolean, 'deleting chat must not refund quota';
end $$;
reset role;
truncate public.api_usage, public.api_leases;
insert into public.api_usage values ('global','analysis:day',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',200);
set local role authenticated;
do $$ begin
  assert not (public.reserve_api_usage('analysis')->>'allowed')::boolean, 'global analysis cap must hold';
end $$;
reset role;
do $$ begin
  assert not has_function_privilege('anon','public.reserve_api_usage(text)','execute'), 'anonymous execution must be revoked';
  assert not has_table_privilege('authenticated','public.api_usage','delete'), 'usage deletion must be revoked';
end $$;
rollback;
