import 'server-only';
import { createAdminClient } from './supabase/admin';
import { validateSettlement } from './forward-results';

export async function reconcileForecasts(){
 const admin=createAdminClient();
 const {data:lease,error}=await admin.rpc('claim_forecast_reconciliation');
 if(error)throw Error('Reconciliation storage unavailable');
 if(!lease)return {state:'busy',checked:0,settled:0,deferred:0};
 const summary={state:'complete',checked:0,settled:0,deferred:0};
 try{
   const {data:due,error:readError}=await admin.from('forecast_checks').select('record_id,attempts,record:forecast_records!inner(ticker,as_of,target_date,target_close,last_close,prospective)')
    .eq('state','pending').lte('next_check_at',new Date().toISOString()).order('next_check_at').limit(100);
   if(readError)throw readError;
   type Due={record_id:string;attempts:number;record:{ticker:string;as_of:string;target_date:string;target_close:string;last_close:number;prospective:boolean}};
   const groups=new Map<string,Due[]>();
   for(const d of (due??[]) as unknown as Due[]){const key=[d.record.ticker,d.record.as_of,d.record.target_date].join('|');groups.set(key,[...(groups.get(key)||[]),d]);}
   // Two 20-second bridge requests fit within a 60-second function; a lease prevents overlap.
   for(const group of [...groups.values()].slice(0,2)){
     summary.checked+=group.length;
     try{
       const base=process.env.DSA_BASE_URL,token=process.env.DSA_SERVICE_TOKEN;
       if(!base||!token)throw Error('Missing provider');
       const r=group[0].record,url=new URL(`/v1/settlement/${encodeURIComponent(r.ticker)}`,base);
       if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('Insecure provider');
       url.searchParams.set('origin',r.as_of);url.searchParams.set('target',r.target_date);
       const response=await fetch(url,{headers:{Authorization:`Bearer ${token}`},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(22_000)});
       if(!response.ok)throw Error('Provider unavailable');
       const payload=await response.json();
       for(const item of group){
         if(!item.record.prospective)throw Error('Ineligible record');
         const outcome=validateSettlement(payload,item.record);
         const {data:written,error:writeError}=await admin.from('forecast_checks').update({state:'settled',outcome,checked_at:new Date().toISOString(),attempts:item.attempts+1,reason:null})
          .eq('record_id',item.record_id).eq('state','pending').select('record_id');
         if(writeError)throw writeError;
         summary.settled+=written?.length??0;
       }
     }catch{
       for(const item of group){
         const {data:deferred,error:writeError}=await admin.from('forecast_checks').update({attempts:item.attempts+1,checked_at:new Date().toISOString(),next_check_at:new Date(Date.now()+3600_000).toISOString(),reason:'Exact completed-session evidence is unavailable. Automatic retry is scheduled.'})
          .eq('record_id',item.record_id).eq('state','pending').select('record_id');
         if(writeError)throw writeError;
         summary.deferred+=deferred?.length??0;
       }
     }
   }
   return summary;
 }catch(error){
   summary.state='failed';
   throw error;
 }finally{
   const {error:finishError}=await admin.rpc('finish_forecast_reconciliation',{p_lease:lease,p_summary:summary});
   if(finishError)console.error('Forecast reconciliation lease release failed');
 }
}
