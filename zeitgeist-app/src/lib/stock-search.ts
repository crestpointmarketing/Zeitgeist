export interface StockSuggestion { symbol: string; name: string; exchange?: string; kind?: 'Stock' | 'ETF' }

export const POPULAR_STOCKS: StockSuggestion[] = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'META', name: 'Meta Platforms Inc.' },
  { symbol: 'NVDA', name: 'NVIDIA Corporation' },
  { symbol: 'NFLX', name: 'Netflix Inc.' },
  { symbol: 'DIS', name: 'The Walt Disney Company' },
  { symbol: 'V', name: 'Visa Inc.' },
  { symbol: 'JPM', name: 'JPMorgan Chase & Co.' },
  { symbol: 'JNJ', name: 'Johnson & Johnson' },
  { symbol: 'WMT', name: 'Walmart Inc.' },
  { symbol: 'PG', name: 'Procter & Gamble Co.' },
  { symbol: 'UNH', name: 'UnitedHealth Group Inc.' }
];
const searchable = (value: string) => value.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();

/** Exact symbols first, then symbol prefixes, then company-name matches. */
export function searchStocks(stocks: StockSuggestion[], value: string, limit = 12): StockSuggestion[] {
  if (/^(?:[a-z]{1,5}[.-][a-z0-9]{1,3}|\d+(?:\.[a-z]+)?)$/i.test(value.trim())) return [];
  const query = searchable(value);
  if (!query) return value.trim() ? [] : stocks.slice(0, limit);
  const words = query.split(/\s+/);
  return stocks.map(stock => {
    const symbol = stock.symbol.toLowerCase(), name = searchable(stock.name);
    const nameWords = name.split(/\s+/);
    const rank = symbol === query ? 0 : symbol.startsWith(query) ? 1 : name.startsWith(query) ? 2
      : words.every(word => nameWords.some(part => part.startsWith(word))) ? 3 : symbol.includes(query) ? 4 : 5;
    return { stock, rank };
  }).filter(row => row.rank < 5).sort((a, b) => a.rank - b.rank || a.stock.symbol.localeCompare(b.stock.symbol))
    .slice(0, limit).map(row => row.stock);
}

export function resolveStockQuery(value: string, stocks = POPULAR_STOCKS): string {
  const query = value.trim().toLowerCase();
  const exact = stocks.find(stock => stock.symbol.toLowerCase() === query);
  if (exact) return exact.symbol;
  const companies = query.length >= 3 ? searchStocks(stocks, value) : [];
  return companies.length === 1 ? companies[0].symbol : value;
}
