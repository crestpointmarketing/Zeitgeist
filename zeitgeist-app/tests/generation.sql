-- Disposable database only. Apply both migrations before running.
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-000000000020');
insert into public.conversations(id,user_id) values ('00000000-0000-4000-8000-000000000021','00000000-0000-4000-8000-000000000020');
set local role service_role;
do $$
declare a jsonb; b jsonb;
begin
  a := public.claim_generation('analysis:test','same');
  assert a->>'state' = 'claimed';
  assert public.claim_generation('analysis:test','same')->>'state' = 'pending';
  assert public.claim_generation('analysis:test','other')->>'state' = 'conflict';
  assert not public.finish_generation('analysis:test', gen_random_uuid(), '{"wrong":true}');
  assert public.finish_generation('analysis:test',(a->>'lease_id')::uuid,'{"summary":"saved"}');
  b := public.claim_generation('analysis:test','same');
  assert b->>'state' = 'ready';
  assert b->'result'->>'summary' = 'saved';

  a := public.claim_generation('analysis:failed','same');
  assert public.finish_generation('analysis:failed',(a->>'lease_id')::uuid,null);
  b := public.claim_generation('analysis:failed','same');
  assert b->>'state' = 'claimed';
  assert not public.finish_generation('analysis:failed',(a->>'lease_id')::uuid,'{"stale":true}');

  a := public.claim_generation('chat:test','same','00000000-0000-4000-8000-000000000021');
  assert public.finish_generation('chat:test',(a->>'lease_id')::uuid,'{"text":"reply"}');
end $$;
reset role;
insert into public.messages(conversation_id,role,content,client_message_id)
values ('00000000-0000-4000-8000-000000000021','user','question','client-id');
insert into public.messages(conversation_id,role,content,client_message_id)
values ('00000000-0000-4000-8000-000000000021','user','question','client-id')
on conflict(conversation_id,role,client_message_id) do nothing;
do $$ begin
  assert (select count(*) from public.messages where client_message_id = 'client-id') = 1;
  assert not has_function_privilege('authenticated','public.claim_generation(text,text,uuid)','execute');
  assert not has_function_privilege('anon','public.finish_generation(text,uuid,jsonb)','execute');
  assert not has_table_privilege('authenticated','public.market_snapshots','insert');
  assert not has_table_privilege('authenticated','public.generation_jobs','select');
end $$;
delete from public.conversations where id = '00000000-0000-4000-8000-000000000021';
do $$ begin
  assert not exists(select 1 from public.generation_jobs where key = 'chat:test'), 'Deleting a conversation must erase cached private replies';
end $$;
rollback;
