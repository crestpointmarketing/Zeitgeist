import 'server-only';
import { normalizeFinancials, unavailableFinancials } from './financial-evidence';
import { getCompanyDetails } from './polygon';

export async function getFinancialEvidence(ticker: string) {
  const base = process.env.DSA_BASE_URL, token = process.env.DSA_SERVICE_TOKEN;
  if (!base || !token) return unavailableFinancials(ticker);
  try {
    const url = new URL(`/v1/financials/${encodeURIComponent(ticker)}`, base);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) return unavailableFinancials(ticker);
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store',
      redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!response.ok) return unavailableFinancials(ticker);
    return normalizeFinancials(await response.json(), ticker);
  } catch { return unavailableFinancials(ticker); }
}

export async function getOptionalCompany(ticker: string) {
  if (!process.env.POLYGON_API_KEY) return null;
  try { return await getCompanyDetails(ticker); } catch { return null; }
}
