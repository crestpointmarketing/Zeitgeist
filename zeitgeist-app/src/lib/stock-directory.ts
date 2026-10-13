import 'server-only';
import { POPULAR_STOCKS, type StockSuggestion } from './stock-search';

const FILES = ['nasdaqlisted', 'otherlisted'] as const;
type DirectoryFile = typeof FILES[number];
const EXCHANGES: Record<string, string> = { A: 'NYSE American', N: 'NYSE', P: 'NYSE Arca', Z: 'Cboe', V: 'IEX' };

/** Nasdaq Trader's published symbol-directory format. Keep the app's supported symbol scope. */
export function parseStockDirectory(text: string, file: DirectoryFile): StockSuggestion[] {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const columns = header.split('|');
  const symbolColumn = file === 'nasdaqlisted' ? 'Symbol' : 'ACT Symbol';
  if (![symbolColumn, 'Security Name', 'Test Issue', 'ETF'].every(name => columns.includes(name))) {
    throw new Error('Invalid symbol directory');
  }
  const rows: StockSuggestion[] = [];
  for (const line of lines) {
    const values = line.split('|');
    if (values.length !== columns.length) continue;
    const get = (column: string) => values[columns.indexOf(column)]?.trim() ?? '';
    const symbol = get(symbolColumn), name = get('Security Name');
    if (!/^[A-Z]{1,5}$/.test(symbol) || get('Test Issue') !== 'N' || !name || name.length > 255) continue;
    rows.push({ symbol, name, exchange: file === 'nasdaqlisted' ? 'Nasdaq' : EXCHANGES[get('Exchange')] ?? 'US',
      kind: get('ETF') === 'Y' ? 'ETF' : 'Stock' });
  }
  return rows;
}

export function createStockDirectoryLoader(request: typeof fetch = fetch, now = Date.now) {
  let saved: { stocks: StockSuggestion[]; limited: boolean } | undefined;
  let expires = 0;
  let pending: Promise<NonNullable<typeof saved>> | undefined;
  return async () => {
    if (saved && now() < expires) return saved;
    if (pending) return pending;
    pending = (async () => {
      const files = await Promise.allSettled(FILES.map(async file => {
        // Fixed official origins, independent of user input; persistent cache avoids per-query downloads.
        const response = await request(`https://www.nasdaqtrader.com/dynamic/SymDir/${file}.txt`, {
          next: { revalidate: 21600 }, signal: AbortSignal.timeout(7000), redirect: 'error',
        });
        if (!response.ok) throw new Error('Directory unavailable');
        const text = await response.text();
        if (text.length > 2_000_000) throw new Error('Directory too large');
        const stocks = parseStockDirectory(text, file);
        if (stocks.length < 100) throw new Error('Incomplete directory');
        return stocks;
      }));
      const available = files.flatMap(file => file.status === 'fulfilled' ? file.value : []);
      const limited = files.some(file => file.status === 'rejected');
      const fallback = limited ? saved?.stocks ?? POPULAR_STOCKS : [];
      const bySymbol = new Map([...fallback, ...available].map(stock => [stock.symbol, stock]));
      saved = { stocks: [...bySymbol.values()], limited };
      expires = now() + (limited ? 60_000 : 21_600_000);
      return saved;
    })().finally(() => { pending = undefined; });
    return pending;
  };
}

export const getStockDirectory = createStockDirectoryLoader();
