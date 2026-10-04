import { z } from 'zod';
import { isResearchModel, type ResearchModel } from './research-catalog';
const n = z.number().finite(), positive = n.positive();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v);
const metric = z.object({mae_pp:n.nonnegative(),rmse_pp:n.nonnegative()});
const quantile = z.object({date:day,p10:positive,p50:positive,p90:positive});
export const researchSchema = z.object({
  tracking:z.object({state:z.enum(['saved','unavailable','not_applicable']),ids:z.array(z.string().uuid())}).optional(),
  version:z.literal('fork-research-v1'), fork_commit:z.literal('33266732b0b16188b565e0aeb6b24efa71161f6a'),
  ticker:z.string().regex(/^[A-Z]{1,5}$/), model:z.custom<ResearchModel>(isResearchModel), kind:z.enum(['prediction','strategy','risk']),
  generated_at:z.string().datetime({offset:true}), as_of:day, history_start:day, history_bars:z.number().int().min(400).max(900),
  data_hash:z.string().regex(/^[a-f0-9]{16}$/), source:z.literal('DSA / Yahoo Finance (adjusted)'), last_close:positive,
  prediction:z.object({qualified:z.boolean(),forecast:z.object({date:day,price:positive,return_pct:n.gt(-100)}).nullable(),model:metric,flat:metric,drift:metric,
    windows:z.array(z.object({origin:day,target:day,training_labels_through:day,predicted_return_pct:n.gt(-100),actual_return_pct:n.gt(-100),drift_return_pct:n.gt(-100)})).length(30)}).nullable(),
  strategy:z.object({training_through:day,cost_bps_per_side:z.literal(10),return_pct:n.gt(-100),benchmark_return_pct:n.gt(-100),max_drawdown_pct:n.min(0).max(100),benchmark_drawdown_pct:n.min(0).max(100),turnover:n.nonnegative(),
    observations:z.array(z.object({signal_date:day,execution_date:day,date:day,position:z.union([z.literal(0),z.literal(1)]),market_return_pct:n.gt(-100),net_return_pct:n.gt(-100),benchmark_return_pct:n.gt(-100),turnover:n.min(0).max(2),equity:positive,benchmark_equity:positive})).length(150)}).nullable(),
  risk:z.object({ewma_daily_volatility_pct:n.nonnegative(),rsi14:n.min(0).max(100),scenarios:z.array(quantile).length(5),observations:z.array(z.object({date:day,return_pct:n.gt(-100),z_score:n,svm_outlier:z.boolean()})).length(20)}).nullable(),
});
export type ResearchReport = z.infer<typeof researchSchema>;
export function parseResearch(value:unknown,ticker:string,model:ResearchModel,now=Date.now()):ResearchReport {
  const d=researchSchema.parse(value), generated=Date.parse(d.generated_at), last=Date.parse(d.as_of);
  const eq=(a:number,b:number)=>Math.abs(a-b)<=1e-6*Math.max(1,Math.abs(b));
  if(d.ticker!==ticker || d.model!==model || generated>now+60_000 || now-generated>7200_000 || last>now || now-last>8*86400_000 || d.history_start>=d.as_of) throw Error('Invalid research identity or dates');
  const kind=model.startsWith('paper_')?'strategy':model==='risk_diagnostics'?'risk':'prediction';
  if(d.kind!==kind || Boolean(d.prediction)!==(kind==='prediction') || Boolean(d.strategy)!==(kind==='strategy') || Boolean(d.risk)!==(kind==='risk')) throw Error('Wrong research payload');
  if(d.prediction){
    const p=d.prediction, w=p.windows;
    w.forEach((v,i)=>{if(v.origin<d.history_start || v.origin>=v.target || v.training_labels_through>v.origin || v.target>d.as_of || (i>0 && w[i-1].target!==v.origin)) throw Error('Leaking research window');});
    if(w.at(-1)!.target!==d.as_of) throw Error('Incomplete research horizon');
    for(const key of ['model','flat','drift'] as const){
      const errors=w.map(v=>(key==='model'?v.predicted_return_pct:key==='drift'?v.drift_return_pct:0)-v.actual_return_pct);
      if(!eq(p[key].mae_pp,errors.reduce((a,b)=>a+Math.abs(b),0)/30) || !eq(p[key].rmse_pp,Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/30))) throw Error('Inconsistent research score');
    }
    const pass=p.model.mae_pp<.95*Math.min(p.flat.mae_pp,p.drift.mae_pp);
    if(p.qualified!==pass || Boolean(p.forecast)!==pass) throw Error('Research gate bypass');
    if(p.forecast && (p.forecast.date<=d.as_of || !eq(p.forecast.price,d.last_close*(1+p.forecast.return_pct/100)))) throw Error('Invalid research target');
  }
  if(d.strategy){
    const s=d.strategy; let equity=1,benchmark=1,peak=1,bpeak=1,dd=0,bdd=0,old=0,turnover=0;
    if(s.training_through!==s.observations[0].signal_date) throw Error('Invalid strategy training boundary');
    s.observations.forEach((o,i)=>{
      if(o.signal_date<d.history_start || o.signal_date>=o.execution_date || o.execution_date>=o.date || o.date>d.as_of || (i>0 && s.observations[i-1].date!==o.execution_date)) throw Error('Invalid strategy execution timing');
      const terminal=i===149, change=Math.abs(o.position-old);
      const factor=(1-.001*change)*(1+o.position*o.market_return_pct/100)*(terminal?1-.001*o.position:1);
      const bfactor=(i===0?.999:1)*(1+o.market_return_pct/100)*(terminal?.999:1);
      equity*=factor;benchmark*=bfactor;peak=Math.max(peak,equity);bpeak=Math.max(bpeak,benchmark);dd=Math.max(dd,(1-equity/peak)*100);bdd=Math.max(bdd,(1-benchmark/bpeak)*100);
      const traded=change+(terminal?o.position:0);turnover+=traded;old=o.position;
      if(!eq(o.turnover,traded)||!eq(o.net_return_pct,(factor-1)*100)||!eq(o.benchmark_return_pct,(bfactor-1)*100)||!eq(o.equity,equity)||!eq(o.benchmark_equity,benchmark)) throw Error('Invalid strategy accounting');
    });
    if(s.observations.at(-1)!.date!==d.as_of || !eq(s.return_pct,(equity-1)*100)||!eq(s.benchmark_return_pct,(benchmark-1)*100)||!eq(s.turnover,turnover)||!eq(s.max_drawdown_pct,dd)||!eq(s.benchmark_drawdown_pct,bdd)) throw Error('Inconsistent strategy summary');
  }
  if(d.risk){
    d.risk.scenarios.forEach((p,i)=>{if(p.p10>p.p50||p.p50>p.p90||p.date<=(i?d.risk!.scenarios[i-1].date:d.as_of)) throw Error('Invalid risk scenarios');});
    d.risk.observations.forEach((o,i)=>{if(o.date<d.history_start||o.date>d.as_of||(i>0&&o.date<=d.risk!.observations[i-1].date)) throw Error('Invalid outlier dates');});
    if(d.risk.observations.at(-1)!.date!==d.as_of) throw Error('Incomplete outlier history');
  }
  return d;
}
