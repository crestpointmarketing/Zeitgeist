import 'server-only';
import {createAdminClient} from './supabase/admin';
import {calibrateInterval} from './model-comparison';
import type {LedgerRecord} from './forward-results';
const columns='id,ticker,model_id,model_version,as_of,target_date,recorded_at,prospective,qualified,last_close,predicted_return_pct,drift_return_pct,data_hash,checks:forecast_checks(state,attempts,checked_at,reason,outcome)';
export async function recordInterval(userId:string,id:string){
 const admin=createAdminClient();
 const {data:current,error}=await admin.from('forecast_records').select(columns).eq('user_id',userId).eq('id',id).single();
 if(error||!current)throw Error('Record unavailable');
 // Do not backfill a newly computed interval onto an old prediction.
 if(Date.now()-Date.parse(current.recorded_at)>120_000)return;
 const {data:history,error:readError}=await admin.from('forecast_records').select(columns).eq('user_id',userId).eq('model_id',current.model_id).eq('model_version',current.model_version).lt('target_date',current.as_of).order('as_of',{ascending:false}).limit(2000);
 if(readError)throw readError;
 const interval=calibrateInterval((history??[]) as unknown as LedgerRecord[],current as unknown as LedgerRecord);
 const {error:saveError}=await admin.from('forecast_intervals').upsert({record_id:id,...interval},{onConflict:'record_id',ignoreDuplicates:true});
 if(saveError)throw saveError;
}
