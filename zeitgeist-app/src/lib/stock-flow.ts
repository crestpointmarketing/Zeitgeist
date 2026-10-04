import type { StockSnapshot } from './stock-evidence';
import type { StockAnalysis } from '@/types/stock';

export class StockResponseError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export type MarketResult = StockSnapshot & { snapshot_id: string };
export type AnalysisResult = { status: 'ready'; analysis: StockAnalysis; cached: boolean };

async function responseData(response: Response) {
  let body;
  try { body = await response.json(); }
  catch { throw new StockResponseError('The service returned an unreadable response. Please try again shortly.', response.status); }
  if (!body || typeof body !== 'object') throw new StockResponseError('The service returned an empty response. Please try again shortly.', response.status);
  if (!response.ok || !body.success) throw new StockResponseError(body.error?.message || 'Request failed.', response.status);
  return body.data;
}

function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const aborted = () => { clearTimeout(timer); reject(new DOMException('Cancelled', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', aborted); resolve(); }, 2000);
    if (signal.aborted) aborted();
    else signal.addEventListener('abort', aborted, { once: true });
  });
}

export async function fetchAnalysis(snapshotId: string, signal: AbortSignal, request = fetch): Promise<AnalysisResult> {
  const timeout = AbortSignal.timeout(60000);
  const boundedSignal = AbortSignal.any([signal, timeout]);
  try { do {
    const data = await responseData(await request('/api/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot_id: snapshotId }), signal: boundedSignal,
    }));
    if (data.status === 'ready') return data;
    if (data.status !== 'pending') throw new Error('Unexpected analysis response.');
    await pause(boundedSignal);
  } while (!boundedSignal.aborted);
  throw boundedSignal.reason;
  } catch (error) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (timeout.aborted) throw new Error('AI analysis took longer than 60 seconds. Your prices are ready. Please retry the analysis shortly.');
    throw error;
  }
}

export async function runStockSearch(ticker: string, signal: AbortSignal, onStock: (data: MarketResult) => void, request = fetch) {
  const timeout = AbortSignal.timeout(45000);
  const boundedSignal = AbortSignal.any([signal, timeout]);
  let data: MarketResult;
  try {
    data = await responseData(await request('/api/stock?ticker=' + encodeURIComponent(ticker) + '&include_history=true', { signal: boundedSignal }));
  } catch (error) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    if (timeout.aborted) throw new Error('Market data took longer than 45 seconds. Please try again shortly.');
    throw error;
  }
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  onStock(data); // Publish prices before waiting for the model.
  return fetchAnalysis(data.snapshot_id, signal, request);
}
