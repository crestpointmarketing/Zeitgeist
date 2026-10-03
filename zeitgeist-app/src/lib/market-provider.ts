import 'server-only';
import { z } from 'zod';
import { getCompleteStockInfo, MarketDataError } from './polygon';
import { sessionDate, stockFromBars } from './quote';

const positive = z.number().finite().positive();
const payloadSchema = z.object({
  ticker: z.string(), source: z.literal('DSA / Yahoo Finance (adjusted)'),
  bars: z.array(z.object({
    o: positive, h: positive, l: positive, c: positive,
    v: z.number().finite().nonnegative(), t: positive,
  })).min(2).max(90),
});

export function normalizeDsaPayload(payload: unknown, ticker: string, now = Date.now()) {
  const parsed = payloadSchema.safeParse(payload);
  if (!parsed.success || parsed.data.ticker !== ticker) throw new MarketDataError('Invalid market data from the DSA service.', 502);
  const bars = [...parsed.data.bars].sort((a, b) => a.t - b.t);
  const dates = new Set<string>();
  for (const bar of bars) {
    const date = sessionDate(bar.t);
    if (dates.has(date) || bar.t > now || bar.l > Math.min(bar.o, bar.c) || bar.h < Math.max(bar.o, bar.c)) {
      throw new MarketDataError('DSA returned inconsistent or incomplete trading sessions.', 502);
    }
    dates.add(date);
  }
  const latest = bars.at(-1)!;
  if (now - latest.t > 7 * 86400000) throw new MarketDataError('DSA market data is stale. Please retry later.', 503);
  return {
    stockData: stockFromBars(ticker, latest, bars.at(-2)!, 'unknown'),
    companyDetails: { ticker, name: ticker },
    priceHistory: bars.map(bar => ({ open: bar.o, high: bar.h, low: bar.l, close: bar.c, volume: bar.v,
      timestamp: bar.t, date: sessionDate(bar.t) })),
    source: parsed.data.source,
  };
}

export async function getMarketSnapshot(ticker: string, days: number) {
  const provider = process.env.MARKET_DATA_PROVIDER || 'polygon';
  if (provider === 'polygon') return { ...await getCompleteStockInfo(ticker, days), source: 'Polygon.io' };
  if (provider !== 'dsa') throw new MarketDataError('Unknown market data provider configuration.', 503);
  const base = process.env.DSA_BASE_URL;
  const token = process.env.DSA_SERVICE_TOKEN;
  if (!base || !token) throw new MarketDataError('DSA market data is not configured.', 503);
  try {
    const url = new URL(`/v1/history/${encodeURIComponent(ticker)}`, base);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) {
      throw new MarketDataError('DSA requires HTTPS outside localhost.', 503);
    }
    url.searchParams.set('days', String(Math.max(days, 30)));
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new MarketDataError(response.status === 429 ? 'DSA is busy. Please retry shortly.' : 'DSA market data is temporarily unavailable.', response.status === 429 ? 429 : 502);
    const result = normalizeDsaPayload(await response.json(), ticker);
    const cutoff = sessionDate(Date.now() - days * 86400000);
    return { ...result, priceHistory: result.priceHistory.filter(bar => bar.date >= cutoff) };
  } catch (error) {
    if (error instanceof MarketDataError) throw error;
    throw new MarketDataError('Could not reach the DSA market data service. Please retry.', 502);
  }
}
