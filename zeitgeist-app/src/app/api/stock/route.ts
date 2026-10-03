import { requireAccount, requestErrorResponse, RequestError } from '@/lib/api-access';
import { fetchSnapshot } from '@/lib/stock-service';
import { validateStockTicker } from '@/lib/stock-utils';

export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const account = await requireAccount();
    const params = new URL(request.url).searchParams;
    const ticker = validateStockTicker(params.get('ticker') ?? '');
    const days = Number(params.get('days_history') ?? 30);
    if (!ticker.isValid || !Number.isInteger(days) || days < 1 || days > 90) {
      throw new RequestError('Provide a valid ticker and 1–90 history days.', 400);
    }
    const data = await fetchSnapshot(account, ticker.formattedTicker, days);
    return Response.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return requestErrorResponse(error); }
}
