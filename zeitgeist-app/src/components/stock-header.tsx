"use client";
import { WatchlistButton } from './watchlist';
import { sessionDate } from '@/lib/quote';
import type { MarketResult } from '@/lib/stock-flow';

export function StockHeader({market}:{market:MarketResult}) {
  const s=market.stock_data;
  return <section aria-label={`${s.ticker} price summary`} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-b border-border pb-5">
    <div className="flex min-w-0 items-center gap-3"><span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-[#11253a] text-xl font-semibold text-blue-200">{s.name[0]}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-lg font-semibold sm:text-xl">{s.name}</h1><span className="rounded-md bg-blue-400/10 px-2 py-1 text-xs text-blue-200">{s.ticker}</span></div><p className="mt-1 text-xs text-muted-foreground">{[s.primary_exchange,market.company_details.sic_description].filter(Boolean).join(' · ') || 'Exchange details unavailable'}</p></div></div>
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3"><div><div className="flex items-baseline gap-3 tabular-nums"><p className="text-2xl font-semibold">{new Intl.NumberFormat('en-US',{style:'currency',currency:s.currency||'USD'}).format(s.price)}</p><p className={`text-sm font-medium ${s.change>=0?'text-emerald-300':'text-rose-300'}`}>{s.change>=0?'+':''}{s.change.toFixed(2)} ({s.change_percent>=0?'+':''}{s.change_percent.toFixed(2)}%)</p></div><p className="mt-1 text-xs text-muted-foreground">Daily close · {sessionDate(s.timestamp)} (ET)</p><p className="mt-1 text-[11px] text-muted-foreground">Retrieved {new Date(market.evidence.fetched_at).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})} ET</p></div><WatchlistButton ticker={s.ticker} compact/></div>
  </section>;
}
