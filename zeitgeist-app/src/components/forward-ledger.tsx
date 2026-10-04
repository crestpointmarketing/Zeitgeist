"use client";
import { useCallback, useEffect, useState } from 'react';
import type { RecordingStatus } from '@/lib/forecast-recording';
import type { LedgerRecord, forwardScorecard } from '@/lib/forward-results';
import { RESEARCH_MODELS } from '@/lib/research-catalog';
import {ModelComparison,IntervalSummary} from './model-comparison';
import type {Calibration} from '@/lib/model-comparison';
const label=(id:string)=>id==='tree_ensemble'?'Tree ensemble':id==='gradient_boosting'?'Gradient Boosting':RESEARCH_MODELS[id as keyof typeof RESEARCH_MODELS]?.[0]??id;
const number=(n:number|null)=>n===null?'—':n.toFixed(2);
type Ledger={records:(LedgerRecord & {interval?:Calibration|null})[];scorecard:ReturnType<typeof forwardScorecard>;since:string;total:number;truncated:boolean};

export function RecordingNotice({tracking}:{tracking?:RecordingStatus}){
 const identity=tracking?.ids.join(',');
 useEffect(()=>{if(tracking?.state==='saved')window.dispatchEvent(new Event('forecast-recorded'));},[identity,tracking?.state]);
 if(!tracking||tracking.state==='not_applicable')return null;
 return <p role="status" className={`mt-3 text-xs leading-6 ${tracking.state==='saved'?'text-muted-foreground':'text-amber-300'}`}>{tracking.state==='saved'?<>Saved to your <a href="#forward-records" className="text-primary underline">forward records</a>. The first entry for this model and session is preserved.</>:'This result could not be saved for forward validation. Run again to retry recording; the experiment above remains available.'}</p>;
}

export function ForwardLedger({ticker}:{ticker:string}){
 const [data,setData]=useState<Ledger|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(false),[all,setAll]=useState(false),[refresh,setRefresh]=useState(0);
 const reload=useCallback(()=>setRefresh(n=>n+1),[]);
 useEffect(()=>{window.addEventListener('forecast-recorded',reload);return()=>window.removeEventListener('forecast-recorded',reload);},[reload]);
 useEffect(()=>{
   const controller=new AbortController();setLoading(true);setError('');setData(null);
   fetch(`/api/forecasts/records${all?'':`?ticker=${encodeURIComponent(ticker)}`}`,{cache:'no-store',signal:controller.signal})
    .then(async r=>{const b=await r.json();if(!r.ok||!b.success)throw Error(b.error?.message??'Records unavailable');return b.data as Ledger;})
    .then(d=>{if(!controller.signal.aborted)setData(d);}).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Records unavailable');})
    .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
   return()=>controller.abort();
 },[all,ticker,refresh]);
 return <section id="forward-records" aria-label="Forward validation records" className="scroll-mt-24 border-t border-border p-5 sm:p-7">
   <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="app-eyebrow">Evidence over time</p><h3 className="mt-2 text-xl font-semibold">Forward performance</h3></div><button className="app-button-secondary" onClick={reload} disabled={loading}>{loading?'Loading records…':'Refresh records'}</button></div>
   <p className="mt-3 text-sm leading-7 text-muted-foreground">Your saved predictions, checked after five trading sessions. Only entries saved before the next session opens count toward the scorecard. Repeated runs preserve the first record.</p>
   <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={all} onChange={e=>{setData(null);setAll(e.target.checked);}}/>Show all my stocks</label>
   <p className="mt-3 text-xs leading-6 text-muted-foreground">Last 90 days · {all?'All stocks':ticker} · Automatic hourly checks begin 20 minutes after the target session closes. Missing evidence stays pending for retry. Records begin when you run experiments; historical backtests are not counted.</p>
   {error&&<p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
   {data&&<>
     {data.truncated&&<p className="mt-4 text-amber-300 text-sm">Showing the latest 500 of {data.total} entries. Scores and export cover only these displayed entries.</p>}
     {!data.records.length?<p className="mt-6 rounded-xl border border-border p-5 text-sm">No saved entries in this view. Run a prediction experiment above to start collecting forward evidence.</p>:<>
       {data.scorecard.every(s=>s.settled===0)&&<p className="mt-5 text-sm text-cyan-300">No completed forward predictions yet. Actual results will appear after their target sessions close and evidence is available.</p>}
       <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><caption className="mb-3 text-left text-xs text-muted-foreground">Observed return errors in percentage points; baselines use the same completed predictions.</caption><thead><tr className="text-xs text-muted-foreground"><th className="py-3">Model / version</th><th>Completed</th><th>Pending</th><th>Withheld</th><th>MAE</th><th>Flat MAE</th><th>Drift MAE</th><th>Direction</th></tr></thead><tbody>{data.scorecard.map(s=><tr className="border-t border-border tabular-nums" key={s.model+s.version}><td className="py-4 pr-4">{label(s.model)}<span className="block text-[10px] text-muted-foreground">{s.version}</span></td><td>{s.settled}</td><td>{s.pending}</td><td>{s.withheld}</td><td>{number(s.mae)}</td><td>{number(s.flat_mae)}</td><td>{number(s.drift_mae)}</td><td>{s.direction_hit_pct===null?'—':`${s.direction_hit_pct.toFixed(0)}% / ${s.direction_samples}`}</td></tr>)}</tbody></table></div>
       <p className="mt-3 text-xs leading-6 text-muted-foreground">Small samples and overlapping five-session windows do not establish reliable accuracy. Withheld models publish no target and are excluded from error metrics. Late entries are excluded from all forward scores. Adjusted returns can be affected by later provider revisions.</p>
       <ModelComparison records={data.records}/><IntervalSummary records={data.records}/><details className="mt-5" open><summary className="cursor-pointer text-sm font-medium">Recent records ({data.records.length})</summary><ul className="mt-4 space-y-3">{data.records.slice(0,20).map(r=>{
         const actual=r.checks?.state==='settled'?r.checks.outcome?.actual_return_pct??null:null;
         const status=!r.prospective?'Late · excluded':!r.qualified?'Withheld · no target':r.checks?.state==='settled'?'Completed':'Pending';
         return <li key={r.id} className="rounded-xl border border-border p-4 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{r.ticker} · {label(r.model_id)}</strong><span className="text-primary">{status}</span></div><p className="mt-2 text-xs text-muted-foreground">Origin {r.as_of} → Target {r.target_date} · Saved {new Date(r.recorded_at).toLocaleString()}</p><p className="mt-2 tabular-nums">Predicted {r.predicted_return_pct===null?'—':`${number(r.predicted_return_pct)}%`} · Actual {actual===null?'—':`${number(actual)}%`}{actual!==null&&r.predicted_return_pct!==null?` · Error ${number(Math.abs(r.predicted_return_pct-actual))} pp`:''}</p>{r.interval&&<p className="mt-2 text-xs text-muted-foreground">{r.interval.state==='ready'?`80% nominal band: ${number(r.interval.lower_return_pct)}% to ${number(r.interval.upper_return_pct)}%`:`Interval ${r.interval.state} · ${r.interval.samples}/30 prior independent windows`}</p>}{r.checks?.reason&&<p className="mt-2 text-xs text-amber-300">{r.checks.reason}</p>}<p className="mt-2 break-all text-[10px] text-muted-foreground">{r.model_version} · Evidence {r.data_hash}</p></li>;
       })}</ul>{data.records.length>20&&<p className="mt-3 text-xs text-muted-foreground">Latest 20 shown. Export includes all {data.records.length} entries in this view.</p>}</details>
       <a className="app-button-secondary mt-5 inline-flex text-sm" download={`forward-records-${all?'all':ticker}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(data,null,2))}`}>Export forward records</a>
     </>}
   </>}
 </section>;
}
