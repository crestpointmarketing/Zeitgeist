import { z } from 'zod';
import { requireAccount, readJson, requestErrorResponse, RequestError } from '@/lib/api-access';
import { fetchSnapshot, analyzeSnapshot } from '@/lib/stock-service';

export const maxDuration = 90;
const input = z.object({
  ticker: z.string().trim().toUpperCase().regex(/^[A-Z]{1,5}$/),
  options: z.object({ days_history: z.number().int().min(1).max(90).optional() }).optional(),
});
/** Compatibility endpoint; the UI uses the separate stock/analyze routes. */
export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    const parsed = input.safeParse(await readJson(request));
    if (!parsed.success) throw new RequestError('Invalid stock request.', 400);
    const snapshot = await fetchSnapshot(account, parsed.data.ticker, parsed.data.options?.days_history);
    try {
      const result = await analyzeSnapshot(account, snapshot.snapshot_id);
      return Response.json({ success: true, data: { ...snapshot, ...result } }, {
        status: result.status === 'pending' ? 202 : 200, headers: { 'Cache-Control': 'no-store' },
      });
    } catch {
      return Response.json({ success: true, data: { ...snapshot, analysis_error: { message: 'AI analysis is unavailable. Your market data is still available.' } } }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }
  } catch (error) { return requestErrorResponse(error); }
}
