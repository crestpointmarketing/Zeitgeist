import type { FinancialEvidence } from '@/lib/financial-evidence';
import type { CompanyDetails, StockAnalysis } from '@/types/stock';

export function StockFinancials({ financials, company, analysis }: {
  financials?: FinancialEvidence; company: CompanyDetails; analysis?: StockAnalysis | null;
}) {
  const ratio = (value: number | null | undefined) => value == null ? 'Unavailable' : value.toFixed(2) + '%';
  return <section aria-label="Company and financial statements" className="space-y-6 p-5 sm:p-7">
    <header><p className="app-eyebrow">Company &amp; financials</p><h2 className="mt-2 text-xl font-semibold">{company.name}</h2>
      {company.description && <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{company.description}</p>}
      <p className="mt-3 text-xs text-muted-foreground">Company profile: {company.source ?? 'Unavailable'}{company.primary_exchange ? ` · Exchange: ${company.primary_exchange}` : ''}</p>
    </header>
    {!financials || financials.status === 'unavailable' ? <p role="status" className="rounded-xl border border-border bg-background p-5 text-sm text-muted-foreground">Financial statements are unavailable. Price history and news remain available; refresh prices to retry.</p> : <>
      <div><h3 className="font-semibold">Financial statements</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Source: {financials.source} · Amounts in {financials.currency}. Income and cash-flow columns cover one reported quarter, not a full year. Balance sheets show balances at the reporting date.</p>
        <p className="mt-2 text-xs text-muted-foreground">Provider period labels are shown below. Filing dates are unavailable; period end is not the publication date.</p>
        {financials.status === 'stale' && <p role="status" className="mt-3 text-sm text-amber-200">The latest period is more than 180 days old. These figures are excluded from AI interpretation.</p>}
      </div>
      <StatementTable title="Income statement" periods={financials.periods} status={financials.income_status ?? financials.status}
        rows={[["Revenue", "revenue"], ["Net income", "net_income"], ["Operating income", "operating_income"], ["Diluted EPS (per share)", "diluted_eps"]]}/>
      <dl className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-background p-4"><dt className="text-xs text-muted-foreground">Latest quarter net margin</dt><dd className="mt-2 text-xl font-medium">{ratio(financials.net_margin_percent)}</dd></div><div className="rounded-xl bg-background p-4"><dt className="text-xs text-muted-foreground">Revenue change vs. same quarter last year</dt><dd className="mt-2 text-xl font-medium">{ratio(financials.revenue_yoy_percent)}</dd></div></dl>
      <p className="text-xs leading-relaxed text-muted-foreground">Ratios are calculated from supplied figures. Year-over-year growth requires a comparable quarter about one year earlier; missing data is not zero. Each statement retains its own dates and availability; missing statements do not erase the others.</p>
      <StatementTable title="Balance sheet" periods={financials.balance_sheet?.periods ?? []} status={financials.balance_sheet?.status ?? 'unavailable'}
        description="Balances at each reporting date, not amounts earned or spent during the quarter."
        rows={[["Total assets", "total_assets"], ["Total liabilities", "total_liabilities"], ["Stockholders’ equity", "equity"], ["Cash & equivalents", "cash"], ["Total debt", "total_debt"]]}/>
      <StatementTable title="Cash flow statement" periods={financials.cash_flow?.periods ?? []} status={financials.cash_flow?.status ?? 'unavailable'}
        description="Individual quarterly cash flows. Capital expenditure retains the provider sign; outflows are usually negative. Free cash flow is provider-reported."
        rows={[["Operating cash flow", "operating_cash_flow"], ["Capital expenditure", "capital_expenditure"], ["Free cash flow", "free_cash_flow"]]}/>
      {financials.status === 'ready' && !!analysis?.financial_analysis?.length && <div className="rounded-xl border border-blue-400/25 bg-blue-500/5 p-4"><h3 className="text-sm font-semibold text-blue-200">AI reading of the financials</h3>{analysis.financial_analysis.map((item,index) => <div key={index} className="mt-3"><p className="text-xs text-muted-foreground">{item.statement === 'balance_sheet' ? 'Balance sheet as of' : item.statement === 'cash_flow' ? 'Cash flow quarter ended' : 'Income quarter ended'} {item.period_end}</p><p className="mt-1 text-sm leading-relaxed">{item.summary}</p></div>)}</div>}
      <a className="inline-block text-sm text-primary underline underline-offset-4" href={financials.url} target="_blank" rel="noopener noreferrer">View provider financial statements ↗</a>
      <p className="text-xs text-muted-foreground">Retrieved: {financials.fetched_at}</p>
    </>}
  </section>;
}


function StatementTable<T extends { period_end: string }>({ title, description, periods, status, rows }: {
  title: string; description?: string; periods: T[]; status: string; rows: Array<[string, keyof T]>;
}) {
  const money = (value: unknown, eps: boolean) => typeof value !== 'number' ? 'Unavailable' : eps ? value.toFixed(2)
    : new Intl.NumberFormat('en-US', {notation:'compact',maximumFractionDigits:2}).format(value);
  return <section className="space-y-3" aria-label={title}>
    <h3 className="font-semibold">{title}</h3>
    {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
    {status === 'unavailable' || !periods.length ? <p role="status" className="text-sm text-muted-foreground">This statement is unavailable. Other statements remain usable.</p> : <>
      {status === 'stale' && <p role="status" className="text-sm text-amber-200">Latest period is over 180 days old; excluded from AI interpretation.</p>}
      <div className="overflow-x-auto rounded-xl border border-border" tabIndex={0} role="region" aria-label={`${title} table`}>
        <table className="w-full min-w-[520px] text-left text-sm"><caption className="sr-only">{title}; amounts in the statement currency shown above</caption>
          <thead className="bg-primary/5"><tr><th scope="col" className="p-3">Period end</th>{periods.map(period=><th key={period.period_end} scope="col" className="whitespace-nowrap p-3 tabular-nums">{period.period_end}</th>)}</tr></thead>
          <tbody>{rows.map(([label,key])=><tr key={String(key)} className="border-t border-border"><th scope="row" className="p-3 font-medium text-muted-foreground">{label}</th>{periods.map(period=><td key={period.period_end} className="p-3 tabular-nums">{money(period[key], key==='diluted_eps')}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </>}
  </section>;
}
