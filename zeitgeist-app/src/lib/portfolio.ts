import {z} from 'zod';
const finite=z.number().finite(),positive=finite.positive();
export const historySchema=z.object({ticker:z.string(),source:z.literal('DSA / Yahoo Finance (adjusted)'),bars:z.array(z.object({o:positive,h:positive,l:positive,c:positive,v:finite.nonnegative(),t:finite.int().positive()})).min(400).max(900)}).superRefine((h,ctx)=>{if(h.bars.some((b,i)=>b.h<Math.max(b.o,b.c)||b.l>Math.min(b.o,b.c)||b.h<b.l||b.t>Date.now()||(i>0&&b.t<=h.bars[i-1].t)))ctx.addIssue({code:'custom',message:'Invalid history'});});
const weights=z.record(z.string(),finite.min(0).max(1)),curve=z.array(positive).length(60),day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const schema=z.object({version:z.literal('portfolio-research-v2'),tickers:z.array(z.string()).min(2).max(6),training_through:day,test_start:day,test_end:day,weights,requested_weights:weights,cost_bps_per_side:z.literal(10),optimized_equity:curve,equal_weight_equity:curve,requested_equity:curve,dates:z.array(day).length(60),train_correlation:z.array(z.array(finite.min(-1.000001).max(1.000001))),generated_at:z.string().datetime({offset:true}),source:z.literal('DSA / Yahoo Finance (adjusted)')});
export type PortfolioReport=z.infer<typeof schema>;
export function parsePortfolio(raw:unknown,tickers:string[]):PortfolioReport{
 const p=schema.parse(raw),n=tickers.length;
 if([...p.tickers].sort().join()!==[...tickers].sort().join()||p.training_through>=p.test_start||p.test_start!==p.dates[0]||p.test_end!==p.dates.at(-1)||p.dates.some((d,i)=>i>0&&d<=p.dates[i-1])||Date.now()-Date.parse(p.test_end)>8*86400_000||Math.abs(Date.now()-Date.parse(p.generated_at))>120_000)throw Error('Portfolio identity or dates invalid');
 for(const w of [p.weights,p.requested_weights])if(Object.keys(w).sort().join()!==[...tickers].sort().join()||Math.abs(Object.values(w).reduce((a,b)=>a+b,0)-1)>1e-5)throw Error('Invalid weights');
 if(Object.values(p.weights).some(w=>w>.600001)||p.train_correlation.length!==n||p.train_correlation.some(row=>row.length!==n))throw Error('Invalid portfolio shape');
 return p;
}
export function curveMetrics(curve:number[]){let peak=1,drawdown=0;for(const n of curve){peak=Math.max(peak,n);drawdown=Math.max(drawdown,(1-n/peak)*100);}return {return_pct:((curve.at(-1)??1)-1)*100,drawdown_pct:drawdown};}
