"use client";
import { Brain, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StockAnalysis } from '@/types/stock';
interface Props { analysis: StockAnalysis; className?: string; showRawAnalysis?: boolean }
const money = (n: number | null) => n === null ? 'Unavailable' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const label = (s: string) => s.toLowerCase().replaceAll('_',' ').replace(/^./, c => c.toUpperCase());
function Points({ items, empty }: { items: string[]; empty: string }) {
  return items.length ? <ul className="space-y-2 pl-4 text-sm leading-relaxed text-muted-foreground list-disc">{items.map((item,i)=><li key={i}>{item}</li>)}</ul> : <p className="app-copy">{empty}</p>;
}
export function AnalysisDisplay({ analysis: a, className, showRawAnalysis = false }: Props) {
  const tone = a.recommendation.includes('BUY') ? 'text-emerald-300 bg-emerald-400/10' : a.recommendation.includes('SELL') ? 'text-rose-300 bg-rose-400/10' : 'text-amber-200 bg-amber-400/10';
  return <section className={cn('app-panel p-5 sm:p-7',className)} aria-label="AI analysis">
    <header className="mb-6 flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Brain size={21} /></span><div><p className="app-eyebrow">Interpretation</p><h2 className="mt-1 text-lg font-semibold">The AI perspective</h2></div></header>
    <p className="whitespace-pre-line text-base leading-relaxed text-foreground">{a.summary}</p>
    <div className="my-6 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl bg-background p-4"><p className="text-xs text-muted-foreground">Model recommendation</p><span className={cn('mt-3 inline-block rounded-lg px-3 py-1.5 text-sm font-medium',tone)}>{label(a.recommendation)}</span></div>
      <div className="rounded-xl bg-background p-4"><p className="text-xs text-muted-foreground">Risk assessment</p><p className="mt-3 text-lg font-medium">{label(a.risk_level)} risk</p></div>
      <div className="rounded-xl bg-background p-4"><p className="text-xs text-muted-foreground">Model confidence</p><p className="mt-2 text-lg font-medium tabular-nums">{a.confidence_score}%</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Self-assessment, not prediction accuracy.</p></div>
    </div>
    <div className="space-y-3">
      <details className="app-details" open><summary>Technical outlook · {label(a.technical_analysis.trend)}</summary><div className="space-y-5 p-5"><p className="app-copy">{a.technical_analysis.key_indicators}</p><div className="grid gap-5 sm:grid-cols-2">{[['Support levels',a.technical_analysis.support_levels],['Resistance levels',a.technical_analysis.resistance_levels]].map(([title,values])=><div key={String(title)}><h3 className="mb-2 text-xs font-medium text-muted-foreground">{String(title)}</h3><p className="text-sm tabular-nums">{(values as number[]).length ? (values as number[]).map(money).join(' · ') : 'Unavailable'}</p></div>)}</div><p className="app-copy">{a.technical_analysis.short_term_outlook}</p></div></details>
      <details className="app-details" open><summary>Risks & considerations</summary><div className="p-5"><Points items={a.risk_factors} empty="No additional risk factors supplied." /></div></details>
      <details className="app-details"><summary>Price scenarios</summary><div className="p-5"><p className="mb-4 text-xs leading-relaxed text-muted-foreground">Model projections are uncertain. Unavailable means there is insufficient evidence for a target.</p><dl className="grid gap-3 sm:grid-cols-3">{[['1–3 months',a.price_targets.short_term],['3–12 months',a.price_targets.medium_term],['1+ years',a.price_targets.long_term]].map(([title,value])=><div key={String(title)} className="rounded-xl bg-background p-4"><dt className="text-xs text-muted-foreground">{title}</dt><dd className="mt-2 text-xl font-medium tabular-nums">{money(value as number|null)}</dd></div>)}</dl></div></details>
      <details className="app-details"><summary>Fundamentals & source limitations</summary><div className="space-y-4 p-5"><p className="app-copy">{a.fundamental_analysis.financial_health}</p><p className="app-copy">{a.fundamental_analysis.growth_prospects}</p><p className="app-copy">{a.fundamental_analysis.competitive_position}</p><p className="app-copy">{a.sentiment_analysis.news_sentiment}</p>{a.key_metrics?.market_cap && <p className="text-sm">Company market cap: {money(a.key_metrics.market_cap)}</p>}</div></details>
      <details className="app-details"><summary>Potential catalysts & concerns</summary><div className="grid gap-5 p-5 sm:grid-cols-2"><div><h3 className="mb-3 text-sm font-medium">Catalysts</h3><Points items={a.catalysts} empty="No verified catalysts supplied." /></div><div><h3 className="mb-3 text-sm font-medium">Concerns</h3><Points items={a.concerns} empty="No additional concerns supplied." /></div></div></details>
      <details className="app-details" open={showRawAnalysis}><summary>Full model response</summary><p className="app-copy p-5">{a.raw_analysis}</p></details>
    </div>
    <footer className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><p>Generated for {a.company_name} ({a.ticker}). This interpretation may be incomplete. Review the source data and consider your own circumstances.</p></footer>
  </section>;
}
export default AnalysisDisplay;
