import { getStockDirectory } from '@/lib/stock-directory';
import { POPULAR_STOCKS, searchStocks } from '@/lib/stock-search';

export const maxDuration = 15;
// Public company metadata only. Prices, AI and account data still require authentication.
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? '';
  if (query.length > 80 || /[\u0000-\u001f\u007f]/.test(query)) {
    return Response.json({ error: 'Use a company name or ticker of up to 80 characters.' }, { status: 400 });
  }
  if (!query) return Response.json({ results: POPULAR_STOCKS.slice(0, 6), limited: false });
  const directory = await getStockDirectory();
  return Response.json({ results: searchStocks(directory.stocks, query), limited: directory.limited,
    source: 'Nasdaq Trader', coverage: 'US-listed stocks and ETFs with 1–5 letter symbols' }, {
    headers: { 'Cache-Control': directory.limited ? 'no-store' : 'public, max-age=300, s-maxage=300' },
  });
}
