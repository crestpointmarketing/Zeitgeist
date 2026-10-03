"use client";
import Link from 'next/link';
import { useState } from 'react';
import { ChevronDown, LoaderCircle, RotateCcw, ShieldAlert } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { StockAnalysis } from '@/types/stock';
import type { MarketResult } from '@/lib/stock-flow';
import { StockHeader } from './stock-header';
import { AiBrief } from './ai-brief';
import AnalysisDisplay from './analysis-display';
import { StockEvidence } from './stock-evidence';
import { StockFinancials } from './stock-financials';
import { StockNews } from './stock-news';
import { ForecastLab } from './forecast-lab';
import { cn } from '@/lib/utils';
const StockChart=dynamic(()=>import('./stock-chart'),{ssr:false,loading:()=> <p role="status" className="flex h-80 items-center justify-center text-sm text-muted-foreground">Preparing daily prices…</p>});
interface Props {market:MarketResult|null;analysis:StockAnalysis|null;fetchingStock:boolean;fetchingAnalysis:boolean;error:string|null;analysisError:string|null;ticker:string;cached:boolean;needsLogin:boolean;onSearch:(ticker:string)=>void;onRetry:()=>void;onReset:()=>void}
const tabs=[['overview','Overview'],['financials','Financials'],['news','News & Sources'],['more','More']] as const;
export function ResearchDashboard({market,analysis,fetchingStock,fetchingAnalysis,error,analysisError,ticker,cached,needsLogin,onSearch,onRetry,onReset}:Props) {
  const [section,setSection]=useState('overview');
  const [detail,setDetail]=useState<'lab'|'report'>('lab');
  const [sessions,setSessions]=useState(0);
  if(fetchingStock||!market) return <section className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center text-center">{fetchingStock?<><LoaderCircle className="animate-spin text-blue-300" size={25}/><h1 className="mt-4 text-xl font-semibold">Loading {ticker}</h1><p role="status" className="mt-3 text-sm text-muted-foreground">Retrieving daily prices and source data…</p></>:<><ShieldAlert className="text-rose-300" size={25}/><h1 className="mt-4 text-xl font-semibold">We couldn’t load {ticker}</h1><p role="alert" className="mt-3 text-sm text-muted-foreground">{error||'Market data is unavailable.'}</p>{needsLogin?<Link className="app-button mt-6" href={`/login?next=${encodeURIComponent(`/stock-analysis?ticker=${ticker}`)}`}>Sign in to continue</Link>:<button className="app-button mt-6" onClick={()=>onSearch(ticker)}>Try again</button>}<button onClick={onReset} className="mt-3 min-h-11 text-sm text-muted-foreground">New search</button></>}</section>;
  const history=sessions?market.price_history.slice(-sessions):market.price_history;
  const returnPercent=history.length>1?(history.at(-1)!.close/history[0].close-1)*100:null;
  const number=(value:number|null|undefined)=>value==null?'Unavailable':value.toLocaleString('en-US',{maximumFractionDigits:2});
  return <div className="space-y-5">
    <StockHeader market={market}/>
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <div id="research-content" className="min-w-0 scroll-mt-36">
        <div role="tablist" aria-label="Research sections" className="research-tabs flex gap-4 overflow-x-auto border-b border-border sm:gap-6" onKeyDown={event=>{const keys=['ArrowRight','ArrowLeft','Home','End'];if(!keys.includes(event.key))return;const buttons=Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=tab]'));const index=buttons.indexOf(document.activeElement as HTMLButtonElement);const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;event.preventDefault();buttons[next]?.focus();buttons[next]?.click();}}>{tabs.map(([key,title])=><button key={key} id={`tab-${key}`} role="tab" aria-selected={section===key} aria-controls={`panel-${key}`} tabIndex={section===key?0:-1} onClick={()=>setSection(key)} className={cn('relative flex min-h-12 shrink-0 items-center gap-1 text-xs font-medium sm:text-sm',section===key?'text-white after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-blue-500':'text-muted-foreground hover:text-white')}>{title}{key==='more'&&<ChevronDown size={13}/>}</button>)}</div>
        <section id={`panel-${section}`} role="tabpanel" aria-labelledby={`tab-${section}`} className="mt-4 min-w-0 rounded-xl border border-border bg-[#0d2032]">
          {section==='overview'&&<>
            <StockChart toolbar={<div className="flex gap-1" aria-label="Price history range">{[[5,'5 sessions'],[10,'10 sessions'],[0,'All available']].map(([n,name])=><button key={n} onClick={()=>setSessions(Number(n))} disabled={Number(n)>market.price_history.length} aria-pressed={sessions===n} className={cn('min-h-10 rounded-lg px-3 text-xs',sessions===n?'bg-blue-600 text-white':'text-muted-foreground hover:bg-blue-400/10 disabled:opacity-40')}>{name}</button>)}</div>} data={history} ticker={ticker} height={360} compact showControls={false} className="research-chart !rounded-none !border-0 !bg-none !shadow-none"/>
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-5"><p className="text-xs tabular-nums text-muted-foreground">{returnPercent==null?'Return unavailable':`${returnPercent>=0?'+':''}${returnPercent.toFixed(2)}% over shown history`}</p></div>
            <p className="border-t border-border px-5 py-3 text-[11px] leading-5 text-muted-foreground">{market.evidence.source} · Daily close · {history[0]?.date??'No history'} – {history.at(-1)?.date??'Unavailable'}</p>
            <section className="border-t border-border p-5"><h2 className="text-sm font-semibold">Key factors</h2><dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">{[['5-session average',number(market.evidence.sma5)],['20-session average',number(market.evidence.sma20)],['Market cap',market.stock_data.market_cap?new Intl.NumberFormat('en-US',{style:'currency',currency:market.stock_data.currency||'USD',notation:'compact'}).format(market.stock_data.market_cap):'Unavailable']].map(([label,value])=><div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 text-sm font-semibold tabular-nums">{value}</dd></div>)}</dl>
              <p className="mt-5 text-sm leading-7 text-muted-foreground">{analysis?analysis.technical_analysis.short_term_outlook:fetchingAnalysis?'AI interpretation is in progress. The metrics above are calculated from the supplied data.':analysisError?'AI interpretation is unavailable. The metrics above remain available.':'The supplied daily closes provide descriptive indicators; they do not establish the cause of a price move.'}</p>
              <p className="mt-2 text-[11px] text-muted-foreground">Averages use the full supplied history. AI outlooks are interpretations, not guarantees.</p>
            </section>
          </>}
          {section==='financials'&&<StockFinancials financials={market.financials} company={market.company_details} analysis={analysis}/>}
          {section==='news'&&<><StockNews news={market.news} analysis={analysis} sessionTimestamp={market.stock_data.timestamp}/><div className="border-t border-border p-5"><StockEvidence evidence={market.evidence}/></div></>}
          {section==='more'&&<><div className="flex flex-wrap gap-2 border-b border-border p-4">{[['lab','Model lab'],['report','Full AI analysis']].map(([key,label])=><button key={key} onClick={()=>setDetail(key as 'lab'|'report')} aria-pressed={detail===key} className={cn('min-h-11 rounded-lg px-4 text-sm',detail===key?'bg-blue-500/15 text-blue-200':'text-muted-foreground')}>{label}</button>)}</div>{detail==='lab'?<ForecastLab key={market.snapshot_id} ticker={ticker}/>:analysis?<AnalysisDisplay analysis={analysis} className="!border-0 !bg-none !shadow-none"/>:<p role="status" className="p-6 text-sm text-muted-foreground">{fetchingAnalysis?'Full analysis is being prepared.':analysisError||'No AI analysis is available for this snapshot.'}</p>}</>}
        </section>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{cached?'Saved AI analysis reused.':'Daily prices · Not a live quote'}</span><div className="flex gap-4"><button className="flex min-h-11 items-center gap-2 hover:text-white" onClick={()=>onSearch(ticker)}><RotateCcw size={13}/>Refresh prices</button><button className="min-h-11 hover:text-white" onClick={onReset}>New search</button></div></div>
      </div>
      <AiBrief market={market} analysis={analysis} loading={fetchingAnalysis} error={analysisError} cached={cached} onRetry={onRetry} onSources={()=>{setSection('news');if(window.innerWidth<1280)document.getElementById('research-content')?.scrollIntoView({block:'start'});}}/>
    </div>
  </div>;
}
