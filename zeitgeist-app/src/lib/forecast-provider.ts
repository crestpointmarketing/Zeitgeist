import 'server-only';
import { RequestError } from './api-access';
import { parseForecast } from './forecast-schema';
import { parseForwardEvidence } from './forward-evidence';

export async function getForecast(ticker: string) {
  const base = process.env.DSA_BASE_URL, token = process.env.DSA_SERVICE_TOKEN;
  if (!base || !token) throw new RequestError('The experiment service is not configured.', 503);
  const url = new URL(`/v1/forecast/${encodeURIComponent(ticker)}`, base);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new RequestError('The experiment service requires a secure connection.', 503);
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(48_000) });
    if (response.status === 429) throw new RequestError('The experiment worker is busy. Try again shortly.', 429);
    if (response.status === 504) throw new RequestError('The experiment timed out. Please retry later.', 504);
    if (!response.ok) throw new RequestError('Experiment unavailable. It needs at least 400 complete sessions for a supported USD US-listed security.', 503);
    const raw=await response.json(),report=parseForecast(raw,ticker);
    return {...report,forward_evidence:parseForwardEvidence(raw.forward_evidence,report)};
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError('The experiment service returned incomplete or unavailable results.', 503);
  }
}
