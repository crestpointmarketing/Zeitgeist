"use client";
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Star, Trash2, ArrowUpRight } from 'lucide-react';
import { WATCHLIST_LIMIT } from '@/lib/watchlist';

export function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [daily,setDaily]=useState<string[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const response=await fetch('/api/watchlist',{cache:'no-store'}),body=await response.json();
      if(response.status===401){setSignedIn(false);setSymbols([]);setDaily([]);return;}
      if(!response.ok)throw Error(body.error?.message);
      setSignedIn(true);setSymbols(body.data.map((r:{ticker:string})=>r.ticker));setDaily(body.data.filter((r:{daily_enabled:boolean})=>r.daily_enabled).map((r:{ticker:string})=>r.ticker));
    } catch { setError('Could not load your watchlist. Please try again.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const toggle = async (ticker: string, dailyEnabled?:boolean) => {
    if (pending.current || !/^[A-Z]{1,5}$/.test(ticker)) return;
    pending.current = true; setSaving(true); setError(null);
    try {
      const response=await fetch('/api/watchlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ticker,action:dailyEnabled===undefined?(symbols.includes(ticker)?'remove':'add'):'daily',daily:dailyEnabled})}),body=await response.json();
      if(!response.ok)throw Error(body.error?.message??'Could not save watchlist.');
      setSymbols(body.data.map((r:{ticker:string})=>r.ticker));setDaily(body.data.filter((r:{daily_enabled:boolean})=>r.daily_enabled).map((r:{ticker:string})=>r.ticker));
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save your watchlist.'); }
    finally { pending.current = false; setSaving(false); }
  };
  return { symbols,daily, signedIn, loading, saving, error, toggle, reload: load };
}

export function WatchlistButton({ ticker, compact = false }: { ticker: string; compact?: boolean }) {
  const state = useWatchlist();
  if (state.loading) return <span className="text-xs text-muted-foreground">Loading watchlist…</span>;
  return <div className={compact ? "" : "mt-4"}>{!state.signedIn && !state.error ? <Link className="app-button-secondary" href={`/login?next=${encodeURIComponent(`/stock-analysis?ticker=${ticker}`)}`}>Sign in to save</Link> : <button className="app-button-secondary" disabled={state.saving || Boolean(state.error)} aria-pressed={state.symbols.includes(ticker)} onClick={() => void state.toggle(ticker)}><Star size={16} fill={state.symbols.includes(ticker) ? 'currentColor' : 'none'}/>{state.saving ? 'Saving…' : state.symbols.includes(ticker) ? 'Saved to watchlist' : 'Add to watchlist'}</button>}{state.error && <p role="alert" className="mt-2 text-xs text-destructive">{state.error} <button className="underline" onClick={() => void state.reload()}>Retry</button></p>}</div>;
}

export function WatchlistPanel() {
  const state = useWatchlist();
  return <section className="app-panel p-6 sm:p-8"><div className="flex items-center gap-3"><Star className="text-primary"/><h1 className="text-2xl font-semibold">Your watchlist</h1></div><p className="mt-3 text-sm text-muted-foreground">Keep up to {WATCHLIST_LIMIT} stocks. Enable daily research for up to five: after completed-session data is available, a brief will appear in Research tasks. Each brief uses your market-data and AI budgets. Turning it off cancels queued daily work; an already running step may finish.</p><Link href="/research" className="app-button-secondary mt-4">Open research tasks</Link>{state.loading ? <p role="status" className="mt-8">Loading your watchlist…</p> : state.error ? <p role="alert" className="mt-8 text-destructive">{state.error} <button className="underline" onClick={() => void state.reload()}>Try again</button></p> : !state.signedIn ? <Link href="/login?next=%2Fwatchlist" className="app-button mt-8">Sign in to save stocks</Link> : state.symbols.length === 0 ? <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center"><p className="text-muted-foreground">No saved stocks yet.</p><Link href="/stock-analysis" className="app-button mt-5">Find a stock</Link></div> : <ul className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{state.symbols.map(ticker => <li key={ticker} className="flex flex-wrap items-center rounded-xl border border-border bg-primary/5 p-4"><Link className="flex min-h-11 flex-1 items-center justify-between gap-4 font-semibold" href={`/stock-analysis?ticker=${ticker}`}>{ticker}<ArrowUpRight size={18} className="text-primary"/></Link><button disabled={state.saving} aria-label={`Remove ${ticker} from watchlist`} className="app-icon-button ml-4" onClick={() => void state.toggle(ticker)}><Trash2 size={17}/></button><label className="mt-3 flex w-full items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground"><input type="checkbox" disabled={state.saving} checked={state.daily.includes(ticker)} onChange={e=>void state.toggle(ticker,e.target.checked)}/>Daily research</label></li>)}</ul>}</section>;
}
