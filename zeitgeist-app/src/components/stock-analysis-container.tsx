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

  return <WorkspaceShell search={<StockInput selectedTicker={state.ticker} onSearch={search} isLoading={state.fetchingStock} autoFocus={autoFocus} className="w-full max-w-none" placeholder="Search a stock, e.g. AAPL, TSLA, NVDA…" showSuggestions />}><div className={className}><ResearchDashboard {...state} onSearch={search} onRetry={retryAnalysis} onReset={reset}/></div></WorkspaceShell>;
}
export default StockAnalysisContainer;
