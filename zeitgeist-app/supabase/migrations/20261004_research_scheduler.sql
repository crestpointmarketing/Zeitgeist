-- Apply only after the new production endpoints are deployed and verified.
begin;
create function public.dispatch_research(p_daily boolean default false) returns bigint
language plpgsql security definer set search_path='' as $$
declare token text; request_id bigint;
begin
 select decrypted_secret into token from vault.decrypted_secrets where name='zeitgeist_forecast_cron_secret';
 if token is null or length(token)<32 then raise exception 'Research scheduler is not configured'; end if;
 select net.http_get(url:='https://zeitgeiststocks.com/api/cron/research'||case when p_daily then '?schedule=daily' else '' end,
 headers:=jsonb_build_object('Authorization','Bearer '||token),timeout_milliseconds:=60000) into request_id;
 if not p_daily then update public.research_service_health set last_dispatch_at=clock_timestamp(),last_dispatch_request_id=request_id where id; end if;
 return request_id;
end $$;
revoke all on function public.dispatch_research(boolean) from public,anon,authenticated;
grant execute on function public.dispatch_research(boolean) to service_role;
select cron.schedule('zeitgeist-research-worker','* * * * *','select public.dispatch_research(false);');
select cron.schedule('zeitgeist-daily-research','*/15 * * * *','select public.dispatch_research(true);');
commit;
