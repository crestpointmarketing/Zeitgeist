import { z } from 'zod';
import { isResearchModel } from './research-catalog';
const ticker=z.string().trim().toUpperCase().regex(/^[A-Z]{1,5}$/);
export const jobInput=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('model'),ticker,model:z.string().refine(isResearchModel)}),
 z.object({kind:z.literal('daily'),ticker}),
 z.object({kind:z.literal('comparison'),tickers:z.array(ticker).min(2).max(5).refine(v=>new Set(v).size===v.length)}),
 z.object({kind:z.literal('portfolio'),tickers:z.array(ticker).min(2).max(6).refine(v=>new Set(v).size===v.length),weights:z.array(z.number().finite().min(0).max(1)).min(2).max(6)}),
]).refine(v=>v.kind!=='portfolio'||(v.weights.length===v.tickers.length&&Math.abs(v.weights.reduce((a,b)=>a+b,0)-1)<1e-6),{message:'Portfolio weights must match the stocks and sum to 100%.'});
export type JobInput=z.infer<typeof jobInput>;
export type ResearchJob={id:string;kind:JobInput['kind'];input:JobInput & {scheduled?:boolean;session?:string};status:'queued'|'running'|'succeeded'|'failed'|'cancelled';stage:number;result:Record<string,unknown>|null;error:string|null;attempts:number;created_at:string;started_at:string|null;finished_at:string|null;read_at:string|null;duration_ms:number|null};
export const JOB_COLUMNS='id,kind,input,status,stage,result,error,attempts,created_at,started_at,finished_at,read_at,duration_ms';

export function progressLabel(job:ResearchJob){
 if(job.status==='succeeded')return 'Ready';
 if(job.status==='failed')return 'Needs attention';
 if(job.status==='cancelled')return 'Cancelled';
 if(job.kind==='daily')return job.stage===0?'Collecting market evidence':'Writing daily brief';
 if(job.kind==='portfolio'||job.kind==='comparison')return `Evidence ${Math.min(job.stage+1,job.input.kind==='portfolio'||job.input.kind==='comparison'?job.input.tickers.length:1)}`;
 return 'Running model';
}
