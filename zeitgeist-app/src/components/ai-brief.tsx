"use client";
import dynamic from 'next/dynamic';
import { Sparkles } from 'lucide-react';
import { AnalysisProgress } from './analysis-progress';
import AnalysisUnavailable from './analysis-unavailable';
import { briefSummary } from '@/lib/research-brief';
import { safeNewsUrl } from '@/lib/news-url';
import type { StockAnalysis } from '@/types/stock';
import type { MarketResult } from '@/lib/stock-flow';
const StockFollowup=dynamic(()=>import('./stock-followup'),{ssr:false,loading:()=> <p className="mt-5 text-xs text-muted-foreground">Preparing questions…</p>});
export function AiBrief({market,analysis,loading,error,cached,onRetry,onSources}:{market:MarketResult;analysis:StockAnalysis|null;loading:boolean;error:string|null;cached:boolean;onRetry:()=>void;onSources:()=>void}) {
  const insufficient=market.evidence.bars<2;
  const news=analysis?.news_analysis?.[0];
  return <aside className="research-brief min-w-0 rounded-xl border border-border p-5 xl:sticky xl:top-24" aria-label="AI Brief">
    <header className="flex flex-wrap items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-base font-semibold"><Sparkles size={20} className="text-cyan-300"/>AI Brief</h2><span role="status" className="text-[11px] text-muted-foreground">{loading?'Analyzing':error?'Unavailable':insufficient?'Limited data':analysis?(cached?'Saved analysis':'Updated'):'Not available'}</span></header>
    {loading?<AnalysisProgress/>:error?<div className="mt-4"><AnalysisUnavailable error={error} ticker={market.stock_data.ticker} onRetry={onRetry}/></div>:analysis?<>
      {insufficient&&<p className="mt-4 text-sm leading-6 text-amber-200">Too few daily closes to assess a trend. The available data does not establish what drove the move.</p>}
      <p className="mt-5 text-sm leading-7">{briefSummary(analysis.summary)}</p>
      <section className="mt-5 border-t border-border pt-4"><h3 className="text-xs font-semibold">What’s driving it</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{news?.summary || analysis.technical_analysis.key_indicators}</p>{news?<div className="mt-2 flex flex-wrap gap-3">{news.source_ids.map(id=>{const article=market.news?.articles.find(a=>a.id===id);const url=article&&safeNewsUrl(article.url);return url?<a key={id} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-200 underline">{article!.publisher} [{id}]</a>:null;})}</div>:<p className="mt-2 text-[11px] leading-5 text-muted-foreground">Based on {market.evidence.bars} daily closes from {market.evidence.source}. Technical interpretation does not establish causation.</p>}</section>
      <section className="mt-5 border-t border-border pt-4"><h3 className="text-xs font-semibold">Key risk</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{analysis.risk_factors[0]||'No risk assessment was supplied.'}</p></section>
      <p className="mt-5 text-[11px] leading-5 text-muted-foreground"><button className="text-blue-200 underline" onClick={onSources}>Sources</button> · Analysis updated <time dateTime={analysis.analysis_timestamp}>{new Date(analysis.analysis_timestamp).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} ET</time></p>
    </>:<p className="mt-5 text-sm text-muted-foreground">An AI brief is not available for this snapshot.<button className="mt-2 block min-h-10 text-blue-200 underline" onClick={onRetry}>Request analysis</button></p>}
    <StockFollowup key={market.snapshot_id} market={market} analysis={analysis}/>
  </aside>;
}
