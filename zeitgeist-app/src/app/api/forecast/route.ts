import { requireAccount, readJson, reserveUsage, RequestError, requestErrorResponse } from '@/lib/api-access';
import { validateStockTicker } from '@/lib/stock-utils';
import { getForecast } from '@/lib/forecast-provider';
export const maxDuration = 60;

export async function POST(request: Request) {
  let release: (() => Promise<void>) | undefined;
  try {
    const { supabase } = await requireAccount();
    const body = await readJson(request, 1024);
    if (!body || typeof body !== 'object' || !('ticker' in body) || typeof body.ticker !== 'string') throw new RequestError('Provide a stock ticker.', 400);
    const ticker = validateStockTicker(body.ticker);
    if (!ticker.isValid) throw new RequestError('Provide a valid US stock ticker.', 400);
    // This opt-in CPU/data request shares the existing market-data budget, not AI quota.
    release = await reserveUsage(supabase, 'stock');
    const data = await getForecast(ticker.formattedTicker);
    return Response.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return requestErrorResponse(error); }
  finally { await release?.(); }
}
