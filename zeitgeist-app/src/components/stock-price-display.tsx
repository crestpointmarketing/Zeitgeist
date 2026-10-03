"use client";
import { ArrowDownRight, ArrowUpRight, Clock3 } from 'lucide-react';
import { WatchlistButton } from './watchlist';
import { cn } from '@/lib/utils';
import { sessionDate } from '@/lib/quote';
import type { StockData } from '@/types/stock';
interface Props { stockData: StockData; className?: string; variant?: 'default' | 'compact' | 'detailed'; showLastUpdate?: boolean; showMarketStatus?: boolean }
export function StockPriceDisplay({ stockData: s, className, variant = 'default', showLastUpdate = true, showMarketStatus = true }: Props) {
  const money = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: s.currency || 'USD' }).format(n);
  const positive = s.change >= 0;
  const ChangeIcon = positive ? ArrowUpRight : ArrowDownRight;
  const status = { open: 'Market open', closed: 'Market closed', 'extended-hours': 'Extended hours', unknown: 'Market status unavailable' }[s.market_status];
  return <section aria-label={`${s.ticker} price summary`} className={cn('app-panel overflow-hidden', className)}>
    <div className="flex flex-col justify-between gap-6 p-5 sm:flex-row sm:p-7">
      <div><div className="mb-3 flex flex-wrap items-center gap-3"><span className="rounded-lg border border-border bg-background px-3 py-1.5 font-mono text-sm font-semibold">{s.ticker}</span><span className="text-xs text-muted-foreground">{s.primary_exchange} · {s.currency || 'USD'}</span></div><h2 className="text-xl font-semibold tracking-tight">{s.name}</h2>{showLastUpdate && <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 size={14} />Session close: {sessionDate(s.timestamp)} (ET)</p>}<WatchlistButton key={s.ticker} ticker={s.ticker}/></div>
      <div className="sm:text-right"><p className="text-xs text-muted-foreground">Completed-session close</p><p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{money(s.price)}</p><p className={cn('mt-3 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium tabular-nums', positive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300')}><ChangeIcon size={17} />{positive ? '+' : '−'}{money(Math.abs(s.change))} ({positive ? '+' : '−'}{Math.abs(s.change_percent).toFixed(2)}%)</p><p className="mt-2 text-xs text-muted-foreground">vs. previous session close</p></div>
    </div>
    {variant === 'detailed' && <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4">{[['Open',money(s.open)],['Daily range',`${money(s.low)} – ${money(s.high)}`],['Previous close',money(s.previous_close)],['Volume',new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:1}).format(s.volume)]].map(([label,value])=><div key={label} className="bg-card p-4 sm:px-7"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-2 text-sm font-medium tabular-nums">{value}</dd></div>)}</dl>}
    {showMarketStatus && <div className="flex flex-wrap justify-between gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground sm:px-7"><span>{status}</span><span>Daily data · Not a live quote</span></div>}
  </section>;
}
export default StockPriceDisplay;
