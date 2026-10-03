import { z } from 'zod';
import type { CompanyDetails, StockAnalysis, StockData } from '@/types/stock';
import type { NewsEvidence } from './news-evidence';
import type { FinancialEvidence } from './financial-evidence';

const text = z.string().trim().min(1).max(6000);
const price = z.number().finite().positive();
const words = z.array(text).max(10);
export const analysisRequestSchema = z.object({
  stock_data: z.object({
    ticker: z.string().regex(/^[A-Z]{1,5}$/), name: text,
    price, previous_close: price, change: z.number().finite(), change_percent: z.number().finite(),
    open: price, high: price, low: price, volume: z.number().finite().nonnegative(),
    timestamp: z.number().finite().positive(), updated: z.string().datetime(),
    market_status: z.enum(['open', 'closed', 'extended-hours', 'unknown']),
    market: text, locale: text, primary_exchange: text, type: text,
    volume_weighted_average_price: price.optional(),
  }),
  company_details: z.object({
    ticker: text, name: text, description: z.string().max(8000).optional(),
    market_cap: z.number().finite().nonnegative().optional(),
    total_employees: z.number().int().nonnegative().optional(),
    sic_description: z.string().max(1000).optional(),
  }).optional(),
  price_history: z.array(z.object({
    open: price, high: price, low: price, close: price,
    volume: z.number().finite().nonnegative(), timestamp: z.number().finite().positive(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })).max(90).optional(),
});

const analysisSchema = z.object({
  summary: text,
  recommendation: z.enum(['STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL']),
  confidence_score: z.number().finite().min(0).max(100),
  technical_analysis: z.object({
    trend: z.enum(['BULLISH', 'BEARISH', 'NEUTRAL']),
    support_levels: z.array(price).max(3), resistance_levels: z.array(price).max(3),
    key_indicators: text, short_term_outlook: text,
  }),
  risk_factors: words, risk_level: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  price_targets: z.object({
    short_term: price.nullable(), medium_term: price.nullable(), long_term: price.nullable(),
  }),
  catalysts: words, concerns: words, comparable_companies: words.optional(), raw_analysis: text,
  news_analysis: z.array(z.object({ summary: z.string().trim().min(1).max(1200),
    source_ids: z.array(z.string().regex(/^N[1-5]$/)).min(1).max(5),
  })).max(3).optional().default([]),
  financial_analysis: z.array(z.object({ summary: z.string().trim().min(1).max(1200), period_end: z.string().date(), statement: z.enum(['income', 'balance_sheet', 'cash_flow']).optional().default('income') })).max(3).optional().default([]),
});

/** Identity and unprovided financial facts cannot be invented by the model. */
export function parseAnalysis(raw: unknown, stock: StockData, company: CompanyDetails | undefined, model: string, news?: NewsEvidence, financials?: FinancialEvidence): StockAnalysis {
  const parsed = analysisSchema.safeParse(raw);
  if (!parsed.success) throw new Error('AI analysis is incomplete or invalid');
  const result = parsed.data;
  if (result.financial_analysis.some(item => {
    if (!financials || financials.status !== 'ready') return true;
    const section = item.statement === 'income' ? {status: financials.income_status ?? financials.status, periods: financials.periods} : financials[item.statement];
    return section?.status !== 'ready' || !section.periods.some(period => period.period_end === item.period_end);
  })) {
    throw new Error('AI analysis references an unsupplied financial period');
  }
  const ids = new Set(news?.articles.map(article => article.id) ?? []);
  if (result.news_analysis.some(item => item.source_ids.some(id => !ids.has(id)))
    || [...JSON.stringify(result).matchAll(/\[(N\d+)\]/g)].some(match => !ids.has(match[1]))) {
    throw new Error('AI analysis references an unsupplied news source');
  }
  const unavailable = financials?.status === 'ready'
    ? 'Reported financial figures and per-statement availability are listed under Financials. A valuation judgment is not supplied.'
    : 'Unavailable: current financial statements were not supplied.';
  return {
    ...result, ticker: stock.ticker, company_name: stock.name,
    analysis_timestamp: new Date().toISOString(), model_used: model,
    fundamental_analysis: {
      valuation: 'UNAVAILABLE', financial_health: unavailable,
      growth_prospects: unavailable, competitive_position: unavailable,
    },
    sentiment_analysis: {
      market_sentiment: 'UNAVAILABLE', news_sentiment: ids.size
        ? 'Related reporting is listed under News & sources. No calibrated sentiment score is supplied.'
        : 'Unavailable: no usable news sources were supplied.',
    },
    key_metrics: { market_cap: company?.market_cap },
  };
}
