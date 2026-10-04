-- Apply after forward_validation. Configure the Vault secret first through its UI.
-- Vercel Services deployed the endpoint but did not register top-level crons.
-- Supabase is the sole scheduler; do not also enable a Vercel cron.
begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

alter table public.forecast_reconciliation
 add column last_dispatch_request_id bigint,
 add column last_dispatch_at timestamptz;

create function public.dispatch_forecast_check() returns bigint
language plpgsql security definer set search_path='' as $$
declare token text; request_id bigint;
begin
 select decrypted_secret into token from vault.decrypted_secrets
 where name='zeitgeist_forecast_cron_secret';
 if token is null or length(token)<32 then raise exception 'Forecast scheduler is not configured'; end if;
 select net.http_get(
   url:='https://zeitgeiststocks.com/api/cron/forecast-settlement',
   headers:=jsonb_build_object('Authorization','Bearer '||token),
   timeout_milliseconds:=60000
 ) into request_id;
 update public.forecast_reconciliation set last_dispatch_request_id=request_id,last_dispatch_at=clock_timestamp()
 where id=true;
 return request_id;
end $$;
revoke all on function public.dispatch_forecast_check() from public,anon,authenticated;
grant execute on function public.dispatch_forecast_check() to service_role;

do $$ begin
 assert not has_function_privilege('authenticated','public.dispatch_forecast_check()','execute');
 assert not has_table_privilege('authenticated','vault.decrypted_secrets','select');
 assert not has_table_privilege('anon','vault.decrypted_secrets','select');
 assert exists(select 1 from vault.decrypted_secrets where name='zeitgeist_forecast_cron_secret' and length(decrypted_secret)>=32);
end $$;
select cron.schedule('zeitgeist-forward-validation','15 * * * *','select public.dispatch_forecast_check();');
commit;
