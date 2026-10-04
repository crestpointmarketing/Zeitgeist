"use client";
import { useEffect, useRef, useState } from 'react';
import { RESEARCH_MODELS, type ResearchModel } from '@/lib/research-catalog';
import type { ResearchReport } from '@/lib/research-schema';
import { requestResearch } from '@/lib/research-request';

function ResearchResults({report:r}:{report:ResearchReport}){
  const [point,setPoint]=useState(29);
  const p=r.prediction, s=r.strategy, risk=r.risk;
  return <div className="mt-6 space-y-5" aria-label="Selected research result">
    <h4 className="text-lg font-semibold">{RESEARCH_MODELS[r.model][0]} · {r.ticker}</h4>
    <p className="text-xs leading-6 text-muted-foreground">{r.source} · {r.history_bars} sessions · Data through {r.as_of}<br/>Generated <time dateTime={r.generated_at}>{new Date(r.generated_at).toLocaleString()}</time></p>
    {p&&<>
      <p className={`rounded-xl border border-border p-4 text-sm leading-6 ${p.qualified?'text-cyan-300':'text-amber-300'}`}>{p.forecast?`Experimental five-session target: $${p.forecast.price.toFixed(2)} (${p.forecast.return_pct.toFixed(2)}%) · ${p.forecast.date}. A historical gate pass does not establish future accuracy.`:'No target published: this model did not reduce historical error by more than 5% against both baselines.'}</p>
      <dl className="grid grid-cols-3 gap-3 text-sm">{[['Model MAE',p.model.mae_pp],['Flat MAE',p.flat.mae_pp],['Drift MAE',p.drift.mae_pp]].map(([label,value])=><div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 tabular-nums">{Number(value).toFixed(3)} pp</dd></div>)}</dl>
      <ResearchChart actual={p.windows.map(w=>w.actual_return_pct)} predicted={p.windows.map(w=>w.predicted_return_pct)} point={point}/>
      <label className="block text-sm">Test window {point+1} of 30<input className="mt-3 block w-full accent-cyan-400" type="range" min={0} max={29} value={point} aria-label="Research test window" aria-valuetext={`${p.windows[point].origin} to ${p.windows[point].target}`} onChange={e=>setPoint(Number(e.target.value))}/></label>
      <div aria-live="polite" className="rounded-lg border border-border p-4 text-sm"><p>{p.windows[point].origin} → {p.windows[point].target}</p><p className="mt-2 tabular-nums">Predicted {p.windows[point].predicted_return_pct.toFixed(2)}% · Actual {p.windows[point].actual_return_pct.toFixed(2)}% · Error {Math.abs(p.windows[point].predicted_return_pct-p.windows[point].actual_return_pct).toFixed(2)} pp</p><p className="mt-2 text-xs text-muted-foreground">Training data available through {p.windows[point].training_labels_through}</p></div>
      <p className="text-xs leading-6 text-muted-foreground">30 chronological five-session tests. Fixed settings; no best-model selection or parameter search on these tests. More comparisons increase selection risk. Neural networks use 12 training epochs and at most 252 mature rows per fit; this is a bounded experiment, not exhaustive training.</p>
    </>}
    {s&&<>
      <p className="text-sm leading-6 text-amber-200">Historical paper simulation only. Signals execute at the next open; ten basis points per side, including final liquidation. No broker connection or real trades.</p>
      <dl className="grid grid-cols-2 gap-4 text-sm">{[['Strategy net return',`${s.return_pct.toFixed(2)}%`],['Buy-and-hold net return',`${s.benchmark_return_pct.toFixed(2)}%`],['Strategy max drawdown',`${s.max_drawdown_pct.toFixed(2)}%`],['Buy-and-hold max drawdown',`${s.benchmark_drawdown_pct.toFixed(2)}%`]].map(([label,value])=><div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 tabular-nums">{value}</dd></div>)}</dl>
      <ResearchChart actual={s.observations.map(o=>(o.benchmark_equity-1)*100)} predicted={s.observations.map(o=>(o.equity-1)*100)} labels={['Buy and hold','Paper strategy']}/>
      <p className="text-xs leading-6 text-muted-foreground">Policy training ends {s.training_through}. Frozen policy; no test-period learning. 150 open-to-open intervals through the open of {r.as_of}; fractional long/cash positions, no leverage. Adjusted historical bars do not model actual execution, taxes, market impact or dividends separately. Turnover: {s.turnover.toFixed(0)} full-position sides.</p>
    </>}
    {risk&&<>
      <p className="text-sm leading-6 text-muted-foreground">Dynamic volatility scenarios and unusual-return diagnostics. These do not predict direction or imply buy/sell signals.</p>
      <dl className="grid grid-cols-2 gap-4 text-sm"><div><dt>EWMA daily volatility</dt><dd className="mt-2 tabular-nums">{risk.ewma_daily_volatility_pct.toFixed(2)}%</dd></div><div><dt>14-session RSI (simple averages)</dt><dd className="mt-2 tabular-nums">{risk.rsi14.toFixed(1)}</dd></div></dl>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-2 text-left text-xs text-muted-foreground">2,000 conditional-volatility paths; percentiles are uncalibrated scenarios.</caption><thead><tr><th>Date</th><th>10th</th><th>Median</th><th>90th</th></tr></thead><tbody>{risk.scenarios.map(o=><tr className="border-t border-border" key={o.date}><td className="py-2">{o.date}</td><td>${o.p10.toFixed(2)}</td><td>${o.p50.toFixed(2)}</td><td>${o.p90.toFixed(2)}</td></tr>)}</tbody></table></div>
      <p className="text-sm">{risk.observations.filter(o=>o.svm_outlier).length} of the last 20 sessions flagged by a one-class SVM. Each detector uses only prior returns.</p>
      <details><summary className="cursor-pointer text-primary">Inspect outlier diagnostics</summary><ul className="mt-3 space-y-2 text-xs">{risk.observations.map(o=><li key={o.date}>{o.date} · {o.return_pct.toFixed(2)}% · z {o.z_score.toFixed(2)} · {o.svm_outlier?'Flagged':'Within fitted region'}</li>)}</ul></details>
    </>}
    <a className="app-button-secondary inline-flex text-sm" download={`${r.ticker}-${r.model}-${r.as_of}.json`} href={`data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(r,null,2))}`}>Download research report</a>
    <p className="text-xs text-muted-foreground">Research protocol {r.version} · Data fingerprint {r.data_hash}. Adapted from the Stock-Prediction-Models fork; contemporary rewrites, not its historical accuracy claims.</p>
  </div>;
}

function ResearchChart({actual,predicted,point,labels=['Actual','Predicted']}:{actual:number[];predicted:number[];point?:number;labels?:string[]}){
  const low=Math.min(0,...actual,...predicted),high=Math.max(0,...actual,...predicted),span=Math.max(.1,high-low);
  const x=(i:number)=>50+i/(actual.length-1)*530,y=(v:number)=>175-(v-low)/span*145;
  const line=(v:number[])=>v.map((n,i)=>`${x(i)},${y(n)}`).join(' ');
  return <div><p className="text-xs"><span className="text-blue-300">━ {labels[0]}</span><span className="ml-4 text-cyan-300">┄ {labels[1]}</span></p><svg viewBox="0 0 620 210" className="w-full" role="img" aria-label={`${labels[1]} versus ${labels[0]}; values in the downloadable report`}><text x="0" y="25" fill="#a9c0dc" fontSize="11">{high.toFixed(1)}%</text><text x="0" y="180" fill="#a9c0dc" fontSize="11">{low.toFixed(1)}%</text><line x1="50" x2="580" y1={y(0)} y2={y(0)} stroke="#28455f" strokeDasharray="3 5"/><polyline points={line(actual)} fill="none" stroke="#93c5fd" strokeWidth="2"/><polyline points={line(predicted)} fill="none" stroke="#22d3ee" strokeWidth="2" strokeDasharray="5 4"/>{point!==undefined&&<><line x1={x(point)} x2={x(point)} y1="25" y2="180" stroke="#a9c0dc" strokeDasharray="2 4"/><circle cx={x(point)} cy={y(predicted[point])} r="4" fill="#22d3ee"/></>}</svg></div>;
}

export function ResearchLab({ticker}:{ticker:string}){return <ResearchSession key={ticker} ticker={ticker}/>;}
function ResearchSession({ticker}:{ticker:string}){
  const [model,setModel]=useState<ResearchModel>('lstm'),[report,setReport]=useState<ResearchReport|null>(null),[error,setError]=useState(''),[status,setStatus]=useState(''),[running,setRunning]=useState(false),[seconds,setSeconds]=useState(0);
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  useEffect(()=>{if(!running)return;const start=Date.now();const timer=setInterval(()=>setSeconds(Math.floor((Date.now()-start)/1000)),1000);return()=>clearInterval(timer);},[running]);
  function cancel(){controller.current?.abort();controller.current=null;setRunning(false);setStatus('Stopped waiting. Server work may continue and the request may still count toward your limit.');}
  async function run(){
    if(controller.current)return;
    const active=new AbortController();controller.current=active;setRunning(true);setSeconds(0);setError('');setStatus('');
    try{const value=await requestResearch(ticker,model,active.signal);if(controller.current===active&&!active.signal.aborted)setReport(value);}
    catch(e){if(!active.signal.aborted)setError(e instanceof Error?e.message:'Research unavailable.');}
    finally{if(controller.current===active){controller.current=null;setRunning(false);}}
  }
  const groups=[...new Set(Object.values(RESEARCH_MODELS).map(v=>v[1]))];
  return <section className="border-t border-border p-5 sm:p-7" aria-label="Extended model research"><p className="app-eyebrow">Experimental research</p><h3 className="mt-2 text-xl font-semibold">Sequence models & research tools</h3><p className="mt-3 text-sm leading-7 text-muted-foreground">Choose one module to test on {ticker}. Runs on demand, uses one market-data request and no paid AI call. Each model has a one-hour cache. Allow up to a minute; run one experiment at a time.</p>
    <div className="mt-5 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm">Research module<select className="app-field mt-2 w-full" aria-label="Research module" value={model} disabled={running} onChange={e=>{setModel(e.target.value as ResearchModel);setReport(null);setError('');setStatus('');}}>{groups.map(group=><optgroup label={group} key={group}>{(Object.entries(RESEARCH_MODELS) as [ResearchModel,readonly[string,string]][]).filter(([,v])=>v[1]===group).map(([id,v])=><option value={id} key={id}>{v[0]}</option>)}</optgroup>)}</select></label><button className="app-button" disabled={running} onClick={()=>void run()}>{running?'Running research…':error?'Retry research':'Run selected module'}</button></div>
    {running&&<div className="mt-4 flex flex-wrap items-center gap-3"><p role="status" className="text-sm text-primary">{seconds}s elapsed · Evaluating {RESEARCH_MODELS[model][0]}</p><button className="app-button-secondary" onClick={cancel}>Cancel research waiting</button></div>}
    {status&&<p role="status" className="mt-4 text-sm text-muted-foreground">{status}</p>}{error&&<p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    {report&&<>{(running||error||status)&&<p className="mt-4 text-xs text-muted-foreground">Previous completed result retained below.</p>}<ResearchResults key={report.generated_at+report.model} report={report}/></>}
  </section>;
}
