import {after} from 'next/server';
import {requireAccount,readJson,RequestError,requestErrorResponse} from '@/lib/api-access';
import {createAdminClient} from '@/lib/supabase/admin';
import {jobInput,JOB_COLUMNS} from '@/lib/research-jobs';
import {runResearchQueue} from '@/lib/research-queue';
import {createHash} from 'node:crypto';
import {z} from 'zod';
export const maxDuration=60;
export async function GET(request:Request){try{const {supabase}=await requireAccount();const id=new URL(request.url).searchParams.get('id');if(id&&!z.string().uuid().safeParse(id).success)throw new RequestError('Invalid task identifier.',400);const query=supabase.from('research_jobs').select(id?JOB_COLUMNS:JOB_COLUMNS.replace(',result',''));const {data,error}=id?await query.eq('id',id).maybeSingle():await query.order('created_at',{ascending:false}).limit(100);if(error)throw new RequestError('Research tasks unavailable.',503);if(id&&!data)throw new RequestError('Task not found.',404);return Response.json({success:true,data},{headers:{'Cache-Control':'no-store'}});}catch(e){return requestErrorResponse(e);}}
export async function POST(request:Request){try{
 const {user}=await requireAccount();const parsed=jobInput.safeParse(await readJson(request,4096));
 if(!parsed.success)throw new RequestError('Choose valid stocks, a supported model, and weights totalling 100%.',400);
 const input=parsed.data,key=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 // Duplicate submission within one UTC day opens the same task; failures have an explicit retry.
 const {data,error}=await createAdminClient().rpc('enqueue_research',{p_user:user.id,p_kind:input.kind,p_input:input,p_key:`manual:${new Date().toISOString().slice(0,10)}:${key}`});
 if(error)throw new RequestError('Could not queue research. You can have up to 12 active tasks and 100 new tasks per day.',429);
 after(async()=>{await runResearchQueue().catch(()=>console.error('Research worker failed'));});
 return Response.json({success:true,id:data},{status:202,headers:{'Cache-Control':'no-store'}});
 }catch(e){return requestErrorResponse(e);}}
export async function PATCH(request:Request){try{
 const {supabase}=await requireAccount();const p=z.object({id:z.string().uuid(),action:z.enum(['cancel','retry','read'])}).safeParse(await readJson(request,1024));
 if(!p.success)throw new RequestError('Invalid task change.',400);
 const {error}=await supabase.rpc('change_research_job',{p_id:p.data.id,p_action:p.data.action});
 if(error)throw new RequestError('Task not found or its state has changed. Refresh to continue.',409);
 if(p.data.action==='retry')after(async()=>{await runResearchQueue().catch(()=>console.error('Research worker failed'));});
 return Response.json({success:true});
 }catch(e){return requestErrorResponse(e);}}
