"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import type { StockAnalysis } from '@/types/stock';
import { runStockSearch, fetchAnalysis, StockResponseError, type MarketResult } from '@/lib/stock-flow';
import StockInput from './stock-input';
import { WorkspaceShell } from './workspace-shell';
import { ResearchDashboard } from './research-dashboard';

interface Props { className?: string; autoFocus?: boolean; showWelcome?: boolean; defaultTicker?: string }
interface State {
  market: MarketResult | null; analysis: StockAnalysis | null; cached: boolean;
  fetchingStock: boolean; fetchingAnalysis: boolean; error: string | null; analysisError: string | null;
  needsLogin: boolean; ticker: string;
}
const INITIAL: State = { market: null, analysis: null, cached: false, fetchingStock: false, fetchingAnalysis: false, error: null, analysisError: null, needsLogin: false, ticker: '' };

export function StockAnalysisContainer({ className, autoFocus = false, defaultTicker }: Props) {
  const [state, setState] = useState<State>(INITIAL);
  const active = useRef<AbortController | null>(null);
  const reset = useCallback(() => { active.current?.abort(); active.current = null; setState(INITIAL); }, []);

  const search = useCallback(async (ticker: string) => {
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setState({ ...INITIAL, ticker, fetchingStock: true });
    let receivedPrices = false;
    try {
      const result = await runStockSearch(ticker, controller.signal, market => {
        if (active.current !== controller) return;
        receivedPrices = true;
        setState(prev => ({ ...prev, market, fetchingStock: false, fetchingAnalysis: true }));
      });
      if (active.current === controller && !controller.signal.aborted) {
        setState(prev => ({ ...prev, analysis: result.analysis, cached: result.cached, fetchingAnalysis: false }));
      }
    } catch (error) {
      if (active.current !== controller || controller.signal.aborted) return;
      const message = error instanceof Error ? error.message : 'Request failed.';
      setState(prev => ({ ...prev, fetchingStock: false, fetchingAnalysis: false,
        needsLogin: error instanceof StockResponseError && error.status === 401,
        error: receivedPrices ? null : message, analysisError: receivedPrices ? message : null,
      }));
    }
  }, []);

  const retryAnalysis = async () => {
    if (!state.market || state.fetchingAnalysis) return;
    active.current?.abort();
    const controller = new AbortController(); active.current = controller;
    setState(prev => ({ ...prev, fetchingAnalysis: true, analysisError: null }));
    try {
      const result = await fetchAnalysis(state.market.snapshot_id, controller.signal);
      if (active.current === controller && !controller.signal.aborted) setState(prev => ({ ...prev, analysis: result.analysis, cached: result.cached, fetchingAnalysis: false }));
    } catch (error) {
      if (active.current !== controller || controller.signal.aborted) return;
      setState(prev => ({ ...prev, fetchingAnalysis: false, analysisError: error instanceof Error ? error.message : 'Analysis unavailable.', needsLogin: error instanceof StockResponseError && error.status === 401 }));
    }
  };

  useEffect(() => {
    if (defaultTicker) void search(defaultTicker);
    return () => { active.current?.abort(); };
  }, [defaultTicker, search]);

  const input = <StockInput selectedTicker={state.ticker} onSearch={search} isLoading={state.fetchingStock} autoFocus={autoFocus} className="w-full max-w-none" placeholder="Search a company or ticker…" showSuggestions />;
  return <WorkspaceShell search={state.ticker ? input : undefined}><div className={className}>{!state.ticker ? <section className="mx-auto flex min-h-[calc(100svh-140px)] max-w-2xl flex-col items-center justify-center pb-20 text-center" aria-label="Find a stock"><h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Explore the market.</h1><p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">Understand a stock. See what’s behind the move.</p><div className="mt-8 w-full">{input}</div><div className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Popular stocks">{['AAPL','NVDA','MSFT','TSLA'].map(ticker=><button className="min-h-11 rounded-lg border border-border px-4 text-sm font-medium hover:border-blue-400 hover:bg-blue-400/5" key={ticker} onClick={()=>void search(ticker)}>{ticker}</button>)}</div><p className="mt-10 text-xs tracking-wide text-muted-foreground">Search <span className="px-3">→</span> Explore <span className="px-3">→</span> Ask AI</p></section> : <ResearchDashboard key={state.ticker} {...state} onSearch={search} onRetry={retryAnalysis} onReset={reset}/>}</div></WorkspaceShell>;
}
export default StockAnalysisContainer;
