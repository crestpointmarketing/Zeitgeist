import {requireAccount,RequestError,requestErrorResponse} from '@/lib/api-access';
import {createAdminClient} from '@/lib/supabase/admin';
export async function GET(){try{
 const {supabase}=await requireAccount(),admin=createAdminClient();
 const [health,jobs]=await Promise.all([admin.from('research_service_health').select('last_started_at,last_completed_at,last_dispatch_at,summary').single(),supabase.from('research_jobs').select('status,duration_ms,created_at').gte('created_at',new Date(Date.now()-7*86400_000).toISOString()).order('created_at',{ascending:false}).limit(700)]);
 if(health.error||jobs.error)throw new RequestError('Service health unavailable.',503);
 const rows=jobs.data??[],done=rows.filter(j=>['succeeded','failed'].includes(j.status)),durations=done.map(j=>j.duration_ms??0).sort((a,b)=>a-b);
 return Response.json({success:true,data:{worker:health.data,seven_days:{tasks:rows.length,completed:done.filter(j=>j.status==='succeeded').length,failed:done.filter(j=>j.status==='failed').length,active:rows.filter(j=>['queued','running'].includes(j.status)).length,p95_processing_ms:durations.length?durations[Math.ceil(durations.length*.95)-1]:null},failure_rate_pct:done.length?done.filter(j=>j.status==='failed').length/done.length*100:null,scope:'Your latest 700 tasks in the last seven days. Processing time excludes queue wait.'}},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return requestErrorResponse(e);}}
