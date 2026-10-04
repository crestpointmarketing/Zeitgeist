import 'server-only';
import { createHash } from 'node:crypto';
import { createAdminClient } from './supabase/admin';
import type { ForecastReport } from './forecast-schema';
import type { ResearchReport } from './research-schema';
import type { ForwardEvidence } from './forward-evidence';
export type RecordingStatus={state:'saved'|'unavailable'|'not_applicable';ids:string[]};

/** The authenticated server records its own validated report; browser-supplied results are never accepted. */
export async function recordForecast(userId:string,report:ForecastReport|ResearchReport,evidence?:ForwardEvidence):Promise<RecordingStatus>{
  if('kind' in report&&report.kind!=='prediction')return {state:'not_applicable',ids:[]};
  if(!evidence)return {state:'unavailable',ids:[]};
  try{
    const admin=createAdminClient();
    const candidates='kind' in report?[{id:report.model,value:report.prediction!.forecast?.return_pct??null}]:[
      {id:'tree_ensemble',value:report.forecast?.return_pct??null},
      ...(report.version==='fork-comparison-v3'?[{id:'gradient_boosting',value:report.boosted_forecast?.return_pct??null}]:[]),
    ];
    const ids:string[]=[];
    for(const candidate of candidates){
      const row={user_id:userId,ticker:report.ticker,model_id:candidate.id,model_version:report.version,
        code_revision:process.env.VERCEL_GIT_COMMIT_SHA||'local-development',as_of:report.as_of,target_date:evidence.target_date,
        next_open:evidence.next_open,target_close:evidence.target_close,generated_at:report.generated_at,
        qualified:candidate.value!==null,last_close:report.last_close,predicted_return_pct:candidate.value,drift_return_pct:evidence.drift_return_pct,
        data_hash:report.data_hash,input_payload:{...evidence,sha256:createHash('sha256').update(JSON.stringify(evidence)).digest('hex')},report_payload:report};
      const {error}=await admin.from('forecast_records').upsert(row,{onConflict:'user_id,ticker,model_id,model_version,as_of',ignoreDuplicates:true});
      if(error)throw error;
      const {data,error:readError}=await admin.from('forecast_records').select('id').eq('user_id',userId).eq('ticker',report.ticker).eq('model_id',candidate.id).eq('model_version',report.version).eq('as_of',report.as_of).single();
      if(readError||!data)throw readError;
      ids.push(data.id);
    }
    return {state:'saved',ids};
  }catch{console.error('Forecast recording unavailable');return {state:'unavailable',ids:[]};}
}
