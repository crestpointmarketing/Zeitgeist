import { z } from 'zod';
const finite=z.number().finite(),day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const settlementSchema=z.object({ticker:z.string(),origin:day,target:day,source:z.literal('DSA / Yahoo Finance (adjusted)'),retrieved_at:z.string().datetime({offset:true}),
 bars:z.array(z.object({o:finite.positive(),h:finite.positive(),l:finite.positive(),c:finite.positive(),v:finite.nonnegative(),t:finite.int().positive()})).length(6)});
export type Outcome={actual_return_pct:number;origin_close:number;target_close:number;adjustment_ratio:number;retrieved_at:string;source:string;bars:z.infer<typeof settlementSchema>['bars']};
export type LedgerRecord={id:string;ticker:string;model_id:string;model_version:string;as_of:string;target_date:string;recorded_at:string;prospective:boolean;qualified:boolean;last_close:number;predicted_return_pct:number|null;drift_return_pct:number;data_hash:string;
 checks:{state:'pending'|'settled'|'late';attempts:number;checked_at:string|null;reason:string|null;outcome:Outcome|null}|null};

export function validateSettlement(value:unknown,record:{ticker:string;as_of:string;target_date:string;target_close:string;last_close:number},now=Date.now()):Outcome{
 const d=settlementSchema.parse(value),bars=d.bars,date=(n:number)=>new Date(n).toISOString().slice(0,10),time=Date.parse(d.retrieved_at);
 if(d.ticker!==record.ticker||d.origin!==record.as_of||d.target!==record.target_date||date(bars[0].t)!==record.as_of||date(bars[5].t)!==record.target_date||bars[5].t!==Date.parse(record.target_close)||now<bars[5].t+1200_000||time>now+60_000||time<bars[5].t+1200_000||now-time>7200_000)throw Error('Settlement identity, calendar or freshness mismatch');
 bars.forEach((b,i)=>{if(b.h<Math.max(b.o,b.c)||b.l>Math.min(b.o,b.c)||b.h<b.l||(i>0&&b.t<=bars[i-1].t))throw Error('Invalid realized bars');});
 const actual=(bars[5].c/bars[0].c-1)*100;
 if(!Number.isFinite(actual)||actual<=-100)throw Error('Invalid realized return');
 return {actual_return_pct:actual,origin_close:bars[0].c,target_close:bars[5].c,adjustment_ratio:bars[0].c/record.last_close,retrieved_at:d.retrieved_at,source:d.source,bars};
}

export function forwardScorecard(records:LedgerRecord[]){
 const groups=new Map<string,LedgerRecord[]>();
 for(const r of records){const key=r.model_id+'|'+r.model_version;groups.set(key,[...(groups.get(key)||[]),r]);}
 return [...groups.values()].map(rows=>{
   const eligible=rows.filter(r=>r.prospective),samples=eligible.filter(r=>r.qualified&&r.predicted_return_pct!==null&&r.checks?.state==='settled'&&r.checks.outcome);
   const errors=samples.map(r=>r.predicted_return_pct!-r.checks!.outcome!.actual_return_pct),n=errors.length;
   const directional=samples.filter(r=>Math.abs(r.checks!.outcome!.actual_return_pct)>1e-10);
   return {model:rows[0].model_id,version:rows[0].model_version,recorded:rows.length,eligible:eligible.length,withheld:eligible.filter(r=>!r.qualified).length,
     pending:eligible.filter(r=>r.qualified&&r.checks?.state==='pending').length,late:rows.length-eligible.length,settled:n,
     mae:n?errors.reduce((a,b)=>a+Math.abs(b),0)/n:null,rmse:n?Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/n):null,
     flat_mae:n?samples.reduce((a,r)=>a+Math.abs(r.checks!.outcome!.actual_return_pct),0)/n:null,
     drift_mae:n?samples.reduce((a,r)=>a+Math.abs(r.drift_return_pct-r.checks!.outcome!.actual_return_pct),0)/n:null,
     direction_samples:directional.length,direction_hit_pct:directional.length?directional.filter(r=>Math.sign(r.predicted_return_pct!)===Math.sign(r.checks!.outcome!.actual_return_pct)).length/directional.length*100:null};
 });
}
