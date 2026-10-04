import { z } from 'zod';
const finite=z.number().finite();
const bar=z.object({o:finite.positive(),h:finite.positive(),l:finite.positive(),c:finite.positive(),v:finite.nonnegative(),t:finite.int().positive()});
export const forwardEvidenceSchema=z.object({bars:z.array(bar).min(400).max(900),next_open:z.string().datetime({offset:true}),target_close:z.string().datetime({offset:true}),target_date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),drift_return_pct:finite.gt(-100)});
export type ForwardEvidence=z.infer<typeof forwardEvidenceSchema>;
export function parseForwardEvidence(value:unknown,report:{as_of:string;history_bars:number;last_close:number;target_date?:string;prediction?:{forecast:{date:string}|null}|null}){
  if(value===undefined)return undefined; // Rolling deployment: report remains usable, recording is explicitly unavailable.
  const e=forwardEvidenceSchema.parse(value),last=e.bars.at(-1)!;
  const date=(t:number)=>new Date(t).toISOString().slice(0,10);
  const target=report.target_date??report.prediction?.forecast?.date;
  if(e.bars.length!==report.history_bars||last.c!==report.last_close||date(last.t)!==report.as_of||
    Date.parse(e.next_open)<=last.t||Date.parse(e.target_close)<=Date.parse(e.next_open)||date(Date.parse(e.target_close))!==e.target_date||
    (target&&target!==e.target_date)||Date.parse(e.target_close)-last.t>15*86400_000)throw Error('Inconsistent forward evidence');
  e.bars.forEach((b,i)=>{if(b.h<Math.max(b.o,b.c)||b.l>Math.min(b.o,b.c)||b.l>b.h||(i>0&&e.bars[i-1].t>=b.t))throw Error('Invalid frozen bars');});
  const c=e.bars.slice(-61).map(b=>b.c),drift=Math.expm1(Math.log(c.at(-1)!/c[0])/60*5)*100;
  if(Math.abs(drift-e.drift_return_pct)>1e-6*Math.max(1,Math.abs(drift)))throw Error('Invalid frozen drift baseline');
  return e;
}
