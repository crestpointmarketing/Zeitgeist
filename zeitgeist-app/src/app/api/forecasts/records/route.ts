import { requireAccount, RequestError, requestErrorResponse } from '@/lib/api-access';
import { forwardScorecard, type LedgerRecord } from '@/lib/forward-results';
import { validateStockTicker } from '@/lib/stock-utils';
export async function GET(request:Request){
 try{
   const {supabase,user}=await requireAccount();
   const ticker=new URL(request.url).searchParams.get('ticker'),valid=ticker?validateStockTicker(ticker):null;
   if(ticker&&!valid?.isValid)throw new RequestError('Invalid ticker.',400);
   const since=new Date(Date.now()-90*86400_000).toISOString();
   let query=supabase.from('forecast_records').select('id,ticker,model_id,model_version,as_of,target_date,recorded_at,prospective,qualified,last_close,predicted_return_pct,drift_return_pct,data_hash,interval:forecast_intervals(state,samples,nominal_coverage,lower_return_pct,upper_return_pct,sample_ids),checks:forecast_checks(state,attempts,checked_at,reason,outcome)',{count:'exact'})
    .eq('user_id',user.id).gte('recorded_at',since).order('recorded_at',{ascending:false}).limit(500);
   if(valid?.isValid)query=query.eq('ticker',valid.formattedTicker);
   const {data,error,count}=await query;
   if(error)throw new RequestError('Prediction records are temporarily unavailable.',503);
   const records=(data??[]) as unknown as LedgerRecord[];
   return Response.json({success:true,data:{records,scorecard:forwardScorecard(records),since,total:count??records.length,truncated:(count??0)>records.length}},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return requestErrorResponse(e);}
}
