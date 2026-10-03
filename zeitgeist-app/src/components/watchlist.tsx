"use client";
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Star, Trash2, ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { WATCHLIST_LIMIT, watchlistSymbols } from '@/lib/watchlist';

// A small, private account preference. Supabase merges this key with other metadata.
function useWatchlist() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const client = createClient();
      if (!client) throw new Error('Accounts are temporarily unavailable.');
      const { data, error } = await client.auth.getUser();
      if (error && error.name !== 'AuthSessionMissingError') throw error;
      setSignedIn(Boolean(data.user));
      setSymbols(watchlistSymbols(data.user?.user_metadata?.watchlist));
    } catch { setError('Could not load your watchlist. Please try again.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const toggle = async (ticker: string) => {
    if (pending.current || !/^[A-Z]{1,5}$/.test(ticker)) return;
    pending.current = true; setSaving(true); setError(null);
    try {
      const client = createClient();
      if (!client) throw new Error('Accounts are temporarily unavailable.');
      // Refresh before saving so navigating between pages uses the latest preference.
      const { data, error: readError } = await client.auth.getUser();
      if (readError || !data.user) throw new Error('Sign in to save your watchlist.');
      const previous = watchlistSymbols(data.user.user_metadata?.watchlist);
      if (!previous.includes(ticker) && previous.length >= WATCHLIST_LIMIT) throw new Error(`Your watchlist holds up to ${WATCHLIST_LIMIT} stocks. Remove one first.`);
      const next = previous.includes(ticker) ? previous.filter(s => s !== ticker) : [...previous, ticker];
      const { error } = await client.auth.updateUser({ data: { watchlist: next } });
      if (error) throw new Error('Could not save your watchlist. Please try again.');
      setSymbols(next);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save your watchlist.'); }
    finally { pending.current = false; setSaving(false); }
  };
  return { symbols, signedIn, loading, saving, error, toggle, reload: load };
}

export function WatchlistButton({ ticker, compact = false }: { ticker: string; compact?: boolean }) {
  const state = useWatchlist();
  if (state.loading) return <span className="text-xs text-muted-foreground">Loading watchlist…</span>;
  return <div className={compact ? "" : "mt-4"}>{!state.signedIn && !state.error ? <Link className="app-button-secondary" href={`/login?next=${encodeURIComponent(`/stock-analysis?ticker=${ticker}`)}`}>Sign in to save</Link> : <button className="app-button-secondary" disabled={state.saving || Boolean(state.error)} aria-pressed={state.symbols.includes(ticker)} onClick={() => void state.toggle(ticker)}><Star size={16} fill={state.symbols.includes(ticker) ? 'currentColor' : 'none'}/>{state.saving ? 'Saving…' : state.symbols.includes(ticker) ? 'Saved to watchlist' : 'Add to watchlist'}</button>}{state.error && <p role="alert" className="mt-2 text-xs text-destructive">{state.error} <button className="underline" onClick={() => void state.reload()}>Retry</button></p>}</div>;
}

export function WatchlistPanel() {
  const state = useWatchlist();
  return <section className="app-panel p-6 sm:p-8"><div className="flex items-center gap-3"><Star className="text-primary"/><h1 className="text-2xl font-semibold">Your watchlist</h1></div><p className="mt-3 text-sm text-muted-foreground">Keep up to {WATCHLIST_LIMIT} stocks with your account. Open a stock to load fresh research.</p>{state.loading ? <p role="status" className="mt-8">Loading your watchlist…</p> : state.error ? <p role="alert" className="mt-8 text-destructive">{state.error} <button className="underline" onClick={() => void state.reload()}>Try again</button></p> : !state.signedIn ? <Link href="/login?next=%2Fwatchlist" className="app-button mt-8">Sign in to save stocks</Link> : state.symbols.length === 0 ? <div className="mt-8 rounded-xl border border-dashed border-border p-8 text-center"><p className="text-muted-foreground">No saved stocks yet.</p><Link href="/stock-analysis" className="app-button mt-5">Find a stock</Link></div> : <ul className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{state.symbols.map(ticker => <li key={ticker} className="flex items-center rounded-xl border border-border bg-primary/5 p-4"><Link className="flex min-h-11 flex-1 items-center justify-between gap-4 font-semibold" href={`/stock-analysis?ticker=${ticker}`}>{ticker}<ArrowUpRight size={18} className="text-primary"/></Link><button disabled={state.saving} aria-label={`Remove ${ticker} from watchlist`} className="app-icon-button ml-4" onClick={() => void state.toggle(ticker)}><Trash2 size={17}/></button></li>)}</ul>}</section>;
}
