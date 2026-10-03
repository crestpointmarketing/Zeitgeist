import type { CompanyDetails, StockData, StockPriceData } from '@/types/stock';
import { sessionDate } from './quote';
import type { FinancialEvidence } from './financial-evidence';
import type { NewsEvidence } from './news-evidence';

export const PROMPT_VERSION = 'daily-evidence-v6-statements';
export const CALCULATION_VERSION = 'session-close-v2';
export interface StockSnapshot {
  stock_data: StockData;
  company_details: CompanyDetails;
  price_history: StockPriceData[];
  evidence: ReturnType<typeof stockEvidence>;
  news?: NewsEvidence;
  financials?: FinancialEvidence;
}

/** All numeric indicators are deterministic and based on completed daily bars. */
export function stockEvidence(stock: StockData, history: StockPriceData[], fetchedAt: string, source = 'Polygon.io', news?: NewsEvidence, financials?: FinancialEvidence, company?: CompanyDetails) {
  const bars = [...history].filter(bar => bar.timestamp <= stock.timestamp && Number.isFinite(bar.close) && bar.close > 0)
    .sort((a, b) => a.timestamp - b.timestamp);
  const average = (days: number) => bars.length < days ? null
    : bars.slice(-days).reduce((sum, bar) => sum + bar.close, 0) / days;
  return {
    source, calculation_version: CALCULATION_VERSION, session_date: sessionDate(stock.timestamp), fetched_at: fetchedAt,
    history_start: bars[0]?.date ?? null, history_end: bars.at(-1)?.date ?? null, bars: bars.length,
    sma5: average(5), sma20: average(20),
    return_percent: bars.length >= 2 ? (bars.at(-1)!.close / bars[0].close - 1) * 100 : null,
    missing: [
      ...((financials?.income_status ?? financials?.status) !== 'ready' ? ['Income statements'] : []),
      ...(financials?.balance_sheet?.status !== 'ready' ? ['Balance sheets'] : []),
      ...(financials?.cash_flow?.status !== 'ready' ? ['Cash-flow statements'] : []), 'Live quotes', ...(!news?.articles.length ? ['News sources'] : []),
      ...(!company?.source && source.startsWith('DSA') ? ['Company profile and exchange metadata'] : []),
      ...(bars.length < 20 ? ['20 completed sessions for SMA20'] : []),
    ],
  };
}

/** Excludes retrieval time and transient market status, includes all model inputs. */
export function analysisIdentity(snapshot: StockSnapshot, model: string) {
  const { stock_data: stock, company_details: company, price_history: history } = snapshot;
  return {
    version: PROMPT_VERSION, source: snapshot.evidence.source, model, ticker: stock.ticker,
    session: stock.timestamp, name: stock.name, price: stock.price, prior: stock.previous_close,
    open: stock.open, high: stock.high, low: stock.low, volume: stock.volume,
    vwap: stock.volume_weighted_average_price ?? null,
    company: { name: company.name, description: company.description ?? null, market_cap: company.market_cap ?? null,
      total_employees: company.total_employees ?? null, industry: company.sic_description ?? null },
    history: history.map(bar => [bar.timestamp, bar.open, bar.high, bar.low, bar.close, bar.volume]),
    financials: snapshot.financials ? { status: snapshot.financials.status, source: snapshot.financials.source,
      currency: snapshot.financials.currency, periods: snapshot.financials.periods, income_status: snapshot.financials.income_status,
      balance_sheet: snapshot.financials.balance_sheet, cash_flow: snapshot.financials.cash_flow } : null,
    news: { status: snapshot.news?.status ?? 'unavailable', source: snapshot.news?.source ?? null,
      articles: snapshot.news?.articles ?? [] },
  };
}
