-- Transaction-only probes. No test user, record or lease survives ROLLBACK.
begin;
insert into auth.users(id) values('00000000-0000-4000-8000-000000000081'),('00000000-0000-4000-8000-000000000082');
set local role service_role;
insert into public.forecast_records(id,user_id,ticker,model_id,model_version,code_revision,as_of,target_date,next_open,target_close,generated_at,recorded_at,qualified,last_close,predicted_return_pct,drift_return_pct,data_hash,input_payload,report_payload)
values('00000000-0000-4000-8000-000000000083','00000000-0000-4000-8000-000000000081','TEST','lstm','test-only','test-only',current_date,current_date+7,clock_timestamp()+interval '1 day',clock_timestamp()+interval '7 days',clock_timestamp()-interval '1 minute','2000-01-01',true,100,2,1,'test-only','{}','{}');
insert into public.forecast_records(user_id,ticker,model_id,model_version,code_revision,as_of,target_date,next_open,target_close,generated_at,qualified,last_close,predicted_return_pct,drift_return_pct,data_hash,input_payload,report_payload)
values('00000000-0000-4000-8000-000000000081','TEST','lstm','test-only','changed',current_date,current_date+7,clock_timestamp()+interval '1 day',clock_timestamp()+interval '7 days',clock_timestamp()-interval '1 minute',true,100,999,1,'changed','{}','{}')
on conflict(user_id,ticker,model_id,model_version,as_of) do nothing;
do $$ declare lease uuid; begin
 assert (select predicted_return_pct=2 and code_revision='test-only' and recorded_at>clock_timestamp()-interval '1 minute' and prospective from public.forecast_records where id='00000000-0000-4000-8000-000000000083');
 assert (select state='pending' from public.forecast_checks where record_id='00000000-0000-4000-8000-000000000083');
 assert not has_table_privilege('service_role','public.forecast_records','update');
 assert not has_table_privilege('authenticated','public.forecast_records','insert');
 assert not has_table_privilege('anon','public.forecast_records','select');
 assert not has_table_privilege('authenticated','public.forecast_checks','update');
 assert not has_function_privilege('authenticated','public.claim_forecast_reconciliation()','execute');
 lease := public.claim_forecast_reconciliation();assert lease is not null;
 assert public.claim_forecast_reconciliation() is null;
 perform public.finish_forecast_reconciliation(gen_random_uuid(),'{}');
 assert public.claim_forecast_reconciliation() is null;
 perform public.finish_forecast_reconciliation(lease,'{}');
end $$;
insert into public.forecast_records(id,user_id,ticker,model_id,model_version,code_revision,as_of,target_date,next_open,target_close,generated_at,qualified,last_close,predicted_return_pct,drift_return_pct,data_hash,input_payload,report_payload)
values('00000000-0000-4000-8000-000000000084','00000000-0000-4000-8000-000000000081','TEST','gru','test-only','test-only',current_date,current_date+7,clock_timestamp()-interval '1 hour',clock_timestamp()+interval '7 days',clock_timestamp()-interval '1 minute',true,100,2,1,'test-only','{}','{}');
do $$ begin
 assert (select not prospective from public.forecast_records where id='00000000-0000-4000-8000-000000000084');
 assert (select state='late' from public.forecast_checks where record_id='00000000-0000-4000-8000-000000000084');
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000081","role":"authenticated"}',true);
do $$ begin assert (select count(*) from public.forecast_records)=2;assert (select count(*) from public.forecast_checks)=2;end $$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000082","role":"authenticated"}',true);
do $$ begin assert (select count(*) from public.forecast_records)=0;assert (select count(*) from public.forecast_checks)=0;end $$;
rollback;
