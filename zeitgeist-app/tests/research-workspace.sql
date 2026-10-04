-- Run inside a rollback transaction after the workspace migration.
do $$
declare uid uuid:='10000000-0000-4000-8000-000000000001'; jid uuid; job jsonb;
begin
 insert into auth.users(id,email,aud,role) values(uid,'queue-fixture@example.invalid','authenticated','authenticated');
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform public.change_watchlist('AAPL','add'); perform public.change_watchlist('MSFT','add');
 perform public.change_watchlist('AAPL','daily',true);
 assert (select count(*) from public.watchlist_items where user_id=uid)=2;
 perform public.change_watchlist('AAPL','remove');
 assert (select count(*) from public.watchlist_items where user_id=uid)=1;
 jid:=public.enqueue_research(uid,'model','{"kind":"model","ticker":"MSFT","model":"gru"}','fixture');
 assert public.enqueue_research(uid,'model','{}','fixture')=jid;
 job:=public.claim_research_job();
 assert job->>'id'=jid::text;
 assert public.claim_research_job() is null;
 assert not public.finish_research_job(jid,gen_random_uuid(),'succeeded',0,'{}','{}',null,1);
 assert public.finish_research_job(jid,(job->>'lease')::uuid,'failed',0,'{}',null,'fixture',1);
 perform public.change_research_job(jid,'retry'); perform public.change_research_job(jid,'cancel');
 assert (select status from public.research_jobs where id=jid)='cancelled';
 assert (public.reserve_background_usage(uid,'stock')->>'allowed')::boolean;
 assert not has_function_privilege('authenticated','public.enqueue_research(uuid,text,jsonb,text)','execute');
 assert not has_function_privilege('authenticated','public.reserve_background_usage(uuid,text)','execute');
 assert not has_column_privilege('authenticated','public.research_jobs','checkpoint','select');
 assert not has_table_privilege('authenticated','public.research_jobs','insert');
 assert not has_table_privilege('authenticated','public.watchlist_items','update');
 assert not has_table_privilege('service_role','public.forecast_intervals','update');
end $$;
select 'Workspace queue, deduplication, lease fencing, watchlist, shared budget and privilege checks passed' as verification;
