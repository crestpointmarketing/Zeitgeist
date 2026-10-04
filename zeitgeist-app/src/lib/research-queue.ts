import 'server-only';
import {createAdminClient} from './supabase/admin';
import {backgroundAccount} from './background-account';
import {reserveUsage,RequestError} from './api-access';
import {getResearch} from './research-provider';
import {recordForecast} from './forecast-recording';
import {fetchSnapshot,analyzeSnapshot} from './stock-service';
import type {StockSnapshot} from './stock-evidence';
import type {ResearchJob} from './research-jobs';
import type {ResearchModel} from './research-catalog';
import {bridgeJson} from './bridge-client';
import {historySchema,parsePortfolio} from './portfolio';
import {z} from 'zod';

type Snapshot=StockSnapshot & {snapshot_id:string};
type Claimed=ResearchJob & {user_id:string;lease:string;checkpoint:{snapshots?:Snapshot[];histories?:Record<string,z.infer<typeof historySchema>['bars']>}};
export async function runResearchQueue(){
 const admin=createAdminClient(),{data,error}=await admin.rpc('claim_research_job');
 if(error)throw new RequestError('Task queue unavailable.',503);
 if(!data){await admin.from('research_service_health').update({last_completed_at:new Date().toISOString(),summary:{state:'no_claimable_task'}}).eq('id',true);return {state:'idle'};}
 const job=data as Claimed,start=Date.now(),account=backgroundAccount(job.user_id);
 let status='succeeded',stage=job.stage,checkpoint=job.checkpoint,result:unknown=null,message:string|null=null;
 try{
  // Re-check current account before making any provider request, including persisted AI stage.
  const user=await account.supabase.auth.getUser();
  if(user.error||!user.data.user||('banned_until' in user.data.user&&Date.parse(String(user.data.user.banned_until))>Date.now()))throw new RequestError('Account unavailable.',403);
  if(job.input.kind==='model'){
   const release=await reserveUsage(account.supabase,'stock');
   try{const {forward_evidence,...report}=await getResearch(job.input.ticker,job.input.model as ResearchModel);result={type:'model',report:{...report,tracking:await recordForecast(job.user_id,report,forward_evidence)}};}finally{await release();}
  }else if(job.input.kind==='daily'){
   if(job.input.scheduled){const {data:enabled}=await admin.from('watchlist_items').select('daily_enabled').eq('user_id',job.user_id).eq('ticker',job.input.ticker).maybeSingle();if(!enabled?.daily_enabled)throw new RequestError('Daily research was disabled for this stock.',409);}
   if(stage===0){
    const snapshot=await fetchSnapshot(account,job.input.ticker);
    if(job.input.session&&snapshot.evidence.session_date!==job.input.session)throw new RequestError('The source has not supplied the expected completed session yet.',503);
    checkpoint={snapshots:[snapshot]};stage=1;status='queued';
   }else{
    const snapshot=checkpoint.snapshots![0],answer=await analyzeSnapshot(account,snapshot.snapshot_id);
    if(answer.status==='pending'){status='queued';message='AI evidence is being prepared. This task will retry automatically.';}
    else{
     const {data:prior}=await admin.from('research_jobs').select('result').eq('user_id',job.user_id).eq('kind','daily').eq('status','succeeded').eq('input->>ticker',job.input.ticker).lt('created_at',job.created_at).order('created_at',{ascending:false}).limit(1).maybeSingle();
     const previous=prior?.result?.snapshot as Snapshot|undefined;
     const earlier=previous&&previous.evidence.session_date<snapshot.evidence.session_date?previous:undefined;
     const priorBar=earlier?snapshot.price_history.find(b=>b.date===earlier.evidence.session_date):undefined;
     result={type:'daily',snapshot,analysis:answer.analysis,generated_at:new Date().toISOString(),changes:{previous_session:earlier?.evidence.session_date??null,price_change_pct:priorBar?(snapshot.stock_data.price/priorBar.close-1)*100:null,new_articles:earlier?snapshot.news?.articles.filter(a=>!earlier.news?.articles.some(b=>b.url===a.url))??[]:[]}};
    }
   }
  }else if(job.input.kind==='comparison'){
   const snapshots=checkpoint.snapshots??[];
   if(stage<job.input.tickers.length){snapshots.push(await fetchSnapshot(account,job.input.tickers[stage]));checkpoint={snapshots};stage++;status='queued';}
   else result={type:'comparison',snapshots,generated_at:new Date().toISOString()};
  }else{
   const histories=checkpoint.histories??{};
   if(stage<job.input.tickers.length){
    const ticker=job.input.tickers[stage],release=await reserveUsage(account.supabase,'stock');
    try{const h=historySchema.parse(await bridgeJson(`/v1/research-history/${ticker}`));if(h.ticker!==ticker||Date.now()-h.bars.at(-1)!.t>8*86400_000)throw new RequestError('History identity or freshness check failed.',503);histories[ticker]=h.bars;}finally{await release();}
    checkpoint={histories};stage++;status='queued';
   }else result={type:'portfolio',report:parsePortfolio(await bridgeJson('/v1/portfolio',{histories,weights:Object.fromEntries(job.input.tickers.map((t,i)=>[t,job.input.kind==='portfolio'?job.input.weights[i]:0]))}),job.input.tickers)};
  }
 }catch(e){message=e instanceof RequestError?e.message:'Research could not be completed. Retry the task.';status=job.attempts<3&&(!(e instanceof RequestError)||[429,502,503,504].includes(e.status))?'queued':'failed';}
 if(status==='queued'&&stage===job.stage&&job.attempts>=3)status='failed';
 const saved=await admin.rpc('finish_research_job',{p_id:job.id,p_lease:job.lease,p_status:status,p_stage:stage,p_checkpoint:status==='succeeded'?{}:checkpoint,p_result:result,p_error:message,p_duration:Date.now()-start});
 if(saved.error||!saved.data)throw new RequestError('Could not save task progress. The expired lease will be recovered.',503);
 return {state:status};
}

export async function scheduleDailyResearch(){
 const admin=createAdminClient();
 const calendar=z.object({session:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),close:z.string().datetime({offset:true})}).parse(await bridgeJson('/v1/calendar',undefined,8000));
 const closed=Date.parse(calendar.close);
 // Do not create new weekend/holiday catch-up tasks days after a close.
 if(Date.now()<closed+20*60_000||Date.now()>closed+18*3600_000)return {scheduled:0};
 const {data,error}=await admin.from('watchlist_items').select('user_id,ticker').eq('daily_enabled',true).order('user_id').order('ticker').limit(1000);
 if(error)throw new RequestError('Daily settings unavailable.',503);
 let scheduled=0,skipped=0;
 for(const row of data??[]){
  const r=await admin.rpc('enqueue_research',{p_user:row.user_id,p_kind:'daily',p_input:{kind:'daily',ticker:row.ticker,scheduled:true,session:calendar.session},p_key:`daily:${calendar.session}:${row.ticker}`});
  if(r.error)skipped++;else scheduled++;
 }
 return {scheduled,skipped,settings_capped:(data?.length??0)===1000};
}
