import { z } from 'zod';
import { requireAccount, readJson, requestErrorResponse, RequestError } from '@/lib/api-access';
import { analyzeSnapshot } from '@/lib/stock-service';

export const maxDuration = 60;
const input = z.object({ snapshot_id: z.string().uuid() }).strict();
export async function POST(request: Request) {
  try {
    const account = await requireAccount();
    const parsed = input.safeParse(await readJson(request));
    if (!parsed.success) throw new RequestError('A server-issued market snapshot ID is required.', 400);
    const result = await analyzeSnapshot(account, parsed.data.snapshot_id);
    return Response.json({ success: true, data: result }, {
      status: result.status === 'pending' ? 202 : 200,
      headers: { 'Cache-Control': 'no-store', ...(result.status === 'pending' ? { 'Retry-After': '2' } : {}) },
    });
  } catch (error) { return requestErrorResponse(error); }
}
