import type { StockSnapshot } from './stock-evidence';
import type { StockAnalysis } from '@/types/stock';

export class StockResponseError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export type MarketResult = StockSnapshot & { snapshot_id: string };
export type AnalysisResult = { status: 'ready'; analysis: StockAnalysis; cached: boolean };

async function responseData(response: Response) {
  const body = await response.json();
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
  const deadline = Date.now() + 90000;
  do {
    const data = await responseData(await request('/api/analyze', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot_id: snapshotId }), signal,
    }));
    if (data.status === 'ready') return data;
    if (data.status !== 'pending') throw new Error('Unexpected analysis response.');
    await pause(signal);
  } while (Date.now() < deadline);
  throw new Error('Analysis is still processing. Retry shortly; your prices remain available.');
}

export async function runStockSearch(ticker: string, signal: AbortSignal, onStock: (data: MarketResult) => void, request = fetch) {
  const data: MarketResult = await responseData(await request('/api/stock?ticker=' + encodeURIComponent(ticker) + '&include_history=true', { signal }));
  if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
  onStock(data); // Publish prices before waiting for the model.
  return fetchAnalysis(data.snapshot_id, signal, request);
}
