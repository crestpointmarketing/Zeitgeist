export const POPULAR_STOCKS = [
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
export function resolveStockQuery(value: string): string {
  const query = value.trim().toLowerCase();
  const exact = POPULAR_STOCKS.find(stock => stock.symbol.toLowerCase() === query);
  if (exact) return exact.symbol;
  const companies = query.length >= 3 ? POPULAR_STOCKS.filter(stock => stock.name.toLowerCase().includes(query)) : [];
  return companies.length === 1 ? companies[0].symbol : value;
}
