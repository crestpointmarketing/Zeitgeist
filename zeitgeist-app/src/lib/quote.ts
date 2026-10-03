import type { StockData } from '@/types/stock';

export interface DailyBar { o: number; h: number; l: number; c: number; v: number; t: number; vw?: number }

export function sessionDate(timestamp: number) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date(timestamp));
}

export function stockFromBars(ticker: string, current: DailyBar, prior: DailyBar, status: StockData['market_status']): StockData {
  if (!current || !prior || prior.t >= current.t || ![current.o, current.h, current.l, current.c, prior.c, current.t, prior.t].every(n => Number.isFinite(n) && n > 0)
    || sessionDate(prior.t) >= sessionDate(current.t)
    || !Number.isFinite(current.v) || current.v < 0) {
    throw new Error('Valid consecutive completed trading sessions are unavailable');
  }
  const change = current.c - prior.c;
  return {
    ticker, name: ticker, market: 'stocks', locale: 'us', primary_exchange: 'Unknown', type: 'CS',
    price: current.c, previous_close: prior.c, change, change_percent: change / prior.c * 100,
    volume: current.v, volume_weighted_average_price: current.vw,
    open: current.o, high: current.h, low: current.l,
    timestamp: current.t, updated: new Date(current.t).toISOString(),
    market_status: status, currency: 'USD',
  };
}
