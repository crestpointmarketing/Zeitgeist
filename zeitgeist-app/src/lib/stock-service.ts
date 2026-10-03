import 'server-only';
import { MarketDataError } from '@/lib/polygon';
import { getMarketSnapshot } from '@/lib/market-provider';
import { getFinancialEvidence, getOptionalCompany } from '@/lib/financial-provider';
import { getNewsEvidence } from '@/lib/news-provider';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAccount, reserveUsage, RequestError } from '@/lib/api-access';
import { analyzeStockData, ANALYSIS_MODEL } from '@/lib/anthropic';
import { analysisIdentity, stockEvidence, CALCULATION_VERSION, type StockSnapshot } from '@/lib/stock-evidence';
import { fingerprint, claimGeneration } from '@/lib/generation-cache';
import type { StockAnalysis, CompanyDetails } from '@/types/stock';

type Account = Awaited<ReturnType<typeof requireAccount>>;

export async function fetchSnapshot(account: Account, ticker: string, days = 30) {
  // Preflight storage before consuming provider quota.
  const admin = createAdminClient();
  const release = await reserveUsage(account.supabase, 'stock');
  try {
    const [{ stockData, companyDetails, priceHistory: history, source }, news, financials, profile] = await Promise.all([
      getMarketSnapshot(ticker, days), getNewsEvidence(ticker), getFinancialEvidence(ticker), getOptionalCompany(ticker),
    ]);
    const company: CompanyDetails = profile ?? companyDetails;
    stockData.name = company.name;
    stockData.primary_exchange = company.primary_exchange ?? stockData.primary_exchange;
    stockData.market_cap = company.market_cap;
    const completed = history.filter(bar => bar.timestamp <= stockData.timestamp).sort((a, b) => a.timestamp - b.timestamp);
    const snapshot: StockSnapshot = {
      stock_data: stockData, company_details: company, price_history: completed,
      news, financials, evidence: stockEvidence(stockData, completed, new Date().toISOString(), source, news, financials, company),
    };
    const { data, error } = await admin.from('market_snapshots').insert({ payload: snapshot }).select('id').single();
    if (error || !data) throw new RequestError('Could not save market data. Please retry.', 503);
    return { ...snapshot, snapshot_id: data.id as string };
  } catch (error) {
    if (error instanceof MarketDataError) throw new RequestError(error.message, error.status);
    throw error;
  } finally { await release(); }
}

export async function analyzeSnapshot(account: Account, id: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from('market_snapshots').select('payload')
    .eq('id', id).gt('expires_at', new Date().toISOString()).maybeSingle();
  if (error) throw new RequestError('Market data storage is unavailable.', 503);
  if (!data) throw new RequestError('Market data expired. Refresh the stock to continue.', 410);
  const snapshot = data.payload as StockSnapshot;
  if (snapshot.evidence.calculation_version !== CALCULATION_VERSION) {
    throw new RequestError('Market data calculations have changed. Refresh the stock to continue.', 410);
  }
  const hash = fingerprint(analysisIdentity(snapshot, ANALYSIS_MODEL));
  const claim = await claimGeneration<StockAnalysis>('analysis:' + hash, hash);
  if (claim.state === 'ready') return { status: 'ready' as const, analysis: claim.result!, cached: true };
  if (claim.state === 'pending') return { status: 'pending' as const };
  let release: (() => Promise<void>) | undefined;
  try {
    release = await reserveUsage(account.supabase, 'analysis');
    const analysis = {
      ...await analyzeStockData(snapshot.stock_data, snapshot.company_details, snapshot.price_history, snapshot.evidence.source, snapshot.news, snapshot.financials),
      evidence: snapshot.evidence,
    };
    await claim.finish(analysis);
    return { status: 'ready' as const, analysis, cached: false };
  } catch (error) {
    await claim.finish(null).catch(() => {}); // lease expiry is the crash fallback
    if (error instanceof RequestError && error.status === 429) {
      const today = new Date(); today.setUTCHours(0, 0, 0, 0);
      // Explain this user's daily denial without altering quotas or granting an override.
      let used = 0;
      try {
        const usage = await admin.from('api_usage').select('used').eq('scope', account.user.id)
          .eq('feature', 'analysis:day').eq('window_start', today.toISOString()).maybeSingle();
        used = usage.data?.used ?? 0;
      } catch { /* A failed explanation lookup cannot bypass the original denial. */ }
      if (used >= 10) {
        const reset = new Date(today.getTime() + 86400000).toISOString();
        throw new RequestError(`Daily AI analysis limit reached (${used}/10). Resets at ${reset}. Prices and the model lab remain available.`, 429);
      }
    }
    if (error instanceof RequestError) throw error;
    throw new RequestError('AI analysis could not be completed or did not pass validation. Your market data is available; retry analysis separately.', 502);
  } finally { await release?.(); }
}
