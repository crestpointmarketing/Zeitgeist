import 'server-only';
import { getPolygonNews } from './polygon';
import { normalizeNewsPayload, unavailableNews } from './news-evidence';

/** Optional evidence must never take down the price snapshot. */
export async function getNewsEvidence(ticker: string) {
  if (!process.env.POLYGON_API_KEY) return unavailableNews('not_configured');
  try { return normalizeNewsPayload(await getPolygonNews(ticker), ticker); }
  catch { return unavailableNews(); }
}
