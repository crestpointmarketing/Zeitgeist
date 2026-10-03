import { z } from 'zod';

export interface FinancialPeriod {
  period_end: string;
  revenue: number | null;
  net_income: number | null;
  operating_income: number | null;
  diluted_eps: number | null;
}
export interface FinancialEvidence {
  status: 'ready' | 'stale' | 'unavailable';
  source: string;
  url: string;
  fetched_at: string;
  currency: string | null;
  periods: FinancialPeriod[];
  net_margin_percent: number | null;
  revenue_yoy_percent: number | null;
  income_status?: FinancialEvidence['status'];
  balance_sheet?: StatementBlock<BalancePeriod>;
  cash_flow?: StatementBlock<CashPeriod>;
}
export interface BalancePeriod { period_end: string; total_assets: number | null; total_liabilities: number | null;
  equity: number | null; cash: number | null; total_debt: number | null }
export interface CashPeriod { period_end: string; operating_cash_flow: number | null; capital_expenditure: number | null; free_cash_flow: number | null }
export interface StatementBlock<T> { status: FinancialEvidence['status']; periods: T[] }
export function unavailableFinancials(ticker: string, now = Date.now()): FinancialEvidence {
  return { status: 'unavailable', source: 'Yahoo Finance financial statements',
    url: `https://finance.yahoo.com/quote/${encodeURIComponent(ticker)}/financials/`,
    fetched_at: new Date(now).toISOString(), currency: null, periods: [], net_margin_percent: null, revenue_yoy_percent: null };
}
const number = z.number().finite().nullable();
const period = z.object({ period_end: z.string().date(), revenue: number, net_income: number,
  operating_income: number, diluted_eps: number });
const nonnegative = z.number().finite().nonnegative().nullable();
const balance = z.object({ period_end: z.string().date(), total_assets: nonnegative, total_liabilities: nonnegative,
  equity: number, cash: nonnegative, total_debt: nonnegative });
const cash = z.object({ period_end: z.string().date(), operating_cash_flow: number, capital_expenditure: number, free_cash_flow: number });
const schema = z.object({ ticker: z.string(), currency: z.string().regex(/^[A-Z]{3}$/), periods: z.array(period).max(6),
  balance_sheet: z.array(balance).max(6).optional().default([]), cash_flow: z.array(cash).max(6).optional().default([]) });

function block<T extends { period_end: string }>(input: T[], now: number): StatementBlock<T> {
  const seen = new Set<string>();
  const periods = input.filter(item => {
    if (Date.parse(item.period_end) > now || seen.has(item.period_end)) throw new Error('Invalid financial period');
    seen.add(item.period_end);
    return Object.entries(item).some(([key, value]) => key !== 'period_end' && value !== null);
  }).sort((a, b) => b.period_end.localeCompare(a.period_end));
  return { periods, status: !periods.length ? 'unavailable' : now - Date.parse(periods[0].period_end) > 180 * 86400000 ? 'stale' : 'ready' };
}

/** Never send stale statement values to the model, even if another statement is fresh. */
export function financialsForAnalysis(financials?: FinancialEvidence) {
  if (!financials || financials.status !== 'ready') return { status: financials?.status ?? 'unavailable' };
  const incomeReady = (financials.income_status ?? financials.status) === 'ready';
  const visible = <T,>(section?: StatementBlock<T>) => section?.status === 'ready' ? section : { status: section?.status ?? 'unavailable', periods: [] };
  return { ...financials, periods: incomeReady ? financials.periods : [],
    net_margin_percent: incomeReady ? financials.net_margin_percent : null, revenue_yoy_percent: incomeReady ? financials.revenue_yoy_percent : null,
    balance_sheet: visible(financials.balance_sheet), cash_flow: visible(financials.cash_flow) };
}
export function normalizeFinancials(raw: unknown, ticker: string, now = Date.now()): FinancialEvidence {
  const value = schema.parse(raw);
  if (value.ticker !== ticker) throw new Error('Financial statement symbol mismatch');
  const income = block(value.periods, now), balance_sheet = block(value.balance_sheet, now), cash_flow = block(value.cash_flow, now);
  const periods = income.periods;
  const latest = periods[0];
  const priorYear = latest && periods.find(item => Math.abs((Date.parse(latest.period_end) - Date.parse(item.period_end)) / 86400000 - 365) <= 20);
  const statuses = [income.status, balance_sheet.status, cash_flow.status];
  return { ...unavailableFinancials(ticker, now), status: statuses.includes('ready') ? 'ready' : statuses.includes('stale') ? 'stale' : 'unavailable',
    currency: value.currency, periods, income_status: income.status, balance_sheet, cash_flow,
    net_margin_percent: latest?.revenue != null && latest.revenue > 0 && latest.net_income !== null ? latest.net_income / latest.revenue * 100 : null,
    revenue_yoy_percent: latest?.revenue != null && priorYear?.revenue != null && priorYear.revenue > 0
      ? (latest.revenue / priorYear.revenue - 1) * 100 : null };
}
